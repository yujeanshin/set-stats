import assert from "node:assert/strict";
import { test } from "node:test";
import { DERIVE_VERSION, rebuildDerived } from "../lib/derive.js";
import { loadAll } from "../lib/load.js";
import { getMeta } from "../lib/schema.js";
import { EXPECTED, GAME, OPENING_BOARD, USER, count, fixtureRaw, insertRaw, memoryDb } from "./fixture.js";

function nonNormal() {
  const r = fixtureRaw();
  const game = JSON.parse(r.game_json);
  game.mode = "shuffle";
  return { ...r, id: "shuffle-game", game_json: JSON.stringify(game) };
}

function builtDb() {
  const db = memoryDb();
  insertRaw(db, fixtureRaw());
  insertRaw(db, nonNormal());
  loadAll(db);
  const totals = rebuildDerived(db);
  return { db, totals };
}

const { db, totals } = builtDb();
const finds = db.prepare("SELECT * FROM finds WHERE game_id = ? ORDER BY seq").all(GAME.game_id);
const setsAt = db.prepare("SELECT * FROM board_sets WHERE game_id = ? AND seq = ? ORDER BY set_id");

test("only normal-mode games are derived", () => {
  const boardSets = EXPECTED.reduce((n, e) => n + e.nSets, 0);
  assert.deepEqual(totals, { games: 1, finds: 25, boardSets });
  assert.equal(count(db, "finds WHERE game_id = 'shuffle-game'"), 0);
  assert.equal(count(db, "events WHERE game_id = 'shuffle-game'"), 25);
});

test("one finds row per valid event, matching the fixture", () => {
  assert.equal(finds.length, 25);
  for (const [i, exp] of EXPECTED.entries()) {
    const f = finds[i];
    assert.equal(f.seq, i);
    assert.equal(f.user_id, USER);
    assert.equal(f.board_size, exp.size, `seq ${i} board_size`);
    assert.equal(f.n_sets, exp.nSets, `seq ${i} n_sets`);
    const board = JSON.parse(f.board);
    assert.equal(board.length, f.board_size);
    assert.deepEqual(exp.pos.map((p) => board[p]), [exp.c1, exp.c2, exp.c3], `seq ${i} positions`);
  }
  assert.deepEqual(JSON.parse(finds[0].board), OPENING_BOARD);
});

test("elapsed_ms and deck_left", () => {
  assert.equal(finds[0].elapsed_ms, 2625);
  for (let i = 1; i < finds.length; i++) {
    assert.equal(finds[i].elapsed_ms, EXPECTED[i].time - EXPECTED[i - 1].time);
  }
  assert.deepEqual(finds.map((f) => f.deck_left), finds.map((f, i) => 81 - 3 * i - f.board_size));
});

test("board_sets lists every set on the board with positions of sorted cards", () => {
  for (const f of finds) {
    const board = JSON.parse(f.board);
    const rows = db
      .prepare("SELECT b.*, s.c1, s.c2, s.c3 FROM board_sets b JOIN sets s USING (set_id) WHERE game_id = ? AND seq = ?")
      .all(GAME.game_id, f.seq);
    assert.equal(rows.length, f.n_sets);
    for (const r of rows) {
      assert.deepEqual([board[r.p1], board[r.p2], board[r.p3]], [r.c1, r.c2, r.c3]);
    }
  }
});

test("is_chosen marks exactly the set taken in the event", () => {
  for (const [i, exp] of EXPECTED.entries()) {
    const chosen = setsAt.all(GAME.game_id, i).filter((r) => r.is_chosen);
    assert.equal(chosen.length, 1);
    assert.equal(chosen[0].set_id, [exp.c1, exp.c2, exp.c3].sort().join("-"));
  }
});

test("n_fresh is NULL on the first find and counts new cards after that", () => {
  assert.ok(setsAt.all(GAME.game_id, 0).every((r) => r.n_fresh === null));
  // 2200 and 0001 replaced cards taken in the first event; 1102 was already there
  const second = setsAt.all(GAME.game_id, 1).find((r) => r.set_id === "0001-1102-2200");
  assert.equal(second.n_fresh, 2);
  assert.equal(second.is_chosen, 1);
  assert.equal(count(db, "board_sets WHERE seq > 0 AND n_fresh IS NULL"), 0);
});

test("derive_version is written and my_finds filters by my user", () => {
  assert.equal(getMeta(db, "derive_version"), String(DERIVE_VERSION));
  assert.equal(count(db, "my_finds"), 25);
  db.prepare("UPDATE meta SET value = 'someone-else' WHERE key = 'my_user_id'").run();
  assert.equal(count(db, "my_finds"), 0);
  db.prepare("UPDATE meta SET value = ? WHERE key = 'my_user_id'").run(USER);
});

test("rebuilding again gives the same rows", () => {
  const before = db.prepare("SELECT * FROM board_sets ORDER BY game_id, seq, set_id").all();
  rebuildDerived(db);
  assert.equal(count(db, "finds"), 25);
  assert.deepEqual(db.prepare("SELECT * FROM board_sets ORDER BY game_id, seq, set_id").all(), before);
});

test("a replay mismatch fails the rebuild and leaves derive_version unset", () => {
  const { db } = builtDb();
  db.prepare("UPDATE events SET c3 = '2222' WHERE game_id = ? AND seq = 3").run(GAME.game_id);
  assert.throws(() => rebuildDerived(db), /abandoned-tired-property/);
  assert.equal(getMeta(db, "derive_version"), null);
});
