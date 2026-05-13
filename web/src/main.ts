import { createNeoPixel } from "./hardware/neopixel";
import { createJoystick, type JoyButton } from "./hardware/joystick";
import { createSlide } from "./hardware/slide";
import { createGrid, type DisplayMode } from "./ui/grid";
import { createModeToggle } from "./ui/mode-toggle";
import { createJoystickUI } from "./ui/joystick-ui";
import { createSlideUI } from "./ui/slide-ui";
import { createAppMenu } from "./ui/app-menu";
import * as launcher from "./launcher";
import * as screens from "./screens";

const NUM_LEDS = 64;

function mount(): void {
  const root = document.getElementById("app");
  if (!root) throw new Error("#app not found");

  const grid = createGrid();
  const joy = createJoystick();
  const slide = createSlide();
  // Expose the slide as a Pin on the joystick, mirroring the Pico convention
  // where `joystick["slide"]` is part of the same dict apps receive.
  joy.slide = { value: () => slide.value() };

  const np = createNeoPixel(NUM_LEDS, (buf) => grid.render(buf));

  const board = document.createElement("div");
  board.className = "board";
  board.appendChild(grid.element);

  const modeToggle = createModeToggle((mode: DisplayMode) => grid.setMode(mode));
  const joyUI = createJoystickUI(joy);
  const slideUI = createSlideUI(slide);

  const appMenu = createAppMenu(launcher.getApps(), {
    onLaunch: (index) => {
      // Tell the launcher to jump to this app on its next iteration, and
      // immediately exit whatever screen / app is currently running.
      launcher.setPendingApp(index);
      screens.forceExit();
    },
    onBack: () => {
      // Just interrupt the running app — the launcher's outer loop already
      // falls back to its on-display menu when no pending app is queued.
      launcher.setPendingApp(null);
      screens.forceExit();
    },
  });

  const controls = document.createElement("div");
  controls.className = "controls";

  const modeRow = document.createElement("div");
  modeRow.className = "control-row";
  modeRow.appendChild(modeToggle.element);

  const inputRow = document.createElement("div");
  inputRow.className = "control-row inputs";
  inputRow.append(joyUI.element, slideUI.element);

  const hint = document.createElement("div");
  hint.className = "hint";
  hint.innerHTML =
    "Navigate the launcher with the D-pad. Tap center to select.<br>" +
    "Keyboard: arrows = D-pad · space = center · S = slide.<br>" +
    "Or use <b>Quick launch</b> below to jump straight to an app.";

  controls.append(modeRow, inputRow, hint, appMenu.element);

  root.append(board, controls);

  wireKeyboard(joy, slide);

  void launcher.run(np, joy);
}

function wireKeyboard(joy: ReturnType<typeof createJoystick>, slide: ReturnType<typeof createSlide>): void {
  const map: Record<string, JoyButton> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    " ": "center",
  };

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
    const btn = map[e.key];
    if (btn) {
      e.preventDefault();
      joy.press(btn);
      return;
    }
    if (e.key === "s" || e.key === "S") {
      e.preventDefault();
      slide.toggle();
    }
  });

  window.addEventListener("keyup", (e) => {
    const btn = map[e.key];
    if (btn) {
      e.preventDefault();
      joy.release(btn);
    }
  });

  window.addEventListener("blur", () => {
    (["up", "down", "left", "right", "center"] as JoyButton[]).forEach((b) => joy.release(b));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
