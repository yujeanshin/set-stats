// Set-type math for the Set types page (docs/design/brief-v2.md, part 2).
// Pure: takes totals already summed in SQL, returns the rows the page shows.
//
// For a type G (a group of sets), over my finds in scope:
//   picks (O)    finds where the chosen set is in G
//   expected (E) sum over finds of (sets in G on the board / all sets on
//                the board): O if I chose uniformly among the sets
//   ratio        O / E, with an exact Poisson 95% interval for O, E fixed
//   take rate    O / present, where present counts the finds with at least
//                one set in G on the board
import { median } from "./metrics.js";

/** Rows with less expected than this are too noisy to read; the page greys them. */
export const MIN_EXPECTED = 30;

/** How many blind spots the page lists at most. */
export const BLIND_SPOTS = 3;

/** Number of features that differ in a diff_mask: "0110" -> 2. */
export const nDiffOf = (mask) => [...mask].filter((c) => c === "1").length;

/**
 * The 15 diff_masks, grouped by n_diff (4 + 6 + 4 + 1) and, within a group,
 * in card feature order: "1000" (color) before "0100" (shape).
 */
export const MASKS = Array.from({ length: 15 }, (_, i) =>
  (15 - i).toString(2).padStart(4, "0"),
).sort((a, b) => nDiffOf(a) - nDiffOf(b));

export const N_DIFFS = [1, 2, 3, 4];

/** n_fresh values of a set: how many of its 3 cards are new since the previous find. */
export const N_FRESH = [0, 1, 2, 3];

/** ln Γ(x) for x > 0 (Lanczos, g = 7, n = 9). */
function logGamma(x) {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
  );
}

/**
 * Regularized lower incomplete gamma P(a, x): the series below a + 1, the
 * continued fraction above (Numerical Recipes 6.2).
 */
export function gammaP(a, x) {
  if (x <= 0) return 0;
  const lead = a * Math.log(x) - x - logGamma(a);
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let n = 1; n < 1e6; n++) {
      term *= x / (a + n);
      sum += term;
      if (term < sum * 1e-15) break;
    }
    return Math.min(1, sum * Math.exp(lead));
  }
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1e6; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.max(0, 1 - Math.exp(lead) * h);
}

/** The x with P(a, x) = p, by bisection. */
function gammaQuantile(p, a) {
  let lo = 0;
  let hi = a + 20 * Math.sqrt(a) + 20;
  while (gammaP(a, hi) < p) hi *= 2;
  for (let i = 0; i < 200 && hi - lo > 1e-9 * Math.max(1, hi); i++) {
    const mid = (lo + hi) / 2;
    if (gammaP(a, mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Exact (Garwood) interval for a Poisson mean given `o` events:
 * [Gamma⁻¹(α/2; o), Gamma⁻¹(1 − α/2; o + 1)], with 0 as the lower bound when o = 0.
 */
export function poissonInterval(o, level = 0.95) {
  const alpha = 1 - level;
  return [
    o === 0 ? 0 : gammaQuantile(alpha / 2, o),
    gammaQuantile(1 - alpha / 2, o + 1),
  ];
}

/**
 * One table row from summed totals. `times` are my find times (ms) for the
 * finds where I picked this type, already without breaks if those are
 * dropped. Without `present`, there is no take rate. With E = 0 (the type
 * was never on the board) ratio and interval are null.
 */
export function typeRow({ picks = 0, expected = 0, present, times = [] }) {
  const [lo, hi] = poissonInterval(picks);
  const some = expected > 0;
  return {
    picks,
    expected,
    ratio: some ? picks / expected : null,
    low: some ? lo / expected : null,
    high: some ? hi / expected : null,
    ...(present === undefined
      ? {}
      : { present, takeRate: present ? picks / present : null }),
    medianMs: median(times),
    medianN: times.length,
    lowData: expected < MIN_EXPECTED,
  };
}

/**
 * Up to BLIND_SPOTS keys of the rows I under-pick for sure: E of at least
 * MIN_EXPECTED and the whole interval below 1, lowest ratio first.
 */
export function blindSpots(rows) {
  return rows
    .filter((r) => !r.lowData && r.high != null && r.high < 1)
    .sort((a, b) => a.ratio - b.ratio || a.key.localeCompare(b.key))
    .slice(0, BLIND_SPOTS)
    .map((r) => r.key);
}

/**
 * Every row of the page from summed totals. `totals`: [{ kind, type_key,
 * picks, expected, present }] with kind "ndiff", "mask" or "fresh" (keys as
 * text). `times`: { ndiff, mask, fresh } each mapping a key to find times.
 * Types missing from `totals` were never on the board and get zero rows.
 */
export function typeTables(totals, times = {}) {
  const get = (kind, key) =>
    totals.find((t) => t.kind === kind && t.type_key === String(key)) ?? {};
  const row = (kind, key, withPresent = true) => {
    const t = get(kind, key);
    return {
      key,
      ...typeRow({
        picks: t.picks ?? 0,
        expected: t.expected ?? 0,
        present: withPresent ? (t.present ?? 0) : undefined,
        times: times[kind]?.[key] ?? [],
      }),
    };
  };
  const patterns = MASKS.map((m) => ({ ...row("mask", m), nDiff: nDiffOf(m) }));
  return {
    nDiff: N_DIFFS.map((d) => row("ndiff", d)),
    patterns,
    blindSpots: blindSpots(patterns),
    fresh: N_FRESH.map((k) => row("fresh", k, false)),
  };
}
