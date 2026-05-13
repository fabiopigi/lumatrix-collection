/**
 * Physical letter overlay printed on the LUMATRIX matrix. 8 rows, 8 chars each,
 * top row first. To change it on a different hardware unit, edit this constant
 * and recompile — the simulator can't change what's silk-screened on the device.
 */
export const LETTER_MASK = [
  "ZATWENTY",
  "HQUARTER",
  "AHALFIVE",
  "WTPASTOR",
  "FIVEIGHT",
  "SIXTHREE",
  "TWELEVEN",
  "FOURNINE",
] as const;

export const MATRIX_WIDTH = 8;
export const MATRIX_HEIGHT = 8;

export function letterAt(x: number, y: number): string {
  if (y < 0 || y >= LETTER_MASK.length) return "";
  const row = LETTER_MASK[y];
  if (x < 0 || x >= row.length) return "";
  const ch = row[x];
  return ch === "." || ch === " " ? "" : ch;
}
