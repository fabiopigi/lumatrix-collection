# Sprite library: themed sets, multiple sizes, colourful sprites

**Status:** raw idea
**Tags:** web-toolkit, lumen-designer, sprites, symbols, assets, attribution

## What

Promote the existing Symbols panel into a proper **sprite library**: multiple named sets (monotone vs. colourful, multiple sizes — 8×8, 16×16, 32×32 — and themed packs like *Emoji*, *Game*, *UI*, *Holiday*, …). Each set has metadata (name, size, attribution if needed) and a thumbnail strip; the panel gets a set picker on top, the sprite grid below. Sprite data comes from **hardcoded sprite-sheet PNGs** the maintainer drops into the repo plus a tiny JSON manifest per set.

## Why

Today's Symbols section is a single flat list of ~18 hand-typed monochrome glyphs. That's enough for "draw a heart on an 8×8" but it caps the designer's range:

- **No room for breadth.** Adding more glyphs just makes the flat list scroll forever.
- **Monochrome only.** A "Pikachu" or a "Mario mushroom" needs real colour, not the active brush colour.
- **Locked to ~5×5.** Larger LUMATRIX-compatible hardware (16×16, 32×32 panels) gets the same tiny stamps. A 32×32 panel should have access to 32×32 sprites that fill the canvas.
- **No path to licensed packs.** Lots of beautiful pixel-art packs exist (Lospec, itch.io, OpenGameArt); some are CC, some purchased, all need attribution. There's no current shape for shipping a set with credit.

A set-based library fixes all four. Sets are independent, can be added incrementally, and the panel's existing "click sprite → stamp it on the grid" interaction stays exactly the same.

## Sketch

Three pieces: data shape, UI shell, runtime loader.

### Data shape

A **set** is a sprite sheet PNG + a JSON manifest. The PNG is a fixed grid of cells (no padding — keep it simple); the manifest names them.

```ts
// e.g. web-toolkit/public/sprites/8x8-emoji/manifest.json
{
  "id": "8x8-emoji",            // stable id; used in localStorage / URL
  "name": "Emoji (8×8)",        // display name in the dropdown
  "size": 8,                    // square; cell size in pixels
  "colorful": true,             // true = stamp uses sprite's own colours
                                // false = stamp uses active brush colour
  "sheet": "/sprites/8x8-emoji/sheet.png",
  "columns": 16,                // sprites per row in the sheet
  "license": "CC BY-NC 4.0",    // optional
  "attribution": "Author — https://…", // optional
  "sprites": [
    { "name": "smile",   "row": 0, "col": 0 },
    { "name": "heart",   "row": 0, "col": 1 },
    …
  ]
}
```

Why row/col instead of just an index? Easier to author, easier to debug, and reordering the sheet doesn't shuffle every sprite's id. The same `name` field is the stable id — never expose row/col to the user.

Built-in (today's) hand-typed sprites become a **first-class set** of their own: `{ id: "5x8-mono-classic", name: "Classic (mono)", size: 8, colorful: false, … }`. No PNG — for this one set the data is the existing `.`/`X` strings, normalised to 8×8 with padding. Keeps the shipped panel non-empty in any environment, even before any PNG packs land.

### Loader

Two paths feed `SpriteSet` objects into the panel:

1. **Built-in (no PNG):** the legacy `.`/`X` strings, converted to a `SpriteSet` at module load with `colorful: false`.
2. **PNG-backed:** load the sheet PNG once, decode into a `HTMLCanvasElement` (or `ImageBitmap`), and for each manifest entry slice out a `size × size` `(string | null)[]` of hex colours — same shape the stamp tool already consumes. Fully-transparent pixels become `null`; semi-transparent → snap to opaque or drop (open question).

Async loading: each set goes from "registered" → "loaded" → "ready". The panel can render the set's name + a placeholder shimmer while pixels decode; once ready, the thumbnails fill in. Caching is implicit (browser HTTP cache for the PNGs, and decoded pixel arrays stay in memory for the session).

### UI

The current Symbols `<Section>` body becomes a two-row layout:

- **Top:** set picker — a `<select>` of available sets, grouped by size:
  ```
  ── 8×8 ──
  Classic (mono)
  Emoji
  Game
  ── 16×16 ──
  Game
  ── 32×32 ──
  Holiday
  ```
- **Below the picker:** the grid of sprites for the active set. Same `flex flex-wrap` of clickable thumbnails as today, just sourced from the active set's data.
- **Below the grid:** when the active set has attribution metadata, a one-liner like `Emoji (8×8) · CC BY-NC 4.0 · Author Name ↗`. Compact, optional, and a link if a source URL is given. This satisfies the "must credit" obligation without owning a whole "About" modal.

A small footnote affordance: the panel's `hint=` could carry the size, e.g. `Sprites (8×8) — click then click grid`, so the user always knows what they're stamping.

### Hardware fit

A 16×16 sprite on an 8×8 hardware doesn't fit. Three options:

- **Hide** sets larger than the active variant. Simple, but the user has to re-open the dropdown after switching variants. Probably best.
- **Show but disable**, with a tooltip "needs 16×16 hardware". Discoverable, but adds visual noise.
- **Allow with auto-scale-down** (nearest-neighbour). Pretty results vary wildly; defer.

Lean towards Hide for v1. The variant picker is right there in the header — the user can switch to a 16×16 variant if they want the bigger sets.

### Persistence

Remember the last-picked set per *size* in localStorage:
```
lumen-designer:sprite-set -> { "8": "8x8-emoji", "16": "16x16-game", … }
```
Switching the active variant from 8×8 to 16×16 then auto-jumps the picker to the user's last 16×16 set. Same logical "where was I" the design library + palette library do.

### Worked example: how a new set lands

The maintainer drops three files into the repo:

1. `web-toolkit/public/sprites/8x8-emoji/sheet.png` (a 16-column sheet)
2. `web-toolkit/public/sprites/8x8-emoji/manifest.json` (as above)
3. One-line append to `web-toolkit/src/lib/pixel-designer/sprites/index.ts` registering the set id.

No code changes. No build-time wiring beyond that index registration (and even that could be a `import.meta.glob` on the manifests if Next.js's bundler plays nicely — deferable).

## Open questions

- **Sheet packing.** No padding between cells? Some packs (itch.io) ship with 1px padding around each cell to avoid bilinear bleed. Decide a convention (probably "no padding, no bleed — we sample exact pixel centers") and document it in the maintainer's-guide section of the README.
- **Transparency / alpha.** Sprites with anti-aliased edges produce semi-transparent pixels. LumenDesigner cells are binary (lit / unlit) — what's the threshold? Default to `alpha > 128 → opaque, < 128 → null`. Worth a per-set override for sets that authored to a different threshold.
- **Colour quantisation.** A "colourful" sprite carries arbitrary RGB. The active *color mode* (e.g. `rg`, `single-red`, `rgb3`) restricts what the canvas can store. Same problem the palette feature had: quantise on stamp, or surface a warning? Lean towards stamp anyway, and snap each pixel to the nearest in-mode colour at place time (reusing whatever the import pipeline does — there's already image-import.ts).
- **Active brush colour for monochrome sets.** Today's stamp tool paints the symbol in the active colour. Keep that behaviour for `colorful: false` sets. For `colorful: true` sets, the active colour is ignored. Clear, but worth a one-line UX hint next to the set picker.
- **Per-sprite metadata.** Do we need per-sprite licensing (vs. per-set)? Most packs are uniform — defer per-sprite attribution unless we ship a mixed pack.
- **Search / filter.** Once we have >100 sprites in a single set, the wrap-grid gets unwieldy. A text filter input would be cheap; defer to "if it becomes a pain".
- **Theme grouping.** A *Holiday* set could be its own pack, or a tag on individual sprites within a generic set. Sets-as-packs is simpler; tags can come later if useful.
- **Where to put the maintainer's guide.** Probably `docs/sprites.md`, with a copy-paste manifest template and the "how to slice a PNG" recipe. Strongly pair with this idea — the bar to add a pack should be 10 minutes.
- **Bundling vs. fetching.** PNGs in `public/` are fetched at runtime. For a small number of sprites we could also inline as base64 in the manifest — would simplify offline use of the static export, at the cost of a heavier JS payload. Probably leave them as static assets and let the browser cache them.
- **Stamp preview at non-1× cell sizes.** Today the stamp ghost-preview renders cell by cell in `<PixelGrid>`. For larger sprites the preview just stays cell-by-cell — should work as-is. Worth a sanity check.
- **Today's "Symbols" naming.** Rename the section to **Sprites** to reflect the broader scope? `Section title` change is one line. Probably yes.

## Notes

- Today's data: `web-toolkit/src/lib/pixel-designer/symbols.ts` (the SYMBOLS map + `symbolPoints`). It becomes the source for the legacy "Classic (mono)" set; the public API the stamp tool consumes (`symbolPoints(name, x0, y0)`) can stay or evolve into `spritePixels(setId, name) → (string|null)[]` so colourful sprites have a place to put their RGB data.
- Today's UI: the Symbols `<Section>` in `web-toolkit/src/app/designer/_components/side-panel.tsx`. The set picker drops in above the existing wrap-grid; the grid itself only changes its data source.
- Today's image import: `web-toolkit/src/lib/pixel-designer/image-import.ts` already knows how to read a PNG into a `(string|null)[]` matrix with colour-mode quantisation. The sprite loader can lean on the same primitives — different entry point (slice into N cells instead of import-the-whole-image), same building blocks.
- Pairs nicely with [[color-palettes]]: a colourful sprite set is a natural source for the "Used on canvas" palette. Stamp a couple of emoji → the palette source picks up their colours automatically.
- The attribution line at the bottom of the panel is the minimum-viable credit. If we ship 5+ purchased / CC packs, a dedicated **Credits** page (or a section in `docs/`) is the right home — but only when the list outgrows a tooltip.
- For purchased packs: include a short note in the maintainer's-guide about *not* committing the PNG if the license forbids redistribution. (Probably a moot point for the kinds of packs we'd ship, but worth saying once.)
