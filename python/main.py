"""LumenLab launcher (responsive port of web-toolkit/src/lib/simulator/launcher.ts).

The JS launcher is source of truth. Major behaviors mirrored here:
  * Boot animation from /boot-animation.json (white + blue parts, independent
    fade-in, per-pixel ±5% flicker re-rolled stochastically, 500 ms fade-out).
  * W×H responsive layout: font picked by display height (3×5 / 5×8 / 7×9),
    marquee step time scaled by display width, track wraps to multiple rows.
  * Marquee ease-in: 500 ms read-pause at offset 0, 500 ms linear accel to
    full speed, then constant pace.
  * Dual buffers: display_np drives the real chain at native W×H. Non-
    responsive apps still write to an 8×8 source buffer (lumatrix_np); on
    bigger displays that buffer is virtual and integer-scaled + centered onto
    display_np on every write.
"""

import sys
sys.path.append("/apps")

import json
import random
from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff

from _fonts import FONT_3X5, FONT_5X8, FONT_7X9, KERNING_GAP, glyph as font_glyph


# ─── Hardware + app config ───────────────────────────────────────────────────
# Defaults are 8×8 LumaTrix with all canonical apps in simulator order. If a
# /config.py exists (written by LumenFlash on flash), it overrides any of:
#   DISPLAY_WIDTH, DISPLAY_HEIGHT, LED_PIN, APPS_ENABLED (tuple of app ids).
_DEFAULT_ORDER = (
    "reaction", "connect4", "pong", "breakout", "simonsays", "dinojump",
    "snake", "flappy", "invaders", "doom", "watch", "tictactoe"
)
DISPLAY_WIDTH = 8
DISPLAY_HEIGHT = 8
LED_PIN = 19
_ENABLED = _DEFAULT_ORDER
try:
    import config as _cfg
    DISPLAY_WIDTH = getattr(_cfg, "DISPLAY_WIDTH", DISPLAY_WIDTH)
    DISPLAY_HEIGHT = getattr(_cfg, "DISPLAY_HEIGHT", DISPLAY_HEIGHT)
    LED_PIN = getattr(_cfg, "LED_PIN", LED_PIN)
    _ENABLED = getattr(_cfg, "APPS_ENABLED", _DEFAULT_ORDER) or _DEFAULT_ORDER
except ImportError:
    pass

JOY = {
    "up":     Pin(3, Pin.IN),
    "down":   Pin(6, Pin.IN),
    "left":   Pin(7, Pin.IN),
    "right":  Pin(2, Pin.IN),
    "center": Pin(8, Pin.IN),
    "slide":  Pin(9, Pin.IN),
}

# Import each enabled app individually so a missing module doesn't crash boot.
APPS = []
for _name in _ENABLED:
    try:
        APPS.append(__import__(_name))
    except ImportError:
        pass


# ─── Colors ──────────────────────────────────────────────────────────────────
BRIGHTNESS = 0.25


def hex_dim(hex_str, scale=BRIGHTNESS):
    h = hex_str.lstrip("#")
    return (int(int(h[0:2], 16) * scale),
            int(int(h[2:4], 16) * scale),
            int(int(h[4:6], 16) * scale))


NAME_COLOR   = hex_dim("#0080ff")
TRACK_DIM    = hex_dim("#000080")
TRACK_BRIGHT = hex_dim("#0080ff")

BOOT_WHITE_HEX = "#b8b8c0"
BOOT_BLUE_HEX  = "#0080ff"
BOOT_WHITE_BASE = hex_dim(BOOT_WHITE_HEX)
BOOT_BLUE_BASE  = hex_dim(BOOT_BLUE_HEX)

BOOT_FRAME_MS = 33           # ~30 fps
BOOT_TOTAL_MS = 3500
BOOT_WHITE_FADE_IN_END = 1000
BOOT_BLUE_FADE_IN_START = 500
BOOT_BLUE_FADE_IN_END = 1500
BOOT_FADE_OUT_START = 3000
BOOT_FADE_OUT_END = 3500
BOOT_FLICKER_AMOUNT = 0.05
# Average ms between flicker re-rolls per pixel — much slower than the frame
# rate so the sparkle reads as "twinkle" rather than full-rate noise.
BOOT_FLICKER_STEP_MS = 150


# ─── Display state ───────────────────────────────────────────────────────────
_W = DISPLAY_WIDTH
_H = DISPLAY_HEIGHT
np = None  # currently active buffer (set in main())


def _led_index(x, y):
    """(x, y) with (0, 0) at top-left visually; bottom-left LED origin."""
    return (_H - 1 - y) * _W + x


def _set_px(x, y, color):
    if 0 <= x < _W and 0 <= y < _H:
        np[_led_index(x, y)] = color


def _clear():
    for i in range(_W * _H):
        np[i] = (0, 0, 0)


def _marquee_step_ms():
    """Step time scales with display width — wider displays scroll faster."""
    if _W <= 8:
        return 100
    if _W <= 16:
        return 75
    return 50


# ─── Virtual 8×8 buffer for legacy apps ──────────────────────────────────────
class _LegacyBuffer:
    """Duck-typed NeoPixel: legacy 8×8 apps write here; on .write() the contents
    are integer-scaled and center-blitted onto the real display, then flushed.

    Apps use np[i] = (r,g,b) indexing with (7-y)*8+x addressing — we mirror
    that addressing exactly.
    """

    def __init__(self, display_np):
        self._pixels = [(0, 0, 0)] * 64
        self._display = display_np
        scale = min(_W // 8, _H // 8)
        self._scale = scale if scale >= 1 else 1
        self._ox = (_W - 8 * self._scale) // 2
        self._oy = (_H - 8 * self._scale) // 2

    def __setitem__(self, i, color):
        self._pixels[i] = color

    def __getitem__(self, i):
        return self._pixels[i]

    def __len__(self):
        return 64

    def write(self):
        s = self._scale
        ox = self._ox
        oy = self._oy
        # Clear the display buffer so retired pixels don't ghost when the
        # legacy 8×8 doesn't cover the full display.
        for i in range(_W * _H):
            self._display[i] = (0, 0, 0)
        for y in range(8):
            for x in range(8):
                color = self._pixels[(7 - y) * 8 + x]
                if color == (0, 0, 0):
                    continue
                for dy in range(s):
                    py = oy + y * s + dy
                    if py < 0 or py >= _H:
                        continue
                    base = (_H - 1 - py) * _W
                    for dx in range(s):
                        px = ox + x * s + dx
                        if 0 <= px < _W:
                            self._display[base + px] = color
        self._display.write()


# ─── Font selection ──────────────────────────────────────────────────────────
def _font_height(font):
    for ch in font:
        g = font[ch]
        if g:
            return len(g)
    return 0


def _choose_font():
    if _H <= 8:
        return FONT_3X5, _font_height(FONT_3X5)
    if _H <= 16:
        return FONT_5X8, _font_height(FONT_5X8)
    if FONT_7X9:
        return FONT_7X9, _font_height(FONT_7X9)
    return FONT_5X8, _font_height(FONT_5X8)


# ─── Text rendering ──────────────────────────────────────────────────────────
def _text_to_bitmap(text, font, trailing_gap):
    """Render `text` to a list of glyph rows separated by KERNING_GAP dots,
    plus `trailing_gap` dots at the end. Returns (rows, width, height)."""
    fh = _font_height(font)
    rows = [""] * fh
    sep = "." * KERNING_GAP
    for ch in text:
        g = font_glyph(font, ch)
        if not g:
            continue
        w = len(g[0]) if g[0] else 0
        for i in range(fh):
            row = g[i] if i < len(g) else "." * w
            rows[i] += row + sep
    pad = "." * trailing_gap
    for i in range(fh):
        rows[i] += pad
    width = len(rows[0]) if rows else 0
    return rows, width, fh


def _draw_bitmap_window(bitmap, offset, color, x0, y0, window_w, wrap):
    rows, total, height = bitmap
    if total <= 0:
        return
    for y in range(height):
        row = rows[y]
        for x in range(window_w):
            if wrap:
                src = (offset + x) % total
            else:
                src = offset + x
                if src < 0 or src >= total:
                    continue
            if row[src] == "X":
                _set_px(x0 + x, y0 + y, color)


# ─── Track + marquee layout ──────────────────────────────────────────────────
def _track_top_y(total_apps):
    rows = (total_apps + _W - 1) // _W  # ceil(total / W)
    if rows < 1:
        rows = 1
    return _H - rows


def _draw_track(current_idx, total_apps):
    top_y = _track_top_y(total_apps)
    for i in range(total_apps):
        row = i // _W
        col = i % _W
        _set_px(col, top_y + row, TRACK_BRIGHT if i == current_idx else TRACK_DIM)


def _marquee_y0(font_h, total_apps):
    """Available rows above the track minus a 1-row visual gap."""
    space = _track_top_y(total_apps) - 1
    y0 = (space - font_h) // 2
    return y0 if y0 > 0 else 0


def _render_menu(bitmap, offset, idx, total):
    _clear()
    _, _, height = bitmap
    _draw_bitmap_window(bitmap, offset, NAME_COLOR, 0, _marquee_y0(height, total), _W, True)
    _draw_track(idx, total)
    np.write()


# ─── Input ───────────────────────────────────────────────────────────────────
def _read_input():
    if JOY["center"].value() == 0: return "center"
    if JOY["up"].value() == 0:     return "up"
    if JOY["down"].value() == 0:   return "down"
    if JOY["left"].value() == 0:   return "left"
    if JOY["right"].value() == 0:  return "right"
    return None


def _wait_release():
    while _read_input() is not None:
        sleep_ms(10)


# ─── Boot animation ──────────────────────────────────────────────────────────
def _load_boot_pixels():
    """Return (white_xy, blue_xy) for the current W×H, or None if no variant."""
    key = "{}x{}".format(_W, _H)
    try:
        with open("/boot-animation.json") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return None
    try:
        variants = data["pages"][0]["variants"]
    except (KeyError, IndexError, TypeError):
        return None
    pixels = variants.get(key)
    if not pixels:
        return None
    white = []
    blue = []
    for p in pixels:
        c = p["color"].lower()
        xy = (p["x"], p["y"])
        if c == BOOT_WHITE_HEX:
            white.append(xy)
        elif c == BOOT_BLUE_HEX:
            blue.append(xy)
    return white, blue


def _fade_in_alpha(t, start, end):
    if t <= start: return 0.0
    if t >= end:   return 1.0
    return (t - start) / (end - start)


def _fade_out_mult(t):
    if t <= BOOT_FADE_OUT_START: return 1.0
    if t >= BOOT_FADE_OUT_END:   return 0.0
    return 1.0 - (t - BOOT_FADE_OUT_START) / (BOOT_FADE_OUT_END - BOOT_FADE_OUT_START)


def _scale_color(base, k):
    if k <= 0:
        return (0, 0, 0)
    r = int(base[0] * k + 0.5)
    g = int(base[1] * k + 0.5)
    b = int(base[2] * k + 0.5)
    if r < 0: r = 0
    if r > 255: r = 255
    if g < 0: g = 0
    if g > 255: g = 255
    if b < 0: b = 0
    if b > 255: b = 255
    return (r, g, b)


def _roll_flicker():
    return 1.0 + (random.random() * 2.0 - 1.0) * BOOT_FLICKER_AMOUNT


def boot_animation():
    pixels = _load_boot_pixels()
    if not pixels:
        _clear()
        np.write()
        sleep_ms(300)
        return

    white_xy, blue_xy = pixels
    white_flick = [_roll_flicker() for _ in white_xy]
    blue_flick  = [_roll_flicker() for _ in blue_xy]
    reroll_prob = BOOT_FRAME_MS / BOOT_FLICKER_STEP_MS

    start = ticks_ms()
    while True:
        t = ticks_diff(ticks_ms(), start)
        if t >= BOOT_TOTAL_MS:
            break

        fade_out = _fade_out_mult(t)
        a_white = _fade_in_alpha(t, 0, BOOT_WHITE_FADE_IN_END) * fade_out
        a_blue  = _fade_in_alpha(t, BOOT_BLUE_FADE_IN_START, BOOT_BLUE_FADE_IN_END) * fade_out

        for i in range(len(white_flick)):
            if random.random() < reroll_prob:
                white_flick[i] = _roll_flicker()
        for i in range(len(blue_flick)):
            if random.random() < reroll_prob:
                blue_flick[i] = _roll_flicker()

        _clear()
        for i in range(len(white_xy)):
            x, y = white_xy[i]
            _set_px(x, y, _scale_color(BOOT_WHITE_BASE, a_white * white_flick[i]))
        for i in range(len(blue_xy)):
            x, y = blue_xy[i]
            _set_px(x, y, _scale_color(BOOT_BLUE_BASE, a_blue * blue_flick[i]))
        np.write()
        sleep_ms(BOOT_FRAME_MS)

    _clear()
    np.write()
    sleep_ms(150)


# ─── Marquee easing ──────────────────────────────────────────────────────────
MARQUEE_HOLD_MS = 500
MARQUEE_ACCEL_MS = 500


def _marquee_offset_at(elapsed_ms, step_ms):
    """Cumulative pixel offset given elapsed time since the name became active.
    Holds at 0 for HOLD_MS, then integrates a linear-ramp speed over ACCEL_MS
    (offset = t²/(2·ACCEL·step)), then continues at constant pace."""
    if elapsed_ms < MARQUEE_HOLD_MS:
        return 0
    t = elapsed_ms - MARQUEE_HOLD_MS
    accel_px = MARQUEE_ACCEL_MS / (2 * step_ms)
    if t < MARQUEE_ACCEL_MS:
        return int((t * t) / (2 * MARQUEE_ACCEL_MS * step_ms))
    return int(accel_px) + int((t - MARQUEE_ACCEL_MS) / step_ms)


# ─── Menu loop ───────────────────────────────────────────────────────────────
def menu_select():
    font, _fh = _choose_font()
    idx = 0
    bitmap = _text_to_bitmap(APPS[idx].NAME, font, _W)
    offset = 0
    name_start = ticks_ms()

    while True:
        press = _read_input()
        if press == "center":
            _wait_release()
            return idx

        nav = 0
        if press in ("right", "down"):
            nav = 1
        elif press in ("left", "up"):
            nav = -1

        if nav != 0:
            _wait_release()
            idx = (idx + nav) % len(APPS)
            bitmap = _text_to_bitmap(APPS[idx].NAME, font, _W)
            offset = 0
            name_start = ticks_ms()

        elapsed = ticks_diff(ticks_ms(), name_start)
        total_w = bitmap[1]
        if total_w > 0:
            offset = _marquee_offset_at(elapsed, _marquee_step_ms()) % total_w

        _render_menu(bitmap, offset, idx, len(APPS))
        sleep_ms(10)


# ─── Main ────────────────────────────────────────────────────────────────────
def main():
    global np
    display_np = NeoPixel(Pin(LED_PIN, Pin.OUT), _W * _H)
    np = display_np
    # 8×8 hardware: legacy and display are the same buffer (zero overhead).
    # Bigger hardware: legacy apps write to a virtual 8×8 that integer-scales
    # and center-blits onto display_np on every .write().
    if _W == 8 and _H == 8:
        lumatrix_np = display_np
    else:
        lumatrix_np = _LegacyBuffer(display_np)

    boot_animation()
    while True:
        np = display_np
        i = menu_select()
        np = display_np
        _clear()
        np.write()
        sleep_ms(150)

        app = APPS[i]
        # Responsive apps render directly to the full display; legacy 8×8 apps
        # render to lumatrix_np (which is display_np at 8×8, virtual otherwise).
        responsive = getattr(app, "RESPONSIVE", False)
        app_np = display_np if responsive else lumatrix_np
        display = {"width": _W, "height": _H}
        app.run(app_np, JOY, display, display_np)

        np = display_np
        _wait_release()
        sleep_ms(200)


main()
