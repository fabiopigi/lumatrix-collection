"use client";

import type { DisplayMode } from "@/lib/simulator/types";

interface ModeToggleProps {
  mode: DisplayMode;
  onChange: (mode: DisplayMode) => void;
  /** Mask mode is keyed to the 8×8 LUMATRIX word-clock layout. The toggle's
   *  mask button is disabled when the display isn't 8×8. */
  maskAvailable?: boolean;
}

export function ModeToggle({
  mode,
  onChange,
  maskAvailable = true,
}: ModeToggleProps) {
  return (
    <div className="inline-flex bg-sunken border border-edge rounded-md p-[3px]">
      <ModeButton
        on={mode === "pixel"}
        onClick={() => mode !== "pixel" && onChange("pixel")}
      >
        Pixel
      </ModeButton>
      <ModeButton
        on={mode === "mask"}
        disabled={!maskAvailable}
        title={
          maskAvailable
            ? undefined
            : "Letter mask is the LUMATRIX 8×8 word-clock layout. Switch the display to 8×8 to enable."
        }
        onClick={() => mode !== "mask" && maskAvailable && onChange("mask")}
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
  disabled,
  title,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`border-0 px-4 py-[7px] text-[13px] font-semibold tracking-[0.04em] rounded transition-colors font-[inherit] ${
        disabled
          ? "bg-transparent text-muted/40 cursor-not-allowed"
          : on
            ? "bg-active text-accent cursor-pointer"
            : "bg-transparent text-muted hover:text-white cursor-pointer"
      }`}
    >
      {children}
    </button>
  );
}
