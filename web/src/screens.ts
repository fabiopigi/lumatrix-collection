/**
 * Port of apps/_screens.py — shared lifecycle screens.
 *
 * The async functions here are the only blocking ones; they await sleep_ms in
 * polling loops. check_exit() and any_input() stay synchronous (they just read
 * joystick state) so they can be called every frame from an app's game loop.
 */

import type { NeoPixel } from "./hardware/neopixel";
import type { Joystick } from "./hardware/joystick";
import { FONT_3X5 } from "./fonts";
import { sleep_ms, ticks_diff, ticks_ms } from "./runtime/time";

const NUM_LEDS = 64;
export const EXIT_HOLD_MS = 1500;

const LOADING_STEP_MS = 200;
const MARQUEE_STEP_MS = 90;

const LOADING_COLOR: RGB = [0, 32, 63];
const GAMEOVER_TOP: RGB = [60, 0, 0];
const SCORE_COLOR: RGB = [60, 45, 0];
const END_TOP: RGB = [0, 60, 30];
const END_ARROW: RGB = [60, 45, 0];

type RGB = readonly [number, number, number];

let _np: NeoPixel | null = null;
let _joy: Joystick | null = null;
let _exitPressStart: number | null = null;
let _exitConsumed = false;

// Left-pointing arrow used on the End screen, in visual (x, y) with y=0 at top.
const END_ARROW_PIXELS: ReadonlyArray<readonly [number, number]> = [
  [3, 3],
  [2, 4],
  [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
  [2, 6],
  [3, 7],
];

export function init(neopixel: NeoPixel, joystick: Joystick): void {
  _np = neopixel;
  _joy = joystick;
  _exitPressStart = null;
  _exitConsumed = false;
}

function np(): NeoPixel {
  if (!_np) throw new Error("screens.init() not called");
  return _np;
}

function joy(): Joystick {
  if (!_joy) throw new Error("screens.init() not called");
  return _joy;
}

function _clear(): void {
  const n = np();
  for (let i = 0; i < NUM_LEDS; i++) n[i] = [0, 0, 0];
}

export function any_input(): boolean {
  const j = joy();
  return (
    j.up.value() === 0 ||
    j.down.value() === 0 ||
    j.left.value() === 0 ||
    j.right.value() === 0
  );
}

function _anyPressed(): boolean {
  return any_input() || joy().center.value() === 0;
}

async function _waitRelease(): Promise<void> {
  while (_anyPressed()) {
    await sleep_ms(10);
  }
}

/**
 * Non-blocking hold-center detector. Returns true once when the 1.5 s threshold
 * is crossed; subsequent calls return false until center is released and the
 * hold restarts. Call from inside a game loop.
 */
export function check_exit(): boolean {
  const j = _joy;
  if (!j) return false;
  if (j.center.value() === 0) {
    const now = ticks_ms();
    if (_exitPressStart === null) {
      _exitPressStart = now;
      _exitConsumed = false;
    } else if (!_exitConsumed && ticks_diff(now, _exitPressStart) >= EXIT_HOLD_MS) {
      _exitConsumed = true;
      return true;
    }
  } else {
    _exitPressStart = null;
    _exitConsumed = false;
  }
  return false;
}

type Decision = "restart" | "exit" | null;

/** Tap any direction = restart, hold center 1.5 s = exit. Non-blocking. */
function _decisionInput(): Decision {
  const j = joy();
  if (j.center.value() === 0) {
    const now = ticks_ms();
    if (_exitPressStart === null) {
      _exitPressStart = now;
      _exitConsumed = false;
    } else if (!_exitConsumed && ticks_diff(now, _exitPressStart) >= EXIT_HOLD_MS) {
      _exitConsumed = true;
      return "exit";
    }
  } else {
    if (_exitPressStart !== null && !_exitConsumed) {
      _exitPressStart = null;
      return "restart";
    }
    _exitPressStart = null;
    _exitConsumed = false;
  }
  if (any_input()) return "restart";
  return null;
}

async function _waitWithInput(ms: number): Promise<Decision> {
  const t0 = ticks_ms();
  while (ticks_diff(ticks_ms(), t0) < ms) {
    const r = _decisionInput();
    if (r === "restart") {
      while (any_input()) await sleep_ms(10);
      return "restart";
    }
    if (r === "exit") {
      while (joy().center.value() === 0) await sleep_ms(20);
      return "exit";
    }
    await sleep_ms(15);
  }
  return null;
}

export async function loading_screen(): Promise<"start" | "exit"> {
  _exitPressStart = null;
  _exitConsumed = false;
  await _waitRelease();

  // Clockwise from top-left, in LED coords (row 7 = top of physical strip).
  const corners: ReadonlyArray<readonly [number, number]> = [
    [3, 4], [4, 4], [4, 3], [3, 3],
  ];
  let idx = 0;
  let lastStep = ticks_ms() - LOADING_STEP_MS;
  let centerStart: number | null = null;
  const n = np();
  const j = joy();

  while (true) {
    const now = ticks_ms();

    if (j.center.value() === 0) {
      if (centerStart === null) {
        centerStart = now;
      } else if (ticks_diff(now, centerStart) >= EXIT_HOLD_MS) {
        while (j.center.value() === 0) await sleep_ms(20);
        return "exit";
      }
    } else if (centerStart !== null) {
      centerStart = null;
      return "start";
    }

    if (any_input()) {
      while (any_input()) await sleep_ms(10);
      return "start";
    }

    if (ticks_diff(now, lastStep) >= LOADING_STEP_MS) {
      lastStep = now;
      _clear();
      const [col, row] = corners[idx];
      n[row * 8 + col] = LOADING_COLOR;
      n.write();
      idx = (idx + 1) % 4;
    }

    await sleep_ms(15);
  }
}

function _drawHalftone(color: RGB): void {
  const n = np();
  // Visual y=0 → LED row 7, lit at x=0,2,4,6.
  for (let col = 0; col < 8; col += 2) n[7 * 8 + col] = color;
  // Visual y=1 → LED row 6, lit at x=1,3,5,7.
  for (let col = 1; col < 8; col += 2) n[6 * 8 + col] = color;
}

function _drawDigit(digit: string, xOffset: number, yOffset: number, color: RGB): void {
  const glyph = FONT_3X5[digit] || FONT_3X5[" "];
  if (!glyph) return;
  const n = np();
  for (let gy = 0; gy < 5; gy++) {
    const row = glyph[gy];
    for (let gx = 0; gx < 3; gx++) {
      if (row[gx] === "X") {
        const vx = xOffset + gx;
        const vy = yOffset + gy;
        if (vx >= 0 && vx <= 7 && vy >= 0 && vy <= 7) {
          n[(7 - vy) * 8 + vx] = color;
        }
      }
    }
  }
}

async function _flashSequence(): Promise<Decision> {
  const n = np();
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < NUM_LEDS; j++) n[j] = GAMEOVER_TOP;
    n.write();
    const r1 = await _waitWithInput(110);
    if (r1) return r1;
    _clear();
    n.write();
    const r2 = await _waitWithInput(80);
    if (r2) return r2;
  }
  return null;
}

async function _showStaticScore(text: string): Promise<"restart" | "exit"> {
  _clear();
  _drawHalftone(GAMEOVER_TOP);
  if (text.length === 1) {
    _drawDigit(text[0], 2, 3, SCORE_COLOR);
  } else {
    _drawDigit(text[0], 0, 3, SCORE_COLOR);
    _drawDigit(text[1], 5, 3, SCORE_COLOR);
  }
  np().write();

  while (true) {
    const r = _decisionInput();
    if (r === "exit") {
      while (joy().center.value() === 0) await sleep_ms(20);
      return "exit";
    }
    if (r === "restart") {
      while (any_input()) await sleep_ms(10);
      return "restart";
    }
    await sleep_ms(15);
  }
}

async function _marqueeScore(text: string): Promise<"restart" | "exit"> {
  const rows: string[] = ["", "", "", "", ""];
  for (const ch of text) {
    const g = FONT_3X5[ch] || FONT_3X5[" "];
    for (let i = 0; i < 5; i++) rows[i] += g[i] + ".";
  }
  for (let i = 0; i < 5; i++) rows[i] += ".".repeat(8);
  const total = rows[0].length;

  let offset = -8;
  let lastStep = ticks_ms();
  const n = np();

  while (true) {
    const r = _decisionInput();
    if (r === "exit") {
      while (joy().center.value() === 0) await sleep_ms(20);
      return "exit";
    }
    if (r === "restart") {
      while (any_input()) await sleep_ms(10);
      return "restart";
    }

    const now = ticks_ms();
    if (ticks_diff(now, lastStep) >= MARQUEE_STEP_MS) {
      lastStep = now;
      offset += 1;
      if (offset > total) offset = -8;

      _clear();
      _drawHalftone(GAMEOVER_TOP);
      for (let gy = 0; gy < 5; gy++) {
        for (let vx = 0; vx < 8; vx++) {
          const src = offset + vx;
          if (src >= 0 && src < total && rows[gy][src] === "X") {
            const ledRow = 7 - (3 + gy);
            n[ledRow * 8 + vx] = SCORE_COLOR;
          }
        }
      }
      n.write();
    }

    await sleep_ms(15);
  }
}

export async function game_over_screen(score: number): Promise<"restart" | "exit"> {
  _exitPressStart = null;
  _exitConsumed = false;
  await _waitRelease();

  const r = await _flashSequence();
  if (r === "restart") return "restart";
  if (r === "exit") return "exit";

  const text = String(Math.trunc(score));
  if (text.length <= 2) return _showStaticScore(text);
  return _marqueeScore(text);
}

export async function end_screen(): Promise<"restart" | "exit"> {
  _exitPressStart = null;
  _exitConsumed = false;
  await _waitRelease();

  _clear();
  _drawHalftone(END_TOP);
  const n = np();
  for (const [vx, vy] of END_ARROW_PIXELS) {
    const ledRow = 7 - vy;
    n[ledRow * 8 + vx] = END_ARROW;
  }
  n.write();

  while (true) {
    const r = _decisionInput();
    if (r === "exit") {
      while (joy().center.value() === 0) await sleep_ms(20);
      return "exit";
    }
    if (r === "restart") {
      while (any_input()) await sleep_ms(10);
      return "restart";
    }
    await sleep_ms(15);
  }
}

export async function show_digit_briefly(
  digit: number | string,
  color: RGB,
  holdMs: number,
): Promise<"exit" | null> {
  const text = String(Math.trunc(typeof digit === "string" ? Number(digit) : digit));
  const width = text.length * 3 + (text.length - 1);
  const xOffset = Math.floor((8 - width) / 2);
  _clear();
  let pos = xOffset;
  for (const ch of text) {
    _drawDigit(ch, pos, 1, color);
    pos += 4;
  }
  np().write();
  const t0 = ticks_ms();
  while (ticks_diff(ticks_ms(), t0) < holdMs) {
    if (check_exit()) return "exit";
    await sleep_ms(15);
  }
  return null;
}
