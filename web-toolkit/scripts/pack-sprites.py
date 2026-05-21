#!/usr/bin/env python3
"""Pack individual sprite PNGs into one LumenDesigner sheet.

Example:
  pack-sprites.py --inputs ./out/*.png --output ./sheet.png \\
                  --cell-size 8 --columns 8 --resize fit

See docs/sprite-sheet-authoring.md for the full workflow.
"""
import argparse
import glob
from PIL import Image


def main():
    p = argparse.ArgumentParser()
    p.add_argument(
        "--inputs",
        nargs="+",
        required=True,
        help="Glob(s) or paths to individual sprite PNGs.",
    )
    p.add_argument("--output", required=True)
    p.add_argument("--cell-size", type=int, required=True)
    p.add_argument("--columns", type=int, required=True)
    p.add_argument(
        "--resize",
        choices=["fit", "stretch", "none"],
        default="fit",
        help=(
            "fit = preserve aspect, pad with transparency; "
            "stretch = nearest-neighbour resize to fill the cell; "
            "none = assume the source is already cell-size × cell-size."
        ),
    )
    args = p.parse_args()

    paths = []
    for pattern in args.inputs:
        if any(ch in pattern for ch in "*?["):
            paths.extend(sorted(glob.glob(pattern)))
        else:
            paths.append(pattern)
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
    print(
        f"wrote {args.output} — {len(paths)} sprites in {cols}×{rows} grid @ {cs}px"
    )


if __name__ == "__main__":
    main()
