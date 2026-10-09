import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const DATA_DIR = fileURLToPath(new URL("../data/", import.meta.url));
export const DB_FILE = `${DATA_DIR}games.db`;
export const TOKEN_FILE = `${DATA_DIR}token.json`;

fs.mkdirSync(DATA_DIR, { recursive: true });
