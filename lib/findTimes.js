// My find times for one game, for every mode, using the site's own
// computeState so chain, puzzle and ultra variants count sets the way the
// site does. Pure: takes rows, returns numbers.
import { computeState as forksState } from "../vendor/game.js";
import { computeState as swfState } from "../vendor/setwithfriends/util.js";
import { breakFlags } from "./metrics.js";

/** The computeState of the site a game came from. */
export function computeState(source, gameData, mode) {
  return (source === "swf" ? swfState : forksState)(gameData, mode);
}

/**
 * Rebuild the gameData object computeState expects from a games row and its
 * events rows in seq order. Keys are the Firebase push keys, so equal-time
 * events keep the site's tie-break order.
 */
export function gameDataFromRows(game, events) {
  const out = {};
  for (const e of events) {
    const ev = {
      user: e.user_id,
      time: e.time_ms,
      c1: e.c1,
      c2: e.c2,
      c3: e.c3,
    };
    if (e.c4 != null) ev.c4 = e.c4;
    if (e.c5 != null) ev.c5 = e.c5;
    if (e.c6 != null) ev.c6 = e.c6;
    out[e.push_key] = ev;
  }
  const data = { seed: game.seed, events: out };
  if (game.deck) data.deck = JSON.parse(game.deck);
  return data;
}

/**
 * Every gap in a game, in order: from the previous accepted set by anyone
 * (or from started_at for the first) to each accepted set, as { user, ms }.
 */
export function gameGaps(game, events) {
  if (!events.length) return [];
  const { history } = computeState(
    game.source,
    gameDataFromRows(game, events),
    game.mode,
  );
  const gaps = [];
  let prev = game.started_at;
  for (const event of history) {
    if (event.kind) continue; // puzzle modes insert synthetic "board_done" entries
    gaps.push({ user: event.user, ms: event.time - prev });
    prev = event.time;
  }
  return gaps;
}

/**
 * My find times and the game's break time. `findTimes` are the gaps that
 * ended in a set I found (`myUserId` is my id on the game's site). With
 * `dropBreaks`, gaps that are breaks (see breakFlags in lib/metrics.js) are
 * left out of `findTimes` and summed, whoever ended them, into `breakMs`;
 * without it `breakMs` is 0.
 */
export function gameTiming(
  game,
  events,
  myUserId,
  { dropBreaks = false } = {},
) {
  const gaps = gameGaps(game, events);
  const flags = dropBreaks ? breakFlags(gaps.map((g) => g.ms)) : [];
  const timing = { findTimes: [], breakMs: 0 };
  for (const [i, g] of gaps.entries()) {
    if (flags[i]) timing.breakMs += g.ms;
    else if (g.user === myUserId) timing.findTimes.push(g.ms);
  }
  return timing;
}

/**
 * My find times in ms, in order: the gap from the previous accepted set by
 * anyone (or from started_at for the first) to each set I found. This is the
 * bin/stats.js definition and equals finds.elapsed_ms for normal mode.
 */
export function findTimes(game, events, myUserId, options) {
  return gameTiming(game, events, myUserId, options).findTimes;
}
