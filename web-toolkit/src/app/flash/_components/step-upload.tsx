"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { CustomPicoApp } from "@/lib/pico/custom-apps";
import type {
  HardwarePreset,
  PicoBundleManifest,
} from "@/lib/pico/manifest";
import {
  runUpload,
  type UploadEvent,
  type UploadFileState,
  type UploadPlanFile,
} from "@/lib/pico/uploader";

interface Props {
  manifest: PicoBundleManifest;
  preset: HardwarePreset;
  enabledIds: Set<string>;
  customApps: readonly CustomPicoApp[];
  port: SerialPort;
  onReset(): void;
}

type Phase = "running" | "done" | "failed";

export function StepUpload({
  manifest,
  preset,
  enabledIds,
  customApps,
  port,
  onReset,
}: Props) {
  const [files, setFiles] = useState<UploadFileState[]>([]);
  const [phase, setPhase] = useState<Phase>("running");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  // React 19 / Next dev runs effects twice on mount; the upload itself
  // is non-cancellable (open serial port, in-flight raw-REPL session), so
  // we guard against the second invocation rather than tearing it down.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const selectedBuiltIns = manifest.apps.filter((a) => enabledIds.has(a.id));
    const selectedCustom = customApps.filter((a) => enabledIds.has(a.id));
    const customPlanFiles: UploadPlanFile[] = selectedCustom.map((a) => ({
      src: `custom/${a.id}.py`,
      pico: `/apps/${a.id}.py`,
      contents: a.contents,
    }));
    const planFiles: UploadPlanFile[] = [
      ...manifest.core,
      ...manifest.data,
      ...selectedBuiltIns,
      ...customPlanFiles,
    ];

    const handle = (e: UploadEvent) => {
      switch (e.type) {
        case "files":
          setFiles(e.files.map((f) => ({ ...f })));
          break;
        case "progress":
          setFiles((cur) => {
            const next = cur.slice();
            const item = next[e.index];
            if (item) {
              next[e.index] = { ...item, status: e.status, error: e.error };
            }
            return next;
          });
          break;
        case "log":
          setLogs((cur) => [...cur, e.message]);
          break;
        case "done":
          setPhase("done");
          break;
        case "failed":
          setPhase("failed");
          setError(e.error);
          break;
      }
    };

    runUpload(
      port,
      {
        files: planFiles,
        config: {
          width: preset.width,
          height: preset.height,
          enabledIds: [
            ...selectedBuiltIns.map((a) => a.id),
            ...selectedCustom.map((a) => a.id),
          ],
        },
      },
      handle,
    );
    // No cleanup: the upload is non-cancellable (in-flight raw-REPL session)
    // and tearing it down with `cancelled = true` while the in-flight upload
    // keeps running would silently drop every UI event after a strict-mode
    // unmount. Stale setState calls on an unmounted component are a no-op in
    // modern React.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  const done = files
    .filter((f) => f.status === "done")
    .reduce((sum, f) => sum + f.bytes, 0);
  const pct = total > 0 ? Math.floor((done / total) * 100) : 0;

  return (
    <section>
      {phase === "done" ? (
        <div>
          <h2 className="lf-success-title">Success!</h2>
          <p className="mt-2 text-[13px] text-muted">
            Your Pico is rebooting — boot animation, then the launcher.
          </p>
        </div>
      ) : (
        <h2 className="text-[13px] font-semibold tracking-[0.04em] text-white">
          {phase === "running" && "Uploading…"}
          {phase === "failed" && "Upload failed"}
        </h2>
      )}

      {phase === "running" && (
        <p className="mt-2 text-[12px] text-muted">
          {logs.length > 0 ? logs[logs.length - 1] : "Starting…"}
        </p>
      )}

      {phase === "done" && <Confetti />}

      <div className="mt-4 rounded border border-edge bg-panel overflow-hidden">
        <div className="h-1.5 bg-panel-2">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="divide-y divide-edge">
          {files.map((f, i) => (
            <li
              key={f.src}
              className="flex items-center gap-3 px-3 py-2 text-[12px]"
            >
              <StatusIcon status={f.status} />
              <span className="font-mono text-foreground">{f.pico}</span>
              <span className="ml-auto text-[10px] text-muted/70">
                {formatBytes(f.bytes)}
              </span>
              {f.error && (
                <span className="text-red-300 text-[11px]">{f.error}</span>
              )}
              {/* index used to make sure the key is stable across renders */}
              <span className="sr-only">{i + 1}</span>
            </li>
          ))}
          {files.length === 0 && (
            <li className="px-3 py-3 text-[12px] text-muted">Preparing…</li>
          )}
        </ul>
      </div>

      {phase === "done" && (
        <div className="mt-5 space-y-3">
          <p className="text-[12px] text-muted leading-relaxed max-w-prose">
            If nothing happens on the Pico, unplug and replug it.
          </p>
          <button
            type="button"
            onClick={onReset}
            className="rounded border border-edge px-4 py-2 text-[12px] tracking-[0.04em] text-foreground cursor-pointer hover:border-accent"
          >
            Flash another
          </button>
        </div>
      )}

      {phase === "failed" && (
        <div className="mt-5">
          <pre className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-200/90 whitespace-pre-wrap">
            {error}
          </pre>
          <button
            type="button"
            onClick={onReset}
            className="mt-3 rounded border border-edge px-4 py-2 text-[12px] tracking-[0.04em] text-foreground cursor-pointer hover:border-accent"
          >
            Start over
          </button>
        </div>
      )}

      {logs.length > 0 && (
        <details className="mt-6" open>
          <summary className="text-[11px] tracking-[0.04em] text-muted cursor-pointer">
            Log ({logs.length} {logs.length === 1 ? "entry" : "entries"})
          </summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded border border-edge bg-panel px-3 py-2 text-[11px] text-muted/80 whitespace-pre-wrap">
            {logs.join("\n")}
          </pre>
        </details>
      )}
    </section>
  );
}

const CONFETTI_COLORS = [
  "#6cf",     // brand accent (light blue)
  "#80ffc0",  // mint
  "#ffc66c",  // amber
  "#ff80c0",  // pink
  "#a080ff",  // purple
  "#ffffff",
];

function Confetti() {
  // Generate piece configuration once per mount via useState's lazy init —
  // Math.random() isn't pure so useMemo would trip the react-hooks/purity
  // rule. We just need one stable random layout for the lifetime of the
  // mount; nothing depends on it afterwards.
  const [pieces] = useState(() => {
    const out: Array<{ id: number; style: CSSProperties }> = [];
    for (let i = 0; i < 90; i++) {
      const startX = Math.random() * 100; // %
      const drift = (Math.random() - 0.5) * 240; // px, lateral wander
      const width = 6 + Math.random() * 6;
      const height = 10 + Math.random() * 10;
      const rotStart = Math.random() * 360;
      const rotEnd = rotStart + 360 + Math.random() * 720;
      const duration = 2.2 + Math.random() * 2.2;
      const delay = Math.random() * 0.3;
      const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
      out.push({
        id: i,
        style: {
          left: `${startX}%`,
          "--lf-w": `${width}px`,
          "--lf-h": `${height}px`,
          "--lf-color": color,
          "--lf-x-start": `0px`,
          "--lf-x-end": `${drift}px`,
          "--lf-rot-start": `${rotStart}deg`,
          "--lf-rot-end": `${rotEnd}deg`,
          "--lf-duration": `${duration}s`,
          "--lf-delay": `${delay}s`,
        } as CSSProperties,
      });
    }
    return out;
  });

  return (
    <div className="lf-confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <span key={p.id} className="lf-confetti-piece" style={p.style} />
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: UploadFileState["status"] }) {
  if (status === "done") {
    return <span className="text-accent">✓</span>;
  }
  if (status === "uploading") {
    return <span className="text-accent animate-pulse">●</span>;
  }
  if (status === "failed") {
    return <span className="text-red-400">✗</span>;
  }
  return <span className="text-muted/40">○</span>;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
