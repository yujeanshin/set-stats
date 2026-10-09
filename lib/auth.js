import fs from "node:fs";
import { SITE } from "./config.js";

// Refresh this long before the id token expires, so no request carries a
// token that runs out on the way.
const EARLY_MS = 5 * 60 * 1000;

async function post(url, options) {
  const res = await fetch(url, { method: "POST", ...options });
  if (!res.ok) {
    const text = await res.text();
    const hint = /referer/i.test(text)
      ? ' The site\'s API key only accepts refreshes from its own website; put an "accessToken" in the token file instead (see the README).'
      : "";
    throw new Error(`auth: ${res.status} ${text}${hint}`);
  }
  return res.json();
}

/** Expiry of a JWT in ms, read from its payload (not verified). */
export function jwtExpiry(token) {
  const parts = String(token).split(".");
  let exp;
  try {
    ({ exp } = JSON.parse(Buffer.from(parts[1], "base64url")));
  } catch {
    // not a JWT: wrong field copied, cut off, or extra quotes
  }
  if (parts.length !== 3 || !Number.isFinite(exp))
    throw new Error(
      `accessToken doesn't look like an access token: it should start with ` +
        `"eyJ" and have two dots (this one has ${parts.length - 1}). copy ` +
        `value.stsTokenManager.accessToken again, the whole value.`,
    );
  return exp * 1000;
}

function readTokenFile(site) {
  if (!fs.existsSync(site.tokenFile)) {
    throw new Error(
      `${site.tokenFile} not found. Copy your refresh token from the browser ` +
        `(DevTools > Application > IndexedDB > firebaseLocalStorageDb) on ${site.url}.`,
    );
  }
  return JSON.parse(fs.readFileSync(site.tokenFile, "utf8"));
}

/**
 * Returns a function that resolves to a valid id token for `site`, getting a
 * new one when the current one is about to expire.
 *
 * If the token file has an "accessToken", it is used as is and never
 * refreshed. Once it expires, the file is read again (so a fresh token pasted
 * mid-run is picked up) and, if it is still expired, this throws.
 */
export function tokenSource(site = SITE, now = Date.now) {
  let token = null;
  let renewAt = 0;
  return async function getIdToken() {
    if (token && now() < renewAt) return token;
    const saved = readTokenFile(site);
    if (saved.accessToken) {
      const exp = jwtExpiry(saved.accessToken);
      if (now() >= exp - 30_000) {
        throw new Error(
          `the accessToken in ${site.tokenFile} expired at ` +
            `${new Date(exp).toLocaleString()}. Copy a fresh one from ` +
            `${site.url} (value.stsTokenManager.accessToken) and run the ` +
            `command again; sync continues where it stopped.`,
        );
      }
      token = saved.accessToken;
      renewAt = exp - 30_000;
      return token;
    }
    const data = await post(
      `https://securetoken.googleapis.com/v1/token?key=${site.apiKey}`,
      {
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: saved.refreshToken,
        }),
      },
    );
    fs.writeFileSync(
      site.tokenFile,
      JSON.stringify({ ...saved, refreshToken: data.refresh_token }),
    );
    token = data.id_token;
    renewAt = now() + Number(data.expires_in) * 1000 - EARLY_MS;
    return token;
  };
}

/** Id token for the site selected by SET_SITE. */
export const getIdToken = tokenSource(SITE);
