/**
 * Shared hardware-size presets for the LumenSimulator and LumenDesigner.
 * Both surfaces present the same canonical list so a design made in one fits
 * naturally onto a display configured in the other.
 */

export interface HardwarePreset {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export const HARDWARE_PRESETS: readonly HardwarePreset[] = [
  { id: "8x8", label: "8×8 (LumaTrix)", width: 8, height: 8 },
  { id: "16x16", label: "16×16", width: 16, height: 16 },
  { id: "32x8", label: "32×8 (landscape)", width: 32, height: 8 },
  { id: "8x32", label: "8×32 (portrait)", width: 8, height: 32 },
  { id: "32x32", label: "32×32", width: 32, height: 32 },
];

export function presetIdFor(width: number, height: number): string {
  const match = HARDWARE_PRESETS.find(
    (p) => p.width === width && p.height === height,
  );
  return match?.id ?? "custom";
}
