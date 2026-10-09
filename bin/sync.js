import { getIdToken } from "../lib/auth.js";
import { DB_URL, UID } from "../lib/config.js";
import db from "../lib/db.js";
import { setMeta } from "../lib/schema.js";

const DAY = 24 * 60 * 60 * 1000;
const BATCH = 5;
const token = await getIdToken();

async function read(path) {
  const res = await fetch(`${DB_URL}/${path}.json?auth=${token}`);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const upsert = db.prepare(`
  INSERT INTO sync_raw (id, created_at, status, game_json, data_json)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    game_json = excluded.game_json,
    data_json = excluded.data_json
`);

const userGames = (await read(`userGames/${UID}`)) ?? {};
const known = new Map(
  db.prepare("SELECT id, status FROM sync_raw").all().map((r) => [r.id, r.status])
);

const todo = Object.entries(userGames).filter(([id, createdAt]) => {
  if (!known.has(id)) return true;
  return known.get(id) !== "done" && Date.now() - createdAt < DAY;
});

console.log(`${Object.keys(userGames).length} games on server, ${todo.length} to fetch`);

for (let i = 0; i < todo.length; i += BATCH) {
  await Promise.all(
    todo.slice(i, i + BATCH).map(async ([id, createdAt]) => {
      const key = encodeURIComponent(id);
      const [game, data] = await Promise.all([
        read(`games/${key}`),
        read(`gameData/${key}`),
      ]);
      if (!game) return;
      upsert.run(id, createdAt, game.status, JSON.stringify(game), JSON.stringify(data));
    })
  );
  console.log(`${Math.min(i + BATCH, todo.length)}/${todo.length}`);
}

setMeta(db, "last_sync_at", Date.now());