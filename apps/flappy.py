from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random

NAME = "FlappyPixels"
NUM_LEDS = 64

np = None
JOY_UP = None
JOY_DOWN = None
JOY_CENTER = None
JOY_SLIDE = None

PLAYER_COL = 0
WALL_COLOR = (0, 40, 10)
PLAYER_COLOR_GRAVITY = (60, 45, 0)
PLAYER_COLOR_FLOAT   = (0, 45, 55)
SCORE_COL = (50, 30, 0)
GAMEOVER_COL = (60, 0, 0)

FRAME_MS = 50
GAP_SIZE = 3
WALL_TICK = 6
SPAWN_TICK = 24

# Gravity mode
GRAVITY = 0.05
JUMP_DELTA = 0.40
JUMP_CAP = -1.0
TERMINAL_VEL = 1.5

# Float mode
FLOAT_ACCEL = 0.025
FLOAT_TERMINAL = 0.40

_exit_press_start = None


def slide_mode():
    """Return 'gravity' or 'float' based on the slide switch."""
    if JOY_SLIDE is None:
        return "gravity"
    return "gravity" if JOY_SLIDE.value() == 0 else "float"


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


def gameover_input():
    global _exit_press_start
    if JOY_CENTER is None:
        return None
    if JOY_CENTER.value() == 0:
        now = ticks_ms()
        if _exit_press_start is None:
            _exit_press_start = now
        elif ticks_diff(now, _exit_press_start) >= 1500:
            while JOY_CENTER.value() == 0:
                sleep_ms(20)
            _exit_press_start = None
            return "hold"
    else:
        if _exit_press_start is not None:
            _exit_press_start = None
            return "tap"
    return None


def _gameover_wait(ms):
    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < ms:
        r = gameover_input()
        if r == "tap":
            return "restart"
        if r == "hold":
            return "exit"
        sleep_ms(15)
    return None


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px(col, row, color):
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color


def render(player_y, walls, mode):
    clear()
    for w in walls:
        col = w["col"]
        if col < 0 or col > 7:
            continue
        gap = w["gap"]
        for r in range(8):
            y = 7 - r
            if y < gap or y >= gap + GAP_SIZE:
                px(col, r, WALL_COLOR)
    py_int = max(0, min(7, int(player_y)))
    color = PLAYER_COLOR_FLOAT if mode == "float" else PLAYER_COLOR_GRAVITY
    px(PLAYER_COL, 7 - py_int, color)
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
}


def text_to_bitmap(text):
    rows = ["", "", "", "", "", "", ""]
    for ch in text:
        glyph = FONT.get(ch, FONT[" "])
        for i, line in enumerate(glyph):
            rows[i] += line + "."
    return rows


def gameover_marquee(text, color, step_ms=70):
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
        r = _gameover_wait(step_ms)
        if r:
            return r
    return None


def game_over_sequence(player_y, score):
    py_int = max(0, min(7, int(player_y)))
    pr = 7 - py_int
    for _ in range(3):
        clear()
        px(PLAYER_COL, pr, GAMEOVER_COL)
        np.write()
        r = _gameover_wait(80)
        if r:
            return r
        for i in range(NUM_LEDS):
            np[i] = GAMEOVER_COL
        np.write()
        r = _gameover_wait(120)
        if r:
            return r
    for b in (50, 30, 15, 5, 0):
        for i in range(NUM_LEDS):
            np[i] = (b, 0, 0)
        np.write()
        r = _gameover_wait(70)
        if r:
            return r
    clear()
    np.write()
    r = _gameover_wait(200)
    if r:
        return r
    r = gameover_marquee("SCORE: " + str(score), SCORE_COL)
    if r:
        return r
    r = _gameover_wait(300)
    if r:
        return r
    return "exit"


def play_one_round():
    player_y = 3.5
    velocity = 0.0
    walls = []
    score = 0
    frame = 0
    prev_up = False
    intro_frames = 14

    while True:
        if check_exit():
            return "exit"

        mode = slide_mode()
        cur_up = JOY_UP.value() == 0
        cur_down = JOY_DOWN.value() == 0

        if mode == "gravity":
            if cur_up and not prev_up:
                velocity = max(velocity - JUMP_DELTA, JUMP_CAP)
            velocity = min(velocity + GRAVITY, TERMINAL_VEL)
        else:
            if cur_up and not cur_down:
                velocity -= FLOAT_ACCEL
            elif cur_down and not cur_up:
                velocity += FLOAT_ACCEL
            if velocity > FLOAT_TERMINAL:
                velocity = FLOAT_TERMINAL
            elif velocity < -FLOAT_TERMINAL:
                velocity = -FLOAT_TERMINAL

        prev_up = cur_up
        player_y += velocity

        if player_y < 0:
            player_y = 0
            if velocity < 0:
                velocity = 0

        if mode == "gravity":
            ground_hit = player_y >= 7.5
        else:
            if player_y > 7:
                player_y = 7
                if velocity > 0:
                    velocity = 0
            ground_hit = False

        if frame >= intro_frames:
            if frame % WALL_TICK == 0:
                new_walls = []
                hit = False
                for w in walls:
                    new_col = w["col"] - 1
                    if new_col == PLAYER_COL:
                        py_int = max(0, min(7, int(player_y)))
                        gap = w["gap"]
                        if gap <= py_int < gap + GAP_SIZE:
                            score += 1
                        else:
                            new_walls.append({"col": new_col, "gap": gap})
                            hit = True
                    elif new_col >= 0:
                        new_walls.append({"col": new_col, "gap": w["gap"]})
                walls = new_walls
                if hit:
                    render(player_y, walls, mode)
                    return game_over_sequence(player_y, score)

            if (frame - intro_frames) % SPAWN_TICK == 0:
                walls.append({"col": 7, "gap": random.randint(0, 7 - GAP_SIZE)})

        render(player_y, walls, mode)

        if ground_hit:
            return game_over_sequence(player_y, score)

        sleep_ms(FRAME_MS)
        frame += 1


def play():
    while True:
        if play_one_round() == "exit":
            return


def run(neopixel, joystick):
    global np, JOY_UP, JOY_DOWN, JOY_CENTER, JOY_SLIDE, _exit_press_start
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    JOY_CENTER = joystick["center"]
    JOY_SLIDE = joystick.get("slide")
    _exit_press_start = None
    play()


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
    while True:
        run(_np, _joy)
