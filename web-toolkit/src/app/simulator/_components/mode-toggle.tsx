"use client";

import type { DisplayMode } from "@/lib/simulator/types";

interface ModeToggleProps {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="inline-flex bg-[#0a0a0c] border border-edge rounded-md p-[3px]">
      <ModeButton
        on={mode === "pixel"}
        onClick={() => mode !== "pixel" && onChange("pixel")}
      >
        Pixel
      </ModeButton>
      <ModeButton
        on={mode === "mask"}
        onClick={() => mode !== "mask" && onChange("mask")}
      >
        Letter mask
      </ModeButton>
    </div>
  );
}

function ModeButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-0 px-4 py-[7px] text-[13px] font-semibold tracking-[0.04em] rounded cursor-pointer transition-colors font-[inherit] ${
        on ? "bg-[#1d2937] text-accent" : "bg-transparent text-muted hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
