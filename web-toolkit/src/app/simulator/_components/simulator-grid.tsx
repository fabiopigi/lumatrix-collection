"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import {
  MATRIX_HEIGHT,
  MATRIX_WIDTH,
  letterAt,
} from "@/lib/simulator/letter-mask";
import type { DisplayMode } from "@/lib/simulator/types";

export interface SimGridHandle {
  render(buffer: Uint8ClampedArray): void;
  setMode(mode: DisplayMode): void;
}

function ledIndex(x: number, y: number): number {
  return (MATRIX_HEIGHT - 1 - y) * MATRIX_WIDTH + x;
}

function boostByte(b: number): number {
  const boosted = Math.round(b * 3.2);
  return boosted > 255 ? 255 : boosted;
}

export const SimulatorGrid = forwardRef<SimGridHandle>(function SimulatorGrid(
  _props,
  ref,
) {
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const modeRef = useRef<DisplayMode>("pixel");
  const lastBufferRef = useRef<Uint8ClampedArray | null>(null);

  const render = useCallback((buffer: Uint8ClampedArray) => {
    lastBufferRef.current = buffer;
    const isMask = modeRef.current === "mask";
    for (let y = 0; y < MATRIX_HEIGHT; y++) {
      for (let x = 0; x < MATRIX_WIDTH; x++) {
        const cell = cellRefs.current[y * MATRIX_WIDTH + x];
        if (!cell) continue;
        const idx = ledIndex(x, y);
        const base = idx * 3;
        const r = buffer[base];
        const g = buffer[base + 1];
        const b = buffer[base + 2];
        const lit = r > 0 || g > 0 || b > 0;
        const color = `rgb(${boostByte(r)},${boostByte(g)},${boostByte(b)})`;

        cell.classList.toggle("lit", lit);
        cell.classList.toggle("mask-mode", isMask);
        const ltrEl = cell.firstElementChild as HTMLElement | null;
        if (!ltrEl) continue;
        const letter = letterAt(x, y);
        if (isMask) {
          if (letter) {
            ltrEl.textContent = letter;
            cell.classList.remove("mask-blank");
          } else {
            ltrEl.textContent = "·";
            cell.classList.add("mask-blank");
          }
          cell.style.removeProperty("background");
          cell.style.setProperty("--c", color);
          ltrEl.style.color = lit ? color : "";
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
  }, []);

  const setMode = useCallback(
    (next: DisplayMode) => {
      if (next === modeRef.current) return;
      modeRef.current = next;
      if (lastBufferRef.current) render(lastBufferRef.current);
    },
    [render],
  );

  useImperativeHandle(ref, () => ({ render, setMode }), [render, setMode]);

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < MATRIX_HEIGHT; y++) {
    for (let x = 0; x < MATRIX_WIDTH; x++) {
      const idx = y * MATRIX_WIDTH + x;
      cells.push(
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
      <div className="sim-grid">{cells}</div>
    </div>
  );
});
