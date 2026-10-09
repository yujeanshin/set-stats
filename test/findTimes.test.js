import assert from "node:assert/strict";
import { test } from "node:test";
import { rebuildDerived } from "../lib/derive.js";
import { findTimes, gameDataFromRows } from "../lib/findTimes.js";
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
