import { getIdToken } from "../lib/auth.js";
import { SITE } from "../lib/config.js";

console.log(`${SITE.name} (SET_SITE=${SITE.source})`);
const token = await getIdToken();
const res = await fetch(
  `${SITE.dbUrl}/users/${SITE.uid}/name.json?auth=${token}`,
);
console.log(res.status, await res.text());
