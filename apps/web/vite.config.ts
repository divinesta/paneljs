import { createReadStream, existsSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Plugin, ViteDevServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const docsDist = resolve(here, "../docs/.vitepress/dist");

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function docsMiddleware(): Plugin {
  return {
    name: "paneljs-docs-dev",
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "/";
        if (url !== "/docs" && !url.startsWith("/docs/")) {
          next();
          return;
        }

        const pathname = decodeURIComponent(url.replace(/^\/docs\/?/, ""));
        const relativePath = pathname === "" ? "index.html" : pathname;
        const hasExtension = extname(relativePath) !== "";
        const candidates = hasExtension
          ? [relativePath]
          : [`${relativePath}.html`, join(relativePath, "index.html")];

        for (const candidate of candidates) {
          const filePath = normalize(resolve(docsDist, candidate));
          if (
            !filePath.startsWith(docsDist) ||
            !existsSync(filePath) ||
            !statSync(filePath).isFile()
          ) {
            continue;
          }

          res.statusCode = 200;
          res.setHeader(
            "Content-Type",
            mimeTypes[extname(filePath)] ?? "application/octet-stream",
          );
          createReadStream(filePath).pipe(res);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [docsMiddleware(), react()],
  server: { port: 5173 },
});
