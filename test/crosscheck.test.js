import Database from "better-sqlite3";
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { STARTED } from "../lib/derive.js";
import { DB_FILE } from "../lib/paths.js";
import { replayGame } from "../lib/replay.js";
import { computeState as forksState } from "../vendor/game.js";
import { computeState as swfState } from "../vendor/setwithfriends/util.js";

const computeState = { forks: forksState, swf: swfState };

const hasData = fs.existsSync(DB_FILE);

const show = (x) => JSON.stringify(x);

/**
 * The first place the replay and the site's code disagree, as a sentence,
 * or null if they agree: a valid event, then the cards left, then the
 * board size.
 */
function firstDifference(mine, theirs) {
  const n = Math.max(mine.events.length, theirs.events.length);
  for (let i = 0; i < n; i++) {
    const [a, b] = [mine.events[i], theirs.events[i]];
    if (show(a) !== show(b))
      return `valid event ${i}: replay ${show(a ?? "none")}, site ${show(b ?? "none")}`;
  }
  if (show(mine.remaining) !== show(theirs.remaining))
    return `cards left: replay ${mine.remaining.length}, site ${theirs.remaining.length} (${show(mine.remaining)} vs ${show(theirs.remaining)})`;
  if (mine.boardSize !== theirs.boardSize)
    return `board size: replay ${mine.boardSize}, site ${theirs.boardSize}`;
  return null;
}

test(
  "replay matches each site's computeState on every local normal game",
  { skip: !hasData && "no data/games.db" },
  (t) => {
    const db = new Database(DB_FILE, { readonly: true });
    // Games that never left the lobby have nothing to replay (see STARTED).
    const games = db
      .prepare(
        `SELECT g.*, r.data_json FROM games g JOIN sync_raw r ON r.id = g.game_id
         WHERE g.mode = 'normal' AND ${STARTED}`,
      )
      .all();
    const skipped = db
      .prepare(
        `SELECT COUNT(*) FROM games WHERE mode = 'normal' AND NOT (${STARTED})`,
      )
      .pluck()
      .get();
    const eventsOf = db.prepare(
      "SELECT * FROM events WHERE game_id = ? ORDER BY seq",
    );

    // Check every game, then report all mismatches together.
    const mismatches = [];
    for (const g of games) {
      let diff;
      try {
        const mine = replayGame(g, eventsOf.all(g.game_id));
        const theirs = computeState[g.source](
          JSON.parse(g.data_json),
          "normal",
        );
        diff = firstDifference(
          {
            events: mine.finds.map((f) => [f.time_ms, f.user_id, ...f.cards]),
            remaining: mine.remaining,
            boardSize: mine.boardSize,
          },
          {
            events: theirs.history.map((e) => [
              e.time,
              e.user,
              e.c1,
              e.c2,
              e.c3,
            ]),
            remaining: theirs.current,
            boardSize: theirs.boardSize,
          },
        );
      } catch (e) {
        diff = `threw: ${e.message}`;
      }
      if (diff) mismatches.push(`${g.game_id} (${g.source}): ${diff}`);
    }
    db.close();

    t.diagnostic(
      `checked ${games.length} games, skipped ${skipped} that never started, ` +
        `${mismatches.length} mismatched`,
    );
    for (const m of mismatches) t.diagnostic(m);
    assert.deepEqual(
      mismatches,
      [],
      `${mismatches.length} of ${games.length} games differ:\n` +
        mismatches.join("\n"),
    );
  },
);
