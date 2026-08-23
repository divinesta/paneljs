import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = fileURLToPath(new URL(".", import.meta.url));
const appDir = resolve(scriptsDir, "..");
const indexPath = resolve(appDir, "dist/index.html");
const { render, blogPaths } = await import("../dist/server/entry-server.js");
const index = await readFile(indexPath, "utf8");

if (!index.includes('<div id="root"></div>')) {
   throw new Error("Could not find the PanelJS application root in the built HTML.");
}

const writePage = async (url, outFile) => {
   const html = render(url);
   await mkdir(dirname(outFile), { recursive: true });
   await writeFile(outFile, index.replace('<div id="root"></div>', `<div id="root">${html}</div>`));
};

await writePage("/", indexPath);
for (const url of blogPaths()) {
   const relative = url === "/blog" ? "blog/index.html" : `${url.replace(/^\//, "")}/index.html`;
   await writePage(url, resolve(appDir, "dist", relative));
}
