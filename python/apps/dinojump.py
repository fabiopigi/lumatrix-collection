"""DinoJump — Chrome-dino-style side scroller for LumenLab."""

from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random
import _screens as screens

NAME = "DinoJump"
NUM_LEDS = 64

np = None
JOY_UP = None
JOY_DOWN = None

# Visual coordinates: y=0 is top, y=7 is bottom.
DINO_COL = 2                # 3rd pixel from the left (1-indexed)
GROUND_Y = 7                # ground line row
OBSTACLE_GROUND_Y = 6       # short obstacle, must JUMP over
OBSTACLE_AIR_Y    = 5       # high obstacle, must DUCK under

# Tunables
FRAME_MS = 40
MOVE_INTERVAL_START = 320   # ms per world step at game start
MOVE_INTERVAL_MIN   = 100   # floor speed (fastest the world scrolls)
SPEEDUP_EVERY_PX = 50       # distance between speedups
SPEEDUP_STEP_MS  = 30       # how much each speedup shaves off the tick
SPEEDUP_BONUS    = 3        # score bonus at each speedup
GAP_MIN = 3                 # min world steps between obstacle spawns
GAP_MAX = 10                # max world steps between obstacle spawns
JUMP_TICKS = 2              # world steps the dino spends airborne
INITIAL_DELAY_TICKS = 4     # steps before the first obstacle spawns

BRIGHTNESS = 0.25


def _dim(h, scale=BRIGHTNESS):
    h = h.lstrip("#")
    return (int(int(h[0:2], 16) * scale),
            int(int(h[2:4], 16) * scale),
            int(int(h[4:6], 16) * scale))


GROUND_COLOR   = _dim("#404048")
OBSTACLE_COLOR = _dim("#A0A0A8")
DINO_COLOR     = _dim("#669C35")


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px_visual(x, y, color):
    """Write a pixel using visual coords (y=0 top, y=7 bottom)."""
    if 0 <= x <= 7 and 0 <= y <= 7:
        np[(7 - y) * 8 + x] = color


def dino_rows(airborne, ducking):
    """Return the visual y rows the dino currently occupies."""
    if airborne:
        return (4, 5)
    if ducking:
        return (6,)
    return (5, 6)


def render(obstacles, airborne, ducking):
    clear()
    for x in range(8):
        px_visual(x, GROUND_Y, GROUND_COLOR)
    for ox, oy in obstacles:
        px_visual(ox, oy, OBSTACLE_COLOR)
    for dy in dino_rows(airborne, ducking):
        px_visual(DINO_COL, dy, DINO_COLOR)
    np.write()


def play_one_round():
    """One run. Returns the final score, or None if exit was held mid-play."""
    obstacles = []                  # [[x, y], ...] in visual coords
    spawn_cooldown = INITIAL_DELAY_TICKS
    jump_t = 0
    prev_up = False
    score = 0
    distance = 0
    move_interval = MOVE_INTERVAL_START
    last_tick = ticks_ms()

    render(obstacles, False, False)

    while True:
        if screens.check_exit():
            return None

        cur_up = JOY_UP.value() == 0
        airborne = jump_t > 0
        if cur_up and not prev_up and not airborne:
            jump_t = JUMP_TICKS
            airborne = True
        prev_up = cur_up
        ducking = (not airborne) and JOY_DOWN.value() == 0

        now = ticks_ms()
        if ticks_diff(now, last_tick) >= move_interval:
            last_tick = now

            new_obs = []
            for ox, oy in obstacles:
                nx = ox - 1
                if nx >= 0:
                    new_obs.append([nx, oy])
            obstacles = new_obs

            spawn_cooldown -= 1
            if spawn_cooldown <= 0:
                oy = OBSTACLE_AIR_Y if random.getrandbits(1) else OBSTACLE_GROUND_Y
                obstacles.append([8, oy])
                spawn_cooldown = random.randint(GAP_MIN, GAP_MAX)

            distance += 1
            if distance % SPEEDUP_EVERY_PX == 0 and move_interval > MOVE_INTERVAL_MIN:
                move_interval = max(MOVE_INTERVAL_MIN, move_interval - SPEEDUP_STEP_MS)
                score += SPEEDUP_BONUS

            dino_ys = dino_rows(airborne, ducking)
            for ox, oy in obstacles:
                if ox == DINO_COL:
                    if oy in dino_ys:
                        render(obstacles, airborne, ducking)
                        return score
                    score += 1

            if jump_t > 0:
                jump_t -= 1

        render(obstacles, airborne, ducking)
        sleep_ms(FRAME_MS)


def run(neopixel, joystick):
    global np, JOY_UP, JOY_DOWN
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        score = play_one_round()
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
