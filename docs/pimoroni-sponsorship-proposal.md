# LumenLab × Pimoroni — sponsorship proposal

**Audience:** Pimoroni (community / partnerships / marketing)
**From:** Fabio Pigagnelli, with Gina Pigagnelli and Mathias [last name]
**Project:** LumenLab — https://lumen.fabs.au · https://github.com/fabiopigi/lumenlab
**Ask:** three Interstate 75 L kits — board + 32×32 HUB75 panel + sensor add-on (temperature + IMU/gyro) + joystick — for the three team members.

---

## What LumenLab is, in two minutes

LumenLab is an open-source toolkit for **LED-matrix kits running MicroPython on a Raspberry Pi Pico**. It originated around the ZHAW LUMATRIX (Pico + 8×8 NeoPixel + 5-way joystick), and the four browser tools at **lumen.fabs.au** make the path from "idea" to "running on the device" almost frictionless:

- **LumenSimulator** — boot the launcher and run apps in the browser. Virtual joystick, three render modes (flat, realistic LEDs, word-clock letter mask).
- **LumenDesigner** — paint pixels, build multi-frame animations with per-frame timing and fade-in, save to a named library, share via hash-URL, export JSON / PNG, and generate runnable apps (JS + Python) from frame loops.
- **LumenCreate** — two paths from a design to a real app: pure animation (no code) or LLM-assisted interactive app (a bundled prompt for any modern chat model).
- **LumenFlash** — browser-based Pico installer over Web Serial. Pick hardware + apps, plug Pico into USB, click Flash. No Thonny, no command line.

On the device side there are already **13 built-in MicroPython apps**: Pong, Snake, Breakout, Space Invaders, Doom (1D raycaster), DinoJump, Connect 4, Tic-Tac-Toe, FlappyPixels, a reaction-time game, a Simon Says game, a digital clock, and a word-clock letter display. Every app uses a shared lifecycle (loading → app → game-over) and shared joystick / switch input contracts.

The toolkit is already **matrix-size aware**: `shared/hardware-presets.json` defines 8×8, 16×16, 32×8, 8×32, and **32×32** as canonical sizes, and the designer + simulator both read from that list.

---

## Why Pimoroni's Interstate 75 L is a near-perfect fit

The Interstate 75 L is built on exactly the same stack LumenLab is built for — **RP-series MCU + MicroPython + HUB75 LED matrix** — with the additions LumenLab's roadmap has been pointing at for months:

1. **Stack-level alignment.** Pico-class MCU, MicroPython runtime, HUB75 panel driver. Every existing LumenLab app is written against the abstractions that already exist in this stack — joystick polling, NeoPixel-style pixel writes, frame timing, font rendering, button-driven launchers. Bringing them up on Interstate 75 L is a porting job, not a rewrite.

2. **The 32×32 upgrade is already on the roadmap, in writing.** Two of the longest docs in `docs/ideas/` are about exactly this jump:
   - [`docs/ideas/custom-led-panel-board.md`](ideas/custom-led-panel-board.md) — "Custom ESP32 + HUB75 32×32 board with integrated sensors", which *explicitly* names "Pimoroni Interstate 75" as a reference point in the market.
   - [`docs/ideas/esp32-flash-target.md`](ideas/esp32-flash-target.md) — board-abstraction layer (`board.py`) and a board registry so apps stop hardcoding Pico pinouts.

   Pimoroni hardware turns these from "ideas filed in a backlog" into shipped support.

3. **16× the canvas unlocks the next category of apps.** 8×8 covers reaction-time games, Pong, Snake, a clock. **32×32 opens scenes, type, photos, audio-reactive visuals, real animations.** The designer is already configurable for matrix size; the simulator already renders 32×32. The art and the apps follow as soon as a real 32×32 device is in our hands.

4. **The sensor add-on (temp + IMU/gyro) maps directly to a pending idea.** [`docs/ideas/sensor-inputs.md`](ideas/sensor-inputs.md) sketches a sensor abstraction — IMU for tilt/shake input, ambient sensors for adaptive brightness, mic for audio-reactive visuals. Today the doc says "solder one I²C module to the right pad". With Pimoroni's sensor board, **it stops being a solder-it-yourself idea and becomes a first-class input source.** Tilt-controlled marble games, shake-to-reset, temperature-aware ambient displays — all of these become real apps the moment the sensors are there.

5. **The joystick is the one input every existing app already expects.** All 13 built-in apps are written around a 5-way directional + click joystick. Pimoroni's joystick add-on means **no input layer rewrite** for the first wave of ports.

6. **The browser-flash story already works for MicroPython over Web Serial.** `web-toolkit/src/lib/pico/` uses the raw REPL / raw-paste protocol, which is **identical on every MicroPython port**. Anyone who buys an Interstate 75 L could be sent to lumen.fabs.au, click Flash, and have a launcher with games running in under a minute — no Thonny, no `mpremote`, no `pip install`. That's a buyer-experience improvement Pimoroni's customers feel directly.

---

## What we would do with the kits

Concrete, time-bounded — not vague intentions:

1. **Add an Interstate 75 L hardware preset.** Extend `shared/hardware-presets.json` and the LumenFlash device picker. Make "Interstate 75 L + 32×32 panel" a one-click target in the browser flash wizard.

2. **Port the launcher and at least 5 built-in apps to 32×32.** Pong, Snake, Breakout, Watch (clock), and the word-clock LetterDisplay are the natural first picks — they scale up gracefully and each shows off a different aspect of the larger canvas.

3. **Land the `board.py` abstraction.** Resolve `Pin(...)` numbers at import time based on the detected board. Apps written today against the LUMATRIX pinout keep working; the same apps run unchanged on Interstate 75 L.

4. **Ship the sensor input layer end-to-end.** Driver wrappers for the sensors on the add-on board, a `sensors` MicroPython module, and matching simulator UI (virtual tilt control, virtual temperature slider) so apps run identically in the browser sim and on the real device. **Demo apps:** a tilt-marble game, a temperature-reactive ambient display, an audio-reactive visualizer if a mic is in scope.

5. **Write up the bring-up.** A "Getting started with LumenLab on Interstate 75 L" doc with photos, wiring/pin reference, screenshots from the designer, a short video of the launcher running. This becomes content Pimoroni can point customers at.

The three team members (Fabio, Gina, Mathias) each having a unit means we can **develop in parallel**, test multi-device app ideas (one panel mirroring another over WiFi is sketched in the roadmap too), and have a real "second pair of eyes" on every change before it lands in `main`.

---

## What Pimoroni gets back

Sponsorship is a transaction, not a favor. Here's what we'd offer, ordered from low-effort to high-effort:

### Visible credit
- **"Hardware supported by Pimoroni" / logo and link** in the LumenLab README, the lumen.fabs.au footer, and the LumenFlash device-picker UI whenever an Interstate 75 L preset is selected.
- **Product link** from the hardware-preset card directly to the Interstate 75 L page on the Pimoroni shop, so a visitor who likes what they see can buy the board in two clicks.
- **Credit in the per-app `docs/apps/*.md`** for any app whose 32×32 port was made possible by the sponsorship.

### Content
- **A bring-up writeup** Pimoroni can repost on their blog / social: "Open-source LED-matrix toolkit, 13 games, browser flash — running on Interstate 75 L." Photos, short demo videos, the kind of thing that converts to sales.
- **A short demo video per ported app** — vertical-format clips suitable for Instagram / TikTok / Pimoroni's product gallery.
- **Permission to feature LumenLab on the Interstate 75 L product page** as an example of what people can build/run on the board, with a "Try it in your browser" link to lumen.fabs.au.

### Code that helps Pimoroni's ecosystem
- The `board.py` board-abstraction layer and the browser flash flow for Interstate 75 L are **reusable artifacts** — any other MicroPython project targeting Pimoroni hardware benefits from them. All under a permissive license.
- A documented wiring + pin reference for the sensor + joystick add-ons on Interstate 75 L, written for non-experts. Useful to anyone in the Pimoroni community starting out.

### Education / community angle
- LumenLab grew out of the **ZHAW LUMATRIX** workshop kit (a Swiss university). The browser tools were explicitly designed for "students who've never touched MicroPython before". A 32×32 Pimoroni-based variant of the same workshop is a natural extension — we'd be happy to share the workshop format, lesson plans, and any teaching material with Pimoroni for use with educators / makerspaces.

### Optional, if useful to Pimoroni
- Early access to the toolkit additions (Pimoroni reviews the bring-up writeup before publication, etc.).
- A "Powered by Pimoroni" splash / boot animation on the device launcher when running on Interstate 75 L — kept tasteful and skippable, but visible to every user of every kit running our software.
- A named **Interstate 75 L Launcher** firmware bundle Pimoroni can link to directly from their docs, where the entire experience is preconfigured for that board.

---

## Why us, specifically

- The repo is **active and shipping**, not aspirational — see the commit log. The hosted toolkit at lumen.fabs.au is live today.
- The team is three people with complementary skills: software (Fabio), hardware/maker experience (Mathias), and a non-technical user perspective (Gina) — exactly the audience the Interstate 75 L is aimed at. If Gina can flash and play, anyone can.
- The toolkit is **already opinionated about ease of use**. Browser-based flash, browser-based design, AI-assisted app authoring, simulator-before-hardware — all of this is the kind of experience Pimoroni's customers expect from finished, polished hardware. We don't need to be convinced to build for that audience; we already are.
- LumenLab is **open source, MIT-spirited, no commercial agenda**. Sponsoring us doesn't tie Pimoroni into a product relationship — it ties them into a community one.

---

## The ask, concretely

| Item | Qty | For |
|---|---|---|
| Interstate 75 L board | 3 | Fabio, Gina, Mathias |
| 32×32 HUB75 panel | 3 | one per board |
| Sensor add-on (temperature + IMU/gyro) | 3 | one per board |
| Joystick add-on | 3 | one per board |

Shipping address: [to be confirmed with Pimoroni once they're in].

If a subset is easier (e.g. one full kit + two boards-only, or a single combined "review kit"), we can make that work — even one kit unblocks the bring-up work.

---

## Closing

The Interstate 75 L is the board LumenLab has been informally designing toward for over a year. Three units in our hands turn a long-standing "wild idea" doc into a shipped, documented, demoable port — with public credit, content, and code flowing back to Pimoroni. Happy to answer questions, jump on a call, or share more of the repo / hosted toolkit on request.

— Fabio, on behalf of the LumenLab team
