import { FONT_3X5, FONT_5X8, FONT_7X9 } from "@/lib/pixel-designer/fonts";

export { FONT_3X5, FONT_5X8, FONT_7X9 };

export function glyph(
  font: Record<string, string[]>,
  ch: string,
): string[] | undefined {
  if (ch in font) return font[ch];
  const upper = ch.toUpperCase();
  if (upper in font) return font[upper];
  return font[" "];
}
