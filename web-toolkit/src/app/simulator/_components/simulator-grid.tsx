"use client";

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  type DisplayConfig,
  displayCellSize,
  displayOffset,
  displayScale,
  isLumatrix,
  SOURCE_HEIGHT,
  SOURCE_WIDTH,
} from "@/lib/simulator/display-config";
import { letterAt } from "@/lib/simulator/letter-mask";
import type { DisplayMode } from "@/lib/simulator/types";

export interface SimGridHandle {
  render(buffer: Uint8ClampedArray): void;
  setMode(mode: DisplayMode): void;
}

interface SimulatorGridProps {
  display: DisplayConfig;
}

/** Buffer indices use the LUMATRIX convention: row 0 = bottom of source. */
function sourceLedIndex(sx: number, sy: number): number {
  return (SOURCE_HEIGHT - 1 - sy) * SOURCE_WIDTH + sx;
}

function boostByte(b: number): number {
  const boosted = Math.round(b * 3.2);
  return boosted > 255 ? 255 : boosted;
}

export const SimulatorGrid = forwardRef<SimGridHandle, SimulatorGridProps>(
  function SimulatorGrid({ display }, ref) {
    // Per-cell DOM refs, indexed (y * W + x) in physical display coords.
    const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
    const modeRef = useRef<DisplayMode>("pixel");
    const lastBufferRef = useRef<Uint8ClampedArray | null>(null);

    // Display geometry.
    const scale = useMemo(() => displayScale(display), [display]);
    const offset = useMemo(() => displayOffset(display), [display]);
    const cellSize = useMemo(() => displayCellSize(display), [display]);
    const cellCount = display.width * display.height;

    // Reset refs whenever the cell count changes so stale refs from a previous
    // size don't get touched in render().
    if (cellRefs.current.length !== cellCount) {
      cellRefs.current = new Array(cellCount).fill(null);
    }

    /** Map a physical-display cell (px, py) → source pixel (sx, sy), or null
     *  if the cell falls outside the centred scaled-up region. */
    const sourceForCell = useCallback(
      (px: number, py: number): { sx: number; sy: number } | null => {
        const dx = px - offset.x;
        const dy = py - offset.y;
        if (dx < 0 || dy < 0) return null;
        const sx = Math.floor(dx / scale);
        const sy = Math.floor(dy / scale);
        if (sx >= SOURCE_WIDTH || sy >= SOURCE_HEIGHT) return null;
        return { sx, sy };
      },
      [offset.x, offset.y, scale],
    );

    /** Render the 8×8 source buffer onto the physical W×H grid. */
    const render = useCallback(
      (buffer: Uint8ClampedArray) => {
        lastBufferRef.current = buffer;
        const isMask = modeRef.current === "mask" && isLumatrix(display);

        for (let py = 0; py < display.height; py++) {
          for (let px = 0; px < display.width; px++) {
            const cell = cellRefs.current[py * display.width + px];
            if (!cell) continue;

            const src = sourceForCell(px, py);
            let r = 0;
            let g = 0;
            let b = 0;
            let lit = false;

            if (src) {
              const base = sourceLedIndex(src.sx, src.sy) * 3;
              r = buffer[base];
              g = buffer[base + 1];
              b = buffer[base + 2];
              lit = r > 0 || g > 0 || b > 0;
            }

            const color = `rgb(${boostByte(r)},${boostByte(g)},${boostByte(b)})`;
            cell.classList.toggle("lit", lit);
            cell.classList.toggle("mask-mode", isMask);

            const ltrEl = cell.firstElementChild as HTMLElement | null;
            if (!ltrEl) continue;

            // Letter mask: only show a letter on the TOP-LEFT cell of each
            // scaled-up source block, so a 2×2 block at 16×16 doesn't show
            // four copies of the same letter.
            const isBlockOrigin =
              src !== null &&
              (px - offset.x) % scale === 0 &&
              (py - offset.y) % scale === 0;

            if (isMask) {
              const letter = src && isBlockOrigin ? letterAt(src.sx, src.sy) : "";
              if (letter) {
                ltrEl.textContent = letter;
                cell.classList.remove("mask-blank");
              } else if (src && isBlockOrigin) {
                ltrEl.textContent = "·";
                cell.classList.add("mask-blank");
              } else {
                ltrEl.textContent = "";
                cell.classList.remove("mask-blank");
              }
              cell.style.removeProperty("background");
              if (lit) {
                cell.style.setProperty("--c", color);
                ltrEl.style.color = color;
              } else {
                cell.style.removeProperty("--c");
                ltrEl.style.color = "";
              }
            } else {
              ltrEl.textContent = "";
              cell.classList.remove("mask-blank");
              ltrEl.style.color = "";
              if (lit) {
                cell.style.background = color;
                cell.style.setProperty("--c", color);
              } else {
                cell.style.removeProperty("background");
                cell.style.removeProperty("--c");
              }
            }
          }
        }
      },
      [display.height, display.width, sourceForCell, scale, offset.x, offset.y, display],
    );

    const setMode = useCallback(
      (next: DisplayMode) => {
        if (next === modeRef.current) return;
        modeRef.current = next;
        if (lastBufferRef.current) render(lastBufferRef.current);
      },
      [render],
    );

    useImperativeHandle(ref, () => ({ render, setMode }), [render, setMode]);

    // Build the cell DOM. We use the size in deps via display to force a
    // rebuild whenever the physical dimensions change.
    const cells: React.ReactNode[] = useMemo(() => {
      const out: React.ReactNode[] = [];
      for (let py = 0; py < display.height; py++) {
        for (let px = 0; px < display.width; px++) {
          const idx = py * display.width + px;
          out.push(
            <div
              key={idx}
              className="sim-cell"
              ref={(el) => {
                cellRefs.current[idx] = el;
              }}
            >
              <span className="sim-letter" />
            </div>,
          );
        }
      }
      return out;
    }, [display.height, display.width]);

    return (
      <div
        className="rounded-xl p-6"
        style={{
          background:
            "radial-gradient(ellipse at center, #18181d 0%, #0a0a0c 100%)",
          boxShadow:
            "0 4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)",
        }}
      >
        <div
          className="sim-grid"
          style={
            {
              "--sim-cols": display.width,
              "--sim-rows": display.height,
              "--sim-cell": `${cellSize}px`,
            } as React.CSSProperties
          }
        >
          {cells}
        </div>
      </div>
    );
  },
);
