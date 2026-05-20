# Idea Backlog

A parking lot for ideas — from concrete next steps to wild, unplanned thoughts worth keeping in mind. Not a roadmap. Nothing here is committed.

Each idea lives in its own file. Use [`_template.md`](_template.md) when adding a new one. Filenames are `kebab-case.md`.

## Status legend

- **raw idea** — just a spark, not thought through
- **exploring** — poking at feasibility / shape
- **shaping** — direction is clear, details being figured out
- **ready** — could be picked up and built

## Index

| Idea | Hook | Status | Tags |
| --- | --- | --- | --- |
| [Local design storage](local-design-storage.md) | Save, open, and manage multiple designs in the browser | raw idea | web-toolkit, lumen-designer, ux, persistence |
| [LED (realistic) render mode](led-render-mode.md) | Third render mode that mimics how the physical LUMATRIX looks | raw idea | web-toolkit, lumen-designer, simulator, rendering |
| [Generate app from design](generate-app-from-design.md) | Deterministic JS + PY codegen from animated designs — no LLM needed | raw idea | web-toolkit, lumen-designer, simulator, flash, codegen |
| [ESP32 as a flash target](esp32-flash-target.md) | Add ESP32 alongside the Pico, keep MicroPython, abstract pins per-board | raw idea | hardware, flash, micropython, esp32, portability |
| [Share design via URL](share-design-via-url.md) | Encode a design into a link so opening it loads the design — no server | raw idea | web-toolkit, lumen-designer, sharing, ux |
| [Sensor inputs on the LUMATRIX](sensor-inputs.md) | Solder a sensor to exposed GPIO pads; expose cleanly in apps + simulator | raw idea | hardware, micropython, simulator, apps, input |
| [Custom ESP32 + HUB75 32×32 board](custom-led-panel-board.md) | Wild: finished-product LED panel — preflashed, sensored, 32×32, but open underneath | raw idea | wild, hardware, product, esp32, hub75, sensors, business |
| [Mobile swipe controls](mobile-swipe-controls.md) | On touch devices, swipes drive the existing JoyButton interface | raw idea | web-toolkit, simulator, mobile, ux, input |
| [Letter mask generator](letter-mask-generator.md) | Separate tool that solves the mask layout from required phrases; SVG export for fabrication | raw idea | web-toolkit, letter-mask, wordclock, generator, svg, fabrication |

<!-- When adding an idea:
1. Copy _template.md to <slug>.md
2. Fill it in
3. Add a row to the table above linking to the file
-->
