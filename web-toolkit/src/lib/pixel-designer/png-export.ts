import { getCellLetter, isMaskAvailable, computeCellSize, CELL_GAP } from "./config";
import type { Config, Mode } from "./types";

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';
const SCALE = 2;
const HEADER_FONT = 14 * SCALE;
const HEADER_GAP = 12 * SCALE;
const COL_GAP = 24 * SCALE;
const ROW_GAP = 28 * SCALE;
const SIDE_PAD = 24 * SCALE;
const TOP_PAD = 28 * SCALE;
const PAD_GRID = 14 * SCALE;
const RADIUS = 4 * SCALE;
const WRAP_RADIUS = 10 * SCALE;

export interface PngGridSection {
  config: Config;
  pixels: (string | null)[];
}

export interface PngGridArgs {
  /** sections[row][col]. `null` cells render as empty space (no grid). */
  sections: Array<Array<PngGridSection | null>>;
  /** Row label rendered to the left of each row (e.g., "#1 Page 1"). */
  rowLabels?: string[];
  /** Column label rendered above each column (e.g., "8×8"). */
  columnLabels?: string[];
  mode: Mode;
  filename: string;
}

interface ResolvedSection {
  config: Config;
  pixels: (string | null)[];
  cell: number;
  CELL: number;
  GAP: number;
  gridW: number;
  gridH: number;
}

function resolve(s: PngGridSection): ResolvedSection {
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

function renderGrid(
  ctx: CanvasRenderingContext2D,
  layout: ResolvedSection,
  mode: Mode,
  gridX: number,
  gridY: number,
) {
  ctx.fillStyle = "#1a1a1f";
  ctx.beginPath();
  ctx.roundRect(gridX, gridY, layout.gridW, layout.gridH, WRAP_RADIUS);
  ctx.fill();

  const isMask = mode === "mask" && isMaskAvailable(layout.config);

  for (let y = 0; y < layout.config.height; y++) {
    for (let x = 0; x < layout.config.width; x++) {
      const tx = gridX + PAD_GRID + x * (layout.CELL + layout.GAP);
      const ty = gridY + PAD_GRID + y * (layout.CELL + layout.GAP);
      ctx.fillStyle = isMask ? "#060608" : "#0a0a0c";
      cellRect(ctx, tx, ty, layout.CELL);
      ctx.fill();
    }
  }

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

/** Render a 2D grid of sections — variants run left/right (columns), pages
 *  run top/bottom (rows). Optional row/column labels are drawn in a leading
 *  column / leading row respectively. Empty cells render as blank space. */
export function exportPngGrid(args: PngGridArgs) {
  const { sections, rowLabels, columnLabels, mode, filename } = args;
  const numRows = sections.length;
  const numCols = sections.reduce((m, row) => Math.max(m, row.length), 0);
  if (numRows === 0 || numCols === 0) return;

  // Resolve every non-null cell.
  const layouts: Array<Array<ResolvedSection | null>> = sections.map((row) =>
    Array.from({ length: numCols }, (_, c) =>
      row[c] ? resolve(row[c]!) : null,
    ),
  );

  // Per-column max grid width (variants share a width, so this is just the
  // first non-null) and per-row max grid height.
  const colWidths: number[] = [];
  for (let c = 0; c < numCols; c++) {
    let w = 0;
    for (let r = 0; r < numRows; r++) {
      const l = layouts[r][c];
      if (l && l.gridW > w) w = l.gridW;
    }
    colWidths.push(w);
  }
  const rowHeights: number[] = [];
  for (let r = 0; r < numRows; r++) {
    let h = 0;
    for (let c = 0; c < numCols; c++) {
      const l = layouts[r][c];
      if (l && l.gridH > h) h = l.gridH;
    }
    rowHeights.push(h);
  }

  // Measure header bands.
  const measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = `600 ${HEADER_FONT}px ${FONT_STACK}`;

  const hasColumnLabels =
    Array.isArray(columnLabels) && columnLabels.some((l) => l.trim() !== "");
  const hasRowLabels =
    Array.isArray(rowLabels) && rowLabels.some((l) => l.trim() !== "");

  const headerRowH = hasColumnLabels ? HEADER_FONT + HEADER_GAP : 0;
  let headerColW = 0;
  if (hasRowLabels && rowLabels) {
    for (const l of rowLabels) {
      const w = measureCtx.measureText(l).width;
      if (w > headerColW) headerColW = w;
    }
    headerColW = Math.ceil(headerColW) + HEADER_GAP;
  }

  const totalW =
    SIDE_PAD * 2 +
    headerColW +
    colWidths.reduce((a, b) => a + b, 0) +
    COL_GAP * Math.max(0, numCols - 1);
  const totalH =
    TOP_PAD * 2 +
    headerRowH +
    rowHeights.reduce((a, b) => a + b, 0) +
    ROW_GAP * Math.max(0, numRows - 1);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, totalW);
  canvas.height = Math.max(1, totalH);
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0e0e10";
  ctx.fillRect(0, 0, totalW, totalH);

  // Column origins (x of left edge of column c's cell zone).
  const colX: number[] = [];
  {
    let cx = SIDE_PAD + headerColW;
    for (let c = 0; c < numCols; c++) {
      colX.push(cx);
      cx += colWidths[c] + COL_GAP;
    }
  }
  // Row origins.
  const rowY: number[] = [];
  {
    let ry = TOP_PAD + headerRowH;
    for (let r = 0; r < numRows; r++) {
      rowY.push(ry);
      ry += rowHeights[r] + ROW_GAP;
    }
  }

  // Column headers, centred over each column.
  if (hasColumnLabels && columnLabels) {
    ctx.font = `600 ${HEADER_FONT}px ${FONT_STACK}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#d8d8dc";
    for (let c = 0; c < numCols; c++) {
      const label = columnLabels[c] ?? "";
      if (!label) continue;
      ctx.fillText(label, colX[c] + colWidths[c] / 2, TOP_PAD);
    }
  }

  // Row headers, right-aligned, vertically centred against each row.
  if (hasRowLabels && rowLabels) {
    ctx.font = `600 ${HEADER_FONT}px ${FONT_STACK}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#d8d8dc";
    for (let r = 0; r < numRows; r++) {
      const label = rowLabels[r] ?? "";
      if (!label) continue;
      ctx.fillText(
        label,
        SIDE_PAD + headerColW - HEADER_GAP,
        rowY[r] + rowHeights[r] / 2,
      );
    }
  }

  // Each cell, centred within its row/column box.
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const layout = layouts[r][c];
      if (!layout) continue;
      const gridX = colX[c] + (colWidths[c] - layout.gridW) / 2;
      const gridY = rowY[r] + (rowHeights[r] - layout.gridH) / 2;
      renderGrid(ctx, layout, mode, gridX, gridY);
    }
  }

  downloadCanvas(canvas, filename);
}
