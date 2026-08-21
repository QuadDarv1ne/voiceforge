/**
 * Cross-platform post-build step for Next.js standalone output.
 *
 * Copies the generated static assets and the public folder into the
 * standalone build so the server can serve images, fonts, etc.
 *
 * Why: the previous `cp -r` in the build script is not portable across
 * Windows / Linux / macOS shells, so we use Node's fs.cp instead.
 */

import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const standaloneNext = join(root, ".next", "standalone", ".next");
const staticSrc = join(root, ".next", "static");
const publicSrc = join(root, "public");

const staticDst = join(standaloneNext, "static");
const publicDst = join(standaloneNext, "public");

async function copyDir(src, dst) {
  if (!existsSync(src)) {
    console.warn(`[postbuild] Skipping missing source: ${src}`);
    return;
  }
  await mkdir(dst, { recursive: true });
  await cp(src, dst, { recursive: true, force: true });
  console.log(`[postbuild] Copied ${src} -> ${dst}`);
}

await copyDir(staticSrc, staticDst);
await copyDir(publicSrc, publicDst);

console.log("[postbuild] Standalone output is ready.");
