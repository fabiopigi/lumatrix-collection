"use client";

import { forwardRef } from "react";
import { CELL_GAP, getCellLetter } from "@/lib/pixel-designer/config";
import type {
  Annotation,
  Config,
  Mode,
  Preview,
  Selection,
} from "@/lib/pixel-designer/types";

interface PixelGridProps {
  config: Config;
  pixels: (string | null)[];
  mode: Mode;
  cellSize: number;
  preview: Preview | null;
  selection: Selection | null;
  isActive: boolean;
  annotations?: Annotation[];
  showAnnotations?: boolean;
}

export const PixelGrid = forwardRef<HTMLDivElement, PixelGridProps>(
  function PixelGrid(
    {
      config,
      pixels,
      mode,
      cellSize,
      preview,
      selection,
      isActive,
      annotations,
      showAnnotations,
    },
    ref,
  ) {
    const isMask = mode === "mask";
    const isLed = mode === "led";
    const step = cellSize + CELL_GAP;

    const previewMap = new Map<number, { color: string; ghost: boolean }>();
    if (isActive && preview) {
      for (const p of preview.points) {
        if (p.x < 0 || p.x >= config.width || p.y < 0 || p.y >= config.height)
          continue;
        const key = p.y * config.width + p.x;
        previewMap.set(key, { color: p.color, ghost: !!p.ghost });
      }
    }

    const floatingMap = new Map<number, string>();
    if (isActive && selection?.floating) {
      for (let dy = 0; dy < selection.h; dy++) {
        for (let dx = 0; dx < selection.w; dx++) {
          const c = selection.contents[dy * selection.w + dx];
          if (!c) continue;
          const tx = selection.x + dx;
          const ty = selection.y + dy;
          if (tx < 0 || tx >= config.width || ty < 0 || ty >= config.height)
            continue;
          floatingMap.set(ty * config.width + tx, c);
        }
      }
    }

    const cells: React.ReactNode[] = [];
    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const idx = y * config.width + x;
        const stored = pixels[idx];
        const previewEntry = previewMap.get(idx);
        const floatingColor = floatingMap.get(idx);

        let color: string | null = stored;
        let isPreview = false;
        let isGhost = false;
        let ghostColor: string | null = null;

        if (previewEntry) {
          if (previewEntry.ghost) {
            isGhost = true;
            ghostColor = previewEntry.color;
          } else {
            color = previewEntry.color;
            isPreview = true;
          }
        }
        if (floatingColor) {
          color = floatingColor;
          isPreview = true;
        }

        const letter = isMask ? getCellLetter(config, x, y) : "";
        const classes = ["pd-cell"];
        if (isMask) classes.push("mask-mode");
        if (isLed) classes.push("led-mode");
        if (color) classes.push("lit");
        if (isPreview) classes.push("preview");
        if (isGhost) classes.push("ghost");
        if (isMask && !letter) classes.push("mask-blank");

        const style: React.CSSProperties & Record<string, string | undefined> = {};
        if (color) {
          style["--c"] = color;
          // LED + mask modes drive the cell appearance entirely from CSS
          // (stacked radial gradients / letter cutouts) using --c; only
          // pixel mode wants a flat inline background.
          if (!isMask && !isLed) style.background = color;
        }
        if (isGhost && ghostColor) {
          style["--gc"] = ghostColor;
        }

        cells.push(
          <div
            key={idx}
            className={classes.join(" ")}
            data-x={x}
            data-y={y}
            style={style}
          >
            <div className="pd-letter">
              {isMask ? (letter ? letter : "·") : ""}
            </div>
          </div>,
        );
      }
    }

    const wrapStyle: React.CSSProperties = {
      "--cols": config.width,
      "--rows": config.height,
      "--cell-size": `${cellSize}px`,
      "--gap-size": `${CELL_GAP}px`,
    } as React.CSSProperties;

    let selectionRect: React.ReactNode = null;
    if (isActive && selection) {
      selectionRect = (
        <div
          className="pd-selection-rect"
          style={{
            left: selection.x * step - 2,
            top: selection.y * step - 2,
            width: selection.w * step - CELL_GAP + 4,
            height: selection.h * step - CELL_GAP + 4,
          }}
        />
      );
    }

    const annoElements: React.ReactNode[] = [];
    if (isActive && showAnnotations && annotations) {
      for (const a of annotations) {
        annoElements.push(
          <div
            key={a.id}
            className="pd-anno-rect"
            style={{
              left: a.x * step - 2,
              top: a.y * step - 2,
              width: a.w * step - CELL_GAP + 4,
              height: a.h * step - CELL_GAP + 4,
            }}
          >
            <div className="pd-anno-label" title={a.text}>
              {a.text}
            </div>
          </div>,
        );
      }
    }

    return (
      <div
        className="relative bg-panel-2 p-[14px] rounded-[10px]"
        style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.02)" }}
      >
        <div ref={ref} className="pd-grid" style={wrapStyle}>
          {cells}
          {annoElements}
          {selectionRect}
        </div>
      </div>
    );
  },
);
