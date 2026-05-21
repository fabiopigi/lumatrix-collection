# Authoring a sprite sheet for LumenDesigner

This guide covers turning **an arbitrary PNG** — a pack you downloaded, a tile sheet you exported from Aseprite, screenshots you stitched together — into a sprite set that LumenDesigner can load.

Audience: anyone adding a new set to the **Sprites** panel. The interactive flow is *open the image, figure out the slicing, run one script, drop two files into the repo*.

If you'd rather hand-author 8×8 stamps as ASCII grids (no source PNG), skip to [Authoring from scratch](#authoring-from-scratch).

---

## For an LLM driving this end-to-end

If you're an LLM converting a sheet on behalf of a user, your job is **ask, don't guess**. The user knows the source format; you almost certainly don't. Get the answers below before running any script. Once you have them, the rest of this document is your reference.

### Ask the user these questions

Ask all of these in one batch before doing anything. If the user says "I don't know" for something visual, *then* fall back to looking at the image.

1. **Source PNG path?** (e.g. `~/Downloads/smileys.png`)
2. **Target set id?** (kebab-case, prefixed by size — e.g. `8x8-smileys`)
3. **Target set display name?** (e.g. `Smileys (8×8)`)
4. **Target cell size?** This is what the *LumenDesigner canvas* expects — `8`, `16`, or `32`. Match the LED hardware the user wants to stamp onto.
5. **Source rendering scale (@Nx)?** Is each sprite drawn at the target cell size in source pixels, or upscaled? Ask:
   - "Are the sprites in the source PNG drawn at native resolution (each source pixel = one LED pixel), or are they upscaled? If upscaled, how many source pixels per logical pixel?"
   - Examples: `@1x` → 8×8 cells in source = 8×8 cells on the LED. `@4x` → 32×32 source cells = 8×8 on the LED.
6. **Padding between cells?** (in source pixels — e.g. `0`, `1`, `12`)
7. **Offset to first cell?** (`X,Y` in source pixels; usually `0,0` unless the sheet has a global border)
8. **Background**: alpha-transparent, or a solid colour? If solid, what hex?
9. **Colour mode**: is the set **monochrome** (every cell stamps in the active brush colour) or **colourful** (each cell keeps its own RGB)? Heuristic: photographic / multi-colour sprites → colourful; silhouettes / icons in one tone → monochrome.
10. **Optional metadata**: licence, attribution name, attribution URL.

### How each answer maps to a script flag

| User answer | Flag on `repack-sprite-sheet.py` | Manifest field |
|---|---|---|
| Target cell size = `N` | `--out-cell-size N` | `"size": N` |
| Source @1x at cell size N | `--in-cell-size N` | — |
| Source @Mx at target N | `--in-cell-size <N*M>` `--out-cell-size N` | — |
| Padding `P` | `--in-padding P` | — |
| Offset `X,Y` | `--in-offset X,Y` | — |
| Background colour `#HEX` | `--chroma-key '#HEX'` | — |
| Background uses alpha already | (omit `--chroma-key`) | — |
| Monochrome set | — | `"colorful": false` |
| Colourful set | — | `"colorful": true` |
| Licence | — | `"license": "…"` |
| Attribution | — | `"attribution": "…"` |
| Attribution URL | — | `"attributionUrl": "…"` |

### The flow once you have answers

1. **Run `repack-sprite-sheet.py`** with the flags above. It writes the clean `sheet.png`.
2. **Look at the cleaned `sheet.png`** in row-major order. For each non-empty cell, decide a kebab-case `name` (`heart`, `coin`, `space-invader`, etc.). Skip empty cells silently — they don't need manifest entries.
3. **Write `manifest.json`** using the schema below, listing the sprites in the order you want them to appear in the panel.
4. **Register the set** — append the manifest URL to `COLORFUL_MANIFEST_URLS` in `web-toolkit/src/lib/pixel-designer/sprites.ts`.
5. **Report back to the user** with the file paths, the set id, and how many sprites you named.

If any answer leaves you unsure (e.g. the user said "I think the padding is 1px" but the script's output looks wrong), **stop and ask again** — don't keep tweaking flags blind. Tell the user what you ran and what you saw.

---

## What the loader expects

LumenDesigner reads each sprite set from two files:

| File | What it holds |
|---|---|
| `sheet.png` | A **uniform grid** of cells. Each cell is one sprite. No padding between cells, no global border. Cell width = cell height = the set's `size` (e.g. 8, 16, 32). RGBA — alpha 0 means "empty pixel", alpha 1+ means "lit". |
| `manifest.json` | Names each cell by `(row, col)` and declares set-level metadata (size, name, colourful, optional licence / attribution). |

The loader (`web-toolkit/src/lib/pixel-designer/sprites.ts`) decodes the PNG into a `<canvas>`, slices it by `size × size`, and emits one `(string|null)[]` per sprite. **Anything that isn't a uniform no-padding grid has to be normalised first** — that's what this guide is mostly about.

### Constraints in one place

- **One cell size per sheet.** Mixing 8×8 and 16×16 in the same file isn't supported. Use two sheets, two sets.
- **No padding between cells.** Many distributed sheets use 1px gutters to avoid bilinear bleed — strip them before importing.
- **Alpha decides lit vs unlit.** Default cutoff is `α ≥ 128 → lit`. Anti-aliased edges that look right in a paint program may vanish on the LED grid; see [Gotchas](#gotchas).
- **Colours are stored verbatim.** Each cell's RGB lands on the canvas as-is. The active *color mode* on the canvas (`rg`, `rgb3`, single-channel) **does not** quantise the sprite for you at stamp time — see [Gotchas](#gotchas) again.
- **The cell size should match the canvas you're stamping onto.** 32×32 sprites on an 8×8 canvas are hidden from the picker; switch hardware variants in the header to access them.

---

## Where the files live

```
web-toolkit/
├── public/sprites/
│   └── <set-id>/                        ← one directory per set
│       ├── sheet.png                    ← the cleaned grid
│       └── manifest.json                ← cell names + metadata
└── src/lib/pixel-designer/
    └── sprites.ts                       ← register the manifest URL here
```

`<set-id>` is the same string as `manifest.id`. Use kebab-case, prefix with the cell size for clarity: `8x8-emoji`, `16x16-game`, `32x32-holiday`.

---

## The manifest

A minimal example:

```json
{
  "id": "8x8-emoji",
  "name": "Emoji (8×8)",
  "size": 8,
  "colorful": true,
  "sheet": "/sprites/8x8-emoji/sheet.png",
  "columns": 16,
  "sprites": [
    { "name": "smile",  "row": 0, "col": 0 },
    { "name": "heart",  "row": 0, "col": 1 },
    { "name": "rocket", "row": 0, "col": 2 }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | Matches the directory name. Stable; never rename once shipped. |
| `name` | string | yes | What the picker shows. Include the size in parens (e.g. `Emoji (8×8)`) so users can disambiguate at a glance. |
| `size` | int | yes | Cell side in pixels. Equal width and height. |
| `colorful` | bool | yes | `false` → stamps use the active brush colour, every filled cell shares that one colour. `true` → cells keep their own RGB from the sheet, the brush colour is ignored. |
| `sheet` | string | yes | Site-relative URL to the PNG. Always `"/sprites/<id>/sheet.png"`. |
| `columns` | int | yes | Sprites per row in the PNG. Only used as documentation today; the loader reads `row` / `col` directly. |
| `sprites[].name` | string | yes | Lowercase, kebab-case, unique within the set. Becomes the title attribute on the thumbnail button. |
| `sprites[].row` / `.col` | int | yes | Zero-indexed grid position of the sprite in the sheet. |
| `license` | string | optional | E.g. `"CC BY 4.0"`, `"CC0"`, `"Purchased — internal only"`. Shown verbatim under the panel. |
| `attribution` | string | optional | The credit line. |
| `attributionUrl` | string | optional | If provided, the whole attribution line becomes a link. |

The order of sprites in the array drives the order in the panel. Group related sprites together — the panel doesn't auto-sort.

---

## From an arbitrary input → clean sheet

Most packs you'll encounter look like one of these. Pick the closest match and follow the recipe.

### Recipe A — uniform grid, no padding, already at target size

You're already done. Save the PNG into `public/sprites/<id>/sheet.png`, write the manifest, done.

### Recipe B — uniform grid, with padding between cells

Common in Aseprite exports and itch.io tilesets — 1–2px gutters around each cell. Strip them with the repacker below.

Run from anywhere on disk; Python 3 + Pillow required (`pip install pillow`):

```bash
python3 web-toolkit/scripts/repack-sprite-sheet.py \
  --input  ./downloaded-pack.png \
  --output web-toolkit/public/sprites/8x8-emoji/sheet.png \
  --in-cell-size 16 \
  --in-padding 1 \
  --in-offset 0,0 \
  --out-cell-size 8
```

The script (provided below — drop it in `web-toolkit/scripts/`) reads cell `(r, c)` from the input at `(offset_x + c * (cell + padding), offset_y + r * (cell + padding))`, optionally downscales each cell to `out-cell-size` with nearest-neighbour, and writes a contiguous no-padding grid.

### Recipe C — non-uniform / odd-sized sprites

You have a pack with sprites of varying sizes, or sprites larger than your LumenDesigner canvas (e.g. 64×64 source for an 8×8 set). Two stages:

1. **Crop each sprite to its own file** (use Aseprite's "Export Sprite Sheet" → individual files, or any image editor's slice/export). Name them `00.png`, `01.png`, … in the order you want them to appear.
2. **Pack the cropped files into a uniform sheet:**

```bash
python3 web-toolkit/scripts/pack-sprites.py \
  --inputs ./cropped/*.png \
  --output web-toolkit/public/sprites/8x8-emoji/sheet.png \
  --cell-size 8 \
  --columns 8 \
  --resize fit              # nearest-neighbour resize to cell-size, preserves aspect
```

Don't have proportional source art? Use `--resize stretch` instead; or pre-pad each source to a square before packing.

### Recipe D — irregular layout (a few sprites in a scattered arrangement)

Most often a "loose icon set" — irregular gaps, mixed sizes, decorative background. Treat it as Recipe C: crop each interesting sprite by hand, then pack.

If the pack has its own metadata (an XML / JSON describing cell positions, Texture Packer style), it's faster to write a one-off converter than to crop by hand. Reuse `pack-sprites.py` after you've sliced the source into per-file PNGs.

### Recipe E — non-rectangular cell count

You have 13 sprites and your grid is 4 columns × 4 rows = 16. Just leave the last 3 cells empty (any colour with alpha 0) and only list the 13 you want in the manifest. The loader doesn't care about empty cells — they're never named, never selected.

### Recipe F — solid background instead of alpha

The sheet uses a solid colour (often black, sometimes magenta `#ff00ff`) as the "transparent" background — no alpha channel. Convert the background to transparency before slicing with `--chroma-key`:

```bash
python3 web-toolkit/scripts/repack-sprite-sheet.py \
  --input ./pack-on-black.png \
  --output web-toolkit/public/sprites/8x8-smileys/sheet.png \
  --in-cell-size 8 --in-padding 0 --in-offset 0,0 \
  --chroma-key '#000000'
```

For sheets with JPG-style compression noise (the "transparent" colour isn't pixel-exact), add a small tolerance:

```bash
  --chroma-key '#000000' --chroma-tolerance 8
```

Tolerance is per-channel maximum difference — `8` means each of R, G, B must be within 8 of the key colour for the pixel to be treated as background. Good defaults: `0` for clean PNG exports, `4–16` for anything that's been through JPG / re-encoding.

**Gotcha**: chroma-key matches *any* matching pixel, including ones inside your sprites. If the background colour is black and your sprites have black detail (outlines, pupils), those will become transparent too. Two fixes:

1. **Author / source sheets where the background isn't a colour used in the art.** Magenta `#ff00ff` is the traditional choice for exactly this reason.
2. **Tighten the tolerance to zero and add a small alpha bump** before chroma-key. If you're stuck with a black-background sheet whose sprites also use black, your best bet is to crop sprites individually (Recipe C) so each one is bordered by clearly-background pixels.

### Recipe G — sprites rendered at @Nx

A common scenario: the source PNG is the intended pixel art, but rendered larger so it's easier to view. An 8×8 sprite drawn at @4× takes up 32×32 source pixels — each "logical pixel" is a 4×4 block of identical colour.

You don't need a special flag. Tell the script the *source* cell size (large) and the *output* cell size (small); the downscale path uses nearest-neighbour, which picks one pixel per N×N block — exactly the right reverse of a nearest-neighbour upscale.

```bash
python3 web-toolkit/scripts/repack-sprite-sheet.py \
  --input ./art-at-4x.png \
  --output web-toolkit/public/sprites/8x8-smileys/sheet.png \
  --in-cell-size 32 \
  --in-padding 12 \
  --in-offset 0,0 \
  --out-cell-size 8
```

**Detecting @Nx visually**: zoom into the image and look at adjacent pixels. If you see uniform N×N blocks of identical colour everywhere, the art is @N×. If pixels vary individually, it's @1×.

**Important**: this assumes a *nearest-neighbour* upscale. If the upscale was bilinear / bicubic, the N×N blocks have gradients and our nearest-neighbour downsample will pick noisy corner samples. For those, ask the source author for the @1× version, or do a one-off Pillow snippet that averages each block (`Image.BOX` resampling) instead.

---

## The reusable scripts

Two Python scripts under `web-toolkit/scripts/`. Both require Pillow (`pip install pillow`).

- **[`repack-sprite-sheet.py`](../web-toolkit/scripts/repack-sprite-sheet.py)** — slices a uniform grid (with optional padding, offset, background-key, and downscale) and writes a contiguous no-padding sheet. The workhorse for Recipes B, F, G.
- **[`pack-sprites.py`](../web-toolkit/scripts/pack-sprites.py)** — takes individual sprite PNGs (one per file) and packs them into a uniform sheet, with `fit` / `stretch` / `none` resize modes. The workhorse for Recipe C / D.

Run either with `--help` for the full flag list.

### Generate the manifest stub

After running either script, you've got a `sheet.png`. The manifest is hand-written — copy this and fill in the names:

```bash
cat > web-toolkit/public/sprites/8x8-emoji/manifest.json <<'JSON'
{
  "id": "8x8-emoji",
  "name": "Emoji (8×8)",
  "size": 8,
  "colorful": true,
  "sheet": "/sprites/8x8-emoji/sheet.png",
  "columns": 8,
  "sprites": [
    { "name": "TODO", "row": 0, "col": 0 }
  ],
  "license": "CC BY 4.0",
  "attribution": "Author Name",
  "attributionUrl": "https://example.com"
}
JSON
```

Open the sheet in any image viewer; for each cell that's filled, append a `{ name, row, col }` entry. The order in the array drives the order in the panel.

---

## Authoring from scratch

If you don't have a source PNG and want to hand-draw 8×8 monochrome stamps in code, copy [`web-toolkit/scripts/build-fake-sprite-sheet.mjs`](../web-toolkit/scripts/build-fake-sprite-sheet.mjs):

- Define each sprite as a `rows` array of `.X` / colour-letter strings.
- Edit the `PAL` map to your palette.
- Re-run the script — it writes both `sheet.png` and `manifest.json`.

That script generates the shipped `8x8-demo` pack and is a good template for any small hand-authored set.

---

## Registering a new set

One line, in `web-toolkit/src/lib/pixel-designer/sprites.ts`:

```ts
const COLORFUL_MANIFEST_URLS: string[] = [
  "/sprites/8x8-demo/manifest.json",
  "/sprites/8x8-emoji/manifest.json",   // ← add your line
];
```

That's everything. The loader fetches the manifest, decodes the PNG, and the set shows up in the Sprites panel's picker, grouped by its `size`. No restart, no build step (in dev — production needs a rebuild).

### Checklist

- [ ] `public/sprites/<id>/sheet.png` exists, RGBA, uniform grid, no padding.
- [ ] `public/sprites/<id>/manifest.json` lists every cell you want named.
- [ ] `manifest.id` matches the directory name.
- [ ] One line added to `COLORFUL_MANIFEST_URLS`.
- [ ] Browser dev tools' Network tab shows the sheet 200ing — `404` means the path is off.
- [ ] Sprites panel's set picker lists the new set.
- [ ] Stamping a sprite paints the expected pixels (open canvas, click sprite, click grid).

---

## Gotchas

### Alpha edges look right in Photoshop, vanish on the canvas

LumenDesigner is binary: a cell is lit or unlit. Default cutoff is `α ≥ 128`. Anti-aliased edges with `α 60–120` are dropped. Two ways out:

1. **Author for the grid.** Either go fully opaque (1-bit alpha) before exporting, or accept that AA edges will be eaten.
2. **Pre-process to threshold.** A one-liner in Pillow:
   ```python
   img.putalpha(img.split()[3].point(lambda a: 255 if a >= 128 else 0))
   ```

### Colours look "off" on the canvas

The canvas's *color mode* (e.g. `rg`, `single-red`, `rgb3`) constrains what the LED hardware can reproduce — but **the stamp tool stores your sprite's RGB verbatim**. That can leave the design with hexes the mode can't render on hardware. Two ways out:

1. **Author within the mode's gamut.** If the target hardware is red-only, paint your sheet in reds only.
2. **Pre-quantise the sheet.** Build the sheet against the mode's palette (`web-toolkit/src/lib/pixel-designer/palette.ts` → `COLOR_MODES`). The export pipeline does this on its end, but stamping does not.

### My 16×16 set doesn't show up in the picker

It's hidden because the active canvas is 8×8. Switch hardware variants in the header to a 16×16 (or larger) preset. The set will appear automatically.

### The first row shows partial sprites

Either the input had a global border (use `--in-offset 1,1`) or the cell-size guess was off by one. Open `sheet.png` in a viewer that shows pixel coordinates; visually confirm cell `(0,0)` starts at pixel `(0,0)` and ends at pixel `(size-1, size-1)`.

### Sprites are mirrored / rotated

Some packs use a row-major ordering you don't expect. The manifest's `row` / `col` are zero-based with `(0,0)` at the top-left of the sheet. If your sprites are upside down, you flipped the PNG somewhere along the way — re-export from the source.

### Licensing

Don't ship sheets whose licence forbids redistribution. Keep purchased packs out of the repo — instead, document the source in a separate notes file and have each developer drop their own copy in `public/sprites/<id>/` locally. The loader fails gracefully on missing manifests (warns in the console, hides the set).

---

## Worked examples

### Easy: `foods.png` — native 8×8, alpha, no padding

The trivial happy path. Source is already what we want.

User answers:
- target cell size: 8
- source @Nx: @1
- padding: 0
- offset: 0,0
- background: alpha
- colour mode: colourful

```bash
# Source is already aligned — just copy + register, or run repack with
# matching in/out sizes (idempotent).
python3 web-toolkit/scripts/repack-sprite-sheet.py \
  --input ~/Downloads/foods.png \
  --output web-toolkit/public/sprites/8x8-foods/sheet.png \
  --in-cell-size 8 --in-padding 0 --in-offset 0,0
```

Then write `manifest.json` (`"size": 8`, `"colorful": true`, one `{name, row, col}` per cell) and add the URL to `COLORFUL_MANIFEST_URLS`.

### Harder: `smileys.png` — @4× on black background with 12 px gutters

User answers:
- target cell size: 8
- source @Nx: @4 (so each logical 8×8 sprite is 32×32 source pixels)
- padding: 12 px between adjacent 32×32 cells
- offset: 0,0
- background: solid black `#000000` (no alpha)
- colour mode: colourful

```bash
python3 web-toolkit/scripts/repack-sprite-sheet.py \
  --input ~/Downloads/smileys.png \
  --output web-toolkit/public/sprites/8x8-smileys/sheet.png \
  --in-cell-size 32 \
  --in-padding 12 \
  --in-offset 0,0 \
  --out-cell-size 8 \
  --chroma-key '#000000'
```

Then write `manifest.json`, append the URL to `COLORFUL_MANIFEST_URLS`, refresh the designer.

**Sanity-check after running**: open the cleaned `sheet.png` in any image viewer. Each cell should be 8×8, the background should be transparent (checkerboard pattern in most viewers), and the sprites should look recognisable. If the sprites' own black pixels got eaten, see the gotcha in Recipe F. If cell boundaries look off, double-check `--in-cell-size`, `--in-padding`, `--in-offset` against the source by counting pixels.

---

Total elapsed time once you have the source PNG + the answers above: ~5 minutes, mostly spent naming cells.
