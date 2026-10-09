import Database from "better-sqlite3";
import { UID } from "./config.js";
import { migrate } from "./lib/schema.js";

export function openDb(file = "games.db") {
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  migrate(db, { myUserId: UID });
  return db;
}

const db = openDb();

export default db;
