# LED (realistic) render mode

**Status:** raw idea
**Tags:** web-toolkit, lumen-designer, simulator, rendering, visual

## What

Add a third render mode to the designer and simulator alongside the existing **Pixel** (flat squares) and **Letter mask** (letter cutouts) modes: an **LED** (or **Realistic**) mode that approximates how the LUMATRIX actually looks in real life — bright LED hotspot in the middle of each cell, color diffusing outward through the acrylic, slightly darker toward the edges of the cell.

## Why

The current Pixel mode shows each cell as a uniform saturated square, which is a clean *design* view but misleading as a *preview*: the physical hardware has a clear bright spot at the LED chip and the color fades toward the cell edges through the diffuser. Designs that look great in the browser sometimes read differently on the real board (especially colors that get washed out near the hotspot or contrast that disappears with the bloom). A realistic mode would let you check "what will this actually look like" without uploading to the device.

It's also just nice to have a render that *feels* like the real thing — good for sharing screenshots, demos, and AUTHORING-style docs.

## Sketch

Per cell, layer something like:

- **Base color** — the LED color, slightly desaturated/dimmed (the diffuser eats some saturation toward the edges).
- **Hotspot** — a small bright radial gradient at center; near-white for high brightness, more tinted for dim/colored LEDs.
- **Edge falloff** — gradient gets darker toward the corners of the cell (matches the photo: corners read noticeably dimmer).
- **Subtle bloom** — optional soft glow bleeding a few px beyond the cell, bounded so neighbors don't smear. CSS `filter: blur(...)` on an overlay layer or a stacked radial gradient.
- **Off-state** — not pure black; a very dark version of the matte/diffuser background, maybe with a faint cell outline like the photo shows.

Implementation options, roughly cheapest to fanciest:

- **Stacked CSS radial gradients per cell.** Probably enough for 8×8. One element, multiple `background-image` layers. Fast, no canvas.
- **SVG with radial gradients + Gaussian blur filters.** More control over bloom and shape, still declarative.
- **`<canvas>` / WebGL shader.** Best fidelity (real additive blending, per-LED brightness response), but real complexity. Only worth it if the gradient approach hits limits or we ever push to larger matrices.

Both the designer and the simulator should share the renderer — it's the same visual primitive.

## Open questions

- **Naming:** "LED" (short, matches what it is) vs "Realistic" (describes intent) vs "Preview". Lean LED.
- **Hotspot tint:** always near-white, or tinted by base color? In the photo blue and red LEDs still have *very* light hotspots — cameras blow out, eyes do too — so near-white is probably more accurate.
- **Brightness modeling:** real LEDs at low brightness shrink the hotspot and look much more diffuse. Worth modeling if/when we support a global brightness slider, or skip for v1?
- **Bloom between cells:** does light bleed into neighbors on the real device? Probably a little. Whether to model it depends on how clean the preview should feel — bloom is pretty but can make small designs look mushy.
- **Off-state appearance:** match the milky-acrylic look in the photo, or keep "off" cells very dark for contrast?
- **Editability in LED mode:** is the designer canvas still clickable/interactive in this mode, or is it preview-only and editing happens in Pixel mode?
- **Performance:** 64 cells is trivial, but the simulator runs at animation framerates — gradient-heavy CSS is usually fine, just confirm before committing to the approach.

## Notes

- Existing modes: **Pixel** (flat squares) and **Letter mask** (letter cutouts) — defined in `web-toolkit/src/app/simulator/_components/mode-toggle.tsx` and the pixel-designer side panel.
- Reference photo of the physical LUMATRIX showing the hotspot/falloff pattern this mode should mimic.
- Related (future): an even fancier "photographic" mode with the acrylic plate, screws, and slight glare — probably overkill, but noting it ([[photographic-render-mode]] — not written yet).
