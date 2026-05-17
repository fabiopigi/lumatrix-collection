"""Responsive shared lifecycle screens.

Port of web-toolkit/src/lib/simulator/screens.ts (source of truth).

init(np, joy, w, h) binds the rendering buffer and the joystick. All drawing
is in visual coords (y=0 = top); the LED-chain origin (row 0 = bottom) is
handled by the index helper below. Apps call screens.init with the W×H buffer
the launcher passes them as `screens_np`.

Designs:
  * loading_screen: dark-blue ring + bright-blue head rotating clockwise.
    Ring grows with min(w, h): 4 px (≤8), 8 px diamond (≤16), 16 px circle.
  * game_over_screen: scrolling red/orange checker banner on top (+ bottom
    when h has room), score centered (or marqueed) in size-appropriate font.
    On tall displays (h ≥ 24), also renders a small "SCORE" label above.
  * end_screen: scrolling blue/green checker banner + filled left-pointing
    arrow in amber.
"""

from time import sleep_ms, ticks_ms, ticks_diff

from _fonts import FONT_3X5, FONT_5X8, FONT_7X9, KERNING_GAP, glyph as font_glyph


EXIT_HOLD_MS = 1500
LOADING_STEP_MS = 150
BANNER_STEP_MS = 120
MARQUEE_STEP_MS = 90
BRIGHTNESS = 0.25


def _hex_dim(hex_str, scale=BRIGHTNESS):
    h = hex_str.lstrip("#")
    return (int(int(h[0:2], 16) * scale),
            int(int(h[2:4], 16) * scale),
            int(int(h[4:6], 16) * scale))


LOADING_DIM       = _hex_dim("#000080")
LOADING_BRIGHT    = _hex_dim("#0080ff")
BANNER_RED        = _hex_dim("#ff0000")
BANNER_ORANGE     = _hex_dim("#ffa040")
BANNER_BLUE       = _hex_dim("#0080ff")
BANNER_GREEN      = _hex_dim("#00ff80")
SCORE_COLOR       = _hex_dim("#0080ff")
SCORE_LABEL_COLOR = _hex_dim("#000080")
END_ARROW         = _hex_dim("#ffc000")

GAMEOVER_PALETTE = (BANNER_RED, BANNER_ORANGE)
END_PALETTE      = (BANNER_BLUE, BANNER_GREEN)


_np = None
_joy = None
_w = 8
_h = 8
_exit_press_start = None
_exit_consumed = False


def init(neopixel, joystick, w=None, h=None):
    """Bind hardware refs. Call once at the start of run().
    w / h default to 8 so apps that haven't been updated keep working."""
    global _np, _joy, _w, _h, _exit_press_start, _exit_consumed
    _np = neopixel
    _joy = joystick
    _w = w if w is not None else 8
    _h = h if h is not None else 8
    _exit_press_start = None
    _exit_consumed = False


# ─── Buffer helpers ──────────────────────────────────────────────────────────
def _led_index(x, y):
    """Visual (x, y) with y=0 = top → LED-chain index with row 0 = bottom."""
    return (_h - 1 - y) * _w + x


def _set_px(x, y, color):
    if 0 <= x < _w and 0 <= y < _h:
        _np[_led_index(x, y)] = color


def _clear():
    for i in range(_w * _h):
        _np[i] = (0, 0, 0)


# ─── Input helpers ───────────────────────────────────────────────────────────
def any_input():
    """True if any directional button (up/down/left/right) is held — center
    is excluded so callers can distinguish a tap from a hold-to-exit."""
    return (_joy["up"].value() == 0 or _joy["down"].value() == 0 or
            _joy["left"].value() == 0 or _joy["right"].value() == 0)


def _any_pressed():
    return any_input() or _joy["center"].value() == 0


def _wait_release():
    while _any_pressed():
        sleep_ms(10)


def check_exit():
    """Non-blocking hold-center exit detector. Returns True once when the
    1.5 s threshold is crossed; callers should treat that as a one-shot."""
    global _exit_press_start, _exit_consumed
    if _joy is None:
        return False
    if _joy["center"].value() == 0:
        now = ticks_ms()
        if _exit_press_start is None:
            _exit_press_start = now
            _exit_consumed = False
        elif (not _exit_consumed and
              ticks_diff(now, _exit_press_start) >= EXIT_HOLD_MS):
            _exit_consumed = True
            return True
    else:
        _exit_press_start = None
        _exit_consumed = False
    return False


def _decision_input():
    """Returns 'exit' (center held ≥1.5 s), 'restart' (center released before
    hold threshold OR any directional input), or None."""
    global _exit_press_start, _exit_consumed
    if _joy["center"].value() == 0:
        now = ticks_ms()
        if _exit_press_start is None:
            _exit_press_start = now
            _exit_consumed = False
        elif (not _exit_consumed and
              ticks_diff(now, _exit_press_start) >= EXIT_HOLD_MS):
            _exit_consumed = True
            return "exit"
    else:
        if _exit_press_start is not None and not _exit_consumed:
            _exit_press_start = None
            return "restart"
        _exit_press_start = None
        _exit_consumed = False
    if any_input():
        return "restart"
    return None


# ─── Loading screen ──────────────────────────────────────────────────────────
def _loading_ring():
    """Ring positions in visual (x, y), clockwise from the top-most pair."""
    m = _w if _w < _h else _h
    cx = _w // 2
    cy = _h // 2

    if m <= 8:
        # 4-pixel ring (2×2 at center), clockwise from top-left.
        return ((cx - 1, cy - 1), (cx, cy - 1), (cx, cy), (cx - 1, cy))
    if m <= 16:
        # 8-pixel diamond ring, clockwise from top.
        return (
            (cx - 1, cy - 2), (cx, cy - 2),
            (cx + 1, cy - 1), (cx + 1, cy),
            (cx, cy + 1), (cx - 1, cy + 1),
            (cx - 2, cy), (cx - 2, cy - 1),
        )
    # 16-pixel circle ring, clockwise from top.
    return (
        (cx - 1, cy - 4), (cx, cy - 4),
        (cx + 1, cy - 3), (cx + 2, cy - 2),
        (cx + 3, cy - 1), (cx + 3, cy),
        (cx + 2, cy + 1), (cx + 1, cy + 2),
        (cx, cy + 3), (cx - 1, cy + 3),
        (cx - 2, cy + 2), (cx - 3, cy + 1),
        (cx - 4, cy), (cx - 4, cy - 1),
        (cx - 3, cy - 2), (cx - 2, cy - 3),
    )


def loading_screen():
    """Spinner. Blocks until user reacts.
    Returns 'start' (any press) or 'exit' (hold center 1.5 s)."""
    global _exit_press_start, _exit_consumed
    _exit_press_start = None
    _exit_consumed = False
    _wait_release()

    ring = _loading_ring()
    n = len(ring)
    head = 0
    last_step = ticks_ms() - LOADING_STEP_MS
    center_start = None

    while True:
        now = ticks_ms()

        if _joy["center"].value() == 0:
            if center_start is None:
                center_start = now
            elif ticks_diff(now, center_start) >= EXIT_HOLD_MS:
                while _joy["center"].value() == 0:
                    sleep_ms(20)
                return "exit"
        elif center_start is not None:
            center_start = None
            return "start"

        if any_input():
            while any_input():
                sleep_ms(10)
            return "start"

        if ticks_diff(now, last_step) >= LOADING_STEP_MS:
            last_step = now
            _clear()
            for i in range(n):
                x, y = ring[i]
                _set_px(x, y, LOADING_BRIGHT if i == head else LOADING_DIM)
            _np.write()
            head = (head + 1) % n

        sleep_ms(15)


# ─── Banner ──────────────────────────────────────────────────────────────────
def _banner_layout():
    """Return (top_rows, bottom_rows) sized to display height."""
    if _h <= 8:  return (2, 0)
    if _h <= 12: return (3, 2)
    if _h <= 16: return (4, 3)
    if _h <= 24: return (4, 4)
    return (5, 5)


def _shows_score_label():
    return _h >= 24


def _small_banner_color(x, y, phase, palette):
    """8×8: fully packed 2-color checker."""
    return palette[1] if (x + y + phase) % 2 == 0 else palette[0]


def _large_banner_color(x, y, phase, scroll_right, palette):
    """Larger: half-packed 4×4 tile.
    Lit cells: (tx + ty) even, where (tx, ty) = (x ± phase, y) mod 4.
    Within lit cells, color alternates by 2×2 sub-block parity.
    Returns None for dark cells."""
    x_off = -phase if scroll_right else phase
    tx = (x + x_off) % 4
    ty = y % 4
    if (tx + ty) % 2 != 0:
        return None
    return palette[0] if (tx // 2 + ty // 2) % 2 == 0 else palette[1]


def _draw_top_banner(rows, phase, palette):
    if rows <= 0:
        return
    if _h <= 8:
        for y in range(rows):
            for x in range(_w):
                _set_px(x, y, _small_banner_color(x, y, phase, palette))
        return
    for y in range(rows):
        for x in range(_w):
            c = _large_banner_color(x, y, phase, True, palette)
            if c is not None:
                _set_px(x, y, c)


def _draw_bottom_banner(rows, phase, palette):
    if rows <= 0:
        return
    top = _h - rows
    for local_y in range(rows):
        for x in range(_w):
            c = _large_banner_color(x, local_y, phase, False, palette)
            if c is not None:
                _set_px(x, top + local_y, c)


# ─── Text helpers ────────────────────────────────────────────────────────────
def _font_height(font):
    for ch in font:
        g = font[ch]
        if g:
            return len(g)
    return 0


def _choose_score_font():
    if _h <= 8:
        return FONT_3X5, _font_height(FONT_3X5)
    if _h <= 16:
        return FONT_5X8, _font_height(FONT_5X8)
    if FONT_7X9:
        return FONT_7X9, _font_height(FONT_7X9)
    return FONT_5X8, _font_height(FONT_5X8)


def _measure_text(text, font):
    total = 0
    n = len(text)
    for i in range(n):
        g = font_glyph(font, text[i])
        if not g or not g[0]:
            continue
        total += len(g[0])
        if i < n - 1:
            total += KERNING_GAP
    return total


def _draw_text(text, x0, y0, font, color):
    cx = x0
    for ch in text:
        g = font_glyph(font, ch)
        if not g or not g[0]:
            continue
        w = len(g[0])
        for gy in range(len(g)):
            row = g[gy]
            for gx in range(w):
                if row[gx] == "X":
                    _set_px(cx + gx, y0 + gy, color)
        cx += w + KERNING_GAP


def _score_y_range():
    top_b, bot_b = _banner_layout()
    label_rows = (_font_height(FONT_3X5) + 1) if _shows_score_label() else 0
    top = top_b + 1 + label_rows           # 1-row gap below banner
    bottom = _h - bot_b - 1                # 1-row gap above bottom banner
    height = bottom - top
    if height < 0:
        height = 0
    return top, height


def _score_label_y():
    top_b, _ = _banner_layout()
    return top_b + 2


# ─── Game-over screen ────────────────────────────────────────────────────────
def _show_static_gameover(text):
    font, font_h = _choose_score_font()
    top_b, bot_b = _banner_layout()
    range_y0, range_h = _score_y_range()
    score_y0 = range_y0 + max(0, (range_h - font_h) // 2)
    text_w = _measure_text(text, font)
    score_x0 = max(0, (_w - text_w) // 2)

    label_text = "SCORE"
    label_w = _measure_text(label_text, FONT_3X5) if _shows_score_label() else 0
    label_x = max(0, (_w - label_w) // 2)
    label_y = _score_label_y()
    show_label = _shows_score_label()

    phase = 0
    last_step = ticks_ms()

    def frame():
        _clear()
        _draw_top_banner(top_b, phase, GAMEOVER_PALETTE)
        _draw_bottom_banner(bot_b, phase, GAMEOVER_PALETTE)
        if show_label:
            _draw_text(label_text, label_x, label_y, FONT_3X5, SCORE_LABEL_COLOR)
        _draw_text(text, score_x0, score_y0, font, SCORE_COLOR)
        _np.write()

    frame()
    while True:
        r = _decision_input()
        if r == "exit":
            while _joy["center"].value() == 0:
                sleep_ms(20)
            return "exit"
        if r == "restart":
            while any_input():
                sleep_ms(10)
            return "restart"
        now = ticks_ms()
        if ticks_diff(now, last_step) >= BANNER_STEP_MS:
            last_step = now
            phase = (phase + 1) % 4
            frame()
        sleep_ms(15)


def _marquee_gameover(text):
    font, font_h = _choose_score_font()
    top_b, bot_b = _banner_layout()
    range_y0, range_h = _score_y_range()
    score_y0 = range_y0 + max(0, (range_h - font_h) // 2)
    text_w = _measure_text(text, font)
    total = text_w + _w  # text + 1-display-width trailing gap

    label_text = "SCORE"
    label_w = _measure_text(label_text, FONT_3X5) if _shows_score_label() else 0
    label_x = max(0, (_w - label_w) // 2)
    label_y = _score_label_y()
    show_label = _shows_score_label()

    banner_phase = 0
    scroll_offset = -_w  # start fully off the right
    last_banner = ticks_ms()
    last_scroll = ticks_ms()

    def frame():
        _clear()
        _draw_top_banner(top_b, banner_phase, GAMEOVER_PALETTE)
        _draw_bottom_banner(bot_b, banner_phase, GAMEOVER_PALETTE)
        if show_label:
            _draw_text(label_text, label_x, label_y, FONT_3X5, SCORE_LABEL_COLOR)
        _draw_text(text, -scroll_offset, score_y0, font, SCORE_COLOR)
        _np.write()

    frame()
    while True:
        r = _decision_input()
        if r == "exit":
            while _joy["center"].value() == 0:
                sleep_ms(20)
            return "exit"
        if r == "restart":
            while any_input():
                sleep_ms(10)
            return "restart"
        now = ticks_ms()
        dirty = False
        if ticks_diff(now, last_banner) >= BANNER_STEP_MS:
            last_banner = now
            banner_phase = (banner_phase + 1) % 4
            dirty = True
        if ticks_diff(now, last_scroll) >= MARQUEE_STEP_MS:
            last_scroll = now
            scroll_offset += 1
            if scroll_offset > total:
                scroll_offset = -_w
            dirty = True
        if dirty:
            frame()
        sleep_ms(15)


def game_over_screen(score):
    """Scrolling red/orange banner + score, with marquee if score doesn't fit.
    Blocks until decision. Returns 'restart' (tap) or 'exit' (hold center)."""
    global _exit_press_start, _exit_consumed
    _exit_press_start = None
    _exit_consumed = False
    _wait_release()

    text = str(int(score))
    font, _fh = _choose_score_font()
    text_w = _measure_text(text, font)
    if text_w <= _w:
        return _show_static_gameover(text)
    return _marquee_gameover(text)


# ─── End screen ──────────────────────────────────────────────────────────────
# 8×8 arrow — original kit design, single-pixel diagonals. Bbox is (6 wide, 5
# tall) so it composes the same way as the larger ones.
_ARROW_8_PIXELS = (
    (2, 0),
    (1, 1),
    (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (5, 2),
    (1, 3),
    (2, 4),
)
_ARROW_8_W = 6
_ARROW_8_H = 5


def _make_arrow(bbox_w, bbox_h, shaft_rows):
    """Filled isoceles-triangle head whose apex sits on the bbox's left edge,
    plus a thick rectangular shaft running to the right edge."""
    pixels = []
    cy = (bbox_h - 1) // 2
    head_width = cy + 1  # 45° head: at row y the leftmost x = |y - cy|
    shaft_top = cy - shaft_rows // 2
    shaft_bottom = shaft_top + shaft_rows - 1
    for y in range(bbox_h):
        dy = y - cy
        x_left = dy if dy >= 0 else -dy
        if x_left >= head_width:
            continue
        in_shaft = shaft_top <= y <= shaft_bottom
        x_right = bbox_w - 1 if in_shaft else head_width - 1
        for x in range(x_left, x_right + 1):
            pixels.append((x, y))
    return tuple(pixels), bbox_w, bbox_h


_ARROW_16_PIXELS, _ARROW_16_W, _ARROW_16_H = _make_arrow(14, 9, 3)
_ARROW_32_PIXELS, _ARROW_32_W, _ARROW_32_H = _make_arrow(28, 19, 5)


def _choose_arrow():
    """Pick the largest pre-designed arrow that fits in the middle band.
    The 8×8 fallback gets integer-scaled if both dims have room."""
    top_b, bot_b = _banner_layout()
    middle_h = _h - top_b - bot_b
    if _w >= _ARROW_32_W and middle_h >= _ARROW_32_H:
        return _ARROW_32_PIXELS, _ARROW_32_W, _ARROW_32_H, 1
    if _w >= _ARROW_16_W and middle_h >= _ARROW_16_H:
        return _ARROW_16_PIXELS, _ARROW_16_W, _ARROW_16_H, 1
    scale_x = _w // _ARROW_8_W
    scale_y = middle_h // _ARROW_8_H
    scale = scale_x if scale_x < scale_y else scale_y
    if scale < 1:
        scale = 1
    return _ARROW_8_PIXELS, _ARROW_8_W, _ARROW_8_H, scale


def _draw_end_arrow():
    top_b, bot_b = _banner_layout()
    middle_top = top_b
    middle_h = _h - top_b - bot_b
    pixels, w, h, scale = _choose_arrow()
    rendered_w = w * scale
    rendered_h = h * scale
    off_x = (_w - rendered_w) // 2
    off_y = middle_top + (middle_h - rendered_h) // 2
    for vx, vy in pixels:
        for dy in range(scale):
            for dx in range(scale):
                _set_px(off_x + vx * scale + dx, off_y + vy * scale + dy, END_ARROW)


def end_screen():
    """Scrolling blue/green banner + amber left arrow.
    Blocks until decision. Returns 'restart' (tap) or 'exit' (hold center)."""
    global _exit_press_start, _exit_consumed
    _exit_press_start = None
    _exit_consumed = False
    _wait_release()

    top_b, bot_b = _banner_layout()
    phase = 0
    last_step = ticks_ms()

    def frame():
        _clear()
        _draw_top_banner(top_b, phase, END_PALETTE)
        _draw_bottom_banner(bot_b, phase, END_PALETTE)
        _draw_end_arrow()
        _np.write()

    frame()
    while True:
        r = _decision_input()
        if r == "exit":
            while _joy["center"].value() == 0:
                sleep_ms(20)
            return "exit"
        if r == "restart":
            while any_input():
                sleep_ms(10)
            return "restart"
        now = ticks_ms()
        if ticks_diff(now, last_step) >= BANNER_STEP_MS:
            last_step = now
            phase = (phase + 1) % 4
            frame()
        sleep_ms(15)


# ─── show_digit_briefly ──────────────────────────────────────────────────────
def show_digit_briefly(digit, color, hold_ms):
    """Render a number centered in the full display, hold for hold_ms. Useful
    for in-game transitions (level number, lives remaining). Returns 'exit'
    if the user holds center to bail mid-display, else None."""
    text = str(int(digit))
    font, font_h = _choose_score_font()
    text_w = _measure_text(text, font)
    x0 = max(0, (_w - text_w) // 2)
    y0 = max(0, (_h - font_h) // 2)
    _clear()
    _draw_text(text, x0, y0, font, color)
    _np.write()
    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < hold_ms:
        if check_exit():
            return "exit"
        sleep_ms(15)
    return None
