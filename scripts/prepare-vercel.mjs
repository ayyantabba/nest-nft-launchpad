import { createHash } from "node:crypto";
import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const source = join(root, "outputs");
const destination = join(root, "vercel-dist");
const frontendFiles = [
  "index.html",
  "app.js",
  "styles.css",
  "runtime-config.js",
  "robots.txt",
  "sitemap.xml",
  "cyberpunk_card.glb"
];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const file of frontendFiles) {
  await copyFile(join(source, file), join(destination, file));
}

await cp(join(source, "assets"), join(destination, "assets"), { recursive: true });

const integrity = async (file) => {
  const bytes = await readFile(join(destination, file));
  return `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
};
const indexPath = join(destination, "index.html");
let indexHtml = await readFile(indexPath, "utf8");
if (!indexHtml.includes("runtime-config.js")) {
  indexHtml = indexHtml.replace(/(<script\s+src=["']\.\/app\.js[^"']*["'][^>]*><\/script>)/, '<script src="./runtime-config.js"></script>\n  $1');
}
indexHtml = indexHtml
  .replace(/<link\s+rel=["']stylesheet["']\s+href=["']\.\/styles\.css([^"']*)["']\s*\/?>/, `<link rel="stylesheet" href="./styles.css$1" integrity="${await integrity("styles.css")}" />`)
  .replace(/<script\s+src=["']\.\/runtime-config\.js([^"']*)["'][^>]*><\/script>/, `<script src="./runtime-config.js$1" integrity="${await integrity("runtime-config.js")}"></script>`)
  .replace(/<script\s+src=["']\.\/app\.js([^"']*)["'][^>]*><\/script>/, `<script src="./app.js$1" integrity="${await integrity("app.js")}"></script>`);
if ((indexHtml.match(/integrity="sha384-/g) || []).length < 3) {
  throw new Error("Failed to inject integrity hashes for styles.css, runtime-config.js, and app.js");
}
await writeFile(indexPath, indexHtml);
