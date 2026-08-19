import { cp, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, "..");
const docsDist = resolve(webRoot, "../docs/.vitepress/dist");
const target = resolve(webRoot, "dist/docs");

await rm(target, { recursive: true, force: true });
await cp(docsDist, target, { recursive: true });

console.log(`Copied docs to ${target}`);
