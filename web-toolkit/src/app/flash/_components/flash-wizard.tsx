"use client";

import { useEffect, useState } from "react";
import {
  readCustomPicoApps,
  writeCustomPicoApps,
  type CustomPicoApp,
} from "@/lib/pico/custom-apps";
import {
  fetchManifest,
  type HardwarePreset,
  type PicoBundleManifest,
} from "@/lib/pico/manifest";
import { isWebSerialSupported } from "@/lib/pico/serial";
import { StepHardware } from "./step-hardware";
import { StepApps } from "./step-apps";
import { StepConnect } from "./step-connect";
import { StepUpload } from "./step-upload";

type Step = "hardware" | "apps" | "connect" | "upload";

const STEP_ORDER: Step[] = ["hardware", "apps", "connect", "upload"];

const STEP_LABELS: Record<Step, string> = {
  hardware: "Hardware",
  apps: "Apps",
  connect: "Connect",
  upload: "Upload",
};

export function FlashWizard() {
  const [manifest, setManifest] = useState<PicoBundleManifest | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("hardware");
  const [preset, setPreset] = useState<HardwarePreset | null>(null);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(() => new Set());
  const [customApps, setCustomApps] = useState<CustomPicoApp[]>([]);
  const [port, setPort] = useState<SerialPort | null>(null);
  // `null` = check pending (initial SSR/client mismatch protection); `false` =
  // browser doesn't expose Web Serial; `true` = ready to connect.
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    // Setting state once in an effect is the canonical way to hydrate values
    // that depend on browser-only globals (`navigator`, `localStorage`) —
    // server-rendered HTML stays neutral until the client takes over.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(isWebSerialSupported());
    setCustomApps(readCustomPicoApps());
  }, []);

  const handleCustomAppsChange = (next: CustomPicoApp[]) => {
    setCustomApps(next);
    writeCustomPicoApps(next);
  };

  useEffect(() => {
    let cancelled = false;
    fetchManifest()
      .then((m) => {
        if (cancelled) return;
        setManifest(m);
        // Default preset = 8×8, default apps = every "default: true" app,
        // plus any persisted custom apps so the user doesn't have to retick
        // them every time they reopen the page.
        const def = m.hardware_presets.find((p) => p.id === "8x8") ?? m.hardware_presets[0];
        if (def) setPreset(def);
        const builtInIds = m.apps.filter((a) => a.default).map((a) => a.id);
        const customIds = readCustomPicoApps().map((a) => a.id);
        setEnabledIds(new Set([...builtInIds, ...customIds]));
      })
      .catch((err) => {
        if (cancelled) return;
        setManifestError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stepIndex = STEP_ORDER.indexOf(step);

  const canBack = stepIndex > 0 && step !== "upload";
  const onBack = () => {
    if (canBack) setStep(STEP_ORDER[stepIndex - 1]);
  };

  const reset = () => {
    setStep("hardware");
    setPort(null);
    // Keep customApps — they're persisted and the user typically wants to
    // re-flash the same set or layer more apps on top.
    if (manifest) {
      const builtInIds = manifest.apps.filter((a) => a.default).map((a) => a.id);
      const customIds = customApps.map((a) => a.id);
      setEnabledIds(new Set([...builtInIds, ...customIds]));
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Lumen<span className="text-accent">Flash</span>
        </h1>
        <p className="mt-2 text-[13px] text-muted leading-relaxed max-w-prose">
          Install the LumenLab launcher and apps onto a Raspberry Pi Pico
          directly from your browser. Requires MicroPython firmware already
          on the Pico and a Chromium-based browser.
        </p>
      </header>

      <Stepper current={stepIndex} />

      <div className="mt-8">
        {manifestError && (
          <ErrorPanel
            title="Couldn't load the deploy bundle"
            message={manifestError}
            hint="Run `npm run bundle:pico` to regenerate /public/pico-bundle/, then reload."
          />
        )}
        {!manifest && !manifestError && (
          <p className="text-[12px] text-muted">Loading bundle manifest…</p>
        )}
        {manifest && step === "hardware" && (
          <StepHardware
            presets={manifest.hardware_presets}
            value={preset}
            onChange={setPreset}
            onContinue={() => setStep("apps")}
          />
        )}
        {manifest && step === "apps" && (
          <StepApps
            apps={manifest.apps}
            enabled={enabledIds}
            onChange={setEnabledIds}
            customApps={customApps}
            onCustomAppsChange={handleCustomAppsChange}
            onContinue={() => setStep("connect")}
          />
        )}
        {manifest && step === "connect" && (
          <StepConnect
            supported={supported}
            onConnected={(p) => {
              setPort(p);
              setStep("upload");
            }}
          />
        )}
        {manifest && step === "upload" && preset && port && (
          <StepUpload
            manifest={manifest}
            preset={preset}
            enabledIds={enabledIds}
            customApps={customApps}
            port={port}
            onReset={reset}
          />
        )}
      </div>

      {canBack && (
        <div className="mt-6">
          <button
            type="button"
            onClick={onBack}
            className="text-[12px] tracking-[0.04em] text-muted hover:text-foreground cursor-pointer"
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="mt-8 flex items-center gap-2 text-[11px] uppercase tracking-[0.1em]">
      {STEP_ORDER.map((s, i) => {
        const state = i < current ? "done" : i === current ? "active" : "todo";
        const color =
          state === "active"
            ? "text-accent"
            : state === "done"
              ? "text-foreground"
              : "text-fg-faint";
        return (
          <li key={s} className="flex items-center gap-2">
            <span className={`font-semibold ${color}`}>
              {i + 1}. {STEP_LABELS[s]}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <span className="text-muted/40">/</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ErrorPanel({
  title,
  message,
  hint,
}: {
  title: string;
  message: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-red-500/40 bg-red-500/10 px-4 py-3">
      <div className="text-[13px] font-semibold text-red-300">{title}</div>
      <pre className="mt-1 whitespace-pre-wrap text-[12px] text-red-200/90 leading-relaxed">
        {message}
      </pre>
      {hint && <p className="mt-2 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

