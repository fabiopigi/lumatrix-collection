"""Common font definitions for LumenLab apps.

Loaded from /fonts.json on the Pico filesystem at import time. Exposes two
dicts of {char: [rows of '.' / 'X']}:

  FONT_3X5 — 3 cols wide, 5 rows tall. Uppercase A-Z, digits, basic punctuation.
  FONT_5X8 — 5 cols wide, 8 rows tall (7 visible + blank baseline). Adds
             lowercase a-z and a few more punctuation glyphs.

If /fonts.json is missing or unreadable, a small embedded fallback covering
just digits is used so apps/screens.py (game-over scores) keep working.

Usage:
    from _fonts import FONT_3X5, FONT_5X8, glyph
    g = glyph(FONT_3X5, ch)   # falls back ch -> ch.upper() -> ' '
"""

import json


_FALLBACK_3X5 = {
    "0": ["XXX", "X.X", "X.X", "X.X", "XXX"],
    "1": ["XX.", ".X.", ".X.", ".X.", "XXX"],
    "2": ["XX.", "..X", ".X.", "X..", "XXX"],
    "3": ["XX.", "..X", ".X.", "..X", "XX."],
    "4": ["X.X", "X.X", "XXX", "..X", "..X"],
    "5": ["XXX", "X..", "XX.", "..X", "XX."],
    "6": [".XX", "X..", "XX.", "X.X", ".X."],
    "7": ["XXX", "..X", ".X.", "X..", "X.."],
    "8": [".X.", "X.X", ".X.", "X.X", ".X."],
    "9": [".X.", "X.X", ".XX", "..X", "XX."],
    " ": ["...", "...", "...", "...", "..."],
    "-": ["...", "...", "XXX", "...", "..."],
}


def _trim_glyph(rows):
    """Strip leading + trailing all-dot columns. Preserve all-empty glyphs
    (space) at original width so they still contribute horizontal space."""
    if not rows:
        return rows
    w = len(rows[0])
    if w == 0:
        return rows
    left = 0
    while left < w and all(r[left] == "." for r in rows):
        left += 1
    if left == w:
        return rows
    right = w - 1
    while right > left and all(r[right] == "." for r in rows):
        right -= 1
    if left == 0 and right == w - 1:
        return rows
    return [r[left:right + 1] for r in rows]


def _trim_font(font):
    return {ch: _trim_glyph(rows) for ch, rows in font.items()}


def _load():
    try:
        with open("/_fonts.json") as f:
            data = json.load(f)
        fonts = data["fonts"]
        return _trim_font(fonts["3x5"]["glyphs"]), _trim_font(fonts["5x8"]["glyphs"])
    except (OSError, ValueError, KeyError):
        return _trim_font(_FALLBACK_3X5), {}


FONT_3X5, FONT_5X8 = _load()

# Pixel gap inserted between glyphs when rendering text. All bundled fonts
# are now proportional (no fully-empty leading/trailing columns); renderers
# advance the cursor by (glyph_width + KERNING_GAP) per character.
KERNING_GAP = 1


def glyph(font, ch):
    """Look up a glyph with the standard fallback chain:
       exact char -> ch.upper() -> ' ' (space). Returns None if even ' ' missing."""
    if ch in font:
        return font[ch]
    u = ch.upper()
    if u in font:
        return font[u]
    return font.get(" ")
