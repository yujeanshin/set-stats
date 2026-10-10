// Usage: node bin/rebuild.js [--new]
//   default  load raw data, then drop and rebuild all derived tables
//   --new    load raw data, then derive only games without derived rows yet
// A game that fails to replay is reported and skipped; the rest still run.
// Either way it ends by saving meta.last_rebuild_at, the "Data updated"
// time in the web UI's header: what the UI shows changes here, not at sync.
import db from "../lib/db.js";
import { deriveNew, rebuildDerived } from "../lib/derive.js";
import { loadAll } from "../lib/load.js";
import { setMeta } from "../lib/schema.js";

const onlyNew = process.argv.includes("--new");

const loaded = loadAll(db);
console.log(
  `loaded ${loaded.games} games, ${loaded.events} events ` +
    `(${loaded.gamesWithNewEvents} games had new or changed events)`,
);

const failed = [];
function onError(game, error) {
  failed.push(game);
  const day = new Date(game.started_at ?? game.created_at)
    .toISOString()
    .slice(0, 10);
  console.log(`  failed (${day}): ${error.message}`);
}

const derived = onlyNew
  ? deriveNew(db, { onError })
  : rebuildDerived(db, { onError });
if (onlyNew && derived.full)
  console.log("derive_version changed or missing; did a full rebuild instead");
console.log(
  `derived ${derived.finds} finds and ${derived.boardSets} board sets ` +
    `from ${derived.games} normal games`,
);
if (derived.neverStarted)
  console.log(
    `skipped ${derived.neverStarted} normal games that never started (no deck to replay)`,
  );
if (failed.length) {
  const bySource = Object.groupBy(failed, (g) => g.source);
  console.log(
    `${failed.length} games failed to replay (` +
      Object.entries(bySource)
        .map(([source, games]) => `${source}: ${games.length}`)
        .join(", ") +
      "). they have no finds or board_sets rows; rebuild:new retries them.",
  );
}
setMeta(db, "last_rebuild_at", Date.now());
