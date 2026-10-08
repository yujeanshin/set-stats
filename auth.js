import fs from "node:fs";
import { API_KEY } from "./config.js";

const TOKEN_FILE = "token.json";

async function post(url, options) {
  const res = await fetch(url, { method: "POST", ...options });
  if (!res.ok) throw new Error(`auth: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getIdToken() {
  if (!fs.existsSync(TOKEN_FILE)) {
    throw new Error(
      `${TOKEN_FILE} not found. Copy your refresh token from the browser ` +
        `(DevTools > Application > IndexedDB > firebaseLocalStorageDb).`
    );
  }
  const { refreshToken } = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
  const data = await post(
    `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
    {
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );
  fs.writeFileSync(
    TOKEN_FILE,
    JSON.stringify({ refreshToken: data.refresh_token })
  );
  return data.id_token;
}