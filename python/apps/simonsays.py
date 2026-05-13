from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import random
import _screens as screens

NAME = "Simon Says"
NUM_LEDS = 64

# Tunables
PATTERN_LEN = 32         # max rounds (matches the marquee-avoiding ceiling)
FLASH_MS = 500           # panel-on duration during playback
GAP_MS = 200             # gap between flashes during playback
PRE_PLAYBACK_MS = 700    # pause before each round's playback
PRESS_FLASH_MS = 150     # bright feedback flash on a correct press
INPUT_TIMEOUT_MS = 3000  # per-press timeout during echo
ROUND_CLEAR_MS = 400     # pause after completing a round

# Brightness scaling (design hex values are full 0..255 intensity).
BRIGHT_SCALE = 0.5
DIM_SCALE = 0.06

DIRS = ("up", "down", "left", "right")


def _scale(hex_color, scale):
    h = hex_color.lstrip("#")
    return (int(int(h[0:2], 16) * scale),
            int(int(h[2:4], 16) * scale),
            int(int(h[4:6], 16) * scale))


# Each panel: letter -> (hex, led-indices, joystick direction).
_PANEL_DEFS = (
    ("R", "#800000", (16, 24, 25, 32, 33, 40), "left"),
    ("G", "#4e7a27", (51, 52, 58, 59, 60, 61), "up"),
    ("B", "#0042a9", (2, 3, 4, 5, 11, 12),     "down"),
    ("Y", "#a67b01", (23, 30, 31, 38, 39, 47), "right"),
)

PANELS = {}
for _letter, _hex, _leds, _dir in _PANEL_DEFS:
    PANELS[_letter] = {
        "bright": _scale(_hex, BRIGHT_SCALE),
        "dim":    _scale(_hex, DIM_SCALE),
        "leds":   _leds,
        "dir":    _dir,
    }

DIR_TO_LETTER = {PANELS[ltr]["dir"]: ltr for ltr in PANELS}

# Hardware bindings — set in run()
np = None
PINS = {}


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def render(highlight=None):
    """All four panels dim, except `highlight` (a letter) which is bright."""
    clear()
    for letter, panel in PANELS.items():
        color = panel["bright"] if letter == highlight else panel["dim"]
        for idx in panel["leds"]:
            np[idx] = color
    np.write()


def flash_panel(letter, ms):
    render(highlight=letter)
    sleep_ms(ms)
    render()


def playback(pattern, length):
    """Play back pattern[:length]. Returns 'exit' if user bailed, else None."""
    render()
    sleep_ms(PRE_PLAYBACK_MS)
    for i in range(length):
        if screens.check_exit():
            return "exit"
        render(highlight=pattern[i])
        sleep_ms(FLASH_MS)
        render()
        sleep_ms(GAP_MS)
    return None


def read_direction():
    for d in DIRS:
        if PINS[d].value() == 0:
            return d
    return None


def wait_for_release():
    """Wait until no directional pin is held. Returns 'exit' or None."""
    while read_direction() is not None:
        if screens.check_exit():
            return "exit"
        sleep_ms(10)
    return None


def wait_for_press():
    """Wait for a directional press. Returns the direction string,
    or 'timeout' / 'exit'."""
    start = ticks_ms()
    while ticks_diff(ticks_ms(), start) < INPUT_TIMEOUT_MS:
        if screens.check_exit():
            return "exit"
        d = read_direction()
        if d is not None:
            return d
        sleep_ms(10)
    return "timeout"


def echo(pattern, length):
    """Player must press the directions for pattern[:length] in order.
    Returns 'correct' | 'wrong' | 'timeout' | 'exit'."""
    for i in range(length):
        if wait_for_release() == "exit":
            return "exit"
        press = wait_for_press()
        if press in ("exit", "timeout"):
            return press
        if press != PANELS[pattern[i]]["dir"]:
            return "wrong"
        flash_panel(pattern[i], PRESS_FLASH_MS)
    return "correct"


def generate_pattern():
    return "".join(random.choice("RGBY") for _ in range(PATTERN_LEN))


def play_one_game():
    """Run one Simon Says game. Returns the final score (rounds completed),
    or None if the user held center to exit mid-play."""
    pattern = generate_pattern()
    completed = 0
    for length in range(1, PATTERN_LEN + 1):
        if playback(pattern, length) == "exit":
            return None
        result = echo(pattern, length)
        if result == "exit":
            return None
        if result in ("wrong", "timeout"):
            return completed
        completed = length
        render()
        sleep_ms(ROUND_CLEAR_MS)
    return completed


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
