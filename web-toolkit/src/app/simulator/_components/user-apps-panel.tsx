"use client";

/**
 * Manages user-uploaded simulator apps. Custom apps are stored in
 * localStorage (`lumatrix.userApps.v1`) and appear after the built-ins
 * in the quick-launch rail and on-display menu.
 *
 * Apps run in the main thread without sandboxing — a buggy app may
 * freeze the simulator and the user recovers by reloading the page.
 * This is called out in the panel UI so the tradeoff is visible.
 */

import { useEffect, useRef, useState } from "react";
import {
  generateUserAppId,
  loadUserApp,
  UserAppLoadError,
  type UserAppSource,
} from "@/lib/simulator/user-apps";

interface Props {
  apps: readonly UserAppSource[];
  onChange(next: UserAppSource[]): void;
  appError: { label: string; message: string } | null;
  onDismissError(): void;
}

interface EditorState {
  mode: "new" | "edit";
  id?: string;
  label: string;
  code: string;
  error: string | null;
}

const STARTER_TEMPLATE = `// User app for the LumenSimulator.
// The 'lumatrix' global exposes the simulator runtime (screens, sleep_ms, …).
const { screens, sleep_ms } = globalThis.lumatrix;

export const NAME = "MyApp";
// export const RESPONSIVE = true;  // opt in to W×H buffer; default 8×8 source.

export async function run(np, joy, display, screensNp) {
  screens.init(screensNp ?? np, joy, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    // Tiny demo: fill the matrix dim blue for 1.5 s, then game-over screen.
    const n = (display?.width ?? 8) * (display?.height ?? 8);
    for (let i = 0; i < n; i++) np[i] = [0, 0, 24];
    np.write();
    await sleep_ms(1500);
    if ((await screens.game_over_screen(10)) === "exit") return;
  }
}
`;

export function UserAppsPanel({ apps, onChange, appError, onDismissError }: Props) {
  const [editor, setEditor] = useState<EditorState | null>(null);

  const startNew = () => {
    setEditor({
      mode: "new",
      label: "",
      code: STARTER_TEMPLATE,
      error: null,
    });
  };

  const startEdit = (src: UserAppSource) => {
    setEditor({
      mode: "edit",
      id: src.id,
      label: src.label,
      code: src.code,
      error: null,
    });
  };

  const close = () => setEditor(null);

  const handleSave = async (state: EditorState) => {
    const label = state.label.trim() || "Custom app";
    try {
      const probe = await loadUserApp({
        id: state.id ?? "_probe",
        code: state.code,
        label,
        createdAt: 0,
        updatedAt: 0,
      });
      const effectiveLabel = state.label.trim() || probe.NAME;
      const now = Date.now();
      if (state.mode === "new") {
        const id = generateUserAppId(effectiveLabel);
        onChange([
          ...apps,
          {
            id,
            label: effectiveLabel,
            code: state.code,
            createdAt: now,
            updatedAt: now,
          },
        ]);
      } else {
        onChange(
          apps.map((a) =>
            a.id === state.id
              ? { ...a, label: effectiveLabel, code: state.code, updatedAt: now }
              : a,
          ),
        );
      }
      setEditor(null);
    } catch (err) {
      const message =
        err instanceof UserAppLoadError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setEditor({ ...state, error: message });
    }
  };

  const handleRemove = (id: string) => {
    onChange(apps.filter((a) => a.id !== id));
  };

  return (
    <aside className="flex flex-col gap-2 w-48 shrink-0">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted font-semibold">
        Custom apps
      </div>

      {appError && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200/90 leading-snug">
          <div className="font-semibold text-red-200">
            {appError.label} crashed
          </div>
          <div className="mt-0.5 break-words">{appError.message}</div>
          <button
            type="button"
            onClick={onDismissError}
            className="mt-1 text-[10px] text-muted hover:text-red-200 cursor-pointer underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {apps.length === 0 ? (
        <p className="text-[10px] text-muted/70 leading-[1.45]">
          Paste an LLM-generated JS app to try it in the simulator without
          touching the codebase.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {apps.map((src) => (
            <div
              key={src.id}
              className="rounded border border-edge bg-panel-2 px-2 py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium text-white truncate">
                  {src.label}
                </span>
                <span className="ml-auto text-[9px] uppercase tracking-[0.08em] text-muted/70">
                  custom
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => startEdit(src)}
                  className="text-muted hover:text-accent cursor-pointer"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(src.id)}
                  className="text-muted hover:text-red-300 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={startNew}
        className="mt-1 text-[11px] px-2 py-1 rounded border border-dashed border-edge text-muted hover:text-accent hover:border-accent cursor-pointer"
      >
        + Add custom app
      </button>

      <p className="text-[10px] text-muted/70 leading-[1.45] mt-2">
        Custom apps run in the same browser tab. A bug in your app can freeze
        the simulator — reload the page to recover.
      </p>

      {editor && (
        <EditorModal
          state={editor}
          onChange={setEditor}
          onCancel={close}
          onSave={handleSave}
        />
      )}
    </aside>
  );
}

interface EditorModalProps {
  state: EditorState;
  onChange(next: EditorState): void;
  onCancel(): void;
  onSave(state: EditorState): void;
}

function EditorModal({ state, onChange, onCancel, onSave }: EditorModalProps) {
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    onChange({
      ...state,
      code: text,
      label: state.label || file.name.replace(/\.m?js$/i, ""),
      error: null,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(state);
    } finally {
      setSaving(false);
    }
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
            {state.mode === "new" ? "Add custom app" : `Edit ${state.label}`}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto text-muted hover:text-foreground text-[12px] cursor-pointer"
          >
            ✕ Close
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted">
            Display name
          </span>
          <input
            type="text"
            value={state.label}
            onChange={(e) => onChange({ ...state, label: e.target.value })}
            placeholder="Defaults to the app's NAME export"
            className="rounded border border-edge bg-panel-2 px-2 py-1.5 text-[13px] text-white"
          />
        </label>

        <div className="flex items-center gap-3 text-[11px]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded border border-edge bg-panel-2 px-2 py-1 text-muted hover:text-accent hover:border-accent cursor-pointer"
          >
            Load .js file
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".js,.mjs,text/javascript"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <span className="text-muted/70">…or paste the JS below.</span>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.1em] text-muted">
            JavaScript source
          </span>
          <textarea
            value={state.code}
            onChange={(e) =>
              onChange({ ...state, code: e.target.value, error: null })
            }
            spellCheck={false}
            className="rounded border border-edge bg-panel-2 px-3 py-2 text-[12px] font-mono leading-[1.5] text-white min-h-[320px]"
          />
        </label>

        {state.error && (
          <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[12px] text-red-200/90 whitespace-pre-wrap">
            {state.error}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1">
          <button
            type="submit"
            disabled={saving || state.code.trim().length === 0}
            className="rounded bg-accent px-3 py-1.5 text-[12px] font-semibold text-black disabled:opacity-40 cursor-pointer hover:bg-accent/90"
          >
            {saving ? "Validating…" : "Save"}
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
