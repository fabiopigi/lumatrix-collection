import fontsData from "../../shared/fonts.json";

type GlyphSet = Record<string, string[]>;

interface FontsFile {
  fonts: {
    "3x5": { glyphs: GlyphSet };
    "5x8": { glyphs: GlyphSet };
  };
}

/** Strip leading + trailing all-dot columns from a glyph. Entirely-empty
 *  glyphs (space) are preserved so they still contribute horizontal space. */
function trimGlyph(rows: string[]): string[] {
  if (rows.length === 0) return rows;
  const w = rows[0].length;
  if (w === 0) return rows;
  let left = 0;
  while (left < w && rows.every((r) => r[left] === ".")) left++;
  if (left === w) return rows;
  let right = w - 1;
  while (right > left && rows.every((r) => r[right] === ".")) right--;
  if (left === 0 && right === w - 1) return rows;
  return rows.map((r) => r.slice(left, right + 1));
}

function trimFont(font: GlyphSet): GlyphSet {
  const out: GlyphSet = {};
  for (const ch of Object.keys(font)) out[ch] = trimGlyph(font[ch]);
  return out;
}

const data = fontsData as unknown as FontsFile;

export const FONT_3X5: GlyphSet = trimFont(data.fonts["3x5"].glyphs);
export const FONT_5X8: GlyphSet = trimFont(data.fonts["5x8"].glyphs);

/** Pixel gap inserted between glyphs when rendering text. */
export const KERNING_GAP = 1;

export function glyph(font: GlyphSet, ch: string): string[] | undefined {
  if (ch in font) return font[ch];
  const upper = ch.toUpperCase();
  if (upper in font) return font[upper];
  return font[" "];
}
