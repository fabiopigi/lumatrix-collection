"use client";

import {
  type DisplayConfig,
  DISPLAY_PRESETS,
  presetIdFor,
} from "@/lib/simulator/display-config";

interface DisplayPickerProps {
  display: DisplayConfig;
  onChange(next: DisplayConfig): void;
}

export function DisplayPicker({ display, onChange }: DisplayPickerProps) {
  const currentId = presetIdFor(display);

  return (
    <section className="flex flex-col gap-2 w-48 shrink-0">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted font-semibold">
        Display
      </div>
      <select
        value={currentId}
        onChange={(e) => {
          const preset = DISPLAY_PRESETS.find((p) => p.id === e.target.value);
          if (preset) {
            onChange({ width: preset.width, height: preset.height });
          }
        }}
        className="bg-panel-2 border border-edge text-foreground px-2 py-1.5 rounded text-[12px] outline-none cursor-pointer hover:border-[#3a3a42] focus:border-accent"
      >
        {DISPLAY_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-muted/80 leading-[1.45]">
        Apps render to a virtual 8×8 buffer; larger displays show that source
        scaled up and centred. Per-app responsive scaling is a follow-up — see
        each app&apos;s doc.
      </p>
    </section>
  );
}
