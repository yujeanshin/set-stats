// What bin/sync.js does, minus the network: which games to fetch, and how to
// fetch one. `read(path)` and `call(name, data)` are passed in, so tests can
// use fakes.
import { localId, remoteId } from "./config.js";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Local ids of the games to fetch, newest first: games not stored yet, and
 * stored games that weren't done yet and were created less than a day ago.
 * `userGames` is userGames/{uid} from the site (site id -> createdAt);
 * `known` maps local id -> stored status; ids in `skipped` are never fetched.
 */
export function gamesToFetch(site, userGames, known, now, skipped = new Set()) {
  return Object.entries(userGames)
    .map(([id, createdAt]) => [localId(site, id), createdAt])
    .filter(([id, createdAt]) => {
      if (skipped.has(id)) return false;
      if (!known.has(id)) return true;
      return known.get(id) !== "done" && now - createdAt < DAY;
    })
    .sort((a, b) => b[1] - a[1]);
}

/**
 * Fetch one game. Returns { row, restored }: `row` is the sync_raw row to
 * store, or null to store nothing; `restored` is what fetchStaleGame
 * answered, or null if it wasn't called.
 *
 * Sites that archive old game data (those with a functionsUrl) return null
 * for gameData once a game is two weeks old. For a game that was started,
 * this asks the site to restore it with fetchStaleGame and reads it again.
 * If it is still missing, the game is not stored. `restored: false` means
 * the site has no archived copy (the site's own game page shows "not found"
 * then), so the caller can give up on it; otherwise the next sync retries.
 */
export async function fetchGame(site, id, createdAt, { read, call }) {
  const key = encodeURIComponent(remoteId(site, id));
  const result = { row: null, restored: null };
  let [game, data] = await Promise.all([
    read(`games/${key}`),
    read(`gameData/${key}`),
  ]);
  if (!game) return result;
  const started = game.status === "done" || game.status === "ingame";
  if (site.functionsUrl && data == null && started) {
    const { restored } = await call("fetchStaleGame", {
      gameId: remoteId(site, id),
    });
    result.restored = !!restored;
    if (restored) data = await read(`gameData/${key}`);
    if (data == null) return result;
  }
  result.row = {
    id,
    created_at: createdAt,
    status: game.status,
    game_json: JSON.stringify(game),
    data_json: JSON.stringify(data),
    source: site.source,
  };
  return result;
}

/** Wrap an async function so at most `n` calls run at once. */
export function limitConcurrency(n, fn) {
  if (n === Infinity) return fn;
  let active = 0;
  const waiting = [];
  return async (...args) => {
    // a finished call hands its slot straight to the next waiting one
    if (active >= n) await new Promise((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await fn(...args);
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}
