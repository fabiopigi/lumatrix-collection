"use client";

import { HARDWARE_PRESETS } from "@/lib/hardware-presets";
import type { Design } from "@/lib/pixel-designer/types";

interface VariantPickerProps {
  design: Design;
  activePreset: string;
  onChange: (id: string) => void;
}

/** Header dropdown that switches the editor's active variant. Shows only
 *  presets that already exist in the design; new ones are added from the
 *  per-page Variants strip. Label flips between "Hardware" (every page has
 *  the same single variant) and "Editing" (at least one page has multiple
 *  variants — picking here changes which one fills the canvas). */
export function VariantPicker({
  design,
  activePreset,
  onChange,
}: VariantPickerProps) {
  const presetIds = Object.keys(design.hardware);

  // "Variant mode" = the design has more than one preset's hardware defined,
  // or any individual page has more than one variant. Either makes the picker
  // a variant selector rather than a hardware spec.
  let isVariantMode = presetIds.length > 1;
  if (!isVariantMode) {
    for (const p of design.pages) {
      if (Object.keys(p.variants).length > 1) {
        isVariantMode = true;
        break;
      }
    }
  }
  const label = isVariantMode ? "Editing" : "Hardware";

  const presetLabel = (id: string) =>
    HARDWARE_PRESETS.find((p) => p.id === id)?.label ?? id;

  return (
    <label className="flex items-center gap-1.5 text-[11px] text-[#aaa]">
      <span className="font-medium tracking-[0.02em] text-[#888]">
        {label}:
      </span>
      <select
        value={activePreset}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[#22222a] border border-[#2f2f37] text-foreground px-2 py-1 rounded text-[11px] outline-none cursor-pointer hover:bg-[#2c2c34] focus:border-[#4a90e2]"
      >
        {presetIds.map((id) => (
          <option key={id} value={id}>
            {presetLabel(id)}
          </option>
        ))}
      </select>
    </label>
  );
}
