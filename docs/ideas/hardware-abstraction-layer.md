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

### Analog inputs

ADC handling is one of the places MicroPython diverges most across ports — Pico's `machine.ADC` exposes `.read_u16()` (0..65535 normalised), older ESP32 firmware historically only had `.read()` (0..4095 raw), and newer ESP32 builds support both. The HAL normalises this so apps see one shape:

```python
class AnalogInput:
    def __init__(self, pin, vref=3.3): ...
    def read(self) -> int: ...              # 0..65535, MP normalised convention
    def read_v(self) -> float: ...          # 0.0..vref volts
    def fraction(self) -> float: ...        # 0.0..1.0 — what most apps actually want
```

`fraction()` is the friendly one — most analog use-cases want *"where is this in its range"* not raw counts. Built on top:

- **`AnalogStick(x: AnalogInput, y: AnalogInput, button: Button|None, deadzone=0.05)`** — a 2-axis stick (KY-023 style) exposing `.position() -> (-1.0..+1.0, -1.0..+1.0)` plus its optional digital press. Apps that want analogue movement use this; apps wired to a digital 5-way joystick keep using the `joystick` dict. A board may even synthesise a digital `Button` out of an `AnalogStick` so the existing 5-button contract keeps working.
- **`AnalogMic(input: AnalogInput)`** — `.level() -> 0..1` for level-meter visuals. FFT-style apps want raw samples and need a higher-rate `.samples(n)` method; that's a more invasive backing (tight read loop or DMA on capable ports).
- **`AnalogLight(input: AnalogInput)`** — photoresistor (LDR) wired as a voltage divider. Cheap alternative to a smart light sensor; same shape, lower accuracy.
- **`Potentiometer(input: AnalogInput)`** — user-tunable dial; apps that want a hardware brightness/speed knob read `.fraction()`.

### I²C buses and drivers

Many "smart" peripherals — IMU, ambient-light sensor, I/O expanders driving alternative joysticks — share one I²C bus: a single SDA/SCL pair, 3.3 V, GND. The HAL **owns the bus**; drivers receive it as a constructor arg and never build their own.

```python
class I2CBus:
    def __init__(self, peripheral_id, sda_pin, scl_pin, freq=400_000): ...
    def scan(self) -> list[int]: ...
    def writeto(self, addr, buf): ...
    def readfrom(self, addr, n): ...
    def writeto_mem(self, addr, reg, buf): ...
    def readfrom_mem(self, addr, reg, n): ...
```

Thin wrapper over `machine.I2C`. The `Board` constructs each bus once; everything wired to that bus takes the reference. This prevents the classic foot-gun of two drivers each instantiating their own `I2C` peripheral and fighting over the same pins.

Drivers built on the bus implement the existing HAL contracts (`Button`, `Switch`, `IMU`, …) so apps don't notice the difference:

```python
# python/hal/drivers/sx1509.py — 16-channel I/O expander
class SX1509:
    def __init__(self, bus, addr=0x3E): ...
    def button(self, channel, active_low=True) -> Button: ...   # ← satisfies the Button contract
    def switch(self, channel) -> Switch: ...

# python/hal/drivers/mpu6050.py — 6-axis IMU
class MPU6050:
    def __init__(self, bus, addr=0x68): ...
    def read(self) -> tuple: ...    # (ax, ay, az, gx, gy, gz) — m/s², rad/s
```

The "joystick via I²C" case is then literally:

```python
# inside boards/hub75_32x32.py
i2c = I2CBus(0, sda_pin=Pin(8), scl_pin=Pin(9))
exp  = SX1509(i2c)
joystick = {
    "up":     exp.button(0),
    "down":   exp.button(1),
    "left":   exp.button(2),
    "right":  exp.button(3),
    "center": exp.button(4),
    "slide":  exp.switch(5),
}
```

Apps and `_screens.py` see the same shape they always have. The choice of GPIO-vs-I²C lives in one file.

Likely starter driver set (added as boards need them, not all on day one):

| Class | Driver | Use |
|---|---|---|
| `Button` / `Switch` source | `SX1509`, `PCF8574`, `seesaw.Seesaw` | I²C joystick / button add-on boards |
| `IMU` | `MPU6050`, `LSM6DS3`, `BNO055` | Tilt control, shake detect, on-board sensor fusion (BNO) |
| `AmbientLight` (`.lux()`) | `BH1750`, `TSL2591` | Auto-brightness, ambient apps |
| (gesture) | `APDS9960` | Hand-wave input — natural future capability |

**Address conflicts** are a hardware concern, not a software one — every driver takes `addr=` with a sensible default; the board author moves things around if two devices clash. The HAL doesn't pretend to solve that for you.

### Sensors

With buses in place, "Sensors" is a thin namespace, not a separate subsystem. Sensor contracts:

```python
class IMU:
    def read(self) -> tuple: ...        # (ax, ay, az, gx, gy, gz)
    # def orientation(self) -> tuple: ...   # only on fused sensors like BNO055

class Mic:
    def level(self) -> float: ...       # 0..1 amplitude
    # def samples(self, n): ...         # optional, for FFT visualisations

class AmbientLight:
    def lux(self) -> float: ...
```

These are satisfied by either an I²C driver (`MPU6050`, `BH1750`) or an analogue backing (`AnalogMic`, `AnalogLight`). Apps don't care which.

Sensors are **opt-in** — adding them to `run()` would break the contract. Apps that want them import them: `from hal import sensors; sensors.imu`. Boards without a given sensor expose `None` for that slot; apps either check (`if sensors.imu is None: return early`) or fail loudly at import time.

### Network

WiFi is a **capability**: the board may or may not have it. The default LumaTrix kit (plain Pico) has none; Pico W and ESP32 do. Apps that want WiFi degrade gracefully if it isn't there — `board.network` is `None`.

```python
class Network:
    def connect(self, ssid, password, timeout_ms=10_000) -> bool: ...
    def is_connected(self) -> bool: ...
    def ip(self) -> str | None: ...
    def rssi(self) -> int | None: ...
    def disconnect(self): ...
```

Thin wrapper over `network.WLAN(network.STA_IF)`. Higher layers stack on, all opt-in:

```python
class NTPClock:
    def sync(self, server="pool.ntp.org", tz_offset_s=0) -> bool: ...

class HTTPClient:               # thin wrapper over urequests
    def get(self, url, **kw) -> dict: ...
    def post(self, url, json=None, **kw) -> dict: ...

class MQTTClient:               # thin wrapper over umqtt.simple
    def __init__(self, broker, port=1883, client_id=None): ...
    def publish(self, topic, payload): ...
    def subscribe(self, topic, callback): ...
```

**Credentials** live in `/config.py` (which the flash wizard already writes). The board reads them at boot and exposes them as `board.wifi_credentials`; apps don't read config files directly.

**Blocking is the hard problem.** The whole codebase is built on a synchronous frame loop with a strict joystick-responsiveness rule (`docs/AUTHORING.md`: never `sleep_ms` for more than 50 ms between input checks). Network calls regularly take seconds. Two patterns to pick from:

- **Upfront blocking with a setup screen.** The watch app does `Connecting to WiFi…` then `Syncing time…` once on entry, then runs locally for the rest of the session. Suitable for occasional setup, not for in-game polling.
- **Background scheduler.** `main.py` spins up an `asyncio` task that maintains WiFi state and refreshes data on a timer; apps poll `is_connected()` / `latest_value()` synchronously, never block. This unlocks live-data displays (weather, transit, status pages) but adds an event-loop layer beneath the current synchronous app model — a real architectural choice, worth its own follow-up doc when it lands.

The natural first WiFi user is the **watch app** — NTP sync once on entry to replace the manual clock-set workflow.

### Other transports (sketch)

Mentioned for completeness — same "Board owns the bus, drivers take a reference" pattern, doesn't need to ship in the first cut:

- **SPI buses.** `SPIBus(peripheral_id, sck, mosi, miso)` owned by `Board`. Backs SPI displays (SSD1306 OLED, ST7735 TFT, ePaper), SD-card storage, some IMUs at higher data rates than I²C allows.
- **UART / serial.** Already used by `apps/letters.py` for serial-driven text. A `SerialInput` wrapper would let the simulator fake serial bytes the same way it fakes joystick presses, closing the "serial-only on hardware" gap noted in AUTHORING.
- **PWM / audio out.** Buzzer for sound effects, servo for kinetic art pieces. `PWMOutput(pin, freq, duty)` is the contract; a `Buzzer.beep(hz, ms)` helper sits on top.
- **I²S audio in.** Digital MEMS mics (INMP441, SPH0645) are I²S, not I²C — distinct bus, but the same ownership pattern: `I2SBus(...)` on the board, `I2SMic(bus)` as the driver.

### Board

```python
# python/hal/board.py
class Board:
    display: Display
    legacy_display: Display                 # 8×8 wrapper for classic apps
    joystick: dict[str, Button | Switch]    # up/down/left/right/center (+ slide)

    # Shared buses — drivers take references, never construct their own
    i2c: dict[str, I2CBus]                  # e.g. {"main": I2CBus(0, ...)}
    spi: dict[str, SPIBus]

    # Capability namespaces — only populated when the board actually has these
    sensors: dict[str, IMU | Mic | AmbientLight | None]
    network: Network | None
    wifi_credentials: tuple[str, str] | None

    info: dict                              # {"id": "lumatrix", "label": "...", ...}
```

`Board` is constructed once at boot and is the **only** place that knows which physical hardware is wired up. Per-board files (`boards/lumatrix.py`, `boards/hub75_32x32.py`) read like a wiring diagram in Python.

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
      hub75.py               ← needs a custom MP firmware build
      legacy_8x8.py          ← _LegacyBuffer, renamed
    inputs/
      gpio_button.py
      touch_button.py
      switch.py
      analog_stick.py        ← 2-axis stick over two AnalogInputs
    analog/
      adc.py                 ← AnalogInput — normalises Pico vs ESP32 ADC quirks
      mic.py                 ← AnalogMic (.level() / .samples(n))
      light.py               ← AnalogLight (LDR voltage-divider)
    buses/
      i2c.py                 ← I2CBus, shared by all I²C drivers
      spi.py                 ← SPIBus, shared by SPI displays / SD card / SPI IMUs
    network/
      wlan.py                ← Network — capability; None on boards without WiFi
      ntp.py                 ← NTPClock
      http.py                ← HTTPClient
      mqtt.py                ← MQTTClient
    drivers/
      sx1509.py              ← I²C IO expander → Button / Switch sources
      pcf8574.py             ← cheaper IO expander, same contract
      seesaw.py              ← Adafruit programmable expander
      mpu6050.py             ← I²C IMU
      lsm6ds.py              ← I²C IMU (newer)
      bno055.py              ← I²C IMU with onboard sensor fusion
      bh1750.py              ← I²C ambient light
      tsl2591.py             ← I²C ambient light (higher dynamic range)
  apps/
    *.py                     ← unchanged contract; no machine/neopixel imports
```

Drivers land as boards need them, not all on day one. The namespacing matters more than the inventory — `inputs/` is for things that satisfy the existing input contracts directly, `analog/` is for ADC-backed peripherals, `buses/` is for shared transports, `drivers/` is where vendor-specific I²C/SPI chip code lives.

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
- **I²C bus ownership and lifecycle.** Two drivers wired to one bus both want a reference at construction time. The `Board` constructs the bus once and passes the reference — but what about device hot-plug, error recovery (an unplugged sensor wedging the bus), or boards with multiple buses (e.g. one for inputs at 100 kHz, one for fast sensors at 400 kHz)? Lean: `board.i2c` is a dict keyed by bus name, single instance per bus, no hot-plug; bus errors propagate to the driver and the driver decides whether to retry or surface `None`.
- **ADC normalisation cost.** Pico has 12-bit ADC, ESP32 historically 12-bit with worse linearity and a per-channel calibration table. Promising 0..65535 from `read()` means the HAL upscales raw counts and loses no info — but it doesn't make the signal cleaner. Should `AnalogInput` apply any smoothing (running average, deadband) or leave that to apps? Lean: no smoothing in the HAL — apps that care can wrap, apps that don't get raw.
- **Blocking network calls vs. the joystick-responsiveness rule.** AUTHORING.md forbids `sleep_ms` longer than 50 ms in input-sensitive code. NTP sync, HTTP requests, MQTT connect can all block multi-second. Either (a) only call them from a dedicated "setup screen" where input is paused; or (b) move to an `asyncio`-based runtime where network lives on a background task. (b) is a real architectural shift that probably wants its own doc — lean on (a) for the first WiFi-using app (the watch).
- **WiFi credentials surface.** Today's `/config.py` is plain Python. WiFi credentials in plain text on the device's filesystem is fine for a hobby kit and the LumenFlash wizard already writes config that way — but worth flagging as a "we know" rather than designing security in from scratch. AP-mode captive portal for first-run credential entry is a future idea, not a HAL concern.
- **Drivers folder location.** `python/hal/drivers/` keeps everything hardware-facing under one root. Alternative: a sibling `python/drivers/` (matches the `lib/` convention some MicroPython codebases use). Lean: keep under `hal/` because drivers exist only to satisfy HAL contracts; a thing that isn't part of the HAL doesn't live there.
- **Capability discovery.** How does an app ask *"is there an IMU on this board?"* — `board.sensors.get("imu") is not None`, an explicit `board.has("imu")` predicate, or a `try/except ImportError` on `from hal import sensors`? Lean: dict-with-`None`-values is the simplest, matches how `joystick["slide"]` already works for the slide-switch-or-not case.
- **Should `Network` and `Sensors` be importable directly, or only via `board`?** `board.network` is consistent with everything else and forces the capability check. `from hal import network` would be more ergonomic but encourages apps to assume WiFi exists. Lean: `board`-based access for both, even if it costs a line of boilerplate.
- **Per-driver subpackage vs flat `drivers/`.** A flat folder works at 10 drivers; at 50 it's noise. Defer the question — flat now, group by category (`drivers/imu/`, `drivers/expander/`) once a category grows past three files.

## Notes

- This supersedes the `board.py` sketch in [[esp32-flash-target]] (same idea, more detail) and the `sensors` module sketch in [[sensor-inputs]] (folded into the HAL boundary rather than living parallel to it).
- The hardware shopping list in [[custom-led-panel-board]] (HUB75, IMU, mic, light, capacitive buttons) maps one-to-one onto the backings listed here. The HAL is the seam that lets that product reuse all existing apps unchanged.
- The TS simulator under `web-toolkit/src/lib/simulator/hardware/` is the prior-art for what this looks like in the JS world — and confirms the shape works in practice.
- Today's `joystick` dict + `np.write()` contract is honestly already ~70 % of a HAL — this doc mostly formalises what's implicit and removes the standalone-block duplication so adding hardware variants stops being a per-app cost.
- Risk to watch: HAL designs tend to grow until they describe everything. Keeping it duck-typed (no `abc`), keeping the surface tiny (`Display`, `Button`, `Switch`, sensors), and refusing to add `run()` arguments are the three things that keep this from becoming a framework.
