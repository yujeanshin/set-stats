import assert from "node:assert/strict";
import { test } from "node:test";
import { SITES, gameIdQuery, localId, remoteId } from "../lib/config.js";

test("original-site game ids get the swf: prefix, fork ids are unchanged", () => {
  assert.equal(localId(SITES.swf, "abc-def"), "swf:abc-def");
  assert.equal(remoteId(SITES.swf, "swf:abc-def"), "abc-def");
  assert.equal(localId(SITES.forks, "abc-def"), "abc-def");
  assert.equal(remoteId(SITES.forks, "abc-def"), "abc-def");
  assert.throws(() => remoteId(SITES.swf, "abc-def"), /not a Set with Friends/);
});

test("the prefix cannot collide with a site's own ids", () => {
  // createGame in ekzhang/setwithfriends only accepts [a-zA-Z0-9_-] ids
  assert.doesNotMatch(SITES.swf.idPrefix, /^[a-zA-Z0-9_-]*$/);
  assert.notEqual(SITES.swf.source, SITES.forks.source);
});

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
