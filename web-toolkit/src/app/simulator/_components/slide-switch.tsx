"use client";

import { useEffect, useState } from "react";
import type { Slide } from "@/lib/simulator/types";

interface SlideSwitchProps {
  slide: Slide;
}

export function SlideSwitch({ slide }: SlideSwitchProps) {
  const [on, setOn] = useState(slide.value() === 1);

  useEffect(() => {
    return slide.onChange((next) => setOn(next));
  }, [slide]);

  return (
    <button
      type="button"
      onClick={() => slide.toggle()}
      className="flex flex-col items-center justify-center gap-2 px-[18px] py-3 bg-panel border border-edge rounded-lg cursor-pointer select-none"
    >
      <span className="text-[11px] uppercase tracking-[0.12em] text-muted font-semibold">
        Slide
      </span>
      <span
        className={`relative w-[52px] h-6 rounded-[14px] border transition-colors ${
          on ? "bg-[#1d2937] border-accent" : "bg-[#0a0a0c] border-edge"
        }`}
      >
        <span
          className={`absolute top-0.5 w-[18px] h-[18px] rounded-full transition-[left,background] ${
            on ? "left-[30px] bg-accent" : "left-0.5 bg-muted"
          }`}
        />
      </span>
      <span
        className={`font-mono text-xs ${on ? "text-accent" : "text-muted"}`}
      >
        {on ? "1" : "0"}
      </span>
    </button>
  );
}
