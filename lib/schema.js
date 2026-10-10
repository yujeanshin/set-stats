export const SCHEMA_VERSION = 4;

const DDL = `
  CREATE TABLE IF NOT EXISTS sync_raw (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    status TEXT,
    game_json TEXT,
    data_json TEXT,
    source TEXT NOT NULL DEFAULT 'forks'
  );

  -- games sync gave up on: the site has no data for them (fetchStaleGame
  -- found no archived copy). sync never asks for these again.
  CREATE TABLE IF NOT EXISTS sync_skipped (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    reason TEXT NOT NULL,
    skipped_at INTEGER NOT NULL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT
  ) STRICT;

  -- raw

  CREATE TABLE IF NOT EXISTS games (
    game_id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    status TEXT NOT NULL,
    access TEXT,
    enable_hint INTEGER NOT NULL,
    host_id TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    ended_at INTEGER,
    pause_time_ms INTEGER,
    n_players INTEGER NOT NULL,
    seed TEXT,
    source TEXT NOT NULL DEFAULT 'forks',
    deck TEXT
  ) STRICT;

  CREATE INDEX IF NOT EXISTS games_mode ON games (mode);

  CREATE TABLE IF NOT EXISTS events (
    game_id TEXT NOT NULL REFERENCES games (game_id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    push_key TEXT NOT NULL,
    time_ms INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    c1 TEXT NOT NULL,
    c2 TEXT NOT NULL,
    c3 TEXT NOT NULL,
    c4 TEXT,
    c5 TEXT,
    c6 TEXT,
    PRIMARY KEY (game_id, seq),
    UNIQUE (game_id, push_key)
  ) STRICT;

  -- static lookups

  CREATE TABLE IF NOT EXISTS cards (
    card TEXT PRIMARY KEY CHECK (card GLOB '[0-2][0-2][0-2][0-2]'),
    color INTEGER GENERATED ALWAYS AS (CAST(substr(card, 1, 1) AS INTEGER)) VIRTUAL,
    shape INTEGER GENERATED ALWAYS AS (CAST(substr(card, 2, 1) AS INTEGER)) VIRTUAL,
    shade INTEGER GENERATED ALWAYS AS (CAST(substr(card, 3, 1) AS INTEGER)) VIRTUAL,
    number INTEGER GENERATED ALWAYS AS (CAST(substr(card, 4, 1) AS INTEGER)) VIRTUAL
  ) STRICT;

  CREATE TABLE IF NOT EXISTS sets (
    set_id TEXT PRIMARY KEY,
    c1 TEXT NOT NULL REFERENCES cards (card),
    c2 TEXT NOT NULL REFERENCES cards (card),
    c3 TEXT NOT NULL REFERENCES cards (card),
    diff_mask TEXT NOT NULL CHECK (diff_mask GLOB '[01][01][01][01]'),
    n_diff INTEGER GENERATED ALWAYS AS (length(replace(diff_mask, '0', ''))) VIRTUAL,
    CHECK (c1 < c2 AND c2 < c3),
    CHECK (set_id = c1 || '-' || c2 || '-' || c3)
  ) STRICT;

  -- derived (normal mode only, rebuilt by replay)

  CREATE TABLE IF NOT EXISTS finds (
    game_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    elapsed_ms INTEGER NOT NULL,
    board TEXT NOT NULL,
    board_size INTEGER NOT NULL,
    n_sets INTEGER NOT NULL,
    deck_left INTEGER NOT NULL,
    PRIMARY KEY (game_id, seq),
    FOREIGN KEY (game_id, seq) REFERENCES events (game_id, seq) ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX IF NOT EXISTS finds_user ON finds (user_id);

  CREATE TABLE IF NOT EXISTS board_sets (
    game_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    set_id TEXT NOT NULL REFERENCES sets (set_id),
    p1 INTEGER NOT NULL,
    p2 INTEGER NOT NULL,
    p3 INTEGER NOT NULL,
    is_chosen INTEGER NOT NULL CHECK (is_chosen IN (0, 1)),
    n_fresh INTEGER,
    PRIMARY KEY (game_id, seq, set_id),
    FOREIGN KEY (game_id, seq) REFERENCES finds (game_id, seq) ON DELETE CASCADE
  ) STRICT;

  CREATE INDEX IF NOT EXISTS board_sets_set ON board_sets (set_id);

  -- derived set-type totals (Set types page), over my finds only: saved so
  -- the page doesn't join finds to board_sets on every request

  -- per game and type: picks (O), expected (E) and present. kind 'mask' is
  -- keyed by diff_mask, 'ndiff' by n_diff, 'fresh' by n_fresh (as text);
  -- 'fresh' leaves out each game's first find
  CREATE TABLE IF NOT EXISTS game_set_types (
    game_id TEXT NOT NULL REFERENCES games (game_id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('mask', 'ndiff', 'fresh')),
    type_key TEXT NOT NULL,
    picks INTEGER NOT NULL,
    expected REAL NOT NULL,
    present INTEGER NOT NULL,
    PRIMARY KEY (game_id, kind, type_key)
  ) STRICT, WITHOUT ROWID;

  -- the chosen set's type and the find time, one row per find of mine
  CREATE TABLE IF NOT EXISTS my_find_types (
    game_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    diff_mask TEXT NOT NULL,
    n_diff INTEGER NOT NULL,
    n_fresh INTEGER,
    elapsed_ms INTEGER NOT NULL,
    PRIMARY KEY (game_id, seq),
    FOREIGN KEY (game_id, seq) REFERENCES finds (game_id, seq) ON DELETE CASCADE
  ) STRICT, WITHOUT ROWID;

  -- game_set_types has no row per find to cascade from, so removing a
  -- game's finds (derive, or the loader replacing its events) clears it
  CREATE TRIGGER IF NOT EXISTS finds_clear_set_types AFTER DELETE ON finds
  BEGIN
    DELETE FROM game_set_types WHERE game_id = OLD.game_id;
  END;
`;

// Recreated on every migrate, so an older definition is replaced.
// The unary + keeps SQLite from driving my_finds through finds_user: joined
// to a filtered games table, that scanned all my finds once per game.
const VIEWS = `
  DROP VIEW IF EXISTS my_finds;
  CREATE VIEW my_finds AS
    SELECT f.* FROM finds f JOIN games g ON g.game_id = f.game_id
    WHERE +f.user_id = (SELECT value FROM meta WHERE key =
      'my_user_id' || CASE g.source WHEN 'forks' THEN '' ELSE ':' || g.source END);
`;

// Columns added after schema v1, as [table, column, definition]. New
// databases get them from DDL; older ones get them here, at the end of the
// table, which is where DDL puts them too.
const ADDED_COLUMNS = [
  ["sync_raw", "source", "TEXT NOT NULL DEFAULT 'forks'"],
  ["games", "source", "TEXT NOT NULL DEFAULT 'forks'"],
  ["games", "deck", "TEXT"],
];

function hasTable(db, name) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
    .get(name);
}

function hasColumn(db, table, column) {
  return db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .some((c) => c.name === column);
}

/** The meta key holding my user id on one site: my_user_id for forks, my_user_id:<source> otherwise. */
export const myUserKey = (source) =>
  source === "forks" ? "my_user_id" : `my_user_id:${source}`;

export function setMeta(db, key, value) {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value == null ? null : String(value));
}

export function getMeta(db, key) {
  return db.prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value;
}

/**
 * Create or upgrade every table. `myUserIds` maps source -> my user id on
 * that site; `myUserId` is shorthand for the forks one.
 */
export function migrate(db, { myUserId, myUserIds = {} } = {}) {
  db.transaction(() => {
    // Before schema v1, the sync cache lived in a table named `games`.
    if (!hasTable(db, "sync_raw") && hasTable(db, "games")) {
      const cols = db.prepare("PRAGMA table_info(games)").all();
      if (cols.some((c) => c.name === "game_json")) {
        db.exec("ALTER TABLE games RENAME TO sync_raw");
      }
    }
    db.exec(DDL);
    for (const [table, column, def] of ADDED_COLUMNS) {
      if (!hasColumn(db, table, column))
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    }
    db.exec(VIEWS);
    setMeta(db, "schema_version", SCHEMA_VERSION);
    const ids = { ...(myUserId && { forks: myUserId }), ...myUserIds };
    for (const [source, id] of Object.entries(ids))
      if (id) setMeta(db, myUserKey(source), id);
  })();
}
