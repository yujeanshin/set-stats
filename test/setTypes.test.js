import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MASKS,
  MIN_EXPECTED,
  TREND_MIN_GAMES,
  blindSpots,
  gammaP,
  nDiffOf,
  poissonInterval,
  trendBuckets,
  typeRow,
  typeTables,
  typeTrend,
} from "../lib/setTypes.js";

const near = (actual, expected, digits = 4) =>
  assert.equal(actual.toFixed(digits), expected.toFixed(digits));

test("the 15 patterns are grouped by n_diff, in card feature order", () => {
  assert.equal(MASKS.length, 15);
  assert.deepEqual(
    MASKS.map(nDiffOf),
    [1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4],
  );
  assert.deepEqual(MASKS.slice(0, 4), ["1000", "0100", "0010", "0001"]);
  assert.equal(new Set(MASKS).size, 15);
  assert.equal(MASKS.includes("0000"), false);
});

test("gammaP matches known values", () => {
  near(gammaP(1, 1), 1 - Math.exp(-1), 10); // exponential CDF
  near(gammaP(3, 2), 1 - Math.exp(-2) * (1 + 2 + 2), 10); // Erlang
  near(gammaP(0.5, 0.5), 0.6826894921, 8); // erf(sqrt(0.5))
  near(gammaP(50, 60), 0.9156, 4);
});

test("exact Poisson interval matches the Garwood values from scipy", () => {
  // scipy.stats.chi2.ppf(0.025, 2k) / 2 and chi2.ppf(0.975, 2k + 2) / 2
  const cases = [
    [0, 0, 3.688879],
    [1, 0.025318, 5.571643],
    [10, 4.795389, 18.390356],
    [100, 81.363991, 121.626794],
  ];
  for (const [o, lo, hi] of cases) {
    const [l, h] = poissonInterval(o);
    near(l, lo);
    near(h, hi);
  }
  // Large counts, as for a whole n_diff group: close to o ± 1.96 sqrt(o).
  const [l, h] = poissonInterval(100_000);
  assert.ok(Math.abs(l - (100_000 - 1.96 * Math.sqrt(100_000))) < 2);
  assert.ok(Math.abs(h - (100_000 + 1.96 * Math.sqrt(100_000))) < 2);
});

test("typeRow: ratio, interval and median", () => {
  // 10 picks where chance would give 8.
  const r = typeRow({ picks: 10, expected: 8, times: [3000, 1000, 2000] });
  assert.equal(r.ratio, 1.25);
  near(r.low, 4.795389 / 8);
  near(r.high, 18.390356 / 8);
  assert.equal(r.medianMs, 2000);
  assert.equal(r.medianN, 3);
  assert.equal(r.lowData, true); // E = 8 < MIN_EXPECTED
  assert.equal(typeRow({ picks: 30, expected: MIN_EXPECTED }).lowData, false);
});

test("typeRow: a type never on the board has no ratio", () => {
  const r = typeRow({ picks: 0, expected: 0 });
  assert.equal(r.ratio, null);
  assert.equal(r.low, null);
  assert.equal(r.high, null);
  assert.equal(r.medianMs, null);
  assert.equal(r.medianN, 0);
  assert.equal(r.lowData, true);
});

test("blind spots: E >= 30 and upper bound below 1, lowest ratio first, at most 3", () => {
  const row = (key, picks, expected) => ({
    key,
    ...typeRow({ picks, expected }),
  });
  const rows = [
    row("a", 60, 100), // 0.6, high < 1
    row("b", 40, 100), // 0.4
    row("c", 50, 100), // 0.5
    row("d", 70, 100), // 0.7
    row("e", 1, 20), // 0.05 but E < 30: too noisy
    row("f", 95, 100), // 0.95, interval reaches past 1
  ];
  assert.ok(rows.find((r) => r.key === "f").high > 1);
  assert.deepEqual(blindSpots(rows), ["b", "c", "a"]);
  assert.deepEqual(blindSpots([row("f", 95, 100), row("e", 1, 20)]), []);
});

test("typeTables fills every type, including ones missing from the totals", () => {
  const totals = [
    { kind: "ndiff", type_key: "2", picks: 3, expected: 1.5 },
    { kind: "mask", type_key: "0110", picks: 3, expected: 1.5 },
    { kind: "fresh", type_key: "1", picks: 2, expected: 1 },
  ];
  const t = typeTables(totals, { mask: { "0110": [1000, 3000] } });
  assert.deepEqual(
    t.nDiff.map((r) => [r.key, r.picks, r.ratio]),
    [
      [1, 0, null],
      [2, 3, 2],
      [3, 0, null],
      [4, 0, null],
    ],
  );
  assert.equal(t.patterns.length, 15);
  const p = t.patterns.find((r) => r.key === "0110");
  assert.equal(p.nDiff, 2);
  assert.equal(p.medianMs, 2000);
  assert.deepEqual(
    t.fresh.map((r) => [r.key, r.picks]),
    [
      [0, 0],
      [1, 2],
      [2, 0],
      [3, 0],
    ],
  );
  assert.deepEqual(t.blindSpots, []);
});

test("trendBuckets: 200 games a bucket until 30 buckets would need more", () => {
  const sizes = [400, 650, 6000, 6001, 22_000].map((n) => trendBuckets(n).size);
  assert.deepEqual(sizes, [200, 200, 200, 201, 734]);
  // ceil(22000 / 30) = 734: 29 full buckets, 714 games left over.
  const big = trendBuckets(22_000);
  assert.equal(big.buckets.length, 29);
  assert.equal(big.dropped, 22_000 - 29 * 734);
  assert.equal(trendBuckets(6000).buckets.length, 30);
});

test("trendBuckets: anchored at the newest game, the oldest remainder dropped", () => {
  const { size, dropped, buckets } = trendBuckets(650);
  assert.equal(size, 200);
  assert.equal(dropped, 50); // the 50 oldest games
  assert.deepEqual(buckets, [
    [50, 250],
    [250, 450],
    [450, 650], // the latest bucket ends at the newest game, and is full
  ]);
  for (const [start, end] of buckets) assert.equal(end - start, size);
  assert.deepEqual(trendBuckets(400).buckets, [
    [0, 200],
    [200, 400],
  ]);
});

test("trendBuckets: fewer than 2 buckets is no trend", () => {
  assert.equal(TREND_MIN_GAMES, 400);
  for (const n of [0, 1, 200, 399])
    assert.deepEqual(trendBuckets(n), { size: 200, dropped: n, buckets: [] });
  const t = typeTrend(
    Array.from({ length: 399 }, (_, i) => ({
      game_id: `g${i}`,
      started_at: i,
    })),
    [],
    [],
  );
  assert.deepEqual(t.points, []);
  assert.equal(t.minGames, 400);
});

test("typeTrend: picks, expected, ratio, interval and median per bucket", () => {
  // 410 games: the 10 oldest are dropped, then two buckets of 200.
  const games = Array.from({ length: 410 }, (_, i) => ({
    game_id: `g${i}`,
    started_at: 1000 * i,
  }));
  const totals = [];
  for (let i = 0; i < 410; i++) {
    const older = i < 210;
    // 1 differs: picked once a game; chance would give 0.5 in the older
    // bucket (ratio 2) and 1 in the newer (ratio 1).
    totals.push({
      game_id: `g${i}`,
      type_key: "1",
      picks: 1,
      expected: older ? 0.5 : 1,
    });
    // 4 differ: never picked, 0.25 expected a game.
    totals.push({ game_id: `g${i}`, type_key: "4", picks: 0, expected: 0.25 });
  }
  // A game outside the scope doesn't count.
  totals.push({ game_id: "other", type_key: "1", picks: 99, expected: 1 });
  const times = [
    { game_id: "g0", n_diff: 1, elapsed_ms: 99_000 }, // dropped game
    { game_id: "g10", n_diff: 1, elapsed_ms: 3000 },
    { game_id: "g11", n_diff: 1, elapsed_ms: 1000 },
    { game_id: "g12", n_diff: 1, elapsed_ms: 2000 },
    { game_id: "g409", n_diff: 1, elapsed_ms: 5000 },
    { game_id: "g300", n_diff: 1, elapsed_ms: 4000 },
  ];
  const t = typeTrend(games, totals, times);
  assert.deepEqual([t.size, t.dropped, t.points.length], [200, 10, 2]);
  const [older, newer] = t.points;
  assert.deepEqual([older.from, older.to, older.games], [10_000, 209_000, 200]);
  assert.deepEqual([newer.from, newer.to], [210_000, 409_000]);
  assert.deepEqual(
    older.nDiff.map((r) => r.key),
    [1, 2, 3, 4],
  );

  const [one] = older.nDiff;
  assert.deepEqual([one.picks, one.expected, one.ratio], [200, 100, 2]);
  // Same interval as the tables: exact Poisson for 200 picks, over E.
  const [lo, hi] = poissonInterval(200);
  near(one.low, lo / 100);
  near(one.high, hi / 100);
  assert.deepEqual([one.medianMs, one.medianN], [2000, 3]);

  const newOne = newer.nDiff[0];
  assert.deepEqual(
    [newOne.picks, newOne.expected, newOne.ratio],
    [200, 200, 1],
  );
  assert.deepEqual([newOne.medianMs, newOne.medianN], [4500, 2]);

  // Never picked: ratio 0 with an upper bound; never on the board: none.
  const four = older.nDiff[3];
  assert.deepEqual(
    [four.picks, four.expected, four.ratio, four.low],
    [0, 50, 0, 0],
  );
  near(four.high, poissonInterval(0)[1] / 50);
  assert.equal(older.nDiff[1].ratio, null);
  assert.equal(older.nDiff[1].medianMs, null);
});
