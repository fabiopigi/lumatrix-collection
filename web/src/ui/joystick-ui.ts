import type { Joystick, JoyButton } from "../hardware/joystick";

const ICONS: Record<JoyButton, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
  center: "●",
};

const POSITIONS: Record<JoyButton, { row: number; col: number }> = {
  up: { row: 1, col: 2 },
  left: { row: 2, col: 1 },
  center: { row: 2, col: 2 },
  right: { row: 2, col: 3 },
  down: { row: 3, col: 2 },
};

export interface JoystickUI {
  readonly element: HTMLElement;
}

export function createJoystickUI(joy: Joystick): JoystickUI {
  const root = document.createElement("div");
  root.className = "joystick-ui";

  const buttons = {} as Record<JoyButton, HTMLButtonElement>;

  (Object.keys(POSITIONS) as JoyButton[]).forEach((name) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `joy-btn joy-${name}`;
    btn.textContent = ICONS[name];
    const pos = POSITIONS[name];
    btn.style.gridRow = String(pos.row);
    btn.style.gridColumn = String(pos.col);

    const press = (e: Event): void => {
      e.preventDefault();
      joy.press(name);
    };
    const release = (): void => {
      joy.release(name);
    };

    btn.addEventListener("mousedown", press);
    btn.addEventListener("mouseup", release);
    btn.addEventListener("mouseleave", release);
    btn.addEventListener("touchstart", press, { passive: false });
    btn.addEventListener("touchend", release);
    btn.addEventListener("touchcancel", release);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());

    root.appendChild(btn);
    buttons[name] = btn;
  });

  joy.onChange((button, pressed) => {
    buttons[button].classList.toggle("active", pressed);
  });

  return { element: root };
}
