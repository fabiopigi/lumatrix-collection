import type { Slide } from "../types";

export function createSlide(initial = false): Slide {
  let on = initial;
  const listeners = new Set<(on: boolean) => void>();

  const emit = (): void => {
    for (const l of listeners) l(on);
  };

  return {
    value: () => (on ? 1 : 0),
    toggle() {
      on = !on;
      emit();
    },
    set(next) {
      if (next === on) return;
      on = next;
      emit();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
