import type { Config } from "./types";

export function computeLedIndex(x: number, y: number, cfg: Config): number {
  let col = x;
  let row = y;
  if (cfg.origin.endsWith("right")) col = cfg.width - 1 - x;
  if (cfg.origin.startsWith("bottom")) row = cfg.height - 1 - y;
  if (cfg.axis === "row") {
    let secondary = col;
    if (cfg.serpentine && row % 2 === 1) secondary = cfg.width - 1 - col;
    return row * cfg.width + secondary;
  }
  let secondary = row;
  if (cfg.serpentine && col % 2 === 1) secondary = cfg.height - 1 - row;
  return col * cfg.height + secondary;
}

export function computeFromLed(idx: number, cfg: Config): { x: number; y: number } {
  let col: number;
  let row: number;
  if (cfg.axis === "row") {
    row = Math.floor(idx / cfg.width);
    col = idx % cfg.width;
    if (cfg.serpentine && row % 2 === 1) col = cfg.width - 1 - col;
  } else {
    col = Math.floor(idx / cfg.height);
    row = idx % cfg.height;
    if (cfg.serpentine && col % 2 === 1) row = cfg.height - 1 - row;
  }
  const x = cfg.origin.endsWith("right") ? cfg.width - 1 - col : col;
  const y = cfg.origin.startsWith("bottom") ? cfg.height - 1 - row : row;
  return { x, y };
}
