// SQL for the web UI. Opens data/games.db read-only and turns rows into the
// plain per-game objects lib/metrics.js works on. No HTTP and no math here.
import Database from "better-sqlite3";
import { gameTiming } from "./findTimes.js";
import { DB_FILE } from "./paths.js";
import { getMeta, myUserKey } from "./schema.js";

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
        `SELECT push_key, time_ms, user_id, c1, c2, c3, c4, c5, c6
         FROM events WHERE game_id = ? ORDER BY seq`,
      ),
      modes: db.prepare(
        `SELECT mode, COUNT(*) AS games FROM games
         WHERE n_players = 1 AND started_at IS NOT NULL
         GROUP BY mode ORDER BY games DESC, mode`,
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
   * Attach findTimes (and break_ms, when breaks are dropped) to a games row,
   * and drop the seed and deck.
   */
  toGame(row, dropBreaks = false) {
    const { findTimes, breakMs } = this.timing(row, dropBreaks);
    const game = { ...row, findTimes };
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

  /** last_sync_at as a number, or null if never synced. */
  lastSyncAt() {
    const v = getMeta(this.db, "last_sync_at");
    return v == null ? null : Number(v);
  }

  /** One game by id with find times, or null. Not limited to solo. */
  game(id, { dropBreaks = false } = {}) {
    const row = this.stmts.game.get(id);
    return row && row.started_at != null ? this.toGame(row, dropBreaks) : null;
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
}
