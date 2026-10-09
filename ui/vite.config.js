import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { SITES } from "../lib/config.js";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Served from localhost only; one ~600 kB bundle (MUI + Chart.js) is fine.
    chunkSizeWarningLimit: 1000,
  },
  // Site names and urls for links to games (src/gameUrl.js). Only these
  // fields: the rest of the config (keys, user ids) stays out of the bundle.
  define: {
    __SITES__: JSON.stringify(
      Object.values(SITES).map(({ source, name, url, idPrefix }) => ({
        source,
        name,
        url,
        idPrefix,
      })),
    ),
  },
  // Dev server only: forward API calls to bin/ui.js running on 3000.
  server: { proxy: { "/api": "http://localhost:3000" } },
});
