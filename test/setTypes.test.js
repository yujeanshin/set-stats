import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MASKS,
  MIN_EXPECTED,
  blindSpots,
  gammaP,
  nDiffOf,
  poissonInterval,
  typeRow,
  typeTables,
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
