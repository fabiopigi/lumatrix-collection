/**
 * Port of main.py — boot animation + marquee menu + app cycle.
 *
 * Reads the same FONT_3X5 marquee font as the launcher on the Pico, applies the
 * same hex-dim convention (BRIGHTNESS=0.25), and walks the same APPS array
 * shape ({ NAME, run }). Order of APPS sets each app's slot in the bottom
 * track, exactly like the Pico launcher.
 */

import type { NeoPixel, RGB } from "./hardware/neopixel";
import type { Joystick } from "./hardware/joystick";
import { FONT_3X5, glyph } from "./fonts";
import { sleep_ms, ticks_diff, ticks_ms } from "./runtime/time";
import * as screens from "./screens";

import * as reaction from "./apps/reaction";
import * as connect4 from "./apps/connect4";
import * as breakout from "./apps/breakout";
import * as dinojump from "./apps/dinojump";
import * as doom from "./apps/doom";
import * as flappy from "./apps/flappy";
import * as invaders from "./apps/invaders";
import * as pong from "./apps/pong";
import * as simonsays from "./apps/simonsays";
import * as snake from "./apps/snake";
import * as watch from "./apps/watch";

export interface App {
  readonly NAME: string;
  run(np: NeoPixel, joy: Joystick): Promise<void>;
}

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

/** Read-only view of the registered apps. Used by the simulator's menu UI. */
export function getApps(): readonly App[] {
  return APPS;
}

/** Set by the menu UI to make the launcher jump straight to a specific app
 *  on its next loop iteration. Combine with screens.forceExit() to interrupt
 *  whatever is currently running. */
let _pendingAppIndex: number | null = null;

export function setPendingApp(index: number | null): void {
  _pendingAppIndex = index;
}

function consumePending(): number | null {
  const i = _pendingAppIndex;
  _pendingAppIndex = null;
  return i;
}

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

/** (x, y) where (0, 0) is top-left visually, (7, 7) is bottom-right. */
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

function drawMarquee(bitmap: string[], offset: number, color: RGB, y0 = 0): void {
  const total = bitmap[0].length;
  if (total <= 0) return;
  for (let y = 0; y < 5; y++) {
    const row = bitmap[y];
    for (let x = 0; x < 8; x++) {
      const src = ((offset + x) % total + total) % total;
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

function renderMenu(bitmap: string[], offset: number, idx: number, total: number): void {
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

async function oneShotMarquee(text: string, color: RGB, stepMs = 55, y0 = 1): Promise<void> {
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
    // The menu UI may have set a pending app while we were waiting for input.
    // Return any index — run() will pick up consumePending() on its own.
    if (_pendingAppIndex !== null) return idx;

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
      idx = ((idx + nav) % n + n) % n;
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

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
  np = neopixel;
  joy = joystick;

  await bootAnimation();
  while (true) {
    let i: number;
    let viaMenuUI = false;

    const pending = consumePending();
    if (pending !== null) {
      i = pending;
      viaMenuUI = true;
    } else {
      const selected = await menuSelect();
      // menuSelect may have been interrupted by setPendingApp — re-check.
      const pendingAfter = consumePending();
      if (pendingAfter !== null) {
        i = pendingAfter;
        viaMenuUI = true;
      } else {
        i = selected;
      }
    }

    if (viaMenuUI) {
      // User picked via the host menu — skip the on-display loading spinner.
      screens.skipNextLoading();
    }

    clear();
    np.write();
    await sleep_ms(150);
    await APPS[i].run(np, joy);
    await waitRelease();
    await sleep_ms(200);
  }
}
