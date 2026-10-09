import { getIdToken } from "../lib/auth.js";
import { DB_URL, UID } from "../lib/config.js";

const token = await getIdToken();
const res = await fetch(`${DB_URL}/users/${UID}/name.json?auth=${token}`);
console.log(res.status, await res.text());