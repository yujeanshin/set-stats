import assert from "node:assert/strict";
import { test } from "node:test";
import { SITES } from "../lib/config.js";
import { fetchGame, gamesToFetch, limitConcurrency } from "../lib/sync.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

test("gamesToFetch: new games, plus unfinished ones under a day old, newest first, with the site's prefix", () => {
  const userGames = { old: 1 * DAY, mid: 50 * DAY, recent: NOW - 1000 };
  const swf = gamesToFetch(SITES.swf, userGames, new Map(), NOW);
  assert.deepEqual(
    swf.map(([id]) => id),
    ["swf:recent", "swf:mid", "swf:old"],
  );
  const known = new Map([
    ["swf:old", "done"],
    ["swf:mid", "ingame"],
    ["swf:recent", "ingame"],
  ]);
  assert.deepEqual(
    gamesToFetch(SITES.swf, userGames, known, NOW).map(([id]) => id),
    ["swf:recent"],
  );
  // forks ids are not prefixed, so swf rows don't count as known there
  assert.equal(gamesToFetch(SITES.forks, userGames, known, NOW).length, 3);
});

/** A fake site: `db` maps paths to values; fetchStaleGame moves `archive` into it. */
function fakeSite(db, archive = {}) {
  const log = [];
  return {
    log,
    read: async (path) => {
      log.push(`read ${path}`);
      return db[path] ?? null;
    },
    call: async (name, { gameId }) => {
      log.push(`call ${name} ${gameId}`);
      const data = archive[gameId];
      if (data) db[`gameData/${gameId}`] = data;
      return { restored: !!data };
    },
  };
}

const DATA = { deck: ["0000"], events: {} };

test("an archived finished game is restored, read again and stored", async () => {
  const site = fakeSite({ "games/g1": { status: "done" } }, { g1: DATA });
  const r = await fetchGame(SITES.swf, "swf:g1", 5, site);
  assert.deepEqual(site.log, [
    "read games/g1",
    "read gameData/g1",
    "call fetchStaleGame g1",
    "read gameData/g1",
  ]);
  assert.equal(r.restored, true);
  assert.deepEqual(r.row, {
    id: "swf:g1",
    created_at: 5,
    status: "done",
    game_json: JSON.stringify({ status: "done" }),
    data_json: JSON.stringify(DATA),
    source: "swf",
  });
});

test("an unfinished game that was started is restored too", async () => {
  const site = fakeSite({ "games/g1": { status: "ingame" } }, { g1: DATA });
  const r = await fetchGame(SITES.swf, "swf:g1", 5, site);
  assert.equal(r.restored, true);
  assert.equal(r.row.data_json, JSON.stringify(DATA));
});

test("a game whose data can't be restored is not stored", async () => {
  const site = fakeSite({ "games/g1": { status: "done" } });
  const r = await fetchGame(SITES.swf, "swf:g1", 5, site);
  assert.equal(r.restored, false);
  assert.equal(r.row, null);
  assert.equal(site.log.length, 3); // no second read
});

test("no restore when the data is there, or the game never started", async () => {
  for (const [game, data] of [
    [{ status: "done" }, DATA],
    [{ status: "waiting" }, null],
  ]) {
    const site = fakeSite({ "games/g1": game, "gameData/g1": data });
    const r = await fetchGame(SITES.swf, "swf:g1", 5, site);
    assert.equal(r.restored, null);
    assert.equal(r.row.data_json, JSON.stringify(data));
    assert.ok(!site.log.some((l) => l.startsWith("call")));
  }
});

test("forks never calls a function and stores missing data as before", async () => {
  const site = fakeSite({ "games/g1": { status: "done" } }, { g1: DATA });
  const r = await fetchGame(SITES.forks, "g1", 5, site);
  assert.deepEqual(site.log, ["read games/g1", "read gameData/g1"]);
  assert.equal(r.row.data_json, "null");
  assert.equal(r.row.source, "forks");
});

test("a game missing from games/ is skipped", async () => {
  const site = fakeSite({});
  const r = await fetchGame(SITES.swf, "swf:g1", 5, site);
  assert.equal(r.row, null);
  assert.equal(r.restored, null);
});

test("limitConcurrency never runs more than n at once", async () => {
  let active = 0;
  let peak = 0;
  const run = limitConcurrency(2, async (ms) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, ms));
    active--;
    return ms;
  });
  const out = await Promise.all([5, 1, 3, 1, 2, 4, 1].map(run));
  assert.deepEqual(out, [5, 1, 3, 1, 2, 4, 1]);
  assert.equal(peak, 2);
});
