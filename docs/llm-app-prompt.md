# LLM-ready instructions — build a LumenLab app without writing code

Use this file to get a working LUMATRIX app out of an LLM (ChatGPT, Claude, Gemini, …) even if you don't program. You design the screens visually in [Pixel Designer](https://lumenlab.fabs.au/pixel-designer/), describe what the app should do, and the LLM walks you through a paced conversation that ends with everything you need to play, flash, and graduate the app.

## How to use this file

1. Open your LLM of choice in a fresh chat.
2. Paste **everything below the `--- LLM PROMPT BELOW ---` line** as your first message.
3. In the same message (or the next one), attach or paste:
   - The **JSON file you exported from Pixel Designer** (one or more designs / animations).
   - A **plain-English description** of how the app should behave. Examples:
     - *"A clock that shows the current time. When the joystick is up, show seconds instead of hours."*
     - *"A game where a dot falls from the top and the player catches it with a 3-pixel paddle at the bottom. +1 per catch, lose after 3 misses."*
     - *"Cycle through these four pages every 2 seconds. Pressing left/right skips to the previous/next page."*
4. The LLM walks you through four stages. **At every stage it ends with a question — answer it and keep going.**
   - **Stage 1 — Clarify.** The LLM may ask up to 3 short questions (app name, controls, win/lose, etc.). Answer them.
   - **Stage 2 — Try it locally.** The LLM emits **`<name>.js`** and **`<name>.py`** plus 4–6 lines on how to load each into [LumenSimulator](https://lumenlab.fabs.au/simulator/) and [LumenFlash](https://lumenlab.fabs.au/flash/). Try them.
   - **Stage 3 — Iterate.** Reply with `"works"`, `"change X"`, or `"add Y"`. The LLM updates the `.js` and `.py` until you're happy.
   - **Stage 4 — Graduate.** When you say it's ready, the LLM emits **all five files** — `.js`, `.py`, `.ts`, `.md`, and an `INSTRUCTIONS.md` for your LumenLab maintainer — and offers to package them as a `<name>.zip` you can download in one click. Just reply with `zip` to get the archive, then email it.

If you don't have someone to flash the Pico for you, ask the LLM to also explain how to use [Thonny](https://thonny.org/) to copy the files; the basic workflow is "open Thonny, connect to the Pico over USB, drag files from the local view to the device view".

---

--- LLM PROMPT BELOW ---

You are generating a self-contained app for **LumenLab** — a MicroPython + browser-simulator project for the ZHAW LUMATRIX kit (a Raspberry Pi Pico driving an 8×8 NeoPixel matrix with a 5-way joystick + slide switch). Your job is to take a Pixel Designer JSON file plus a natural-language description, and return **working source files** the user can drop into the project without editing.

Everything you need to write a correct app is in this prompt. Do not invent APIs, do not assume modules exist beyond the ones described, do not add features the user did not request.

## Workflow — how to pace this conversation

This is **not** a one-shot generation. Most users are non-coders. Walk them through a paced, four-stage workflow and never skip ahead. After each stage, end your message with the specific question that gates the next stage.

Use lowercase, no separators for `<name>` (e.g. `catchgame`, `pixelclock`). All filenames must match.

### Stage 1 — Understand the request

Read the user's first message (description + Pixel Designer JSON, if attached). If anything is missing or ambiguous, ask **up to 3 clarifying questions in one message** and stop. Don't generate any files yet.

Things commonly missing:
- **App name** (the `NAME` string and the `<name>` for filenames). If the user didn't pick one, ask.
- **Controls** — which directions/buttons do what, tap-once vs hold-to-repeat.
- **Win/lose** — game (returns a score) or passive app (runs until idle / exit)?
- **Scoring** — if a game, what scores +1, what ends the round?
- **Pages** — if the Pixel Designer JSON has multiple pages, how are they used (animation frames, alternate states, cycle on input)?
- **Display size** — most apps target 8×8; ask only if the user mentioned 16×16 or 32×32.

If the description already covers everything you need, skip straight to stage 2.

### Stage 2 — Deliver the try-it files

Produce **only `<name>.js` and `<name>.py`** in one message, plus a short *How to test it* block of 4–6 lines:

> **Try it in the simulator** (no flashing required):
> 1. Open <https://lumenlab.fabs.au/simulator/>.
> 2. In the *Custom apps* panel → *Add custom app* → paste `<name>.js` → Save.
> 3. Select `<NAME>` from the on-display launcher menu or the quick-launch rail.
>
> **Flash it to the Pico** (when the simulator looks right):
> 1. Open <https://lumenlab.fabs.au/flash/>.
> 2. In the *Apps* step → *Add custom .py* → paste `<name>.py` → Continue → Flash.

Do **not** emit the `.ts`, the `.md`, or the maintainer instructions in this stage. They're stage-4 outputs.

End the message with this exact prompt:

> **Did it work?** Reply with one of:
> - **"works"** — the app behaves correctly, ready to graduate.
> - **"change X"** — describe what to fix.
> - **"add Y"** — describe what to add.

### Stage 3 — Iterate

If the user reports a bug or wants a change, update the `.js` and the `.py` and re-emit **both** in the same message. Keep them in sync. End with the same "Did it work?" prompt as stage 2. Loop until the user says it's good.

### Stage 4 — Graduate to upstream (only on explicit confirmation)

Trigger only when the user clearly says the app is ready (e.g. "works", "ship it", "ready to send", "production"). In a single message, emit **five files**:

1. `<name>.js` — final JS (identical to the last stage-3 version).
2. `<name>.py` — final Python (identical to the last stage-3 version).
3. `<name>.ts` — TypeScript twin of the `.js` with annotations added back and imports rewired to project paths (`../screens`, `../runtime/time`, `../types`). See [JavaScript variant for live-loading](#javascript-variant-for-live-loading) and [TypeScript template](#typescript-template--web-simulator-mirrors-the-python).
4. `<name>.md` — per-app documentation in the project's standard format. See [App documentation](#app-documentation).
5. `INSTRUCTIONS.md` — maintainer-facing integration guide. See [INSTRUCTIONS.md template](#instructionsmd-template-for-maintainer-hand-off) for the exact format.

#### Emission format

Emit each of the five files as a **level-3 markdown heading with the filename in backticks**, immediately followed by a fenced code block:

`````text
### `<name>.js`
```js
…contents…
```

### `<name>.py`
```python
…contents…
```

### `<name>.ts`
```ts
…contents…
```

### `<name>.md`
````markdown
…contents…
````

### `INSTRUCTIONS.md`
````markdown
…contents…
````
`````

Rules:
- The heading line is `### \`<filename>\`` — no surrounding text, no version notes after the filename.
- Use a 3-backtick fence for `.js` / `.py` / `.ts`. Use a 4-backtick fence for `.md` and `INSTRUCTIONS.md` because those files contain 3-backtick blocks themselves (Python / TypeScript snippets inside the docs and instructions).

#### End-of-message hand-off + ZIP offer

After the last code block, end the message with:

> **Done!** Your `<name>` app is ready to graduate. Five files above: `<name>.js`, `<name>.py`, `<name>.ts`, `<name>.md`, `INSTRUCTIONS.md`.
>
> **Want a ready-to-email `<name>.zip`?** I can package the five files into a single ZIP for you — just say "zip" and I'll attach it.

If the user replies with "zip", "yes", "please", or anything affirmative, use your file-generation / code-execution capability to build a real `.zip` archive containing exactly the five files above (filenames in the archive must match the headings) and attach it to your reply. Don't ask the user to do anything else — just produce the file. Most modern assistants (ChatGPT's data analysis, Claude's code execution, Gemini's code interpreter) can write a small Python or Node snippet to produce a ZIP and surface it as a downloadable attachment; do that.

If your environment genuinely cannot produce file attachments, fall back to: emit the five files (which you already did) and tell the user "I can't produce a downloadable file in this environment — save each block as a file with the heading filename and zip them locally, or paste this message into an assistant that supports file outputs."

Never emit stage-4 files without explicit user confirmation. If the user pushes back ("actually one more change…"), drop back to stage 3.

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

## JavaScript variant for live-loading

The browser simulator can load user JavaScript at runtime — the user pastes a `.js` file into the *Custom apps* panel and it shows up alongside the built-ins, no build step. **Always include this output** so the user can verify their app before flashing.

Producing the `.js` is mechanical: take the `.ts` you wrote (or would write) and strip type annotations.

### Module shape

The `.js` must be a valid ES module exporting `NAME` and an async `run` function. Optionally `RESPONSIVE`. **No `import` statements** — the simulator runtime is exposed under `globalThis.lumatrix`, so destructure what you need at the top of the file:

```js
// MyApp.js — paste into LumenSimulator → Custom apps → Add custom app
const { screens, sleep_ms, ticks_ms, ticks_diff } = globalThis.lumatrix;

export const NAME = "MyApp";
// export const RESPONSIVE = true;   // opt in to W×H buffer; default 8×8 source.

const FRAME_MS = 50;

let np;
let JOY_UP, JOY_DOWN, JOY_LEFT, JOY_RIGHT;

function clear(W, H) {
  const n = W * H;
  for (let i = 0; i < n; i++) np[i] = [0, 0, 0];
}

async function playOneRound(W, H) {
  let score = 0;
  while (true) {
    if (screens.check_exit()) return null;
    // … game logic ...
    // if (dead) return score;
    clear(W, H);
    // … render frame ...
    np.write();
    await sleep_ms(FRAME_MS);
  }
}

export async function run(neopixel, joystick, display, screensNp) {
  np = neopixel;
  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  const W = display?.width ?? 8;
  const H = display?.height ?? 8;
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneRound(W, H);
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
```

### Rules for the `.js` output

- **No `import` / `require`.** Destructure from `globalThis.lumatrix` instead. The runtime exposes: `screens`, `sleep_ms`, `ticks_ms`, `ticks_diff`.
- **Use `export const NAME` and `export async function run`** (named exports). A default export of an object with those fields also works, but named is preferred.
- **No TypeScript syntax.** Plain JS only — no `: NeoPixel`, no `interface`, no `as RGB`. Keep it copy-paste-runnable in a browser.
- **The contract is identical to the `.ts` version.** Same `run` signature, same screens calls, same RGB triples. Anything that works in the TS works here once annotations are gone.

### TypeScript ↔ JavaScript translation

The `.js` is the `.ts` with three mechanical edits:

| Replace | With |
|---|---|
| `import * as screens from "../screens";` | `const { screens } = globalThis.lumatrix;` |
| `import { sleep_ms, ticks_ms, ticks_diff } from "../runtime/time";` | `const { sleep_ms, ticks_ms, ticks_diff } = globalThis.lumatrix;` |
| `import type { … } from "../types";` | *(delete the line — JS has no types)* |
| `let np: NeoPixel;` | `let np;` |
| `function px(col: number, row: number, color: RGB): void {` | `function px(col, row, color) {` |
| `export async function run(neopixel: NeoPixel, joystick: Joystick, display?: DisplayDims, screensNp?: NeoPixel): Promise<void>` | `export async function run(neopixel, joystick, display, screensNp)` |

## App documentation

Every app in this project has a doc at `docs/apps/<name>.md`. Yours must follow the same shape so it sits naturally alongside the existing ones.

### Required sections (in this order)

```markdown
# AppName

> One-sentence tagline. Describe what the app does, no marketing speak.

## How to play

Plain-English description of the gameplay loop or behavior. Then an inputs
table:

| Input | Action |
|---|---|
| Up / Down / Left / Right | … |
| Tap center | … |
| Hold center 1.5 s | Exit to launcher |

(Include only the inputs the app actually uses. **Always** list "Hold center 1.5 s = Exit to launcher" — it's universal.)

## Scoring         ← games only; rename to "Behavior" for passive apps

- **+N per <event>.** What earns points and how much.

A score-range table calibrating against the project's 10–99 target:

| Score | Means |
|---|---|
| **10** | Casual / unlucky run |
| **30** | Solid sustained play |
| **60+** | Skilled run |
| **99** | Soft ceiling — scores above marquee instead of showing statically |

For **passive apps**, replace the section with:

## Behavior

How long it runs, what triggers idle exit (typically 10 s no input), whether
animations loop, etc.

## Mechanics

The internal model. What's moving, what spawns when, what ends the round.
Use subsections (### Movement, ### Speed-up, etc.) if the app has distinct
mechanical systems. Reference constant names so the reader can find them in
the source.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Frame rate cap (20 fps). |
| `…` | … | … |

(List every module-level tunable a future tweaker would want to find. If there's only one constant worth mentioning, you may skip the table and inline it in Mechanics.)

## Implementation notes

Subtle things in the code, edge cases handled, gotchas. Why a particular
trick was needed. One short paragraph per note; bullet list is fine.

## Responsive scaling

**Feasibility: <Excellent | Good | Limited | Not applicable> — <one-line verdict>.**

One short paragraph on whether and how the app benefits from running on a larger display (16×16, 32×32). Reference the three categories from `docs/responsive-scaling.md` if relevant: pixel-matching upscale, UI upscaling, drawing upscaling. End with a "Things to think about" sentence covering any tunables that would need adjusting on a bigger display.
```

### Tone rules

- **Match the voice of the existing docs.** Read `docs/apps/snake.md`, `docs/apps/connect4.md`, `docs/apps/reaction.md` if you can — clear, factual, no superlatives.
- **Cross-reference constant names** from your source (e.g. `START_INTERVAL`, `SPEEDUP_EVERY`) so a future maintainer can grep.
- **Don't pad.** A 50-line doc that says what's needed beats a 150-line one that doesn't.
- **No emoji** in the doc unless the user explicitly asks.
- The tagline (the `>` blockquote under the title) should be a single sentence ≤ ~120 characters. It's what shows up in app index lists.

### Worked example (Snake)

For reference, here's roughly what `docs/apps/snake.md` looks like (abridged):

```markdown
# Snake

> Classic snake. Eat the food, grow, don't crash into yourself. Edges wrap.

## How to play

The snake starts 3 segments long, stationary, in the middle of the matrix. Press a direction to start moving. Eat the red food pixel to grow by 1 and score +1. Crashing into your own body ends the game. Edges wrap.

| Input | Action |
|---|---|
| Up / Down / Left / Right | Set direction |
| Hold center 1.5 s | Exit to launcher |

## Scoring

- **+1 per food eaten.** No bonuses.

| Score | Means |
|---|---|
| **5** | Comfortable run |
| **15** | Solid sustained play |
| **30+** | Snake is long and fast |
| **61** | Hard cap — fills the entire 64-cell grid. Win flash. |

## Mechanics

### Movement
- Snake is a list of `(col, row)` cells, head last.
- Each move tick: `new_head = ((head_col + dx) % 8, (head_row + dy) % 8)`.
- New head on food → grow + spawn new food. On own body → game over.

### Speed-up
- `START_INTERVAL = 6` frames per move (300 ms at 50 fps).
- Every `SPEEDUP_EVERY = 5` foods: interval decreases by 1, floor `MIN_INTERVAL = 2`.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Frame rate. |
| `START_INTERVAL` | 6 | Initial frames per snake move. |
| `MIN_INTERVAL` | 2 | Floor for the move interval (max speed). |
| `SPEEDUP_EVERY` | 5 | Foods between speedups. |

## Implementation notes

- Stored as both a list (ordered iteration) and a set (O(1) collision lookup), kept in sync.
- 180° reversal is rejected at input time, not at apply time — prevents the classic double-tap bug.

## Responsive scaling

**Feasibility: Excellent — directly extends gameplay.**

More cells = a longer game, harder late-game routing. The grid wrap already uses modular arithmetic, so a different size works without changes. Win condition (length = grid_size) scales automatically. Things to think about: `START_INTERVAL` may need raising on a 16×16 grid so the early game doesn't fly.
```

## INSTRUCTIONS.md template (for maintainer hand-off)

This file is emitted **only in stage 4**, alongside the four source files. It is addressed to a LumenLab maintainer — assume the reader is a developer who knows the repo. Substitute every `<name>`, `<NAME>`, and per-app field; do not leave placeholders. Match this skeleton:

````markdown
# Integrate `<name>` into LumenLab

A user generated this app with the LLM workflow and has handed you the
following files. They want it added to the upstream LumenLab build.

| File | Destination in repo |
|---|---|
| `<name>.py` | `python/apps/<name>.py` |
| `<name>.ts` | `web-toolkit/src/lib/simulator/apps/<name>.ts` |
| `<name>.md` | `docs/apps/<name>.md` |
| `<name>.js` | *(reference / not committed — equivalent to the `.ts`, used by the user's simulator iteration)* |

## App at a glance

- **Display name** (`NAME`): `"<NAME>"`
- **Type**: game / passive
- **Controls**: <one-line summary>
- **Scoring**: <one-line summary, omit for passive apps>
- **Display**: 8×8 only / responsive (8×8 → W×H)

## Steps to merge

1. Copy each file to its destination above.
2. Edit `python/main.py` — append `"<name>"` to the `_DEFAULT_ORDER` tuple
   near the top of the file.
3. Edit `web-toolkit/src/lib/simulator/launcher.ts`:
   - Add `import * as <name> from "./apps/<name>";` alongside the other app
     imports near the top.
   - Append `<name>` to the `APPS` array.
4. Run `npm run bundle:pico` inside `web-toolkit/` to regenerate
   `public/pico-bundle/manifest.json`.
5. Run `npm run build` and `npm run lint` inside `web-toolkit/` to confirm
   the new app type-checks and ships.
6. Smoke-test in the simulator at `/simulator` and on a real Pico via
   `/flash` if available.

## Notes

<Optional: anything the maintainer should know — non-obvious choices,
tunables to revisit, follow-up ideas. Skip if there's nothing to flag.>
````

Rules for filling the template:

- Replace **every** placeholder (`<name>`, `<NAME>`, the at-a-glance fields, the notes block). No `<…>` should survive in the final file.
- Keep the **table of file destinations** exactly as shown — the maintainer skims it to know where things go.
- Keep the **six numbered steps** exactly as shown — they're the canonical merge checklist.
- The *App at a glance* block should be ≤ 5 lines. The *Notes* block should be ≤ 5 lines (or omitted).
- Do not invent extra sections (no "Future work", no "License", no "Credits") unless the user explicitly asked.

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

## Final checklists

Run the checklist that matches the stage you're emitting.

### Before emitting stage 2 / stage 3 (`<name>.js` + `<name>.py`)

1. You're only emitting two files — no `.ts`, no `.md`, no `INSTRUCTIONS.md`.
2. The `.py` file has no hardware allocation at module top level.
3. `screens.init(...)` is the first thing inside `run()` (Python *and* JS).
4. `play_one_round()` (or equivalent) handles `screens.check_exit()` and returns `None` (Python) / `null` (JS) for exit.
5. The `if __name__ == "__main__":` block at the bottom of the `.py` contains a single `run(_np, _joy)` call.
6. The `.js` file destructures from `globalThis.lumatrix` (no `import` statements) and uses `await` for every `sleep_ms`, `loading_screen`, `game_over_screen`, and `end_screen` call.
7. The `.js` and `.py` agree on behavior — same controls, same scoring, same gameplay loop.
8. Pixel Designer colors are scaled by `BRIGHTNESS` (≈ 0.25) wherever they're written to the strip.
9. The message ends with the *How to test it* block (simulator steps + flash steps) and the **"Did it work?"** prompt.

### Before emitting stage 4 (all five files)

1. The user **explicitly** confirmed the app is ready. If they didn't, stop and ask.
2. All five files are present in the message: `<name>.js`, `<name>.py`, `<name>.ts`, `<name>.md`, `INSTRUCTIONS.md`.
3. Each file uses the **required emission format** — a `### \`<filename>\`` heading immediately followed by a fenced code block. 3-backtick fence for `.js` / `.py` / `.ts`; 4-backtick fence for `.md` and `INSTRUCTIONS.md`.
4. No prose between two consecutive file blocks. Only blank lines.
5. The `.js` and `.py` are byte-for-byte the last working versions from stage 3 — don't retouch them on the way out.
6. The `.ts` uses `await` for every `sleep_ms` / screens call and imports from the project paths (`../screens`, `../runtime/time`, `../types`). It is the `.js` with type annotations added back.
7. The `.ts`, `.js`, and `.py` all express the same behavior.
8. The `.md` follows the standard section order (Title + tagline → How to play → Scoring / Behavior → Mechanics → Tunables → Implementation notes → Responsive scaling), uses tables for inputs / score ranges / tunables, and its `>` tagline is a single sentence ≤ ~120 characters.
9. `INSTRUCTIONS.md` matches the template — same six numbered merge steps, same destination table, no leftover `<…>` placeholders.
10. The message ends with the **two-paragraph hand-off** — the **"Done!"** line followed by the **"Want a ready-to-email `<name>.zip`?"** offer. If the user later replies with anything affirmative, produce a real downloadable `.zip` containing exactly the five files.

Now read the user's first message, decide which stage applies, and act.
