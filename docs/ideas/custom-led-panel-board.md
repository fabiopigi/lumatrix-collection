# Custom ESP32 + HUB75 32×32 board with integrated sensors

**Status:** raw idea
**Tags:** wild, hardware, product, esp32, hub75, sensors, business

## What

A purpose-built LED panel product: an **ESP32-based controller board** mated to a **HUB75 32×32 P4 panel** (~128 mm, ~5 in), with **pre-populated sensors** (IMU, mic, light, maybe more), running the same MicroPython app contract as the current LUMATRIX so designs and apps port across.

Two audiences in one device:

- **Non-technical buyer:** plug in USB-C, preflashed firmware boots an app picker, designs/apps push from the browser. No soldering, no Python, just *the experience*.
- **Technical buyer:** same device, but every layer is open — write your own apps, reflash firmware, use the sensors, hook into WiFi/BLE. Headroom that the cheap consumer products don't give.

The pitch: a **feature-rich LED panel that's actually easy for anyone**.

## Why

The current LUMATRIX is a workshop kit — wonderful for that, but it ships as bare parts, an 8×8 grid, a Pico with no wireless, and no sensors. The interesting things people *want to do with* a smart LED panel — audio-reactive visuals, ambient displays, tilt-controlled games, web-controlled artwork — all require building a custom thing on top.

If the toolkit's authoring/simulator/flash story is already strong (designer, simulator, codegen, share-by-link, ESP32 support), the bottleneck becomes hardware. A purpose-built board removes that bottleneck:

- **32×32 vs 8×8** is roughly 16× the canvas — opens type, scenes, photos, real animations.
- **HUB75 panels are cheap, mature, plentiful.** P4 32×32 modules exist in volume from many manufacturers.
- **ESP32 brings WiFi/BLE/OTA**, which unlocks share-via-network, remote control, and updates over the air.
- **Sensors pre-populated** means audio-reactive / tilt / ambient apps are first-class out of the box.
- **Business angle:** if this stack also runs a healthy software ecosystem (designer, gallery, app sharing), it's a product, not just a board.

## Sketch

**Hardware (high level):**

- **MCU:** ESP32-S3 (native USB CDC, dual-core, lots of RAM, good for HUB75 DMA). Possibly an external PSRAM module.
- **Display:** HUB75 P4 32×32 panel via the standard 16-pin ribbon. Drive lines through a level-shifter (74AHCT245 / SN74) since HUB75 panels expect 5 V.
- **Power:** USB-C (5 V) for development; 5 V barrel jack for full-brightness. 32×32 = 1024 LEDs can theoretically pull tens of amps at white-full-bright, but real-world animations are far lower — needs honest power budgeting in firmware (a software brightness cap by default).
- **Sensors (pre-populated):** IMU (6-axis or 9-axis), I²S MEMS microphone, ambient light sensor. Maybe a Qwiic/STEMMA-QT connector for expansion.
- **Buttons:** at least 4 user buttons + reset/boot. Possibly capacitive touch pads on the PCB.
- **Optional:** an SD card slot for design libraries / longer animations; a small speaker / piezo for feedback.

**Firmware:**

- MicroPython on ESP32-S3. Same app contract as today's LUMATRIX so [[generate-app-from-design]] output runs unchanged.
- HUB75 driver: this is the spicy bit. C++ libraries are mature (`ESP32-HUB75-MatrixPanel-DMA`); MicroPython support is thinner. Likely need a native module (built into a custom MicroPython firmware) to get the refresh rates needed without flicker.
- Preflashed app launcher: boots to a built-in menu, shows installed designs/apps, supports flashing new ones over USB or WiFi.

**Software (browser side, mostly free):**

- LumenDesigner already supports configurable matrix sizes — should "just work" at 32×32 with minimal changes, especially since [[led-render-mode]] would already be making realism scale-aware.
- Simulator extends to HUB75-style rendering (no diffuser hotspot — these panels look different from NeoPixel; smaller pixels, less diffusion, more like a tiny screen).
- The flash wizard already speaks Web Serial + MicroPython raw REPL — same transport works.
- WiFi push from the designer becomes possible — "send to my panel" without a cable.

**Distinguishing positioning vs. existing market:**

- Cheap Chinese pixel-art frames exist but are closed, locked to proprietary apps, limited animation libraries.
- DIY HUB75 setups (Pimoroni Interstate75, Adafruit Matrix Portal) exist but are clearly maker-targeted, no integrated sensors, no companion software story.
- The wedge: **finished-product polish on the consumer end, full openness underneath, with a real authoring and sharing experience.**

## Open questions

- **MicroPython vs ESP-IDF/Arduino at the firmware level?** MicroPython keeps app-author UX consistent with current LUMATRIX but HUB75 native support is weaker. C++ with a small MicroPython app-runner layered on top might be the realistic middle ground.
- **HUB75 panel quality varies a lot.** Sourcing matters — color uniformity, dead pixels, viewing angles. Need a "blessed" supplier or batch testing.
- **BOM cost vs target price:** ESP32-S3 + HUB75 P4 32×32 + decent sensors + PCB + diffuser + power supply — what's realistic? What's the price point where this is "buy it as a gift" vs. "buy it for yourself"?
- **Diffuser/enclosure:** raw HUB75 looks great close-up but harsh; a diffuser softens it. Do we ship one (cost, mold tooling) or leave it bare?
- **Software refresh:** HUB75 is PWM-scanned — refresh rate vs color depth vs CPU usage is a real tradeoff. What's the quality bar (e.g. ≥120 Hz refresh, ≥8-bit per channel)?
- **Regulatory / compliance** if commercial (FCC, CE, RoHS). Real costs and timeline.
- **Scope of "easy":** how much does the panel do out of the box without a phone/computer? An offline app picker driven by buttons covers a lot. Companion app (web or native) for new designs.
- **OTA story:** does the panel pull updates from a hosted catalog, or only when the user explicitly pushes? Both have UX implications.
- **Naming.** "LumaPanel"? "LumaMatrix 32"? Avoid trademark collisions early.
- **Open hardware?** Publish schematics + firmware under a permissive license — encourages community, doesn't gate the business if the value is in the polish + ecosystem + software.

## Notes

- This is the wildcard — captured here because the backlog explicitly welcomes "ideas worth keeping in mind even if unplanned". Whether it becomes a side project, a product, or just inspiration for the open-source kit is itself an open question.
- Strong synergy with already-captured ideas: relies on [[esp32-flash-target]] for the firmware path, supersedes [[sensor-inputs]] (pre-populated instead of solder-your-own), and the chaining idea that didn't fit the Pico becomes feasible here (WiFi/BLE between panels).
- The current designer is *already* configurable for matrix size, color mode, and LED layout per `docs/pixel-designer-usage.md` — the 32×32 jump may need less work than it sounds.
- Worth a separate companion idea later: the **software/ecosystem** side (gallery, accounts, OTA app delivery) is its own large topic and deserves its own file once the hardware idea is anything more than aspirational.
