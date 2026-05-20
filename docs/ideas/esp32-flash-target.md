# ESP32 as a flash target

**Status:** raw idea
**Tags:** hardware, flash, micropython, esp32, portability

## What

Make the toolkit able to flash and run on ESP32-family boards in addition to the Raspberry Pi Pico. Ideally keep MicroPython as the shared runtime so app code stays portable, with a thin board-abstraction layer for the things that genuinely differ (pin numbers, firmware install path, maybe peripherals).

## Why

ESP32 is cheap, plentiful, and opens doors the Pico doesn't: WiFi and BLE built in, more RAM, a faster CPU, and (on most variants) hardware NeoPixel/RMT support that's actually friendlier than the Pico's PIO. Concretely it would let LumenLab grow into things like:

- A web-controlled board: drive animations from the simulator/designer over WiFi.
- NTP-synced clock/watch apps without an external time source.
- OTA app updates instead of plugging in a USB cable.
- Cheaper / easier kits for workshops where students provide their own ESP32.

It's also just a passion thing — supporting a second target keeps the codebase honest about what's board-specific vs. truly portable.

## Sketch

Feasibility check first:

- **MicroPython on ESP32:** officially supported, mature, includes a `neopixel` module (in fact more first-class than on the Pico). So yes — feasible.
- **The current flash transport already ports for free.** `web-toolkit/src/lib/pico/` uses Web Serial + MicroPython's raw REPL / raw-paste to upload `.py` files. That protocol is identical on every MicroPython port — an ESP32 already running MicroPython would just work with the existing uploader.
- **What's actually different is firmware install.** Pico = drag-and-drop UF2 onto a mass-storage volume. ESP32 = `esptool` flashing the `.bin`. The browser equivalent exists (`esptool-js` does ESP32 firmware flashing over Web Serial), so a one-click "install MicroPython on this ESP32" step is doable in the same `/flash` wizard.

Likely shape of the work:

- **Rename / reshape `lib/pico/`** into something board-agnostic (`lib/device/` or `lib/micropython/`) since the raw-REPL/raw-paste code isn't Pico-specific. Keep Pico- and ESP32-specific bits in subfolders.
- **Add a board registry** describing each supported target: display name, USB VID/PID hints for Web Serial picker, firmware install method (UF2 vs esptool-js), default pinout for NeoPixel + buttons, any per-board quirks.
- **Pinout abstraction in Python apps.** Today apps hardcode `Pin(19)`, `Pin(3)`, etc. Move those into a small `board.py` module that resolves to the right GPIOs at import time based on the detected board. Apps stay portable.
- **Two-step flash wizard:** "Install MicroPython firmware" (board-dependent) → "Upload apps" (same code path everywhere).
- **Document supported ESP32 variants** explicitly (ESP32, ESP32-S2/S3/C3 differ on USB CDC, RMT, pin counts).

New features that *could* live on top once ESP32 is a target — out of scope for this idea but worth knowing they unlock:

- WiFi-pushed designs / live preview from the designer.
- BLE control from a phone.
- OTA app updates.

## Open questions

- **Which ESP32 variant(s) to support first?** Plain ESP32 (cheapest, no native USB), ESP32-S3 (native USB CDC, friendlier for Web Serial, currently the "good default"), or commit to multiple from day one?
- **One firmware build or many?** Each ESP32 variant needs a different MicroPython firmware binary. Host them in-repo, fetch from `micropython.org` at flash time, or let the user point at a `.bin`?
- **Hardware spec for the LUMATRIX-equivalent on ESP32:** what's the "reference" wiring? Document a recommended pinout (NeoPixel data pin, buttons) so apps written for ESP32 share a baseline.
- **`board.py` shape:** runtime detection (read `sys.platform` / `machine.unique_id`) or build-time selection at flash time? Runtime is more flexible but adds a tiny startup cost.
- **Does the designer's "Generate app" emitter ([[generate-app-from-design]]) need to know the board?** Probably not if `board.py` handles pins — the generated app stays board-agnostic. Worth confirming.
- **Bootloader / reset UX:** Pico's BOOTSEL is well-known; ESP32 boot mode (hold BOOT, tap RST) is fiddlier and varies by board. Can the wizard auto-enter download mode via Web Serial DTR/RTS pulses? (esptool-js does this — investigate.)
- **Power:** how many NeoPixels can the chosen ESP32 board comfortably drive from USB before needing external power? Document per-board limits.
- **Scope creep risk:** keep this idea focused on "ESP32 as a target with the same app contract" — the WiFi/BLE/OTA features are separate ideas that *build on* this one.

## Notes

- Today's transport: `web-toolkit/src/lib/pico/` (Web Serial + raw REPL). Pico-specific naming, but the protocol is portable.
- Firmware-install path for ESP32: `esptool-js` (browser port of `esptool`) supports Web Serial; the official Adafruit / Espressif web installers use it.
- Hardcoded pins to abstract: see e.g. `python/apps/letters.py:173` and surrounding lines.
- Related: this is a prerequisite for any "WiFi-controlled board" or "OTA updates" idea — those probably each deserve their own entry once this lands.
- Related (companion): [[generate-app-from-design]] benefits from `board.py` so generated PY stays board-agnostic.
