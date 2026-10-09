import Database from "better-sqlite3";
import { ensureLookups } from "../lib/lookups.js";
import { migrate } from "../lib/schema.js";

// Real game "abandoned-tired-property".
export const GAME = {
  game_id: "abandoned-tired-property",
  seed: "v1:ae558bcfbf58e6094261e2a6c56d9e70",
  started_at: 1786983711802,
};

export const OPENING_BOARD = "0120 2210 0110 0111 0210 2011 1211 0220 1100 0112 1102 2022".split(" ");

export const LEFTOVER = "1221 1101 0020 1010 2222 1122".split(" ");

// time c1 c2 c3 -> board_size, n_sets, positions of c1 c2 c3
export const EXPECTED = `
1786983714427 0110 0112 0111 12 3 2,9,3
1786983748781 2200 1102 0001 12 2 2,10,9
1786983750434 2210 0211 1212 12 5 1,9,3
1786983755347 0200 0210 0220 12 2 2,4,7
1786983762863 2011 1100 0222 12 1 5,8,4
1786983765742 2020 1220 0120 12 1 4,1,0
1786983768013 1201 1121 1011 12 3 1,8,0
1786983771081 2100 2211 2022 12 2 7,0,11
1786983806811 1020 2001 0012 12 2 11,9,3
1786983808711 2201 2111 2021 12 2 8,4,11
1786983810433 1120 1002 1211 12 2 7,8,6
1786983817617 1210 2121 0002 12 3 6,9,2
1786983820143 2120 2101 2112 12 2 6,7,11
1786983828245 0000 2002 1001 12 1 4,8,0
1786983831441 1202 0122 2012 12 3 8,1,3
1786983844353 2122 0022 1222 12 2 0,6,11
1786983869782 2221 2010 2102 12 2 2,0,3
1786983873453 1111 1112 1110 12 3 10,0,1
1786983875523 0201 1200 2202 12 2 4,9,3
1786983879117 2220 0101 1012 12 3 7,9,3
1786983888319 0021 0100 0212 12 2 0,11,9
1786983928888 2110 1021 0202 12 1 6,2,3
1786983937210 2212 0121 1000 12 3 2,4,7
1786983939108 0010 0221 0102 12 4 4,7,3
1786983946588 2000 0011 1022  9 2 6,8,2
`
  .trim()
  .split("\n")
  .map((line) => {
    const [time, c1, c2, c3, size, nSets, pos] = line.trim().split(/\s+/);
    return { time: +time, c1, c2, c3, size: +size, nSets: +nSets, pos: pos.split(",").map(Number) };
  });

export const USER = "jgp8PWJfSuRfLypnZwqC4isEYdg2";

/** Fixture events as rows of the events table. */
export const EVENTS = EXPECTED.map((e, seq) => ({
  seq,
  time_ms: e.time,
  user_id: USER,
  c1: e.c1,
  c2: e.c2,
  c3: e.c3,
}));

const pushKey = (i) => `-P-F${String(i).padStart(4, "0")}`;

/** The fixture game as a sync_raw row, the way sync.js stores it. */
export function fixtureRaw() {
  const game = {
    access: "private",
    createdAt: 1786983708208,
    enableHint: false,
    endedAt: 1786983946588,
    host: USER,
    mode: "normal",
    startedAt: GAME.started_at,
    status: "done",
    users: { [USER]: 1786983708344 },
  };
  const events = Object.fromEntries(
    EXPECTED.map((e, i) => [pushKey(i), { c1: e.c1, c2: e.c2, c3: e.c3, time: e.time, user: USER }])
  );
  return {
    id: GAME.game_id,
    created_at: game.createdAt,
    status: game.status,
    game_json: JSON.stringify(game),
    data_json: JSON.stringify({ seed: GAME.seed, events }),
  };
}

export function insertRaw(db, raw) {
  db.prepare(
    `INSERT INTO sync_raw (id, created_at, status, game_json, data_json)
     VALUES (@id, @created_at, @status, @game_json, @data_json)
     ON CONFLICT(id) DO UPDATE SET status = excluded.status,
       game_json = excluded.game_json, data_json = excluded.data_json`
  ).run(raw);
}

/** A fresh in-memory database with the full schema and lookups. */
export function memoryDb() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  migrate(db, { myUserId: USER });
  ensureLookups(db);
  return db;
}

export const count = (db, sql, ...args) => db.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).get(...args).n;
