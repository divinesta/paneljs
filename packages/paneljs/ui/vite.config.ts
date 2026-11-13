import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src")}},
  base: "/__PANELJS_BASE_PATH__/",
  // HTML is rewritten by the host; nested JS/CSS assets resolve relative to their bundle.
  experimental: {
    renderBuiltUrl(_filename, { hostType }) {
      if (hostType === "js" || hostType === "css") return { relative: true };
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
