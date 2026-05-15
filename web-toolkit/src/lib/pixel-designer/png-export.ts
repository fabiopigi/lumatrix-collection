import { getCellLetter, isMaskAvailable, computeCellSize, CELL_GAP } from "./config";
import type { Config, Mode, Page } from "./types";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';
const SCALE = 2;
const TITLE_FONT = 14 * SCALE;
const TITLE_GAP = 12 * SCALE;
const SECTION_GAP = 28 * SCALE;
const SIDE_PAD = 24 * SCALE;
const TOP_PAD = 28 * SCALE;
const PAD_GRID = 14 * SCALE;
const RADIUS = 4 * SCALE;
const WRAP_RADIUS = 10 * SCALE;

export interface PngSection {
  /** Headline text shown above this section's grid. */
  title: string;
  config: Config;
  pixels: (string | null)[];
}

interface ResolvedSection extends PngSection {
  cell: number;
  CELL: number;
  GAP: number;
  gridW: number;
  gridH: number;
}

function resolveSection(s: PngSection): ResolvedSection {
  const cell = computeCellSize(s.config.width, s.config.height);
  const CELL = cell * SCALE;
  const GAP = CELL_GAP * SCALE;
  const gridW = PAD_GRID * 2 + CELL * s.config.width + GAP * (s.config.width - 1);
  const gridH =
    PAD_GRID * 2 + CELL * s.config.height + GAP * (s.config.height - 1);
  return { ...s, cell, CELL, GAP, gridW, gridH };
}

function cellRect(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  size: number,
) {
  ctx.beginPath();
  ctx.roundRect(tx, ty, size, size, RADIUS);
}

function renderSection(
  ctx: CanvasRenderingContext2D,
  layout: ResolvedSection,
  mode: Mode,
  totalW: number,
  topY: number,
) {
  const titleSpace = TITLE_FONT + TITLE_GAP;
  const gridX = (totalW - layout.gridW) / 2;
  const gridY = topY + titleSpace;

  ctx.font = `600 ${TITLE_FONT}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#d8d8dc";
  ctx.fillText(layout.title, totalW / 2, topY);

  ctx.fillStyle = "#1a1a1f";
  ctx.beginPath();
  ctx.roundRect(gridX, gridY, layout.gridW, layout.gridH, WRAP_RADIUS);
  ctx.fill();

  const isMask = mode === "mask" && isMaskAvailable(layout.config);

  // Pass 1: empty cell backgrounds.
  for (let y = 0; y < layout.config.height; y++) {
    for (let x = 0; x < layout.config.width; x++) {
      const tx = gridX + PAD_GRID + x * (layout.CELL + layout.GAP);
      const ty = gridY + PAD_GRID + y * (layout.CELL + layout.GAP);
      ctx.fillStyle = isMask ? "#060608" : "#0a0a0c";
      cellRect(ctx, tx, ty, layout.CELL);
      ctx.fill();
    }
  }

  // Pass 2: foreground (lit pixels or mask letters).
  for (let y = 0; y < layout.config.height; y++) {
    for (let x = 0; x < layout.config.width; x++) {
      const tx = gridX + PAD_GRID + x * (layout.CELL + layout.GAP);
      const ty = gridY + PAD_GRID + y * (layout.CELL + layout.GAP);
      const c = layout.pixels[y * layout.config.width + x];

      if (isMask) {
        const letter = getCellLetter(layout.config, x, y);
        const text = letter || "·";
        const fontPx =
          Math.round(layout.cell * (letter ? 0.72 : 0.5)) * SCALE;
        ctx.font = `${letter ? 800 : 600} ${fontPx}px ${FONT_STACK}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const cx = tx + layout.CELL / 2;
        const cy = ty + layout.CELL / 2;
        if (c) {
          ctx.save();
          ctx.shadowColor = c;
          ctx.shadowBlur = 8 * SCALE;
          ctx.fillStyle = c;
          ctx.fillText(text, cx, cy);
          if (letter) {
            ctx.shadowBlur = 16 * SCALE;
            ctx.fillText(text, cx, cy);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = "#1c1c22";
          ctx.fillText(text, cx, cy);
        }
      } else {
        if (!c) continue;
        ctx.save();
        ctx.shadowColor = c;
        ctx.shadowBlur = 12 * SCALE;
        ctx.fillStyle = c;
        cellRect(ctx, tx, ty, layout.CELL);
        ctx.fill();
        ctx.shadowBlur = 24 * SCALE;
        ctx.fill();
        ctx.restore();
      }
    }
  }
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

/** Render a list of sections — each with its own config and pixels — as a
 *  vertical sheet PNG. Used by every export-modal PNG scope; the previous
 *  single-config exportPng is implemented in terms of this. */
export function exportPngSheet(
  sections: PngSection[],
  mode: Mode,
  filename: string,
) {
  if (sections.length === 0) return;
  const layouts = sections.map(resolveSection);
  const titleSpace = TITLE_FONT + TITLE_GAP;

  const measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = `600 ${TITLE_FONT}px ${FONT_STACK}`;
  const titleWidths = layouts.map((l) => measureCtx.measureText(l.title).width);
  const maxTitleW = Math.max(0, ...titleWidths);
  const maxGridW = Math.max(0, ...layouts.map((l) => l.gridW));
  const totalW = Math.max(maxGridW, maxTitleW) + SIDE_PAD * 2;
  const totalH =
    TOP_PAD * 2 +
    layouts.reduce((sum, l) => sum + titleSpace + l.gridH, 0) +
    SECTION_GAP * Math.max(0, layouts.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0e0e10";
  ctx.fillRect(0, 0, totalW, totalH);

  let cursorY = TOP_PAD;
  for (const layout of layouts) {
    renderSection(ctx, layout, mode, totalW, cursorY);
    cursorY += titleSpace + layout.gridH + SECTION_GAP;
  }

  downloadCanvas(canvas, filename);
}

/** Backwards-compatible wrapper: render N pages at the same config as a
 *  single-variant sheet. */
export function exportPng(config: Config, pages: Page[], mode: Mode) {
  const isMask = mode === "mask" && isMaskAvailable(config);
  exportPngSheet(
    pages.map((p, i) => ({
      title: `#${i + 1}  ${p.label || `Page ${i + 1}`}`,
      config,
      pixels: p.pixels,
    })),
    mode,
    `pixel-design-${config.width}x${config.height}-${pages.length}p${isMask ? "-mask" : ""}.png`,
  );
}
