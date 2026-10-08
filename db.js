import Database from "better-sqlite3";

const db = new Database("games.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    status TEXT,
    game_json TEXT,
    data_json TEXT
  )
`);

export default db;