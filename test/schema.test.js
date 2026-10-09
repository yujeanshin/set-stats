import Database from "better-sqlite3";
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAll, parseRaw } from "../lib/load.js";
import { ensureLookups } from "../lib/lookups.js";
import { SCHEMA_VERSION, getMeta, migrate } from "../lib/schema.js";
import { GAME, USER, count, fixtureRaw, insertRaw } from "./fixture.js";

// The tables of schema v1 that this migration touches, as v1 created them.
const V1 = `
  CREATE TABLE sync_raw (
    id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, status TEXT,
    game_json TEXT, data_json TEXT
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT) STRICT;
  CREATE TABLE games (
    game_id TEXT PRIMARY KEY, mode TEXT NOT NULL, status TEXT NOT NULL,
    access TEXT, enable_hint INTEGER NOT NULL, host_id TEXT,
    created_at INTEGER NOT NULL, started_at INTEGER, ended_at INTEGER,
    pause_time_ms INTEGER, n_players INTEGER NOT NULL, seed TEXT
  ) STRICT;
  CREATE TABLE finds (
    game_id TEXT NOT NULL, seq INTEGER NOT NULL, user_id TEXT NOT NULL,
    elapsed_ms INTEGER NOT NULL, board TEXT NOT NULL, board_size INTEGER NOT NULL,
    n_sets INTEGER NOT NULL, deck_left INTEGER NOT NULL,
    PRIMARY KEY (game_id, seq)
  ) STRICT;
  CREATE VIEW my_finds AS
    SELECT * FROM finds
    WHERE user_id = (SELECT value FROM meta WHERE key = 'my_user_id');
  INSERT INTO meta VALUES ('schema_version', '1'), ('my_user_id', '${USER}');
`;

function v1Db() {
  const db = new Database(":memory:");
  db.exec(V1);
  const raw = fixtureRaw();
  db.prepare(
    `INSERT INTO sync_raw (id, created_at, status, game_json, data_json)
     VALUES (@id, @created_at, @status, @game_json, @data_json)`,
  ).run(raw);
  db.prepare(
    `INSERT INTO games VALUES (?, 'normal', 'done', 'private', 0, ?, 1, 2, 3, NULL, 1, ?)`,
  ).run(GAME.game_id, USER, GAME.seed);
  db.prepare(`INSERT INTO finds VALUES (?, 0, ?, 2625, '[]', 12, 3, 69)`).run(
    GAME.game_id,
    USER,
  );
  return db;
}

const columns = (db, table) =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name);

test("a v1 database migrates in place, old rows default to forks", () => {
  const db = v1Db();
  migrate(db);
  assert.equal(getMeta(db, "schema_version"), String(SCHEMA_VERSION));
  assert.deepEqual(columns(db, "sync_raw").slice(-1), ["source"]);
  assert.deepEqual(columns(db, "games").slice(-2), ["source", "deck"]);
  assert.deepEqual(db.prepare("SELECT id, source FROM sync_raw").all(), [
    { id: GAME.game_id, source: "forks" },
  ]);
  assert.deepEqual(
    db.prepare("SELECT game_id, seed, source, deck FROM games").all(),
    [{ game_id: GAME.game_id, seed: GAME.seed, source: "forks", deck: null }],
  );
  assert.deepEqual(columns(db, "sync_skipped"), [
    "id",
    "source",
    "reason",
    "skipped_at",
  ]);
  // the old my_user_id still selects my forks finds
  assert.equal(getMeta(db, "my_user_id"), USER);
  assert.equal(count(db, "my_finds"), 1);
});

test("a migrated database has the same columns as a new one", () => {
  const migrated = v1Db();
  migrate(migrated);
  const fresh = new Database(":memory:");
  migrate(fresh);
  for (const table of ["sync_raw", "games", "finds"])
    assert.deepEqual(columns(migrated, table), columns(fresh, table), table);
});

test("migrating twice is harmless", () => {
  const db = v1Db();
  migrate(db);
  migrate(db);
  assert.equal(count(db, "games"), 1);
  assert.equal(count(db, "my_finds"), 1);
});

test("my_finds uses each site's own user id", () => {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migrate(db, { myUserIds: { forks: "me-forks", swf: "me-swf" } });
  ensureLookups(db);
  assert.equal(getMeta(db, "my_user_id"), "me-forks");
  assert.equal(getMeta(db, "my_user_id:swf"), "me-swf");

  // the fixture game three times: on forks by my forks user, and on the
  // original site once by my original-site user and once by my forks user id
  const raw = fixtureRaw();
  const as = (id, source, user) => ({
    ...raw,
    id,
    source,
    data_json: raw.data_json.replaceAll(USER, user),
  });
  insertRaw(db, as("forks-game", "forks", "me-forks"));
  insertRaw(db, as("swf:mine", "swf", "me-swf"));
  insertRaw(db, as("swf:theirs", "swf", "me-forks"));
  loadAll(db);
  // only user ids matter here, so fill finds straight from events
  db.exec(`INSERT INTO finds SELECT game_id, seq, user_id, 0, '[]', 12, 0, 0
           FROM events`);
  assert.equal(count(db, "my_finds WHERE game_id = 'forks-game'"), 25);
  assert.equal(count(db, "my_finds WHERE game_id = 'swf:mine'"), 25);
  assert.equal(count(db, "my_finds WHERE game_id = 'swf:theirs'"), 0);
});

test("my_finds joined to filtered games doesn't scan finds by user", () => {
  // With finds_user driving the join, the web UI's position heatmap query
  // read every one of my finds once per game and took over 30 s.
  const db = new Database(":memory:");
  migrate(db, { myUserId: "me" });
  const plan = db
    .prepare(
      `EXPLAIN QUERY PLAN SELECT COUNT(*) FROM my_finds JOIN games g
       USING (game_id) WHERE g.n_players = 1 AND g.mode = 'normal'`,
    )
    .all()
    .map((r) => r.detail)
    .join("\n");
  assert.doesNotMatch(plan, /finds_user/);
});

test("parseRaw keeps the source and stores an explicit deck", () => {
  const { events } = JSON.parse(fixtureRaw().data_json);
  const cards = ["2222", "0000", "1111"];
  const { game } = parseRaw({
    id: "swf:some-game",
    created_at: 5,
    source: "swf",
    game_json: JSON.stringify({ status: "done", createdAt: 5, users: {} }),
    data_json: JSON.stringify({ deck: cards, events }),
  });
  assert.equal(game.game_id, "swf:some-game");
  assert.equal(game.source, "swf");
  assert.equal(game.seed, null);
  assert.deepEqual(JSON.parse(game.deck), cards);

  const fork = parseRaw(fixtureRaw()).game;
  assert.equal(fork.source, "forks");
  assert.equal(fork.deck, null);
});
