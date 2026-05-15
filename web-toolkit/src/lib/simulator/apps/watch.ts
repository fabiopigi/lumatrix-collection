import type { Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { FONT_3X5, glyph } from "../fonts";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "Watch";

const NUM_LEDS = 64;
const IDLE_MS = 30_000;

const BRIGHTNESS = 0.25;
const FRAME_MS = 30;
const MS_PER_MINUTE = 60_000;
const REPEAT_DELAY_MS = 380;
const REPEAT_TICK_MS = 110;

// Two palettes from the Pixel Designer reference. Slide switch picks one.
const PALETTE_A = ["#ff4000", "#008040"] as const; // orange hours, green minutes
const PALETTE_B = ["#0040ff", "#ffff00"] as const; // blue hours, yellow minutes

const HOUR_LEFT_X = 0;
const HOUR_RIGHT_X = 4;
const HOUR_Y = 0;
const MIN_LEFT_X = 1;
const MIN_RIGHT_X = 5;
const MIN_Y = 3;

let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin, JOY_LEFT: Pin, JOY_RIGHT: Pin;
let JOY_SLIDE: Pin | undefined;

function hexToRgb(hex: string, scale = BRIGHTNESS): RGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Math.floor(parseInt(h.slice(0, 2), 16) * scale),
    Math.floor(parseInt(h.slice(2, 4), 16) * scale),
    Math.floor(parseInt(h.slice(4, 6), 16) * scale),
  ];
}

function blend(a: RGB, b: RGB): RGB {
  const r = a[0] + b[0];
  const g = a[1] + b[1];
  const bb = a[2] + b[2];
  return [r < 256 ? r : 255, g < 256 ? g : 255, bb < 256 ? bb : 255];
}

function drawDigit(buf: RGB[], ch: string, xOff: number, yOff: number, color: RGB): void {
  const g = glyph(FONT_3X5, ch) || glyph(FONT_3X5, " ");
  if (!g) return;
  for (let gy = 0; gy < g.length; gy++) {
    const row = g[gy];
    for (let gx = 0; gx < row.length; gx++) {
      if (row[gx] === "X") {
        const vx = xOff + gx;
        const vy = yOff + gy;
        if (vx >= 0 && vx <= 7 && vy >= 0 && vy <= 7) {
          const idx = (7 - vy) * 8 + vx;
          buf[idx] = blend(buf[idx], color);
        }
      }
    }
  }
}

function render(hour: number, minute: number, hourColor: RGB, minColor: RGB): void {
  const buf: RGB[] = Array.from({ length: NUM_LEDS }, () => [0, 0, 0]);
  const hStr = hour.toString().padStart(2, "0");
  const mStr = minute.toString().padStart(2, "0");
  drawDigit(buf, hStr[0], HOUR_LEFT_X, HOUR_Y, hourColor);
  drawDigit(buf, hStr[1], HOUR_RIGHT_X, HOUR_Y, hourColor);
  drawDigit(buf, mStr[0], MIN_LEFT_X, MIN_Y, minColor);
  drawDigit(buf, mStr[1], MIN_RIGHT_X, MIN_Y, minColor);
  for (let i = 0; i < NUM_LEDS; i++) np[i] = buf[i];
  np.write();
}

function paletteColors(): [RGB, RGB] {
  let hHex: string, mHex: string;
  if (JOY_SLIDE && JOY_SLIDE.value() === 1) {
    [hHex, mHex] = PALETTE_B;
  } else {
    [hHex, mHex] = PALETTE_A;
  }
  return [hexToRgb(hHex), hexToRgb(mHex)];
}

type DirName = "right" | "left" | "up" | "down";

function applyStep(direction: DirName, hour: number, minute: number): [number, number] {
  if (direction === "right") return [(hour + 1) % 24, minute];
  if (direction === "left") return [(hour - 1 + 24) % 24, minute];
  if (direction === "up") return [hour, (minute + 1) % 60];
  return [hour, (minute - 1 + 60) % 60];
}

function currentDirection(): DirName | null {
  if (JOY_RIGHT.value() === 0) return "right";
  if (JOY_LEFT.value() === 0) return "left";
  if (JOY_UP.value() === 0) return "up";
  if (JOY_DOWN.value() === 0) return "down";
  return null;
}

function colorsEqual(a: RGB, b: RGB): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

async function showWatch(): Promise<"exit" | "idle"> {
  let hour = 12;
  let minute = 0;

  const now0 = ticks_ms();
  let nextTick = now0 + MS_PER_MINUTE;
  let lastActivity = now0;
  let heldDir: DirName | null = null;
  let nextRepeat = 0;

  let [hourColor, minColor] = paletteColors();
  render(hour, minute, hourColor, minColor);

  while (true) {
    if (screens.check_exit()) return "exit";

    const now = ticks_ms();
    let dirty = false;

    const [newHourColor, newMinColor] = paletteColors();
    if (!colorsEqual(newHourColor, hourColor) || !colorsEqual(newMinColor, minColor)) {
      hourColor = newHourColor;
      minColor = newMinColor;
      dirty = true;
    }

    if (ticks_diff(now, nextTick) >= 0) {
      minute = (minute + 1) % 60;
      if (minute === 0) hour = (hour + 1) % 24;
      nextTick += MS_PER_MINUTE;
      dirty = true;
    }

    const curDir = currentDirection();
    if (curDir !== null) {
      lastActivity = now;
      if (curDir !== heldDir) {
        [hour, minute] = applyStep(curDir, hour, minute);
        heldDir = curDir;
        nextRepeat = now + REPEAT_DELAY_MS;
        dirty = true;
      } else if (ticks_diff(now, nextRepeat) >= 0) {
        [hour, minute] = applyStep(curDir, hour, minute);
        nextRepeat = now + REPEAT_TICK_MS;
        dirty = true;
      }
    } else {
      heldDir = null;
      if (ticks_diff(now, lastActivity) >= IDLE_MS) return "idle";
    }

    if (dirty) render(hour, minute, hourColor, minColor);

    await sleep_ms(FRAME_MS);
  }
}

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
  np = neopixel;
  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  JOY_SLIDE = joystick.slide;
  screens.init(neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const outcome = await showWatch();
    if (outcome === "exit") return;
    if ((await screens.end_screen()) === "exit") return;
  }
}
