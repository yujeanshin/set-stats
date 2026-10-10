import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { createApi } from "../lib/api.js";
import { rebuildDerived } from "../lib/derive.js";
import { loadAll } from "../lib/load.js";
import { badTiming } from "../lib/metrics.js";
import { Queries } from "../lib/queries.js";
import { fixtureRaw, GAME, insertRaw, memoryDb } from "./fixture.js";

const DAY = 86_400_000;
const db = memoryDb();
const raw = fixtureRaw();
insertRaw(db, raw);

// The fixture a day later, with its fourth set 5 ms after the third: no one
// finds a set that fast, so its timing is bad. Finished, and 1.5 s faster
// than the fixture, so it would be the fastest game if it counted.
const game = JSON.parse(raw.game_json);
const data = JSON.parse(raw.data_json);
const keys = Object.keys(data.events);
const BAD = "bad-timing-game";
const shift = (t) => t + DAY;
insertRaw(db, {
  id: BAD,
  created_at: raw.created_at + DAY,
  status: "done",
  game_json: JSON.stringify({
    ...game,
    startedAt: shift(game.startedAt),
    endedAt: shift(game.endedAt) - 1500,
  }),
  data_json: JSON.stringify({
    seed: data.seed,
    events: Object.fromEntries(
      keys.map((k, i) => {
        const e = data.events[k];
        const t = i === 3 ? data.events[keys[2]].time + 5 : e.time;
        return [k, { ...e, time: shift(t) - (i >= 4 ? 1500 : 0) }];
      }),
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

const get = async (path) => (await fetch(base + path)).json();

test("badTiming: a gap under 100 ms", () => {
  assert.equal(badTiming([5000, 100, 3000]), false);
  assert.equal(badTiming([5000, 99, 3000]), true);
  assert.equal(badTiming([]), false);
});

test("time stats skip bad-timing games unless skipBadTiming=0", async () => {
  const skip = await get("/summary");
  assert.equal(skip.skipBadTiming, true);
  assert.equal(skip.headline.started, 1);
  assert.equal(skip.headline.fastestMs, 234786);
  assert.equal(skip.windows.allTime.finished, 1);

  const keep = await get("/summary?skipBadTiming=0");
  assert.equal(keep.headline.started, 2);
  assert.equal(keep.headline.fastestMs, 234786 - 1500);

  const series = await get("/series");
  assert.deepEqual(
    series.points.map((p) => p.game_id),
    [GAME.game_id],
  );
  assert.equal((await get("/series?skipBadTiming=0")).points.length, 2);
});

test("the games list and calendar keep them, flagged", async () => {
  const list = await get("/games");
  assert.equal(list.total, 2);
  assert.deepEqual(
    list.games.map((g) => [g.game_id, g.bad_timing]),
    [
      [BAD, true],
      [GAME.game_id, false],
    ],
  );
  // a bad-timing game never gets the best time badge while skipped
  assert.equal(list.bestGameId, GAME.game_id);
  assert.equal((await get("/games?skipBadTiming=0")).bestGameId, BAD);

  const cal = await get("/calendar?tz=UTC&today=2026-10-09");
  assert.equal(cal.total, 2);

  const one = await get(`/games/${BAD}`);
  assert.equal(one.bad_timing, true);
  assert.equal(one.findTimes[3], 5);
});

test("the set types page leaves them out entirely", async () => {
  // Their replayed boards may not be what was on screen, so they are out of
  // every column, not only the find times.
  assert.equal((await get("/types")).finds, 25);
  assert.equal((await get("/types?skipBadTiming=0")).finds, 50);
  // The position heatmap and the trend follow the page (brief-v3 item 8).
  assert.equal((await get("/types/positions")).finds, 25);
  assert.equal((await get("/types/positions?skipBadTiming=0")).finds, 50);
  assert.equal((await get("/types/trend")).games, 1);
  assert.equal((await get("/types/trend?skipBadTiming=0")).games, 2);
});
