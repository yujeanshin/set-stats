import { ALL_CARDS, ALL_SETS } from "./cards.js";

/** Fill the static cards and sets tables. Safe to run any number of times. */
export function ensureLookups(db) {
  const count = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  if (count("cards") === ALL_CARDS.length && count("sets") === ALL_SETS.length) return;

  const insertCard = db.prepare("INSERT OR IGNORE INTO cards (card) VALUES (?)");
  const insertSet = db.prepare(
    `INSERT OR IGNORE INTO sets (set_id, c1, c2, c3, diff_mask)
     VALUES (@set_id, @c1, @c2, @c3, @diff_mask)`
  );
  db.transaction(() => {
    for (const card of ALL_CARDS) insertCard.run(card);
    for (const set of ALL_SETS) insertSet.run(set);
  })();

  if (count("cards") !== ALL_CARDS.length || count("sets") !== ALL_SETS.length) {
    throw new Error(`lookup tables have unexpected rows: ${count("cards")} cards, ${count("sets")} sets`);
  }
}
