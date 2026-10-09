// Usage: node bin/rebuild.js [--new]
//   default  load raw data, then drop and rebuild all derived tables
//   --new    load raw data, then derive only games without derived rows yet
import db from "../lib/db.js";
import { deriveNew, rebuildDerived } from "../lib/derive.js";
import { loadAll } from "../lib/load.js";

const onlyNew = process.argv.includes("--new");

const loaded = loadAll(db);
console.log(
  `loaded ${loaded.games} games, ${loaded.events} events ` +
    `(${loaded.gamesWithNewEvents} games had new or changed events)`,
);

const derived = onlyNew ? deriveNew(db) : rebuildDerived(db);
if (onlyNew && derived.full)
  console.log("derive_version changed or missing; did a full rebuild instead");
console.log(
  `derived ${derived.finds} finds and ${derived.boardSets} board sets ` +
    `from ${derived.games} normal games`,
);
