from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random

NAME = "Snake"
NUM_LEDS = 64

np = None
JOY_UP = None
JOY_DOWN = None
JOY_LEFT = None
JOY_RIGHT = None
JOY_CENTER = None

BODY_COLOR = (0, 40, 5)
HEAD_COLOR = (25, 55, 30)
FOOD_COLOR = (55, 15, 0)
SCORE_COL    = (50, 30, 0)
GAMEOVER_COL = (60, 0, 0)
WIN_COLOR    = (0, 55, 10)

FRAME_MS = 50
START_INTERVAL = 6
MIN_INTERVAL = 2
SPEEDUP_EVERY = 5

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


def read_dir():
    if JOY_UP.value() == 0:    return (0, 1)
    if JOY_DOWN.value() == 0:  return (0, -1)
    if JOY_LEFT.value() == 0:  return (-1, 0)
    if JOY_RIGHT.value() == 0: return (1, 0)
    return None


def spawn_food(snake_set):
    free = [(c, r) for r in range(8) for c in range(8) if (c, r) not in snake_set]
    if not free:
        return None
    return random.choice(free)


def render(snake, food):
    clear()
    if food is not None:
        px(food[0], food[1], FOOD_COLOR)
    for i, (c, r) in enumerate(snake):
        color = HEAD_COLOR if i == len(snake) - 1 else BODY_COLOR
        px(c, r, color)
    np.write()


def move_interval(score):
    return max(MIN_INTERVAL, START_INTERVAL - score // SPEEDUP_EVERY)


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
    "W": ["X...X","X...X","X...X","X.X.X","X.X.X","XX.XX",".X.X."],
    "I": ["XXXXX","..X..","..X..","..X..","..X..","..X..","XXXXX"],
    "N": ["X...X","XX..X","X.X.X","X.X.X","X.X.X","X..XX","X...X"],
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


def game_over_sequence(score):
    for _ in range(3):
        for i in range(NUM_LEDS):
            np[i] = GAMEOVER_COL
        np.write()
        r = _gameover_wait(120)
        if r:
            return r
        clear()
        np.write()
        r = _gameover_wait(80)
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


def win_sequence(score):
    for _ in range(5):
        for i in range(NUM_LEDS):
            np[i] = WIN_COLOR
        np.write()
        r = _gameover_wait(90)
        if r:
            return r
        clear()
        np.write()
        r = _gameover_wait(70)
        if r:
            return r
    r = gameover_marquee("WIN " + str(score), WIN_COLOR)
    if r:
        return r
    r = _gameover_wait(300)
    if r:
        return r
    return "exit"


def play_one_round():
    snake = [(3, 4), (4, 4), (5, 4)]
    snake_set = set(snake)
    food = spawn_food(snake_set)
    score = 0
    current_dir = (1, 0)
    pending_dir = None
    started = False
    move_timer = 0

    while True:
        if check_exit():
            return "exit"

        inp = read_dir()
        if inp is not None:
            opp = (-current_dir[0], -current_dir[1])
            if inp != opp:
                if not started:
                    started = True
                    current_dir = inp
                    pending_dir = None
                else:
                    pending_dir = inp

        if started:
            move_timer += 1
            if move_timer >= move_interval(score):
                move_timer = 0
                if pending_dir is not None:
                    current_dir = pending_dir
                    pending_dir = None

                head = snake[-1]
                new_head = ((head[0] + current_dir[0]) % 8,
                            (head[1] + current_dir[1]) % 8)
                ate_food = (new_head == food)

                collision = False
                if new_head in snake_set:
                    if ate_food:
                        collision = True
                    elif new_head != snake[0]:
                        collision = True

                if collision:
                    render(snake, food)
                    return game_over_sequence(score)

                snake.append(new_head)
                snake_set.add(new_head)
                if not ate_food:
                    tail = snake.pop(0)
                    snake_set.discard(tail)
                else:
                    score += 1
                    food = spawn_food(snake_set)
                    if food is None:
                        render(snake, food)
                        return win_sequence(score)

        render(snake, food)
        sleep_ms(FRAME_MS)


def play():
    while True:
        if play_one_round() == "exit":
            return


def run(neopixel, joystick):
    global np, JOY_UP, JOY_DOWN, JOY_LEFT, JOY_RIGHT, JOY_CENTER, _exit_press_start
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    JOY_LEFT = joystick["left"]
    JOY_RIGHT = joystick["right"]
    JOY_CENTER = joystick["center"]
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
