import { computeFromLed, computeLedIndex } from "./led-index";
import type { Config, Page } from "./types";

function buildIndexFormulaPseudo(cfg: Config): string {
  const W = cfg.width;
  const H = cfg.height;
  const lines = ["def visual_to_led_index(x, y):"];
  if (cfg.origin === "top-left") {
    lines.push("    col = x");
    lines.push("    row = y");
  } else if (cfg.origin === "top-right") {
    lines.push(`    col = ${W - 1} - x   # origin on right`);
    lines.push("    row = y");
  } else if (cfg.origin === "bottom-left") {
    lines.push("    col = x");
    lines.push(`    row = ${H - 1} - y   # origin at bottom`);
  } else {
    lines.push(`    col = ${W - 1} - x   # origin on right`);
    lines.push(`    row = ${H - 1} - y   # origin at bottom`);
  }
  if (cfg.axis === "row") {
    if (cfg.serpentine) {
      lines.push(
        `    sec = (${W - 1} - col) if (row % 2 == 1) else col   # serpentine`,
      );
    } else {
      lines.push("    sec = col");
    }
    lines.push(`    return row * ${W} + sec`);
  } else {
    if (cfg.serpentine) {
      lines.push(
        `    sec = (${H - 1} - row) if (col % 2 == 1) else row   # serpentine`,
      );
    } else {
      lines.push("    sec = row");
    }
    lines.push(`    return col * ${H} + sec`);
  }
  return lines.join("\n");
}

export function buildExportInstructions(cfg: Config) {
  const N = cfg.width * cfg.height;
  const originY = cfg.origin.startsWith("top") ? "top" : "bottom";
  const originX = cfg.origin.endsWith("left") ? "left" : "right";
  const axisDesc =
    cfg.axis === "row" ? "horizontal rows" : "vertical columns";
  const serpDesc = cfg.serpentine
    ? "alternating direction every strip (serpentine / zigzag wiring)"
    : "all strips running in the same direction";

  const colorNote =
    cfg.colorMode === "rgb"
      ? 'Color mode is "rgb": colors are arbitrary 24-bit values.'
      : `Color mode is "${cfg.colorMode}": colors are constrained (e.g., brightness ramp of a single channel, or a fixed multi-color palette). Send the listed RGB values directly — they already encode the intended on-hardware appearance.`;

  return {
    purpose:
      `Pixel-art design for a ${cfg.width}×${cfg.height} LED matrix. An LLM or agent can read this file ` +
      `and translate it into driver code (e.g., MicroPython for NeoPixel/WS2812) by iterating each page's ` +
      `pixels and writing each color to the LED at the given "index", leaving unspecified LEDs off (black).`,
    schema:
      "Top level: { version, config, pages, instructions }. " +
      "config: { width, height, colorMode, origin, axis, serpentine }. " +
      "pages: ordered array of { label, pixels }. " +
      "pixels: array of { index, x, y, color } — only LIT cells are listed; absent cells are OFF (#000000).",
    pages_meaning:
      "Each page is one screen/frame to display on the matrix. To play a design, render pages sequentially in array order with a delay between them (the delay is up to the player). Single-page designs are a static image.",
    coordinates:
      `"x" is the visual column (0 = leftmost, ${cfg.width - 1} = rightmost). ` +
      `"y" is the visual row (0 = topmost, ${cfg.height - 1} = bottommost). ` +
      "These are how the design APPEARS to a viewer looking at the matrix, regardless of how the LEDs are wired.",
    led_indexing:
      `LED chain index 0 is at the ${originY}-${originX} corner. The chain runs in ${axisDesc}, ${serpDesc}. ` +
      `Total LEDs: ${N}. The "index" field on each pixel is the position in the LED chain — write color to that position in your strip buffer.`,
    index_formula_pseudocode: buildIndexFormulaPseudo(cfg),
    index_examples_visual_to_chain: {
      "(0, 0) — top-left corner": computeLedIndex(0, 0, cfg),
      [`(${cfg.width - 1}, 0) — top-right corner`]: computeLedIndex(
        cfg.width - 1,
        0,
        cfg,
      ),
      [`(0, ${cfg.height - 1}) — bottom-left corner`]: computeLedIndex(
        0,
        cfg.height - 1,
        cfg,
      ),
      [`(${cfg.width - 1}, ${cfg.height - 1}) — bottom-right corner`]:
        computeLedIndex(cfg.width - 1, cfg.height - 1, cfg),
    },
    color_format:
      'Colors are CSS hex strings "#RRGGBB". Convert to (r, g, b) tuples in [0, 255] for typical drivers. ' +
      "NeoPixels at full intensity are uncomfortably bright; consider scaling all RGB values to 20–25% for indoor use.",
    color_mode_note: colorNote,
    rendering_hint_micropython:
      'Example MicroPython per page: `for p in page["pixels"]: np[p["index"]] = hex_to_rgb(p["color"]); np.write()`. ' +
      "Clear unset LEDs first with `for i in range(NUM_LEDS): np[i] = (0, 0, 0)` before each page.",
  };
}

export function buildExportJSON(config: Config, pages: Page[]) {
  return {
    version: 3,
    config: { ...config },
    pages: pages.map((page) => {
      const arr: Array<{ index: number; x: number; y: number; color: string }> = [];
      for (let y = 0; y < config.height; y++) {
        for (let x = 0; x < config.width; x++) {
          const c = page.pixels[y * config.width + x];
          if (c) {
            arr.push({
              index: computeLedIndex(x, y, config),
              x,
              y,
              color: c.toLowerCase(),
            });
          }
        }
      }
      return { label: page.label, pixels: arr };
    }),
    instructions: buildExportInstructions(config),
  };
}

interface ParseResult {
  pages: Page[];
  config: Config | null;
  configMismatch: boolean;
}

export function parseImport(raw: string, current: Config): ParseResult {
  const data = JSON.parse(raw);
  let resultConfig: Config | null = null;
  let mismatch = false;
  if (data && typeof data === "object" && data.config && typeof data.config === "object") {
    const incoming = data.config;
    mismatch =
      incoming.width !== current.width ||
      incoming.height !== current.height ||
      incoming.colorMode !== current.colorMode ||
      incoming.origin !== current.origin ||
      incoming.axis !== current.axis ||
      incoming.serpentine !== current.serpentine;
    resultConfig = { ...current, ...incoming };
  }

  const cfg = resultConfig ?? current;
  const N = cfg.width * cfg.height;

  const placePixel = (
    pixels: (string | null)[],
    p: { index?: number; x?: number; y?: number; row?: number; col?: number; color: string },
  ) => {
    let x: number, y: number;
    if (typeof p.index === "number") {
      const v = computeFromLed(p.index, cfg);
      x = v.x;
      y = v.y;
    } else if (typeof p.x === "number" && typeof p.y === "number") {
      x = p.x;
      y = p.y;
    } else if (typeof p.row === "number" && typeof p.col === "number") {
      x = p.col;
      y = cfg.height - 1 - p.row;
    } else return;
    if (x < 0 || x >= cfg.width || y < 0 || y >= cfg.height) return;
    pixels[y * cfg.width + x] = p.color;
  };

  let pages: Page[];
  if (data && Array.isArray(data.pages)) {
    pages = data.pages.map(
      (
        p: { label?: string; pixels?: Array<Parameters<typeof placePixel>[1]> },
        i: number,
      ) => {
        const pixels: (string | null)[] = new Array(N).fill(null);
        (p.pixels || []).forEach((px) => placePixel(pixels, px));
        return { label: p.label || `Page ${i + 1}`, pixels };
      },
    );
    if (pages.length === 0) {
      pages = [{ label: "Page 1", pixels: new Array(N).fill(null) }];
    }
  } else {
    const arr = Array.isArray(data) ? data : data.pixels;
    if (!Array.isArray(arr)) throw new Error("Expected pages, pixels, or an array");
    const pixels: (string | null)[] = new Array(N).fill(null);
    for (const p of arr) placePixel(pixels, p);
    pages = [{ label: "Page 1", pixels }];
  }

  return { pages, config: resultConfig, configMismatch: mismatch };
}
