import assert from "node:assert/strict";
import { test } from "node:test";
import { rebuildDerived } from "../lib/derive.js";
import {
  breakSeqs,
  findTimes,
  gameDataFromRows,
  gameTiming,
} from "../lib/findTimes.js";
import { loadAll } from "../lib/load.js";
import {
  EVENTS,
  fixtureRaw,
  GAME,
  insertRaw,
  memoryDb,
  USER,
} from "./fixture.js";

const db = memoryDb();
insertRaw(db, fixtureRaw());
loadAll(db);
rebuildDerived(db);

const game = db
  .prepare("SELECT * FROM games WHERE game_id = ?")
  .get(GAME.game_id);
const events = db
  .prepare("SELECT * FROM events WHERE game_id = ? ORDER BY seq")
  .all(GAME.game_id);

test("normal mode: findTimes equals finds.elapsed_ms from the replay", () => {
  const fromTable = db
    .prepare("SELECT elapsed_ms FROM my_finds WHERE game_id = ? ORDER BY seq")
    .all(GAME.game_id)
    .map((r) => r.elapsed_ms);
  assert.equal(fromTable.length, 25);
  assert.deepEqual(findTimes(game, events, USER), fromTable);
});

test("gameDataFromRows rebuilds the site's gameData shape", () => {
  const data = gameDataFromRows(game, events);
  assert.equal(data.seed, GAME.seed);
  assert.equal(Object.keys(data.events).length, 25);
  const first = Object.values(data.events)[0];
  assert.deepEqual(first, {
    user: USER,
    time: EVENTS[0].time_ms,
    c1: EVENTS[0].c1,
    c2: EVENTS[0].c2,
    c3: EVENTS[0].c3,
  });
  assert.equal("c4" in first, false);
});

test("multiplayer: only my sets count, but anyone's set resets the clock", () => {
  // Give every other event to someone else.
  const mixed = events.map((e, i) => (i % 2 ? { ...e, user_id: "other" } : e));
  const all = findTimes(game, events, USER);
  const mine = findTimes(game, mixed, USER);
  assert.equal(mine.length, 13);
  assert.deepEqual(
    mine,
    all.filter((_, i) => i % 2 === 0),
  );
});

test("a game with no events has no find times", () => {
  assert.deepEqual(findTimes(game, [], USER), []);
});

test("original-site games use the original's computeState, including setjr", () => {
  const deck = [];
  for (let i = 0; i < 81; i++)
    deck.push([27, 9, 3, 1].map((d) => Math.floor(i / d) % 3).join(""));
  const swfGame = {
    source: "swf",
    mode: "setjr",
    started_at: 1000,
    deck: JSON.stringify(deck),
  };
  const ev = (seq, time, user, c1, c2, c3) => ({
    push_key: `-k${seq}`,
    time_ms: time,
    user_id: user,
    c1,
    c2,
    c3,
  });
  const swfEvents = [
    ev(0, 3000, "me", "0000", "0101", "0202"),
    ev(1, 4000, "other", "1000", "1101", "1202"),
    ev(2, 4500, "me", "0000", "1000", "2000"), // reuses taken cards: ignored
    ev(3, 7000, "me", "2000", "2101", "2202"),
  ];
  assert.deepEqual(findTimes(swfGame, swfEvents, "me"), [2000, 3000]);
  assert.equal(gameDataFromRows(swfGame, swfEvents).deck.length, 81);
  // the fork's code doesn't know this mode
  assert.throws(
    () => findTimes({ ...swfGame, source: "forks" }, swfEvents, "me"),
    /invalid gameMode: setjr/,
  );
});

// The fixture with a break: 400 s more before seq 21, so that gap is
// 440569 ms. The gaps' median stays 3671 ms, and 50x that is 183550 ms.
const BREAK_MS = 440569;
const withBreak = events.map((e) =>
  e.seq >= 21 ? { ...e, time_ms: e.time_ms + 400_000 } : e,
);

test("the fixture has no break: its longest gap is 11x the median", () => {
  const timing = gameTiming(game, events, USER, { dropBreaks: true });
  assert.equal(timing.breakMs, 0);
  assert.deepEqual(timing.findTimes, findTimes(game, events, USER));
});

test("dropBreaks leaves a gap over 50x the median out of find times", () => {
  const all = findTimes(game, withBreak, USER);
  assert.equal(all[21], BREAK_MS);
  const timing = gameTiming(game, withBreak, USER, { dropBreaks: true });
  assert.equal(timing.breakMs, BREAK_MS);
  assert.deepEqual(
    timing.findTimes,
    all.filter((t) => t !== BREAK_MS),
  );
  assert.deepEqual(gameTiming(game, withBreak, USER), {
    findTimes: all,
    findSeqs: events.map((e) => e.seq),
    breakMs: 0,
    badTiming: false,
  });
  // a break ended by someone else still counts as break time
  const mixed = withBreak.map((e) => ({ ...e, user_id: "other" }));
  assert.deepEqual(gameTiming(game, mixed, USER, { dropBreaks: true }), {
    findTimes: [],
    findSeqs: [],
    breakMs: BREAK_MS,
    badTiming: false,
  });
});

test("findSeqs match each find time to its finds row, with breaks dropped", () => {
  // The break is the gap ending at seq 21, so from there on the i-th find
  // time is not the i-th find.
  const timing = gameTiming(game, withBreak, USER, { dropBreaks: true });
  assert.equal(timing.findSeqs.length, 24);
  assert.equal(timing.findSeqs.includes(21), false);
  assert.equal(timing.findSeqs[21], 22);
  const elapsed = new Map(
    db
      .prepare("SELECT seq, elapsed_ms FROM my_finds WHERE game_id = ?")
      .all(GAME.game_id)
      .map((r) => [r.seq, r.elapsed_ms]),
  );
  // only the gap before seq 21 was changed, so the rest match the table
  timing.findSeqs.forEach((seq, i) =>
    assert.equal(elapsed.get(seq), timing.findTimes[i], `seq ${seq}`),
  );
  assert.deepEqual([...breakSeqs(game, withBreak)], [21]);
  assert.deepEqual([...breakSeqs(game, events)], []);
});

test("badTiming: any gap under 100 ms", () => {
  assert.equal(gameTiming(game, events, USER).badTiming, false);
  // the fourth set 50 ms after the third
  const burst = events.map((e) =>
    e.seq === 3 ? { ...e, time_ms: events[2].time_ms + 50 } : e,
  );
  assert.equal(gameTiming(game, burst, USER).badTiming, true);
});

test("findSeqs skip events the site ignored", () => {
  // Resubmit the third set 1 ms later: it reuses taken cards, so the site
  // ignores it, and every later find's seq is one past its index.
  const e = events[2];
  const withDup = [
    ...events.slice(0, 3),
    { ...e, push_key: `${e.push_key}x`, time_ms: e.time_ms + 1 },
    ...events.slice(3),
  ].map((ev, seq) => ({ ...ev, seq }));
  const { findTimes: times, findSeqs } = gameTiming(game, withDup, USER);
  assert.deepEqual(times, findTimes(game, events, USER));
  assert.deepEqual(findSeqs, [
    0,
    1,
    2,
    ...events.slice(3).map((ev) => ev.seq + 1),
  ]);
});
