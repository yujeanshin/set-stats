import db from "../lib/db.js";
import { loadAll } from "../lib/load.js";

const loaded = loadAll(db);
console.log(
  `loaded ${loaded.games} games, ${loaded.events} events ` +
    `(${loaded.gamesWithNewEvents} games had new or changed events)`
);
