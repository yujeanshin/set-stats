import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  calendarRange,
  calendarThresholds,
  daySummary,
  fastestGame,
  gameSpan,
  aoX,
  BREAK_FACTOR,
  breakFlags,
  durationMs,
  findStats,
  gamesPerDay,
  headline,
  histogram,
  localDayKey,
  mean,
  median,
  onDay,
  recordGameIds,
  recentAverage,
  records,
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
  assert.deepEqual(h.fastestGame, {
    game_id: "e",
    started_at: T0 + 3 * DAY + 3_600_000,
  });
  // a tie goes to the older game; no finished games, no fastest game
  const tie = headline([...GAMES, game("f", T0 + 4 * DAY, 180_000, [1])]);
  assert.equal(tie.fastestGame.game_id, "e");
  assert.equal(headline([GAMES[2]]).fastestGame, null);
  assert.equal(h.pace.n, 4); // e has no finds
  assert.equal(h.pace.avg, 11_000);
  near(h.pace.sd, 1000 * Math.sqrt(26 / 3));
  assert.equal(h.pace.delta, null); // fewer than 10 games with finds
  assert.deepEqual(h.gameTime, {
    n: 4,
    avg: 210_000,
    sd: sampleStdev([240_000, 200_000, 220_000, 180_000]),
    delta: null,
  });
});

test("recentAverage: last n against the n before, only with 2n values", () => {
  const xs = [9, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = recentAverage(xs, 5);
  assert.equal(r.n, 5);
  assert.equal(r.avg, 8); // 6..10
  assert.equal(r.sd, sampleStdev([6, 7, 8, 9, 10]));
  assert.equal(r.delta, 5); // 8 - mean(1..5); the leading 9 is not used
  assert.equal(recentAverage(xs.slice(1), 5).delta, 5); // exactly 2n
  assert.equal(recentAverage(xs.slice(2), 5).delta, null); // 2n - 1
  assert.equal(recentAverage([5, 4, 3, 2], 2).delta, -2); // lower: negative
  assert.deepEqual(recentAverage([], 5), {
    n: 0,
    avg: null,
    sd: null,
    delta: null,
  });
});

test("headline deltas use each tile's own rule for the last 5", () => {
  // 12 games: pace counts games with finds, game time finished games.
  const many = Array.from({ length: 12 }, (_, i) =>
    game(
      `g${i}`,
      T0 + i * DAY,
      100_000 + i * 1000,
      i === 11 ? [] : [10_000 - i * 100],
      i === 10 ? "ingame" : "done",
    ),
  );
  const h = headline(many);
  // Paces: games 0-10 (11 has no finds). Last 5: 6-10, before: 1-5.
  near(h.pace.delta, -500);
  // Finished: 0-9 and 11. Last 5: 7, 8, 9, 11 and 6; before: 1-5.
  near(h.gameTime.delta, (6 + 7 + 8 + 9 + 11 - (1 + 2 + 3 + 4 + 5)) * 200);
});

test("fastestGame: lowest finished time, the older game on a tie", () => {
  assert.equal(fastestGame(GAMES).game_id, "e");
  const tie = [...GAMES, game("f", T0 + 4 * DAY, 180_000, [1])];
  assert.equal(fastestGame(tie).game_id, "e");
  assert.equal(fastestGame([GAMES[2]]), null); // unfinished only
  assert.equal(fastestGame([]), null);
});

test("onDay keeps the games started on that local day in the zone", () => {
  const ids = (gs) => gs.map((g) => g.game_id);
  // d and e start Aug 13 in New York (noon and 1 PM).
  assert.deepEqual(ids(onDay(GAMES, "2026-08-13", "America/New_York")), [
    "d",
    "e",
  ]);
  // In Tokyo, c (Aug 12, 4 PM UTC) is already Aug 13; d and e are Aug 14.
  assert.deepEqual(ids(onDay(GAMES, "2026-08-13", "Asia/Tokyo")), ["c"]);
  assert.deepEqual(onDay(GAMES, "2026-01-01", "UTC"), []);
});

test("daySummary: count every game, times from the timed ones only", () => {
  const [, , c, d, e] = GAMES;
  assert.deepEqual(daySummary([c, d, e], [c, d, e]), {
    games: 3,
    finished: 2,
    leftOut: 0,
    paceMs: 9_500, // mean of c's 8k and d's 11k; e has no finds
    bestMs: 180_000,
    bestGameId: "e",
  });
  // e left out (say for bad timing): still counted, not in the times.
  assert.deepEqual(daySummary([c, d, e], [c, d]), {
    games: 3,
    finished: 2,
    leftOut: 1,
    paceMs: 9_500,
    bestMs: 220_000,
    bestGameId: "d",
  });
  assert.deepEqual(daySummary([], []), {
    games: 0,
    finished: 0,
    leftOut: 0,
    paceMs: null,
    bestMs: null,
    bestGameId: null,
  });
});

test("gameSpan: count and the first and last start times", () => {
  assert.deepEqual(gameSpan(GAMES), {
    games: 5,
    from: T0,
    to: T0 + 3 * DAY + 3_600_000,
  });
  assert.deepEqual(gameSpan([GAMES[1]]), {
    games: 1,
    from: T0 + DAY,
    to: T0 + DAY,
  });
  assert.deepEqual(gameSpan([]), { games: 0, from: null, to: null });
});

test("records are games that set a new best finished time", () => {
  assert.deepEqual([...recordGameIds(GAMES)], ["a", "b", "e"]);
  assert.deepEqual(records(GAMES), [
    { game_id: "a", started_at: T0, durationMs: 240_000, beatByMs: null },
    {
      game_id: "b",
      started_at: T0 + DAY,
      durationMs: 200_000,
      beatByMs: 40_000,
    },
    {
      game_id: "e",
      started_at: T0 + 3 * DAY + 3_600_000,
      durationMs: 180_000,
      beatByMs: 20_000,
    },
  ]);
  // A tie is not a new best; unfinished games never are.
  const tie = game("f", T0 + 4 * DAY, 180_000, [1]);
  assert.deepEqual(records([...GAMES, tie]), records(GAMES));
  assert.deepEqual(records([GAMES[2]]), []);
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

test("histogram puts the top 2% past the width in one open bin", () => {
  // 98 values from 1 s to 9.73 s, plus two stalls.
  const values = Array.from({ length: 98 }, (_, i) => 1000 + i * 90);
  const h = histogram([...values, 40_000, 95_000]);
  assert.equal(h.widthMs, 1000);
  const last = h.bins.at(-1);
  assert.deepEqual(last, { from: 10_000, to: null, count: 2 });
  assert.equal(h.bins.length, 10);
  assert.equal(
    h.bins.reduce((a, b) => a + b.count, 0),
    100,
  );
  // No open bin when the maximum is inside the regular bins.
  assert.equal(histogram(values).bins.at(-1).to, 10_000);
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

test("calendar range: past year ends today, a year is Jan 1 to Dec 31", () => {
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2024-12-31", 1), "2025-01-01");
  assert.deepEqual(calendarRange(null, "2026-10-09"), {
    from: "2025-10-10",
    to: "2026-10-09",
  });
  assert.deepEqual(calendarRange(2025, "2026-10-09"), {
    from: "2025-01-01",
    to: "2025-12-31",
  });
});

test("calendar thresholds are quartiles of the busy days", () => {
  assert.deepEqual(calendarThresholds([0, 0]), [1, 1, 1]);
  assert.deepEqual(calendarThresholds([0, 1, 2, 3, 4, 5, 6, 7, 8]), [2, 4, 6]);
  assert.deepEqual(calendarThresholds([5]), [5, 5, 5]);
});

test("breakFlags: a gap over 50x the game's median gap is a break", () => {
  assert.equal(BREAK_FACTOR, 50);
  assert.deepEqual(breakFlags([1000, 2000, 3000, 150000, 150001]), [
    false,
    false,
    false,
    false,
    true,
  ]);
  assert.deepEqual(breakFlags([5000]), [false]);
  assert.deepEqual(breakFlags([]), []);
  assert.deepEqual(breakFlags([0, 0, 0, 5]), [false, false, false, false]);
});

test("breakFlags: gaps under 100 ms don't count toward the median", () => {
  // A burst of near-instant sets (a real swf game): the median of all gaps
  // is 2 ms, which would make every ordinary gap a break. Without the
  // burst the median is 10601.5 ms, so only gaps over about 9 min are breaks.
  const gaps = [9011, 2, 83772, 3, 1, 1, 8963, 2, 2, 1, 1, 2, 2, 12192];
  assert.deepEqual(breakFlags(gaps), Array(gaps.length).fill(false));
  assert.deepEqual(
    breakFlags([...gaps, 2_000_000]).at(-1),
    true,
    "a real break still counts",
  );
  assert.deepEqual(breakFlags([1, 2, 3]), [false, false, false]);
});

test("durationMs also subtracts break_ms when it is set", () => {
  const game = { status: "done", started_at: 0, ended_at: 100_000 };
  assert.equal(durationMs({ ...game, pause_time_ms: 1000 }), 99_000);
  assert.equal(
    durationMs({ ...game, pause_time_ms: 1000, break_ms: 40_000 }),
    59_000,
  );
});
