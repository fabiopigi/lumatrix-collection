# Color palettes for the designer

**Status:** raw idea
**Tags:** web-toolkit, lumen-designer, ux, palette, persistence

## What

Replace LumenDesigner's single hardcoded swatch grid with a **palette dropdown** that lets you switch between three palette sources: the built-in default for the current color mode, an auto-computed "used on canvas" palette, and named custom palettes you can save and reload from local storage.

## Why

The current swatch grid is one fixed list per color mode (`RGB_PALETTE` / the per-mode arrays in `web-toolkit/src/lib/pixel-designer/palette.ts`). That's fine to start painting, but it gets in the way the moment you care about a *specific* set of colors:

- Iterating on a design with a curated palette (e.g. a retro 8-color scheme, a brand palette, a Lospec palette) means hunting the right hex in the color picker every time.
- Once you've placed those colors, going back to tweak — picking the *exact* shade you used on page 3 — is awkward; you have to eyedrop from the grid or re-type a hex.
- Sharing aesthetic consistency across multiple designs (or pages within a design) requires re-discovering the same palette manually.

A dropdown of palette sources turns the swatch grid from "the colors the mode allows" into "the colors *this design* is about", which is what most pixel-art tools converge on.

## Sketch

The swatch grid stays exactly where it is in `side-panel.tsx` — only its **source** becomes selectable. A small dropdown above the grid picks one of:

- **Default** — the current per-color-mode palette from `COLOR_MODES[mode].palette`. Today's behavior, unchanged.
- **Used on canvas** — auto-derived: walk every page (and every variant) of the current design, collect distinct non-black pixel colors, sort by frequency or by hue. Refreshes as you paint. Great for "give me back the colors I'm already using".
- **Custom** — user-named palettes saved to `localStorage`. CRUD: **Save current as…**, **Rename**, **Delete**, **Duplicate**. The dropdown lists each saved palette by name.

A few details that probably matter:

- "Save current as custom" should also be available from the *Used on canvas* view, so the natural workflow is: paint freely → switch to *Used on canvas* → "Save as…" → it becomes a reusable custom palette.
- Custom palettes are global to the browser (like local design storage), not embedded in the design JSON — but see the open question below.
- Keep the existing "pick any hex" color input next to the swatch grid as the always-available escape hatch.

Likely storage shape (mirrors [[local-design-storage]]):

```
lumendesigner:palettes -> [
  { id, name, colors: ["#rrggbb", ...], createdAt, updatedAt }
]
```

## Open questions

- **Embedded vs. global custom palettes:** is a custom palette tied to the *design* (saved inside the design JSON, travels via export / share-link) or to the *browser* (saved in localStorage, available across designs)? Probably both: a design can pin a palette, and pinned palettes also show up in the global list. Needs thinking about merge / dedupe semantics.
- **"Used on canvas" scope:** current page only, current variant, or the whole design (all pages × all variants)? Default to whole-design but offer a toggle?
- **Sort order for "Used on canvas":** by frequency (most-painted first), by hue (rainbow), or by first-appearance (page-1 reading order)? Each has a use case.
- **Max swatches:** the current grid is `grid-cols-8` with ~32 swatches. Custom palettes are often 16 / 32 / 64. Allow overflow with a scroll, or cap the grid and let the user trim?
- **Schema versioning:** add `schemaVersion` to the localStorage shape from day one, same as the design-storage idea suggests.

## Notes

- Today's palette code: `web-toolkit/src/lib/pixel-designer/palette.ts` (`RGB_PALETTE`, `COLOR_MODES`, `getPalette`, `getDefaultColor`). The swatch grid UI is at `web-toolkit/src/app/designer/_components/side-panel.tsx` around the `props.palette.map(...)` block.
- Strong pairing with [[local-design-storage]]: same storage pattern, same dirty-state / rename / delete UX vocabulary. Worth aligning the two so users learn the pattern once.
- Mild risk: an unbounded palette list could blow up the side panel's height. A scroll region inside the *Colors* section is probably enough; otherwise collapse to a "Manage palettes…" modal once the count gets large.
