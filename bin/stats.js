import { UID } from "../lib/config.js";
import db from "../lib/db.js";
import { computeState } from "../vendor/game.js";

const DAY = 24 * 60 * 60 * 1000;
const rows = db.prepare("SELECT * FROM sync_raw ORDER BY created_at").all();

const games = [];
for (const row of rows) {
  const game = JSON.parse(row.game_json);
  const data = JSON.parse(row.data_json);
  if (!data || !game.startedAt || game.enableHint) continue;

  const mode = game.mode || "normal";
  const { scores, history } = computeState(data, mode);

  // pace
  const gaps = [];
  let prev = game.startedAt;
  for (const event of history) {
    if (event.kind) continue;
    if (event.user === UID) gaps.push(event.time - prev);
    prev = event.time; // resets on any accepted set
  }

  // per-game summary
  const finished = game.status === "done";
  games.push({
    createdAt: row.created_at,
    mode,
    variant: Object.keys(game.users).length === 1 ? "solo" : "multiplayer",
    finished,
    duration: finished ? game.endedAt - game.startedAt : null,
    sets: scores[UID] ?? 0,
    gaps,
  });
}

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

for (const [key, list] of groups) {
  console.log(key);
  line("all time", list);
  line(
    "last 30 days",
    list.filter((g) => g.createdAt > Date.now() - 30 * DAY),
  );
  line("last 10 finished", list.filter((g) => g.finished).slice(-10));
}
