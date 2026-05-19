"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DisplayConfig,
  DEFAULT_DISPLAY,
  isLumatrix,
  loadDisplayConfig,
  saveDisplayConfig,
} from "@/lib/simulator/display-config";
import { createJoystick } from "@/lib/simulator/hardware/joystick";
import { createNeoPixel } from "@/lib/simulator/hardware/neopixel";
import { createSlide } from "@/lib/simulator/hardware/slide";
import * as launcher from "@/lib/simulator/launcher";
import { setRuntimeSignal } from "@/lib/simulator/runtime/time";
import * as screens from "@/lib/simulator/screens";
import type { App, DisplayMode, JoyButton } from "@/lib/simulator/types";
import { installUserAppRuntime } from "@/lib/simulator/user-app-runtime";
import {
  loadUserApp,
  readUserApps,
  writeUserApps,
  type UserAppSource,
} from "@/lib/simulator/user-apps";
import { AppLauncher } from "./app-launcher";
import { DisplayPicker } from "./display-picker";
import { JoystickPad } from "./joystick-pad";
import { ModeToggle } from "./mode-toggle";
import { SlideSwitch } from "./slide-switch";
import { SimulatorGrid, type SimGridHandle } from "./simulator-grid";
import { UserAppsPanel } from "./user-apps-panel";

export function Simulator() {
  const gridRef = useRef<SimGridHandle>(null);
  const [mode, setMode] = useState<DisplayMode>("pixel");
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  // Bumping this re-runs the launcher useEffect, which aborts the current
  // run and starts a fresh one (boot animation, menu, etc.).
  const [resetKey, setResetKey] = useState(0);
  // Start with the default; hydrate from localStorage on mount to keep
  // server and first-client renders identical.
  const [display, setDisplay] = useState<DisplayConfig>(DEFAULT_DISPLAY);
  useEffect(() => {
    setDisplay(loadDisplayConfig());
  }, []);

  const joy = useMemo(() => createJoystick(), []);
  const slide = useMemo(() => createSlide(), []);
  const builtInApps = useMemo(() => launcher.getApps(), []);

  // User apps live in localStorage; we compile each source string to an App
  // object on change. Compilation errors surface in the panel, not the grid.
  const [userAppSources, setUserAppSources] = useState<UserAppSource[]>([]);
  const [compiledUserApps, setCompiledUserApps] = useState<App[]>([]);
  const [appError, setAppError] = useState<
    { label: string; message: string } | null
  >(null);

  // Hydrate user apps + expose the simulator runtime under globalThis.lumatrix
  // before any user code runs. The setState-in-effect is the canonical
  // hydration shape for localStorage-backed values (matches setDisplay above).
  useEffect(() => {
    installUserAppRuntime();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserAppSources(readUserApps());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const compiled: App[] = [];
      for (const src of userAppSources) {
        try {
          compiled.push(await loadUserApp(src));
        } catch {
          // Skip apps that fail to compile; the panel surfaces the error
          // when the user tries to save them.
        }
      }
      if (!cancelled) setCompiledUserApps(compiled);
    })();
    return () => {
      cancelled = true;
    };
  }, [userAppSources]);

  const apps = useMemo(
    () => [...builtInApps, ...compiledUserApps],
    [builtInApps, compiledUserApps],
  );

  const handleUserAppsChange = useCallback((next: UserAppSource[]) => {
    setUserAppSources(next);
    writeUserApps(next);
    // The launcher effect depends on compiledUserApps, so it'll restart once
    // the recompile finishes — no manual resetKey bump needed.
  }, []);

  const handleDisplay = useCallback((next: DisplayConfig) => {
    setDisplay(next);
    saveDisplayConfig(next);
  }, []);

  // Mask mode is keyed to the LUMATRIX 8×8 word-clock layout — meaningless at
  // other sizes. Force back to "pixel" if the display moves off 8×8.
  const maskAvailable = isLumatrix(display);
  useEffect(() => {
    if (!maskAvailable && mode === "mask") setMode("pixel");
  }, [maskAvailable, mode]);

  const handleLaunch = useCallback((index: number) => {
    setActiveIdx(index);
    launcher.setPendingApp(index);
    screens.forceExit();
  }, []);

  const handleBackToLauncher = useCallback(() => {
    setActiveIdx(null);
    launcher.setPendingApp(null);
    screens.forceExit();
  }, []);

  const handleReset = useCallback(() => {
    setActiveIdx(null);
    launcher.setPendingApp(null);
    screens.forceExit();
    setResetKey((k) => k + 1);
  }, []);

  // Keep the highlighted app in sync with whatever the launcher is actually
  // running — covers hardware exits (center hold) and natural app endings.
  useEffect(() => launcher.onAppChange(setActiveIdx), []);

  // Expose the slide as a Pin on the joystick so apps (flappy, watch) can read
  // it as `joy.slide?.value()`, matching the Pico's joystick["slide"] dict.
  useMemo(() => {
    joy.slide = { value: () => slide.value() };
  }, [joy, slide]);

  useEffect(() => {
    const controller = new AbortController();
    setRuntimeSignal(controller.signal);

    // Single render path: each NeoPixel — whether a 64-LED LUMATRIX source
    // (for non-responsive apps + the launcher) or a full W×H buffer (for
    // responsive apps) — flushes here. The grid detects which by length and
    // chooses scale-up vs direct rendering.
    const createNp = (numLeds: number) =>
      createNeoPixel(numLeds, (buffer) => {
        gridRef.current?.render(buffer);
      });

    launcher
      .run({
        joy,
        display,
        createNeoPixel: createNp,
        userApps: compiledUserApps,
        onAppError: (app, err) => {
          const message = err instanceof Error ? err.message : String(err);
          setAppError({ label: app.NAME, message });
        },
      })
      .catch((err: unknown) => {
        const name = (err as { name?: string } | null)?.name;
        if (name !== "AbortError") console.error("simulator:", err);
      });

    return () => {
      controller.abort();
      setRuntimeSignal(null);
    };
    // Restart the whole runtime when the physical display dimensions change
    // or when the user hits Reset. Responsive apps need NeoPixels of a
    // different size; non-responsive apps need the grid to know the new
    // geometry too. Easier than coordinating a hot-swap.
  }, [joy, display, compiledUserApps, resetKey]);

  useEffect(() => {
    gridRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    const map: Record<string, JoyButton> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
      " ": "center",
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      ) {
        return;
      }
      const btn = map[e.key];
      if (btn) {
        e.preventDefault();
        joy.press(btn);
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        slide.toggle();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const btn = map[e.key];
      if (btn) {
        e.preventDefault();
        joy.release(btn);
      }
    };

    const onBlur = () => {
      (["up", "down", "left", "right", "center"] as JoyButton[]).forEach((b) =>
        joy.release(b),
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [joy, slide]);

  return (
    <div className="flex flex-col items-center gap-6 px-6 py-10">
      <div className="flex items-start gap-8 justify-center w-full max-w-[1100px]">
        <div className="flex flex-col gap-6">
          <DisplayPicker display={display} onChange={handleDisplay} />
          <AppLauncher
            apps={apps}
            activeIdx={activeIdx}
            onLaunch={handleLaunch}
            onBackToLauncher={handleBackToLauncher}
          />
          <UserAppsPanel
            apps={userAppSources}
            onChange={handleUserAppsChange}
            appError={appError}
            onDismissError={() => setAppError(null)}
          />
        </div>

        <div className="flex flex-col items-center gap-4">
          <SimulatorGrid ref={gridRef} display={display} />
          <ModeToggle
            mode={mode}
            onChange={setMode}
            maskAvailable={maskAvailable}
          />
        </div>

        <div className="flex flex-col items-center gap-4 w-48 shrink-0">
          <div className="text-[10px] uppercase tracking-[0.1em] text-muted font-semibold self-start">
            Input
          </div>
          <JoystickPad joy={joy} />
          <SlideSwitch slide={slide} />
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-panel border border-edge rounded-lg text-[11px] uppercase tracking-[0.12em] text-muted font-semibold hover:text-accent hover:border-accent transition-colors cursor-pointer select-none"
          >
            Reset
          </button>
        </div>
      </div>

      <p className="text-muted text-xs text-center max-w-md leading-[1.5] m-0">
        Navigate the on-display launcher with the D-pad. Tap center to select.
        Or use the quick-launch panel on the left to jump straight to an app.
        <br />
        Keyboard: arrows = D-pad · space = center · S = slide.
        <br />
        Hold center for 1.5 s during play to return to the launcher.
      </p>
    </div>
  );
}
