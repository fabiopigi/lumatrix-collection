"use client";

import { useEffect, useState } from "react";
import type { Joystick, JoyButton } from "@/lib/simulator/types";

const ICONS: Record<JoyButton, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
  center: "●",
};

const POSITIONS: Array<{ btn: JoyButton; row: number; col: number }> = [
  { btn: "up", row: 1, col: 2 },
  { btn: "left", row: 2, col: 1 },
  { btn: "center", row: 2, col: 2 },
  { btn: "right", row: 2, col: 3 },
  { btn: "down", row: 3, col: 2 },
];

interface JoystickPadProps {
  joy: Joystick;
}

export function JoystickPad({ joy }: JoystickPadProps) {
  const [pressed, setPressed] = useState<Record<JoyButton, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
    center: false,
  });

  useEffect(() => {
    return joy.onChange((button, isDown) => {
      setPressed((prev) =>
        prev[button] === isDown ? prev : { ...prev, [button]: isDown },
      );
    });
  }, [joy]);

  return (
    <div
      className="grid p-2.5 bg-panel border border-edge rounded-lg"
      style={{
        gridTemplateColumns: "repeat(3, 56px)",
        gridTemplateRows: "repeat(3, 56px)",
        gap: 6,
      }}
    >
      {POSITIONS.map(({ btn, row, col }) => {
        const active = pressed[btn];
        return (
          <button
            key={btn}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              joy.press(btn);
            }}
            onMouseUp={() => joy.release(btn)}
            onMouseLeave={() => joy.release(btn)}
            onTouchStart={(e) => {
              e.preventDefault();
              joy.press(btn);
            }}
            onTouchEnd={() => joy.release(btn)}
            onTouchCancel={() => joy.release(btn)}
            onContextMenu={(e) => e.preventDefault()}
            style={{ gridRow: row, gridColumn: col }}
            className={`border rounded-lg font-bold select-none transition-[background,color,transform,border-color] duration-75 cursor-pointer ${
              btn === "center" ? "text-sm" : "text-lg"
            } ${
              active
                ? "bg-[#1d2937] text-accent border-accent scale-95"
                : "bg-panel-2 text-muted border-edge hover:text-white hover:border-[#333]"
            }`}
          >
            {ICONS[btn]}
          </button>
        );
      })}
    </div>
  );
}
