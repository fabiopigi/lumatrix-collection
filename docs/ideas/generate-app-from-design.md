# Generate app (JS + PY) directly from a design

**Status:** shipped (PR #19)
**Tags:** web-toolkit, lumen-designer, simulator, flash, codegen, ux

## What

A "Generate app" action in LumenDesigner that takes a multi-page (animated) design and emits both:

- a **JS module** matching the simulator's user-app contract (`NAME` + `run` exports), registered as a custom app in the simulator, and
- a **Python module** matching the flash app contract under `python/apps/`, ready to flash to the device.

For purely frame-based animations — no game logic, no input — the user shouldn't need to involve an LLM at all. A small deterministic generator can produce both files from the design JSON.

## Why

Today, even the simplest animation (e.g. "show these 8 frames in a loop, each for 200 ms") requires asking an LLM to write the JS/PY. That works but is overkill, inconsistent, and adds friction to the most common path. A direct codegen path makes the designer feel like an *authoring tool* end-to-end: design → run, with no shell or chat in the middle.

LLM-driven authoring stays valuable for things with real logic (input, state, procedural patterns); codegen just removes it from the trivial case.

## Sketch

LumenDesigner already serializes designs to JSON (config + per-page pixel data + palette + color mode + page durations, if pages have them). A generator can walk that structure and emit two flavors of the same shape:

```
NAME = "<design name>"
FRAMES = [ <packed pixel data per page> ]
DURATIONS_MS = [ <per-page>, ... ]

run():
  loop frames forever, render frame, sleep duration
```

JS side:

- Generator outputs an ES module string conforming to the existing `UserAppSource` / `App` types in `web-toolkit/src/lib/simulator/user-apps.ts`.
- Hand it directly to the existing user-app loader — no new runtime plumbing needed.
- Show up in the simulator's app list alongside built-ins and other user apps.

Python side:

- Generator outputs a `.py` file matching the shape of `python/apps/*.py` (look at one of the existing simple apps for the template — `watch.py` or `letters.py` are probably closest to "render a sequence").
- Surface via the existing `/flash` route — either downloadable as a file, sent over the existing flash transport, or both.

Generation itself is a pure function: `design → { js, py }`. Same source of truth, two emitters. Worth a small set of golden-file tests so output stays stable.

## Open questions

- **Scope of what generates cleanly:** confirmed = frame sequences (multi-page designs with durations). Out of scope = interactivity, game logic, procedural patterns — those stay LLM-or-hand-written. Where do we draw the line, and how does the UI communicate it?
- **Naming:** prompt for app name on generate, or default to the design's name? What happens if a custom app with that name already exists — overwrite, version-suffix, prompt?
- **Round-trip / regenerate:** if the user edits the design and hits "Generate" again, do we update the existing custom app in-place (by id) or create a new one? Probably in-place with a "regenerated from design X" marker.
- **Looping behavior:** loop forever (default), play once, ping-pong? Surface as an option on the design or on the generate action?
- **Frame durations:** per-page (already a concept?) or one global tempo at generate time? Check what LumenDesigner stores today.
- **Letter-mask designs:** do they generate as letter-mask apps on the device too, or get rasterized to plain pixel frames? (The Python side likely needs to know.)
- **Color mode / palette parity:** ensure JS and PY emitters produce visually identical output — same gamma, same color-mode handling. Worth a snapshot test that compares simulator render vs. a reference for a known design.
- **Memory footprint on device:** 8×8 × N frames is tiny, but if matrices grow or frames multiply, the PY emitter may want to pack pixel data (bitfields, indexed-palette) rather than dump full RGB tuples.
- **File delivery for PY:** drop into `python/apps/` in the repo (dev workflow), download as `.py` (manual flash), or push via the existing flash transport (one-click). Probably all three eventually, but which first?
- **Export the source vs. only register the app:** does the user see and can edit the generated code, or is it opaque? Showing it is a nice on-ramp from "drag-and-drop animation" to "hand-edited app".

## Notes

- Existing infra to lean on:
  - `web-toolkit/src/lib/simulator/user-apps.ts` — user app source/loader contract, blob-URL dynamic import, localStorage key `lumatrix.userApps.v1`.
  - `web-toolkit/src/lib/simulator/launcher.ts` — how apps get listed/launched.
  - `python/apps/*.py` — reference shape for the PY emitter; the simplest existing apps are the best templates.
  - `web-toolkit/src/app/flash/` — existing route for getting code onto the device.
- Related: this is a natural companion to [[local-design-storage]] — once designs are saved locally, "Generate app" from any saved design becomes a one-click flow.
- Related (future): generator for *parameterized* animations (e.g. "scroll this design across the matrix at speed N") — sits between "frame sequence" and "real logic". Might deserve its own idea later.
