#!/usr/bin/env python3
"""Slice a padded sprite sheet and re-pack it into LumenDesigner format.

Example:
  repack-sprite-sheet.py \\
    --input  ./pack.png \\
    --output ./sheet.png \\
    --in-cell-size 16 --in-padding 1 --in-offset 0,0 \\
    --out-cell-size 8

See docs/sprite-sheet-authoring.md for the full workflow.
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
    p.add_argument(
        "--in-padding",
        type=int,
        default=0,
        help="Pixels of gutter between adjacent cells.",
    )
    p.add_argument(
        "--in-offset",
        type=parse_offset,
        default=(0, 0),
        help="Top-left of the first cell in the input, as X,Y.",
    )
    p.add_argument(
        "--out-cell-size",
        type=int,
        default=None,
        help="Resize each cell to this size. Defaults to in-cell-size.",
    )
    p.add_argument(
        "--columns",
        type=int,
        default=None,
        help="Override the inferred column count.",
    )
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
    print(
        f"wrote {args.output} — {cols}×{rows} cells @ {out_cs}px "
        f"({out.size[0]}×{out.size[1]} px)"
    )


if __name__ == "__main__":
    main()
