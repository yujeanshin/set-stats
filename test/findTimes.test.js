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
