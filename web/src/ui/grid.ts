import { LETTER_MASK, MATRIX_HEIGHT, MATRIX_WIDTH, letterAt } from "../letter-mask";

export type DisplayMode = "pixel" | "mask";

export interface Grid {
  readonly element: HTMLElement;
  render(buffer: Uint8ClampedArray): void;
  setMode(mode: DisplayMode): void;
}

/** Visual (x, y) origin is top-left. LED chain index has row 0 = bottom. */
function ledIndex(x: number, y: number): number {
  return (MATRIX_HEIGHT - 1 - y) * MATRIX_WIDTH + x;
}

/** Scale a hardware-dimmed RGB byte (0..~80) into a screen-visible value. */
function boostByte(b: number): number {
  const boosted = Math.round(b * 3.2);
  return boosted > 255 ? 255 : boosted;
}

export function createGrid(): Grid {
  const root = document.createElement("div");
  root.className = "led-grid";

  const cells: HTMLElement[] = new Array(MATRIX_WIDTH * MATRIX_HEIGHT);
  let mode: DisplayMode = "pixel";
  let lastBuffer: Uint8ClampedArray | null = null;

  for (let y = 0; y < MATRIX_HEIGHT; y++) {
    for (let x = 0; x < MATRIX_WIDTH; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const letter = document.createElement("span");
      letter.className = "letter";
      letter.textContent = letterAt(x, y) || "";
      cell.appendChild(letter);
      root.appendChild(cell);
      cells[y * MATRIX_WIDTH + x] = cell;
    }
  }

  function render(buffer: Uint8ClampedArray): void {
    lastBuffer = buffer;
    const isMask = mode === "mask";
    for (let y = 0; y < MATRIX_HEIGHT; y++) {
      for (let x = 0; x < MATRIX_WIDTH; x++) {
        const cell = cells[y * MATRIX_WIDTH + x];
        const idx = ledIndex(x, y);
        const base = idx * 3;
        const r = buffer[base];
        const g = buffer[base + 1];
        const b = buffer[base + 2];
        const lit = r > 0 || g > 0 || b > 0;
        const br = boostByte(r);
        const bg = boostByte(g);
        const bb = boostByte(b);
        const color = `rgb(${br},${bg},${bb})`;

        cell.classList.toggle("lit", lit);
        cell.classList.toggle("mask-mode", isMask);
        const ltrEl = cell.firstElementChild as HTMLElement;
        const letter = letterAt(x, y);
        if (isMask) {
          if (letter) {
            ltrEl.textContent = letter;
            cell.classList.remove("mask-blank");
          } else {
            ltrEl.textContent = "·";
            cell.classList.add("mask-blank");
          }
          cell.style.removeProperty("background");
          cell.style.setProperty("--c", color);
          ltrEl.style.color = lit ? color : "";
        } else {
          ltrEl.textContent = "";
          cell.classList.remove("mask-blank");
          ltrEl.style.color = "";
          if (lit) {
            cell.style.background = color;
            cell.style.setProperty("--c", color);
          } else {
            cell.style.removeProperty("background");
            cell.style.removeProperty("--c");
          }
        }
      }
    }
  }

  function setMode(next: DisplayMode): void {
    if (next === mode) return;
    mode = next;
    if (lastBuffer) render(lastBuffer);
  }

  return { element: root, render, setMode };
}

export { LETTER_MASK };
