import type { Config, Design, Hardware } from "./types";

export const LUMATRIX_MASK =
  "ZATWENTY\n" +
  "HQUARTER\n" +
  "AHALFIVE\n" +
  "WTPASTOR\n" +
  "FIVEIGHT\n" +
  "SIXTHREE\n" +
  "TWELEVEN\n" +
  "FOURNINE";

export const DEFAULT_PRESET_ID = "8x8";

const DEFAULT_HARDWARE_8X8: Hardware = {
  presetId: "8x8",
  width: 8,
  height: 8,
  origin: "bottom-left",
  axis: "row",
  serpentine: false,
  letterMask: LUMATRIX_MASK,
};

/** Convenience: the active-config view of the default design's primary
 *  variant. Used as a reset target for the Config modal's "defaults" button. */
export const DEFAULT_CONFIG: Config = {
  width: DEFAULT_HARDWARE_8X8.width,
  height: DEFAULT_HARDWARE_8X8.height,
  colorMode: "rgb",
  origin: DEFAULT_HARDWARE_8X8.origin,
  axis: DEFAULT_HARDWARE_8X8.axis,
  serpentine: DEFAULT_HARDWARE_8X8.serpentine,
  letterMask: DEFAULT_HARDWARE_8X8.letterMask,
};

export const DEFAULT_DESIGN: Design = {
  version: 4,
  colorMode: "rgb",
  hardware: { [DEFAULT_PRESET_ID]: { ...DEFAULT_HARDWARE_8X8 } },
  pages: [
    {
      label: "Page 1",
      variants: {
        [DEFAULT_PRESET_ID]: { pixels: new Array(8 * 8).fill(null) },
      },
    },
  ],
};

export const STORAGE_KEY = "lumatrix-pixel-designer-design";

export function loadDesign(): Design {
  if (typeof window === "undefined") return cloneDesign(DEFAULT_DESIGN);
  try {
    const j = window.localStorage.getItem(STORAGE_KEY);
    if (!j) return cloneDesign(DEFAULT_DESIGN);
    const parsed = JSON.parse(j);
    if (parsed && typeof parsed === "object" && parsed.version === 4) {
      // Trust the stored shape; if it's malformed, callers will surface that.
      return parsed as Design;
    }
  } catch {}
  return cloneDesign(DEFAULT_DESIGN);
}

export function saveDesign(design: Design) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
  } catch {}
}

/** Deep-ish clone for snapshotting design state (history, defaults). Pixels
 *  arrays are reused references where safe; mutate via slice() in setters. */
export function cloneDesign(d: Design): Design {
  return {
    version: 4,
    colorMode: d.colorMode,
    hardware: Object.fromEntries(
      Object.entries(d.hardware).map(([k, hw]) => [k, { ...hw }]),
    ),
    pages: d.pages.map((p) => ({
      label: p.label,
      variants: Object.fromEntries(
        Object.entries(p.variants).map(([k, v]) => [
          k,
          { pixels: v.pixels.slice() },
        ]),
      ),
    })),
  };
}

/** Resolve the active variant down to the editor's "Config" view. */
export function activeConfig(design: Design, presetId: string): Config {
  const hw = design.hardware[presetId];
  if (!hw) {
    // Caller passed an active preset that no hardware exists for. Surface a
    // sensible empty-canvas view so the editor stays mountable; setters that
    // produce pixels should treat this as a no-op.
    return {
      width: 0,
      height: 0,
      colorMode: design.colorMode,
      origin: "bottom-left",
      axis: "row",
      serpentine: false,
      letterMask: "",
    };
  }
  return {
    width: hw.width,
    height: hw.height,
    colorMode: design.colorMode,
    origin: hw.origin,
    axis: hw.axis,
    serpentine: hw.serpentine,
    letterMask: hw.letterMask,
  };
}

export function getCellLetter(config: Config, x: number, y: number): string {
  const mask = config.letterMask || "";
  if (!mask) return "";
  const lines = mask.split("\n");
  if (y < 0 || y >= lines.length) return "";
  const line = lines[y];
  if (x < 0 || x >= line.length) return "";
  const ch = line[x];
  if (!ch || ch === " " || ch === ".") return "";
  return ch.toUpperCase();
}

export function isMaskAvailable(config: Config): boolean {
  if (!config.letterMask) return false;
  return /[A-Za-z0-9]/.test(config.letterMask);
}

export function computeCellSize(width: number, height: number): number {
  const maxArea = 540;
  const gap = 4;
  const wMax = Math.floor((maxArea - (width - 1) * gap) / width);
  const hMax = Math.floor((maxArea - (height - 1) * gap) / height);
  return Math.max(8, Math.min(50, Math.min(wMax, hMax)));
}

export const CELL_GAP = 4;
