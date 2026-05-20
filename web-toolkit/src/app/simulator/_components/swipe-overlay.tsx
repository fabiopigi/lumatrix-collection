"use client";

import { useRef, type ReactNode } from "react";
import type { Joystick } from "@/lib/simulator/types";
import { useSwipeJoystick } from "./use-swipe-joystick";

interface SwipeOverlayProps {
  joy: Joystick;
  children: ReactNode;
}

/** Wraps children in a div that captures touch gestures and routes them to
 *  the joystick. `touch-action: none` blocks page scroll / pull-to-refresh
 *  for touches that start inside the overlay so vertical swipes go to the
 *  joystick instead of scrolling the page — the side effect being that the
 *  user has to start their scroll touch outside the matrix area on mobile.
 *  That's the right trade for an interactive simulator surface. */
export function SwipeOverlay({ joy, children }: SwipeOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipeJoystick(ref, joy);
  return (
    <div ref={ref} style={{ touchAction: "none" }}>
      {children}
    </div>
  );
}
