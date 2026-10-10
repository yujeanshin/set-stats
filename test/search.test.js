import assert from "node:assert/strict";
import { test } from "node:test";
import { gameIdQuery, groupSeries, seriesBase } from "../lib/search.js";

test("gameIdQuery: typed text lowercased, a pasted game URL as its local id", () => {
  assert.equal(gameIdQuery("  Tired-Prop "), "tired-prop");
  assert.equal(gameIdQuery(""), "");
  assert.equal(
    gameIdQuery("https://setwithforks.com/game/Abandoned-Tired-Property"),
    "abandoned-tired-property",
  );
  // The original site's ids get its prefix, with or without www and https.
  assert.equal(
    gameIdQuery("https://www.setwithfriends.com/game/abc-def?x=1#top"),
    "swf:abc-def",
  );
  assert.equal(gameIdQuery("setwithfriends.com/game/abc-def"), "swf:abc-def");
  // This UI's own game page: already a local id, percent-encoded.
  assert.equal(
    gameIdQuery("http://localhost:3000/games/swf%3Aabc-def?dropBreaks=1"),
    "swf:abc-def",
  );
  // A bad escape is kept as typed.
  assert.equal(gameIdQuery("localhost/games/a%zz"), "a%zz");
});

test("seriesBase: a Play again game's series is the id before -N", () => {
  assert.equal(
    seriesBase("abandoned-tired-property"),
    "abandoned-tired-property",
  );
  assert.equal(
    seriesBase("abandoned-tired-property-12"),
    "abandoned-tired-property",
  );
  assert.equal(
    seriesBase("swf:dirty-redundant-mark-3"),
    "swf:dirty-redundant-mark",
  );
  // Only one trailing number; a lone number is not a series.
  assert.equal(seriesBase("a-b-c-2-3"), "a-b-c-2");
  assert.equal(seriesBase("12"), "12");
});

test("groupSeries: one entry per series, the first game as head when it matched", () => {
  const g = (game_id) => ({ game_id });
  // Newest first, as the search query returns them.
  const groups = groupSeries([
    g("x-y-z-2"),
    g("other-game-id"),
    g("x-y-z-1"),
    g("x-y-z"),
    g("p-q-r-5"),
    g("p-q-r-4"),
  ]);
  assert.deepEqual(
    groups.map((s) => [s.base, s.head.game_id, s.games.length]),
    [
      ["x-y-z", "x-y-z", 3], // the newest match comes first
      ["other-game-id", "other-game-id", 1],
      ["p-q-r", "p-q-r-4", 2], // p-q-r didn't match: the oldest match
    ],
  );
  assert.deepEqual(
    groups[0].games.map((x) => x.game_id),
    ["x-y-z-2", "x-y-z-1", "x-y-z"],
  );
  assert.deepEqual(groupSeries([]), []);
});
