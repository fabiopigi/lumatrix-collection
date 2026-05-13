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
export const NUM_LEDS = MATRIX_WIDTH * MATRIX_HEIGHT;

export function letterAt(x: number, y: number): string {
  if (y < 0 || y >= LETTER_MASK.length) return "";
  const row = LETTER_MASK[y];
  if (x < 0 || x >= row.length) return "";
  const ch = row[x];
  return ch === "." || ch === " " ? "" : ch;
}
