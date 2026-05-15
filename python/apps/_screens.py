"""Shared lifecycle screens for LUMATRIX apps.

Call init() once at the start of run(), then loading_screen() / game_over_screen() /
end_screen() / check_exit() / any_input() as needed. See README.md for the lifecycle
spec and boilerplate.
"""

from time import sleep_ms, ticks_ms, ticks_diff

from _fonts import FONT_3X5 as _FONT

NUM_LEDS = 64
EXIT_HOLD_MS = 1500

LOADING_STEP_MS = 200
MARQUEE_STEP_MS = 90

# Designs scaled to ~25% brightness (source hexes from screen-design JSON).
LOADING_COLOR  = (0, 32, 63)   # #0080ff
GAMEOVER_TOP   = (60, 0, 0)    # #ff0000
SCORE_COLOR    = (60, 45, 0)   # #ffc000
END_TOP        = (0, 60, 30)   # #00ff80
END_ARROW      = (60, 45, 0)   # #ffc000

_np = None
_joy = None
_joy_center = None
_exit_press_start = None


# Left-pointing arrow used on the End screen, in visual (x, y) with y=0 at top.
_END_ARROW_PIXELS = (
    (3, 3),
    (2, 4),
    (1, 5), (2, 5), (3, 5), (4, 5), (5, 5), (6, 5),
    (2, 6),
    (3, 7),
)


def init(neopixel, joystick):
    """Bind hardware refs. Call once at the start of run()."""
    global _np, _joy, _joy_center, _exit_press_start
    _np = neopixel
    _joy = joystick
    _joy_center = joystick["center"]
    _exit_press_start = None


def _clear():
    for i in range(NUM_LEDS):
        _np[i] = (0, 0, 0)


def any_input():
    """True if any of up/down/left/right is currently held (center excluded)."""
    return (_joy["up"].value() == 0 or _joy["down"].value() == 0 or
            _joy["left"].value() == 0 or _joy["right"].value() == 0)


def _any_pressed():
    """True if any button (including center) is held."""
    return any_input() or _joy_center.value() == 0


def _wait_release():
    while _any_pressed():
        sleep_ms(10)


def check_exit():
    """Non-blocking hold-center detector. Returns True once when the
    1.5 s threshold is crossed. Call from inside a game loop."""
    global _exit_press_start
    if _joy_center is None:
        return False
    if _joy_center.value() == 0:
        now = ticks_ms()
        if _exit_press_start is None:
            _exit_press_start = now
        elif ticks_diff(now, _exit_press_start) >= EXIT_HOLD_MS:
            while _joy_center.value() == 0:
                sleep_ms(20)
            _exit_press_start = None
            return True
    else:
        _exit_press_start = None
    return False


def _decision_input():
    """Tap any direction = restart, hold center 1.5 s = exit.
    Non-blocking. Returns 'restart' / 'exit' / None."""
    global _exit_press_start
    if _joy_center.value() == 0:
        now = ticks_ms()
        if _exit_press_start is None:
            _exit_press_start = now
        elif ticks_diff(now, _exit_press_start) >= EXIT_HOLD_MS:
            while _joy_center.value() == 0:
                sleep_ms(20)
            _exit_press_start = None
            return "exit"
    else:
        if _exit_press_start is not None:
            _exit_press_start = None
            return "restart"
    if any_input():
        while any_input():
            sleep_ms(10)
        return "restart"
    return None


def _wait_with_input(ms):
    """Sleep up to ms ms, polling for restart/exit. Returns None or the decision."""
    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < ms:
        r = _decision_input()
        if r:
            return r
        sleep_ms(15)
    return None


def loading_screen():
    """2x2 corner spinner. Blocks until user reacts.
    Returns 'start' (any press) or 'exit' (hold center 1.5 s)."""
    global _exit_press_start
    _exit_press_start = None
    _wait_release()

    # Clockwise from top-left, in LED coords (row 7 = top).
    corners = ((3, 4), (4, 4), (4, 3), (3, 3))
    idx = 0
    last_step = ticks_ms() - LOADING_STEP_MS
    center_start = None

    while True:
        now = ticks_ms()

        if _joy_center.value() == 0:
            if center_start is None:
                center_start = now
            elif ticks_diff(now, center_start) >= EXIT_HOLD_MS:
                while _joy_center.value() == 0:
                    sleep_ms(20)
                return "exit"
        else:
            if center_start is not None:
                center_start = None
                return "start"

        if any_input():
            while any_input():
                sleep_ms(10)
            return "start"

        if ticks_diff(now, last_step) >= LOADING_STEP_MS:
            last_step = now
            _clear()
            col, row = corners[idx]
            _np[row * 8 + col] = LOADING_COLOR
            _np.write()
            idx = (idx + 1) % 4

        sleep_ms(15)


def _draw_halftone(color):
    """Top 2 rows of the matrix: alternating halftone pattern.
    Visual y=0 lit at x=0,2,4,6; visual y=1 lit at x=1,3,5,7."""
    # y=0 -> LED row 7
    for col in range(0, 8, 2):
        _np[7 * 8 + col] = color
    # y=1 -> LED row 6
    for col in range(1, 8, 2):
        _np[6 * 8 + col] = color


def _draw_digit(digit, x_offset, y_offset, color):
    """Draw a 3x5 glyph at visual (x_offset, y_offset). y_offset from top."""
    glyph = _FONT.get(digit) or _FONT[" "]
    for gy in range(len(glyph)):
        row = glyph[gy]
        for gx in range(len(row)):
            if row[gx] == "X":
                vx = x_offset + gx
                vy = y_offset + gy
                if 0 <= vx <= 7 and 0 <= vy <= 7:
                    _np[(7 - vy) * 8 + vx] = color


def _glyph_width(ch):
    g = _FONT.get(ch) or _FONT.get(" ")
    if not g or not g[0]:
        return 0
    return len(g[0])


def _flash_sequence():
    """Two quick red full-screen flashes before the static design.
    Returns 'restart' / 'exit' / None."""
    for _ in range(2):
        for i in range(NUM_LEDS):
            _np[i] = GAMEOVER_TOP
        _np.write()
        r = _wait_with_input(110)
        if r:
            return r
        _clear()
        _np.write()
        r = _wait_with_input(80)
        if r:
            return r
    return None


def _show_static_score(text):
    """Two-digit (or shorter) score: halftone top + score on y=3..7.
    1 digit: centered (cols 2..4).
    2 digits: spread layout (cols 0..2 and 5..7, 2-col gap between)."""
    _clear()
    _draw_halftone(GAMEOVER_TOP)
    if len(text) == 1:
        _draw_digit(text[0], 2, 3, SCORE_COLOR)
    else:
        _draw_digit(text[0], 0, 3, SCORE_COLOR)
        _draw_digit(text[1], 5, 3, SCORE_COLOR)
    _np.write()

    while True:
        r = _decision_input()
        if r:
            return r
        sleep_ms(15)


def _marquee_score(text):
    """3+ digit score: halftone top stays put, digits scroll on y=3..7."""
    rows = ["", "", "", "", ""]
    for ch in text:
        glyph = _FONT.get(ch) or _FONT[" "]
        for i in range(5):
            rows[i] += glyph[i] + "."
    for i in range(5):
        rows[i] += "." * 8
    total = len(rows[0])

    offset = -8
    last_step = ticks_ms()

    while True:
        r = _decision_input()
        if r:
            return r

        now = ticks_ms()
        if ticks_diff(now, last_step) >= MARQUEE_STEP_MS:
            last_step = now
            offset += 1
            if offset > total:
                offset = -8

            _clear()
            _draw_halftone(GAMEOVER_TOP)
            for gy in range(5):
                for vx in range(8):
                    src = offset + vx
                    if 0 <= src < total and rows[gy][src] == "X":
                        led_row = 7 - (3 + gy)
                        _np[led_row * 8 + vx] = SCORE_COLOR
            _np.write()

        sleep_ms(15)


def game_over_screen(score):
    """Red flash, then halftone-top + score. Score >2 digits marquees.
    Blocks until decision. Returns 'restart' (tap) or 'exit' (hold center)."""
    global _exit_press_start
    _exit_press_start = None
    _wait_release()

    r = _flash_sequence()
    if r:
        return r

    text = str(int(score))
    if len(text) <= 2:
        return _show_static_score(text)
    return _marquee_score(text)


def end_screen():
    """Green halftone top + amber left-pointing arrow.
    Blocks until decision. Returns 'restart' (tap) or 'exit' (hold center)."""
    global _exit_press_start
    _exit_press_start = None
    _wait_release()

    _clear()
    _draw_halftone(END_TOP)
    for vx, vy in _END_ARROW_PIXELS:
        led_row = 7 - vy
        _np[led_row * 8 + vx] = END_ARROW
    _np.write()

    while True:
        r = _decision_input()
        if r:
            return r
        sleep_ms(15)


def show_digit_briefly(digit, color, hold_ms):
    """Render a single digit centered, hold for hold_ms. Useful for in-game
    transitions (level number, lives remaining, etc.). Returns 'exit' if the
    user holds center to bail mid-display, else None."""
    text = str(int(digit))
    widths = [_glyph_width(ch) for ch in text]
    width = sum(widths) + max(0, len(widths) - 1)
    x_offset = (8 - width) // 2
    _clear()
    pos = x_offset
    for i, ch in enumerate(text):
        _draw_digit(ch, pos, 1, color)
        pos += widths[i] + 1
    _np.write()
    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < hold_ms:
        if check_exit():
            return "exit"
        sleep_ms(15)
    return None
