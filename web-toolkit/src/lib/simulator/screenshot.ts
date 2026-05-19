/**
 * Convert a SimulatorGrid snapshot into a designer-importable v4 Design JSON.
 *
 * The simulator and designer share the same hardware-presets list, so a 16×16
 * simulator screen maps to the "16x16" preset, an 8×8 to "8x8" (with the
 * LUMATRIX letter mask), etc. Wiring defaults match the LUMATRIX kit
 * (origin=bottom-left, axis=row, no serpentine), which is what the simulator's
 * NeoPixel buffer-to-cell mapping in simulator-grid.tsx assumes.
 */

import { LUMATRIX_MASK } from "@/lib/pixel-designer/config";
import { buildExportJSON } from "@/lib/pixel-designer/json-io";
import type { Design, Hardware } from "@/lib/pixel-designer/types";
import { presetIdFor } from "@/lib/hardware-presets";
import type { SimGridSnapshot } from "@/app/simulator/_components/simulator-grid";

export function buildScreenshotDesign(
  snap: SimGridSnapshot,
  label = "Simulator screenshot",
): Design {
  const presetId = presetIdFor(snap.width, snap.height);
  const isLumatrix = snap.width === 8 && snap.height === 8;
  const hw: Hardware = {
    presetId,
    width: snap.width,
    height: snap.height,
    origin: "bottom-left",
    axis: "row",
    serpentine: false,
    letterMask: isLumatrix ? LUMATRIX_MASK : "",
  };
  return {
    version: 4,
    colorMode: "rgb",
    hardware: { [presetId]: hw },
    pages: [
      {
        label,
        variants: {
          [presetId]: { pixels: snap.pixels.slice() },
        },
      },
    ],
  };
}

export function buildScreenshotJSON(
  snap: SimGridSnapshot,
  label?: string,
): string {
  return JSON.stringify(buildExportJSON(buildScreenshotDesign(snap, label)), null, 2);
}
