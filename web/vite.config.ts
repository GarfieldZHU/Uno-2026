import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "web",
  plugins: [react()],
  server: {
    port: 1411,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
