import assert from "node:assert/strict";
import { test } from "node:test";
import { loadAll } from "../lib/load.js";
import { Queries } from "../lib/queries.js";
import { setMeta } from "../lib/schema.js";
import { generateDeck, makeRandom } from "../vendor/game.js";
import { GAME, USER, fixtureRaw, insertRaw, memoryDb } from "./fixture.js";

test("each game's find times use my user id on that game's site", () => {
  const db = memoryDb();
  setMeta(db, "my_user_id:swf", "me-swf");
  const raw = fixtureRaw();
  insertRaw(db, raw);
  // the same game on the original site: explicit deck, my other user id
  const data = JSON.parse(raw.data_json.replaceAll(USER, "me-swf"));
  insertRaw(db, {
    ...raw,
    id: "swf:copy",
    source: "swf",
    data_json: JSON.stringify({
      deck: generateDeck("normal", makeRandom(data.seed)),
      events: data.events,
    }),
  });
  loadAll(db);

  const queries = new Queries(db);
  assert.deepEqual(queries.myUserIds, { forks: USER, swf: "me-swf" });
  const games = queries.soloGames("normal");
  assert.deepEqual(
    games.map((g) => [g.game_id, g.source, g.findTimes.length]),
    [
      [GAME.game_id, "forks", 25],
      ["swf:copy", "swf", 25],
    ],
  );
  assert.deepEqual(games[1].findTimes, games[0].findTimes);
  assert.equal("deck" in games[1], false);
});
