import Database from "better-sqlite3";
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { DB_FILE } from "../lib/paths.js";
import { replayGame } from "../lib/replay.js";
import { computeState } from "../vendor/game.js";

const hasData = fs.existsSync(DB_FILE);

test("replay matches the site's computeState on every local normal game", { skip: !hasData && "no data/games.db" }, () => {
  const db = new Database(DB_FILE, { readonly: true });
  const games = db
    .prepare("SELECT g.*, r.data_json FROM games g JOIN sync_raw r ON r.id = g.game_id WHERE g.mode = 'normal'")
    .all();
  const eventsOf = db.prepare("SELECT * FROM events WHERE game_id = ? ORDER BY seq");
  for (const g of games) {
    const mine = replayGame(g, eventsOf.all(g.game_id));
    const theirs = computeState(JSON.parse(g.data_json), "normal");
    assert.deepEqual(
      [mine.finds.map((f) => [f.time_ms, f.user_id, ...f.cards]), mine.remaining, mine.boardSize],
      [theirs.history.map((e) => [e.time, e.user, e.c1, e.c2, e.c3]), theirs.current, theirs.boardSize],
      g.game_id
    );
  }
  db.close();
});
