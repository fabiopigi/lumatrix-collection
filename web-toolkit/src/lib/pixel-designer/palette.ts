import type { ColorMode, Design } from "./types";

export function ramp(hex: string, steps = 16): string[] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const out = ["#000000"];
  for (let i = 1; i < steps; i++) {
    const t = i / (steps - 1);
    const cr = Math.round(r * t);
    const cg = Math.round(g * t);
    const cb = Math.round(b * t);
    out.push(
      "#" +
        [cr, cg, cb]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join(""),
    );
  }
  return out;
}

export const RGB_PALETTE: string[] = [
  "#000000", "#202024", "#404048", "#808088", "#b8b8c0", "#ffffff", "#7a3a1a", "#3a1a4a",
  "#400000", "#800000", "#ff0000", "#ff4000", "#ff8000", "#ffa040", "#ffc000", "#ffff00",
  "#80ff00", "#00ff00", "#00ff80", "#008040", "#004020", "#00b0a0", "#00ffff", "#0080ff",
  "#0040ff", "#0000ff", "#000080", "#4000ff", "#8000ff", "#ff00ff", "#ff0080", "#ff80c0",
];

interface ColorModeDef {
  palette: string[];
  default: string;
}

export const COLOR_MODES: Record<ColorMode, ColorModeDef> = {
  rgb: { palette: RGB_PALETTE, default: "#ff4000" },
  "single-white": { palette: ramp("#ffffff", 16), default: "#ffffff" },
  "single-red": { palette: ramp("#ff0000", 16), default: "#ff0000" },
  "single-green": { palette: ramp("#00ff00", 16), default: "#00ff00" },
  "single-blue": { palette: ramp("#0080ff", 16), default: "#0080ff" },
  "single-amber": { palette: ramp("#ffa040", 16), default: "#ffa040" },
  rg: {
    palette: [
      "#000000", "#400000", "#800000", "#ff0000", "#ff4040", "#004000",
      "#008000", "#00ff00", "#40ff40", "#404000", "#808000", "#ffff00",
    ],
    default: "#ff0000",
  },
  rog: {
    palette: [
      "#000000", "#400000", "#ff0000", "#ff4000", "#ff8000", "#ffa040",
      "#004000", "#008000", "#00ff00", "#80ff00",
    ],
    default: "#ff0000",
  },
  rgb3: {
    palette: [
      "#000000", "#400000", "#ff0000", "#004000", "#00ff00", "#000040",
      "#0000ff", "#404040", "#ffffff",
    ],
    default: "#ff0000",
  },
};

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  rgb: "RGB (full color)",
  "single-white": "Single white (brightness)",
  "single-red": "Single red (brightness)",
  "single-green": "Single green (brightness)",
  "single-blue": "Single blue (brightness)",
  "single-amber": "Single amber (brightness)",
  rg: "Red / Green (2-color)",
  rog: "Red / Orange / Green (3-color)",
  rgb3: "Red / Green / Blue (3-color)",
};

export function getPalette(mode: ColorMode): string[] {
  return COLOR_MODES[mode]?.palette ?? RGB_PALETTE;
}

export function getDefaultColor(mode: ColorMode): string {
  return COLOR_MODES[mode]?.default ?? "#ff4000";
}

/** Collect every distinct non-empty pixel colour across the whole design —
 *  all pages × all variants — and return them most-frequent first. The
 *  designer surfaces this as the "Used on canvas" palette source so the
 *  swatch grid mirrors what's already on the artwork. */
export function usedOnCanvasColors(design: Design): string[] {
  const counts = new Map<string, number>();
  for (const page of design.pages) {
    for (const variant of Object.values(page.variants)) {
      for (const c of variant.pixels) {
        if (!c) continue;
        const k = c.toLowerCase();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
}
