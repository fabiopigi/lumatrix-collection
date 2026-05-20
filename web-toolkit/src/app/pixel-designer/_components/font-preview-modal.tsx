"use client";

import { ModalShell } from "./modal-shell";
import {
  FONT_3X5,
  FONT_5X8,
  FONT_7X9,
} from "@/lib/pixel-designer/fonts";
import type { FontKey } from "@/lib/pixel-designer/types";

const FONT_DATA: Record<FontKey, Record<string, string[]>> = {
  "3x5": FONT_3X5,
  "5x8": FONT_5X8,
  "7x9": FONT_7X9,
};

const PIXEL = 4;

interface FontPreviewModalProps {
  font: FontKey;
  color: string;
  onClose: () => void;
}

export function FontPreviewModal({
  font,
  color,
  onClose,
}: FontPreviewModalProps) {
  const glyphs = FONT_DATA[font];
  const entries = Object.entries(glyphs);

  return (
    <ModalShell onClose={onClose} label={`Font preview: ${font}`} className="w-[760px] max-h-[85vh] flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-[15px] font-semibold text-foreground">
            {font} preview
          </div>
          <div className="text-[11px] text-fg-faint mt-0.5">
            {entries.length} glyphs · rendered at {PIXEL}× ({PIXEL} browser pixels per font pixel)
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-foreground cursor-pointer text-xl leading-none px-2"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="overflow-y-auto pr-1 -mr-1">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
          {entries.map(([ch, rows]) => (
            <GlyphCell key={ch} char={ch} rows={rows} color={color} />
          ))}
        </div>
      </div>
    </ModalShell>
  );
}

function GlyphCell({
  char,
  rows,
  color,
}: {
  char: string;
  rows: string[];
  color: string;
}) {
  const w = rows[0].length;
  const h = rows.length;
  const bgRects: React.ReactNode[] = [];
  const rects: React.ReactNode[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      bgRects.push(
        <rect
          key={`bg-${x},${y}`}
          x={x}
          y={y}
          width={1}
          height={1}
          fill={(x + y) % 2 === 0 ? "#0a0a0c" : "#1f1f26"}
        />,
      );
      if (rows[y][x] === "X") {
        rects.push(
          <rect
            key={`${x},${y}`}
            x={x}
            y={y}
            width={1}
            height={1}
            fill={color}
          />,
        );
      }
    }
  }
  const label = char === " " ? "␣" : char;
  return (
    <div className="flex flex-col items-center gap-1.5 p-2 rounded border border-line-strong bg-[#0d0d10]">
      <div className="font-mono text-[10px] text-muted uppercase tracking-wider">
        {label}
      </div>
      <div
        className="flex items-end justify-center"
        style={{ minHeight: h * PIXEL }}
      >
        <svg
          width={w * PIXEL}
          height={h * PIXEL}
          viewBox={`0 0 ${w} ${h}`}
          shapeRendering="crispEdges"
          className="block"
        >
          {bgRects}
          {rects}
        </svg>
      </div>
    </div>
  );
}
