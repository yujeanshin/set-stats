// Pure metric math for the web UI. No database access; see docs/design/brief.md §5.

/** Mean of a list, or null when empty. */
export function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Sample standard deviation (n - 1). Null for fewer than 2 values. */
export function sampleStdev(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  const ss = xs.reduce((a, x) => a + (x - m) ** 2, 0);
  return Math.sqrt(ss / (xs.length - 1));
}

/** Median of a list, or null when empty. Even counts average the middle two. */
export function median(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** csTimer-style aoX: drop the best and worst ceil(5%) values, mean of the rest. */
export function aoX(xs) {
  const trim = Math.ceil(xs.length * 0.05);
  const s = xs.slice().sort((a, b) => a - b);
  return mean(s.slice(trim, s.length - trim));
}

export const AVERAGE_TYPES = ["mean", "median", "aox"];
export const WINDOW_SIZES = [5, 10, 12, 50, 100];

/**
 * Rolling average over the last `size` values, one entry per input value.
 * Null until `size` values are available, otherwise { avg, sd }, where sd is
 * the sample standard deviation of the window for the mean type and null
 * for the others (the band is only drawn for the mean).
 */
export function rolling(values, size, type = "mean") {
  const fn = { mean, median, aox: aoX }[type];
  if (!fn) throw new Error(`unknown average type: ${type}`);
  return values.map((_, i) => {
    if (i + 1 < size) return null;
    const window = values.slice(i + 1 - size, i + 1);
    return {
      avg: fn(window),
      sd: type === "mean" ? sampleStdev(window) : null,
    };
  });
}

// Per game. A "game" here is a plain object with the columns of the games
// table (status, started_at, ended_at, pause_time_ms) plus `findTimes`, my
// find times in ms in order. lib/queries.js builds these; nothing here reads SQL.

export const isFinished = (game) => game.status === "done";

/** Game length in ms with pause time removed. Null for unfinished games. */
export function durationMs(game) {
  if (!isFinished(game) || game.ended_at == null) return null;
  return game.ended_at - game.started_at - (game.pause_time_ms ?? 0);
}

/** Mean find time in ms. Null for a game with no finds. */
export function paceMs(findTimes) {
  return mean(findTimes);
}

/** The four tiles of the single game view. All null when there are no finds. */
export function findStats(findTimes) {
  const any = findTimes.length > 0;
  return {
    count: findTimes.length,
    mean: mean(findTimes),
    median: median(findTimes),
    stdev: sampleStdev(findTimes),
    min: any ? Math.min(...findTimes) : null,
    max: any ? Math.max(...findTimes) : null,
  };
}

// Aggregates over lists of games, oldest first.

/** One row of the By window table, pooled the way bin/stats.js does it. */
export function windowRow(games) {
  const finished = games.filter(isFinished);
  return {
    finished: finished.length,
    unfinished: games.length - finished.length,
    avgTimeMs: mean(finished.map(durationMs)),
    paceMs: mean(games.flatMap((g) => g.findTimes)),
  };
}

/** The n most recent games that satisfy `keep`, still oldest first. */
export function lastN(games, n, keep = () => true) {
  return games.filter(keep).slice(-n);
}

/** Mean ± sample standard deviation of a list, with its count. */
export function summarize(xs) {
  return { n: xs.length, avg: mean(xs), sd: sampleStdev(xs) };
}

/** Ids of games that set a new best finished time, scanning oldest first. */
export function recordGameIds(games) {
  const ids = new Set();
  let best = Infinity;
  for (const g of games) {
    const d = durationMs(g);
    if (d != null && d < best) {
      best = d;
      ids.add(g.game_id);
    }
  }
  return ids;
}

/** The four headline tiles (§6.3). Takes every game in the mode, no date range. */
export function headline(games) {
  const durations = games.filter(isFinished).map(durationMs);
  const paced = lastN(games, 5, (g) => g.findTimes.length > 0);
  return {
    started: games.length,
    finished: durations.length,
    fastestMs: durations.length ? Math.min(...durations) : null,
    pace: summarize(paced.map((g) => paceMs(g.findTimes))),
    gameTime: summarize(durations.slice(-5)),
  };
}

/**
 * Summary line of the Over time card (§6.5): count, average ± stdev, best
 * (minimum) and change over range, the last rolling value minus the first.
 * `values` is the plotted metric per game; `line` is rolling() of it.
 */
export function seriesSummary(values, line) {
  const defined = line.filter((r) => r != null);
  return {
    ...summarize(values),
    best: values.length ? Math.min(...values) : null,
    change: defined.length ? defined.at(-1).avg - defined[0].avg : null,
  };
}

// Candidate bin widths in ms: 0.25 s up to 5 min. Pace values land in the
// first few, game times in the later ones.
const BIN_WIDTHS_MS = [
  250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000, 120000, 300000,
];

/**
 * Equal-width histogram of values in ms (§6.5). Uses the smallest "nice" width
 * that needs at most `maxBins` bins; bin edges are multiples of that width.
 * Each bin is [from, to). The width is chosen to cover the values up to the
 * 98th percentile, so a few stalled games don't squash the rest into one
 * bar; anything above that lands in a last, open-ended bin with `to: null`.
 * With fewer than 50 values the percentile is the maximum, so nothing is cut.
 */
export function histogram(values, maxBins = 12) {
  if (!values.length) return { widthMs: null, bins: [] };
  const sorted = values.slice().sort((a, b) => a - b);
  const lo = sorted[0];
  const hi = sorted[Math.ceil(sorted.length * 0.98) - 1];
  const widthMs =
    BIN_WIDTHS_MS.find((w) => (hi - lo) / w <= maxBins) ?? BIN_WIDTHS_MS.at(-1);
  const start = Math.floor(lo / widthMs) * widthMs;
  const n = Math.floor((hi - start) / widthMs) + 1;
  const bins = Array.from({ length: n }, (_, i) => ({
    from: start + i * widthMs,
    to: start + (i + 1) * widthMs,
    count: 0,
  }));
  const end = start + n * widthMs;
  if (sorted.at(-1) >= end) bins.push({ from: end, to: null, count: 0 });
  for (const v of values)
    bins[Math.min(Math.floor((v - start) / widthMs), bins.length - 1)].count++;
  return { widthMs, bins };
}

// Calendar (§6.4). Days are bucketed in the browser's IANA time zone, which
// the client sends as `tz`; timestamps stay UTC ms everywhere else.

const dayFormatters = new Map();

function dayFormatter(tz) {
  if (!dayFormatters.has(tz)) {
    // en-CA formats dates as YYYY-MM-DD, which also sorts correctly as text.
    dayFormatters.set(
      tz,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    );
  }
  return dayFormatters.get(tz);
}

/** "YYYY-MM-DD" of a UTC-ms timestamp in the given time zone. */
export function localDayKey(ms, tz) {
  return dayFormatter(tz).format(ms);
}

/** Games per local day, e.g. { "2026-08-17": 3 }. Days with no games are absent. */
export function gamesPerDay(startTimes, tz) {
  const counts = {};
  for (const t of startTimes) {
    const key = localDayKey(t, tz);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Shift a "YYYY-MM-DD" key by n days. Calendar arithmetic, no time zone. */
export function addDays(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Day range shown by the calendar, as inclusive "YYYY-MM-DD" keys: a whole
 * calendar year, or for `year` null the past year, the 365 days ending today.
 */
export function calendarRange(year, today) {
  if (year == null) return { from: addDays(today, -364), to: today };
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * Upper bounds of color levels 1-3 for the calendar's five levels (§6.4):
 * 0 is no games, then the quartiles of the busy days' counts. A day with
 * count c gets the first level whose bound is >= c, else level 4.
 */
export function calendarThresholds(counts) {
  const busy = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (!busy.length) return [1, 1, 1];
  const q = (p) => busy[Math.ceil(busy.length * p) - 1];
  return [q(0.25), q(0.5), q(0.75)];
}
