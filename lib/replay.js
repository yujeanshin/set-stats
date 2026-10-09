// Normal-mode replay, ported from src/game.js in eltoder/setwithfriends (see
// vendor/game.js) and, for games from the original site, src/util.js in
// ekzhang/setwithfriends (see vendor/setwithfriends/util.js).
import { generateDeck, makeRandom } from "../vendor/game.js";
import { hasSet, isSet } from "./cards.js";

const MIN_BOARD_SIZE = 12;

export function findBoardSize(current, minSize) {
  let len = Math.min(current.length, minSize);
  while (len < current.length && !hasSet(current.slice(0, len))) {
    len += 3 - (len % 3);
  }
  return len;
}

/** Remove taken cards, refilling their positions from the deck when possible. */
export function removeCards(current, cards, boardSize) {
  if (cards.length === boardSize) {
    current.splice(0, boardSize);
    return;
  }
  const cutoff = Math.min(current.length - cards.length, MIN_BOARD_SIZE);
  const idx = cards.map((c) => current.indexOf(c)).sort((a, b) => b - a);
  for (const [i, ci] of idx.entries()) {
    if (ci >= cutoff) {
      current.splice(ci, 1);
    } else {
      const n = idx.length - i;
      for (const [j, card] of current.splice(cutoff, n).entries()) {
        current[idx[idx.length - 1 - j]] = card;
      }
      break;
    }
  }
}

/**
 * The original site's rule (removeCards in ekzhang/setwithfriends src/util.js):
 * if every taken card is in the first 12 positions and at least 12 cards
 * would remain, the cards at positions 12, 13, ... fill the holes, in the
 * order the taken cards were clicked. Otherwise the taken cards are removed
 * and everything after them shifts down.
 */
export function removeCardsSwf(current, cards) {
  const canPreserve =
    current.length >= MIN_BOARD_SIZE + cards.length &&
    cards.every((c) => current.indexOf(c) < MIN_BOARD_SIZE);
  if (canPreserve) {
    const fill = current.splice(MIN_BOARD_SIZE, cards.length);
    for (const [i, c] of cards.entries()) current[current.indexOf(c)] = fill[i];
  } else {
    for (const c of cards) current.splice(current.indexOf(c), 1);
  }
}

/** The starting deck: the stored deck if there is one, else shuffled from the seed. */
function startingDeck({ deck, seed }, fail) {
  if (deck) {
    const cards = JSON.parse(deck);
    if (cards.length !== 81 || new Set(cards).size !== 81)
      fail(`deck has ${cards.length} cards, ${new Set(cards).size} distinct`);
    return cards.slice();
  }
  if (!seed) fail("missing seed");
  return generateDeck("normal", makeRandom(seed));
}

/**
 * Replay a normal-mode game. `events` must be in seq order. `game` is a
 * games row: the deck comes from `deck` or `seed`, and `source` picks the
 * site's rule for refilling the board.
 * Returns one entry per valid event, plus the remaining cards at the end.
 * Throws if an accepted event doesn't match the replayed board.
 */
export function replayGame(game, events) {
  const { game_id, started_at, source = "forks" } = game;
  const fail = (msg) => {
    throw new Error(`replay ${game_id}: ${msg}`);
  };
  const current = startingDeck(game, fail);
  const used = new Set();
  let boardSize = findBoardSize(current, MIN_BOARD_SIZE);
  let prevTime = started_at;
  const finds = [];

  for (const e of events) {
    if (e.c4 != null || e.c5 != null || e.c6 != null)
      fail(`seq ${e.seq} has more than 3 cards`);
    const cards = [e.c1, e.c2, e.c3];
    if (new Set(cards).size !== cards.length || cards.some((c) => used.has(c)))
      continue;

    const board = current.slice(0, boardSize);
    const positions = cards.map((c) => board.indexOf(c));
    if (positions.includes(-1))
      fail(`seq ${e.seq} cards ${cards} not all on board ${board}`);
    if (!isSet(...cards)) fail(`seq ${e.seq} cards ${cards} are not a set`);
    if (prevTime == null) fail("missing started_at");

    finds.push({
      seq: e.seq,
      user_id: e.user_id,
      time_ms: e.time_ms,
      elapsed_ms: e.time_ms - prevTime,
      cards,
      positions,
      board,
      board_size: boardSize,
      deck_left: current.length - boardSize,
    });
    prevTime = e.time_ms;

    if (source === "swf") removeCardsSwf(current, cards);
    else removeCards(current, cards, boardSize);
    for (const c of cards) used.add(c);
    boardSize = findBoardSize(
      current,
      Math.max(boardSize - cards.length, MIN_BOARD_SIZE),
    );
  }

  return { finds, remaining: current, boardSize };
}
