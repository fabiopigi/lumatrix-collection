# Authoring an app for LumenLab

The full reference for adding a new app to this collection. If you only want the boilerplate, skip to [Templates](#templates).

This guide assumes you already know:
- Python basics (functions, dicts, loops).
- That MicroPython on the Pico has small differences from CPython (no `time.time()`, but `ticks_ms()`; `import` is the same; `print()` works).

It does **not** assume you've shipped MicroPython before.

---

## What an app is

An app is a single `.py` file in `python/apps/` that exposes two things to the rest of the system:

| Symbol | Purpose |
|---|---|
| `NAME` | Display name for the launcher marquee (string). |
| `run(neopixel, joystick, display=None, screens_np=None)` | Entry point. The launcher calls this when the user selects your app. |

That's the entire contract. Anything else (game state, helpers, constants) is private to your module.

When `run()` returns, control goes back to the launcher and the user can pick a different app.

### The four `run()` arguments

| Arg | What it is |
|---|---|
| `neopixel` | Your **gameplay buffer**. Default: a virtual 8×8 (64 LEDs) buffer the launcher mirrors onto the real display. You can ignore the rest of the args entirely and write a classic 8×8 app — `np[row * 8 + col] = (r, g, b)` and `np.write()` just work. |
| `joystick` | A dict of six `Pin` objects: `up`, `down`, `left`, `right`, `center`, `slide`. All active-low. |
| `display` | `{"width": W, "height": H}` — the actual physical display dimensions. Only meaningful if you opt into responsive mode (see below). Can be `None` when running standalone. |
| `screens_np` | The full-display NeoPixel buffer (W×H). Pass this to `screens.init` so loading / game-over / end screens render at native resolution instead of the 8×8 scale-up. Can be `None` when running standalone. |

### Responsive vs. classic apps

Apps come in two flavours:

- **Classic (default).** Don't set `RESPONSIVE`. Render to the 8×8 source buffer. The launcher integer-scales + centres your output onto whatever physical display is configured. Zero responsive code, costs nothing.
- **Responsive (opt-in).** Set `RESPONSIVE = True` at module top. The launcher gives you a W×H gameplay buffer, you read `display["width"]` / `display["height"]` in your render code. Required if you want UI elements (paddles, levels, walls) to scale or reshape with the actual hardware.

You can write a great app without ever caring about responsive mode. Use it when "more screen = more game" is meaningful (Snake's grid, Pong's paddle, Doom's raycaster).

---

## Where to start: simulator first?

**Before writing any code, ask the user this question:**

> **"Do you want to build this app in the web simulator first, then port it to the Pico — or go straight to MicroPython?"**

There's almost always a good reason to start in the simulator:

- **Faster iteration.** No flashing, no Thonny disconnect dance. Save the file, the dev server hot-reloads, see the result. Cycle time is seconds vs ~30 s on hardware.
- **Real debugging.** Browser DevTools, breakpoints, console logs, time travel — none of which exist on a Pico.
- **No "is the hardware to blame?" ambiguity.** When something breaks in the sim, it's your code. On the Pico it might be a wiring quirk, a brightness issue, a serial-port lock, or a soft brick.
- **The port is mostly mechanical.** The TypeScript simulator under `web-toolkit/src/lib/simulator/` is a direct API mirror of the MicroPython codebase: same `np[i] = [r, g, b]` writes, same `pin.value() === 0` active-low, same `screens` and `fonts` modules. Once the sim works, translating to Python is rote — see [Porting from TypeScript to MicroPython](#porting-from-typescript-to-micropython).
- **The user can test without a Pico.** They can open the sim in any browser, click the on-screen joystick or use keyboard, and tell you what feels off.

Reasons to skip the simulator and go straight to Python:

- The app depends on something the simulator doesn't model (specific timing artifacts on the WS2812 strip, the slide switch in a way the sim doesn't simulate yet, USB serial input).
- You're prototyping a one-off animation and don't care about cross-platform parity.
- The user explicitly says they want hardware-only.

**The default recommendation is simulator-first.** If unsure, ask the user — don't decide silently. The workflow then becomes:

```
1. Ask:   "Web simulator first, or straight to MicroPython?"
2. Build: web-toolkit/src/lib/simulator/apps/<name>.ts
          and wire into web-toolkit/src/lib/simulator/launcher.ts
3. Test:  cd web-toolkit && npm run dev, open the LumenSimulator page.
4. Iterate based on user feedback in the browser.
5. Port:  copy the .ts into python/apps/<name>.py with the mechanical
          translation (await → blocking, [] → (), dict-access conventions).
6. Test:  user flashes to the Pico, confirms it behaves the same.
```

If the user picks "straight to MicroPython", skip ahead to [Step-by-step](#step-by-step-creating-a-new-app) and ignore the simulator paths.

---

## App lifecycle

Every app, regardless of what it does, follows the same three-screen lifecycle:

```
launcher → loading_screen → your app → game_over_screen | end_screen → launcher
                                ↑                                ↓
                                └────────── restart ─────────────┘
```

1. **Loading screen** (`screens.loading_screen()`): a rotating clockwise spinner — a 2×2 ring on 8×8 displays, an 8-pixel diamond on ≤ 16, a 16-pixel circle on larger panels. Waits for the user to commit. Any joystick press = start. Hold center 1.5 s = exit back to launcher without running your app.

2. **Your app** runs.
   - For games: play one round, return its score.
   - For passive apps (no win/lose): run until either the user holds center to exit, or the app detects 10 s of inactivity and bails to the end screen.

3. **End-of-session screen** (one of two):
   - `screens.game_over_screen(score)` — for games. Scrolling red/orange checker banner top + bottom, score centred in size-appropriate font (3×5, 5×8, or 7×9 by height). Scores that don't fit the display width marquee horizontally. Tall displays (h ≥ 24) get a small "SCORE" label above.
   - `screens.end_screen()` — for passive apps. Scrolling blue/green checker banner + a filled amber left-pointing arrow.
   - Both screens accept the same inputs: **tap any direction** = restart your app, **hold center 1.5 s** = back to launcher.

Your `run()` function is responsible for wiring these three pieces together. The standard shape is:

```python
def run(neopixel, joystick, display=None, screens_np=None):
    # ... bind your own module-globals from the args ...
    screens.init(screens_np if screens_np is not None else neopixel, joystick,
                 display["width"] if display else None,
                 display["height"] if display else None)
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

The `screens.init` line is verbose because it has to cope with the standalone case (`display=None`, `screens_np=None`), but every app uses it verbatim — copy-paste from the templates.

---

## Repo layout

```
LumaMatrix/
├── python/
│   ├── main.py              ← launcher, gets flashed as main.py on the Pico
│   └── apps/
│       ├── _screens.py      ← shared lifecycle screens (loading/game-over/end)
│       ├── _fonts.py        ← loads fonts.json, exposes FONT_3X5 / FONT_5X8 / FONT_7X9
│       ├── reaction.py      ← one of the games
│       ├── flappy.py
│       ├── ...
│       └── <your_app>.py    ← your new app goes here
├── web-toolkit/             ← Next.js app: LumenSimulator + LumenDesigner
│   ├── package.json         ← `npm install && npm run dev`
│   └── src/
│       ├── app/             ← Next.js routes (/, /simulator, /designer, /create, /flash)
│       └── lib/
│           ├── simulator/
│           │   ├── launcher.ts          ← port of main.py
│           │   ├── screens.ts           ← port of _screens.py
│           │   ├── fonts.ts             ← port of _fonts.py
│           │   ├── runtime/time.ts      ← ticks_ms / ticks_diff / sleep_ms
│           │   ├── hardware/            ← NeoPixel, joystick, slide
│           │   └── apps/
│           │       ├── reaction.ts      ← port of reaction.py
│           │       ├── ...
│           │       └── <your_app>.ts    ← your new app (sim-first path)
│           └── pixel-designer/
├── shared/
│   ├── fonts.json              ← font definitions (copy to / on the Pico; also imported by the simulator at build time)
│   ├── hardware-presets.json   ← canonical display sizes (8×8, 16×16, 32×8, 8×32, 32×32)
│   └── design/
│       └── boot-animation.json ← launcher boot animation (copy to / on the Pico)
└── docs/
    ├── AUTHORING.md         ← this file
    ├── responsive-scaling.md
    └── apps/
        ├── reaction.md      ← per-app docs
        ├── flappy.md
        ├── ...
        └── <your_app>.md    ← your app's docs go here
```

The Python and simulator trees mirror each other. Every `python/apps/foo.py` ideally has a `web-toolkit/src/lib/simulator/apps/foo.ts` sibling, with both registered in their respective launcher (`python/main.py` and `web-toolkit/src/lib/simulator/launcher.ts`). Apps that only exist on one side are an in-progress state — not a permanent split.

Two things to keep in mind:

- On the Pico, `/apps` is on `sys.path` via the launcher's `sys.path.append("/apps")` at the top of `python/main.py`. That's why your app can `import _screens` directly without a package prefix.
- The leading underscore on `_screens.py` and `_fonts.py` is a convention: it marks these as **internal shared modules**, visually separating them from the actual apps in the same folder. They behave like any other Python module. Most apps alias on import (`import _screens as screens`) so the in-code calls stay readable.

### Files to copy to the Pico

After editing in this repo, the deploy is:

| Source | Pico path |
|---|---|
| `python/main.py` | `/main.py` |
| `python/apps/_fonts.py` | `/apps/_fonts.py` |
| `python/apps/_screens.py` | `/apps/_screens.py` |
| `python/apps/<each_app>.py` | `/apps/<each_app>.py` |
| `shared/fonts.json` | `/fonts.json` |
| `shared/design/boot-animation.json` | `/boot-animation.json` |

The two JSONs are optional — the launcher falls back gracefully if they're missing (digit-only fallback font, blank 300 ms boot pause). But you want both for a proper experience.

---

## The shared modules

### `python/apps/_screens.py`

The single source of truth for entry, exit, and end-of-session UI. Every app imports it.

| Symbol | What it does |
|---|---|
| `init(neopixel, joystick, w=None, h=None)` | Bind hardware refs and dimensions. **Call once at the top of `run()`.** Required before any other screens function. `w` / `h` default to 8 when omitted. |
| `loading_screen()` | Responsive clockwise ring spinner — waits for press. Returns `"start"` or `"exit"`. |
| `game_over_screen(score)` | Scrolling red/orange checker banner + score (static if it fits, marquee if it doesn't). Returns `"restart"` or `"exit"`. |
| `end_screen()` | Scrolling blue/green checker banner + filled amber arrow. Returns `"restart"` or `"exit"`. |
| `show_digit_briefly(digit, color, hold_ms)` | Render a number centred on the full display, hold for `hold_ms`. Returns `"exit"` (if user bailed) or `None`. Useful for level / lives indicators during gameplay. |
| `check_exit()` | Non-blocking hold-center detector. Returns `True` once when the user has held center for 1.5 s. **Poll this every frame inside your game loop.** |
| `any_input()` | True if any of up/down/left/right is currently held. Excludes center. Use for inactivity tracking in passive apps. |

All screens are W×H responsive — they read the dimensions you passed to `init` and lay themselves out accordingly. You don't write any responsive code for screens; pass the dims through.

### `python/apps/_fonts.py`

| Symbol | What it is |
|---|---|
| `FONT_3X5` | Dict `{char: [5 rows]}`. Uppercase A–Z, digits, basic punctuation. Used by `_screens.py` for scores on small displays, by the launcher marquee at h ≤ 8. |
| `FONT_5X8` | Dict `{char: [8 rows]}`. Adds lowercase a–z and more punctuation. Used at 8 < h ≤ 16. |
| `FONT_7X9` | Proportional pixel font (glyph data is 12 rows tall). Used at h > 16. |
| `KERNING_GAP` | Pixels inserted between glyphs by renderers. Default 1. |
| `glyph(font, ch)` | Look up a glyph with fallback chain: exact → uppercase → `' '`. Returns `None` if even `' '` is missing. |

All three fonts are loaded from `/fonts.json` at module import. If that file is missing, `FONT_3X5` falls back to a digit-only embedded subset and the others become empty — enough for `screens.game_over_screen` to keep working but not enough for the launcher marquee to show app names.

---

## Coordinate system

Two coordinate systems exist and you need both, but most apps live in just one.

| System | Origin | Y-axis | Used for |
|---|---|---|---|
| **LED coords** | `(col=0, row=0)` = bottom-left | row increases upward (row 0 = bottom strip, row 7 = top on 8×8) | Indexing `np[]` directly: `np[row * W + col]` |
| **Visual coords** | `(x=0, y=0)` = top-left | y increases downward (y=0 = top, y=H-1 = bottom) | The design tool, the `_screens.py` rendering, anything you draw "by eye". |

Conversion: `led_row = (H - 1) - visual_y`.

LED chain index: `index = row * W + col`. So index 0 is bottom-left, index `W*H - 1` is top-right.

For **classic 8×8 apps**: W = H = 8 always. Use `row * 8 + col`. Most apps in this repo work in LED coords because that's what the hardware sees directly.

For **responsive apps**: bind `W` and `H` from `display` inside `run()` and use them everywhere. `np` is sized `W*H`; `row * W + col` is the index.

A common pattern in classic 8×8 apps:

```python
NUM_LEDS = 64

def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)

def px(col, row, color):
    """LED coords: col 0 left, row 0 bottom."""
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color
```

The visual-coords version:

```python
def px_visual(x, y, color):
    """Visual coords: (0, 0) top-left."""
    if 0 <= x <= 7 and 0 <= y <= 7:
        np[(7 - y) * 8 + x] = color
```

Pick one per app and stick with it — the helper functions you write will be cleaner.

---

## Using Pixel Designer designs

The **[Pixel Designer](https://lumen.fabs.au/designer/)** (locally: `cd web-toolkit && npm run dev`, then [http://localhost:3000/designer](http://localhost:3000/designer)) is the browser tool used to design the launcher boot animation, game-over backgrounds, and end-screen arrow in this repo. It exports JSON files where each page is one screen/frame and only the lit pixels are listed. Cells you didn't paint are off.

A typical export looks like this:

```json
{
  "version": 4,
  "colorMode": "rgb",
  "hardware": {
    "8x8":   { "presetId": "8x8",   "width": 8,  "height": 8  },
    "16x16": { "presetId": "16x16", "width": 16, "height": 16 },
    "32x32": { "presetId": "32x32", "width": 32, "height": 32 }
  },
  "pages": [
    {
      "label": "Page 1",
      "variants": {
        "8x8": [
          { "index": 56, "x": 0, "y": 0, "color": "#ff0000" },
          { "index": 58, "x": 2, "y": 0, "color": "#ff0000" }
        ],
        "16x16": [ ... ],
        "32x32": [ ... ]
      }
    }
  ]
}
```

Each pixel object carries:

| Field | What it is |
|---|---|
| `index` | LED chain position for that variant's display size. **Use this directly** as `np[index] = (r, g, b)`. |
| `x`, `y` | Visual coordinates (`x` = col left→right, `y` = row top→bottom). Redundant with `index` but handy for math. |
| `color` | CSS hex string `"#RRGGBB"`. Full 8-bit per channel — needs dimming for the matrix. |

### Two ways to embed a design

**Option A — embed pages directly in your app.** Best for small, fixed designs (a logo, a few frames). Self-contained, no filesystem dependency.

```python
# Each page = {led_index: "#hex"} for the lit pixels only.
PAGES_HEX = (
    {  # Page 1
        56: "#ff0000", 58: "#ff0000", 60: "#ff0000", 62: "#ff0000",
        49: "#ff0000", 51: "#ff0000", 53: "#ff0000", 55: "#ff0000",
    },
    {  # Page 2
        # ...
    },
)
```

Copy-paste the JSON's `pixels` arrays and collapse each one into the `{index: hex}` form. It's compact and lives next to the code that uses it.

**Option B — keep the JSON file on the Pico and load it at runtime.** Best for larger or multi-variant designs (e.g. one design with 8×8 / 16×16 / 32×32 variants).

```python
import json

def load_variant(path, key):
    """Load the pages of one display variant. Returns a list of {index: hex}."""
    with open(path) as f:
        data = json.load(f)
    pages = []
    for page in data["pages"]:
        pixels = page.get("variants", {}).get(key, [])
        pages.append({p["index"]: p["color"] for p in pixels})
    return pages

PAGES_HEX = load_variant("/designs/my_design.json", "8x8")
```

Drop the JSON file alongside `main.py` on the Pico (e.g. `/designs/my_design.json`) and load it once at app startup.

### Rendering a page

The matrix is uncomfortably bright at full intensity, so always dim. ~25% (`BRIGHTNESS = 0.25`) is the project convention — it maps the hex source range `0..255` to a more reasonable `0..64`.

```python
BRIGHTNESS = 0.25


def hex_to_rgb(h, scale=BRIGHTNESS):
    h = h.lstrip("#")
    return (int(int(h[0:2], 16) * scale),
            int(int(h[2:4], 16) * scale),
            int(int(h[4:6], 16) * scale))


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def render_page(page):
    """page = {led_index: '#hex'}"""
    clear()
    for idx, hex_color in page.items():
        np[idx] = hex_to_rgb(hex_color)
    np.write()
```

For an animation, loop through `PAGES_HEX` with timing:

```python
for page in PAGES_HEX:
    render_page(page)
    sleep_ms(1500)
```

### Fading between pages

A common pattern: hold each page for a few seconds, then crossfade into the next. Linearly interpolate per-LED RGB from page A → page B:

```python
def render_fade(page_a, page_b, t):
    """t in [0, 1]: 0 = full page_a, 1 = full page_b."""
    indices = set()
    indices.update(page_a.keys())
    indices.update(page_b.keys())
    clear()
    for idx in indices:
        a = hex_to_rgb(page_a.get(idx, "#000000"))
        b = hex_to_rgb(page_b.get(idx, "#000000"))
        r = int(a[0] + (b[0] - a[0]) * t)
        g = int(a[1] + (b[1] - a[1]) * t)
        bb = int(a[2] + (b[2] - a[2]) * t)
        np[idx] = (r, g, bb)
    np.write()
```

LEDs that appear in only one page fade naturally to or from black.

### Tips and pitfalls

- **Always dim.** The JSON colors are full-intensity; pushing those straight to the strip is painful at close range. Stick with `BRIGHTNESS ≈ 0.20–0.30` unless you have a specific reason.
- **Use `index`, not `(x, y)`.** Both fields are exported, but `index` is the LED chain position you can write to `np[]` directly. The `(x, y)` coords are convenient for understanding the design but require a `(H-1) - y` conversion to get the LED row.
- **Pick the right variant.** Pixel Designer designs carry one variant per canonical display size. If your app is classic (8×8), use the `"8x8"` variant. Responsive apps that want to look good at multiple sizes can switch variant by display.
- **For animation, prefer Option A (embedded).** Iterating designs you have to re-flash the JSON is slower than re-flashing one `.py` file.

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

> **Branching note:** if the user picked the simulator-first workflow ([Where to start](#where-to-start-simulator-first)), do [Authoring in the web simulator](#authoring-in-the-web-simulator) first, get the app feature-complete and signed off in the browser, then come back here for the port to Python. The two paths converge at step 6 (registering in the launcher).

### 1. Create `python/apps/<name>.py`

Names use lowercase, no separators (matches the existing files). The `import` name in `python/main.py` will be the same:

```bash
touch python/apps/coolgame.py
```

### 2. Standard header

Every classic 8×8 app starts the same way:

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

For a **responsive app**, also declare:

```python
RESPONSIVE = True

W = 8
H = 8
```

The launcher reads `RESPONSIVE` once at boot; the `W`/`H` globals get bound inside `run()` from `display["width"]` / `display["height"]`.

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
def run(neopixel, joystick, display=None, screens_np=None):
    global np, JOY_UP        # whichever module globals you used
    np = neopixel
    JOY_UP = joystick["up"]
    screens.init(screens_np if screens_np is not None else neopixel, joystick,
                 display["width"] if display else None,
                 display["height"] if display else None)
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

Calling `run()` with only the first two args means `display` and `screens_np` default to `None`, and `screens.init` falls back to 8×8 — fine for dev on the actual kit. Hold-center 1.5 s exits the script back to the Thonny REPL during dev. That's deliberate.

### 6. Register in the launcher

Edit `python/main.py`. There are two spots:

```python
# ... existing imports ...
import coolgame                              # ← add this

# ...

APPS = [
    reaction,
    connect4,
    pong,
    breakout,
    simonsays,
    dinojump,
    snake,
    flappy,
    invaders,
    doom,
    watch,
    coolgame,                                # ← add here
]
```

The position in `APPS` determines the app's slot in the launcher's bottom track (and which number the user sees). The simulator's `APPS` order in `web-toolkit/src/lib/simulator/launcher.ts` is the canonical order — keep both lists in sync. Adding to the end is the safe default.

### 7. Write your docs

Create `docs/apps/<name>.md`. See [Per-app documentation](#per-app-documentation) below for the required sections.

### 8. Deploy

Copy `<name>.py` to `/apps/` on the Pico's filesystem, alongside the others. The launcher picks it up on next boot.

---

## Scoring methodology

Scoring isn't free: it has to work with the screens, and it has to make the player feel something. Two anchor points define a good scoring curve:

- **~10 points should be reachable in any session.** Even a casual or unlucky run should land here. This is the "you played" baseline. Below ~10 feels punishing.
- **99 points is the soft ceiling.** Scores that fit the display width get the static layout; anything taller marquees horizontally. The static display reads better and is the canonical look — keep your scoring inside it.

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

## Responsive scaling

(How the app behaves on non-8×8 displays. Pixel-matching upscale, UI upscaling, or drawing upscaling — see `docs/responsive-scaling.md` for the categories.)

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
- ✅ **Always call `screens.init(...)` once at the start of `run()`** before any other screens function. Pass through `screens_np` and `display` from `run`'s args.
- ✅ **Poll `screens.check_exit()` every frame** inside your game loop. Without it, the user can't bail mid-game.
- ✅ **Return `None` from your `play_one_round()` when exit is triggered**, so the outer `run()` can clean up.
- ✅ **Use the shared `screens` and `fonts` modules** for anything that touches lifecycle UI or text. Don't roll your own.
- ✅ **Match the existing visual conventions** — moderate brightness (rgb values ~30–60 of 255), per-game accent colors, dim background hues. Full `#ffffff` (255 white) at close range is painful.
- ✅ **Test in standalone mode** (`Run` in Thonny) before integrating into the launcher. Standalone gives you a clean Ctrl-C escape if something hangs.
- ✅ **Write your `docs/apps/<name>.md`** before considering the app done. If you can't describe the scoring in plain English, it probably needs another pass.
- ✅ **Add your app to `APPS = [...]` in `python/main.py`** to make the launcher see it — and update the simulator's `APPS` list to match.

### Don't

- ❌ **Don't construct `NeoPixel(...)` or `Pin(...)` at module top level.** Importing your app would allocate hardware the launcher already owns.
- ❌ **Don't put `while True: run(_np, _joy)` in your `__main__` block.** Use a single `run(_np, _joy)`. Hold-center then returns to REPL during dev (which is what you want in Thonny). The internal restart loop inside `run()` already handles "user wants to play again".
- ❌ **Don't reimplement game-over UI inside your app.** No private flash sequences, no private score marquees. Use `screens.game_over_screen(score)`.
- ❌ **Don't read `sys.stdin` from a game loop unless you handle Ctrl-C explicitly.** The serial byte 0x03 gets eaten by `sys.stdin.read(1)` instead of triggering `KeyboardInterrupt`, which means Thonny can't break you out. See `python/apps/letters.py` for how to handle this.
- ❌ **Don't block in `sleep_ms()` for longer than ~50 ms at a time** if you're between input checks. The user expects sub-100 ms response to direction presses; a single `sleep_ms(500)` makes the joystick feel laggy.
- ❌ **Don't run unbounded `while True:` loops without `sleep_ms()`.** Even if you have nothing to do, sleep at least 10 ms per iteration so Ctrl-C and `check_exit()` get a chance to fire.
- ❌ **Don't hardcode the fonts.** Import from `_fonts.py`. There is one font module for the whole project.
- ❌ **Don't design a scoring system that routinely produces 100+ scores.** It's not wrong, but it forces the marquee path on every game and wastes the static design's expressive range. Re-read [Scoring methodology](#scoring-methodology).
- ❌ **Don't skip the loading screen.** Even for an app where it feels redundant, that spinner is the user's "did I just launch the right thing?" confirmation. Always start with `screens.loading_screen()`.

---

## Authoring in the web simulator

The web simulator under `web-toolkit/` is a TypeScript reimplementation of the launcher and shared modules, designed so that an app written against the simulator's API ports to MicroPython with mostly mechanical edits.

### Dev loop

```bash
cd web-toolkit
npm install          # one-time
npm run dev          # Next.js dev server on http://localhost:3000
```

Open [http://localhost:3000/simulator](http://localhost:3000/simulator). You'll see a virtual LED matrix and a virtual joystick + slide switch. Keyboard works too: arrow keys = D-pad, space = center, S = slide. The display size is configurable in-page so you can preview your app at 8×8, 16×16, 32×32, etc.

The dev server hot-reloads on save.

### What's mirrored from MicroPython

| Python | TypeScript | Notes |
|---|---|---|
| `from time import sleep_ms, ticks_ms, ticks_diff` | `import { sleep_ms, ticks_ms, ticks_diff } from "../runtime/time"` | Same semantics. |
| `sleep_ms(50)` blocks the thread | `await sleep_ms(50)` suspends the async function | The only invasive runtime difference — see [Porting](#porting-from-typescript-to-micropython). |
| `import _screens as screens` | `import * as screens from "../screens"` | Same surface: `init`, `loading_screen`, `game_over_screen`, `end_screen`, `check_exit`, `any_input`, `show_digit_briefly`. |
| `screens.loading_screen()` returns `"start"` or `"exit"` | `await screens.loading_screen()` returns the same | All blocking screens are `async` in TS. |
| `screens.check_exit()` sync, returns bool | `screens.check_exit()` sync, returns bool | Identical. |
| `np[i] = (r, g, b)` tuple | `np[i] = [r, g, b]` array (typed as `RGB`) | TS uses arrays; treat the bytes the same way. |
| `joystick["up"].value()` | `joystick.up.value()` | TS uses property access (object, not dict). |
| `pin.value() == 0` means pressed | `pin.value() === 0` means pressed | Same active-low convention. |
| `FONT_3X5["A"]` from `_fonts` | `FONT_3X5["A"]` from `./fonts` | Identical glyph data, loaded from the same `shared/fonts.json`. |

### Standard shape of a TS app

```ts
import type { NeoPixel, RGB, Joystick, DisplayDims } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "MyGame";
// Omit RESPONSIVE (or set it false) for classic 8×8 apps.

const NUM_LEDS = 64;
const FRAME_MS = 50;

function clear(np: NeoPixel): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(np: NeoPixel, col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

type RoundResult = { kind: "score"; score: number } | { kind: "exit" };

async function playOneRound(np: NeoPixel, joy: Joystick): Promise<RoundResult> {
  let score = 0;
  while (true) {
    if (screens.check_exit()) return { kind: "exit" };
    // ... game logic, updating `score` ...
    // if (dead) return { kind: "score", score };
    clear(np);
    // ... render frame ...
    np.write();
    await sleep_ms(FRAME_MS);
  }
}

export async function run(
  neopixel: NeoPixel,
  joystick: Joystick,
  display?: DisplayDims,
  screensNp?: NeoPixel,
): Promise<void> {
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const result = await playOneRound(neopixel, joystick);
    if (result.kind === "exit") return;
    if ((await screens.game_over_screen(result.score)) === "exit") return;
  }
}
```

Notes:

- `NAME` and `run` are the same contract as Python. The launcher (TS or PY) only cares about those two symbols.
- The `RoundResult` discriminated union is the TS-friendly form of "return `None` for exit, score otherwise". It compiles away — at runtime it's just `{ kind: "exit" }` or `{ kind: "score", score: 42 }`.
- `screens.init(screensNp ?? neopixel, ...)` is the same pattern as Python — pass the launcher's W×H buffer if it gave you one, otherwise fall back to the gameplay buffer.

### Registering in the simulator launcher

Edit `web-toolkit/src/lib/simulator/launcher.ts`. There are two spots, just like in `python/main.py`:

```ts
// ... existing imports ...
import * as mygame from "./apps/mygame";              // ← add this

// ...

const APPS: readonly App[] = [reaction, connect4, /* ... */ mygame];
//                                                          ↑ add here
```

The order in `APPS` defines the launcher slot index — keep it in sync with `python/main.py`.

### Per-app docs

Per-app documentation lives in `docs/apps/<name>.md` regardless of which platform you targeted first. Write it once when the app is feature-complete on whichever side, then keep it accurate as you port.

---

## Porting from TypeScript to MicroPython

Once the user has tested the simulator version and is happy, port it. The translation is mostly mechanical. Work top-to-bottom through the file.

### Translation table

| TypeScript | MicroPython | Notes |
|---|---|---|
| `import * as screens from "../screens";` | `import _screens as screens` | |
| `import { sleep_ms, ticks_ms, ticks_diff } from "../runtime/time";` | `from time import sleep_ms, ticks_ms, ticks_diff` | |
| `import type { NeoPixel, RGB, ... } from "../types";` | Delete. MicroPython has no static types. | |
| `export const NAME = "MyGame";` | `NAME = "MyGame"` | |
| `export const RESPONSIVE = true;` | `RESPONSIVE = True` | Only if your app is responsive. |
| `export async function run(np, joy, display?, screensNp?) { ... }` | `def run(np, joy, display=None, screens_np=None):` | Drop `async`, `export`, type annotations; rename `screensNp` → `screens_np`. |
| `await sleep_ms(50);` | `sleep_ms(50)` | Drop `await` everywhere. |
| `await screens.loading_screen()` | `screens.loading_screen()` | |
| `await screens.game_over_screen(score)` | `screens.game_over_screen(score)` | |
| `screens.init(screensNp ?? np, joy, display?.width, display?.height);` | `screens.init(screens_np if screens_np is not None else np, joy, display["width"] if display else None, display["height"] if display else None)` | Verbose but uniform — copy from a template. |
| `np[i] = [r, g, b];` | `np[i] = (r, g, b)` | Arrays → tuples. |
| `joy.up.value() === 0` | `joystick["up"].value() == 0` | Property → dict key. |
| `function play_one_round(np, joy) { ... }` | `def play_one_round():` and use module globals | Python apps in this repo stash `np` / joy pins in module globals bound during `run()`. |
| `{ kind: "exit" } / { kind: "score", score }` discriminated union | `return None` for exit, `return score` for score | Then check `if score is None:` in `run()`. |
| `const FOO: readonly RGB[] = [[0, 25, 60]]` | `FOO = ((0, 25, 60),)` | Tuples of tuples; drop annotations. |
| `Math.floor(x)` | `int(x)` (truncates toward 0; for negatives use `math.floor`) | |
| `Math.random()` | `random.random()` (import `random`) | |
| `Array.from({ length: n }, () => 0)` | `[0] * n` | |
| `for (const x of xs) { ... }` | `for x in xs:` | |
| `for (let i = 0; i < n; i++) { ... }` | `for i in range(n):` | |
| `xs.push(v)` | `xs.append(v)` | |
| `xs.length` | `len(xs)` | |
| `Object.keys/values/entries` | `.keys() / .values() / .items()` | |
| `// comment` | `# comment` | |
| `xs.slice(0, k)` | `xs[:k]` | |

### Things that don't translate one-to-one

- **Module-level hardware bindings.** TS apps can take `np` and `joy` as `run()` arguments and pass them around. Python apps in this repo use module-level `np = None` / `JOY_UP = None` set inside `run()` because reusing them across many small helpers is cleaner. Pick one when you port — usually the Python-globals pattern, since that's the house style and the templates in this guide assume it.
- **Async control flow.** TS uses `await` for every blocking call. Python is plain blocking. If your TS app uses `Promise.all`, `Promise.race`, or any concurrency primitive, you need to redesign for MicroPython's single-threaded blocking model. Most apps don't do this — they just `await sleep_ms(...)` linearly — and translate trivially.
- **TypeScript-only features.** Generics, discriminated unions, `readonly`, type assertions — all evaporate. Convert each pattern to its loose-Python equivalent. Functions still take the same args, just with no types.
- **Standalone `__main__` block.** TS apps don't have one (the simulator builds the whole launcher into a single bundle). When porting, add the standard `if __name__ == "__main__":` block from the Python template so the app is also runnable directly in Thonny.

### Port checklist

After translating the file:

1. Does it import cleanly when the launcher does `import <name>` (i.e. no syntax errors, no top-level hardware allocation)?
2. Does `Run` in Thonny work on the file alone?
3. Does it appear in the launcher when added to `APPS = [...]` in `python/main.py`?
4. Does the behavior match the web simulator? Compare side-by-side on a long playthrough — animations, scoring, exit behavior.
5. Is the docstring/comment style still consistent with the Python house style?
6. Did you remove all `await` and `async` keywords? (`grep -E 'await|async' python/apps/<name>.py` should be empty.)

If anything diverges between sim and hardware, the sim is usually right — it's deterministic and easier to debug. Fix the Python; if it's a sim modeling gap, document it in `docs/apps/<name>.md`.

---

## Templates

### Game app (Python, classic 8×8)

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


def run(neopixel, joystick, display=None, screens_np=None):
    global np
    np = neopixel
    # bind your joystick pins:
    # global JOY_UP
    # JOY_UP = joystick["up"]
    screens.init(screens_np if screens_np is not None else neopixel, joystick,
                 display["width"] if display else None,
                 display["height"] if display else None)
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

### Game app (TypeScript, web simulator)

```ts
import type { NeoPixel, RGB, Joystick, DisplayDims } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "MyGame";

const NUM_LEDS = 64;
const FRAME_MS = 50;

function clear(np: NeoPixel): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(np: NeoPixel, col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

type RoundResult = { kind: "exit" } | { kind: "score"; score: number };

async function playOneRound(np: NeoPixel, joy: Joystick): Promise<RoundResult> {
  let score = 0;
  while (true) {
    if (screens.check_exit()) return { kind: "exit" };
    // ... game logic, updating `score` ...
    // if (dead) return { kind: "score", score };
    clear(np);
    // ... render frame ...
    np.write();
    await sleep_ms(FRAME_MS);
  }
}

export async function run(
  neopixel: NeoPixel,
  joystick: Joystick,
  display?: DisplayDims,
  screensNp?: NeoPixel,
): Promise<void> {
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const result = await playOneRound(neopixel, joystick);
    if (result.kind === "exit") return;
    if ((await screens.game_over_screen(result.score)) === "exit") return;
  }
}
```

After this is feature-complete and the user has signed off in the browser, port it to `python/apps/<name>.py` using the [translation table](#translation-table).

### Passive app (Python, no score, ends on inactivity)

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


def run(neopixel, joystick, display=None, screens_np=None):
    global np
    np = neopixel
    screens.init(screens_np if screens_np is not None else neopixel, joystick,
                 display["width"] if display else None,
                 display["height"] if display else None)
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

**`sys.stdin.read(1)` swallows Ctrl-C.** MicroPython normally raises `KeyboardInterrupt` on byte 0x03, but if your code is actively reading from stdin (like the letters app does for serial input), you have to check for 0x03 yourself and return cleanly. `python/apps/letters.py` is the reference implementation:

```python
ch = sys.stdin.read(1)
if ch in ("\x03", "\x04"):   # Ctrl-C, Ctrl-D
    return
```

**Game over screen shows nothing.** Almost always means you returned the wrong type from `play_one_round()`. `screens.game_over_screen(score)` calls `str(int(score))` — if you returned `None` (because exit was triggered) and forgot to check before calling, you'll get a crash. Always handle the `None` case explicitly in `run()`.

**Standalone runs the app twice.** Caused by `while True: run(_np, _joy)` in `__main__`. The internal restart loop inside `run()` already handles "user wants to play again". The outer `while True:` only kicks in when the user holds center to exit, which immediately re-enters loading — feels broken. Use a single `run(_np, _joy)`.

**Launcher shows blank app names.** The fallback in `_fonts.py` only covers digits 0–9 — if `/fonts.json` is missing on the Pico, scores render but app names render as empty space. Always deploy `shared/fonts.json` to `/fonts.json` on the Pico.

---

## Hardware reference

For when you need it. From the LUMATRIX cheat sheet:

| Component | GPIO | Notes |
|---|---|---|
| NeoPixel data | 19 | 64 LEDs on the stock 8×8 board, ws2812-compatible |
| Joystick up | 3 | active-low |
| Joystick down | 6 | active-low |
| Joystick left | 7 | active-low |
| Joystick right | 2 | active-low |
| Joystick center (click) | 8 | active-low |
| Slide switch | 9 | toggle, 0 or 1 |

The launcher constructs all of these in `python/main.py` and passes them as a dict to your `run()`. Don't repeat the constructors in your app file — let the launcher own them.

If you're using a larger display, set `DISPLAY_WIDTH` and `DISPLAY_HEIGHT` at the top of `python/main.py` (and `LED_PIN` if you've rewired). The launcher and screens become responsive automatically; classic apps still get an 8×8 buffer and the launcher upscales their output onto the larger panel.

---

## When to ask for review

Before merging a new app:

1. Does it run standalone (`Run` in Thonny)?
2. Does it run from the launcher?
3. Hold center 1.5 s mid-play — does it return to the launcher?
4. Hit a game-over — does the score show? Does tap-to-restart work?
5. Is there a doc at `docs/apps/<name>.md`?
6. Are typical scores in the 10–60 range, with skilled scores ≤ 99 most of the time?
7. **(If you started in the web simulator)** Does the Python version behave the same as the TS version side-by-side? Same animations, same scoring, same exit semantics?

If all answers are "yes", you're done.
