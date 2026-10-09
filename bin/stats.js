// Usage: node bin/stats.js [--drop-breaks] [--keep-bad-timing]
//   --drop-breaks      leave out gaps longer than 50x their game's median gap
//                      from pace and game time (see breakFlags in lib/metrics.js)
//   --keep-bad-timing  keep solo games with a gap under 100 ms, which are
//                      skipped by default (see badTiming in lib/metrics.js)
import { SITES } from "../lib/config.js";
import db from "../lib/db.js";
import { computeState } from "../lib/findTimes.js";
import {
  BREAK_FACTOR,
  INSTANT_GAP_MS,
  badTiming,
  breakFlags,
} from "../lib/metrics.js";

const dropBreaks = process.argv.includes("--drop-breaks");
const keepBadTiming = process.argv.includes("--keep-bad-timing");
let skipped = 0;

// source -> my user id on that site
const UIDS = Object.fromEntries(
  Object.values(SITES).map((s) => [s.source, s.uid]),
);

const rows = db.prepare("SELECT * FROM sync_raw ORDER BY created_at").all();

const games = [];
for (const row of rows) {
  const game = JSON.parse(row.game_json);
  const data = JSON.parse(row.data_json);
  if (!data || !game.startedAt || game.enableHint) continue;

  const mode = game.mode || "normal";
  const UID = UIDS[row.source];
  const { scores, history } = computeState(row.source, data, mode);

  // pace
  const all = [];
  let prev = game.startedAt;
  for (const event of history) {
    if (event.kind) continue;
    all.push({ user: event.user, ms: event.time - prev });
    prev = event.time; // resets on any accepted set
  }
  const solo = Object.keys(game.users).length === 1;
  if (solo && !keepBadTiming && badTiming(all.map((g) => g.ms))) {
    skipped++;
    continue;
  }
  const isBreak = dropBreaks ? breakFlags(all.map((g) => g.ms)) : [];
  const gaps = all
    .filter((g, i) => !isBreak[i] && g.user === UID)
    .map((g) => g.ms);
  const breakTime = all.reduce((t, g, i) => t + (isBreak[i] ? g.ms : 0), 0);

  // per-game summary
  const finished = game.status === "done";
  games.push({
    startedAt: game.startedAt,
    mode,
    variant: solo ? "solo" : "multiplayer",
    finished,
    duration: finished
      ? game.endedAt - game.startedAt - (game.pauseTime ?? 0) - breakTime
      : null,
    sets: scores[UID] ?? 0,
    gaps,
  });
}
games.sort((a, b) => a.startedAt - b.startedAt);

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const secs = (xs) => (xs.length ? (mean(xs) / 1000).toFixed(1) + "s" : "-");

function line(label, list) {
  const finished = list.filter((g) => g.finished);
  console.log(
    `  ${label}: ${finished.length} finished, ` +
      `${list.length - finished.length} unfinished, ` +
      `avg time ${secs(finished.map((g) => g.duration))}, ` +
      `pace ${secs(list.flatMap((g) => g.gaps))}`,
  );
}

const groups = new Map();
for (const g of games) {
  const key = `${g.mode}/${g.variant}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(g);
}

const since30 = new Date();
since30.setHours(0, 0, 0, 0); // starts at local midnight
since30.setDate(since30.getDate() - 30);

if (dropBreaks)
  console.log(
    `breaks dropped: gaps over ${BREAK_FACTOR}x their game's median gap\n`,
  );
if (skipped)
  console.log(
    `skipped ${skipped} solo games with a gap under ${INSTANT_GAP_MS} ms ` +
      `(bad timing; --keep-bad-timing keeps them)\n`,
  );
for (const [key, list] of groups) {
  console.log(key);
  line("all time", list);
  line(
    "last 30 days",
    list.filter((g) => g.startedAt > since30.getTime()),
  );
  line("last 10 finished", list.filter((g) => g.finished).slice(-10));
}
