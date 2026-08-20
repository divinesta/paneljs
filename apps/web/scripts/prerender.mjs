import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = fileURLToPath(new URL(".", import.meta.url));
const appDir = resolve(scriptsDir, "..");
const indexPath = resolve(appDir, "dist/index.html");
const { render } = await import("../dist/server/entry-server.js");
const index = await readFile(indexPath, "utf8");
const html = render();

if (!index.includes('<div id="root"></div>')) {
   throw new Error("Could not find the PanelJS application root in the built HTML.");
}

await writeFile(indexPath, index.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
