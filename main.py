import sys
sys.path.append("/apps")

from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff

import reaction
import letters
import flappy
import pong
import invaders
import doom
import breakout
import snake

NUM_LEDS = 64
np = NeoPixel(Pin(19, Pin.OUT), NUM_LEDS)

JOY = {
    "up":     Pin(3, Pin.IN),
    "down":   Pin(6, Pin.IN),
    "left":   Pin(7, Pin.IN),
    "right":  Pin(2, Pin.IN),
    "center": Pin(8, Pin.IN),
    "slide":  Pin(9, Pin.IN),
}

APPS = [reaction, letters, flappy, pong, invaders, doom, breakout, snake]

BRIGHTNESS = 0.25
MARQUEE_STEP_MS = 180


def hex_dim(hex_str, scale=BRIGHTNESS):
    h = hex_str.lstrip("#")
    return (int(int(h[0:2], 16) * scale),
            int(int(h[2:4], 16) * scale),
            int(int(h[4:6], 16) * scale))


NAME_COLOR   = hex_dim("#008040")
TRACK_DIM    = hex_dim("#000080", 0.08)
TRACK_BRIGHT = hex_dim("#0080ff")
LUMA_COLOR   = (45, 45, 45)
TRIX_COLOR   = hex_dim("#0080ff")


FONT_3x5 = {
    " ": ["...", "...", "...", "...", "..."],
    "A": [".X.", "X.X", "XXX", "X.X", "X.X"],
    "B": ["XX.", "X.X", "XX.", "X.X", "XX."],
    "C": [".XX", "X..", "X..", "X..", ".XX"],
    "D": ["XX.", "X.X", "X.X", "X.X", "XX."],
    "E": ["XXX", "X..", "XX.", "X..", "XXX"],
    "F": ["XXX", "X..", "XX.", "X..", "X.."],
    "G": [".XX", "X..", "X.X", "X.X", ".XX"],
    "H": ["X.X", "X.X", "XXX", "X.X", "X.X"],
    "I": ["XXX", ".X.", ".X.", ".X.", "XXX"],
    "J": [".XX", ".X.", ".X.", ".X.", "XX."],
    "K": ["X.X", "XX.", "X..", "XX.", "X.X"],
    "L": ["X..", "X..", "X..", "X..", "XXX"],
    "M": ["X.X", "XXX", "XXX", "X.X", "X.X"],
    "N": ["X.X", "XX.", "XXX", "X.X", "X.X"],
    "O": ["XXX", "X.X", "X.X", "X.X", "XXX"],
    "P": ["XX.", "X.X", "XX.", "X..", "X.."],
    "Q": ["XXX", "X.X", "X.X", "XXX", "..X"],
    "R": ["XX.", "X.X", "XX.", "X.X", "X.X"],
    "S": [".XX", "X..", ".X.", "..X", "XX."],
    "T": ["XXX", ".X.", ".X.", ".X.", ".X."],
    "U": ["X.X", "X.X", "X.X", "X.X", "XXX"],
    "V": ["X.X", "X.X", "X.X", "X.X", ".X."],
    "W": ["X.X", "X.X", "X.X", "XXX", ".X."],
    "X": ["X.X", "X.X", ".X.", "X.X", "X.X"],
    "Y": ["X.X", "X.X", ".X.", ".X.", ".X."],
    "Z": ["XXX", "..X", ".X.", "X..", "XXX"],
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
    ".": ["...", "...", "...", "...", ".X."],
    "!": [".X.", ".X.", ".X.", "...", ".X."],
    "?": ["XX.", "..X", ".X.", "...", ".X."],
    ":": ["...", ".X.", "...", ".X.", "..."],
    "-": ["...", "...", "XXX", "...", "..."],
    "+": ["...", ".X.", "XXX", ".X.", "..."],
}


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px_visual(x, y, color):
    """(x, y) where (0, 0) is top-left visually, (7, 7) is bottom-right."""
    if 0 <= x <= 7 and 0 <= y <= 7:
        led_row = 7 - y
        np[led_row * 8 + x] = color


def glyph_for(ch):
    return FONT_3x5.get(ch) or FONT_3x5.get(ch.upper()) or FONT_3x5[" "]


def text_to_bitmap(text, trailing_gap=8):
    rows = ["", "", "", "", ""]
    for ch in text:
        g = glyph_for(ch)
        for i in range(5):
            rows[i] += g[i] + "."
    for i in range(5):
        rows[i] += "." * trailing_gap
    return rows


def draw_marquee(bitmap, offset, color, y0=0):
    total = len(bitmap[0])
    if total <= 0:
        return
    for y in range(5):
        row = bitmap[y]
        for x in range(8):
            src = (offset + x) % total
            if row[src] == "X":
                px_visual(x, y0 + y, color)


def draw_track(current_idx, total_apps):
    for i in range(total_apps):
        if i < 8:
            x, y = i, 6
        else:
            x, y = i - 8, 7
        color = TRACK_BRIGHT if i == current_idx else TRACK_DIM
        px_visual(x, y, color)


def render_menu(bitmap, offset, idx, total):
    clear()
    draw_marquee(bitmap, offset, NAME_COLOR)
    draw_track(idx, total)
    np.write()


def read_input():
    if JOY["center"].value() == 0: return "center"
    if JOY["up"].value() == 0:     return "up"
    if JOY["down"].value() == 0:   return "down"
    if JOY["left"].value() == 0:   return "left"
    if JOY["right"].value() == 0:  return "right"
    return None


def wait_release():
    while read_input() is not None:
        sleep_ms(10)


def one_shot_marquee(text, color, step_ms=55, y0=1):
    bitmap = text_to_bitmap(text, trailing_gap=0)
    width = len(bitmap[0])
    for offset in range(-8, width + 1):
        clear()
        for y in range(5):
            row = bitmap[y]
            for x in range(8):
                src = offset + x
                if 0 <= src < width and row[src] == "X":
                    px_visual(x, y0 + y, color)
        np.write()
        sleep_ms(step_ms)


def boot_animation():
    one_shot_marquee("LUMA", LUMA_COLOR)
    one_shot_marquee("TRIX", TRIX_COLOR)
    clear()
    np.write()
    sleep_ms(150)


def menu_select():
    idx = 0
    bitmap = text_to_bitmap(APPS[idx].NAME)
    total = len(bitmap[0])
    offset = max(0, total - 8)
    last_step = ticks_ms()

    while True:
        press = read_input()
        if press == "center":
            wait_release()
            return idx
        nav = None
        if press in ("right", "down"):
            nav = 1
        elif press in ("left", "up"):
            nav = -1

        if nav is not None:
            wait_release()
            idx = (idx + nav) % len(APPS)
            bitmap = text_to_bitmap(APPS[idx].NAME)
            total = len(bitmap[0])
            offset = max(0, total - 8)
            last_step = ticks_ms()

        now = ticks_ms()
        if ticks_diff(now, last_step) >= MARQUEE_STEP_MS:
            offset = (offset + 1) % total
            last_step = now

        render_menu(bitmap, offset, idx, len(APPS))
        sleep_ms(10)


def main():
    boot_animation()
    while True:
        i = menu_select()
        clear()
        np.write()
        sleep_ms(150)
        APPS[i].run(np, JOY)
        wait_release()
        sleep_ms(200)


main()
