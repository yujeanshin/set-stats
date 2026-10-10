import { DATA_DIR } from "./paths.js";

// One profile per site. SET_SITE picks the site that sync and check talk to;
// everything else reads both sites from the local database.
//   source       stored in sync_raw.source and games.source
//   idPrefix     prepended to the site's game ids so ids from both sites can share tables
//   functionsUrl cloud functions base url, or null if the site doesn't archive game data
//   concurrency  games fetched at once
//   maxRequests  requests in flight at once (Infinity: no extra limit)
export const SITES = {
  forks: {
    source: "forks",
    name: "Set with Forks",
    url: "https://setwithforks.com",
    apiKey: "AIzaSyDJbrpSFlmr2D9r9HS0UiFkw_Qk7wlY0lA",
    dbUrl: "https://setwithforks-dev-default-rtdb.firebaseio.com",
    functionsUrl: null,
    uid: "jgp8PWJfSuRfLypnZwqC4isEYdg2",
    tokenFile: `${DATA_DIR}token.json`,
    idPrefix: "",
    concurrency: 5,
    maxRequests: Infinity,
  },
  swf: {
    source: "swf",
    name: "Set with Friends",
    url: "https://setwithfriends.com",
    // "production" block of src/config.js in ekzhang/setwithfriends
    apiKey: "AIzaSyCeKQ4rauZ_fq1rEIPJ8m5XfppwjtmTZBY",
    dbUrl: "https://setwithfriends.firebaseio.com",
    // default region of firebase-functions v1
    functionsUrl: "https://us-central1-setwithfriends.cloudfunctions.net",
    uid: "qhoyZFZGoggQOabbrNUO9MeyFh83",
    tokenFile: `${DATA_DIR}token-swf.json`,
    idPrefix: "swf:",
    concurrency: 2,
    maxRequests: 2,
  },
};

/** The site's own game id for a local game id. */
export function remoteId(site, localId) {
  if (!localId.startsWith(site.idPrefix))
    throw new Error(`${localId} is not a ${site.name} game id`);
  return localId.slice(site.idPrefix.length);
}

/** The local game id (sync_raw.id, games.game_id) for one of the site's game ids. */
export const localId = (site, id) => site.idPrefix + id;

const name = process.env.SET_SITE || "forks";
if (!Object.hasOwn(SITES, name))
  throw new Error(
    `SET_SITE must be one of ${Object.keys(SITES).join(", ")}, not "${name}"`,
  );

/** The site selected by SET_SITE (default forks). */
export const SITE = SITES[name];
