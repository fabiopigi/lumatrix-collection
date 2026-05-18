"use client";

import type { BundleApp } from "@/lib/pico/manifest";

interface Props {
  apps: readonly BundleApp[];
  enabled: Set<string>;
  onChange(next: Set<string>): void;
  onContinue(): void;
}

export function StepApps({ apps, enabled, onChange, onContinue }: Props) {
  const toggle = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const all = () => onChange(new Set(apps.map((a) => a.id)));
  const none = () => onChange(new Set());

  const canContinue = enabled.size > 0;

  return (
    <section>
      <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white">
        Pick the apps to install
      </h2>
      <p className="mt-1 text-[12px] text-muted leading-relaxed max-w-prose">
        The launcher will show the selected apps in this order. Untick any
        you don&apos;t want on the Pico — they won&apos;t be uploaded or imported, so
        the device stays leaner.
      </p>

      <div className="mt-4 flex items-center gap-3 text-[11px]">
        <button
          type="button"
          onClick={all}
          className="text-muted hover:text-foreground cursor-pointer"
        >
          Select all
        </button>
        <span className="text-muted/40">/</span>
        <button
          type="button"
          onClick={none}
          className="text-muted hover:text-foreground cursor-pointer"
        >
          None
        </button>
        <span className="ml-auto text-muted">
          {enabled.size} of {apps.length} selected
        </span>
      </div>

      <ul className="mt-3 divide-y divide-edge rounded border border-edge overflow-hidden">
        {apps.map((app) => {
          const checked = enabled.has(app.id);
          return (
            <li key={app.id}>
              <label className="flex items-center gap-3 px-3 py-2.5 bg-panel hover:bg-panel-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(app.id)}
                  className="accent-accent"
                />
                <span className="text-[13px] tracking-[0.02em] text-white">
                  {app.name}
                </span>
                {!app.default && (
                  <span className="text-[10px] uppercase tracking-[0.1em] text-muted/60">
                    extra
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted/50 font-mono">
                  {app.id}.py
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-6">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="rounded bg-accent px-4 py-2 text-[12px] font-semibold tracking-[0.04em] text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-accent/90"
        >
          Continue →
        </button>
      </div>
    </section>
  );
}
