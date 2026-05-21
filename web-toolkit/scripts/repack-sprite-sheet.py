#!/usr/bin/env python3
"""Slice a padded sprite sheet and re-pack it into LumenDesigner format.

Example:
  repack-sprite-sheet.py \\
    --input  ./pack.png \\
    --output ./sheet.png \\
    --in-cell-size 16 --in-padding 1 --in-offset 0,0 \\
    --out-cell-size 8

For sheets with a solid background instead of alpha, add:
    --chroma-key '#000000'           # default tolerance 0
    --chroma-key '#1a1a1a' --chroma-tolerance 8

See docs/sprite-sheet-authoring.md for the full workflow.
"""
import argparse
from PIL import Image


def parse_offset(s):
    x, y = s.split(",")
    return int(x), int(y)


def parse_color(s):
    """Accept '#RRGGBB' or 'R,G,B'. Returns a 3-tuple of ints."""
    s = s.strip()
    if s.startswith("#"):
        s = s[1:]
        if len(s) != 6:
            raise argparse.ArgumentTypeError(f"invalid hex color: #{s}")
        return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4))
    if "," in s:
        parts = [int(p) for p in s.split(",")]
        if len(parts) != 3:
            raise argparse.ArgumentTypeError(f"expected R,G,B, got {s!r}")
        return tuple(parts)
    raise argparse.ArgumentTypeError(f"invalid color {s!r} (use #RRGGBB or R,G,B)")


def chroma_key(img, key_rgb, tolerance):
    """Set alpha=0 on every pixel whose RGB is within `tolerance` of key_rgb.

    Tolerance is per-channel max diff: a pixel keys out when each of
    |r-kr|, |g-kg|, |b-kb| is ≤ tolerance. Tolerance 0 means exact match.
    """
    kr, kg, kb = key_rgb
    pixels = list(img.getdata())
    out = []
    for r, g, b, a in pixels:
        if (
            a > 0
            and abs(r - kr) <= tolerance
            and abs(g - kg) <= tolerance
            and abs(b - kb) <= tolerance
        ):
            out.append((r, g, b, 0))
        else:
            out.append((r, g, b, a))
    img.putdata(out)
    return img


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
    p.add_argument(
        "--chroma-key",
        type=parse_color,
        default=None,
        help=(
            "Background colour to convert to transparency before slicing. "
            "Accepts '#RRGGBB' or 'R,G,B'. Omit for sheets that already use "
            "alpha transparency."
        ),
    )
    p.add_argument(
        "--chroma-tolerance",
        type=int,
        default=0,
        help=(
            "Per-channel tolerance when chroma-keying. 0 = exact match. "
            "Use 4-16 for sheets that have JPG-style compression noise."
        ),
    )
    args = p.parse_args()

    src = Image.open(args.input).convert("RGBA")
    if args.chroma_key is not None:
        src = chroma_key(src, args.chroma_key, args.chroma_tolerance)

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
