import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aoX,
  durationMs,
  findStats,
  gamesPerDay,
  headline,
  histogram,
  localDayKey,
  mean,
  median,
  recordGameIds,
  rolling,
  sampleStdev,
  seriesSummary,
  windowRow,
} from "../lib/metrics.js";
import { EXPECTED, GAME } from "./fixture.js";

// My find times in abandoned-tired-property: gap from the previous accepted
// set (or from started_at for the first) to each of my sets.
const TIMES = EXPECTED.map((e) => e.time);
const FIND_TIMES = TIMES.map(
  (t, i) => t - (i ? TIMES[i - 1] : GAME.started_at),
);
const FIXTURE = {
  ...GAME,
  status: "done",
  ended_at: TIMES.at(-1),
  pause_time_ms: null,
  findTimes: FIND_TIMES,
};

const near = (actual, expected, digits = 2) =>
  assert.equal(actual.toFixed(digits), expected.toFixed(digits));

test("fixture game: values from brief section 7", () => {
  assert.equal(FIND_TIMES.length, 25);
  assert.equal(durationMs(FIXTURE), 234786);
  const s = findStats(FIND_TIMES);
  assert.equal(s.count, 25);
  near(s.mean, 9391.44);
  assert.equal(s.median, 3671);
  near(s.stdev, 11562.77);
  assert.equal(s.min, 1653);
  assert.equal(s.max, 40569);
});

test("pause time is subtracted; unfinished games have no duration", () => {
  assert.equal(durationMs({ ...FIXTURE, pause_time_ms: 786 }), 234000);
  assert.equal(
    durationMs({ ...FIXTURE, status: "ingame", ended_at: null }),
    null,
  );
});

test("mean, median and stdev handle small inputs", () => {
  assert.equal(mean([]), null);
  assert.equal(median([]), null);
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(sampleStdev([]), null);
  assert.equal(sampleStdev([7]), null);
  assert.equal(sampleStdev([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7));
});

test("aoX drops ceil(5%) values from each end", () => {
  assert.equal(aoX([100, 1, 2, 3, 4]), 3); // X = 5: drop 1 and 100
  const upTo = (n) => Array.from({ length: n }, (_, i) => i);
  assert.equal(aoX(upTo(12)), 5.5); // drop 1 each end: mean of 1..10
  assert.equal(aoX(upTo(50)), 24.5); // drop 3 each end: mean of 3..46
  assert.equal(aoX(upTo(100)), 49.5); // drop 5 each end: mean of 5..94
});

test("rolling average has no value until X games are available", () => {
  const values = [1, 2, 3, 4, 5, 6];
  const line = rolling(values, 5);
  assert.deepEqual(line.slice(0, 4), [null, null, null, null]);
  assert.equal(line[4].avg, 3);
  assert.equal(line[4].sd, Math.sqrt(2.5));
  assert.equal(line[5].avg, 4);

  const med = rolling([1, 2, 3, 4, 100, 6], 5, "median");
  assert.deepEqual(med[4], { avg: 3, sd: null });
  assert.deepEqual(med[5], { avg: 4, sd: null });

  assert.equal(rolling([100, 1, 2, 3, 4], 5, "aox")[4].avg, 3);
  assert.throws(() => rolling(values, 5, "mode"), /unknown average type/);
});

// Five small games, oldest first. Times are ms; "k" below means thousands.
const DAY = 86_400_000;
const T0 = Date.UTC(2026, 7, 10, 16); // Aug 10 2026, noon in New York
const game = (id, startedAt, duration, findTimes, status = "done") => ({
  game_id: id,
  status,
  started_at: startedAt,
  ended_at: status === "done" ? startedAt + duration : null,
  pause_time_ms: null,
  findTimes,
});
const GAMES = [
  game("a", T0, 240_000, [10_000, 20_000]), // 4:00, pace 15k, first record
  game("b", T0 + DAY, 200_000, [5_000, 15_000]), // 3:20, pace 10k, record
  game("c", T0 + 2 * DAY, null, [8_000], "ingame"), // unfinished, pace 8k
  game("d", T0 + 3 * DAY, 220_000, [11_000]), // 3:40, pace 11k
  game("e", T0 + 3 * DAY + 3_600_000, 180_000, []), // 3:00, no finds, record
];

test("windowRow pools find times the way bin/stats.js does", () => {
  assert.deepEqual(windowRow(GAMES), {
    finished: 4,
    unfinished: 1,
    avgTimeMs: 210_000,
    paceMs: 11_500, // (10 + 20 + 5 + 15 + 8 + 11)k / 6
  });
  assert.deepEqual(windowRow([]), {
    finished: 0,
    unfinished: 0,
    avgTimeMs: null,
    paceMs: null,
  });
});

test("headline tiles: stdev across per-game paces, last 5 finished for time", () => {
  const h = headline(GAMES);
  assert.equal(h.started, 5);
  assert.equal(h.finished, 4);
  assert.equal(h.fastestMs, 180_000);
  assert.equal(h.pace.n, 4); // e has no finds
  assert.equal(h.pace.avg, 11_000);
  near(h.pace.sd, 1000 * Math.sqrt(26 / 3));
  assert.deepEqual(h.gameTime, {
    n: 4,
    avg: 210_000,
    sd: sampleStdev([240_000, 200_000, 220_000, 180_000]),
  });
});

test("records are games that set a new best finished time", () => {
  assert.deepEqual([...recordGameIds(GAMES)], ["a", "b", "e"]);
});

test("seriesSummary: change is last rolling value minus first", () => {
  const paces = [15_000, 10_000, 8_000, 11_000];
  const s = seriesSummary(paces, rolling(paces, 2));
  assert.equal(s.n, 4);
  assert.equal(s.avg, 11_000);
  assert.equal(s.best, 8_000);
  assert.equal(s.change, 9_500 - 12_500);
  assert.equal(seriesSummary(paces, rolling(paces, 5)).change, null);
});

test("histogram picks a nice width and aligns edges to it", () => {
  const h = histogram([8_000, 9_500, 10_000, 11_000, 15_000, 20_000]);
  assert.equal(h.widthMs, 1000);
  assert.equal(h.bins.length, 13);
  assert.deepEqual(h.bins[0], { from: 8_000, to: 9_000, count: 1 });
  assert.equal(h.bins[1].count, 1); // 9500
  assert.equal(h.bins[12].count, 1); // 20000
  assert.equal(
    h.bins.reduce((a, b) => a + b.count, 0),
    6,
  );
  assert.deepEqual(histogram([]), { widthMs: null, bins: [] });
});

test("gamesPerDay buckets by local day in the given zone", () => {
  const tz = "America/New_York";
  assert.deepEqual(
    gamesPerDay(
      GAMES.map((g) => g.started_at),
      tz,
    ),
    {
      "2026-08-10": 1,
      "2026-08-11": 1,
      "2026-08-12": 1,
      "2026-08-13": 2,
    },
  );
  assert.equal(localDayKey(Date.UTC(2026, 0, 1, 3), tz), "2025-12-31");
  assert.equal(localDayKey(Date.UTC(2026, 0, 1, 3), "UTC"), "2026-01-01");
  assert.throws(() => localDayKey(T0, "Mars/Olympus"), RangeError);
});
