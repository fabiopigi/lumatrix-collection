import type { Point } from "./types";

/** Hand-typed legacy sprites — the data source for the "Classic" sprite set.
 *  Sizes vary (5×5 to 7×7); the sprite-library loader pads each up to 8×8. */
export const CLASSIC_SPRITE_DATA: Array<{ name: string; rows: string[] }> = [
  { name: "heart",    rows: [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."] },
  { name: "smiley",   rows: [".XXXXX.", "X.X.X.X", "X.....X", "X.X.X.X", "X.XXX.X", "X.....X", ".XXXXX."] },
  { name: "star",     rows: ["...X...", "...X...", ".XXXXX.", "..XXX..", ".X...X."] },
  { name: "plus",     rows: ["..X..", "..X..", "XXXXX", "..X..", "..X.."] },
  { name: "cross",    rows: ["X...X", ".X.X.", "..X..", ".X.X.", "X...X"] },
  { name: "check",    rows: ["....X", "...X.", "X.X..", ".X...", "....."] },
  { name: "arrUp",    rows: ["..X..", ".XXX.", "X.X.X", "..X..", "..X.."] },
  { name: "arrDn",    rows: ["..X..", "..X..", "X.X.X", ".XXX.", "..X.."] },
  { name: "arrLt",    rows: ["..X..", ".X...", "XXXXX", ".X...", "..X.."] },
  { name: "arrRt",    rows: ["..X..", "...X.", "XXXXX", "...X.", "..X.."] },
  { name: "diamond",  rows: ["..X..", ".XXX.", "XXXXX", ".XXX.", "..X.."] },
  { name: "hash",     rows: [".X.X.", "XXXXX", ".X.X.", "XXXXX", ".X.X."] },
  { name: "dot",      rows: [".XXX.", "XXXXX", "XXXXX", "XXXXX", ".XXX."] },
  { name: "ring",     rows: [".XXX.", "X...X", "X...X", "X...X", ".XXX."] },
  { name: "bell",     rows: ["..X..", ".XXX.", ".XXX.", "XXXXX", "..X.."] },
  { name: "triangle", rows: ["..X..", ".XXX.", ".XXX.", "XXXXX", "XXXXX"] },
  { name: "sun",      rows: ["X.X.X", ".XXX.", "XXXXX", ".XXX.", "X.X.X"] },
  { name: "note",     rows: ["..XX.", "..X.X", "..X..", "XXX..", "XX..."] },
];

/** Resolve a sprite's filled cells to absolute points on the canvas grid,
 *  **centred on (cx, cy)** so the cursor lands inside the sprite rather
 *  than at its top-left corner. For even sizes the geometric centre falls
 *  between cells; we round down (floor(size/2)) so the cursor lands one
 *  cell up-and-left of true centre, which matches how most paint tools
 *  position even-sized stamps.
 *
 *  Each point may carry its own colour (for colourful sprites) or none
 *  (the stamp tool falls back to the active brush colour). Out-of-bounds
 *  points are still returned; callers filter against the canvas size. */
export function spritePointsAt(
  pixels: (string | null)[],
  size: number,
  cx: number,
  cy: number,
  colorful: boolean,
): Array<Point & { color?: string }> {
  const ox = cx - Math.floor(size / 2);
  const oy = cy - Math.floor(size / 2);
  const out: Array<Point & { color?: string }> = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = pixels[y * size + x];
      if (!c) continue;
      out.push(
        colorful
          ? { x: ox + x, y: oy + y, color: c }
          : { x: ox + x, y: oy + y },
      );
    }
  }
  return out;
}
