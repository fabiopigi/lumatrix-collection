from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random
import _screens as screens

NAME = "ArrowReaction"
NUM_LEDS = 64

np = None
PINS = {}

DIRS = ("up", "down", "left", "right")

ARROW_PALETTE = (
    (0, 25, 60),
    (45, 0, 55),
    (55, 0, 25),
    (55, 25, 0),
    (0, 45, 45),
    (50, 0, 50),
    (45, 40, 0),
    (10, 50, 0),
)

BAR_GREEN = (0, 45, 0)
BAR_AMBER = (45, 25, 0)
BAR_RED   = (55, 0, 0)
HIT_GREEN = (0, 60, 0)

ARROWS = {
    "up": [
        (3,7),(4,7),
        (2,6),(3,6),(4,6),(5,6),
        (1,5),(2,5),(3,5),(4,5),(5,5),(6,5),
        (3,4),(4,4),
        (3,3),(4,3),
        (3,2),(4,2),
        (3,1),(4,1),
    ],
    "down": [
        (3,7),(4,7),
        (3,6),(4,6),
        (3,5),(4,5),
        (3,4),(4,4),
        (1,3),(2,3),(3,3),(4,3),(5,3),(6,3),
        (2,2),(3,2),(4,2),(5,2),
        (3,1),(4,1),
    ],
    "left": [
        (2,6),
        (1,5),(2,5),
        (0,4),(1,4),(2,4),(3,4),(4,4),(5,4),(6,4),(7,4),
        (0,3),(1,3),(2,3),(3,3),(4,3),(5,3),(6,3),(7,3),
        (1,2),(2,2),
        (2,1),
    ],
    "right": [
        (5,6),
        (5,5),(6,5),
        (0,4),(1,4),(2,4),(3,4),(4,4),(5,4),(6,4),(7,4),
        (0,3),(1,3),(2,3),(3,3),(4,3),(5,3),(6,3),(7,3),
        (5,2),(6,2),
        (5,1),
    ],
}


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px(col, row, color):
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color


def draw_arrow(direction, color):
    for c, r in ARROWS[direction]:
        px(c, r, color)


def bar_color(length):
    if length >= 6: return BAR_GREEN
    if length >= 3: return BAR_AMBER
    return BAR_RED


def draw_bar(length):
    color = bar_color(length)
    for c in range(8):
        px(c, 0, color if c < length else (0, 0, 0))


def read_joystick():
    for d in DIRS:
        if PINS[d].value() == 0:
            return d
    return None


def play_round(duration_ms, arrow_color):
    direction = random.choice(DIRS)
    clear()
    draw_arrow(direction, arrow_color)
    bar = 8
    draw_bar(bar)
    np.write()

    start = ticks_ms()
    while True:
        if screens.check_exit():
            return ("exit", 0, direction)
        elapsed = ticks_diff(ticks_ms(), start)
        new_bar = 8 - (elapsed * 8) // duration_ms
        if new_bar < 0:
            new_bar = 0
        if new_bar != bar:
            bar = new_bar
            draw_bar(bar)
            np.write()
        if bar == 0:
            return ("timeout", 0, direction)
        pressed = read_joystick()
        if pressed is not None:
            if pressed == direction:
                return ("hit", bar, direction)
            return ("wrong", 0, direction)
        sleep_ms(15)


def flash_hit(direction):
    for _ in range(2):
        clear()
        draw_arrow(direction, HIT_GREEN)
        np.write()
        sleep_ms(80)
        clear()
        np.write()
        sleep_ms(50)


def pick_arrow_color(prev):
    while True:
        c = random.choice(ARROW_PALETTE)
        if c != prev:
            return c


def play_one_game():
    """Returns final score, or None if exit triggered mid-play."""
    score = 0
    duration = 1800
    prev_color = None
    while True:
        clear()
        np.write()
        sleep_ms(180)
        color = pick_arrow_color(prev_color)
        prev_color = color
        result, gained, direction = play_round(duration, color)
        if result == "exit":
            return None
        if result == "hit":
            score += gained
            flash_hit(direction)
            if duration > 600:
                duration -= 60
        else:
            return score


def run(neopixel, joystick):
    global np, PINS
    np = neopixel
    PINS = {
        "up":    joystick["up"],
        "down":  joystick["down"],
        "left":  joystick["left"],
        "right": joystick["right"],
    }
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        score = play_one_game()
        if score is None:
            return
        if screens.game_over_screen(score) == "exit":
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
