import { computeFromLed, computeLedIndex } from "./led-index";
import { activeConfig } from "./config";
import type { Config, Design, Hardware } from "./types";

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

function hardwareToConfig(hw: Hardware, colorMode: Config["colorMode"]): Config {
  return {
    width: hw.width,
    height: hw.height,
    colorMode,
    origin: hw.origin,
    axis: hw.axis,
    serpentine: hw.serpentine,
    letterMask: hw.letterMask,
  };
}

function buildVariantIndexing(hw: Hardware, colorMode: Config["colorMode"]) {
  const cfg = hardwareToConfig(hw, colorMode);
  const N = hw.width * hw.height;
  const originY = hw.origin.startsWith("top") ? "top" : "bottom";
  const originX = hw.origin.endsWith("left") ? "left" : "right";
  const axisDesc = hw.axis === "row" ? "horizontal rows" : "vertical columns";
  const serpDesc = hw.serpentine
    ? "alternating direction every strip (serpentine / zigzag wiring)"
    : "all strips running in the same direction";
  return {
    coordinates:
      `"x" is the visual column (0 = leftmost, ${hw.width - 1} = rightmost). ` +
      `"y" is the visual row (0 = topmost, ${hw.height - 1} = bottommost). ` +
      "These are how the design APPEARS to a viewer looking at the matrix, regardless of how the LEDs are wired.",
    led_indexing:
      `LED chain index 0 is at the ${originY}-${originX} corner. The chain runs in ${axisDesc}, ${serpDesc}. ` +
      `Total LEDs: ${N}. The "index" field on each pixel is the position in the LED chain — write color to that position in your strip buffer.`,
    index_formula_pseudocode: buildIndexFormulaPseudo(cfg),
    index_examples_visual_to_chain: {
      "(0, 0) — top-left corner": computeLedIndex(0, 0, cfg),
      [`(${hw.width - 1}, 0) — top-right corner`]: computeLedIndex(
        hw.width - 1,
        0,
        cfg,
      ),
      [`(0, ${hw.height - 1}) — bottom-left corner`]: computeLedIndex(
        0,
        hw.height - 1,
        cfg,
      ),
      [`(${hw.width - 1}, ${hw.height - 1}) — bottom-right corner`]:
        computeLedIndex(hw.width - 1, hw.height - 1, cfg),
    },
  };
}

export function buildExportInstructions(design: Design) {
  const colorNote =
    design.colorMode === "rgb"
      ? 'Color mode is "rgb": colors are arbitrary 24-bit values.'
      : `Color mode is "${design.colorMode}": colors are constrained (e.g., brightness ramp of a single channel, or a fixed multi-color palette). Send the listed RGB values directly — they already encode the intended on-hardware appearance.`;

  return {
    purpose:
      "Pixel-art design for an LED matrix, with one or more hardware variants. " +
      "An LLM or agent can read this file and translate it into driver code (e.g., MicroPython for NeoPixel/WS2812) " +
      "by picking the hardware variant matching the target device and iterating each page's `variants[presetId]` " +
      'array, writing each color to the LED at the given "index". Unspecified LEDs are OFF (black).',
    schema:
      "Top level: { version, colorMode, hardware, pages, instructions }. " +
      "hardware: map of presetId → { presetId, width, height, origin, axis, serpentine, letterMask }. " +
      "pages: ordered array of { label, variants }. " +
      "variants: map of presetId → array of { index, x, y, color } — only LIT cells are listed; absent cells are OFF (#000000). " +
      "Per-variant LED-chain wiring is described under instructions.variant_indexing[presetId].",
    pages_meaning:
      "Each page is one screen/frame to display on the matrix. To play a design, pick a hardware variant (e.g., '8x8') and render each page's variant for that preset sequentially, with a delay between pages. Single-page designs are static images.",
    color_format:
      'Colors are CSS hex strings "#RRGGBB". Convert to (r, g, b) tuples in [0, 255] for typical drivers. ' +
      "NeoPixels at full intensity are uncomfortably bright; consider scaling all RGB values to 20–25% for indoor use.",
    color_mode_note: colorNote,
    rendering_hint_micropython:
      'Example MicroPython per page: `for p in page["variants"]["8x8"]: np[p["index"]] = hex_to_rgb(p["color"]); np.write()`. ' +
      "Clear unset LEDs first with `for i in range(NUM_LEDS): np[i] = (0, 0, 0)` before each page.",
    variant_indexing: Object.fromEntries(
      Object.entries(design.hardware).map(([id, hw]) => [
        id,
        buildVariantIndexing(hw, design.colorMode),
      ]),
    ),
  };
}

export function buildExportJSON(design: Design) {
  return {
    version: 4,
    colorMode: design.colorMode,
    hardware: Object.fromEntries(
      Object.entries(design.hardware).map(([id, hw]) => [id, { ...hw }]),
    ),
    pages: design.pages.map((page) => ({
      label: page.label,
      variants: Object.fromEntries(
        Object.entries(page.variants).map(([presetId, v]) => {
          const hw = design.hardware[presetId];
          if (!hw) return [presetId, []];
          const cfg = hardwareToConfig(hw, design.colorMode);
          const lit: Array<{
            index: number;
            x: number;
            y: number;
            color: string;
          }> = [];
          for (let y = 0; y < hw.height; y++) {
            for (let x = 0; x < hw.width; x++) {
              const c = v.pixels[y * hw.width + x];
              if (c) {
                lit.push({
                  index: computeLedIndex(x, y, cfg),
                  x,
                  y,
                  color: c.toLowerCase(),
                });
              }
            }
          }
          return [presetId, lit];
        }),
      ),
    })),
    instructions: buildExportInstructions(design),
  };
}

export interface ParseResult {
  design: Design;
  hardwareChanged: boolean;
}

interface ImportedPixel {
  index?: number;
  x?: number;
  y?: number;
  row?: number;
  col?: number;
  color: string;
}

function placePixel(
  pixels: (string | null)[],
  hw: Hardware,
  colorMode: Config["colorMode"],
  p: ImportedPixel,
) {
  const cfg = hardwareToConfig(hw, colorMode);
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
    y = hw.height - 1 - p.row;
  } else return;
  if (x < 0 || x >= hw.width || y < 0 || y >= hw.height) return;
  pixels[y * hw.width + x] = p.color;
}

function hardwareDiffers(
  current: Record<string, Hardware>,
  incoming: Record<string, Hardware>,
): boolean {
  const ids = new Set([...Object.keys(current), ...Object.keys(incoming)]);
  for (const id of ids) {
    const a = current[id];
    const b = incoming[id];
    if (!a || !b) return true;
    if (
      a.width !== b.width ||
      a.height !== b.height ||
      a.origin !== b.origin ||
      a.axis !== b.axis ||
      a.serpentine !== b.serpentine ||
      a.letterMask !== b.letterMask
    ) {
      return true;
    }
  }
  return false;
}

export function parseImport(raw: string, current: Design): ParseResult {
  const data = JSON.parse(raw);
  if (!data || typeof data !== "object") {
    throw new Error("Expected a JSON object");
  }
  if (data.version !== 4) {
    throw new Error(
      `Unsupported design version ${data.version ?? "?"}; expected v4`,
    );
  }
  const colorMode = data.colorMode ?? current.colorMode;
  const hardware: Record<string, Hardware> = {};
  for (const [id, raw] of Object.entries<unknown>(data.hardware ?? {})) {
    const r = raw as Partial<Hardware>;
    if (
      !r ||
      typeof r.width !== "number" ||
      typeof r.height !== "number" ||
      typeof r.origin !== "string" ||
      typeof r.axis !== "string"
    ) {
      throw new Error(`Hardware entry ${id} is malformed`);
    }
    hardware[id] = {
      presetId: r.presetId ?? id,
      width: r.width,
      height: r.height,
      origin: r.origin as Hardware["origin"],
      axis: r.axis as Hardware["axis"],
      serpentine: !!r.serpentine,
      letterMask: r.letterMask ?? "",
    };
  }
  if (Object.keys(hardware).length === 0) {
    throw new Error("Design has no hardware entries");
  }

  const pagesIn: unknown[] = Array.isArray(data.pages) ? data.pages : [];
  const pages = pagesIn.map((rawPage, i) => {
    const p = rawPage as { label?: string; variants?: Record<string, unknown> };
    const variants: Record<string, { pixels: (string | null)[] }> = {};
    for (const [presetId, rawList] of Object.entries(p.variants ?? {})) {
      const hw = hardware[presetId];
      if (!hw) continue; // ignore variants for unknown hardware
      const pixels: (string | null)[] = new Array(hw.width * hw.height).fill(
        null,
      );
      if (Array.isArray(rawList)) {
        for (const px of rawList as ImportedPixel[]) {
          placePixel(pixels, hw, colorMode, px);
        }
      }
      variants[presetId] = { pixels };
    }
    return { label: p.label || `Page ${i + 1}`, variants };
  });

  if (pages.length === 0) {
    // Don't return an empty design — produce one blank page so the editor
    // always has something to render. Use whichever hardware entry sorts first.
    const firstId = Object.keys(hardware)[0];
    const hw = hardware[firstId];
    pages.push({
      label: "Page 1",
      variants: {
        [firstId]: {
          pixels: new Array(hw.width * hw.height).fill(null),
        },
      },
    });
  }

  const design: Design = { version: 4, colorMode, hardware, pages };
  return { design, hardwareChanged: hardwareDiffers(current.hardware, hardware) };
}
