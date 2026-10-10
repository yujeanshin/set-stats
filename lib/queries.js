// SQL for the web UI. Opens data/games.db read-only and turns rows into the
// plain per-game objects lib/metrics.js works on. No HTTP and no math here.
import Database from "better-sqlite3";
import { DERIVE_VERSION } from "./derive.js";
import { breakSeqs, gameTiming } from "./findTimes.js";
import { DB_FILE } from "./paths.js";
import { getMeta, myUserKey } from "./schema.js";
import { MASKS } from "./setTypes.js";

export function openReadOnly(file = DB_FILE) {
  return new Database(file, { readonly: true, fileMustExist: true });
}

const GAME_COLS =
  "game_id, mode, status, enable_hint, started_at, ended_at, pause_time_ms, seed, source, deck";

// One row per card I picked: the game and the board position of the card.
const PICKS = ["p1", "p2", "p3"]
  .map(
    (c) => `SELECT b.game_id, b.${c} AS p FROM board_sets b
          JOIN my_finds USING (game_id, seq) WHERE b.is_chosen = 1`,
  )
  .join(" UNION ALL ");

// Set types (brief-v2 part 2), summed over the games in the JSON array @ids
// from the tables derive saves (lib/derive.js, docs/schema.md).
const TYPE_TOTALS = `
SELECT kind, type_key, SUM(picks) AS picks,
       SUM(expected) AS expected
FROM game_set_types WHERE game_id IN (SELECT value FROM json_each(@ids))
GROUP BY kind, type_key`;

// Unordered: sorting 470k rows here costs more than anything that reads them.
const TYPE_CHOSEN = `
SELECT game_id, seq, elapsed_ms, diff_mask, n_diff, n_fresh
FROM my_find_types WHERE game_id IN (SELECT value FROM json_each(@ids))`;

// My most recent finds of each pattern in those games, with the chosen
// cards: up to @limit per diff_mask, newest game first, latest find first.
const TYPE_EXAMPLES = `
WITH ranked AS (
  SELECT t.game_id, t.seq, t.elapsed_ms, t.diff_mask, g.started_at,
         ROW_NUMBER() OVER (PARTITION BY t.diff_mask
           ORDER BY g.started_at DESC, t.game_id, t.seq DESC) AS n
  FROM my_find_types t JOIN games g USING (game_id)
  WHERE t.game_id IN (SELECT value FROM json_each(@ids)))
SELECT r.game_id, r.seq, r.elapsed_ms, r.diff_mask, r.started_at,
       s.c1, s.c2, s.c3
FROM ranked r
JOIN board_sets b ON b.game_id = r.game_id AND b.seq = r.seq AND b.is_chosen = 1
JOIN sets s USING (set_id)
WHERE r.n <= @limit
ORDER BY r.diff_mask, r.n`;

// Filter clauses shared by the position queries. Named params are 0 or 1.
const SOLO_NORMAL_FILTER = `
g.n_players = 1 AND g.mode = 'normal'
AND (@completedOnly = 0 OR g.status = 'done')
AND (@hintsOff = 0 OR g.enable_hint = 0)`;

export class Queries {
  constructor(db) {
    this.db = db;
    // source -> my user id on that site
    this.myUserIds = Object.fromEntries(
      db
        .prepare("SELECT DISTINCT source FROM games")
        .pluck()
        .all()
        .concat("forks")
        .map((source) => [source, getMeta(db, myUserKey(source))])
        .filter(([, id]) => id),
    );
    this.myUserId = this.myUserIds.forks;
    if (!this.myUserId) throw new Error("meta.my_user_id is not set");
    // "game_id dropBreaks" -> timing, for finished games only (they never change).
    this.cache = new Map();
    this.stmts = {
      soloGames: db.prepare(
        `SELECT ${GAME_COLS} FROM games
         WHERE n_players = 1 AND started_at IS NOT NULL AND mode = ?
         ORDER BY started_at, game_id`,
      ),
      events: db.prepare(
        `SELECT seq, push_key, time_ms, user_id, c1, c2, c3, c4, c5, c6
         FROM events WHERE game_id = ? ORDER BY seq`,
      ),
      finds: db.prepare(
        `SELECT seq, user_id, elapsed_ms, board, board_size, n_sets, deck_left
         FROM finds WHERE game_id = ? ORDER BY seq`,
      ),
      // Chosen set first, then the rest in set_id order.
      boardSets: db.prepare(
        `SELECT b.seq, b.set_id, s.c1, s.c2, s.c3, b.p1, b.p2, b.p3,
                b.is_chosen, b.n_fresh, s.diff_mask, s.n_diff
         FROM board_sets b JOIN sets s USING (set_id)
         WHERE b.game_id = ? ORDER BY b.seq, b.is_chosen DESC, b.set_id`,
      ),
      modes: db.prepare(
        `SELECT mode, COUNT(*) AS games FROM games
         WHERE n_players = 1 AND started_at IS NOT NULL
         GROUP BY mode ORDER BY games DESC, mode`,
      ),
      // Every started game whose id contains @q (already lowercased).
      searchGames: db.prepare(
        `SELECT game_id, mode, status, started_at, ended_at, pause_time_ms,
                n_players FROM games
         WHERE started_at IS NOT NULL AND instr(lower(game_id), @q) > 0
         ORDER BY started_at DESC, game_id`,
      ),
      game: db.prepare(
        `SELECT ${GAME_COLS}, n_players FROM games WHERE game_id = ?`,
      ),
      positions: db.prepare(
        `WITH picks AS (${PICKS})
         SELECT p, COUNT(*) AS n FROM picks JOIN games g USING (game_id)
         WHERE ${SOLO_NORMAL_FILTER} GROUP BY p ORDER BY p`,
      ),
      myFinds: db.prepare(
        `SELECT COUNT(*) AS n FROM my_finds JOIN games g USING (game_id)
         WHERE ${SOLO_NORMAL_FILTER}`,
      ),
    };
  }

  /** My find times and break time for one games row, cached once the game is done. */
  timing(game, dropBreaks) {
    const done = game.status === "done";
    const key = `${game.game_id} ${dropBreaks}`;
    if (done && this.cache.has(key)) return this.cache.get(key);
    const timing = gameTiming(
      game,
      this.stmts.events.all(game.game_id),
      this.myUserIds[game.source],
      { dropBreaks },
    );
    if (done) this.cache.set(key, timing);
    return timing;
  }

  /**
   * Attach findTimes and findSeqs (and break_ms, when breaks are dropped) to
   * a games row, plus bad_timing for a solo game with a gap under 100 ms,
   * and drop the seed and deck. Rows without n_players are solo games.
   */
  toGame(row, dropBreaks = false) {
    const { findTimes, findSeqs, breakMs, badTiming } = this.timing(
      row,
      dropBreaks,
    );
    const solo = (row.n_players ?? 1) === 1;
    const game = { ...row, findTimes, findSeqs, bad_timing: badTiming && solo };
    if (dropBreaks) game.break_ms = breakMs;
    delete game.seed;
    delete game.deck;
    return game;
  }

  /**
   * My solo games in one mode, oldest first, with find times.
   * `completedOnly` keeps status = 'done'; `hintsOff` drops enable_hint = 1;
   * `dropBreaks` leaves breaks out of find times and game time.
   */
  soloGames(
    mode,
    { completedOnly = false, hintsOff = true, dropBreaks = false } = {},
  ) {
    return this.stmts.soloGames
      .all(mode)
      .filter((g) => !completedOnly || g.status === "done")
      .filter((g) => !hintsOff || !g.enable_hint)
      .map((row) => this.toGame(row, dropBreaks));
  }
  /** Solo modes I have played, most played first: [{ mode, games }]. */
  modes() {
    return this.stmts.modes.all();
  }

  /** A meta value that holds a time in ms, as a number, or null if unset. */
  metaTime(key) {
    const v = getMeta(this.db, key);
    return v == null ? null : Number(v);
  }

  /** last_sync_at, or null if never synced. */
  lastSyncAt() {
    return this.metaTime("last_sync_at");
  }

  /**
   * last_rebuild_at: when bin/rebuild.js last finished, which is when the
   * data the UI shows last changed. Null on a database not rebuilt since
   * the key was added.
   */
  lastRebuildAt() {
    return this.metaTime("last_rebuild_at");
  }

  /**
   * Every started game whose id contains `q` (case-insensitive), in any
   * mode, solo or not, newest first, with the columns durationMs needs.
   * All of them: lib/search.js groups them into Play again series first.
   */
  searchGames(q) {
    return this.stmts.searchGames.all({ q: q.toLowerCase() });
  }

  /** One game by id with find times, or null. Not limited to solo. */
  game(id, { dropBreaks = false } = {}) {
    const row = this.stmts.game.get(id);
    return row && row.started_at != null ? this.toGame(row, dropBreaks) : null;
  }

  /**
   * Every find in one game, oldest first, for the board replay, or null for
   * an unknown or unstarted game. Each find has its board (index = board
   * position), every set on that board (chosen first) and two flags: `mine`,
   * and `break` when its gap is a break (stats can leave those out; the
   * replay never does). Only normal-mode games have finds; for other modes,
   * and for normal games not derived yet, `finds` is empty.
   */
  finds(id) {
    const game = this.stmts.game.get(id);
    if (!game || game.started_at == null) return null;
    const me = this.myUserIds[game.source];
    const rows = this.stmts.finds.all(id);
    const sets = Map.groupBy(this.stmts.boardSets.all(id), (s) => s.seq);
    const breaks = rows.length
      ? breakSeqs(game, this.stmts.events.all(id))
      : new Set();
    return {
      game_id: game.game_id,
      mode: game.mode,
      n_players: game.n_players,
      finds: rows.map(({ user_id, board, ...f }) => ({
        ...f,
        user_id,
        mine: user_id === me,
        break: breaks.has(f.seq),
        board: JSON.parse(board),
        sets: (sets.get(f.seq) ?? []).map((s) => ({
          set_id: s.set_id,
          cards: [s.c1, s.c2, s.c3],
          positions: [s.p1, s.p2, s.p3],
          is_chosen: s.is_chosen === 1,
          n_fresh: s.n_fresh,
          diff_mask: s.diff_mask,
          n_diff: s.n_diff,
        })),
      })),
    };
  }

  /**
   * Position heatmap input, normal mode only: how many of my picked cards sat
   * at each board position, and how many finds that is over. `picks[i]` is
   * the count for position i; positions >= 12 are summed into `beyond`.
   */
  positions({ completedOnly = false, hintsOff = true } = {}) {
    const params = {
      completedOnly: Number(completedOnly),
      hintsOff: Number(hintsOff),
    };
    const picks = Array(12).fill(0);
    let beyond = 0;
    for (const { p, n } of this.stmts.positions.all(params)) {
      if (p < 12) picks[p] = n;
      else beyond += n;
    }
    return { finds: this.stmts.myFinds.get(params).n, picks, beyond };
  }

  /**
   * Whether the saved set-type tables are current: derive_version is this
   * code's. An older database has no such tables until `npm run rebuild`.
   */
  setTypesReady() {
    return getMeta(this.db, "derive_version") === String(DERIVE_VERSION);
  }

  /**
   * Set-type input for the given games, normal mode, or null until the
   * tables are rebuilt: `totals`, summed over my finds in them, as
   * [{ kind, type_key, picks, expected }] with kind "mask",
   * "ndiff" or "fresh"; and `chosen`, one row per find with the chosen
   * set's diff_mask, n_diff and n_fresh and elapsed_ms.
   */
  setTypes(gameIds) {
    if (!this.setTypesReady()) return null;
    // Prepared on first use: the tables don't exist before schema v4.
    this.stmts.typeTotals ??= this.db.prepare(TYPE_TOTALS);
    this.stmts.typeChosen ??= this.db.prepare(TYPE_CHOSEN);
    const params = { ids: JSON.stringify(gameIds) };
    return {
      totals: this.stmts.typeTotals.all(params),
      chosen: this.stmts.typeChosen.all(params),
    };
  }

  /**
   * Up to `limit` of my finds of each diff_mask in the given games (oldest
   * first, as soloGames returns them), newest game first and the latest
   * find first within it, or null until the set-type tables are rebuilt:
   * { mask: [{ game_id, seq, elapsed_ms, started_at, cards }] }, with a key
   * for every mask that has a find. Reads the newest games in batches that
   * double in size, and stops once every pattern has `limit`: usually the
   * first batch, where ranking all my finds at once took about 0.85 s.
   * `batch` is the first batch's size (a parameter for the tests).
   */
  typeExamples(gameIds, limit = 6, batch = 64) {
    if (!this.setTypesReady()) return null;
    this.stmts.typeExamples ??= this.db.prepare(TYPE_EXAMPLES);
    const out = {};
    const full = () => MASKS.every((m) => (out[m]?.length ?? 0) >= limit);
    let end = gameIds.length;
    for (let size = batch; end > 0 && !full(); size *= 2) {
      const batch = gameIds.slice(Math.max(0, end - size), end);
      end -= batch.length;
      const rows = this.stmts.typeExamples.all({
        ids: JSON.stringify(batch),
        limit,
      });
      for (const { diff_mask, c1, c2, c3, ...f } of rows) {
        const list = (out[diff_mask] ??= []);
        if (list.length < limit) list.push({ ...f, cards: [c1, c2, c3] });
      }
    }
    return out;
  }
}
