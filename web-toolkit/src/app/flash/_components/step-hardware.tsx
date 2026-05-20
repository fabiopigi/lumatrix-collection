"use client";

import type { HardwarePreset } from "@/lib/pico/manifest";

interface Props {
  presets: readonly HardwarePreset[];
  value: HardwarePreset | null;
  onChange(p: HardwarePreset): void;
  onContinue(): void;
}

export function StepHardware({ presets, value, onChange, onContinue }: Props) {
  return (
    <section>
      <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white">
        Pick your display
      </h2>
      <p className="mt-1 text-[12px] text-muted leading-relaxed max-w-prose">
        The launcher adapts to whatever size you select. Classic 8×8 apps
        still run, integer-scaled and centred on bigger panels.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {presets.map((p) => {
          const selected = value?.id === p.id;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onChange(p)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors cursor-pointer ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-edge bg-panel hover:border-accent/40"
                }`}
              >
                <div className="text-[13px] font-semibold tracking-[0.04em] text-white">
                  {p.label}
                </div>
                <div className="mt-1 text-[11px] text-muted">
                  {p.width} × {p.height} pixels
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <button
          type="button"
          disabled={!value}
          onClick={onContinue}
          className="rounded bg-accent px-4 py-2 text-[12px] font-semibold tracking-[0.04em] text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-accent/90"
        >
          Continue →
        </button>
      </div>
    </section>
  );
}
