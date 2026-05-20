# Sensor inputs on the LUMATRIX

**Status:** raw idea
**Tags:** hardware, micropython, simulator, apps, input

## What

Support reading sensors wired to the LUMATRIX's exposed GPIO pads — accelerometer, microphone, light sensor, etc. — and expose them cleanly as input sources in both the on-device app contract and the simulator. Apps gain a whole new category of input beyond buttons: tilt-controlled games, audio-reactive animations, ambient-light-aware brightness.

## Why

Today's apps only respond to button presses. Frame-loop animations and button-driven games cover a lot, but the device is sitting in the physical world and currently can't perceive any of it. A small set of sensors unlocks:

- Audio-reactive animations (mic → spectrum / level meter / beat-pulse visuals).
- Tilt or shake input (accelerometer → marble games, "shake to reset", orientation-aware UI).
- Ambient brightness adaptation (light sensor → auto-dim at night, no more retina-burn).
- Approach/proximity triggers.

The hardware path is reasonable: the LUMATRIX exposes all unused GPIOs as solder pads, so adding a sensor is "solder one I²C/analog module to the right pads". The ecosystem cost is in software — defining the abstraction, simulator mocks, and a small library of "bless" sensors with known wiring.

## Sketch

**Hardware side:**

- Document the available pads and which are usable for what (I²C, SPI, ADC, plain GPIO).
- Pick a small set of "blessed" sensors with recommended wiring — e.g. one IMU (MPU-6050 or LSM6DS), one I²S/analog mic (MAX9814 / INMP441), one ambient light sensor (BH1750 or TSL2591). Driver code in `python/lib/`.
- Provide a wiring reference per sensor: which pads, pull-ups, power.

**Software side (device):**

- A tiny `sensors` module exposing whatever's been wired/configured. Apps opt in: `from sensors import imu` etc.
- Per-board sensor config (which sensors are wired) so apps can probe at startup. Natural overlap with the `board.py` abstraction sketched in [[esp32-flash-target]].
- Same API shape regardless of board — if a sensor isn't present, the read returns `None` (or raises) so apps can degrade gracefully.

**Software side (simulator):**

- Input panel in the simulator UI for each sensor type: a virtual joystick for accel, a slider for light level, a "tap to pulse" for mic level (or feed a real mic via Web Audio if available — bonus).
- Apps run identically in sim and on-device; the simulator just synthesizes sensor values from UI.

## Open questions

- **Which sensors first?** IMU is probably highest leverage (enables a whole class of games). Mic is the most "wow" demo. Light is the most "obviously useful". Pick one or all three?
- **Calibration:** accelerometer needs zero-offset calibration per device; mic needs noise-floor sampling. Where does that live — first-run wizard, per-app, or a global "calibrate sensors" screen?
- **Real-time mic in the simulator:** ask for mic permission and feed the actual signal in (most realistic), or always synthesize? Permission prompt feels heavy for the casual case — synthesize by default, opt-in to real mic.
- **Sensor presence at runtime:** how should apps that *require* a sensor behave when it's not wired? Refuse to launch, run in a degraded mode, or show a wiring help screen?
- **Wiring documentation format:** photos of solder points, a Fritzing-style diagram, or just a labeled pinout table? (LUMATRIX docs already lean on tables — keep it consistent.)
- **Power draw / noise:** some sensors (mic preamps especially) are noisy neighbors to NeoPixel data lines. Worth a "known good" wiring guide that accounts for this.

## Notes

- This is the incremental, "solder-it-yourself" path to sensor support on existing hardware. The much bigger version of this idea — sensors pre-populated on a custom board — lives in [[custom-led-panel-board]].
- Sensor abstraction overlaps with the `board.py` work proposed in [[esp32-flash-target]]; both should share the same per-board config mechanism.
- A natural app category opens up here: ambient / data-driven displays. Possibly its own idea later.
