#!/usr/bin/env node
// Copy @spotify/basic-pitch's model files into public/model/ so we self-host
// them. Runs automatically before `npm run dev` and `npm run build` via the
// `predev` / `prebuild` lifecycle hooks (see package.json).
//
// Idempotent: skips the copy when source and dest sizes already match.

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL(".", import.meta.url).pathname, "..");
const src = path.join(root, "node_modules/@spotify/basic-pitch/model");
const dst = path.join(root, "public/model");

if (!fs.existsSync(src)) {
  console.error(`[sync-model] source not found: ${src}`);
  console.error("Run `npm install` first.");
  process.exit(1);
}

fs.mkdirSync(dst, { recursive: true });

const files = fs.readdirSync(src);
let copied = 0, skipped = 0;
for (const f of files) {
  const sp = path.join(src, f);
  const dp = path.join(dst, f);
  const sStat = fs.statSync(sp);
  if (fs.existsSync(dp) && fs.statSync(dp).size === sStat.size) {
    skipped++;
    continue;
  }
  fs.copyFileSync(sp, dp);
  copied++;
}
console.log(`[sync-model] ${copied} copied, ${skipped} unchanged → public/model/`);
