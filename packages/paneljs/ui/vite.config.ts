import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/__PANELJS_BASE_PATH__/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
