#!/usr/bin/env node
// Build the Pico deploy bundle that LumenFlash serves at /pico-bundle/.
// Reads python/ + shared/ from the repo root and writes verbatim copies plus
// a manifest.json that the web wizard consumes. Idempotent — safe to run on
// every dev/build invocation.

import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const OUT_DIR = path.resolve(HERE, "..", "public", "pico-bundle");

const PY_DIR = path.join(REPO_ROOT, "python");
const APPS_DIR = path.join(PY_DIR, "apps");
const SHARED_DIR = path.join(REPO_ROOT, "shared");

const CORE_FILES = [
  { src: "main.py", from: path.join(PY_DIR, "main.py"), pico: "/main.py" },
  { src: "apps/_screens.py", from: path.join(APPS_DIR, "_screens.py"), pico: "/apps/_screens.py" },
  { src: "apps/_fonts.py", from: path.join(APPS_DIR, "_fonts.py"), pico: "/apps/_fonts.py" },
];

const DATA_FILES = [
  { src: "fonts.json", from: path.join(SHARED_DIR, "fonts.json"), pico: "/fonts.json" },
  { src: "boot-animation.json", from: path.join(SHARED_DIR, "design", "boot-animation.json"), pico: "/boot-animation.json" },
];

async function readUtf8(p) {
  return readFile(p, "utf8");
}

async function writeOut(relPath, content) {
  const abs = path.join(OUT_DIR, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, content);
}

/** Parse the _DEFAULT_ORDER tuple from python/main.py. Returns app ids in
 *  canonical launcher order. */
function parseDefaultOrder(mainPy) {
  const start = mainPy.indexOf("_DEFAULT_ORDER");
  if (start < 0) throw new Error("_DEFAULT_ORDER not found in python/main.py");
  const open = mainPy.indexOf("(", start);
  const close = mainPy.indexOf(")", open);
  if (open < 0 || close < 0) throw new Error("Could not parse _DEFAULT_ORDER tuple");
  const inner = mainPy.slice(open + 1, close);
  const ids = [];
  for (const m of inner.matchAll(/"([^"]+)"/g)) ids.push(m[1]);
  if (!ids.length) throw new Error("_DEFAULT_ORDER is empty");
  return ids;
}

/** Pull NAME = "..." from the top of an app file. Falls back to the id. */
function parseAppName(py, fallback) {
  const m = py.match(/^NAME\s*=\s*"([^"]+)"/m);
  return m ? m[1] : fallback;
}

async function main() {
  // Reset OUT_DIR so deletions in the source tree are reflected in the bundle.
  if (existsSync(OUT_DIR)) {
    await rm(OUT_DIR, { recursive: true, force: true });
  }
  await mkdir(OUT_DIR, { recursive: true });

  // Core + data: verbatim copies.
  for (const f of [...CORE_FILES, ...DATA_FILES]) {
    const content = await readFile(f.from);
    await writeOut(f.src, content);
  }

  // Apps: copy every .py from python/apps/ (except the underscored shared
  // modules, which are already in CORE_FILES). Build a name lookup keyed by id.
  const appEntries = [];
  const appNameById = new Map();
  for (const name of await readdir(APPS_DIR)) {
    if (!name.endsWith(".py") || name.startsWith("_")) continue;
    const id = name.slice(0, -3);
    const from = path.join(APPS_DIR, name);
    const py = await readUtf8(from);
    await writeOut(`apps/${name}`, py);
    appNameById.set(id, parseAppName(py, id));
    appEntries.push({ id, from });
  }

  // Order the apps array by main.py's _DEFAULT_ORDER. Anything outside that
  // tuple (e.g. letters.py) goes after in deterministic filename order — it
  // ships in the bundle but won't be selected by default.
  const mainPy = await readUtf8(path.join(PY_DIR, "main.py"));
  const defaultOrder = parseDefaultOrder(mainPy);
  const known = new Set(defaultOrder);
  const orderedIds = [
    ...defaultOrder.filter((id) => appNameById.has(id)),
    ...appEntries.map((e) => e.id).filter((id) => !known.has(id)).sort(),
  ];
  const apps = orderedIds.map((id) => ({
    id,
    name: appNameById.get(id) ?? id,
    src: `apps/${id}.py`,
    pico: `/apps/${id}.py`,
    default: known.has(id),
  }));

  // Hardware presets: import from shared/.
  const presets = JSON.parse(await readUtf8(path.join(SHARED_DIR, "hardware-presets.json"))).presets;

  const manifest = {
    generated_at: new Date().toISOString(),
    core: CORE_FILES.map(({ src, pico }) => ({ src, pico })),
    data: DATA_FILES.map(({ src, pico }) => ({ src, pico })),
    apps,
    hardware_presets: presets,
  };
  await writeOut("manifest.json", JSON.stringify(manifest, null, 2));

  const totalApps = apps.length;
  console.log(
    `[pico-bundle] wrote ${OUT_DIR} — ${totalApps} apps, ` +
    `${CORE_FILES.length} core, ${DATA_FILES.length} data, ` +
    `${presets.length} presets`,
  );
}

main().catch((err) => {
  console.error("[pico-bundle] failed:", err);
  process.exit(1);
});
