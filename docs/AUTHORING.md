# Authoring an app for LUMATRIX

The full reference for adding a new app to this collection. If you only want the boilerplate, skip to [Templates](#templates).

This guide assumes you already know:
- Python basics (functions, dicts, loops).
- That MicroPython on the Pico has small differences from CPython (no `time.time()`, but `ticks_ms()`; `import` is the same; `print()` works).

It does **not** assume you've shipped MicroPython before.

---

## What an app is

An app is a single `.py` file in `apps/` that exposes two things to the rest of the system:

| Symbol | Purpose |
|---|---|
| `NAME` | Display name for the launcher menu (string, scrolled in the marquee). |
| `run(neopixel, joystick)` | Entry point. The launcher calls this when the user selects your app. |

That's the entire contract. Anything else (game state, helpers, constants) is private to your module.

When `run()` returns, control goes back to the launcher and the user can pick a different app.

---

## App lifecycle

Every app, regardless of what it does, follows the same three-screen lifecycle:

```
launcher → loading_screen → your app → game_over_screen | end_screen → launcher
                                ↑                                ↓
                                └────────── restart ─────────────┘
```

1. **Loading screen** (mandatory, comes from `screens.loading_screen()`):
   - A 2×2 cyan spinner in the centre of the matrix.
   - Waits for the user to commit. Any joystick press = start. Hold center 1.5 s = exit back to launcher without running your app.

2. **Your app** runs.
   - For games: play one round, return its score.
   - For passive apps (no win/lose): run until either the user holds center to exit, or the app detects 10 s of inactivity and bails to the end screen.

3. **End-of-session screen** (one of two):
   - `screens.game_over_screen(score)` — for games. Two red flashes, then a red halftone bar at the top + the score rendered in amber. ≤2 digit scores are static; ≥3 digit scores marquee.
   - `screens.end_screen()` — for passive apps. Green halftone bar at the top + an amber left-pointing arrow. No score.
   - Both screens accept the same inputs: **tap any direction** = restart your app, **hold center 1.5 s** = back to launcher.

Your `run()` function is responsible for wiring these three pieces together. The standard shape is:

```python
def run(neopixel, joystick):
    # ... bind your own hardware refs ...
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        outcome = play_one_round()
        if outcome is None:  # exit triggered mid-play
            return
        if screens.game_over_screen(outcome) == "exit":
            return
```

For passive apps, replace `game_over_screen(score)` with `end_screen()` and drop the score concept.

---

## Repo layout

```
LumaMatrix/
├── main.py                  ← launcher, gets renamed to main.py on the Pico
├── fonts.json               ← font definitions (copy to Pico's filesystem root)
├── apps/
│   ├── _screens.py          ← shared lifecycle screens (loading/game-over/end)
│   ├── _fonts.py            ← loads fonts.json, exposes FONT_3X5 / FONT_5X8
│   ├── reaction.py          ← one of the games
│   ├── flappy.py
│   ├── ...
│   └── <your_app>.py        ← your new app goes here
└── docs/
    ├── AUTHORING.md         ← this file
    └── apps/
        ├── reaction.md      ← per-app docs
        ├── flappy.md
        ├── ...
        └── <your_app>.md    ← your app's docs go here
```

Two things to keep in mind:

- `apps/` is on `sys.path` via the launcher's `sys.path.append("/apps")` at the top of `main.py`. That's why your app can `import _screens` directly without a package prefix.
- The launcher and `apps/_screens.py` both run from the same `np` and `joystick` references; nothing is duplicated. Your app gets its own bindings via `run()`'s parameters.
- The leading underscore on `_screens.py` and `_fonts.py` is a convention: it marks these as **internal shared modules**, visually separating them from the actual apps in the same folder. They behave like any other Python module. Most apps alias on import (`import _screens as screens`) so the in-code calls stay readable.

---

## The shared modules

### `apps/_screens.py`

The single source of truth for entry, exit, and end-of-session UI. Every app imports it.

| Symbol | What it does |
|---|---|
| `init(np, joystick)` | Bind hardware refs. **Call once at the top of `run()`.** Required before any other screens function. |
| `loading_screen()` | Spinner, waits for press. Returns `"start"` or `"exit"`. |
| `game_over_screen(score)` | Red flash → halftone + score. Returns `"restart"` or `"exit"`. |
| `end_screen()` | Green halftone + arrow. Returns `"restart"` or `"exit"`. |
| `show_digit_briefly(digit, color, hold_ms)` | Render a single digit, hold for `hold_ms`. Returns `"exit"` (if user bailed) or `None`. Useful for level/life indicators during gameplay. |
| `check_exit()` | Non-blocking hold-center detector. Returns `True` once when the user has held center for 1.5 s. **Poll this every frame inside your game loop.** |
| `any_input()` | True if any of up/down/left/right is currently held. Excludes center. Use for inactivity tracking in passive apps. |

### `apps/_fonts.py`

| Symbol | What it is |
|---|---|
| `FONT_3X5` | Dict `{char: [5 rows]}`. Uppercase A–Z, digits, basic punctuation. Used by `_screens.py` for scores, by `main.py` for the launcher marquee. |
| `FONT_5X8` | Dict `{char: [8 rows]}`. Adds lowercase a–z and more punctuation. The 8th row is a blank baseline (line spacing). |
| `glyph(font, ch)` | Look up a glyph with fallback chain: exact → uppercase → `' '`. Returns `None` if even `' '` is missing. |

Both fonts are loaded from `/fonts.json` at module import. If that file is missing, `FONT_3X5` falls back to a digit-only embedded subset and `FONT_5X8` becomes empty.

---

## Coordinate system

The matrix has two coordinate systems and you need both:

| System | Origin | Y-axis | Used for |
|---|---|---|---|
| **LED coords** | `(col=0, row=0)` = bottom-left | row increases upward (row 0 = bottom strip, row 7 = top) | Indexing `np[]` directly: `np[row * 8 + col]` |
| **Visual coords** | `(x=0, y=0)` = top-left | y increases downward (y=0 = top, y=7 = bottom) | The design tool, the _screens.py rendering, anything you draw "by eye". |

Conversion: `led_row = 7 - visual_y`.

LED chain index: `index = row * 8 + col`. So index 0 is bottom-left, index 63 is top-right.

Most apps in this repo work in LED coords because that's what the hardware sees directly. The launcher and `_screens.py` work in visual coords because their layouts came from a design tool that uses top-left origin. Pick one per app and stick with it — the helper functions you write will be cleaner.

A common pattern in apps:

```python
def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)

def px(col, row, color):
    """LED coords: col 0 left, row 0 bottom."""
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color
```

If your design tool produces visual-coord layouts, the equivalent helper is:

```python
def px_visual(x, y, color):
    """Visual coords: (0, 0) top-left."""
    if 0 <= x <= 7 and 0 <= y <= 7:
        np[(7 - y) * 8 + x] = color
```

---

## Joystick input

The launcher passes a dict of six pin objects to `run()`:

```python
joystick = {
    "up":     Pin(3,  Pin.IN),   # row decreases visually
    "down":   Pin(6,  Pin.IN),   # row increases visually
    "left":   Pin(7,  Pin.IN),
    "right":  Pin(2,  Pin.IN),
    "center": Pin(8,  Pin.IN),   # the click action
    "slide":  Pin(9,  Pin.IN),   # the side toggle switch
}
```

All buttons are **active-low**: `pin.value() == 0` means pressed, `1` means released.

The center button has two meanings everywhere in the system:

| Gesture | Meaning |
|---|---|
| **Tap** (press + release < 1.5 s) | "Restart", "Confirm", "Fire". App-defined during gameplay. |
| **Hold ≥ 1.5 s** | Always exit to launcher. Universal. Use `screens.check_exit()` to detect this from your game loop. |

`screens.check_exit()` returns `True` exactly once when the threshold is crossed. After that, you have a single frame to return cleanly from your loop.

### Reading the joystick

There are two patterns and you'll use both:

**Continuous (held = active each frame):**
```python
# Inside the game loop:
if joystick["left"].value() == 0:
    paddle_x -= PADDLE_SPEED
if joystick["right"].value() == 0:
    paddle_x += PADDLE_SPEED
```

Use for paddles, ship movement, anything where holding the direction means "keep doing it".

**Edge-triggered (one event per press):**
```python
# Outside the loop:
prev_up = False

# Inside:
cur_up = joystick["up"].value() == 0
if cur_up and not prev_up:
    flap()
prev_up = cur_up
```

Use for "tap to jump" style controls where you don't want the action to repeat while held.

---

## Step-by-step: creating a new app

Walk through the whole process from blank file to running in the launcher.

### 1. Create `apps/<name>.py`

Names use lowercase, no separators (matches the existing files). The `import` name in `main.py` will be the same:

```bash
touch apps/coolgame.py
```

### 2. Standard header

Every app starts the same way:

```python
from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import _screens as screens

NAME = "CoolGame"           # display name in the launcher marquee
NUM_LEDS = 64

np = None                   # bound in run()
# ... bind whatever joystick pins you need ...
JOY_UP = None
```

The `np = None` / `JOY_* = None` pattern is important: **never construct `NeoPixel(...)` or `Pin(...)` at module top level.** That would allocate hardware on `import`, which happens when the launcher first boots. You'd end up with two NeoPixel objects pointing at the same physical strip. Always bind them inside `run()`.

### 3. Write your gameplay

Whatever your app does, structure it so one round can return a value:

```python
def play_one_round():
    """Run a single round/game. Returns the final score, or None if the
    user held center to exit mid-play."""
    score = 0
    while True:
        if screens.check_exit():
            return None
        # ... game logic ...
        if dead:
            return score
        sleep_ms(FRAME_MS)
```

Returning `None` for the "exit" case keeps the `run()` flow clean — see the boilerplate below.

### 4. Wire up `run()`

```python
def run(neopixel, joystick):
    global np, JOY_UP        # whichever module globals you used
    np = neopixel
    JOY_UP = joystick["up"]
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        score = play_one_round()
        if score is None:
            return
        if screens.game_over_screen(score) == "exit":
            return
```

The shape is identical for every game. Copy it.

### 5. Standalone block

So you can `Run` your file directly in Thonny without going through the launcher:

```python
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
```

Calling `run()` once (not in a `while True:`) means hold-center 1.5 s actually exits the script back to the Thonny REPL during dev. That's deliberate.

### 6. Register in the launcher

Edit `main.py`. There are two spots:

```python
# ... existing imports ...
import coolgame                              # ← add this

# ...

APPS = [reaction, letters, flappy, pong, invaders, doom, breakout, snake, coolgame]
#                                                                              ← add here
```

The position in `APPS` determines the app's slot in the launcher's bottom track (and which number the user sees). Adding to the end is the safe default.

### 7. Write your docs

Create `docs/apps/<name>.md`. See [Per-app documentation](#per-app-documentation) below for the required sections.

### 8. Deploy

Copy `<name>.py` to `/apps/` on the Pico's filesystem, alongside the others. The launcher picks it up on next boot.

---

## Scoring methodology

Scoring isn't free: it has to work with the screens, and it has to make the player feel something. Two anchor points define a good scoring curve:

- **~10 points should be reachable in any session.** Even a casual or unlucky run should land here. This is the "you played" baseline. Below ~10 feels punishing.
- **99 points is the soft ceiling.** Above 99 the game-over screen has to marquee the score instead of showing it statically. The static display (red halftone + 2 digits) is the canonical look — keep your scoring inside it.

These two points together imply a roughly **10–60 point session range**, with skilled play occasionally reaching 80–99 and very rarely exceeding 99 (where the marquee kicks in as a "you've gone deep" reward, not a normal outcome).

### Calibration cheat sheet

| Session length | Target score |
|---|---|
| 15 s (quick fail) | 3–8 |
| 30 s (one decent run) | 8–15 |
| 1 min (a good run) | 20–40 |
| 2 min (focused play) | 50–80 |
| 3+ min (expert ceiling) | 80–99 |
| >3 min (rare) | 100+ (marquee territory) |

Use this to think about your scoring + difficulty curve together: how long does your average game last, and what does that translate to in points?

### The levers

For per-action points:

- **Always default to +1 per action** (one wall passed, one alien killed, one ball hit, one food eaten). Larger per-action numbers blow past 99 too fast and waste the score's expressive range.
- **Reserve bigger payouts (+5, +10) for hard or special events.** Boss kills, perfect rounds, level-clearing bonuses. Don't pay them out every few seconds.
- **Resist combo systems** unless you really need one. A 5× multiplier is the easiest way to make scoring meaningless.

For game length:

- **Ramp difficulty over time.** Every game in this repo speeds up as the score grows (`SPEEDUP_HITS` in pong, `LEVEL_THRESHOLDS` in invaders, `move_interval()` in snake, etc.). The ramp should make sustained play increasingly hard so games end before the score explodes.
- **The ramp's job is to enforce the ceiling.** If a skilled player can sustain indefinitely, your ramp is too gentle.
- **Avoid `while True:` with no escalation.** Constant-difficulty games with no natural ending lead to runaway scores.

For player resources:

- **Lives are a length lever, not a score lever.** Breakout has 3 lives; that bounds the session even when the player is mostly competent.
- **Don't give the player too many bullets/jumps/lives at once.** Each one extends the game and multiplies the score.

### Per-app score audit

How the existing apps line up against the 10–99 target:

| App | Per-action | Difficulty ramp | Typical | Expert | Comment |
|---|---|---|---|---|---|
| ArrowReaction | 1–8 (bar remaining) | duration shrinks 60 ms/hit, floor 600 ms | 20–50 | 60–99 | Per-action is variable (1–8), so totals climb fast. Fine. |
| Flappy | +1 per wall | none — fixed wall speed | 10–25 | 50+ | **Could exceed 99.** Add wall-speed ramp if you want a tighter ceiling. |
| Pong | +1 per hit | ×1.15 every 10 hits, capped | 8–30 | 60+ | Ramp eventually overwhelms the player. |
| SpaceInvaders | +1 per alien | 5 discrete levels at score 8, 20, 35, 55 | 15–35 | 70+ | Ramp working. |
| Breakout | +1 per brick | 5 levels, faster ball each | 20–60 | 80+ | Bricks are finite per level, but levels loop. |
| Snake | +1 per food | move interval shrinks every 5 foods | 10–25 | 40–60 | Capped at 61 (grid full). |
| Doom | n/a | n/a | — | — | Passive (no score). |
| LetterDisplay | n/a | n/a | — | — | Passive (no score). |

If a new app routinely produces 100+ scores during normal play, tighten the difficulty ramp before changing the per-action value.

---

## Per-app documentation

Every app **must** have a doc at `docs/apps/<name>.md`. Use this template:

```markdown
# AppName

> One-line description.

## How to play

(Controls, the basic gameplay flow, what the player is trying to do.)

## Scoring

(How points are earned. Include the expected range — 10 should be easy, 99 hard.)

## Mechanics

(Internal model: what's moving, what spawns when, what kills the player.)

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Frame rate cap, 50 ms = 20 fps |
| `...` | ... | ... |

## Implementation notes

(Anything subtle about the code, edge cases handled, gotchas.)
```

Sections you can skip on a per-app basis:
- **Scoring** for passive apps (use a "Behavior" section instead describing how long it runs).
- **Tunables** if there's only one constant worth mentioning (inline it in Mechanics).

Sections you should never skip:
- **How to play** — the user needs to know what to do.
- **Mechanics** — your future self needs to remember what you did.

The existing apps in `docs/apps/` are filled-in examples; copy the closest one and edit.

---

## Do's and Don'ts

### Do

- ✅ **Construct hardware inside `run()`**, never at module top level. Use `np = None` / `JOY_* = None` and bind them inside `run()` and the `__main__` block.
- ✅ **Always call `screens.init(np, joystick)` once at the start of `run()`** before any other screens function.
- ✅ **Poll `screens.check_exit()` every frame** inside your game loop. Without it, the user can't bail mid-game.
- ✅ **Return `None` from your `play_one_round()` when exit is triggered**, so the outer `run()` can clean up.
- ✅ **Use the shared `screens` and `fonts` modules** for anything that touches lifecycle UI or text. Don't roll your own.
- ✅ **Match the existing visual conventions** — moderate brightness (rgb values ~30–60 of 255), per-game accent colors, dim background hues. Full `#ffffff` (255 white) at close range is painful.
- ✅ **Test in standalone mode** (`Run` in Thonny) before integrating into the launcher. Standalone gives you a clean Ctrl-C escape if something hangs.
- ✅ **Write your `docs/apps/<name>.md`** before considering the app done. If you can't describe the scoring in plain English, it probably needs another pass.
- ✅ **Add your app to `APPS = [...]` in `main.py`** to make the launcher see it.

### Don't

- ❌ **Don't construct `NeoPixel(...)` or `Pin(...)` at module top level.** Importing your app would allocate hardware the launcher already owns.
- ❌ **Don't put `while True: run(_np, _joy)` in your `__main__` block.** Use a single `run(_np, _joy)`. Hold-center then returns to REPL during dev (which is what you want in Thonny). The internal restart loop inside `run()` already handles "user wants to play again".
- ❌ **Don't reimplement game-over UI inside your app.** No private flash sequences, no private score marquees. Use `screens.game_over_screen(score)`.
- ❌ **Don't read `sys.stdin` from a game loop unless you handle Ctrl-C explicitly.** The serial byte 0x03 gets eaten by `sys.stdin.read(1)` instead of triggering `KeyboardInterrupt`, which means Thonny can't break you out. See `apps/letters.py` for how to handle this.
- ❌ **Don't block in `sleep_ms()` for longer than ~50 ms at a time** if you're between input checks. The user expects sub-100ms response to direction presses; a single `sleep_ms(500)` makes the joystick feel laggy.
- ❌ **Don't run unbounded `while True:` loops without `sleep_ms()`.** Even if you have nothing to do, sleep at least 10 ms per iteration so Ctrl-C and `check_exit()` get a chance to fire.
- ❌ **Don't hardcode the fonts.** Import from `_fonts.py`. There is one font module for the whole project.
- ❌ **Don't design a scoring system that routinely produces 100+ scores.** It's not wrong, but it forces the marquee path on every game and waste's the static design's expressive range. Re-read [Scoring methodology](#scoring-methodology).
- ❌ **Don't skip the loading screen.** Even for an app where it feels redundant, that 2×2 spinner is the user's "did I just launch the right thing?" confirmation. Always start with `screens.loading_screen()`.

---

## Templates

### Game app (with score)

```python
from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import _screens as screens

NAME = "MyGame"
NUM_LEDS = 64

# Hardware bindings — set in run()
np = None
# Add any joystick pins your game reads:
# JOY_UP = None
# JOY_LEFT = None
# ...

# Tunables
FRAME_MS = 50


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px(col, row, color):
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color


def play_one_round():
    """Run one game until the player loses. Returns the final score,
    or None if the user held center to exit mid-play."""
    score = 0
    while True:
        if screens.check_exit():
            return None
        # ... game logic, updating `score` ...
        # if dead:
        #     return score
        clear()
        # ... render frame ...
        np.write()
        sleep_ms(FRAME_MS)


def run(neopixel, joystick):
    global np
    np = neopixel
    # bind your joystick pins:
    # global JOY_UP
    # JOY_UP = joystick["up"]
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
```

### Passive app (no score, ends on inactivity)

```python
from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import _screens as screens

NAME = "MyDemo"
NUM_LEDS = 64
IDLE_MS = 10_000

np = None
FRAME_MS = 50


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def show_animation():
    """One session. Returns 'exit' on hold-center, 'idle' after 10 s no input."""
    last_activity = ticks_ms()
    while True:
        if screens.check_exit():
            return "exit"
        if screens.any_input():
            last_activity = ticks_ms()
        if ticks_diff(ticks_ms(), last_activity) >= IDLE_MS:
            return "idle"
        # ... render one frame ...
        sleep_ms(FRAME_MS)


def run(neopixel, joystick):
    global np
    np = neopixel
    screens.init(neopixel, joystick)
    while True:
        if screens.loading_screen() == "exit":
            return
        outcome = show_animation()
        if outcome == "exit":
            return
        if screens.end_screen() == "exit":
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
```

---

## Common pitfalls

A few specific failure modes that came up during the migration of the existing apps:

**Hardware allocated twice.** If you `NeoPixel(Pin(19, Pin.OUT), 64)` at module top, the launcher's `import myapp` will allocate a second NeoPixel object pointing at the same physical strip. Tests pass, but the LEDs flicker in subtle ways and `np.write()` may race. Always bind inside `run()`.

**Joystick still held when entering a screen.** The user just pressed center to launch your app, and your `loading_screen()` immediately fires because center is still held. `_screens.py` handles this — it calls `_wait_release()` first — but if you write your own input loops, you need the same wait. Otherwise the first "tap" your loop sees is a phantom press.

**`sys.stdin.read(1)` swallows Ctrl-C.** MicroPython normally raises `KeyboardInterrupt` on byte 0x03, but if your code is actively reading from stdin (like the letters app does for serial input), you have to check for 0x03 yourself and return cleanly. `apps/letters.py` is the reference implementation:

```python
ch = sys.stdin.read(1)
if ch in ("\x03", "\x04"):   # Ctrl-C, Ctrl-D
    return
```

**Game over screen shows nothing.** Almost always means you returned the wrong type from `play_one_round()`. `screens.game_over_screen(score)` calls `str(int(score))` — if you returned `None` (because exit was triggered) and forgot to check before calling, you'll get a crash. Always handle the `None` case explicitly in `run()`.

**Standalone runs the app twice.** Caused by `while True: run(_np, _joy)` in `__main__`. The internal restart loop inside `run()` already handles "user wants to play again". The outer `while True:` only kicks in when the user holds center to exit, which immediately re-enters loading — feels broken. Use a single `run(_np, _joy)`.

---

## Hardware reference

For when you need it. From the LUMATRIX cheat sheet:

| Component | GPIO | Notes |
|---|---|---|
| NeoPixel data | 19 | 64 LEDs, ws2812-compatible |
| Joystick up | 3 | active-low |
| Joystick down | 6 | active-low |
| Joystick left | 7 | active-low |
| Joystick right | 2 | active-low |
| Joystick center (click) | 8 | active-low |
| Slide switch | 9 | toggle, 0 or 1 |

The launcher constructs all of these in `main.py` and passes them as a dict to your `run()`. Don't repeat the constructors in your app file — let the launcher own them.

---

## When to ask for review

Before merging a new app:

1. Does it run standalone (`Run` in Thonny)?
2. Does it run from the launcher?
3. Hold center 1.5 s mid-play — does it return to the launcher?
4. Hit a game-over — does the score show? Does tap-to-restart work?
5. Is there a doc at `docs/apps/<name>.md`?
6. Are typical scores in the 10–60 range, with skilled scores ≤ 99 most of the time?

If all six are "yes", you're done.
