"use client";

import { useEffect, type RefObject } from "react";
import type { JoyButton, Joystick } from "@/lib/simulator/types";

/** Minimum displacement before a touch is classified as a swipe. Below this
 *  the gesture is still a candidate "tap". Tuned to feel deliberate without
 *  fighting the user; rough finger movement under ~24px is usually a tap. */
const SWIPE_THRESHOLD_PX = 24;

/** Max gesture duration that still counts as a tap. Beyond this even a
 *  movement-free touch is treated as "long press" — we don't act on long
 *  press in v1 (semantics unclear), so it falls through to no-op on release. */
const TAP_MAX_MS = 250;

/** How long to hold "center" after a tap before releasing. Long enough that
 *  apps polling at 30 Hz or subscribed to onChange will see the edge. */
const TAP_HOLD_MS = 100;

/**
 * Translate touch gestures on an element into Joystick presses, using the
 * same `press` / `release` API as the keyboard and the on-screen D-pad.
 *
 * Gesture vocabulary:
 *   - Swipe up / down / left / right → press the matching direction, hold
 *     until pointerup, then release. Direction locks at first
 *     threshold crossing; subsequent movement is ignored.
 *   - Tap (no movement past threshold, < 250ms) → press center, release
 *     after ~100ms so apps catch the edge.
 *   - Mouse pointers are ignored so desktop click-drags don't trigger
 *     gestures (the keyboard and on-screen buttons stay the desktop path).
 */
export function useSwipeJoystick(
  ref: RefObject<HTMLElement | null>,
  joy: Joystick,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let activePointer: number | null = null;
    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let lockedDir: JoyButton | null = null;

    const onPointerDown = (e: PointerEvent) => {
      // Skip mouse — desktop has the keyboard and the on-screen D-pad.
      // Skip if we're already tracking a different pointer; v1 is
      // single-touch.
      if (e.pointerType === "mouse") return;
      if (activePointer !== null) return;
      activePointer = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startedAt = performance.now();
      lockedDir = null;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw if the element is detached; the
        // listeners still work without it, capture is just an
        // optimisation that keeps us receiving move events when the
        // finger leaves the element.
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      if (lockedDir) return; // direction locked for the rest of the gesture
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (Math.max(absX, absY) < SWIPE_THRESHOLD_PX) return;
      lockedDir = absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      joy.press(lockedDir);
    };

    const finishGesture = (e: PointerEvent) => {
      if (e.pointerId !== activePointer) return;
      const elapsed = performance.now() - startedAt;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // Already released or never captured; ignore.
      }
      if (lockedDir) {
        // Drag-and-hold gesture ended → release the direction.
        joy.release(lockedDir);
      } else if (elapsed < TAP_MAX_MS) {
        // Stayed inside the threshold and finished quickly → tap = center.
        joy.press("center");
        window.setTimeout(() => joy.release("center"), TAP_HOLD_MS);
      }
      // Long press without movement: no-op for now. If we ever want
      // "hold center", flip this to press("center") on pointerdown and
      // release here for `elapsed >= TAP_MAX_MS`.
      activePointer = null;
      lockedDir = null;
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", finishGesture);
    el.addEventListener("pointercancel", finishGesture);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finishGesture);
      el.removeEventListener("pointercancel", finishGesture);
      // Release any in-flight direction so a remount mid-gesture doesn't
      // leave a button stuck pressed.
      if (lockedDir) joy.release(lockedDir);
    };
  }, [ref, joy]);
}
