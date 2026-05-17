from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random
import _screens as screens

NAME = "Pong"
NUM_LEDS = 64

np = None
JOY_UP = None
JOY_DOWN = None

PLAYER_COL = 0
CPU_COL = 7
PADDLE_LEN = 2

PLAYER_COLOR = (0, 30, 60)
CPU_COLOR    = (55, 0, 0)
BALL_COLOR   = (55, 55, 55)

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


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px(col, row, color):
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color


def draw_paddle(col, top_y, color):
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


def cap_speed(vx, vy):
    if vx > MAX_VX: vx = MAX_VX
    elif vx < -MAX_VX: vx = -MAX_VX
    if vy > MAX_VY: vy = MAX_VY
    elif vy < -MAX_VY: vy = -MAX_VY
    return vx, vy


def play_one_game():
    """Returns final score, or None if exit triggered mid-play."""
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
        if screens.check_exit():
            return None

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
                    return score

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


def run(neopixel, joystick, display=None, screens_np=None):
    global np, JOY_UP, JOY_DOWN
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    screens.init(screens_np if screens_np is not None else neopixel, joystick,
                 display["width"] if display else None,
                 display["height"] if display else None)
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
