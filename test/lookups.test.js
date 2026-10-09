import assert from "node:assert/strict";
import { test } from "node:test";
import { diffMask, isSet, setId, thirdCard } from "../lib/cards.js";
import { ensureLookups } from "../lib/lookups.js";
import { count, memoryDb } from "./fixture.js";

const db = memoryDb();

test("cards has 81 rows", () => {
  assert.equal(count(db, "cards"), 81);
  assert.deepEqual(db.prepare("SELECT MIN(card) lo, MAX(card) hi FROM cards").get(), { lo: "0000", hi: "2222" });
});

test("card attributes are read from digits 1-4", () => {
  assert.deepEqual(
    db.prepare("SELECT color, shape, shade, number FROM cards WHERE card = '2102'").get(),
    { color: 2, shape: 1, shade: 0, number: 2 }
  );
});

test("sets has 1080 rows", () => {
  assert.equal(count(db, "sets"), 1080);
});

test("n_diff counts are 108, 324, 432, 216 for 1-4", () => {
  const rows = db.prepare("SELECT n_diff, COUNT(*) AS n FROM sets GROUP BY n_diff ORDER BY n_diff").all();
  assert.deepEqual(rows, [
    { n_diff: 1, n: 108 },
    { n_diff: 2, n: 324 },
    { n_diff: 3, n: 432 },
    { n_diff: 4, n: 216 },
  ]);
});

test("every stored set is a valid set with sorted cards", () => {
  for (const s of db.prepare("SELECT * FROM sets").all()) {
    assert.ok(isSet(s.c1, s.c2, s.c3), s.set_id);
    assert.equal(s.set_id, setId([s.c3, s.c1, s.c2]));
    assert.equal(s.diff_mask, diffMask(s.c1, s.c2, s.c3));
  }
  assert.equal(count(db, "(SELECT card FROM cards WHERE (SELECT COUNT(*) FROM sets WHERE card IN (c1, c2, c3)) = 40)"), 81);
});

test("example set from the spec", () => {
  assert.equal(setId(["0201", "0012", "0120"]), "0012-0120-0201");
  assert.equal(thirdCard("0012", "0120"), "0201");
  assert.equal(diffMask("0012", "0120", "0201"), "0111");
});

test("ensureLookups is safe to run again", () => {
  ensureLookups(db);
  db.prepare("DELETE FROM sets WHERE set_id = '0012-0120-0201'").run();
  ensureLookups(db);
  assert.equal(count(db, "cards"), 81);
  assert.equal(count(db, "sets"), 1080);
});
