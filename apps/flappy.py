from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random
import _screens as screens

NAME = "FlappyPixels"
NUM_LEDS = 64

np = None
JOY_UP = None
JOY_DOWN = None
JOY_SLIDE = None

PLAYER_COL = 0
WALL_COLOR = (0, 40, 10)
PLAYER_COLOR_GRAVITY = (60, 45, 0)
PLAYER_COLOR_FLOAT   = (0, 45, 55)

FRAME_MS = 50
GAP_SIZE = 3
WALL_TICK = 6
SPAWN_TICK = 24

GRAVITY = 0.05
JUMP_DELTA = 0.40
JUMP_CAP = -1.0
TERMINAL_VEL = 1.5

FLOAT_ACCEL = 0.025
FLOAT_TERMINAL = 0.40


def slide_mode():
    if JOY_SLIDE is None:
        return "gravity"
    return "gravity" if JOY_SLIDE.value() == 0 else "float"


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


def play_one_game():
    """Returns final score, or None if exit triggered mid-play."""
    player_y = 3.5
    velocity = 0.0
    walls = []
    score = 0
    frame = 0
    prev_up = False
    intro_frames = 14

    while True:
        if screens.check_exit():
            return None

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
                    return score

            if (frame - intro_frames) % SPAWN_TICK == 0:
                walls.append({"col": 7, "gap": random.randint(0, 7 - GAP_SIZE)})

        render(player_y, walls, mode)

        if ground_hit:
            return score

        sleep_ms(FRAME_MS)
        frame += 1


def run(neopixel, joystick):
    global np, JOY_UP, JOY_DOWN, JOY_SLIDE
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    JOY_SLIDE = joystick.get("slide")
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
