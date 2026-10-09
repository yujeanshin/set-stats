// npm run ui: one local server for the JSON API and the built React app.
// The database is opened read-only; this never contacts the site.
import express from "express";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createApi } from "../lib/api.js";
import { openReadOnly, Queries } from "../lib/queries.js";

const PORT = Number(process.env.PORT ?? 3000);
const DIST = fileURLToPath(new URL("../ui/dist/", import.meta.url));

const queries = new Queries(openReadOnly());
const top = queries.modes()[0]?.mode;
if (top) queries.soloGames(top); // warm the cache so the first page is quick

const app = express();
app.use("/api", createApi(queries));
app.use("/api", (req, res) => res.status(404).json({ error: "not found" }));

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  // Any other path belongs to the React router (e.g. /games/:id).
  app.get("/{*splat}", (req, res) => res.sendFile(`${DIST}index.html`));
} else {
  app.get("/{*splat}", (req, res) =>
    res.status(503).type("text").send("UI not built yet. Run: npm run ui"),
  );
}

app.listen(PORT, "127.0.0.1", () => {
  console.log(`set stats UI: http://localhost:${PORT}`);
});
