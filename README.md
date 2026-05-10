# LUMATRIX app conventions

How apps in this collection start, end, and hand the user back to the launcher. Every app — game or demo — moves through the same three shared screens.

## The three screens

### 1. Loading screen (entry)

When the launcher calls `run(np, joystick)`, the app **always** shows the loading screen first. Real logic doesn't start until the user commits.

**Visual:** a 2×2 square in the dead centre of the matrix (cols 3–4, rows 3–4). One pixel of the square is lit at a time and steps around the four corners — top-left → top-right → bottom-right → bottom-left → repeat — every ~200 ms. Visual spinner.

**Input:**

- **Any joystick press** (up / down / left / right / center): app starts.
- **Hold center 1.5 s**: return to launcher without starting.

### 2. Game Over screen (apps with a score)

When a game ends — player died, time out, ball lost, etc. — the app calls `screens.game_over_screen(score)`. This screen takes over the matrix:

1. A short red flash sequence (~1 s).
2. The score, rendered using the 3×5 font:
   - **≤ 2 digits**: shown static, centred (one digit at x=3, two digits at x=1..7 with a 1-col gap).
   - **> 2 digits**: scrolling marquee, left-to-right, looping until the user reacts.

### 3. End screen (apps with no game-over state)

For demos, animations, letter displays, etc. The app calls `screens.end_screen()` when the session ends. For purely passive apps (no user interaction), the End screen appears automatically after **10 s of inactivity** — see the boilerplate below.

**Visual:** a static dim-red 4×4 square centred on the matrix (cols 2–5, rows 2–5). A clear "stop" indicator, visually distinct from the spinning loader.

### Shared input on Game Over / End

Both end screens use the same input model:

- **Any joystick press** (single tap, any direction): restart — flow returns to the loading screen.
- **Hold center 1.5 s**: return to launcher.

## The shared module: `apps/screens.py`

All three screens live in one file so apps don't each carry their own copies of `check_exit`, the red-flash sequence, the digit font, the marquee, etc.

### API

```python
import screens

# Once at the start of run(), bind hardware:
screens.init(np, joystick)

# Loading spinner. Blocks until the user commits.
#   "start" – user pressed any direction
#   "exit"  – user held center 1.5 s
result = screens.loading_screen()

# End of a game. Score is an int. Blocks until the user reacts.
#   "restart" – tap
#   "exit"    – hold center 1.5 s
result = screens.game_over_screen(score)

# End of a passive app or a session with no score:
result = screens.end_screen()

# Poll inside your main loop to detect hold-center 1.5 s.
# Returns True once, when the threshold is crossed.
if screens.check_exit():
    return

# True if any joystick direction is currently pressed.
# Use for inactivity tracking in demos.
if screens.any_input():
    last_activity = ticks_ms()
```

### What lives in `screens.py`

- `init(np, joystick)` — bind hardware references for the module.
- `loading_screen()` — the 2×2 spinner + "wait for any key" logic.
- `game_over_screen(score)` — red flash + static/marquee score render.
- `end_screen()` — dim red square + "tap to restart, hold to exit" logic.
- `check_exit()` — non-blocking hold-center detector for use inside game loops.
- `any_input()` — non-blocking "is any direction held".
- Embedded 3×5 digit font (`0`–`9`). Apps that need more characters (letters, demos) keep loading `/fonts.json` themselves; `screens.py` doesn't depend on it.
- Brightness, colour, and timing constants at the top of the file so they're easy to tweak globally.

## Boilerplate: game-style app

A game has a score and a clear lose state. Pattern:

```python
from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import screens

NAME = "MyGame"
NUM_LEDS = 64


def play_one_round():
    """Run one game until the player loses. Return the final score,
    or None if the user exited via hold-center mid-play."""
    score = 0
    while True:
        if screens.check_exit():
            return None
        # ... game logic, updating score ...
        # if dead:
        #     return score
        sleep_ms(50)


def run(neopixel, joystick):
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        score = play_one_round()
        if score is None:           # exit triggered mid-play
            return
        if screens.game_over_screen(score) == "exit":
            return
        # otherwise: loop back to loading_screen for a fresh round


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
```

## Boilerplate: passive / demo app (no score, auto-end on inactivity)

For demos, animations, or other apps that have no natural "you lost" event. Inactivity timeout drops the user onto the End screen automatically.

```python
from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import screens

NAME = "MyDemo"
NUM_LEDS = 64
INACTIVITY_MS = 10_000


def show_animation():
    """One session of the animation. Returns:
       'exit'    – user held center 1.5 s
       'idle'    – inactivity timeout reached
       (Returns when either condition triggers.)"""
    last_activity = ticks_ms()
    while True:
        if screens.check_exit():
            return "exit"
        if screens.any_input():
            last_activity = ticks_ms()
            # ... handle the input here if your demo reacts to it ...
        if ticks_diff(ticks_ms(), last_activity) > INACTIVITY_MS:
            return "idle"
        # ... render one frame ...
        sleep_ms(50)


def run(neopixel, joystick):
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        outcome = show_animation()
        if outcome == "exit":
            return
        if screens.end_screen() == "exit":
            return
        # otherwise: loop back through loading_screen for a fresh session


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
```

## Migrating existing apps

Each current app carries its own copy of the same helpers (`check_exit`, `gameover_input`, `_gameover_wait`, `gameover_marquee`, `game_over_sequence`, an inline digit font). To migrate:

1. **Delete** the local `check_exit`, `gameover_input`, `_gameover_wait`, `gameover_marquee`, `game_over_sequence`, `_exit_press_start`, and the digit subset of `FONT` from the app file.
2. **Add** `import screens` at the top.
3. **Replace** the old `game_over_sequence(score)` call with `screens.game_over_screen(score)`. Match its return value to `"restart"` / `"exit"` the same way.
4. **Wrap** the entry point in `screens.loading_screen()` — see boilerplate. The previous "press any direction to start" loops (e.g. `pulse_until_press` in reaction) get deleted in favour of this.
5. **Replace** module-level `check_exit()` calls inside your game loop with `screens.check_exit()` — same semantics.
6. App-specific logic (paddle physics, brick layouts, alien AI, etc.) stays exactly where it is.

After migration, an average app file should shrink by roughly 100–150 lines.

### Apps and which screen they use

| App                | Has score? | End screen      |
|--------------------|------------|-----------------|
| `reaction.py`      | yes        | game over       |
| `letters.py`       | no         | end (idle 10 s) |
| `flappy.py`        | yes        | game over       |
| `pong.py`          | yes        | game over       |
| `invaders.py`      | yes        | game over       |
| `doom.py`          | no         | end (idle 10 s) |
| `breakout.py`      | yes        | game over       |
| `snake.py`         | yes        | game over       |
| `pixeldesigner.py` | no         | end (idle 10 s) |
| `palettefonts.py`  | no         | end (idle 10 s) |

`doom.py` is borderline — it has no score and no lose state (enemies respawn forever), so it gets the End screen on inactivity. If you ever add a health system, it graduates to the game-over screen.
