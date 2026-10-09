import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { createApi } from "../lib/api.js";
import { rebuildDerived } from "../lib/derive.js";
import { loadAll } from "../lib/load.js";
import { Queries } from "../lib/queries.js";
import {
  EXPECTED,
  fixtureRaw,
  GAME,
  insertRaw,
  memoryDb,
  OPENING_BOARD,
} from "./fixture.js";

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
// A two-player ultraset game: not solo, and not normal mode, so it has no
// finds rows.
const ULTRA = "ultra-game";
insertRaw(db, {
  id: ULTRA,
  created_at: raw.created_at + 2 * DAY,
  status: "done",
  game_json: JSON.stringify({
    ...game,
    mode: "ultraset",
    users: { ...game.users, other: game.createdAt },
    startedAt: game.startedAt + 2 * DAY,
    endedAt: game.endedAt + 2 * DAY,
  }),
  data_json: JSON.stringify({ seed: data.seed, events: {} }),
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
  assert.deepEqual(body, [{ mode: "normal", name: "Normal", games: 2 }]);
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

test("summary and game: dropBreaks removes the fixture's one break", async () => {
  const plain = (await get("/summary")).body;
  const { body } = await get("/summary?dropBreaks=1");
  assert.equal(plain.dropBreaks, false);
  assert.equal(body.dropBreaks, true);
  assert.equal(body.headline.fastestMs, 234786 - 40569);
  assert.equal(body.headline.pace.avg, (9391.44 * 25 - 40569) / 24);

  const game = (await get(`/games/${GAME.game_id}?dropBreaks=1`)).body;
  assert.equal(game.break_ms, 40569);
  assert.equal(game.findTimes.length, 24);
  assert.equal(game.durationMs, 234786 - 40569);
  const before = (await get(`/games/${GAME.game_id}`)).body;
  assert.equal(before.break_ms, null);
  assert.equal(before.findTimes.length, 25);
});

test("calendar: one key per local day, bad zone is a 400", async () => {
  const q = "/calendar?hintsOff=0&tz=UTC";
  const { body } = await get(`${q}&today=2026-10-09`);
  assert.deepEqual(Object.values(body.days), [1, 1]);
  assert.equal(Object.keys(body.days)[0], "2026-08-17");
  assert.equal(body.year, null);
  assert.equal(body.from, "2025-10-10");
  assert.equal(body.to, "2026-10-09");
  assert.equal(body.total, 2);
  assert.deepEqual(body.years, [2026]);
  assert.deepEqual(body.thresholds, [1, 1, 1]);

  // The past year ends today: a year later, both games have dropped out.
  const later = (await get(`${q}&today=2027-08-18`)).body;
  assert.equal(later.total, 0);
  assert.deepEqual(later.days, {});

  const year = (await get(`${q}&year=2026&today=2027-08-18`)).body;
  assert.equal(year.from, "2026-01-01");
  assert.equal(year.to, "2026-12-31");
  assert.equal(year.total, 2);

  assert.equal((await get(`${q}&today=yesterday`)).status, 400);
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
  // The rest of the expected values in brief section 7.
  assert.equal(body.modeName, "Normal");
  assert.equal(body.durationMs, 234786);
  assert.equal((body.stats.mean / 1000).toFixed(2), "9.39");
  assert.equal((body.stats.stdev / 1000).toFixed(2), "11.56");
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

test("games/:id/finds: boards and sets, matched to bars by findSeqs", async () => {
  const { body } = await get(`/games/${GAME.game_id}/finds`);
  assert.equal(body.normalOnly, false);
  assert.equal(body.n_players, 1);
  assert.equal(body.finds.length, 25);
  const [first] = body.finds;
  assert.deepEqual(first.board, OPENING_BOARD);
  assert.equal(first.board_size, 12);
  assert.equal(first.n_sets, 3);
  assert.equal(first.deck_left, 69);
  assert.equal(first.elapsed_ms, 2625);
  assert.equal(first.mine, true);
  for (const [i, f] of body.finds.entries()) {
    assert.equal(f.sets.length, f.n_sets);
    assert.equal(f.sets[0].is_chosen, true, "chosen set comes first");
    assert.equal(f.sets.filter((s) => s.is_chosen).length, 1);
    // positions line up with the board and with the fixture's clicks
    const chosen = f.sets[0];
    chosen.positions.forEach((p, j) =>
      assert.equal(f.board[p], chosen.cards[j]),
    );
    assert.deepEqual(
      chosen.positions.toSorted((a, b) => a - b),
      EXPECTED[i].pos.toSorted((a, b) => a - b),
    );
    assert.equal(chosen.n_fresh == null, i === 0, "n_fresh null only first");
  }
  assert.equal(first.sets[0].diff_mask.length, 4);
  // The one break is shown in the replay, flagged.
  assert.deepEqual(
    body.finds.filter((f) => f.break).map((f) => f.seq),
    [21],
  );

  // Bars with breaks dropped skip seq 21; findSeqs says which find each is.
  const game = (await get(`/games/${GAME.game_id}?dropBreaks=1`)).body;
  assert.equal(game.findSeqs.length, game.findTimes.length);
  const bySeq = new Map(body.finds.map((f) => [f.seq, f]));
  game.findSeqs.forEach((seq, i) =>
    assert.equal(bySeq.get(seq).elapsed_ms, game.findTimes[i]),
  );
  assert.equal(game.findSeqs[21], 22);
});

test("games/:id/finds: other modes are flagged, unknown ids are a 404", async () => {
  const { body } = await get(`/games/${ULTRA}/finds`);
  assert.equal(body.normalOnly, true);
  assert.equal(body.n_players, 2);
  assert.deepEqual(body.finds, []);
  assert.equal((await get("/games/no-such-game/finds")).status, 404);
});
