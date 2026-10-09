// Usage: node bin/sync.js [--limit N]
//   downloads new games from the site selected by SET_SITE (default forks)
//   --limit N  fetch at most N games this run (newest first); run again for more
import { getIdToken } from "../lib/auth.js";
import { SITE } from "../lib/config.js";
import db from "../lib/db.js";
import { setMeta } from "../lib/schema.js";
import { fetchGame, gamesToFetch, limitConcurrency } from "../lib/sync.js";

function parseLimit(argv) {
  const i = argv.indexOf("--limit");
  if (i === -1) return null;
  const n = Number(argv[i + 1]);
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`--limit needs a positive whole number`);
  return n;
}
const limit = parseLimit(process.argv);

const request = limitConcurrency(SITE.maxRequests, async (url, options) => {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
});

async function read(path) {
  const url = `${SITE.dbUrl}/${path}.json?auth=${await getIdToken()}`;
  return request(url).catch((e) => {
    throw new Error(`${path}: ${e.message}`);
  });
}

// A Firebase callable function: POST {data}, answer {result} or {error}.
async function call(name, data) {
  const body = await request(`${SITE.functionsUrl}/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getIdToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
  }).catch((e) => {
    throw new Error(`${name}: ${e.message}`);
  });
  if (body.error) throw new Error(`${name}: ${JSON.stringify(body.error)}`);
  return body.result;
}

const upsert = db.prepare(`
  INSERT INTO sync_raw (id, created_at, status, game_json, data_json, source)
  VALUES (@id, @created_at, @status, @game_json, @data_json, @source)
  ON CONFLICT(id) DO UPDATE SET
    status = excluded.status,
    game_json = excluded.game_json,
    data_json = excluded.data_json
`);

console.log(`syncing from ${SITE.name} (SET_SITE=${SITE.source})`);
const userGames = (await read(`userGames/${SITE.uid}`)) ?? {};
const known = new Map(
  db
    .prepare("SELECT id, status FROM sync_raw WHERE source = ?")
    .all(SITE.source)
    .map((r) => [r.id, r.status]),
);
const skipped = new Set(
  db
    .prepare("SELECT id FROM sync_skipped WHERE source = ?")
    .pluck()
    .all(SITE.source),
);
const skip = db.prepare(
  `INSERT OR IGNORE INTO sync_skipped (id, source, reason, skipped_at)
   VALUES (?, ?, ?, ?)`,
);
const all = gamesToFetch(SITE, userGames, known, Date.now(), skipped);
const todo = limit == null ? all : all.slice(0, limit);

console.log(
  `${Object.keys(userGames).length} games on server, ${all.length} to fetch` +
    (todo.length < all.length ? `, fetching ${todo.length} this run` : ""),
);

let restored = 0;
const missing = [];
const gone = [];
const BATCH = SITE.concurrency;
for (let i = 0; i < todo.length; i += BATCH) {
  await Promise.all(
    todo.slice(i, i + BATCH).map(async ([id, createdAt]) => {
      const r = await fetchGame(SITE, id, createdAt, { read, call });
      if (r.restored) restored++;
      if (r.row) upsert.run(r.row);
      else if (r.restored === false) {
        skip.run(id, SITE.source, "no archived data", Date.now());
        gone.push(id);
      } else if (r.restored != null) missing.push(id);
    }),
  );
  console.log(`${Math.min(i + BATCH, todo.length)}/${todo.length}`);
}

if (SITE.functionsUrl) {
  console.log(`restored ${restored} archived games`);
  if (gone.length)
    console.log(
      `${gone.length} games have no data on the site (no archived copy). ` +
        `they were left out and recorded in sync_skipped, so sync won't ` +
        `ask for them again:\n  ` +
        gone.join("\n  "),
    );
  if (skipped.size)
    console.log(`${skipped.size} games skipped as recorded in sync_skipped`);
  if (missing.length)
    console.log(
      `${missing.length} games were restored by the site but still had no ` +
        `data. they were not stored; the next sync tries again:\n  ` +
        missing.join("\n  "),
    );
}
setMeta(db, "last_sync_at", Date.now());
