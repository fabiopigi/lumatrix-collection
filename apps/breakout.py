from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random

NAME = "Breakout"
NUM_LEDS = 64

np = None
JOY_LEFT = None
JOY_RIGHT = None
JOY_CENTER = None

PADDLE_LEN = 3
PADDLE_COLOR = (0, 40, 50)
BALL_COLOR   = (50, 50, 50)
SCORE_COL    = (50, 30, 0)
GAMEOVER_COL = (60, 0, 0)
LEVEL_COL    = (0, 50, 30)
LIFE_COL     = (55, 0, 0)
READY_COL    = (40, 30, 0)

FRAME_MS = 50
PADDLE_SPEED = 0.50
INIT_LIVES = 3
LAUNCH_HOLD_MS = 600
DEFLECTION = 0.18
MAX_VX = 0.55
MAX_VY = 0.55

LEVELS = (
    {
        "speed": 0.30,
        "layout": (
            "########",
            "........",
            "........",
            "........",
            "........",
            "........",
            "........",
            "........",
        ),
    },
    {
        "speed": 0.34,
        "layout": (
            "########",
            "########",
            "........",
            "........",
            "........",
            "........",
            "........",
            "........",
        ),
    },
    {
        "speed": 0.38,
        "layout": (
            "#.#.#.#.",
            ".#.#.#.#",
            "#.#.#.#.",
            "........",
            "........",
            "........",
            "........",
            "........",
        ),
    },
    {
        "speed": 0.42,
        "layout": (
            "########",
            "########",
            "########",
            "........",
            "........",
            "........",
            "........",
            "........",
        ),
    },
    {
        "speed": 0.48,
        "layout": (
            "...##...",
            "..####..",
            ".######.",
            "########",
            "........",
            "........",
            "........",
            "........",
        ),
    },
)

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


def parse_level(layout):
    """layout[0] is row 7 (top), layout[7] is row 0 (bottom)."""
    bricks = {}
    for i, line in enumerate(layout):
        row = 7 - i
        for col in range(min(8, len(line))):
            if line[col] == "#":
                bricks[(col, row)] = True
    return bricks


def brick_color(row):
    if row == 7: return (55, 0, 0)
    if row == 6: return (50, 25, 0)
    if row == 5: return (45, 40, 0)
    if row == 4: return (0, 45, 0)
    return (0, 25, 50)


def draw_paddle(paddle_center):
    pc = int(round(paddle_center))
    for off in (-1, 0, 1):
        c = pc + off
        if 0 <= c <= 7:
            px(c, 0, PADDLE_COLOR)


def draw_bricks(bricks):
    for (c, r) in bricks:
        px(c, r, brick_color(r))


def render(paddle_center, ball_x, ball_y, bricks, ball_visible=True):
    clear()
    draw_bricks(bricks)
    draw_paddle(paddle_center)
    if ball_visible:
        bx = int(round(ball_x))
        by = int(round(ball_y))
        px(bx, by, BALL_COLOR)
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


def show_digit(digit, color, hold_ms):
    """Show a single digit centered. Return 'exit' if hold-center triggered, else None."""
    glyph = FONT.get(str(digit), FONT["0"])
    clear()
    for grow in range(7):
        line = glyph[grow]
        mrow = 7 - grow
        for gcol in range(5):
            if line[gcol] == "X":
                px(gcol + 1, mrow, color)
    np.write()
    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < hold_ms:
        if check_exit():
            return "exit"
        sleep_ms(15)
    return None


def cap_speed(vx, vy):
    if vx > MAX_VX: vx = MAX_VX
    elif vx < -MAX_VX: vx = -MAX_VX
    if vy > MAX_VY: vy = MAX_VY
    elif vy < -MAX_VY: vy = -MAX_VY
    return vx, vy


def update_paddle(paddle_center):
    if JOY_LEFT.value() == 0:
        paddle_center -= PADDLE_SPEED
    if JOY_RIGHT.value() == 0:
        paddle_center += PADDLE_SPEED
    if paddle_center < 1.0:
        paddle_center = 1.0
    if paddle_center > 6.0:
        paddle_center = 6.0
    return paddle_center


def play_ball(bricks, base_speed, paddle_center, score):
    """Returns one of:
      ('cleared', score, paddle_center)
      ('lost',    score, paddle_center)
      ('exit',    score, paddle_center)
    """
    ball_x = paddle_center
    ball_y = 1.0
    ball_vx = 0.0
    ball_vy = 0.0

    t0 = ticks_ms()
    while ticks_diff(ticks_ms(), t0) < LAUNCH_HOLD_MS:
        if check_exit():
            return ("exit", score, paddle_center)
        paddle_center = update_paddle(paddle_center)
        ball_x = paddle_center
        render(paddle_center, ball_x, ball_y, bricks)
        sleep_ms(FRAME_MS)

    ball_vy = base_speed
    ball_vx = (random.random() - 0.5) * 0.3

    while True:
        if check_exit():
            return ("exit", score, paddle_center)

        paddle_center = update_paddle(paddle_center)

        ball_x += ball_vx
        ball_y += ball_vy

        if ball_x < 0:
            ball_x = -ball_x
            ball_vx = -ball_vx
        elif ball_x > 7:
            ball_x = 14 - ball_x
            ball_vx = -ball_vx

        if ball_y > 7:
            ball_y = 14 - ball_y
            ball_vy = -ball_vy

        bc = int(round(ball_x))
        br = int(round(ball_y))
        if 0 <= bc <= 7 and 0 <= br <= 7 and (bc, br) in bricks:
            del bricks[(bc, br)]
            score += 1
            prev_x = ball_x - ball_vx
            prev_y = ball_y - ball_vy
            crossed_y = int(round(prev_y)) != br
            crossed_x = int(round(prev_x)) != bc
            if crossed_y and not crossed_x:
                ball_vy = -ball_vy
            elif crossed_x and not crossed_y:
                ball_vx = -ball_vx
            else:
                ball_vy = -ball_vy
                ball_vx = -ball_vx

        if ball_y <= 0 and ball_vy < 0:
            if abs(ball_x - paddle_center) <= 1.5:
                ball_y = -ball_y
                ball_vy = -ball_vy
                offset = ball_x - paddle_center
                ball_vx += offset * DEFLECTION
                ball_vx, ball_vy = cap_speed(ball_vx, ball_vy)
            else:
                render(paddle_center, ball_x, ball_y, bricks, ball_visible=False)
                return ("lost", score, paddle_center)

        if not bricks:
            render(paddle_center, ball_x, ball_y, bricks)
            sleep_ms(200)
            return ("cleared", score, paddle_center)

        render(paddle_center, ball_x, ball_y, bricks)
        sleep_ms(FRAME_MS)


def level_clear_flash():
    for _ in range(2):
        for i in range(NUM_LEDS):
            np[i] = (0, 50, 30)
        np.write()
        sleep_ms(80)
        clear()
        np.write()
        sleep_ms(60)


def play_one_round():
    score = 0
    lives = INIT_LIVES
    level_idx = 0
    paddle_center = 4.0

    while True:
        if check_exit():
            return "exit"

        if show_digit(level_idx + 1, LEVEL_COL, 600) == "exit":
            return "exit"

        bricks = parse_level(LEVELS[level_idx]["layout"])
        speed = LEVELS[level_idx]["speed"]

        while bricks and lives > 0:
            if check_exit():
                return "exit"

            if show_digit(lives, LIFE_COL, 500) == "exit":
                return "exit"

            outcome, score, paddle_center = play_ball(bricks, speed, paddle_center, score)
            if outcome == "exit":
                return "exit"
            if outcome == "lost":
                lives -= 1
            elif outcome == "cleared":
                break

        if lives <= 0:
            return game_over_sequence(score)

        level_clear_flash()
        level_idx = (level_idx + 1) % len(LEVELS)


def play():
    while True:
        if play_one_round() == "exit":
            return


def run(neopixel, joystick):
    global np, JOY_LEFT, JOY_RIGHT, JOY_CENTER, _exit_press_start
    np = neopixel
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
