import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "outputs");
const destination = join(root, "vercel-dist");
const frontendFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "runtime-config.js",
  "cyberpunk_card.glb"
];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const file of frontendFiles) {
  await copyFile(join(source, file), join(destination, file));
}

await cp(join(source, "assets"), join(destination, "assets"), { recursive: true });

