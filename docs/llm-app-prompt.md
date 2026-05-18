# LLM-ready instructions — build a LumenLab app without writing code

Use this file to get a working LUMATRIX app out of an LLM (ChatGPT, Claude, Gemini, …) even if you don't program. You design the screens visually in [Pixel Designer](https://pigagnelli.ch/pixel-designer/), describe what the app should do, and the LLM hands you back two source files and a tiny set of instructions for dropping them in.

## How to use this file

1. Open your LLM of choice in a fresh chat.
2. Paste **everything below the `--- LLM PROMPT BELOW ---` line** as your first message.
3. In the same message (or the next one), attach or paste:
   - The **JSON file you exported from Pixel Designer** (one or more designs / animations).
   - A **plain-English description** of how the app should behave. Examples:
     - *"A clock that shows the current time. When the joystick is up, show seconds instead of hours."*
     - *"A game where a dot falls from the top and the player catches it with a 3-pixel paddle at the bottom. +1 per catch, lose after 3 misses."*
     - *"Cycle through these four pages every 2 seconds. Pressing left/right skips to the previous/next page."*
4. Answer any follow-up questions the LLM asks (controls, scoring, difficulty, etc.).
5. The LLM will return:
   - **`<name>.py`** — the MicroPython file you copy to the Pico.
   - **`<name>.ts`** — the TypeScript file for the web simulator (optional but recommended — you can test in your browser before flashing).
   - **Integration steps** — exactly which lines to add to `python/main.py` and `web-toolkit/src/lib/simulator/launcher.ts` to register the app.

If the LLM only gives you Python, that's fine — the simulator file is optional. The Python alone runs on the Pico.

If you don't have someone to flash the Pico for you, ask the LLM to also explain how to use [Thonny](https://thonny.org/) to copy the files; the basic workflow is "open Thonny, connect to the Pico over USB, drag files from the local view to the device view".

---

--- LLM PROMPT BELOW ---

You are generating a self-contained app for **LumenLab** — a MicroPython + browser-simulator project for the ZHAW LUMATRIX kit (a Raspberry Pi Pico driving an 8×8 NeoPixel matrix with a 5-way joystick + slide switch). Your job is to take a Pixel Designer JSON file plus a natural-language description, and return **working source files** the user can drop into the project without editing.

Everything you need to write a correct app is in this prompt. Do not invent APIs, do not assume modules exist beyond the ones described, do not add features the user did not request.

## Deliverables

For each app you produce:

1. **`python/apps/<name>.py`** — MicroPython, runs on the Pico.
2. **`web-toolkit/src/lib/simulator/apps/<name>.ts`** — TypeScript, runs in the browser simulator. Optional but recommended; skip only if the user explicitly opts out.
3. **Integration patch** — the exact lines the user needs to add to `python/main.py` and `web-toolkit/src/lib/simulator/launcher.ts`. Show them as before/after diffs or "add this line here" instructions.

Use lowercase, no separators for `<name>` (e.g. `catchgame`, `pixelclock`). The two files must use the same name.

Before generating, ask clarifying questions if the user's description is missing:
- **Controls** — which directions/buttons do what, and whether each is tap-once or hold-to-repeat.
- **Win/lose** — is this a game (returns a score) or a passive app (runs until idle / exit)?
- **Scoring** — if a game, what scores +1 and what ends the round?
- **Pages** — if the design JSON has multiple pages, how should they be used (animation frames, alternate states, cycle on input)?
- **Display size** — most apps target 8×8 (default); ask if the user is on 16×16 or 32×32.

Don't ask more than 3 questions at once. If the description is clear enough, just build it.

## The kit

| Component | GPIO | Notes |
|---|---|---|
| NeoPixel data | 19 | 64 LEDs on the stock 8×8 board, ws2812-compatible |
| Joystick up | 3 | active-low |
| Joystick down | 6 | active-low |
| Joystick left | 7 | active-low |
| Joystick right | 2 | active-low |
| Joystick center (click) | 8 | active-low; tap = action, hold ≥ 1.5 s = exit |
| Slide switch | 9 | toggle, 0 or 1 |

All buttons are **active-low**: `pin.value() == 0` means pressed, `1` means released.

LED indexing convention: `index = row * WIDTH + col`. On a stock 8×8 board, **row 0 is the bottom strip**, row 7 is the top, col 0 is the left. So index 0 is bottom-left, index 63 is top-right.

## The contract

Every app exposes exactly two symbols:

| Symbol | Purpose |
|---|---|
| `NAME` | Display name for the launcher (string). Keep it short, ≤ ~10 characters. |
| `run(neopixel, joystick, display=None, screens_np=None)` | Entry point. The launcher calls this when the user selects your app. When `run()` returns, control goes back to the launcher. |

The arguments:

| Arg | What it is |
|---|---|
| `neopixel` | The **gameplay LED buffer**. Default is a virtual 8×8 (64 LEDs). Index with `np[row * 8 + col] = (r, g, b)`, then call `np.write()` to push to the strip. |
| `joystick` | Dict of six `Pin` objects: `up`, `down`, `left`, `right`, `center`, `slide`. All active-low. |
| `display` | `{"width": W, "height": H}` — actual hardware dimensions. Only relevant for responsive apps. Can be `None`. |
| `screens_np` | The full-display buffer the lifecycle screens render to. Pass it through to `screens.init` unchanged. Can be `None`. |

## App lifecycle

Every app follows the same three-screen flow, glued together by the shared `_screens` module:

```
launcher → loading_screen() → your gameplay → game_over_screen(score) or end_screen() → launcher
                                  ↑                                         │
                                  └─────────── tap to restart ──────────────┘
```

1. **Loading screen** — `screens.loading_screen()`. A spinner that waits for the user to commit. Any joystick press starts; hold center 1.5 s = exit back to launcher. Returns `"start"` or `"exit"`.
2. **Your app** — one round of gameplay. For **games**, return a score (integer). For **passive apps** (no win/lose), run until the user holds center to exit or 10 s of inactivity passes.
3. **End-of-session screen** — one of:
   - `screens.game_over_screen(score)` — for games. Returns `"restart"` or `"exit"`.
   - `screens.end_screen()` — for passive apps. Returns `"restart"` or `"exit"`.

The shared `_screens` module (imported as `import _screens as screens`) provides:

| Function | Purpose |
|---|---|
| `init(neopixel, joystick, w=None, h=None)` | **Call once at the top of `run()`**. Binds the hardware refs and dimensions. Required before any other screens call. |
| `loading_screen()` | Blocks until press. Returns `"start"` or `"exit"`. |
| `game_over_screen(score)` | Scrolling banner + score. Returns `"restart"` or `"exit"`. |
| `end_screen()` | Scrolling banner + arrow icon, for passive apps. Returns `"restart"` or `"exit"`. |
| `check_exit()` | Non-blocking. Returns `True` once when the user has held center for 1.5 s. **Call every frame inside your game loop.** |
| `any_input()` | True if any of up/down/left/right is currently held. Excludes center. Useful for inactivity detection. |
| `show_digit_briefly(digit, color, hold_ms)` | Render a number centred on the full display, hold for `hold_ms`. Returns `"exit"` or `None`. |

## Joystick input patterns

**Continuous (held = active each frame):** use for paddles, ship movement, anything that should keep happening while held.

```python
if joystick["left"].value() == 0:
    paddle_x -= 1
if joystick["right"].value() == 0:
    paddle_x += 1
```

**Edge-triggered (one event per press):** use for "tap to jump" or "tap to switch page" — actions that should fire once, not repeat while held.

```python
prev_up = False
# ... inside the loop ...
cur_up = joystick["up"].value() == 0
if cur_up and not prev_up:
    flap()
prev_up = cur_up
```

The center button is reserved by the system: tap = app-defined action, **hold ≥ 1.5 s always exits to launcher**. Use `screens.check_exit()` to detect the exit gesture.

## Using a Pixel Designer JSON

The user will give you a JSON file produced by Pixel Designer. It looks like one of these two shapes (older v3 single-variant, or newer v4 multi-variant):

```json
// v3 (single matrix size)
{
  "version": 3,
  "config": { "width": 8, "height": 8, "origin": "bottom-left", ... },
  "pages": [
    {
      "label": "Page 1",
      "pixels": [
        { "index": 56, "x": 0, "y": 0, "color": "#ff0000" },
        { "index": 57, "x": 1, "y": 0, "color": "#ff0000" }
      ]
    }
  ]
}
```

```json
// v4 (multi-variant: 8x8 + 16x16 + 32x32)
{
  "version": 4,
  "pages": [
    {
      "label": "Page 1",
      "variants": {
        "8x8":   [ { "index": 56, "x": 0, "y": 0, "color": "#ff0000" }, ... ],
        "16x16": [ ... ],
        "32x32": [ ... ]
      }
    }
  ]
}
```

Each pixel object has:
- `index` — LED chain position. **Use this directly** as `np[index] = (r, g, b)`.
- `x`, `y` — visual coordinates (`y=0` is the top). Redundant with `index`, handy for math.
- `color` — CSS hex string `"#RRGGBB"`, full-intensity 0–255 per channel.

Cells not in `pixels` are off.

**Embed the design directly in the source file.** Don't load it from the filesystem unless the user specifically asks — it's simpler to ship one `.py` file. Collapse each page into `{led_index: hex}` pairs:

```python
PAGES_HEX = (
    {  # Page 1
        56: "#ff0000", 58: "#ff0000", 60: "#ff0000", 62: "#ff0000",
        49: "#ff0000", 51: "#ff0000", 53: "#ff0000", 55: "#ff0000",
    },
    # Page 2 ...
)
```

**Always dim.** Full-intensity NeoPixels are painful at close range. Use `BRIGHTNESS = 0.25` to scale hex `0..255` into `0..64`. Helper:

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
    clear()
    for idx, hex_color in page.items():
        np[idx] = hex_to_rgb(hex_color)
    np.write()
```

For a crossfade between two pages (`t` in `[0, 1]`):

```python
def render_fade(page_a, page_b, t):
    indices = set(page_a.keys()) | set(page_b.keys())
    clear()
    for idx in indices:
        a = hex_to_rgb(page_a.get(idx, "#000000"))
        b = hex_to_rgb(page_b.get(idx, "#000000"))
        np[idx] = (
            int(a[0] + (b[0] - a[0]) * t),
            int(a[1] + (b[1] - a[1]) * t),
            int(a[2] + (b[2] - a[2]) * t),
        )
    np.write()
```

## Python template — game (classic 8×8)

Copy this and fill in the gameplay. The shape is identical for every game in the project.

```python
from machine import Pin
from neopixel import NeoPixel
from time import sleep_ms, ticks_ms, ticks_diff
import _screens as screens

NAME = "MyGame"
NUM_LEDS = 64

# Hardware bindings — set inside run(). NEVER construct hardware at module top.
np = None
JOY_UP = None
JOY_DOWN = None
JOY_LEFT = None
JOY_RIGHT = None
JOY_CENTER = None

FRAME_MS = 50


def clear():
    for i in range(NUM_LEDS):
        np[i] = (0, 0, 0)


def px(col, row, color):
    if 0 <= col <= 7 and 0 <= row <= 7:
        np[row * 8 + col] = color


def play_one_round():
    """Run one game. Returns the final score (int), or None if exit triggered."""
    score = 0
    while True:
        if screens.check_exit():
            return None
        # ... read joystick, update state ...
        # if dead: return score
        clear()
        # ... render the frame ...
        np.write()
        sleep_ms(FRAME_MS)


def run(neopixel, joystick, display=None, screens_np=None):
    global np, JOY_UP, JOY_DOWN, JOY_LEFT, JOY_RIGHT, JOY_CENTER
    np = neopixel
    JOY_UP = joystick["up"]
    JOY_DOWN = joystick["down"]
    JOY_LEFT = joystick["left"]
    JOY_RIGHT = joystick["right"]
    JOY_CENTER = joystick["center"]
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

## Python template — passive app (no score, ends on idle or exit)

For clocks, slideshows, animations — anything without win/lose.

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
        np.write()
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

## TypeScript template — web simulator (mirrors the Python)

The simulator's API is a direct mirror of the MicroPython side. The only invasive difference: `sleep_ms` returns a promise, so every blocking screens call needs `await`. Otherwise the translation is mechanical.

```ts
import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "MyGame";
// Omit (or set false) for classic 8×8 apps. Set true to opt into responsive W×H.
// export const RESPONSIVE = false;

const NUM_LEDS = 64;
const FRAME_MS = 50;

let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin, JOY_LEFT: Pin, JOY_RIGHT: Pin, JOY_CENTER: Pin;

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

async function playOneRound(): Promise<number | null> {
  let score = 0;
  while (true) {
    if (screens.check_exit()) return null;
    // ... game logic ...
    // if (dead) return score;
    clear();
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
  np = neopixel;
  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  JOY_CENTER = joystick.center;
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneRound();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
```

### Python ↔ TypeScript translation cheat sheet

| TypeScript | MicroPython |
|---|---|
| `np[i] = [r, g, b]` | `np[i] = (r, g, b)` |
| `joy.up.value() === 0` | `joystick["up"].value() == 0` |
| `await sleep_ms(50)` | `sleep_ms(50)` |
| `await screens.loading_screen()` | `screens.loading_screen()` |
| `screens.init(screensNp ?? np, joy, display?.width, display?.height)` | `screens.init(screens_np if screens_np is not None else neopixel, joystick, display["width"] if display else None, display["height"] if display else None)` |
| `Math.floor(x)` | `int(x)` (truncates toward 0; use `math.floor` for negatives) |
| `Math.random()` | `random.random()` (import `random`) |
| `xs.push(v)` | `xs.append(v)` |
| `xs.length` | `len(xs)` |
| `xs.slice(0, k)` | `xs[:k]` |
| `for (const x of xs)` | `for x in xs:` |
| `// comment` | `# comment` |

## Integration patches you must provide

After generating the two source files, hand the user **exactly** these two edits.

### 1. Register in the Python launcher

File: `python/main.py`. Find this block near the top:

```python
_DEFAULT_ORDER = (
    "reaction", "connect4", "pong", "breakout", "simonsays", "dinojump",
    "snake", "flappy", "invaders", "doom", "watch",
)
```

Add the new app's name (matching the `.py` filename without extension) to the tuple, at the end:

```python
_DEFAULT_ORDER = (
    "reaction", "connect4", "pong", "breakout", "simonsays", "dinojump",
    "snake", "flappy", "invaders", "doom", "watch", "<name>",
)
```

### 2. Register in the simulator launcher

File: `web-toolkit/src/lib/simulator/launcher.ts`. Add an import alongside the others:

```ts
import * as <name> from "./apps/<name>";
```

And add `<name>` to the `APPS` array (look for `const APPS` or similar). Put it at the end of the list.

### 3. Where files go on the device

The user copies these files to the Pico's filesystem root (via Thonny or `mpremote`):

| Source file | Pico path |
|---|---|
| `python/apps/<name>.py` | `/apps/<name>.py` |
| `python/main.py` | `/main.py` |

The other shared files (`_screens.py`, `_fonts.py`, `fonts.json`, …) are already on the Pico from the project setup.

## Rules — do these

- Construct `NeoPixel(...)` and `Pin(...)` **inside** `run()` and the `__main__` block, never at module top level. Use `np = None` / `JOY_* = None` placeholders at module scope.
- Call `screens.init(...)` **once at the top of `run()`**, before any other screens function.
- Poll `screens.check_exit()` every frame. Without it the user can't bail mid-game.
- Return `None` from `play_one_round()` (or the equivalent passive-app function) when exit is triggered, and check for it in `run()`.
- Use the shared `screens` module for loading, game-over, and end screens. Don't reimplement them.
- Keep RGB values modest (~30–60 of 255). Full white at close range is uncomfortable. Multiply Pixel Designer hex colors by `BRIGHTNESS ≈ 0.25`.
- Use `index = row * 8 + col` for indexing on 8×8. Remember row 0 is the bottom.
- Test the script logic on paper before shipping: every `while True:` loop must eventually exit, every `play_one_round()` must eventually `return`.

## Rules — never do these

- **No `NeoPixel(...)` or `Pin(...)` at module top level.** Importing the app would double-allocate hardware the launcher already owns.
- **No `while True: run(...)` in `__main__`.** A single `run(...)` call is correct; `run()` has its own internal restart loop.
- **No private game-over UI.** Always go through `screens.game_over_screen(score)` or `screens.end_screen()`.
- **No `sleep_ms()` longer than ~50 ms between input checks.** Joystick response above 100 ms feels broken.
- **No `while True:` without a `sleep_ms()` inside.** Even a 10 ms sleep is enough to let `check_exit()` and Ctrl-C fire.
- **No hardcoded font data.** If you need text rendering, ask the user — the project has shared fonts but they require more wiring than this template covers.
- **No designs requiring filesystem JSON loads** unless the user explicitly asks. Embed pixel data inline.
- **No scoring designed to routinely exceed 99.** Static scores look better; design the difficulty ramp so casual play lands 10–60 and skilled play tops out around 80–99.

## Scoring guidance (for games)

If you're building a game, calibrate the score so:
- **~10 points** is reachable in any session — even a short or unlucky run.
- **99 points** is the soft ceiling for skilled play.
- A typical 1-minute run lands **20–40**; a 2-minute focused run lands **50–80**.

Use **+1 per action** as the default (one wall passed, one alien killed, one food eaten). Reserve `+5` / `+10` for hard or special events. Ramp difficulty over time (faster speed, more enemies, smaller paddle) so games end before scores blow past 99.

## Final checklist before you return the files

Before sending the code to the user, verify:

1. The `.py` file has no hardware allocation at module top level.
2. `screens.init(...)` is the first thing inside `run()`.
3. `play_one_round()` (or equivalent) handles `screens.check_exit()` and returns `None` for exit.
4. The `if __name__ == "__main__":` block at the bottom contains a single `run(_np, _joy)` call.
5. The `.ts` file uses `await` for every `sleep_ms`, `loading_screen`, `game_over_screen`, and `end_screen` call.
6. Pixel Designer colors are scaled by `BRIGHTNESS` (≈ 0.25) wherever they're written to the strip.
7. The integration patch tells the user exactly which lines to add to `python/main.py` and `web-toolkit/src/lib/simulator/launcher.ts`.
8. The two filenames (`<name>.py` and `<name>.ts`) match each other and match the launcher registration.

Now read the user's design JSON and description, ask any necessary clarifying questions, and produce the files.
