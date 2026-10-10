import assert from "node:assert/strict";
import { test } from "node:test";
import { DERIVE_VERSION, rebuildDerived, saveSetTypes } from "../lib/derive.js";
import { loadAll } from "../lib/load.js";
import { Queries } from "../lib/queries.js";
import { setMeta } from "../lib/schema.js";
import { typeTables } from "../lib/setTypes.js";
import { generateDeck, makeRandom } from "../vendor/game.js";
import { GAME, USER, fixtureRaw, insertRaw, memoryDb } from "./fixture.js";

test("each game's find times use my user id on that game's site", () => {
  const db = memoryDb();
  setMeta(db, "my_user_id:swf", "me-swf");
  const raw = fixtureRaw();
  insertRaw(db, raw);
  // the same game on the original site: explicit deck, my other user id
  const data = JSON.parse(raw.data_json.replaceAll(USER, "me-swf"));
  insertRaw(db, {
    ...raw,
    id: "swf:copy",
    source: "swf",
    data_json: JSON.stringify({
      deck: generateDeck("normal", makeRandom(data.seed)),
      events: data.events,
    }),
  });
  loadAll(db);

  const queries = new Queries(db);
  assert.deepEqual(queries.myUserIds, { forks: USER, swf: "me-swf" });
  const games = queries.soloGames("normal");
  assert.deepEqual(
    games.map((g) => [g.game_id, g.source, g.findTimes.length]),
    [
      [GAME.game_id, "forks", 25],
      ["swf:copy", "swf", 25],
    ],
  );
  assert.deepEqual(games[1].findTimes, games[0].findTimes);
  assert.equal("deck" in games[1], false);
});

// A hand-built solo game for the set-type totals. Each find lists its board's
// sets as [diff_mask, n_fresh], the chosen one first; elapsed_ms in ms.
//   find 0 (first, no n_fresh): 1000 chosen, 0110          n_sets 2, 1000 ms
//   find 1: 0110 chosen (1 fresh), 0110 (0), 1111 (3)      n_sets 3, 2000 ms
//   find 2: 1111 chosen (2 fresh)                          n_sets 1, 4000 ms
//   find 3: someone else's, 0001 chosen: not one of my finds
const TYPE_FINDS = [
  {
    user: USER,
    ms: 1000,
    sets: [
      ["1000", null],
      ["0110", null],
    ],
  },
  {
    user: USER,
    ms: 2000,
    sets: [
      ["0110", 1],
      ["0110", 0],
      ["1111", 3],
    ],
  },
  { user: USER, ms: 4000, sets: [["1111", 2]] },
  { user: "someone-else", ms: 500, sets: [["0001", null]] },
];

function typeFixture() {
  const db = memoryDb();
  db.prepare(
    `INSERT INTO games (game_id, mode, status, enable_hint, created_at,
       started_at, n_players, source)
     VALUES ('typed', 'normal', 'done', 0, 1, 1, 1, 'forks')`,
  ).run();
  const setsOf = db.prepare(
    "SELECT set_id FROM sets WHERE diff_mask = ? ORDER BY set_id",
  );
  const used = new Map(); // mask -> how many sets of it are taken so far
  const nextSet = (mask) => {
    const i = used.get(mask) ?? 0;
    used.set(mask, i + 1);
    return setsOf.pluck().all(mask)[i];
  };
  for (const [seq, f] of TYPE_FINDS.entries()) {
    db.prepare(
      `INSERT INTO events (game_id, seq, push_key, time_ms, user_id, c1, c2, c3)
       VALUES ('typed', ?, ?, ?, ?, 'x', 'y', 'z')`,
    ).run(seq, `k${seq}`, seq, f.user);
    db.prepare(
      `INSERT INTO finds (game_id, seq, user_id, elapsed_ms, board,
         board_size, n_sets, deck_left)
       VALUES ('typed', ?, ?, ?, '[]', 12, ?, 0)`,
    ).run(seq, f.user, f.ms, f.sets.length);
    for (const [i, [mask, fresh]] of f.sets.entries())
      db.prepare(
        `INSERT INTO board_sets (game_id, seq, set_id, p1, p2, p3,
           is_chosen, n_fresh)
         VALUES ('typed', ?, ?, 0, 1, 2, ?, ?)`,
      ).run(seq, nextSet(mask), i === 0 ? 1 : 0, fresh);
  }
  saveSetTypes(db, "typed");
  setMeta(db, "derive_version", DERIVE_VERSION);
  return db;
}

const totalOf = (totals, kind, key) =>
  totals.find((t) => t.kind === kind && t.type_key === key);

test("set types: nothing until the saved tables are current", () => {
  const db = typeFixture();
  setMeta(db, "derive_version", null);
  assert.equal(new Queries(db).setTypes(["typed"]), null);
});

test("set types: O, E and present on a hand-built game", () => {
  const { totals, chosen } = new Queries(typeFixture()).setTypes(["typed"]);
  const near = (a, b) => assert.equal(a.toFixed(9), b.toFixed(9));
  // [kind, key, O, E, present]
  const expected = [
    ["mask", "1000", 1, 1 / 2, 1],
    ["mask", "0110", 1, 1 / 2 + 2 / 3, 2], // two 0110 sets on find 1's board
    ["mask", "1111", 1, 1 / 3 + 1, 2],
    ["ndiff", "1", 1, 1 / 2, 1],
    ["ndiff", "2", 1, 1 / 2 + 2 / 3, 2],
    ["ndiff", "4", 1, 1 / 3 + 1, 2],
    // finds 1 and 2 only: find 0 has no previous find
    ["fresh", "0", 0, 1 / 3, 1],
    ["fresh", "1", 1, 1 / 3, 1],
    ["fresh", "2", 1, 1, 1],
    ["fresh", "3", 0, 1 / 3, 1],
  ];
  assert.equal(totals.length, expected.length);
  for (const [kind, key, o, e, present] of expected) {
    const t = totalOf(totals, kind, key);
    assert.equal(t.picks, o, `${kind} ${key} picks`);
    near(t.expected, e);
    assert.equal(t.present, present, `${kind} ${key} present`);
  }
  // Someone else's find (0001) is not counted anywhere.
  assert.equal(totalOf(totals, "mask", "0001"), undefined);
  assert.deepEqual(
    chosen
      .toSorted((a, b) => a.seq - b.seq)
      .map((c) => [c.seq, c.diff_mask, c.n_diff, c.n_fresh, c.elapsed_ms]),
    [
      [0, "1000", 1, null, 1000],
      [1, "0110", 2, 1, 2000],
      [2, "1111", 4, 2, 4000],
    ],
  );

  // Ratio and take rate from those totals; 0001 was never on my boards.
  const t = typeTables(totals);
  const row = (key) => t.patterns.find((r) => r.key === key);
  assert.equal(row("1000").ratio, 2);
  near(row("0110").ratio, 6 / 7);
  near(row("1111").ratio, 3 / 4);
  assert.equal(row("1000").takeRate, 1);
  assert.equal(row("0110").takeRate, 0.5);
  assert.equal(row("0001").expected, 0);
  assert.equal(row("0001").ratio, null);
  assert.equal(row("0001").takeRate, null);
});

test("set types: over a full partition, total E = total O = finds", () => {
  const db = memoryDb();
  insertRaw(db, fixtureRaw());
  loadAll(db);
  rebuildDerived(db);
  const { totals, chosen } = new Queries(db).setTypes([GAME.game_id]);
  const sum = (kind, col) =>
    totals.filter((t) => t.kind === kind).reduce((a, t) => a + t[col], 0);
  assert.equal(chosen.length, 25);
  for (const kind of ["mask", "ndiff"]) {
    assert.equal(sum(kind, "picks"), 25);
    assert.equal(sum(kind, "expected").toFixed(9), "25.000000000");
  }
  // n_fresh leaves out the first find.
  assert.equal(sum("fresh", "picks"), 24);
  assert.equal(sum("fresh", "expected").toFixed(9), "24.000000000");
});
