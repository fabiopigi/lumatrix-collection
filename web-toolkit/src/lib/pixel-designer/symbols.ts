import type { Point } from "./types";

export const SYMBOLS: Record<string, string[]> = {
  heart: [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."],
  smiley: [".XXXXX.", "X.X.X.X", "X.....X", "X.X.X.X", "X.XXX.X", "X.....X", ".XXXXX."],
  star: ["...X...", "...X...", ".XXXXX.", "..XXX..", ".X...X."],
  plus: ["..X..", "..X..", "XXXXX", "..X..", "..X.."],
  cross: ["X...X", ".X.X.", "..X..", ".X.X.", "X...X"],
  check: ["....X", "...X.", "X.X..", ".X...", "....."],
  arrUp: ["..X..", ".XXX.", "X.X.X", "..X..", "..X.."],
  arrDn: ["..X..", "..X..", "X.X.X", ".XXX.", "..X.."],
  arrLt: ["..X..", ".X...", "XXXXX", ".X...", "..X.."],
  arrRt: ["..X..", "...X.", "XXXXX", "...X.", "..X.."],
  diamond: ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."],
  hash: [".X.X.", "XXXXX", ".X.X.", "XXXXX", ".X.X."],
  dot: [".XXX.", "XXXXX", "XXXXX", "XXXXX", ".XXX."],
  ring: [".XXX.", "X...X", "X...X", "X...X", ".XXX."],
  bell: ["..X..", ".XXX.", ".XXX.", "XXXXX", "..X.."],
  triangle: ["..X..", ".XXX.", ".XXX.", "XXXXX", "XXXXX"],
  sun: ["X.X.X", ".XXX.", "XXXXX", ".XXX.", "X.X.X"],
  note: ["..XX.", "..X.X", "..X..", "XXX..", "XX..."],
};

export function symbolPoints(
  key: string,
  x0: number,
  y0: number,
): Point[] {
  const rows = SYMBOLS[key];
  if (!rows) return [];
  const out: Point[] = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] === "X") out.push({ x: x0 + x, y: y0 + y });
    }
  }
  return out;
}
