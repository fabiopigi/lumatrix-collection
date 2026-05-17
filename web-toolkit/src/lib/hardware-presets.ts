/**
 * Shared hardware-size presets for the LumenSimulator and LumenDesigner.
 * The canonical list lives in shared/hardware-presets.json so both surfaces
 * (and any future tooling) read from a single source.
 */

import presetsData from "../../../shared/hardware-presets.json";

export interface HardwarePreset {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export const HARDWARE_PRESETS: readonly HardwarePreset[] =
  presetsData.presets as readonly HardwarePreset[];

export function presetIdFor(width: number, height: number): string {
  const match = HARDWARE_PRESETS.find(
    (p) => p.width === width && p.height === height,
  );
  return match?.id ?? "custom";
}

/** Stable, canonical order for an arbitrary set of preset ids: canonical
 *  hardware first (in HARDWARE_PRESETS order), then any custom ids sorted
 *  alphabetically. Used everywhere variants/hardware are listed so the order
 *  doesn't depend on which variant the user happened to create first. */
export function presetIdsInOrder(ids: Iterable<string>): string[] {
  const set = new Set(ids);
  const out: string[] = [];
  for (const p of HARDWARE_PRESETS) {
    if (set.has(p.id)) {
      out.push(p.id);
      set.delete(p.id);
    }
  }
  return [...out, ...Array.from(set).sort()];
}
