export type JoyButton = "up" | "down" | "left" | "right" | "center";

export interface Pin {
  value(): 0 | 1;
}

export interface Joystick {
  readonly up: Pin;
  readonly down: Pin;
  readonly left: Pin;
  readonly right: Pin;
  readonly center: Pin;
  press(button: JoyButton): void;
  release(button: JoyButton): void;
  isPressed(button: JoyButton): boolean;
  onChange(cb: (button: JoyButton, pressed: boolean) => void): () => void;
}

export function createJoystick(): Joystick {
  const state: Record<JoyButton, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
    center: false,
  };
  const listeners = new Set<(button: JoyButton, pressed: boolean) => void>();

  const pin = (b: JoyButton): Pin => ({
    value: () => (state[b] ? 0 : 1),
  });

  return {
    up: pin("up"),
    down: pin("down"),
    left: pin("left"),
    right: pin("right"),
    center: pin("center"),
    press(b) {
      if (state[b]) return;
      state[b] = true;
      for (const l of listeners) l(b, true);
    },
    release(b) {
      if (!state[b]) return;
      state[b] = false;
      for (const l of listeners) l(b, false);
    },
    isPressed: (b) => state[b],
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}
