/**
 * Physical display size for the LumenSimulator.
 *
 * Apps always write to a virtual 8×8 NeoPixel buffer (the native
 * resolution). The SimulatorGrid scales that 8×8 source onto the configured
 * physical display by an integer factor, centred when the aspect ratio
 * doesn't match. Larger displays = each source pixel becomes an s×s block.
 *
 * This is the simplest path to "all apps work on any display size" without
 * touching the apps themselves. Per-app responsive scaling (apps that
 * actually USE the extra resolution) is a follow-up — see each app's doc.
 */

import {
  HARDWARE_PRESETS,
  presetIdFor as basePresetIdFor,
  type HardwarePreset,
} from "@/lib/hardware-presets";

export interface DisplayConfig {
  readonly width: number;
  readonly height: number;
}

export const SOURCE_WIDTH = 8;
export const SOURCE_HEIGHT = 8;

export const DEFAULT_DISPLAY: DisplayConfig = { width: 8, height: 8 };

export type DisplayPreset = HardwarePreset;
export const DISPLAY_PRESETS = HARDWARE_PRESETS;

const STORAGE_KEY = "lumenlab-simulator-display";
const MIN_DIM = 8;
const MAX_DIM = 64;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return MIN_DIM;
  const i = Math.floor(n);
  if (i < MIN_DIM) return MIN_DIM;
  if (i > MAX_DIM) return MAX_DIM;
  return i;
}

export function loadDisplayConfig(): DisplayConfig {
  if (typeof window === "undefined") return DEFAULT_DISPLAY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DISPLAY;
    const parsed = JSON.parse(raw) as Partial<DisplayConfig>;
    return {
      width: clamp(parsed.width ?? DEFAULT_DISPLAY.width),
      height: clamp(parsed.height ?? DEFAULT_DISPLAY.height),
    };
  } catch {
    return DEFAULT_DISPLAY;
  }
}

export function saveDisplayConfig(cfg: DisplayConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* localStorage disabled — silently ignore */
  }
}

/** Integer scale-up factor that fits the source 8×8 inside the display. */
export function displayScale(cfg: DisplayConfig): number {
  return Math.max(
    1,
    Math.min(
      Math.floor(cfg.width / SOURCE_WIDTH),
      Math.floor(cfg.height / SOURCE_HEIGHT),
    ),
  );
}

/** Top-left offset of the scaled 8×8 image inside the physical display. */
export function displayOffset(cfg: DisplayConfig): { x: number; y: number } {
  const s = displayScale(cfg);
  return {
    x: Math.floor((cfg.width - SOURCE_WIDTH * s) / 2),
    y: Math.floor((cfg.height - SOURCE_HEIGHT * s) / 2),
  };
}

/** Visual cell size in CSS pixels, chosen so the whole grid fits in
 *  ~520 px on its longer side. Larger displays get smaller cells. */
export function displayCellSize(cfg: DisplayConfig): number {
  const MAX_PX = 520;
  const longer = Math.max(cfg.width, cfg.height);
  const px = Math.floor(MAX_PX / longer);
  return Math.max(10, Math.min(48, px));
}

export function isLumatrix(cfg: DisplayConfig): boolean {
  return cfg.width === SOURCE_WIDTH && cfg.height === SOURCE_HEIGHT;
}

export function presetIdFor(cfg: DisplayConfig): string {
  return basePresetIdFor(cfg.width, cfg.height);
}
