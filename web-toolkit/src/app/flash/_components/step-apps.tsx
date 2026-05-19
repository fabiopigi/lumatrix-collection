"use client";

import { useEffect, useRef, useState } from "react";
import {
  extractName,
  isValidAppId,
  slugifyAppId,
  validatePicoApp,
  type CustomPicoApp,
} from "@/lib/pico/custom-apps";
import type { BundleApp } from "@/lib/pico/manifest";

interface Props {
  apps: readonly BundleApp[];
  enabled: Set<string>;
  onChange(next: Set<string>): void;
  customApps: readonly CustomPicoApp[];
  onCustomAppsChange(next: CustomPicoApp[]): void;
  onContinue(): void;
}

type EditorState =
  | { mode: "new" }
  | { mode: "edit"; app: CustomPicoApp };

export function StepApps({
  apps,
  enabled,
  onChange,
  customApps,
  onCustomAppsChange,
  onContinue,
}: Props) {
  const [editor, setEditor] = useState<EditorState | null>(null);

  const toggle = (id: string) => {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const handleSave = (app: CustomPicoApp, previousId?: string) => {
    // Drop the previous record (handles id renames in edit mode and dedupes
    // against an existing slot with the same new id).
    const dropIds = new Set([app.id, ...(previousId ? [previousId] : [])]);
    const next = customApps.filter((a) => !dropIds.has(a.id));
    next.push(app);
    onCustomAppsChange(next);

    const enabledNext = new Set(enabled);
    if (previousId && previousId !== app.id) enabledNext.delete(previousId);
    enabledNext.add(app.id);
    onChange(enabledNext);

    setEditor(null);
  };

  const handleRemove = (id: string) => {
    onCustomAppsChange(customApps.filter((a) => a.id !== id));
    const enabledNext = new Set(enabled);
    enabledNext.delete(id);
    onChange(enabledNext);
  };

  const allBuiltInIds = apps.map((a) => a.id);
  const all = () =>
    onChange(new Set([...allBuiltInIds, ...customApps.map((a) => a.id)]));
  const none = () => onChange(new Set());

  const canContinue = enabled.size > 0;
  const totalCount = apps.length + customApps.length;
  const soleEnabledName =
    enabled.size === 1
      ? (() => {
          const id = [...enabled][0];
          const match =
            apps.find((a) => a.id === id) ??
            customApps.find((a) => a.id === id);
          return match?.name ?? id;
        })()
      : null;

  return (
    <section>
      <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white">
        Pick the apps to install
      </h2>
      <p className="mt-1 text-[12px] text-muted leading-relaxed max-w-prose">
        The launcher will show the selected apps in this order. Untick any
        you don&apos;t want on the Pico — they won&apos;t be uploaded or imported, so
        the device stays leaner. Add a custom .py to flash an LLM-generated
        app alongside the built-ins.
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
          {enabled.size} of {totalCount} selected
        </span>
      </div>

      {enabled.size === 1 && (
        <div className="mt-3 rounded border border-accent/40 bg-accent/10 px-3 py-2 text-[11px] text-accent/90 leading-snug">
          <span className="font-semibold text-accent">Single-app mode:</span>{" "}
          with only one app selected, the Pico will boot straight into{" "}
          <code className="font-mono text-accent">{soleEnabledName}</code> —
          the launcher menu and loading spinner are skipped, and the
          game-over screen returns directly to gameplay.
        </div>
      )}

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
        {customApps.map((app) => {
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
                <span className="text-[10px] uppercase tracking-[0.1em] text-accent">
                  custom
                </span>
                <span className="ml-auto text-[10px] text-muted/50 font-mono">
                  {app.id}.py
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setEditor({ mode: "edit", app });
                  }}
                  className="text-[10px] text-muted hover:text-accent cursor-pointer"
                >
                  edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemove(app.id);
                  }}
                  className="text-[10px] text-muted hover:text-red-300 cursor-pointer"
                >
                  remove
                </button>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setEditor({ mode: "new" })}
          className="text-[11px] px-3 py-1.5 rounded border border-dashed border-edge text-muted hover:text-accent hover:border-accent cursor-pointer"
        >
          + Add custom .py
        </button>
      </div>

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

      {editor && (
        <CustomAppEditorModal
          state={editor}
          existingIds={new Set([
            ...apps.map((a) => a.id),
            ...customApps.map((a) => a.id),
          ])}
          onCancel={() => setEditor(null)}
          onSave={handleSave}
        />
      )}
    </section>
  );
}

interface CustomAppEditorModalProps {
  state: EditorState;
  existingIds: Set<string>;
  onCancel(): void;
  onSave(app: CustomPicoApp, previousId?: string): void;
}

function CustomAppEditorModal({
  state,
  existingIds,
  onCancel,
  onSave,
}: CustomAppEditorModalProps) {
  const isEdit = state.mode === "edit";
  const previousId = isEdit ? state.app.id : undefined;

  const [contents, setContents] = useState(isEdit ? state.app.contents : "");
  const [id, setId] = useState(isEdit ? state.app.id : "");
  // In edit mode the user has already committed to an id; if they tweak it
  // we want their input to win immediately. In add mode, only flip after a
  // manual edit so auto-derivation still works.
  const [idTouched, setIdTouched] = useState(isEdit);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Auto-derive the id from the .py NAME when the user hasn't manually set it.
  const derivedName = contents ? extractName(contents, "") : "";
  const effectiveId = idTouched
    ? id
    : derivedName
      ? slugifyAppId(derivedName)
      : "";

  const handleFile = async (file: File) => {
    const text = await file.text();
    setContents(text);
    if (!idTouched) {
      const base = file.name.replace(/\.py$/i, "");
      setId(slugifyAppId(base));
    }
  };

  const validation = validatePicoApp(contents);
  // In edit mode, the original id isn't a collision against itself.
  const idClashes =
    existingIds.has(effectiveId) && effectiveId !== previousId;
  const idError =
    effectiveId.length === 0
      ? "Pick a module name."
      : !isValidAppId(effectiveId)
        ? "Module name must start with a letter and contain only lowercase letters, digits, and underscores."
        : idClashes
          ? "That id is already in use. Pick a different one."
          : null;

  const canSubmit = contents.trim().length > 0 && !idError;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const name = derivedName || effectiveId;
    onSave(
      { id: effectiveId, name, contents },
      previousId,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6 py-8"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-3xl max-h-full overflow-auto rounded-lg border border-edge bg-panel p-5 flex flex-col gap-3"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-[14px] font-semibold text-white">
            {isEdit ? `Edit ${state.app.name}` : "Add custom .py"}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto text-muted hover:text-foreground text-[12px] cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-edge bg-panel-2 px-2 py-1 text-muted hover:text-accent hover:border-accent cursor-pointer"
          >
            Load .py file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".py,text/x-python"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <span className="text-muted/70">…or paste the source below.</span>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted">
            Module name (saved to /apps/&lt;id&gt;.py)
          </span>
          <input
            type="text"
            value={effectiveId}
            onChange={(e) => {
              setIdTouched(true);
              setId(e.target.value);
            }}
            className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-[13px] text-white font-mono"
            placeholder="auto-derived from NAME"
          />
          {idError && (
            <span className="text-[11px] text-red-300">{idError}</span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted">
            Python source
          </span>
          <textarea
            value={contents}
            onChange={(e) => setContents(e.target.value)}
            spellCheck={false}
            className="rounded border border-edge bg-panel-2 px-3 py-2 text-[12px] font-mono leading-[1.5] text-white min-h-[320px]"
          />
        </label>

        {validation.warnings.length > 0 && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90 space-y-1">
            <div className="font-semibold text-amber-200">Heads-up:</div>
            <ul className="list-disc pl-4">
              {validation.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <div className="text-amber-200/80">
              The Pico will still try to import it — these checks are advisory.
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-1">
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded bg-accent px-3 py-1.5 text-[12px] font-semibold text-black disabled:opacity-40 cursor-pointer hover:bg-accent/90"
          >
            {isEdit ? "Save changes" : "Add app"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[12px] text-muted hover:text-foreground cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
