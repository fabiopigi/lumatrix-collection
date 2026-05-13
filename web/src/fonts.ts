import fontsData from "../../shared/fonts.json";

type GlyphSet = Record<string, string[]>;

interface FontsFile {
  fonts: {
    "3x5": { glyphs: GlyphSet };
    "5x8": { glyphs: GlyphSet };
  };
}

const data = fontsData as unknown as FontsFile;

export const FONT_3X5: GlyphSet = data.fonts["3x5"].glyphs;
export const FONT_5X8: GlyphSet = data.fonts["5x8"].glyphs;

export function glyph(font: GlyphSet, ch: string): string[] | undefined {
  if (ch in font) return font[ch];
  const upper = ch.toUpperCase();
  if (upper in font) return font[upper];
  return font[" "];
}
