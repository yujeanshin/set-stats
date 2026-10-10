import { findSets, setId, sortedSet } from "./cards.js";
import { replayGame } from "./replay.js";
import { getMeta, migrate, setMeta } from "./schema.js";

export const DERIVE_VERSION = 2;

/**
 * SQL condition, on the games table, for a game that left the lobby. A game
 * that never started has no started_at, no events, and on setwithfriends no
 * deck either (the site only shuffles when a game starts), so there is
 * nothing to replay. Derive and test/crosscheck.test.js skip these games
 * instead of failing them; a started game without a seed or deck still
 * fails in replayGame.
 */
export const STARTED = "started_at IS NOT NULL";

/** Normal-mode games, oldest first, that are started and match `where`. */
function normalGames(db, where = "1") {
  return db
    .prepare(
      `SELECT * FROM games g WHERE mode = 'normal' AND ${STARTED} AND ${where}
       ORDER BY created_at, game_id`,
    )
    .all();
}

/** How many normal-mode games never started (skipped by derive). */
function neverStarted(db) {
  return db
    .prepare(
      `SELECT COUNT(*) FROM games WHERE mode = 'normal' AND NOT (${STARTED})`,
    )
    .pluck()
    .get();
}

/** Every set on `board`, with p1..p3 = positions of the set's sorted cards. */
export function boardSets(board, chosenId, prevBoard) {
  const prev = prevBoard && new Set(prevBoard);
  return findSets(board).map((triple) => {
    const cards = sortedSet(triple.map((p) => board[p]));
    const id = cards.join("-");
    return {
      set_id: id,
      p1: board.indexOf(cards[0]),
      p2: board.indexOf(cards[1]),
      p3: board.indexOf(cards[2]),
      is_chosen: id === chosenId ? 1 : 0,
      n_fresh: prev ? cards.filter((c) => !prev.has(c)).length : null,
    };
  });
}

// Set types (brief-v2 part 2), for one game @game_id: my finds with every
// set on each board and its type.
const TYPE_BOARD_SETS = `
SELECT f.seq, f.n_sets, s.diff_mask, s.n_diff, b.n_fresh, b.is_chosen
FROM my_finds f JOIN board_sets b USING (game_id, seq) JOIN sets s USING (set_id)
WHERE f.game_id = @game_id`;

// Per type: picks (O), expected (E) and present. Each find is grouped by
// type first, so a type with two sets on one board adds 2 / n_sets to E but
// counts once in present. The fresh rows leave out the first find, where
// n_fresh is NULL.
const INSERT_SET_TYPES = `
INSERT INTO game_set_types (game_id, kind, type_key, picks, expected, present)
WITH b AS MATERIALIZED (${TYPE_BOARD_SETS}),
by_find AS (
  SELECT 'mask' AS kind, diff_mask AS type_key,
         MAX(is_chosen) AS chosen, COUNT(*) AS n, n_sets
  FROM b GROUP BY seq, diff_mask
  UNION ALL
  SELECT 'ndiff', CAST(n_diff AS TEXT), MAX(is_chosen), COUNT(*), n_sets
  FROM b GROUP BY seq, n_diff
  UNION ALL
  SELECT 'fresh', CAST(n_fresh AS TEXT), MAX(is_chosen), COUNT(*), n_sets
  FROM b WHERE n_fresh IS NOT NULL GROUP BY seq, n_fresh)
SELECT @game_id, kind, type_key, SUM(chosen), SUM(n * 1.0 / n_sets), COUNT(*)
FROM by_find GROUP BY kind, type_key`;

// The chosen set of each of my finds, with its find time.
const INSERT_FIND_TYPES = `
INSERT INTO my_find_types (game_id, seq, diff_mask, n_diff, n_fresh, elapsed_ms)
SELECT f.game_id, f.seq, s.diff_mask, s.n_diff, b.n_fresh, f.elapsed_ms
FROM my_finds f JOIN board_sets b USING (game_id, seq) JOIN sets s USING (set_id)
WHERE f.game_id = @game_id AND b.is_chosen = 1`;

/**
 * Save one game's set-type totals and my chosen sets' types from its
 * board_sets rows. deriveGame calls this after writing them; the rows must
 * not be there yet (deleting the game's finds clears them).
 */
export function saveSetTypes(db, gameId, stmts = statements(db)) {
  stmts.insertSetTypes.run({ game_id: gameId });
  stmts.insertFindTypes.run({ game_id: gameId });
}

function statements(db) {
  return {
    events: db.prepare("SELECT * FROM events WHERE game_id = ? ORDER BY seq"),
    deleteFinds: db.prepare("DELETE FROM finds WHERE game_id = ?"),
    insertFind: db.prepare(`
      INSERT INTO finds (game_id, seq, user_id, elapsed_ms, board, board_size, n_sets, deck_left)
      VALUES (@game_id, @seq, @user_id, @elapsed_ms, @board, @board_size, @n_sets, @deck_left)
    `),
    insertBoardSet: db.prepare(`
      INSERT INTO board_sets (game_id, seq, set_id, p1, p2, p3, is_chosen, n_fresh)
      VALUES (@game_id, @seq, @set_id, @p1, @p2, @p3, @is_chosen, @n_fresh)
    `),
    insertSetTypes: db.prepare(INSERT_SET_TYPES),
    insertFindTypes: db.prepare(INSERT_FIND_TYPES),
  };
}

/**
 * Replace one normal-mode game's finds, board_sets and set-type totals, in
 * a single transaction. Deleting the finds clears the old totals (cascade,
 * and the finds_clear_set_types trigger).
 */
export function deriveGame(db, game, stmts = statements(db)) {
  if (game.mode !== "normal")
    throw new Error(`derive ${game.game_id}: mode is ${game.mode}`);
  return db.transaction(() => {
    stmts.deleteFinds.run(game.game_id);
    const { finds } = replayGame(game, stmts.events.all(game.game_id));
    let nBoardSets = 0;
    let prevBoard = null;
    for (const f of finds) {
      const sets = boardSets(f.board, setId(f.cards), prevBoard);
      stmts.insertFind.run({
        game_id: game.game_id,
        seq: f.seq,
        user_id: f.user_id,
        elapsed_ms: f.elapsed_ms,
        board: JSON.stringify(f.board),
        board_size: f.board_size,
        n_sets: sets.length,
        deck_left: f.deck_left,
      });
      for (const s of sets)
        stmts.insertBoardSet.run({ game_id: game.game_id, seq: f.seq, ...s });
      nBoardSets += sets.length;
      prevBoard = f.board;
    }
    saveSetTypes(db, game.game_id, stmts);
    return { finds: finds.length, boardSets: nBoardSets };
  })();
}

/**
 * Derive each game. Without `onError` the first failure throws; with it,
 * `onError(game, error)` is called and the rest still run. A failed game
 * keeps no derived rows, so `deriveNew` tries it again next time.
 */
function deriveGames(db, games, onError) {
  const stmts = statements(db);
  const totals = { games: 0, finds: 0, boardSets: 0 };
  for (const game of games) {
    let n;
    try {
      n = deriveGame(db, game, stmts);
    } catch (e) {
      if (!onError) throw e;
      onError(game, e);
      continue;
    }
    totals.games++;
    totals.finds += n.finds;
    totals.boardSets += n.boardSets;
  }
  return totals;
}

/**
 * Drop and rebuild finds, board_sets and the set-type tables for every started normal-mode game,
 * then record derive_version. `neverStarted` counts the games skipped
 * because they never left the lobby. See deriveGames for `onError`.
 */
export function rebuildDerived(db, { onError } = {}) {
  db.transaction(() => {
    setMeta(db, "derive_version", null);
    db.exec(`DROP TABLE IF EXISTS game_set_types;
      DROP TABLE IF EXISTS my_find_types;
      DROP TABLE IF EXISTS board_sets;
      DROP TABLE IF EXISTS finds;`);
    migrate(db);
  })();

  const totals = deriveGames(db, normalGames(db), onError);

  setMeta(db, "derive_version", DERIVE_VERSION);
  return { ...totals, neverStarted: neverStarted(db), full: true };
}

/**
 * Derive only started normal-mode games that have events but no finds yet
 * (new games, and re-synced games whose derived rows the loader cleared).
 * Falls back to a full rebuild if the existing rows came from a different
 * derive_version.
 */
export function deriveNew(db, { onError } = {}) {
  if (getMeta(db, "derive_version") !== String(DERIVE_VERSION))
    return rebuildDerived(db, { onError });
  const games = normalGames(
    db,
    `EXISTS (SELECT 1 FROM events e WHERE e.game_id = g.game_id)
     AND NOT EXISTS (SELECT 1 FROM finds f WHERE f.game_id = g.game_id)`,
  );
  return {
    ...deriveGames(db, games, onError),
    neverStarted: neverStarted(db),
    full: false,
  };
}
