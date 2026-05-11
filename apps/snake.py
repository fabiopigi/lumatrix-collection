from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random
import _screens as screens

NAME = "Snake"
NUM_LEDS = 64

np = None
JOY_UP = None
JOY_DOWN = None
JOY_LEFT = None
JOY_RIGHT = None

BODY_COLOR = (0, 40, 5)
HEAD_COLOR = (25, 55, 30)
FOOD_COLOR = (55, 15, 0)
WIN_COLOR  = (0, 55, 10)

FRAME_MS = 50
START_INTERVAL = 6
MIN_INTERVAL = 2
SPEEDUP_EVERY = 5


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


def win_flash():
    for _ in range(5):
        for i in range(NUM_LEDS):
            np[i] = WIN_COLOR
        np.write()
        sleep_ms(90)
        clear()
        np.write()
        sleep_ms(70)


def play_one_game():
    """Returns final score, or None if exit triggered mid-play."""
    snake = [(3, 4), (4, 4), (5, 4)]
    snake_set = set(snake)
    food = spawn_food(snake_set)
    score = 0
    current_dir = (1, 0)
    pending_dir = None
    started = False
    move_timer = 0

    while True:
        if screens.check_exit():
            return None

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
                    return score

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
                        win_flash()
                        return score

        render(snake, food)
        sleep_ms(FRAME_MS)


def run(neopixel, joystick):
    global np, JOY_UP, JOY_DOWN, JOY_LEFT, JOY_RIGHT
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    JOY_LEFT = joystick["left"]
    JOY_RIGHT = joystick["right"]
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
