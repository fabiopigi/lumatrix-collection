# Authoring a sprite sheet for LumenDesigner

This guide covers turning **an arbitrary PNG** — a pack you downloaded, a tile sheet you exported from Aseprite, screenshots you stitched together — into a sprite set that LumenDesigner can load.

Audience: anyone adding a new set to the **Sprites** panel. The interactive flow is *open the image, figure out the slicing, run one script, drop two files into the repo*.

If you'd rather hand-author 8×8 stamps as ASCII grids (no source PNG), skip to [Authoring from scratch](#authoring-from-scratch).

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

---

## The reusable scripts

Drop these into `web-toolkit/scripts/`. They have no dependencies beyond Pillow (`pip install pillow`).

### `repack-sprite-sheet.py`

Slices a padded grid into a contiguous no-padding grid, with optional resize.

```python
#!/usr/bin/env python3
"""Slice a padded sprite sheet and re-pack it into LumenDesigner format.

Example:
  repack-sprite-sheet.py \\
    --input  ./pack.png \\
    --output ./sheet.png \\
    --in-cell-size 16 --in-padding 1 --in-offset 0,0 \\
    --out-cell-size 8
"""
import argparse
from PIL import Image

def parse_offset(s):
    x, y = s.split(",")
    return int(x), int(y)

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--in-cell-size", type=int, required=True)
    p.add_argument("--in-padding", type=int, default=0,
                   help="Pixels of gutter between adjacent cells.")
    p.add_argument("--in-offset", type=parse_offset, default=(0, 0),
                   help="Top-left of the first cell in the input, as X,Y.")
    p.add_argument("--out-cell-size", type=int, default=None,
                   help="Resize each cell to this size. Defaults to in-cell-size.")
    p.add_argument("--columns", type=int, default=None,
                   help="Override the inferred column count.")
    args = p.parse_args()

    src = Image.open(args.input).convert("RGBA")
    sw, sh = src.size
    cs = args.in_cell_size
    pad = args.in_padding
    ox, oy = args.in_offset
    step = cs + pad
    cols = args.columns or (sw - ox + pad) // step
    rows = (sh - oy + pad) // step
    out_cs = args.out_cell_size or cs

    out = Image.new("RGBA", (cols * out_cs, rows * out_cs), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            x = ox + c * step
            y = oy + r * step
            if x + cs > sw or y + cs > sh:
                continue
            cell = src.crop((x, y, x + cs, y + cs))
            if out_cs != cs:
                cell = cell.resize((out_cs, out_cs), Image.NEAREST)
            out.paste(cell, (c * out_cs, r * out_cs))
    out.save(args.output)
    print(f"wrote {args.output} — {cols}×{rows} cells @ {out_cs}px ({out.size[0]}×{out.size[1]} px)")

if __name__ == "__main__":
    main()
```

### `pack-sprites.py`

Packs a list of individual PNGs into one uniform sheet.

```python
#!/usr/bin/env python3
"""Pack individual sprite PNGs into one LumenDesigner sheet.

Example:
  pack-sprites.py --inputs ./out/*.png --output ./sheet.png \\
                  --cell-size 8 --columns 8 --resize fit
"""
import argparse, glob, os
from PIL import Image

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--inputs", nargs="+", required=True,
                   help="Glob(s) or paths to individual sprite PNGs.")
    p.add_argument("--output", required=True)
    p.add_argument("--cell-size", type=int, required=True)
    p.add_argument("--columns", type=int, required=True)
    p.add_argument("--resize", choices=["fit", "stretch", "none"], default="fit")
    args = p.parse_args()

    paths = []
    for pattern in args.inputs:
        paths.extend(sorted(glob.glob(pattern)) if any(ch in pattern for ch in "*?[") else [pattern])
    if not paths:
        raise SystemExit("no input files matched")

    cs = args.cell_size
    cols = args.columns
    rows = (len(paths) + cols - 1) // cols
    out = Image.new("RGBA", (cols * cs, rows * cs), (0, 0, 0, 0))

    for i, path in enumerate(paths):
        img = Image.open(path).convert("RGBA")
        if args.resize == "stretch":
            img = img.resize((cs, cs), Image.NEAREST)
        elif args.resize == "fit":
            # Preserve aspect; pad with transparency.
            w, h = img.size
            scale = min(cs / w, cs / h)
            nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
            img = img.resize((nw, nh), Image.NEAREST)
            canvas = Image.new("RGBA", (cs, cs), (0, 0, 0, 0))
            canvas.paste(img, ((cs - nw) // 2, (cs - nh) // 2))
            img = canvas
        # resize=none assumes the source is already cs×cs
        r, c = divmod(i, cols)
        out.paste(img, (c * cs, r * cs))

    out.save(args.output)
    print(f"wrote {args.output} — {len(paths)} sprites in {cols}×{rows} grid @ {cs}px")

if __name__ == "__main__":
    main()
```

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

## Worked example

Imagine you downloaded `emoji-pack.png`: a 256×256 RGBA image with 16×16 cells arranged in 16 columns × 16 rows, with **1 px** of transparent padding between every cell, starting at offset `(1, 1)`. You want an 8×8 set for the 8×8 LUMATRIX.

```bash
# 1. Repack: strip padding, downscale 16→8.
python3 web-toolkit/scripts/repack-sprite-sheet.py \
  --input  ~/Downloads/emoji-pack.png \
  --output web-toolkit/public/sprites/8x8-emoji/sheet.png \
  --in-cell-size 16 \
  --in-padding 1 \
  --in-offset 1,1 \
  --out-cell-size 8

# 2. Write the manifest (copy the template above, fill in names by
#    scrolling through the cleaned sheet in any image viewer).

# 3. Register the set.
#    edit web-toolkit/src/lib/pixel-designer/sprites.ts → append
#    "/sprites/8x8-emoji/manifest.json" to COLORFUL_MANIFEST_URLS.

# 4. Open the designer.
cd web-toolkit && npm run dev
# → http://localhost:3000/designer → Sprites panel → pick "Emoji (8×8)".
```

Done. Total elapsed time once you have the source PNG: ~5 minutes plus however long it takes to name the cells.
