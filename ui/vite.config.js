import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Served from localhost only; one ~600 kB bundle (MUI + Chart.js) is fine.
    chunkSizeWarningLimit: 1000,
  },
  // Dev server only: forward API calls to bin/ui.js running on 3000.
  server: { proxy: { "/api": "http://localhost:3000" } },
});
