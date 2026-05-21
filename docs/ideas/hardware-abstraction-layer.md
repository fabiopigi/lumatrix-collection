# Hardware abstraction layer for the Python code

**Status:** exploring
**Tags:** hardware, micropython, architecture, portability, display, input, sensors

## What

Formalise a thin **HAL** between LumenLab apps and the hardware they touch, so a single app file runs unchanged on any backing combination — ws2812 *or* HUB75 display, GPIO joystick *or* I²C joystick, slide switch *or* none, with or without sensors. Concretely: define `Display`, `Button`, `Joystick`, `Switch`, and `Sensor` contracts; provide drop-in implementations; have each board pick the implementations it needs and hand them to apps through the existing `run(np, joy, display, screens_np)` entry point.

Apps already don't import `machine` or `neopixel` during normal launcher operation — this doc is mostly about closing the last few leaks and giving the rest a name.

## Why

Three things are pulling in the same direction:

- **Workshop kits drift.** As soon as someone wants to swap a ws2812 8×8 for a 16×16, or replace the GPIO joystick with an I²C expander on the back of a custom PCB, today's answer is "edit every app's `__main__` block plus `main.py`". That's friction every time someone forks the kit for a variant.
- **The backlog is already going there.** [[esp32-flash-target]] proposes a `board.py` for per-board pinouts. [[sensor-inputs]] proposes a `sensors` module for IMU/mic/light. [[custom-led-panel-board]] envisions ESP32-S3 + HUB75 + IMU + mic + capacitive buttons. Three ideas pointing at the same seam — better to design the seam once.
- **The contract is already mostly clean.** `run(np, joy, display, screens_np)` is duck-typed: `_LegacyBuffer` in `python/main.py:140` already proves an in-memory 8×8 can stand in for a real NeoPixel, then flush to a bigger underlying display. Naming and extending what's implicit costs little; pretending it doesn't exist costs the same friction forever.

## Current state — what leaks today

What's already abstract:

- `run(neopixel, joystick, display, screens_np)` — apps never see `Pin(19)` or `NeoPixel(...)` during launcher-driven operation.
- The `neopixel` buffer is duck-typed: any object supporting `np[i] = (r,g,b)` + `.write()` works (see `_LegacyBuffer` at `python/main.py:140`).
- `_screens.py` is W×H responsive and binds dims via `screens.init(...)`.
- `python/main.py` already reads an optional `/config.py` for `DISPLAY_WIDTH / DISPLAY_HEIGHT / LED_PIN / APPS_ENABLED`.

What still leaks:

- **Every app has a hand-rolled hardware block.** `python/apps/snake.py:165–174`, `breakout.py:314–322`, `pong.py`, `tictactoe.py`, `reaction.py`, `doom.py`, … — fourteen apps each repeat the same `NeoPixel(Pin(19, …), 64)` + six `Pin(3..9, Pin.IN)` constructors in `if __name__ == "__main__":`. A pin renumbering today is a 14-file change.
- **Joystick GPIOs hardcoded in `main.py`.** `python/main.py:49–56` builds the `JOY` dict from literal pin numbers; `/config.py` doesn't override them.
- **`from machine import Pin` / `from neopixel import NeoPixel` at app-module top.** Only used in the standalone block, but the import alone couples each app file to MicroPython on a Pico.
- **`pin.value() == 0` is the contract.** `_screens.py:108–113`, `snake.py:38–41`, and every other app encode active-low directly. An I²C joystick or a touch button doesn't expose a `.value()` that means the same thing.
- **`8` is a magic number in classic apps.** Intentional — they target an 8×8 emulation buffer — but the boundary is unnamed.

## Sketch — the contracts

Duck-typed, no `abc` ceremony. MicroPython is happiest with small protocol surfaces.

### Display

```python
class Display:
    width: int                              # physical pixels
    height: int
    def __setitem__(self, i, color): ...    # color = (r, g, b), 0..255
    def __getitem__(self, i): ...
    def __len__(self): ...                  # width * height
    def write(self): ...                    # flush frame to hardware
```

Already satisfied by `neopixel.NeoPixel`. New backings:

- `Ws2812Display` — thin wrapper over `neopixel.NeoPixel`; lets us add brightness / gamma later without touching apps.
- `Hub75Display` — wraps a HUB75 native module (likely a custom MicroPython firmware build; see [[custom-led-panel-board]]).
- `Legacy8x8Display` — `_LegacyBuffer` relocated and renamed. Takes any underlying `Display` and integer-scales/centres an 8×8 source onto it.
- `SimDisplay` (web/TS side) — already exists in `web-toolkit/src/lib/simulator/hardware/`.

Optional capabilities, queried via `hasattr` (not required on every backing):

- `clear()` — fast fill-black.
- `set_brightness(scale)` — display-level dim (HUB75 supports natively; ws2812 fakes via per-write scaling).

### Input

```python
class Button:
    def is_pressed(self) -> bool: ...       # cooked: True = pressed, regardless of polarity
    def value(self) -> int: ...             # raw active-low for backward-compat: 0 = pressed
```

Backings:

- `GPIOButton(pin, active_low=True)` — wraps `machine.Pin`. Default for today's kit.
- `I2CButton(expander, channel)` — SX1509 / PCF8574 / Adafruit seesaw. One I²C transaction per scan, or batched in the expander wrapper.
- `TouchButton(pad)` — `machine.TouchPad` on ESP32.
- `KeyButton(scancode)` — simulator-side, already mirrored in TS.

Keeping a no-op `.value()` method on every Button means `_screens.py` and existing apps work unchanged on day one.

### Joystick

Just a fixed bundle of five Buttons. Kept as a **dict** (`joystick["up"]`) to preserve today's contract, with the values now being `Button` instances:

```python
joystick = {
    "up":     GPIOButton(Pin(3, Pin.IN), active_low=True),
    "down":   GPIOButton(Pin(6, Pin.IN), active_low=True),
    "left":   GPIOButton(Pin(7, Pin.IN), active_low=True),
    "right":  GPIOButton(Pin(2, Pin.IN), active_low=True),
    "center": GPIOButton(Pin(8, Pin.IN), active_low=True),
}
```

Existing code calling `joy["up"].value() == 0` still works; new code can call `joy["up"].is_pressed()`.

### Switch

The slide switch is read-style, not button-style. Today it's lumped into the joystick dict — it can stay there (`joystick["slide"]`) to avoid churning the contract, but the underlying type is:

```python
class Switch:
    def position(self) -> int: ...          # 0 or 1
    def value(self) -> int: ...             # alias, for backward-compat
```

### Sensors (future)

```python
class IMU:
    def read(self) -> tuple: ...            # (ax, ay, az, gx, gy, gz)

class Mic:
    def level(self) -> float: ...           # 0..1 amplitude
    # def samples(self, n) -> array: ...    # optional, for FFT-style apps

class AmbientLight:
    def lux(self) -> float: ...
```

Sensors are **opt-in** — adding them to `run()` would break the contract. Apps that want them do `from hal import sensors; sensors.imu` and degrade gracefully on boards without one (the module returns `None` or a stub).

### Board

```python
# python/hal/board.py
class Board:
    display: Display                        # the W×H physical display
    legacy_display: Display                 # 8×8 wrapper for classic apps (== display when native)
    joystick: dict[str, Button | Switch]    # up/down/left/right/center (+ slide)
    sensors: dict[str, Any]                 # imu / mic / light / ... — present only if wired
    info: dict                              # {"id": "lumatrix", "label": "LumaTrix 8×8", ...}
```

`Board` is constructed once at boot. `main.py` becomes the only place that cares about which board it's running on.

## Sketch — file structure

```
python/
  main.py                    ← only constructs the Board; no Pin/NeoPixel calls
  hal/
    __init__.py              ← exposes get_board()
    board.py                 ← Board class + selection logic
    interfaces.py            ← protocol docstrings (no abc)
    boards/
      lumatrix.py            ← today's default: Pico + ws2812 + GPIO joystick
      esp32_devkit.py        ← reference ESP32 wiring, same peripherals
      hub75_32x32.py         ← ESP32-S3 + HUB75 + I²C joystick + IMU (future)
    displays/
      ws2812.py
      hub75.py               ← stub today; needs a custom MP firmware build
      legacy_8x8.py          ← _LegacyBuffer, renamed
    inputs/
      gpio_button.py
      i2c_button.py          ← SX1509 / PCF8574 / seesaw
      touch_button.py
      switch.py
    sensors/
      imu.py                 ← MPU-6050 / LSM6DS driver
      mic.py                 ← I²S MEMS or analog
      light.py               ← BH1750 / TSL2591
  apps/
    *.py                     ← unchanged contract; no machine/neopixel imports
```

## Sketch — what an app file looks like after

Today's standalone block (`python/apps/snake.py:164–174`):

```python
if __name__ == "__main__":
    _np = NeoPixel(Pin(19, Pin.OUT), NUM_LEDS)
    _joy = {
        "up":     Pin(3, Pin.IN),
        ...
    }
    run(_np, _joy)
```

becomes:

```python
if __name__ == "__main__":
    from hal import get_board
    b = get_board()
    run(b.legacy_display, b.joystick,
        {"width": b.display.width, "height": b.display.height}, b.display)
```

And the `from machine import Pin` / `from neopixel import NeoPixel` lines at the top of the app disappear. The app file no longer mentions hardware vocabulary at all.

`run()` signature stays the same. The launcher path (`python/main.py` calling `app.run(...)`) doesn't change shape — it just gets the buffers from `get_board()` instead of constructing them inline.

## Migration path (no big bang)

Designed so each step is mergeable on its own and never breaks an existing app:

1. **Add `python/hal/` alongside existing code.** Land `Board`, `GPIOButton`, `Ws2812Display`, `Legacy8x8Display`, and `boards/lumatrix.py`. Zero call-site changes anywhere. Nothing imports it yet.
2. **Port `python/main.py` to `get_board()`** internally. Still produces a dict-shaped `JOY` for backward compat. Default board id = `lumatrix`. All existing apps run unchanged.
3. **Pilot one app's `__main__` block.** `snake.py` is the obvious pick — small file, classic shape. Verify Thonny *Run* still works on the kit.
4. **Sweep the rest** of the `__main__` blocks. Mechanical edit, ~14 files.
5. **Add a second board** to prove the seam. Cheapest option: `esp32_devkit.py` reusing ws2812 + GPIO joystick on different pin numbers. No HUB75, no I²C joystick — just demonstrates that board id ≠ wiring.
6. **Then** layer the spicy backings: `hub75.py`, `i2c_button.py`, sensor modules. Each is its own follow-up doc / PR.

## Open questions

- **How does board selection happen?** Three options: (a) `/config.py` writes a `BOARD = "lumatrix"` string and `get_board()` does the dispatch — simplest, matches today's `LumenFlash`-writes-config pattern; (b) runtime detect from `sys.platform` / `machine.unique_id` — fragile across variants; (c) both, with config winning. Default: (a).
- **Joystick: dict or object?** Keeping the dict shape preserves the existing app contract (zero churn). Switching to attribute access (`joystick.up`) is breaker for ~14 apps + `_screens.py`. **Lean: keep the dict.** Buttons inside the dict get the new methods.
- **`Button.value()` backwards-compat.** Worth keeping for one major release so `_screens.py` and any LLM-generated app referring to `value() == 0` keeps working. Deprecate later if it's worth it.
- **Sensor access shape.** A top-level `from hal import sensors` module that reflects whatever the current board exposed is simpler than adding a fifth `run()` arg, which would break every app. Apps that need a sensor that isn't present either bail at import time or check `if sensors.imu is None`.
- **HUB75 driver gap.** MicroPython's HUB75 story is weak — usable libraries are C++ on ESP-IDF/Arduino. Concrete options: ship a **custom MicroPython firmware build** with a HUB75 native module baked in (matches what [[custom-led-panel-board]] would ship anyway), or interim-target an SPI display first to prove the abstraction without the firmware-build dependency.
- **Simulator parity.** The TS simulator already has `web-toolkit/src/lib/simulator/hardware/` per AUTHORING.md. Worth aligning names (`hardware/` vs `hal/` is the obvious bikeshed — picking one across both surfaces keeps the mental model unified). Lean: keep TS as-is, name the Python side `hal/` so it doesn't collide with `machine`-style words.
- **How much to expose to the LLM prompt** (`docs/llm-app-prompt.md`)? Today the prompt tells the LLM about `joystick["up"].value() == 0`. After the HAL lands, prompt can stay the same (backward compat) or switch to `is_pressed()` — same code, more readable. Probably switch.
- **Brightness as a HAL concern?** Both ws2812 and HUB75 want dimming, but today every screen / app does its own `BRIGHTNESS = 0.25` hex-dim. Centralising it on `Display.set_brightness()` is a cleanup worth doing alongside the HAL, but it's not strictly required for the abstraction. Keep optional.
- **Memory budget on the Pico.** Adding a thin class layer over every `Pin` and `NeoPixel` has a tiny cost. On a Pico W with MicroPython this is fine, but worth measuring once the migration pilot is in.
- **What's the smallest "interesting" second board?** Probably `esp32_devkit.py` with the same peripherals on different GPIOs. Proves the seam without HUB75 / I²C joystick complexity. Then layer HUB75 + I²C in a later round.

## Notes

- This supersedes the `board.py` sketch in [[esp32-flash-target]] (same idea, more detail) and the `sensors` module sketch in [[sensor-inputs]] (folded into the HAL boundary rather than living parallel to it).
- The hardware shopping list in [[custom-led-panel-board]] (HUB75, IMU, mic, light, capacitive buttons) maps one-to-one onto the backings listed here. The HAL is the seam that lets that product reuse all existing apps unchanged.
- The TS simulator under `web-toolkit/src/lib/simulator/hardware/` is the prior-art for what this looks like in the JS world — and confirms the shape works in practice.
- Today's `joystick` dict + `np.write()` contract is honestly already ~70 % of a HAL — this doc mostly formalises what's implicit and removes the standalone-block duplication so adding hardware variants stops being a per-app cost.
- Risk to watch: HAL designs tend to grow until they describe everything. Keeping it duck-typed (no `abc`), keeping the surface tiny (`Display`, `Button`, `Switch`, sensors), and refusing to add `run()` arguments are the three things that keep this from becoming a framework.
