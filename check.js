import { getIdToken } from "./auth.js";
import { DB_URL, UID } from "./config.js";

const token = await getIdToken();
const res = await fetch(`${DB_URL}/users/${UID}/name.json?auth=${token}`);
console.log(res.status, await res.text());