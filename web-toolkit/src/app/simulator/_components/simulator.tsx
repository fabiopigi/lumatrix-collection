"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createJoystick } from "@/lib/simulator/hardware/joystick";
import { createNeoPixel } from "@/lib/simulator/hardware/neopixel";
import { createSlide } from "@/lib/simulator/hardware/slide";
import { NUM_LEDS } from "@/lib/simulator/letter-mask";
import * as launcher from "@/lib/simulator/launcher";
import { setRuntimeSignal } from "@/lib/simulator/runtime/time";
import type { DisplayMode, JoyButton } from "@/lib/simulator/types";
import { JoystickPad } from "./joystick-pad";
import { ModeToggle } from "./mode-toggle";
import { SlideSwitch } from "./slide-switch";
import { SimulatorGrid, type SimGridHandle } from "./simulator-grid";

export function Simulator() {
  const gridRef = useRef<SimGridHandle>(null);
  const [mode, setMode] = useState<DisplayMode>("pixel");

  const joy = useMemo(() => createJoystick(), []);
  const slide = useMemo(() => createSlide(), []);

  useEffect(() => {
    const controller = new AbortController();
    setRuntimeSignal(controller.signal);

    const np = createNeoPixel(NUM_LEDS, (buffer) => {
      gridRef.current?.render(buffer);
    });

    launcher.run(np, joy).catch((err: unknown) => {
      const name = (err as { name?: string } | null)?.name;
      if (name !== "AbortError") console.error("simulator:", err);
    });

    return () => {
      controller.abort();
      setRuntimeSignal(null);
    };
  }, [joy]);

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
    <div className="flex flex-col items-center gap-8 px-6 py-10">
      <SimulatorGrid ref={gridRef} />

      <div className="flex flex-col items-center gap-[18px]">
        <ModeToggle mode={mode} onChange={setMode} />

        <div className="flex gap-6 items-stretch">
          <JoystickPad joy={joy} />
          <SlideSwitch slide={slide} />
        </div>

        <p className="text-muted text-xs text-center max-w-md leading-[1.5] m-0">
          Navigate the launcher with the D-pad. Tap center to select.
          <br />
          Keyboard: arrows = D-pad · space = center · S = slide.
          <br />
          Hold center for 1.5 s to return to the launcher.
        </p>
      </div>
    </div>
  );
}
