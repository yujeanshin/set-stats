import assert from "node:assert/strict";
import { test } from "node:test";
import { SITES, localId, remoteId } from "../lib/config.js";

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
