import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import { jwtExpiry, tokenSource } from "../lib/auth.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "set-stats-auth-"));
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function site(contents) {
  const tokenFile = path.join(dir, `token-${Math.random()}.json`);
  fs.writeFileSync(tokenFile, JSON.stringify(contents));
  return {
    name: "Test",
    url: "https://example.test",
    apiKey: "key",
    tokenFile,
  };
}

const jwt = (expMs) =>
  [
    "h",
    Buffer.from(JSON.stringify({ exp: expMs / 1000 })).toString("base64url"),
    "s",
  ].join(".");

test("jwtExpiry reads exp in ms", () => {
  assert.equal(jwtExpiry(jwt(1_700_000_000_000)), 1_700_000_000_000);
});

test("jwtExpiry explains a value that isn't a JWT", () => {
  for (const bad of ["AMf-not-a-jwt", "eyJabc", "a.b.c", ""])
    assert.throws(() => jwtExpiry(bad), /doesn't look like an access token/);
});

test("an accessToken is used directly until it expires, then throws", async () => {
  let clock = 1_000_000;
  const token = jwt(clock + 3_600_000);
  globalThis.fetch = () => assert.fail("must not refresh");
  const get = tokenSource(site({ accessToken: token }), () => clock);
  assert.equal(await get(), token);
  clock += 3_000_000;
  assert.equal(await get(), token);
  clock += 600_000;
  await assert.rejects(get(), /accessToken in .* expired/);
});

test("a refresh token is exchanged again shortly before the id token expires", async () => {
  let clock = 0;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({
      id_token: `id-${calls}`,
      refresh_token: `refresh-${calls}`,
      expires_in: "3600",
    });
  };
  const s = site({ refreshToken: "refresh-0" });
  const get = tokenSource(s, () => clock);
  assert.equal(await get(), "id-1");
  clock = 50 * 60 * 1000;
  assert.equal(await get(), "id-1");
  clock = 56 * 60 * 1000;
  assert.equal(await get(), "id-2");
  assert.equal(calls, 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(s.tokenFile, "utf8")), {
    refreshToken: "refresh-2",
  });
});

test("a refresh rejected for its referer points to accessToken", async () => {
  globalThis.fetch = async () =>
    new Response("Requests from referer <empty> are blocked.", {
      status: 403,
    });
  const get = tokenSource(site({ refreshToken: "r" }));
  await assert.rejects(get(), /auth: 403 .*"accessToken"/);
});
