import Database from "better-sqlite3";
import { UID } from "./config.js";
import { ensureLookups } from "./lookups.js";
import { DB_FILE } from "./paths.js";
import { migrate } from "./schema.js";

export function openDb(file = DB_FILE) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db, { myUserId: UID });
  ensureLookups(db);
  return db;
}

const db = openDb();

export default db;
