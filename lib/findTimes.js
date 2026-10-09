// My find times for one game, for every mode, using the site's own
// computeState so chain, puzzle and ultra variants count sets the way the
// site does. Pure: takes rows, returns numbers.
import { computeState as forksState } from "../vendor/game.js";
import { computeState as swfState } from "../vendor/setwithfriends/util.js";

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
 * My find times in ms, in order (`myUserId` is my id on the game's site): the gap from the previous accepted set by
 * anyone (or from started_at for the first) to each set I found. This is the
 * bin/stats.js definition and equals finds.elapsed_ms for normal mode.
 */
export function findTimes(game, events, myUserId) {
  if (!events.length) return [];
  const { history } = computeState(
    game.source,
    gameDataFromRows(game, events),
    game.mode,
  );
  const times = [];
  let prev = game.started_at;
  for (const event of history) {
    if (event.kind) continue; // puzzle modes insert synthetic "board_done" entries
    if (event.user === myUserId) times.push(event.time - prev);
    prev = event.time;
  }
  return times;
}
