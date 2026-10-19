#!/usr/bin/env node
/**
 * Copy IBM Plex Sans Arabic from packages/fonts/assets into the calling
 * app's public/fonts.
 *
 * Why a copy at all: a package's public/ directory is never served, and Next
 * resolves a root-absolute `/fonts/...` url only against the app's own
 * public/. So the bytes have to exist under apps/<app>/public/fonts at build
 * time. They live ONCE in git (here) and three times on disk (generated,
 * gitignored).
 *
 * Run from an app directory — `npm run sync-fonts` in apps/vendor, apps/admin
 * or apps/storefront, which predev/prebuild also invoke. The turbo task of the
 * same name runs it when `build` or `dev` is a cache hit and the pre-hook
 * therefore never fires.
 *
 * Idempotent: a face already present at the same size is left alone, so the
 * second run costs a stat per file and nothing else.
 */
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(PACKAGE_DIR, "assets", "ibm-plex-sans-arabic");

// The app is wherever npm ran us from. Passing an explicit path is supported
// so the script can be driven from the repo root too.
const APP_DIR = resolve(process.argv[2] ?? process.cwd());
const DEST = join(APP_DIR, "public", "fonts", "ibm-plex-sans-arabic");

/** Every file under `dir`, as paths relative to it. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else if (entry.isFile()) out.push(relative(base, full));
  }
  return out;
}

function sizeOf(path) {
  try {
    return statSync(path).size;
  } catch {
    return -1;
  }
}

let sourceFiles;
try {
  sourceFiles = walk(SOURCE);
} catch {
  console.error(
    `sync-fonts: no font assets at ${SOURCE}. Is packages/fonts intact?`,
  );
  process.exit(1);
}

if (sourceFiles.length === 0) {
  console.error(`sync-fonts: ${SOURCE} is empty — nothing to copy.`);
  process.exit(1);
}

let copied = 0;
let bytes = 0;

for (const rel of sourceFiles) {
  const from = join(SOURCE, rel);
  const to = join(DEST, rel);
  const size = statSync(from).size;
  bytes += size;
  if (sizeOf(to) === size) continue;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied += 1;
}

const where = relative(process.cwd(), DEST) || DEST;
console.log(
  copied === 0
    ? `sync-fonts: ${sourceFiles.length} faces already current in ${where}`
    : `sync-fonts: copied ${copied}/${sourceFiles.length} faces (${(bytes / 1024).toFixed(0)} KB) into ${where}`,
);
