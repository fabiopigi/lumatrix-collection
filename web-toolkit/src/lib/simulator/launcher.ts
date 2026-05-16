/**
 * Responsive launcher.
 *
 * Renders to a W×H buffer sized to the configured display, picking a font by
 * height (3×5 / 5×8 / 7×9). The on-display launcher's marquee is the selected
 * app's NAME in light blue, with a 1-px-per-app track along the bottom row(s).
 * Layout follows shared/design/launcher-loading-gameover.json.
 *
 * Two NeoPixel buffers are owned here:
 *  - displayNp (W×H): launcher's own rendering + screensNp for all apps.
 *  - lumatrixNp (8×8 source): gameplay buffer for non-responsive apps. The
 *    SimulatorGrid scales 64-LED buffers up, so legacy 8×8 apps still work.
 * Responsive apps still get their own W×H gameplay buffer.
 */

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
import { FONT_3X5, FONT_5X8, FONT_7X9 } from "./fonts";
import { sleep_ms, ticks_diff, ticks_ms } from "./runtime/time";
import * as screens from "./screens";
import type { App, DisplayDims, Joystick, NeoPixel, RGB } from "./types";
import bootDesignRaw from "../../../../shared/design/boot-animation.json";

type GlyphSet = Record<string, string[]>;

export type NeoPixelFactory = (numLeds: number) => NeoPixel;

export interface LauncherDeps {
  readonly joy: Joystick;
  readonly display: DisplayDims;
  readonly createNeoPixel: NeoPixelFactory;
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

export function getApps(): readonly App[] {
  return APPS;
}

let _pendingAppIndex: number | null = null;

export function setPendingApp(index: number | null): void {
  _pendingAppIndex = index;
}

function consumePending(): number | null {
  const i = _pendingAppIndex;
  _pendingAppIndex = null;
  return i;
}

type AppChangeListener = (idx: number | null) => void;
const _appListeners = new Set<AppChangeListener>();

export function onAppChange(cb: AppChangeListener): () => void {
  _appListeners.add(cb);
  return () => {
    _appListeners.delete(cb);
  };
}

function notifyAppChange(idx: number | null): void {
  for (const l of _appListeners) l(idx);
}

const BRIGHTNESS = 0.25;

/** Marquee step time scales with display width — wider displays scroll faster
 *  so the user doesn't wait too long for text to traverse. */
function marqueeStepMs(): number {
  if (_w <= 8) return 100;
  if (_w <= 16) return 75;
  return 50;
}

function hexDim(hex: string, scale = BRIGHTNESS): RGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Math.floor(parseInt(h.slice(0, 2), 16) * scale),
    Math.floor(parseInt(h.slice(2, 4), 16) * scale),
    Math.floor(parseInt(h.slice(4, 6), 16) * scale),
  ];
}

const NAME_COLOR: RGB = hexDim("#0080ff");
const TRACK_DIM: RGB = hexDim("#000080");
const TRACK_BRIGHT: RGB = hexDim("#0080ff");

// ─── Boot animation ────────────────────────────────────────────────────────

interface BootDesignPixel {
  index: number;
  x: number;
  y: number;
  color: string;
}
interface BootDesign {
  pages: Array<{ variants: Record<string, BootDesignPixel[]> }>;
}
const bootDesign = bootDesignRaw as unknown as BootDesign;

const BOOT_WHITE_HEX = "#b8b8c0";
const BOOT_BLUE_HEX = "#0080ff";
const BOOT_WHITE_BASE: RGB = hexDim(BOOT_WHITE_HEX);
const BOOT_BLUE_BASE: RGB = hexDim(BOOT_BLUE_HEX);

const BOOT_FRAME_MS = 33; // ~30 fps — keeps the fades smooth
const BOOT_TOTAL_MS = 3500;
const BOOT_WHITE_FADE_IN_END = 1000;
const BOOT_BLUE_FADE_IN_START = 500;
const BOOT_BLUE_FADE_IN_END = 1500;
const BOOT_FADE_OUT_START = 3000;
const BOOT_FADE_OUT_END = 3500;
const BOOT_FLICKER_AMOUNT = 0.05;
/** Average ms between flicker re-rolls per pixel — slower than the frame
 *  rate so the sparkle reads as "twinkle" rather than full-rate noise. Each
 *  pixel re-rolls with probability BOOT_FRAME_MS / this value per frame. */
const BOOT_FLICKER_STEP_MS = 150;

type XY = readonly [number, number];

function getBootPixels(): { white: readonly XY[]; blue: readonly XY[] } | null {
  const key = `${_w}x${_h}`;
  const variants = bootDesign.pages[0]?.variants;
  const list = variants?.[key];
  if (!list) return null;
  const white: XY[] = [];
  const blue: XY[] = [];
  for (const p of list) {
    const c = p.color.toLowerCase();
    if (c === BOOT_WHITE_HEX) white.push([p.x, p.y]);
    else if (c === BOOT_BLUE_HEX) blue.push([p.x, p.y]);
  }
  return { white, blue };
}

function fadeInAlpha(t: number, start: number, end: number): number {
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

function fadeOutMultiplier(t: number): number {
  if (t <= BOOT_FADE_OUT_START) return 1;
  if (t >= BOOT_FADE_OUT_END) return 0;
  return 1 - (t - BOOT_FADE_OUT_START) / (BOOT_FADE_OUT_END - BOOT_FADE_OUT_START);
}

function bootColor(base: RGB, k: number): RGB {
  if (k <= 0) return [0, 0, 0];
  return [
    Math.min(255, Math.max(0, Math.round(base[0] * k))),
    Math.min(255, Math.max(0, Math.round(base[1] * k))),
    Math.min(255, Math.max(0, Math.round(base[2] * k))),
  ];
}

function rollFlicker(): number {
  return 1 + (Math.random() * 2 - 1) * BOOT_FLICKER_AMOUNT;
}

let np: NeoPixel;
let joy: Joystick;
let _w = 8;
let _h = 8;

function ledIndex(x: number, y: number): number {
  return (_h - 1 - y) * _w + x;
}

function setPx(x: number, y: number, color: RGB): void {
  if (x < 0 || x >= _w || y < 0 || y >= _h) return;
  np[ledIndex(x, y)] = color;
}

function clear(): void {
  const total = _w * _h;
  for (let i = 0; i < total; i++) np[i] = [0, 0, 0];
}

function glyphFor(font: GlyphSet, ch: string): string[] | undefined {
  if (ch in font) return font[ch];
  const u = ch.toUpperCase();
  if (u in font) return font[u];
  return font[" "];
}

function fontHeight(font: GlyphSet): number {
  for (const ch of Object.keys(font)) {
    const g = font[ch];
    if (g && g.length) return g.length;
  }
  return 0;
}

function chooseFont(): { font: GlyphSet; height: number } {
  if (_h <= 8) return { font: FONT_3X5, height: fontHeight(FONT_3X5) };
  if (_h <= 16) return { font: FONT_5X8, height: fontHeight(FONT_5X8) };
  return { font: FONT_7X9, height: fontHeight(FONT_7X9) };
}

interface Bitmap {
  rows: string[];
  width: number;
  height: number;
}

function textToBitmap(
  text: string,
  font: GlyphSet,
  trailingGap: number,
): Bitmap {
  const fontH = fontHeight(font);
  const rows: string[] = Array(fontH).fill("");
  for (const ch of text) {
    const g = glyphFor(font, ch);
    if (!g) continue;
    const w = g[0]?.length ?? 0;
    for (let i = 0; i < fontH; i++) {
      const row = g[i] ?? ".".repeat(w);
      rows[i] += row + ".";
    }
  }
  const pad = ".".repeat(trailingGap);
  for (let i = 0; i < fontH; i++) rows[i] += pad;
  return { rows, width: rows[0]?.length ?? 0, height: fontH };
}

function drawBitmapWindow(
  bitmap: Bitmap,
  offset: number,
  color: RGB,
  x0: number,
  y0: number,
  windowW: number,
  wrap: boolean,
): void {
  const total = bitmap.width;
  if (total <= 0) return;
  for (let y = 0; y < bitmap.height; y++) {
    const row = bitmap.rows[y];
    for (let x = 0; x < windowW; x++) {
      let src: number;
      if (wrap) {
        src = (((offset + x) % total) + total) % total;
      } else {
        src = offset + x;
        if (src < 0 || src >= total) continue;
      }
      if (row[src] === "X") setPx(x0 + x, y0 + y, color);
    }
  }
}

function trackTopY(totalApps: number): number {
  const rows = Math.max(1, Math.ceil(totalApps / _w));
  return _h - rows;
}

function drawTrack(currentIdx: number, totalApps: number): void {
  const topY = trackTopY(totalApps);
  for (let i = 0; i < totalApps; i++) {
    const row = Math.floor(i / _w);
    const col = i % _w;
    setPx(col, topY + row, i === currentIdx ? TRACK_BRIGHT : TRACK_DIM);
  }
}

function marqueeY0(fontH: number, totalApps: number): number {
  // Available rows above the track minus a 1-row visual gap.
  const space = trackTopY(totalApps) - 1;
  return Math.max(0, Math.floor((space - fontH) / 2));
}

function renderMenu(
  bitmap: Bitmap,
  offset: number,
  idx: number,
  total: number,
): void {
  clear();
  drawBitmapWindow(
    bitmap,
    offset,
    NAME_COLOR,
    0,
    marqueeY0(bitmap.height, total),
    _w,
    true,
  );
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

/** LumenLab boot animation — white + blue parts fade in independently,
 *  with per-pixel ±5% flicker that re-rolls every ~150 ms (stochastic,
 *  not every frame) for a slow "twinkle" rather than fast noise. Pixel
 *  layout is defined per canonical display size in
 *  shared/design/boot-animation.json; non-canonical sizes get a brief
 *  blank pause instead of the animation. */
async function bootAnimation(): Promise<void> {
  const pixels = getBootPixels();
  if (!pixels) {
    clear();
    np.write();
    await sleep_ms(300);
    return;
  }

  // Cached per-pixel flicker multipliers. Each pixel keeps its current value
  // until a (per-frame, per-pixel) coin flip says to re-roll. With
  // BOOT_FRAME_MS / BOOT_FLICKER_STEP_MS as the probability, the expected
  // interval between re-rolls is BOOT_FLICKER_STEP_MS per pixel.
  const whiteFlicker = pixels.white.map(() => rollFlicker());
  const blueFlicker = pixels.blue.map(() => rollFlicker());
  const rerollProb = BOOT_FRAME_MS / BOOT_FLICKER_STEP_MS;

  const start = ticks_ms();
  while (true) {
    const t = ticks_diff(ticks_ms(), start);
    if (t >= BOOT_TOTAL_MS) break;

    const fadeOut = fadeOutMultiplier(t);
    const aWhite = fadeInAlpha(t, 0, BOOT_WHITE_FADE_IN_END) * fadeOut;
    const aBlue = fadeInAlpha(t, BOOT_BLUE_FADE_IN_START, BOOT_BLUE_FADE_IN_END) * fadeOut;

    for (let i = 0; i < whiteFlicker.length; i++) {
      if (Math.random() < rerollProb) whiteFlicker[i] = rollFlicker();
    }
    for (let i = 0; i < blueFlicker.length; i++) {
      if (Math.random() < rerollProb) blueFlicker[i] = rollFlicker();
    }

    clear();
    for (let i = 0; i < pixels.white.length; i++) {
      const [x, y] = pixels.white[i];
      setPx(x, y, bootColor(BOOT_WHITE_BASE, aWhite * whiteFlicker[i]));
    }
    for (let i = 0; i < pixels.blue.length; i++) {
      const [x, y] = pixels.blue[i];
      setPx(x, y, bootColor(BOOT_BLUE_BASE, aBlue * blueFlicker[i]));
    }
    np.write();
    await sleep_ms(BOOT_FRAME_MS);
  }

  clear();
  np.write();
  await sleep_ms(150);
}

/** Read-pause then ease-in: the marquee holds at offset 0 for 500 ms so the
 *  name is readable, then linearly ramps speed from 0 to full over the next
 *  500 ms, then continues at full marqueeStepMs() pace. */
const MARQUEE_HOLD_MS = 500;
const MARQUEE_ACCEL_MS = 500;

/** Cumulative pixel offset at a given elapsed time (since the current name
 *  was selected), given the display's full-speed step time. Integrating the
 *  ramp speed v(t) = fullSpeed · t / ACCEL gives offset = t²/(2·ACCEL·step). */
function marqueeOffsetAt(elapsedMs: number, stepMs: number): number {
  if (elapsedMs < MARQUEE_HOLD_MS) return 0;
  const tFromAccel = elapsedMs - MARQUEE_HOLD_MS;
  const accelPx = MARQUEE_ACCEL_MS / (2 * stepMs);
  if (tFromAccel < MARQUEE_ACCEL_MS) {
    return Math.floor((tFromAccel * tFromAccel) / (2 * MARQUEE_ACCEL_MS * stepMs));
  }
  return Math.floor(accelPx) + Math.floor((tFromAccel - MARQUEE_ACCEL_MS) / stepMs);
}

async function menuSelect(): Promise<number> {
  const { font } = chooseFont();
  let idx = 0;
  let bitmap = textToBitmap(APPS[idx].NAME, font, _w);
  // Start at offset 0 so the first letter is at the left edge from frame one;
  // scrolling then walks it leftward until the trailing gap wraps back around.
  let offset = 0;
  let nameStart = ticks_ms();

  while (true) {
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
      idx = (((idx + nav) % n) + n) % n;
      bitmap = textToBitmap(APPS[idx].NAME, font, _w);
      offset = 0;
      nameStart = ticks_ms();
    }

    const elapsed = ticks_diff(ticks_ms(), nameStart);
    offset = marqueeOffsetAt(elapsed, marqueeStepMs()) % bitmap.width;

    renderMenu(bitmap, offset, idx, APPS.length);
    await sleep_ms(10);
  }
}

export async function run(deps: LauncherDeps): Promise<void> {
  joy = deps.joy;
  const { display, createNeoPixel } = deps;
  _w = display.width;
  _h = display.height;
  // displayNp: launcher's W×H buffer, shared as screensNp with every app so
  // loading / game-over fills the whole display at native resolution.
  const displayNp = createNeoPixel(_w * _h);
  np = displayNp;
  // lumatrixNp: 8×8 source buffer for legacy non-responsive apps. The grid
  // detects the 64-LED size and scales it up. Skipped when display is 8×8
  // (we'd just allocate two equivalent buffers).
  const lumatrixNp =
    _w === 8 && _h === 8 ? displayNp : createNeoPixel(64);

  await bootAnimation();
  while (true) {
    let i: number;
    let viaMenuUI = false;

    const pending = consumePending();
    if (pending !== null) {
      i = pending;
      viaMenuUI = true;
    } else {
      notifyAppChange(null);
      const selected = await menuSelect();
      const pendingAfter = consumePending();
      if (pendingAfter !== null) {
        i = pendingAfter;
        viaMenuUI = true;
      } else {
        i = selected;
      }
    }

    if (viaMenuUI) {
      screens.skipNextLoading();
    }

    clear();
    np.write();
    await sleep_ms(150);

    screens.clearExternalExit();

    notifyAppChange(i);
    const app = APPS[i];
    const appNp = app.RESPONSIVE ? createNeoPixel(_w * _h) : lumatrixNp;
    await app.run(appNp, joy, display, displayNp);
    // After an app exits its gameplay buffer (8×8 or W×H) may still be on
    // screen; the menu loop below clears + redraws to displayNp immediately.
    np = displayNp;
    await waitRelease();
    await sleep_ms(200);
  }
}
