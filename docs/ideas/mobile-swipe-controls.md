# Mobile swipe controls for the simulator

**Status:** raw idea
**Tags:** web-toolkit, simulator, mobile, ux, input

## What

On touch devices, drive the simulator with swipe gestures instead of the on-screen D-pad: swipe up/down/left/right press the matching direction, tap presses center. Translates entirely into the existing `JoyButton` interface — apps don't need to change.

## Why

The simulator works well on desktop with the keyboard or the on-screen buttons. On phones the buttons are cramped, finger-occluded, and hard to use for anything reflex-based (snake, breakout, flappy). Swipes are the native mobile vocabulary for "directional input" and remove the precision problem entirely — your finger can land anywhere on the matrix area.

Also broadens who can show off a design or play an app from a phone link, which gets more valuable once [[share-design-via-url]] exists.

## Sketch

The input contract already fits:

- `JoyButton = "up" | "down" | "left" | "right" | "center"` with `press`/`release`/`isPressed`/`onChange` (`web-toolkit/src/lib/simulator/types.ts:5`).
- A gesture layer just calls `press`/`release` on the joystick — same API the on-screen buttons and keyboard handlers use.

Gesture → button mapping:

- **Swipe up/down/left/right** → press the matching direction.
- **Tap** → press center.
- **Long press** → hold center (for apps that distinguish short vs long).
- **Drag-and-hold** (swipe and don't lift) → continuous directional hold, for games that need sustained movement (breakout paddle, flappy).

Detection and press semantics:

- Capture pointer events on the matrix render area (the natural target — that's where the eye is).
- Threshold + direction classification on `pointermove`: once movement exceeds N px, lock to dominant axis.
- For a quick swipe, fire `press` then `release` after a short duration (~80–120 ms) so apps that read the change-edge fire reliably.
- For drag-and-hold, keep `press` active until pointer-up, then `release`.
- Multi-touch isn't required for v1.

UX details:

- Auto-enable when a touch capability is detected; don't disable mouse / keyboard.
- Transient visual feedback (arrow pulse or directional glow on the matrix edge) so users know the swipe registered.
- Decide what to do with the existing on-screen D-pad on mobile — keep it as a fallback for users who prefer buttons, or hide it to keep the screen clear.

## Open questions

- **Gesture region:** capture on the matrix area only, or on a larger overlay region (the whole simulator card)? Larger is more forgiving but eats other interactions.
- **Press duration after a swipe:** apps that poll vs. apps that subscribe to `onChange` behave differently — what hold time feels right across both? Maybe configurable per-app, or just tuned to "long enough that every app's tick catches the edge".
- **Drag-and-hold ergonomics:** does the swipe lock to one axis for the whole gesture, or re-classify if the user drags around (joystick-like)? Joystick-like is more flexible but adds complexity.
- **Conflicts with browser gestures:** `touch-action: none` on the gesture region prevents page scroll / pull-to-refresh, but needs to be scoped tightly so the rest of the page stays normal.
- **Visual feedback:** is the pulse helpful or distracting? Make it subtle or skip entirely?
- **Keep the on-screen D-pad?** Some users prefer buttons; some apps (where center is the primary action) feel weird without a visible button. Probably keep both, with swipes as the dominant path on mobile.
- **Apps that need more than a D-pad+center:** none of the current built-ins do, but if more buttons ever appear in the joystick model, the gesture vocabulary needs to grow (two-finger tap? edge swipes?).

## Notes

- Existing input model: `web-toolkit/src/lib/simulator/types.ts` (`JoyButton`, joystick contract). All keyboard, on-screen-button, and future swipe handling funnel through the same press/release calls — no app changes needed.
- Compounds nicely with [[share-design-via-url]]: a link opened on a phone should be playable on the phone.
