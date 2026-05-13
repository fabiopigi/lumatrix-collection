#!/usr/bin/env node
/**
 * Bundles web/src/main.ts via esbuild and inlines the JS + CSS into the HTML
 * shell, producing a single self-contained file at repo-root/simulator.html.
 *
 * Usage:
 *   node compile.mjs           # one-shot build
 *   node compile.mjs --watch   # rebuild on change
 */

import { build, context } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const WEB = __dirname;

const ENTRY = resolve(WEB, "src/main.ts");
const SHELL = resolve(WEB, "index.html");
const STYLES = resolve(WEB, "styles.css");
const OUT = resolve(ROOT, "web-apps/simulator.html");

const isWatch = process.argv.includes("--watch");

const esbuildOptions = {
  entryPoints: [ENTRY],
  bundle: true,
  minify: !isWatch,
  format: "iife",
  target: "es2020",
  platform: "browser",
  write: false,
  loader: { ".json": "json" },
  logLevel: "info",
};

function escapeForScriptTag(js) {
  // Prevent any literal "</script>" in the bundle from terminating the inline tag.
  return js.replace(/<\/script>/gi, "<\\/script>");
}

async function emit(jsBundle) {
  const [shell, css] = await Promise.all([
    readFile(SHELL, "utf8"),
    readFile(STYLES, "utf8"),
  ]);

  const html = shell
    .replace(
      /<link\s+rel="stylesheet"\s+href="styles\.css"\s*\/?>/,
      `<style>\n${css.trim()}\n</style>`,
    )
    .replace(
      /<script\s+type="module"\s+src="src\/main\.ts"><\/script>/,
      `<script>\n${escapeForScriptTag(jsBundle)}\n</script>`,
    );

  await writeFile(OUT, html, "utf8");
  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
  console.log(`wrote ${OUT} (${kb} KB)`);
}

if (isWatch) {
  const ctx = await context({
    ...esbuildOptions,
    plugins: [
      {
        name: "emit-html",
        setup(b) {
          b.onEnd(async (result) => {
            if (result.errors.length) return;
            const js = result.outputFiles?.[0]?.text;
            if (js) await emit(js);
          });
        },
      },
    ],
  });
  await ctx.watch();
  console.log("watching for changes...");
} else {
  const result = await build(esbuildOptions);
  const js = result.outputFiles[0].text;
  await emit(js);
}
