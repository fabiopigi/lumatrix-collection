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
import pixeldesigner

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

APPS = [reaction, letters, flappy, pong, invaders, doom, breakout, snake, pixeldesigner]

FONT = {
    "0": [".XXX.","X...X","X...X","X...X","X...X","X...X",".XXX."],
    "1": ["..X..",".XX..","..X..","..X..","..X..","..X..","XXXXX"],
    "2": [".XXX.","X...X","....X","...X.","..X..",".X...","XXXXX"],
    "3": ["XXXX.","....X","....X",".XXX.","....X","....X","XXXX."],
    "4": ["X...X","X...X","X...X","XXXXX","....X","....X","....X"],
    "5": ["XXXXX","X....","X....","XXXX.","....X","X...X",".XXX."],
    "6": [".XXX.","X....","X....","XXXX.","X...X","X...X",".XXX."],
    "7": ["XXXXX","....X","...X.","..X..","..X..","..X..","..X.."],
    "8": [".XXX.","X...X","X...X",".XXX.","X...X","X...X",".XXX."],
    "9": [".XXX.","X...X","X...X",".XXXX","....X","....X",".XXX."],
    " ": [".....",".....",".....",".....",".....",".....","....."],
    "A": [".XXX.","X...X","X...X","XXXXX","X...X","X...X","X...X"],
    "B": ["XXXX.","X...X","X...X","XXXX.","X...X","X...X","XXXX."],
    "C": [".XXXX","X....","X....","X....","X....","X....",".XXXX"],
    "D": ["XXXX.","X...X","X...X","X...X","X...X","X...X","XXXX."],
    "E": ["XXXXX","X....","X....","XXXX.","X....","X....","XXXXX"],
    "F": ["XXXXX","X....","X....","XXXX.","X....","X....","X...."],
    "G": [".XXXX","X....","X....","X..XX","X...X","X...X",".XXX."],
    "H": ["X...X","X...X","X...X","XXXXX","X...X","X...X","X...X"],
    "I": ["XXXXX","..X..","..X..","..X..","..X..","..X..","XXXXX"],
    "J": ["XXXXX","....X","....X","....X","....X","X...X",".XXX."],
    "K": ["X...X","X..X.","X.X..","XX...","X.X..","X..X.","X...X"],
    "L": ["X....","X....","X....","X....","X....","X....","XXXXX"],
    "M": ["X...X","XX.XX","X.X.X","X...X","X...X","X...X","X...X"],
    "N": ["X...X","XX..X","X.X.X","X.X.X","X.X.X","X..XX","X...X"],
    "O": [".XXX.","X...X","X...X","X...X","X...X","X...X",".XXX."],
    "P": ["XXXX.","X...X","X...X","XXXX.","X....","X....","X...."],
    "Q": [".XXX.","X...X","X...X","X...X","X.X.X","X..XX",".XXXX"],
    "R": ["XXXX.","X...X","X...X","XXXX.","X.X..","X..X.","X...X"],
    "S": [".XXXX","X....","X....",".XXX.","....X","....X","XXXX."],
    "T": ["XXXXX","..X..","..X..","..X..","..X..","..X..","..X.."],
    "U": ["X...X","X...X","X...X","X...X","X...X","X...X",".XXX."],
    "V": ["X...X","X...X","X...X","X...X","X...X",".X.X.","..X.."],
    "W": ["X...X","X...X","X...X","X.X.X","X.X.X","XX.XX",".X.X."],
    "X": ["X...X","X...X",".X.X.","..X..",".X.X.","X...X","X...X"],
    "Y": ["X...X","X...X",".X.X.","..X..","..X..","..X..","..X.."],
    "Z": ["XXXXX","....X","...X.","..X..",".X...","X....","XXXXX"],
}


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px(c, r, color):
    if 0 <= c <= 7 and 0 <= r <= 7:
        np[r * 8 + c] = color


def app_color(name):
    i = (ord(name[0].upper()) - ord("A")) % 26
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


def draw_digit(d, color):
    glyph = FONT[str(d)]
    clear()
    for grow in range(7):
        line = glyph[grow]
        mrow = 7 - grow
        for gcol in range(5):
            if line[gcol] == "X":
                px(gcol + 1, mrow, color)
    np.write()


def text_to_bitmap(text):
    rows = ["", "", "", "", "", "", ""]
    for ch in text.upper():
        glyph = FONT.get(ch, FONT[" "])
        for i, line in enumerate(glyph):
            rows[i] += line + "."
    return rows


def read_joystick():
    if JOY["center"].value() == 0: return "center"
    if JOY["up"].value() == 0:     return "up"
    if JOY["down"].value() == 0:   return "down"
    if JOY["left"].value() == 0:   return "left"
    if JOY["right"].value() == 0:  return "right"
    return None


def wait_release():
    while read_joystick() is not None:
        sleep_ms(10)


def marquee_abortable(text, color, step_ms=60):
    bitmap = text_to_bitmap(text)
    total = len(bitmap[0])
    for offset in range(-8, total + 1):
        clear()
        for i in range(7):
            for j in range(8):
                src = offset + j
                if 0 <= src < total and bitmap[i][src] == "X":
                    px(j, 7 - i, color)
        np.write()
        t0 = ticks_ms()
        while ticks_diff(ticks_ms(), t0) < step_ms:
            press = read_joystick()
            if press is not None:
                return press
            sleep_ms(8)
    return None


def boot_animation():
    color = (35, 35, 50)
    for r in range(8):
        clear()
        for c in range(8):
            px(c, r, color)
        np.write()
        sleep_ms(45)
    for b in (60, 80, 60, 40, 20, 0):
        for i in range(NUM_LEDS):
            np[i] = (b, b, b)
        np.write()
        sleep_ms(50)
    clear()
    np.write()


def menu_select():
    selected = 0
    name = APPS[selected].NAME
    color = app_color(name)
    draw_digit(selected + 1, color)
    last_input = ticks_ms()
    scrolled = False

    while True:
        press = read_joystick()
        if press == "center":
            wait_release()
            return selected
        if press in ("down", "right"):
            wait_release()
            selected = (selected + 1) % len(APPS)
            name = APPS[selected].NAME
            color = app_color(name)
            draw_digit(selected + 1, color)
            last_input = ticks_ms()
            scrolled = False
            continue
        if press in ("up", "left"):
            wait_release()
            selected = (selected - 1) % len(APPS)
            name = APPS[selected].NAME
            color = app_color(name)
            draw_digit(selected + 1, color)
            last_input = ticks_ms()
            scrolled = False
            continue

        if not scrolled and ticks_diff(ticks_ms(), last_input) > 1000:
            interrupt = marquee_abortable(name, color)
            if interrupt is not None:
                wait_release()
                if interrupt == "center":
                    return selected
                if interrupt in ("down", "right"):
                    selected = (selected + 1) % len(APPS)
                elif interrupt in ("up", "left"):
                    selected = (selected - 1) % len(APPS)
                name = APPS[selected].NAME
                color = app_color(name)
                draw_digit(selected + 1, color)
                last_input = ticks_ms()
                scrolled = False
                continue
            draw_digit(selected + 1, color)
            scrolled = True
        sleep_ms(15)


def main():
    boot_animation()
    while True:
        idx = menu_select()
        clear()
        np.write()
        sleep_ms(150)
        APPS[idx].run(np, JOY)
        wait_release()
        sleep_ms(200)


main()
