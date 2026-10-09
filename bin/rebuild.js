import db from "../lib/db.js";
import { rebuildDerived } from "../lib/derive.js";
import { loadAll } from "../lib/load.js";

const loaded = loadAll(db);
console.log(
  `loaded ${loaded.games} games, ${loaded.events} events ` +
    `(${loaded.gamesWithNewEvents} games had new or changed events)`
);

const derived = rebuildDerived(db);
console.log(
  `derived ${derived.finds} finds and ${derived.boardSets} board sets ` +
    `from ${derived.games} normal games`
);
