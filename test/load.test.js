import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveGame } from "../lib/derive.js";
import { loadAll, parseRaw } from "../lib/load.js";
import { GAME, USER, count, fixtureRaw, insertRaw, memoryDb } from "./fixture.js";

function raw(id, game, data) {
  return {
    id,
    created_at: game.createdAt,
    status: game.status,
    game_json: JSON.stringify(game),
    data_json: JSON.stringify(data),
  };
}

const ultraset = raw(
  "ultra-game",
  { createdAt: 100, mode: "ultraset", status: "done", startedAt: 110, endedAt: 900, pauseTime: 5000,
    host: USER, access: "public", enableHint: true, users: { [USER]: 100, other: 101 } },
  { seed: "v1:00000000000000000000000000000001",
    events: {
      // listed out of order on purpose; the tie at time 500 is broken by push key
      "-b": { c1: "0000", c2: "0001", c3: "0002", c4: "0010", time: 500, user: "other" },
      "-a": { c1: "1000", c2: "1001", c3: "1002", c4: "1010", time: 500, user: USER },
      "-0": { c1: "2000", c2: "2001", c3: "2002", c4: "2010", time: 300, user: USER },
    } }
);

const waiting = raw(
  "waiting-game",
  { createdAt: 200, mode: "normal", status: "waiting", host: USER, access: "private", enableHint: false, users: { [USER]: 200 } },
  { seed: "v1:00000000000000000000000000000002" }
);

function loadedDb() {
  const db = memoryDb();
  for (const r of [fixtureRaw(), ultraset, waiting]) insertRaw(db, r);
  return db;
}

test("loads every mode and maps game fields", () => {
  const db = loadedDb();
  loadAll(db);
  assert.equal(count(db, "games"), 3);
  assert.deepEqual(db.prepare("SELECT * FROM games WHERE game_id = 'ultra-game'").get(), {
    game_id: "ultra-game", mode: "ultraset", status: "done", access: "public", enable_hint: 1,
    host_id: USER, created_at: 100, started_at: 110, ended_at: 900, pause_time_ms: 5000,
    n_players: 2, seed: "v1:00000000000000000000000000000001",
  });
  assert.deepEqual(db.prepare("SELECT started_at, ended_at, pause_time_ms FROM games WHERE game_id = 'waiting-game'").get(),
    { started_at: null, ended_at: null, pause_time_ms: null });
  assert.equal(count(db, "events WHERE game_id = 'waiting-game'"), 0);
  assert.equal(count(db, "events WHERE game_id = ?", GAME.game_id), 25);
});

test("events are numbered by time, ties broken by push key, cards kept in click order", () => {
  const db = loadedDb();
  loadAll(db);
  const rows = db.prepare("SELECT seq, push_key, c1, c4 FROM events WHERE game_id = 'ultra-game' ORDER BY seq").all();
  assert.deepEqual(rows, [
    { seq: 0, push_key: "-0", c1: "2000", c4: "2010" },
    { seq: 1, push_key: "-a", c1: "1000", c4: "1010" },
    { seq: 2, push_key: "-b", c1: "0000", c4: "0010" },
  ]);
  const first = db.prepare("SELECT c1, c2, c3, c5, c6 FROM events WHERE game_id = ? AND seq = 0").get(GAME.game_id);
  assert.deepEqual(first, { c1: "0110", c2: "0112", c3: "0111", c5: null, c6: null });
});

test("times are stored as integers", () => {
  const db = loadedDb();
  loadAll(db);
  assert.equal(count(db, "games WHERE typeof(created_at) <> 'integer'"), 0);
  assert.equal(count(db, "events WHERE typeof(time_ms) <> 'integer'"), 0);
  const bad = raw("bad", { createdAt: 1.5, mode: "normal", status: "done", users: {} }, {});
  assert.throws(() => parseRaw(bad), /bad createdAt: expected integer/);
});

test("loading twice adds no duplicate rows", () => {
  const db = loadedDb();
  const first = loadAll(db);
  const snapshot = db.prepare("SELECT * FROM events ORDER BY game_id, seq").all();
  const second = loadAll(db);
  assert.equal(first.gamesWithNewEvents, 2);
  assert.equal(second.gamesWithNewEvents, 0);
  assert.equal(count(db, "games"), 3);
  assert.deepEqual(db.prepare("SELECT * FROM events ORDER BY game_id, seq").all(), snapshot);
});

test("reloading keeps derived rows for unchanged games", () => {
  const db = loadedDb();
  loadAll(db);
  deriveGame(db, db.prepare("SELECT * FROM games WHERE game_id = ?").get(GAME.game_id));
  loadAll(db);
  assert.equal(count(db, "finds"), 25);
});

test("a re-synced game gets its new events, and its stale derived rows are removed", () => {
  const db = loadedDb();
  loadAll(db);
  deriveGame(db, db.prepare("SELECT * FROM games WHERE game_id = ?").get(GAME.game_id));
  assert.equal(count(db, "finds"), 25);

  const updated = fixtureRaw();
  const data = JSON.parse(updated.data_json);
  data.events["-P-Fzzzz"] = { c1: "1221", c2: "1101", c3: "0020", time: 1786983999999, user: USER };
  updated.data_json = JSON.stringify(data);
  insertRaw(db, updated);

  const stats = loadAll(db);
  assert.equal(stats.gamesWithNewEvents, 1);
  assert.equal(count(db, "events WHERE game_id = ?", GAME.game_id), 26);
  assert.equal(db.prepare("SELECT push_key FROM events WHERE game_id = ? AND seq = 25").get(GAME.game_id).push_key, "-P-Fzzzz");
  assert.equal(count(db, "finds"), 0);
  assert.equal(count(db, "board_sets"), 0);
});
