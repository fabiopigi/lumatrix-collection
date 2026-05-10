from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random

NAME = "Pong"
NUM_LEDS = 64

np = None
JOY_UP = None
JOY_DOWN = None
JOY_CENTER = None

PLAYER_COL = 0
CPU_COL = 7
PADDLE_LEN = 2

PLAYER_COLOR = (0, 30, 60)
CPU_COLOR    = (55, 0, 0)
BALL_COLOR   = (55, 55, 55)
SCORE_COL    = (50, 30, 0)
GAMEOVER_COL = (60, 0, 0)

FRAME_MS = 50
PLAYER_SPEED = 0.50

INITIAL_VX = 0.40
INITIAL_VY_MIN = 0.15
INITIAL_VY_MAX = 0.30
MAX_VX = 1.20
MAX_VY = 0.80
SPEEDUP_HITS = 10
SPEEDUP_FACTOR = 1.15
DEFLECTION = 0.18

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


def draw_paddle(col, top_y, color):
    """top_y is float, paddle covers rows [int(top_y), int(top_y) + PADDLE_LEN - 1] in y_from_top."""
    ty = max(0, min(8 - PADDLE_LEN, int(top_y)))
    for k in range(PADDLE_LEN):
        y = ty + k
        px(col, 7 - y, color)


def render(player_y, cpu_y, ball_x, ball_y):
    clear()
    draw_paddle(PLAYER_COL, player_y, PLAYER_COLOR)
    draw_paddle(CPU_COL, cpu_y, CPU_COLOR)
    bx = max(0, min(7, int(ball_x)))
    by = max(0, min(7, int(ball_y)))
    px(bx, 7 - by, BALL_COLOR)
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


def cap_speed(vx, vy):
    if vx > MAX_VX: vx = MAX_VX
    elif vx < -MAX_VX: vx = -MAX_VX
    if vy > MAX_VY: vy = MAX_VY
    elif vy < -MAX_VY: vy = -MAX_VY
    return vx, vy


def play_one_round():
    player_y = 3.0
    cpu_y = 3.0
    ball_x = 4.0
    ball_y = 3.5
    ball_vx = INITIAL_VX * random.choice((-1, 1))
    ball_vy = random.choice((-1, 1)) * (INITIAL_VY_MIN + (INITIAL_VY_MAX - INITIAL_VY_MIN) * random.random())

    score = 0
    hits = 0
    intro_frames = 14
    frame = 0

    while True:
        if check_exit():
            return "exit"

        if JOY_UP.value() == 0:
            player_y -= PLAYER_SPEED
        if JOY_DOWN.value() == 0:
            player_y += PLAYER_SPEED
        if player_y < 0:
            player_y = 0
        if player_y > 8 - PADDLE_LEN:
            player_y = 8 - PADDLE_LEN

        cpu_target = ball_y - (PADDLE_LEN - 1) / 2.0
        if cpu_target < 0:
            cpu_target = 0
        if cpu_target > 8 - PADDLE_LEN:
            cpu_target = 8 - PADDLE_LEN
        cpu_y = cpu_target

        if frame >= intro_frames:
            ball_x += ball_vx
            ball_y += ball_vy

            if ball_y < 0:
                ball_y = -ball_y
                ball_vy = -ball_vy
            elif ball_y > 7:
                ball_y = 14 - ball_y
                ball_vy = -ball_vy

            if ball_x < 0:
                bi = int(round(ball_y))
                py_top = int(player_y)
                if py_top <= bi <= py_top + PADDLE_LEN - 1:
                    ball_x = -ball_x
                    ball_vx = -ball_vx
                    score += 1
                    hits += 1
                    paddle_center = player_y + (PADDLE_LEN - 1) / 2.0
                    ball_vy += (ball_y - paddle_center) * DEFLECTION
                    if hits % SPEEDUP_HITS == 0:
                        ball_vx *= SPEEDUP_FACTOR
                        ball_vy *= SPEEDUP_FACTOR
                    ball_vx, ball_vy = cap_speed(ball_vx, ball_vy)
                else:
                    render(player_y, cpu_y, ball_x, ball_y)
                    return game_over_sequence(score)

            if ball_x > 7:
                ball_x = 14 - ball_x
                ball_vx = -ball_vx
                hits += 1
                paddle_center = cpu_y + (PADDLE_LEN - 1) / 2.0
                ball_vy += (ball_y - paddle_center) * DEFLECTION
                if hits % SPEEDUP_HITS == 0:
                    ball_vx *= SPEEDUP_FACTOR
                    ball_vy *= SPEEDUP_FACTOR
                ball_vx, ball_vy = cap_speed(ball_vx, ball_vy)

        render(player_y, cpu_y, ball_x, ball_y)
        sleep_ms(FRAME_MS)
        frame += 1


def play():
    while True:
        if play_one_round() == "exit":
            return


def run(neopixel, joystick):
    global np, JOY_UP, JOY_DOWN, JOY_CENTER, _exit_press_start
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
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
