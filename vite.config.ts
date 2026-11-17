import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { researchPublicationPlugin } from "./scripts/research-publication.mjs";
export default defineConfig({
  plugins: [react(), researchPublicationPlugin()],
  base: "./",
  build: { chunkSizeWarningLimit: 1400 },
});
