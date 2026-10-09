import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { createApi } from "../lib/api.js";
import { rebuildDerived } from "../lib/derive.js";
import { loadAll } from "../lib/load.js";
import { Queries } from "../lib/queries.js";
import { fixtureRaw, GAME, insertRaw, memoryDb } from "./fixture.js";

const DAY = 86_400_000;
const db = memoryDb();
const raw = fixtureRaw();
insertRaw(db, raw);

// Same seed and first 10 events, a day later, hints on, still in progress.
const game = JSON.parse(raw.game_json);
const data = JSON.parse(raw.data_json);
const SECOND = "second-game";
insertRaw(db, {
  id: SECOND,
  created_at: raw.created_at + DAY,
  status: "ingame",
  game_json: JSON.stringify({
    ...game,
    status: "ingame",
    enableHint: true,
    startedAt: game.startedAt + DAY,
    endedAt: undefined,
  }),
  data_json: JSON.stringify({
    seed: data.seed,
    events: Object.fromEntries(
      Object.entries(data.events)
        .slice(0, 10)
        .map(([k, e]) => [k, { ...e, time: e.time + DAY }]),
    ),
  }),
});
loadAll(db);
rebuildDerived(db);

let server;
let base;
before(async () => {
  const app = express().use("/api", createApi(new Queries(db)));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server.close());

async function get(path) {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
}

test("modes: solo modes with counts", async () => {
  const { body } = await get("/modes");
  assert.deepEqual(body, [{ mode: "normal", games: 2 }]);
});

test("summary: filters default to hints off, mode to most played", async () => {
  const { body } = await get("/summary");
  assert.equal(body.mode, "normal");
  assert.equal(body.hintsOff, true);
  assert.equal(body.headline.started, 1);
  assert.equal(body.headline.finished, 1);
  assert.equal(body.headline.fastestMs, 234786);
  assert.deepEqual(body.headline.pace, { n: 1, avg: 9391.44, sd: null });
  assert.equal(body.windows.allTime.paceMs, 9391.44);
  assert.equal(body.windows.last30Days, null);

  const all = (await get("/summary?hintsOff=0")).body;
  assert.equal(all.headline.started, 2);
  assert.equal(all.windows.allTime.unfinished, 1);
  assert.equal(all.headline.pace.n, 2);

  const done = (await get("/summary?hintsOff=0&completedOnly=1")).body;
  assert.equal(done.headline.started, 1);

  const since30 = GAME.started_at + DAY;
  const recent = (await get(`/summary?hintsOff=0&since30=${since30}`)).body;
  assert.equal(recent.windows.last30Days.finished, 0);
  assert.equal(recent.windows.last30Days.unfinished, 1);
  assert.equal(recent.windows.last30Days.avgTimeMs, null);
});

test("calendar: one key per local day, bad zone is a 400", async () => {
  const { body } = await get("/calendar?hintsOff=0&tz=UTC");
  assert.deepEqual(Object.values(body.days), [1, 1]);
  assert.equal(Object.keys(body.days)[0], "2026-08-17");
  const bad = await get("/calendar?tz=Mars/Olympus");
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /time zone/);
});

test("series: range then last N, records over all games, rolling needs X", async () => {
  const both = (await get("/series?hintsOff=0&window=5")).body;
  assert.equal(both.metric, "pace");
  assert.equal(both.points.length, 2);
  assert.equal(both.points[0].game_id, GAME.game_id);
  assert.equal(both.points[0].value, 9391.44);
  assert.equal(both.points[0].record, true); // first finished game is a record
  assert.equal(both.points[1].record, false); // unfinished: never a record
  assert.deepEqual(
    both.points.map((p) => p.rolling),
    [null, null],
  );
  assert.equal(both.summary.n, 2);
  assert.equal(both.summary.change, null);
  assert.equal(both.histogram.bins.length > 0, true);

  const time = (await get("/series?hintsOff=0&metric=time")).body;
  assert.equal(time.points.length, 1); // finished games only
  assert.equal(time.points[0].value, 234786);

  const lastOne = (await get("/series?hintsOff=0&lastN=1")).body;
  assert.deepEqual(
    lastOne.points.map((p) => p.game_id),
    [SECOND],
  );

  const from = GAME.started_at + 1;
  const ranged = (await get(`/series?hintsOff=0&from=${from}&lastN=5`)).body;
  assert.deepEqual(
    ranged.points.map((p) => p.game_id),
    [SECOND],
  );

  assert.equal((await get("/series?window=7")).status, 400);
  assert.equal((await get("/series?avg=mode")).status, 400);
});

test("games: newest first, paged, best game flagged", async () => {
  const { body } = await get("/games?hintsOff=0");
  assert.equal(body.total, 2);
  assert.deepEqual(
    body.games.map((g) => g.game_id),
    [SECOND, GAME.game_id],
  );
  assert.equal(body.bestGameId, GAME.game_id);
  assert.equal(body.games[0].durationMs, null);
  assert.equal(body.games[0].sets, 10);

  const page = (await get("/games?hintsOff=0&offset=1&limit=1")).body;
  assert.deepEqual(
    page.games.map((g) => g.game_id),
    [GAME.game_id],
  );
});

test("games/:id: find times and tiles; unknown id is a 404", async () => {
  const { body } = await get(`/games/${GAME.game_id}`);
  assert.equal(body.sets, 25);
  assert.equal(body.n_players, 1);
  assert.equal(body.findTimes.length, 25);
  assert.equal(body.stats.median, 3671);
  assert.equal(body.stats.min, 1653);
  assert.equal(body.stats.max, 40569);
  assert.equal((await get("/games/no-such-game")).status, 404);
});

test("positions: share of finds per position, normal mode only", async () => {
  const { body } = await get("/positions");
  assert.equal(body.finds, 25); // second game excluded by hints off
  assert.equal(body.shares.length, 12);
  assert.equal(body.beyond, 0); // fixture boards never exceed 12 cards
  // Three picks per find, all at positions < 12, so the shares sum to 3.
  const sum = body.shares.reduce((a, b) => a + b, 0);
  assert.equal(sum.toFixed(9), "3.000000000");
  assert.equal((await get("/positions?hintsOff=0")).body.finds, 35);
  assert.equal((await get("/positions?mode=puzzle")).status, 400);
});
