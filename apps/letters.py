import sys
import select
from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import _screens as screens
from _fonts import FONT_5X8

NAME = "LetterDisplay"
NUM_LEDS = 64
IDLE_MS = 10_000

np = None

MASK = {
    "a": [57, 51, 40, 42, 35],
    "e": [60, 54, 47, 27, 22, 23, 10, 12, 14, 7],
    "f": [44, 24, 0],
    "g": [29],
    "h": [48, 41, 30, 20],
    "i": [45, 25, 28, 17, 5],
    "l": [43, 11],
    "n": [61, 15, 4, 6],
    "o": [38, 1],
    "p": [34],
    "q": [49],
    "r": [52, 55, 39, 21, 3],
    "s": [36, 16],
    "t": [58, 62, 53, 33, 37, 31, 19, 8],
    "u": [50, 2],
    "v": [46, 26, 13],
    "w": [59, 32, 9],
    "x": [18],
    "y": [63],
    "z": [56],
}

CURSOR = {}


def letter_color(ch):
    i = (ord(ch.upper()) - ord("A")) % 26
    h = (i / 26.0) * 6.0
    sector = int(h)
    f = h - sector
    v = 55
    if sector == 0:   return (v, int(v * f), 0)
    elif sector == 1: return (int(v * (1 - f)), v, 0)
    elif sector == 2: return (0, v, int(v * f))
    elif sector == 3: return (0, int(v * (1 - f)), v)
    elif sector == 4: return (int(v * f), 0, v)
    else:             return (v, 0, int(v * (1 - f)))


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def pixels_for_char(ch):
    if not ch or len(ch) != 1:
        return []
    color = letter_color(ch)

    if ch.islower():
        positions = MASK.get(ch)
        if not positions:
            return []
        idx = positions[CURSOR[ch] % len(positions)]
        CURSOR[ch] += 1
        return [(idx, color)]

    if ch.isupper():
        glyph = FONT_5X8.get(ch)
        if not glyph:
            return []
        out = []
        for grow in range(8):
            line = glyph[grow]
            mrow = 7 - grow
            for gcol in range(5):
                if line[gcol] == "X":
                    mcol = gcol + 1
                    out.append((mrow * 8 + mcol, color))
        return out

    return []


def render(active):
    clear()
    for idx, color in active:
        np[idx] = color
    np.write()


def render_faded(active, scale):
    clear()
    for idx, (r, g, b) in active:
        np[idx] = (int(r * scale), int(g * scale), int(b * scale))
    np.write()


def show_letters():
    """Letter loop. Returns 'exit' on hold-center or Ctrl-C, 'idle' after 10 s no input."""
    poll = select.poll()
    poll.register(sys.stdin, select.POLLIN)

    HOLD_MS = 1000
    FADE_MS = 300

    active = []
    last_input = ticks_ms()
    fading = False
    fade_start = 0

    clear()
    np.write()

    while True:
        if screens.check_exit():
            return "exit"

        if poll.poll(0):
            ch = sys.stdin.read(1)
            if ch in ("\x03", "\x04"):
                return "exit"
            new_active = pixels_for_char(ch)
            if new_active:
                active = new_active
                render(active)
                last_input = ticks_ms()
                fading = False
        else:
            now = ticks_ms()
            if active:
                if not fading:
                    if ticks_diff(now, last_input) >= HOLD_MS:
                        fading = True
                        fade_start = now
                else:
                    elapsed = ticks_diff(now, fade_start)
                    if elapsed >= FADE_MS:
                        active = []
                        clear()
                        np.write()
                        fading = False
                    else:
                        render_faded(active, 1.0 - elapsed / FADE_MS)
            elif ticks_diff(now, last_input) >= IDLE_MS:
                return "idle"
            sleep_ms(15)


def run(neopixel, joystick):
    global np, CURSOR
    np = neopixel
    CURSOR = {ch: 0 for ch in MASK}
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        outcome = show_letters()
        if outcome == "exit":
            return
        if screens.end_screen() == "exit":
            return


if __name__ == "__main__":
    _np = NeoPixel(Pin(19, Pin.OUT), NUM_LEDS)
    _joy = {
        "up":     Pin(3, Pin.IN),
        "down":   Pin(6, Pin.IN),
        "left":   Pin(7, Pin.IN),
        "right":  Pin(2, Pin.IN),
        "center": Pin(8, Pin.IN),
        "slide":  Pin(9, Pin.IN),
    }
    run(_np, _joy)
