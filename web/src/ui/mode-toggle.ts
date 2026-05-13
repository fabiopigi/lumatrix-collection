import type { DisplayMode } from "./grid";

export interface ModeToggle {
  readonly element: HTMLElement;
  set(mode: DisplayMode): void;
}

export function createModeToggle(onChange: (mode: DisplayMode) => void): ModeToggle {
  const root = document.createElement("div");
  root.className = "toggle-row mode-toggle";

  const pixelBtn = document.createElement("button");
  pixelBtn.textContent = "Pixel";
  pixelBtn.dataset.mode = "pixel";

  const maskBtn = document.createElement("button");
  maskBtn.textContent = "Letter mask";
  maskBtn.dataset.mode = "mask";

  root.append(pixelBtn, maskBtn);

  let current: DisplayMode = "pixel";

  function set(mode: DisplayMode): void {
    current = mode;
    pixelBtn.classList.toggle("on", mode === "pixel");
    maskBtn.classList.toggle("on", mode === "mask");
  }

  pixelBtn.addEventListener("click", () => {
    if (current !== "pixel") {
      set("pixel");
      onChange("pixel");
    }
  });
  maskBtn.addEventListener("click", () => {
    if (current !== "mask") {
      set("mask");
      onChange("mask");
    }
  });

  set("pixel");

  return { element: root, set };
}
