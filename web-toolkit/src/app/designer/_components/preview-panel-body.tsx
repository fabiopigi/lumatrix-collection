"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Config, DesignPage } from "@/lib/pixel-designer/types";

type Direction = "loop" | "pingpong";

const DEFAULT_FRAME_MS = 500;
const MIN_FRAME_MS = 20;
const MAX_PREVIEW_PX = 220;

/** Cell size scaled to fit the preview within a small fixed box, so an 8×8
 *  matrix renders chunky and a 32×32 still fits without overflowing. */
function previewCellSize(w: number, h: number, gap: number): number {
  const wMax = Math.floor((MAX_PREVIEW_PX - (w - 1) * gap) / w);
  const hMax = Math.floor((MAX_PREVIEW_PX - (h - 1) * gap) / h);
  return Math.max(4, Math.min(24, Math.min(wMax, hMax)));
}

interface PreviewPanelBodyProps {
  pages: DesignPage[];
  presetId: string;
  config: Config;
}

/** The animation-preview grid + play controls, sized to fit inside the
 *  designer's right-hand side panel. The component owns its playback timer,
 *  so unmounting it (e.g. when the section is collapsed) cleanly halts
 *  playback — there's no global "is preview running" state to chase. */
export function PreviewPanelBody({
  pages,
  presetId,
  config,
}: PreviewPanelBodyProps) {
  const [playing, setPlaying] = useState(true);
  const [direction, setDirection] = useState<Direction>("loop");
  const [frameIdx, setFrameIdx] = useState(0);
  // Tracks ping-pong direction without storing it as a separate boolean prop
  // on each frame — true means "going forward", flipped at each endpoint.
  const pingForwardRef = useRef(true);

  // If pages shrink (e.g., a page got deleted), read a clamped index for
  // rendering. We don't reset state here — the next timer tick naturally
  // walks back into range via the modulo / endpoint logic below.
  const safeIdx =
    pages.length === 0
      ? 0
      : Math.min(Math.max(0, frameIdx), pages.length - 1);

  // Auto-advance loop. Each frame schedules the next via setTimeout using
  // its own duration; that way changing a page's duration mid-playback is
  // picked up on the next tick instead of being baked into a single timer.
  useEffect(() => {
    if (!playing || pages.length < 2) return;
    const page = pages[safeIdx];
    const dur = Math.max(MIN_FRAME_MS, page?.duration ?? DEFAULT_FRAME_MS);
    const t = setTimeout(() => {
      setFrameIdx((current) => {
        if (direction === "loop") {
          return (current + 1) % pages.length;
        }
        if (pingForwardRef.current) {
          if (current + 1 >= pages.length) {
            pingForwardRef.current = false;
            return Math.max(0, current - 1);
          }
          return current + 1;
        }
        if (current - 1 < 0) {
          pingForwardRef.current = true;
          return Math.min(pages.length - 1, current + 1);
        }
        return current - 1;
      });
    }, dur);
    return () => clearTimeout(t);
  }, [playing, safeIdx, direction, pages]);

  const gap = 2;
  const cell = useMemo(
    () => previewCellSize(config.width, config.height, gap),
    [config.width, config.height],
  );
  const variant = pages[safeIdx]?.variants[presetId];
  const pixels = variant?.pixels;
  const stepW = cell + gap;
  const gridPxW = config.width * stepW - gap;
  const gridPxH = config.height * stepW - gap;

  const currentDur = pages[safeIdx]?.duration ?? DEFAULT_FRAME_MS;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        style={{
          width: gridPxW,
          height: gridPxH,
          position: "relative",
          background: "#1a1a1f",
          padding: 4,
          boxSizing: "content-box",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            width: gridPxW,
            height: gridPxH,
            position: "relative",
          }}
        >
          {Array.from({ length: config.width * config.height }, (_, i) => {
            const x = i % config.width;
            const y = Math.floor(i / config.width);
            const color = pixels?.[i] ?? null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x * stepW,
                  top: y * stepW,
                  width: cell,
                  height: cell,
                  background: color ?? "#0a0a0c",
                  borderRadius: Math.max(1, Math.floor(cell / 6)),
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px]">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="w-7 h-7 inline-flex items-center justify-center rounded cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDirection((d) => (d === "loop" ? "pingpong" : "loop"));
            pingForwardRef.current = true;
          }}
          className="w-7 h-7 inline-flex items-center justify-center rounded cursor-pointer bg-raised border border-line-strong text-foreground hover:bg-raised-hover"
          title={
            direction === "loop"
              ? "Loop (forward → wrap to start)"
              : "Ping-pong (forward then reverse)"
          }
        >
          {direction === "loop" ? "↻" : "↔"}
        </button>
        <div className="ml-1 flex items-baseline gap-1.5 font-mono text-fg-2">
          <span>
            {safeIdx + 1}/{pages.length}
          </span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-faint">{currentDur}ms</span>
        </div>
      </div>
    </div>
  );
}
