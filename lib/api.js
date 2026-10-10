// JSON API for the web UI. Query strings in, lib/metrics.js results out.
// Mounted at /api by bin/ui.js. Nothing here touches SQL directly.
import { Router } from "express";
import {
  AVERAGE_TYPES,
  WINDOW_SIZES,
  calendarRange,
  calendarThresholds,
  daySummary,
  durationMs,
  findStats,
  gameSpan,
  gamesPerDay,
  headline,
  histogram,
  isFinished,
  lastN,
  localDayKey,
  onDay,
  paceMs,
  recordGameIds,
  rolling,
  seriesSummary,
  windowRow,
} from "./metrics.js";
import { MIN_EXPECTED, typeTables } from "./setTypes.js";
import { modes as MODES } from "../vendor/game.js";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Query string parsing. Every param is optional; bad values are a 400.
const bool = (v, dflt) => (v == null ? dflt : v === "1" || v === "true");
function int(v, dflt) {
  if (v == null || v === "") return dflt;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, `not an integer: ${v}`);
  return n;
}
function oneOf(v, allowed, dflt) {
  if (v == null) return dflt;
  if (!allowed.includes(v))
    throw new HttpError(400, `expected one of ${allowed.join(", ")}: ${v}`);
  return v;
}

/** The top-bar filters (brief 6.2). Mode defaults to the most played. */
function filters(query, queries) {
  const mode = query.mode ?? queries.modes()[0]?.mode;
  if (!mode) throw new HttpError(404, "no solo games yet");
  return {
    mode,
    completedOnly: bool(query.completedOnly, false),
    hintsOff: bool(query.hintsOff, true),
    dropBreaks: bool(query.dropBreaks, false),
    skipBadTiming: bool(query.skipBadTiming, true),
  };
}

/**
 * The games the time stats use: without the solo games whose timestamps
 * can't be trusted (bad_timing, see badTiming in lib/metrics.js), unless
 * skipBadTiming is off. The games list and calendar still show them.
 */
const timed = (games, f) =>
  f.skipBadTiming ? games.filter((g) => !g.bad_timing) : games;

/** The game that gets the Best time badge: the latest record, or null. */
const bestGameId = (games, f) =>
  [...recordGameIds(timed(games, f))].at(-1) ?? null;

/** The browser's time zone from the query, checked; a bad one is a 400. */
function timeZone(query) {
  const tz = query.tz ?? "UTC";
  try {
    localDayKey(0, tz);
  } catch (e) {
    if (e instanceof RangeError)
      throw new HttpError(400, `unknown time zone: ${tz}`);
    throw e;
  }
  return tz;
}

/** A game as sent to the client: the row plus its two per-game metrics. */
function gameRow(g) {
  return {
    game_id: g.game_id,
    mode: g.mode,
    status: g.status,
    started_at: g.started_at,
    ended_at: g.ended_at,
    enable_hint: g.enable_hint,
    sets: g.findTimes.length,
    durationMs: durationMs(g),
    paceMs: paceMs(g.findTimes),
    bad_timing: g.bad_timing,
  };
}

/**
 * The games the Set types page covers (brief-v2 part 2): solo normal games
 * that pass the top-bar filters, without bad-timing games unless
 * skipBadTiming is off (their replayed boards may not be what I saw), then
 * the date range, then the last N of those with at least one find, as in
 * Over time. Returns the filters, the range, the games, and, with
 * dropBreaks, the seqs of each game's finds that aren't breaks.
 */
function typeScope(query, queries) {
  const f = filters({ ...query, mode: "normal" }, queries);
  const from = int(query.from, -Infinity);
  const to = int(query.to, Infinity);
  const n = int(query.lastN, null);
  let games = timed(
    queries.soloGames("normal", { ...f, dropBreaks: false }),
    f,
  ).filter(
    (g) => g.findTimes.length > 0 && g.started_at >= from && g.started_at <= to,
  );
  if (n != null && n > 0) games = games.slice(-n);
  const range = {
    from: Number.isFinite(from) ? from : null,
    to: Number.isFinite(to) ? to : null,
    lastN: n,
  };
  // Breaks only change the median column: the scope is the same either way.
  let unbroken = null;
  if (f.dropBreaks) {
    const ids = new Set(games.map((g) => g.game_id));
    unbroken = new Map(
      queries
        .soloGames("normal", f)
        .filter((g) => ids.has(g.game_id))
        .map((g) => [g.game_id, new Set(g.findSeqs)]),
    );
  }
  return { f, range, games, unbroken };
}

/** Find times by kind and key, for the median column: { mask, ndiff, fresh }. */
function typeTimes(chosen, unbroken) {
  const times = { mask: {}, ndiff: {}, fresh: {} };
  const add = (kind, key, ms) => (times[kind][key] ??= []).push(ms);
  for (const c of chosen) {
    if (unbroken && !unbroken.get(c.game_id)?.has(c.seq)) continue;
    add("mask", c.diff_mask, c.elapsed_ms);
    add("ndiff", c.n_diff, c.elapsed_ms);
    if (c.n_fresh != null) add("fresh", c.n_fresh, c.elapsed_ms);
  }
  return times;
}

export function createApi(queries) {
  const api = Router();

  api.get("/meta", (req, res) => {
    res.json({
      last_sync_at: queries.lastSyncAt(),
      last_rebuild_at: queries.lastRebuildAt(),
      my_user_id: queries.myUserId,
      my_user_ids: queries.myUserIds,
    });
  });

  api.get("/modes", (req, res) => {
    res.json(
      queries
        .modes()
        .map((m) => ({ ...m, name: MODES[m.mode]?.name ?? m.mode })),
    );
  });

  // since30: local midnight 30 days ago, in ms, computed by the browser.
  api.get("/summary", (req, res) => {
    const f = filters(req.query, queries);
    const games = timed(queries.soloGames(f.mode, f), f);
    const since30 = int(req.query.since30, null);
    res.json({
      ...f,
      headline: headline(games),
      windows: {
        allTime: windowRow(games),
        last30Days:
          since30 == null
            ? null
            : windowRow(games.filter((g) => g.started_at >= since30)),
        last10Finished: windowRow(lastN(games, 10, isFinished)),
      },
    });
  });

  // Calendar (brief 6.4). year: a calendar year, or absent for the past year.
  // today: the browser's local date, "YYYY-MM-DD"; defaults to today in tz.
  api.get("/calendar", (req, res) => {
    const f = filters(req.query, queries);
    const tz = timeZone(req.query);
    const year = int(req.query.year, null);
    const starts = queries.soloGames(f.mode, f).map((g) => g.started_at);
    const all = gamesPerDay(starts, tz);
    const today = req.query.today ?? localDayKey(Date.now(), tz);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today))
      throw new HttpError(400, `bad date: ${today}`);
    const { from, to } = calendarRange(year, today);
    const days = Object.fromEntries(
      Object.entries(all).filter(([day]) => day >= from && day <= to),
    );
    const counts = Object.values(days);
    res.json({
      ...f,
      tz,
      year,
      from,
      to,
      total: counts.reduce((a, b) => a + b, 0),
      years: [
        ...new Set(Object.keys(all).map((d) => Number(d.slice(0, 4)))),
      ].sort((a, b) => b - a),
      thresholds: calendarThresholds(counts),
      days,
    });
  });

  // One calendar day (brief-v3 item 3): every game that day in the mode,
  // as the calendar counts them, oldest first, and a summary whose times
  // leave out bad-timing games like the other time stats.
  //   date: "YYYY-MM-DD", a local day in tz (the browser's zone)
  api.get("/day", (req, res) => {
    const f = filters(req.query, queries);
    const tz = timeZone(req.query);
    const date = req.query.date ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      throw new HttpError(400, `bad date: ${date}`);
    const all = queries.soloGames(f.mode, f);
    const games = onDay(all, date, tz);
    res.json({
      ...f,
      tz,
      date,
      summary: daySummary(games, timed(games, f)),
      bestGameId: bestGameId(all, f),
      games: games.map(gameRow),
    });
  });

  // The Over time card (brief 6.5). Range and last N are applied in that
  // order; the rolling line and records are computed from what remains.
  //   metric: pace (default) | time      from, to: ms, inclusive
  //   lastN: keep the N most recent games in range
  //   avg: mean (default) | median | aox  window: one of WINDOW_SIZES
  api.get("/series", (req, res) => {
    const f = filters(req.query, queries);
    const metric = oneOf(req.query.metric, ["pace", "time"], "pace");
    const avg = oneOf(req.query.avg, AVERAGE_TYPES, "mean");
    const window = int(req.query.window, 5);
    if (!WINDOW_SIZES.includes(window))
      throw new HttpError(400, `bad window: ${window}`);
    const from = int(req.query.from, -Infinity);
    const to = int(req.query.to, Infinity);
    const lastNGames = int(req.query.lastN, null);

    const all = timed(queries.soloGames(f.mode, f), f);
    const records = recordGameIds(all);
    const plottable =
      metric === "time" ? isFinished : (g) => g.findTimes.length > 0;
    let games = all.filter(
      (g) => plottable(g) && g.started_at >= from && g.started_at <= to,
    );
    if (lastNGames != null && lastNGames > 0) games = games.slice(-lastNGames);

    const values = games.map((g) =>
      metric === "time" ? durationMs(g) : paceMs(g.findTimes),
    );
    const line = rolling(values, window, avg);
    res.json({
      ...f,
      metric,
      avg,
      window,
      points: games.map((g, i) => ({
        ...gameRow(g),
        value: values[i],
        rolling: line[i],
        record: records.has(g.game_id),
      })),
      scope: gameSpan(games),
      summary: seriesSummary(values, line),
      histogram: histogram(values),
    });
  });

  // Games table (brief 6.8): newest first, paged. bestGameId gets the badge.
  api.get("/games", (req, res) => {
    const f = filters(req.query, queries);
    const offset = int(req.query.offset, 0);
    const limit = int(req.query.limit, 20);
    const games = queries.soloGames(f.mode, f);
    const newestFirst = games.slice().reverse();
    res.json({
      ...f,
      total: games.length,
      bestGameId: bestGameId(games, f),
      games: newestFirst.slice(offset, offset + limit).map(gameRow),
    });
  });

  // Single game view (brief 7).
  api.get("/games/:id", (req, res) => {
    const g = queries.game(req.params.id, {
      dropBreaks: bool(req.query.dropBreaks, false),
    });
    if (!g) throw new HttpError(404, `no game ${req.params.id}`);
    res.json({
      ...gameRow(g),
      modeName: MODES[g.mode]?.name ?? g.mode,
      n_players: g.n_players,
      findTimes: g.findTimes,
      findSeqs: g.findSeqs,
      break_ms: g.break_ms ?? null,
      stats: findStats(g.findTimes),
    });
  });

  // Board replay and hover cards (brief-v2): every find in one game with
  // its board and the sets on it. Normal mode only; other modes get
  // normalOnly and no finds. Bars of the find times chart are matched to
  // these by findSeqs from /games/:id, never by index.
  api.get("/games/:id/finds", (req, res) => {
    const g = queries.finds(req.params.id);
    if (!g) throw new HttpError(404, `no game ${req.params.id}`);
    res.json({ ...g, normalOnly: g.mode !== "normal" });
  });

  // Position heatmap (brief 6.7), normal mode only. share[i] is the fraction
  // of my finds in which position i held one of the picked cards.
  api.get("/positions", (req, res) => {
    const f = filters(req.query, queries);
    if (f.mode !== "normal")
      throw new HttpError(400, "positions are normal mode only");
    const { finds, picks, beyond } = queries.positions(f);
    res.json({
      ...f,
      finds,
      beyond,
      shares: picks.map((n) => (finds ? n / finds : null)),
    });
  });

  // Set types page (brief-v2 part 2), normal mode only; mode is ignored.
  //   from, to: ms, inclusive    lastN: keep the N most recent games in range
  api.get("/types", (req, res) => {
    const { f, range, games, unbroken } = typeScope(req.query, queries);
    const types = queries.setTypes(games.map((g) => g.game_id));
    if (!types) return res.json({ ...f, ...range, needsRebuild: true });
    const { totals, chosen } = types;
    res.json({
      ...f,
      ...range,
      minExpected: MIN_EXPECTED,
      games: games.length,
      scope: gameSpan(games),
      finds: chosen.length,
      freshFinds: chosen.filter((c) => c.n_fresh != null).length,
      ...typeTables(totals, typeTimes(chosen, unbroken)),
    });
  });

  // Recent finds of every pattern for the Set types page, same filters:
  // examples[mask] holds up to 6, newest first. One request for all 15, so
  // the page can preload them for hover previews.
  api.get("/types/examples", (req, res) => {
    const { f, range, games } = typeScope(req.query, queries);
    const examples = queries.typeExamples(games.map((g) => g.game_id));
    if (!examples) return res.json({ ...f, ...range, needsRebuild: true });
    res.json({ ...f, ...range, examples });
  });

  api.use((err, req, res, next) => {
    void next; // Express only treats 4-parameter functions as error handlers
    res.status(err.status ?? 500).json({ error: err.message });
  });

  return api;
}
