import { getCellLetter, isMaskAvailable, computeCellSize, CELL_GAP } from "./config";
import type { Config, Mode, Page } from "./types";

export function exportPng(
  config: Config,
  pages: Page[],
  mode: Mode,
) {
  const cell = computeCellSize(config.width, config.height);
  const gap = CELL_GAP;
  const SCALE = 2;
  const PAD_GRID = 14 * SCALE;
  const CELL = cell * SCALE;
  const GAP = gap * SCALE;
  const RADIUS = 4 * SCALE;
  const WRAP_RADIUS = 10 * SCALE;
  const TITLE_FONT = 14 * SCALE;
  const TITLE_GAP = 12 * SCALE;
  const PAGE_GAP = 28 * SCALE;
  const SIDE_PAD = 24 * SCALE;
  const TOP_PAD = 28 * SCALE;
  const isMask = mode === "mask" && isMaskAvailable(config);

  const gridW = PAD_GRID * 2 + CELL * config.width + GAP * (config.width - 1);
  const gridH = PAD_GRID * 2 + CELL * config.height + GAP * (config.height - 1);
  const titleSpace = TITLE_FONT + TITLE_GAP;
  const pageBlockH = titleSpace + gridH;

  const fontStack =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif';

  const measureCtx = document.createElement("canvas").getContext("2d")!;
  measureCtx.font = `600 ${TITLE_FONT}px ${fontStack}`;
  let maxTitleW = 0;
  pages.forEach((page, pi) => {
    const text = `#${pi + 1}  ${page.label || ""}`;
    const w = measureCtx.measureText(text).width;
    if (w > maxTitleW) maxTitleW = w;
  });

  const totalW = Math.max(gridW, maxTitleW) + SIDE_PAD * 2;
  const totalH =
    TOP_PAD * 2 +
    pageBlockH * pages.length +
    PAGE_GAP * Math.max(0, pages.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0e0e10";
  ctx.fillRect(0, 0, totalW, totalH);

  const cellRect = (tx: number, ty: number) => {
    ctx.beginPath();
    ctx.roundRect(tx, ty, CELL, CELL, RADIUS);
  };

  pages.forEach((page, pi) => {
    const blockTop = TOP_PAD + pi * (pageBlockH + PAGE_GAP);
    const gridX = (totalW - gridW) / 2;
    const gridY = blockTop + titleSpace;

    ctx.font = `600 ${TITLE_FONT}px ${fontStack}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const num = `#${pi + 1}`;
    const sep = "  ";
    const label = page.label || `Page ${pi + 1}`;
    const numW = ctx.measureText(num).width;
    const sepW = ctx.measureText(sep).width;
    const fullW = numW + sepW + ctx.measureText(label).width;
    const titleX = (totalW - fullW) / 2;
    ctx.fillStyle = "#6cf";
    ctx.fillText(num, titleX, blockTop);
    ctx.fillStyle = "#d8d8dc";
    ctx.fillText(sep + label, titleX + numW, blockTop);

    ctx.fillStyle = "#1a1a1f";
    ctx.beginPath();
    ctx.roundRect(gridX, gridY, gridW, gridH, WRAP_RADIUS);
    ctx.fill();

    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const tx = gridX + PAD_GRID + x * (CELL + GAP);
        const ty = gridY + PAD_GRID + y * (CELL + GAP);
        ctx.fillStyle = isMask ? "#060608" : "#0a0a0c";
        cellRect(tx, ty);
        ctx.fill();
      }
    }

    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const tx = gridX + PAD_GRID + x * (CELL + GAP);
        const ty = gridY + PAD_GRID + y * (CELL + GAP);
        const c = page.pixels[y * config.width + x];

        if (isMask) {
          const letter = getCellLetter(config, x, y);
          const text = letter || "·";
          const fontPx = Math.round(cell * (letter ? 0.72 : 0.5)) * SCALE;
          ctx.font = `${letter ? 800 : 600} ${fontPx}px ${fontStack}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const cx = tx + CELL / 2;
          const cy = ty + CELL / 2;
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
          cellRect(tx, ty);
          ctx.fill();
          ctx.shadowBlur = 24 * SCALE;
          ctx.fill();
          ctx.restore();
        }
      }
    }
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pixel-design-${config.width}x${config.height}-${pages.length}p${isMask ? "-mask" : ""}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
