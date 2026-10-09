export const SCHEMA_VERSION = 1;

const DDL = `
  CREATE TABLE IF NOT EXISTS sync_raw (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    status TEXT,
    game_json TEXT,
    data_json TEXT
  );

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
    seed TEXT
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

  CREATE VIEW IF NOT EXISTS my_finds AS
    SELECT * FROM finds
    WHERE user_id = (SELECT value FROM meta WHERE key = 'my_user_id');
`;

function hasTable(db, name) {
  return !!db
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?")
    .get(name);
}

export function setMeta(db, key, value) {
  db.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value == null ? null : String(value));
}

export function getMeta(db, key) {
  return db.prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value;
}

export function migrate(db, { myUserId } = {}) {
  db.transaction(() => {
    // Before schema v1, the sync cache lived in a table named `games`.
    if (!hasTable(db, "sync_raw") && hasTable(db, "games")) {
      const cols = db.prepare("PRAGMA table_info(games)").all();
      if (cols.some((c) => c.name === "game_json")) {
        db.exec("ALTER TABLE games RENAME TO sync_raw");
      }
    }
    db.exec(DDL);
    setMeta(db, "schema_version", SCHEMA_VERSION);
    if (myUserId) setMeta(db, "my_user_id", myUserId);
  })();
}
