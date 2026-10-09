// JSON API for the web UI. Query strings in, lib/metrics.js results out.
// Mounted at /api by bin/ui.js. Nothing here touches SQL directly.
import { Router } from "express";
import {
  AVERAGE_TYPES,
  WINDOW_SIZES,
  calendarRange,
  calendarThresholds,
  durationMs,
  findStats,
  gamesPerDay,
  headline,
  histogram,
  isFinished,
  lastN,
  localDayKey,
  paceMs,
  recordGameIds,
  rolling,
  seriesSummary,
  windowRow,
} from "./metrics.js";
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
  };
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
  };
}

export function createApi(queries) {
  const api = Router();

  api.get("/meta", (req, res) => {
    res.json({
      last_sync_at: queries.lastSyncAt(),
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
    const games = queries.soloGames(f.mode, f);
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
    const tz = req.query.tz ?? "UTC";
    const year = int(req.query.year, null);
    const starts = queries.soloGames(f.mode, f).map((g) => g.started_at);
    let all, today;
    try {
      all = gamesPerDay(starts, tz);
      today = req.query.today ?? localDayKey(Date.now(), tz);
    } catch (e) {
      if (e instanceof RangeError)
        throw new HttpError(400, `unknown time zone: ${tz}`);
      throw e;
    }
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

    const all = queries.soloGames(f.mode, f);
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
      bestGameId: [...recordGameIds(games)].at(-1) ?? null,
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
      break_ms: g.break_ms ?? null,
      stats: findStats(g.findTimes),
    });
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

  api.use((err, req, res, next) => {
    void next; // Express only treats 4-parameter functions as error handlers
    res.status(err.status ?? 500).json({ error: err.message });
  });

  return api;
}
