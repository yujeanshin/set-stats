import { findSets, setId, sortedSet } from "./cards.js";
import { replayGame } from "./replay.js";
import { getMeta, migrate, setMeta } from "./schema.js";

export const DERIVE_VERSION = 1;

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
  };
}

/** Replace one normal-mode game's finds and board_sets, in a single transaction. */
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
    return { finds: finds.length, boardSets: nBoardSets };
  })();
}

function deriveGames(db, games) {
  const stmts = statements(db);
  const totals = { games: 0, finds: 0, boardSets: 0 };
  for (const game of games) {
    const n = deriveGame(db, game, stmts);
    totals.games++;
    totals.finds += n.finds;
    totals.boardSets += n.boardSets;
  }
  return totals;
}

/** Drop and rebuild finds and board_sets for every normal-mode game, then record derive_version. */
export function rebuildDerived(db) {
  db.transaction(() => {
    setMeta(db, "derive_version", null);
    db.exec("DROP TABLE IF EXISTS board_sets; DROP TABLE IF EXISTS finds;");
    migrate(db);
  })();

  const games = db
    .prepare(
      "SELECT * FROM games WHERE mode = 'normal' ORDER BY created_at, game_id",
    )
    .all();
  const totals = deriveGames(db, games);

  setMeta(db, "derive_version", DERIVE_VERSION);
  return { ...totals, full: true };
}

/**
 * Derive only normal-mode games that have events but no finds yet (new games,
 * and re-synced games whose derived rows the loader cleared). Falls back to a
 * full rebuild if the existing rows came from a different derive_version.
 */
export function deriveNew(db) {
  if (getMeta(db, "derive_version") !== String(DERIVE_VERSION))
    return rebuildDerived(db);
  const games = db
    .prepare(
      `SELECT * FROM games g
       WHERE mode = 'normal'
         AND EXISTS (SELECT 1 FROM events e WHERE e.game_id = g.game_id)
         AND NOT EXISTS (SELECT 1 FROM finds f WHERE f.game_id = g.game_id)
       ORDER BY created_at, game_id`,
    )
    .all();
  return { ...deriveGames(db, games), full: false };
}
