// The original site's board rule, checked against the site's own code
// (vendor/setwithfriends/util.js) on simulated normal-mode games.
import assert from "node:assert/strict";
import { test } from "node:test";
import { findSets } from "../lib/cards.js";
import { removeCardsSwf, replayGame } from "../lib/replay.js";
import { computeState } from "../vendor/setwithfriends/util.js";

const GAMES = 2000;

// mulberry32: small seeded PRNG so every run simulates the same games
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledDeck(random) {
  const deck = [];
  for (let i = 0; i < 81; i++)
    deck.push([27, 9, 3, 1].map((d) => Math.floor(i / d) % 3).join(""));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const pushKey = (i) => `-K${String(i).padStart(4, "0")}`;

/** gameData the way the site stores it, from the first `n` events. */
function gameData(deck, events, n = events.length) {
  return {
    deck,
    events: Object.fromEntries(
      events
        .slice(0, n)
        .map((e, i) => [
          e.push_key,
          { user: e.user_id, time: e.time_ms, c1: e.c1, c2: e.c2, c3: e.c3 },
        ]),
    ),
  };
}

/**
 * Play one game against the site's computeState: each turn, take a random
 * set from the board the site shows, and check the replay agrees with the
 * site so far by calling `check(deck, events, siteState)`. Sometimes also submit an event the site
 * ignores (a repeated card, or a card already taken), and sometimes give two
 * events the same time, to exercise the tie-break.
 */
function simulate(seed, check) {
  const random = prng(seed);
  const deck = shuffledDeck(random);
  const events = [];
  const taken = [];
  let time = 1_000_000;
  for (;;) {
    const state = computeState(gameData(deck, events), "normal");
    check(deck, events, state);
    const { current, boardSize } = state;
    const board = current.slice(0, boardSize);
    const sets = findSets(board);
    if (!sets.length) break;
    if (random() < 0.15) time += Math.floor(random() * 5000) + 1;
    const add = (cards) =>
      events.push({
        seq: events.length,
        push_key: pushKey(events.length),
        time_ms: time,
        user_id: random() < 0.5 ? "a" : "b",
        c1: cards[0],
        c2: cards[1],
        c3: cards[2],
      });
    if (taken.length && random() < 0.1)
      add([taken[Math.floor(random() * taken.length)], board[0], board[1]]);
    if (random() < 0.05) add([board[0], board[0], board[1]]);
    const cards = sets[Math.floor(random() * sets.length)].map((p) => board[p]);
    // click order matters for the refill, so shuffle it too
    if (random() < 0.5) cards.reverse();
    if (random() < 0.5) cards.push(cards.shift());
    add(cards);
    taken.push(...cards);
  }
  return { deck, events };
}

const games = [];
const row = (i, deck, source = "swf") => ({
  game_id: `sim-${i}`,
  started_at: 0,
  deck: JSON.stringify(deck),
  source,
});

test("removeCardsSwf matches the site's removeCards in a few cases", () => {
  const deck = Array.from({ length: 20 }, (_, i) => `c${i}`);
  // all in the first 12: holes filled from 12, 13, 14 in click order
  let cur = deck.slice();
  removeCardsSwf(cur, ["c5", "c1", "c9"]);
  assert.deepEqual(cur.slice(0, 12), [
    "c0",
    "c13",
    "c2",
    "c3",
    "c4",
    "c12",
    "c6",
    "c7",
    "c8",
    "c14",
    "c10",
    "c11",
  ]);
  assert.equal(cur.length, 17);
  // one card at 12 or beyond: just remove
  cur = deck.slice();
  removeCardsSwf(cur, ["c5", "c1", "c12"]);
  assert.deepEqual(cur.slice(0, 6), ["c0", "c2", "c3", "c4", "c6", "c7"]);
  // fewer than 15 cards: just remove
  cur = deck.slice(0, 14);
  removeCardsSwf(cur, ["c0", "c1", "c2"]);
  assert.deepEqual(cur, deck.slice(3, 14));
});

test(`replay matches the original site's computeState after every event (${GAMES} simulated games)`, () => {
  let events = 0;
  let bigBoards = 0;
  for (let i = 0; i < GAMES; i++) {
    const game = simulate(i + 1, (deck, evs, theirs) => {
      const mine = replayGame(row(i, deck), evs);
      assert.deepEqual(
        [mine.remaining, mine.boardSize],
        [theirs.current, theirs.boardSize],
        `game ${i}, after ${evs.length} events`,
      );
      assert.deepEqual(
        mine.finds.map((f) => [f.time_ms, f.user_id, ...f.cards]),
        theirs.history.map((e) => [e.time, e.user, e.c1, e.c2, e.c3]),
      );
      if (mine.boardSize > 12) bigBoards++;
    });
    games.push(game);
    events += game.events.length;
  }
  // the simulation must reach the interesting cases
  assert.ok(events > GAMES * 25, `${events} events`);
  assert.ok(bigBoards > 100, `${bigBoards} states with more than 12 cards`);
});

test("the forks rule gets these games wrong", () => {
  assert.equal(games.length, GAMES);
  let differ = 0;
  for (const [i, { deck, events }] of games.entries()) {
    const swf = replayGame(row(i, deck), events);
    try {
      const forks = replayGame(row(i, deck, "forks"), events);
      if (
        JSON.stringify(forks.finds.map((f) => f.board)) !==
        JSON.stringify(swf.finds.map((f) => f.board))
      )
        differ++;
    } catch {
      differ++; // a valid event not on the forks board
    }
  }
  assert.ok(differ > GAMES / 2, `${differ} of ${GAMES} games differ`);
});
