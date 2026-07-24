import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, "server"), { recursive: true });

for (const entry of [
  "index.html",
  "styles.css",
  "script.js",
  "assets",
  "_redirects",
  "robots.txt",
  "sitemap.xml",
]) {
  await cp(resolve(root, entry), resolve(dist, entry), { recursive: true });
}

await writeFile(resolve(dist, "server/index.js"), `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/") url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  },
};
`);
