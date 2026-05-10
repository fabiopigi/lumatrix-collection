from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random

NAME = "ArrowReaction"
NUM_LEDS = 64

np = None
PINS = {}
JOY_CENTER = None

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
BOOM_RED  = (60, 0, 0)
SCORE_COL = (50, 30, 0)
GAMEOVER_COL = (55, 0, 0)

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


_exit_press_start = None


def check_exit():
    global _exit_press_start
    if JOY_CENTER is None:
        return False
    if JOY_CENTER.value() == 0:
        now = ticks_ms()
        if _exit_press_start is None:
            _exit_press_start = now
        elif ticks_diff(now, _exit_press_start) >= 1500:
            while JOY_CENTER.value() == 0:
                sleep_ms(20)
            _exit_press_start = None
            return True
    else:
        _exit_press_start = None
    return False


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


def wait_release():
    while read_joystick() is not None:
        sleep_ms(10)


def play_round(duration_ms, arrow_color):
    direction = random.choice(DIRS)
    clear()
    draw_arrow(direction, arrow_color)
    bar = 8
    draw_bar(bar)
    np.write()

    start = ticks_ms()
    while True:
        if check_exit():
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


def game_over_animation():
    frames = []

    f = []
    for c, r in ((3,3),(4,3),(3,4),(4,4)):
        f.append((c, r))
    frames.append(f)

    f = list(frames[-1])
    for c, r in ((3,2),(4,2),(3,5),(4,5),(2,3),(2,4),(5,3),(5,4)):
        f.append((c, r))
    frames.append(f)

    f = []
    for i in range(8):
        f.append((3, i)); f.append((4, i))
        f.append((i, 3)); f.append((i, 4))
    frames.append(f)

    f = []
    for i in range(8):
        f.append((i, i))
        f.append((i, 7 - i))
    frames.append(f)

    f = list(frames[-1])
    for i in range(7):
        f.append((i, i + 1)); f.append((i + 1, i))
        f.append((i, 6 - i)); f.append((i + 1, 7 - i))
    frames.append(f)

    for frame in frames:
        clear()
        for c, r in frame:
            px(c, r, BOOM_RED)
        np.write()
        sleep_ms(110)

    for i in range(NUM_LEDS):
        np[i] = BOOM_RED
    np.write()
    sleep_ms(180)

    for b in (45, 30, 18, 8, 0):
        for i in range(NUM_LEDS):
            np[i] = (b, 0, 0)
        np.write()
        sleep_ms(70)
    clear()
    np.write()


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
    ":": [".....","..X..","..X..",".....","..X..","..X..","....."],
    "S": [".XXXX","X....","X....",".XXX.","....X","....X","XXXX."],
    "C": [".XXXX","X....","X....","X....","X....","X....",".XXXX"],
    "O": [".XXX.","X...X","X...X","X...X","X...X","X...X",".XXX."],
    "R": ["XXXX.","X...X","X...X","XXXX.","X.X..","X..X.","X...X"],
    "E": ["XXXXX","X....","X....","XXXX.","X....","X....","XXXXX"],
    "G": [".XXXX","X....","X....","X..XX","X...X","X...X",".XXX."],
    "A": [".XXX.","X...X","X...X","XXXXX","X...X","X...X","X...X"],
    "M": ["X...X","XX.XX","X.X.X","X...X","X...X","X...X","X...X"],
    "V": ["X...X","X...X","X...X","X...X","X...X",".X.X.","..X.."],
}


def text_to_bitmap(text):
    rows = ["", "", "", "", "", "", ""]
    for ch in text:
        glyph = FONT.get(ch, FONT[" "])
        for i, line in enumerate(glyph):
            rows[i] += line + "."
    return rows


def marquee(text, color, step_ms=80):
    bitmap = text_to_bitmap(text)
    total = len(bitmap[0])
    for offset in range(-8, total + 1):
        if check_exit():
            return True
        clear()
        for i in range(7):
            for j in range(8):
                src = offset + j
                if 0 <= src < total and bitmap[i][src] == "X":
                    px(j, 7 - i, color)
        np.write()
        t0 = ticks_ms()
        while ticks_diff(ticks_ms(), t0) < step_ms:
            if check_exit():
                return True
            sleep_ms(10)
    return False


def pulse_until_press():
    """Return 'press' on direction press, 'exit' on hold-center exit."""
    while True:
        for b in range(0, 35, 4):
            if check_exit():
                return "exit"
            if read_joystick() is not None:
                return "press"
            for c, r in ((3,3),(4,3),(3,4),(4,4)):
                px(c, r, (0, b, b))
            np.write()
            sleep_ms(35)
        for b in range(35, -1, -4):
            if check_exit():
                return "exit"
            if read_joystick() is not None:
                return "press"
            for c, r in ((3,3),(4,3),(3,4),(4,4)):
                px(c, r, (0, b, b))
            np.write()
            sleep_ms(35)


def pick_arrow_color(prev):
    while True:
        c = random.choice(ARROW_PALETTE)
        if c != prev:
            return c


def game():
    """Run one session. Returns when game ends or user holds center to exit."""
    clear()
    np.write()
    if pulse_until_press() == "exit":
        return
    wait_release()

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
            return
        if result == "hit":
            score += gained
            flash_hit(direction)
            if duration > 600:
                duration -= 60
        else:
            game_over_animation()
            sleep_ms(250)
            if marquee("GAME OVER", GAMEOVER_COL):
                return
            sleep_ms(200)
            if marquee("SCORE: " + str(score), SCORE_COL):
                return
            sleep_ms(400)
            return


def run(neopixel, joystick):
    global np, PINS, JOY_CENTER
    np = neopixel
    PINS = {
        "up":    joystick["up"],
        "down":  joystick["down"],
        "left":  joystick["left"],
        "right": joystick["right"],
    }
    JOY_CENTER = joystick["center"]
    game()


if __name__ == "__main__":
    _np = NeoPixel(Pin(19, Pin.OUT), NUM_LEDS)
    _joy = {
        "up":     Pin(3, Pin.IN),
        "down":   Pin(6, Pin.IN),
        "left":   Pin(7, Pin.IN),
        "right":  Pin(2, Pin.IN),
        "center": Pin(8, Pin.IN),
    }
    while True:
        run(_np, _joy)
