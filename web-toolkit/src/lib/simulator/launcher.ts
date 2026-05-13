import * as breakout from "./apps/breakout";
import * as connect4 from "./apps/connect4";
import * as dinojump from "./apps/dinojump";
import * as doom from "./apps/doom";
import * as flappy from "./apps/flappy";
import * as invaders from "./apps/invaders";
import * as pong from "./apps/pong";
import * as reaction from "./apps/reaction";
import * as simonsays from "./apps/simonsays";
import * as snake from "./apps/snake";
import * as watch from "./apps/watch";
import { FONT_3X5, glyph } from "./fonts";
import { sleep_ms, ticks_diff, ticks_ms } from "./runtime/time";
import type { App, Joystick, NeoPixel, RGB } from "./types";

// Order matches python/main.py's APPS list so the on-display launcher's
// bottom-track slot indices line up with the Pico build.
const APPS: readonly App[] = [
  reaction,
  connect4,
  pong,
  breakout,
  simonsays,
  dinojump,
  snake,
  flappy,
  invaders,
  doom,
  watch,
];

const NUM_LEDS = 64;
const BRIGHTNESS = 0.25;
const MARQUEE_STEP_MS = 180;

function hexDim(hex: string, scale = BRIGHTNESS): RGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Math.floor(parseInt(h.slice(0, 2), 16) * scale),
    Math.floor(parseInt(h.slice(2, 4), 16) * scale),
    Math.floor(parseInt(h.slice(4, 6), 16) * scale),
  ];
}

const NAME_COLOR: RGB = hexDim("#008040");
const TRACK_DIM: RGB = hexDim("#000080", 0.08);
const TRACK_BRIGHT: RGB = hexDim("#0080ff");
const LUMA_COLOR: RGB = [45, 45, 45];
const TRIX_COLOR: RGB = hexDim("#0080ff");

let np: NeoPixel;
let joy: Joystick;

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function pxVisual(x: number, y: number, color: RGB): void {
  if (x >= 0 && x <= 7 && y >= 0 && y <= 7) {
    const ledRow = 7 - y;
    np[ledRow * 8 + x] = color;
  }
}

function textToBitmap(text: string, trailingGap = 8): string[] {
  const rows: string[] = ["", "", "", "", ""];
  for (const ch of text) {
    const g = glyph(FONT_3X5, ch);
    if (!g) continue;
    for (let i = 0; i < 5; i++) rows[i] += g[i] + ".";
  }
  const pad = ".".repeat(trailingGap);
  for (let i = 0; i < 5; i++) rows[i] += pad;
  return rows;
}

function drawMarquee(
  bitmap: string[],
  offset: number,
  color: RGB,
  y0 = 0,
): void {
  const total = bitmap[0].length;
  if (total <= 0) return;
  for (let y = 0; y < 5; y++) {
    const row = bitmap[y];
    for (let x = 0; x < 8; x++) {
      const src = (((offset + x) % total) + total) % total;
      if (row[src] === "X") pxVisual(x, y0 + y, color);
    }
  }
}

function drawTrack(currentIdx: number, totalApps: number): void {
  for (let i = 0; i < totalApps; i++) {
    let x: number;
    let y: number;
    if (i < 8) {
      x = i;
      y = 6;
    } else {
      x = i - 8;
      y = 7;
    }
    const color = i === currentIdx ? TRACK_BRIGHT : TRACK_DIM;
    pxVisual(x, y, color);
  }
}

function renderMenu(
  bitmap: string[],
  offset: number,
  idx: number,
  total: number,
): void {
  clear();
  drawMarquee(bitmap, offset, NAME_COLOR);
  drawTrack(idx, total);
  np.write();
}

type Press = "up" | "down" | "left" | "right" | "center" | null;

function readInput(): Press {
  if (joy.center.value() === 0) return "center";
  if (joy.up.value() === 0) return "up";
  if (joy.down.value() === 0) return "down";
  if (joy.left.value() === 0) return "left";
  if (joy.right.value() === 0) return "right";
  return null;
}

async function waitRelease(): Promise<void> {
  while (readInput() !== null) await sleep_ms(10);
}

async function oneShotMarquee(
  text: string,
  color: RGB,
  stepMs = 55,
  y0 = 1,
): Promise<void> {
  const bitmap = textToBitmap(text, 0);
  const width = bitmap[0].length;
  for (let offset = -8; offset <= width; offset++) {
    clear();
    for (let y = 0; y < 5; y++) {
      const row = bitmap[y];
      for (let x = 0; x < 8; x++) {
        const src = offset + x;
        if (src >= 0 && src < width && row[src] === "X") {
          pxVisual(x, y0 + y, color);
        }
      }
    }
    np.write();
    await sleep_ms(stepMs);
  }
}

async function bootAnimation(): Promise<void> {
  await oneShotMarquee("LUMA", LUMA_COLOR);
  await oneShotMarquee("TRIX", TRIX_COLOR);
  clear();
  np.write();
  await sleep_ms(150);
}

async function menuSelect(): Promise<number> {
  let idx = 0;
  let bitmap = textToBitmap(APPS[idx].NAME);
  let total = bitmap[0].length;
  let offset = Math.max(0, total - 8);
  let lastStep = ticks_ms();

  while (true) {
    const press = readInput();
    if (press === "center") {
      await waitRelease();
      return idx;
    }

    let nav = 0;
    if (press === "right" || press === "down") nav = 1;
    else if (press === "left" || press === "up") nav = -1;

    if (nav !== 0) {
      await waitRelease();
      const n = APPS.length;
      idx = (((idx + nav) % n) + n) % n;
      bitmap = textToBitmap(APPS[idx].NAME);
      total = bitmap[0].length;
      offset = Math.max(0, total - 8);
      lastStep = ticks_ms();
    }

    const now = ticks_ms();
    if (ticks_diff(now, lastStep) >= MARQUEE_STEP_MS) {
      offset = (offset + 1) % total;
      lastStep = now;
    }

    renderMenu(bitmap, offset, idx, APPS.length);
    await sleep_ms(10);
  }
}

export async function run(
  neopixel: NeoPixel,
  joystick: Joystick,
): Promise<void> {
  np = neopixel;
  joy = joystick;

  await bootAnimation();
  while (true) {
    const i = await menuSelect();
    clear();
    np.write();
    await sleep_ms(150);
    await APPS[i].run(np, joy);
    await waitRelease();
    await sleep_ms(200);
  }
}
