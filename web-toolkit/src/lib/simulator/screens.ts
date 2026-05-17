/**
 * Responsive shared lifecycle screens.
 *
 * init(np, joy, w, h) binds the rendering buffer (sized W×H) and the joystick.
 * All drawing is in visual coords (y=0 = top); the LED-chain origin (row 0 =
 * bottom) is handled by the index helper below. Apps call screens.init with
 * the W×H buffer the launcher passes them as screensNp.
 *
 * Designs follow shared/design/launcher-loading-gameover.json:
 *  - loading_screen: dark-blue ring + bright-blue head rotating clockwise.
 *    Ring grows with min(w, h): 4 px (≤8), 8 px diamond (≤16), 16 px circle.
 *  - game_over_screen: scrolling red/orange checker banner on top (+ bottom
 *    when h has room), score centered (or marqueed) in size-appropriate font.
 *    On tall displays (h ≥ 24), also renders a small "SCORE" label above.
 */

import { FONT_3X5, FONT_5X8, FONT_7X9 } from "./fonts";
import { sleep_ms, ticks_diff, ticks_ms } from "./runtime/time";
import type { Joystick, NeoPixel, RGB } from "./types";

type GlyphSet = Record<string, string[]>;

export const EXIT_HOLD_MS = 1500;
const LOADING_STEP_MS = 150;
const BANNER_STEP_MS = 120;
const MARQUEE_STEP_MS = 90;
const BRIGHTNESS = 0.25;

function hexDim(hex: string, scale = BRIGHTNESS): RGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Math.floor(parseInt(h.slice(0, 2), 16) * scale),
    Math.floor(parseInt(h.slice(2, 4), 16) * scale),
    Math.floor(parseInt(h.slice(4, 6), 16) * scale),
  ];
}

const LOADING_DIM: RGB = hexDim("#000080");
const LOADING_BRIGHT: RGB = hexDim("#0080ff");
const BANNER_RED: RGB = hexDim("#ff0000");
const BANNER_ORANGE: RGB = hexDim("#ffa040");
const BANNER_BLUE: RGB = hexDim("#0080ff");
const BANNER_GREEN: RGB = hexDim("#00ff80");
const SCORE_COLOR: RGB = hexDim("#0080ff");
const SCORE_LABEL_COLOR: RGB = hexDim("#000080");
const END_ARROW: RGB = hexDim("#ffc000");

let _np: NeoPixel | null = null;
let _joy: Joystick | null = null;
let _w = 8;
let _h = 8;
let _exitPressStart: number | null = null;
let _exitConsumed = false;

let _externalExit = false;
let _skipNextLoading = false;

export function forceExit(): void {
  _externalExit = true;
}

export function skipNextLoading(): void {
  _skipNextLoading = true;
}

export function clearExternalExit(): void {
  _externalExit = false;
}

function consumeExternalExit(): boolean {
  if (_externalExit) {
    _externalExit = false;
    return true;
  }
  return false;
}

export function init(
  neopixel: NeoPixel,
  joystick: Joystick,
  width?: number,
  height?: number,
): void {
  _np = neopixel;
  _joy = joystick;
  // Default to 8×8 when dims aren't supplied — keeps any caller that hasn't
  // been updated working at native resolution.
  _w = width ?? 8;
  _h = height ?? 8;
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

/** Visual (x, y) with y=0 = top → LED-chain index with row 0 = bottom. */
function ledIndex(x: number, y: number): number {
  return (_h - 1 - y) * _w + x;
}

function setPx(x: number, y: number, color: RGB): void {
  if (x < 0 || x >= _w || y < 0 || y >= _h) return;
  np()[ledIndex(x, y)] = color;
}

function _clear(): void {
  const n = np();
  const total = _w * _h;
  for (let i = 0; i < total; i++) n[i] = [0, 0, 0];
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

export function check_exit(): boolean {
  if (consumeExternalExit()) return true;
  const j = _joy;
  if (!j) return false;
  if (j.center.value() === 0) {
    const now = ticks_ms();
    if (_exitPressStart === null) {
      _exitPressStart = now;
      _exitConsumed = false;
    } else if (
      !_exitConsumed &&
      ticks_diff(now, _exitPressStart) >= EXIT_HOLD_MS
    ) {
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

function _decisionInput(): Decision {
  if (consumeExternalExit()) return "exit";
  const j = joy();
  if (j.center.value() === 0) {
    const now = ticks_ms();
    if (_exitPressStart === null) {
      _exitPressStart = now;
      _exitConsumed = false;
    } else if (
      !_exitConsumed &&
      ticks_diff(now, _exitPressStart) >= EXIT_HOLD_MS
    ) {
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

// ─── Loading screen ────────────────────────────────────────────────────────

/** Ring positions in visual (x, y), clockwise from the top-most pair, sized
 *  to min(w, h). The bright "head" pixel rotates through this list. */
function loadingRing(): ReadonlyArray<readonly [number, number]> {
  const m = Math.min(_w, _h);
  const cx = Math.floor(_w / 2);
  const cy = Math.floor(_h / 2);

  if (m <= 8) {
    // 4-pixel ring (2×2 at center), clockwise from top-left.
    return [
      [cx - 1, cy - 1],
      [cx, cy - 1],
      [cx, cy],
      [cx - 1, cy],
    ];
  }
  if (m <= 16) {
    // 8-pixel diamond ring, clockwise from top.
    return [
      [cx - 1, cy - 2], [cx, cy - 2],
      [cx + 1, cy - 1], [cx + 1, cy],
      [cx, cy + 1], [cx - 1, cy + 1],
      [cx - 2, cy], [cx - 2, cy - 1],
    ];
  }
  // 16-pixel circle ring, clockwise from top.
  return [
    [cx - 1, cy - 4], [cx, cy - 4],
    [cx + 1, cy - 3], [cx + 2, cy - 2],
    [cx + 3, cy - 1], [cx + 3, cy],
    [cx + 2, cy + 1], [cx + 1, cy + 2],
    [cx, cy + 3], [cx - 1, cy + 3],
    [cx - 2, cy + 2], [cx - 3, cy + 1],
    [cx - 4, cy], [cx - 4, cy - 1],
    [cx - 3, cy - 2], [cx - 2, cy - 3],
  ];
}

export async function loading_screen(): Promise<"start" | "exit"> {
  if (_skipNextLoading) {
    _skipNextLoading = false;
    return "start";
  }
  _exitPressStart = null;
  _exitConsumed = false;
  await _waitRelease();

  const ring = loadingRing();
  const n = ring.length;
  let head = 0;
  let lastStep = ticks_ms() - LOADING_STEP_MS;
  let centerStart: number | null = null;
  const j = joy();

  while (true) {
    if (consumeExternalExit()) return "exit";
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
      for (let i = 0; i < n; i++) {
        const [x, y] = ring[i];
        setPx(x, y, i === head ? LOADING_BRIGHT : LOADING_DIM);
      }
      np().write();
      head = (head + 1) % n;
    }

    await sleep_ms(15);
  }
}

// ─── Game-over screen ──────────────────────────────────────────────────────

interface BannerLayout {
  top: number;
  bottom: number;
}

function bannerLayout(): BannerLayout {
  if (_h <= 8) return { top: 2, bottom: 0 };
  if (_h <= 12) return { top: 3, bottom: 2 };
  if (_h <= 16) return { top: 4, bottom: 3 };
  if (_h <= 24) return { top: 4, bottom: 4 };
  return { top: 5, bottom: 5 };
}

/** Tall displays get an explicit "SCORE" label above the digits. */
function showsScoreLabel(): boolean {
  return _h >= 24;
}

interface BannerPalette {
  /** Primary color — fills the even-parity tile cells. */
  readonly a: RGB;
  /** Accent color — fills the odd-parity tile cells. */
  readonly b: RGB;
}

const GAMEOVER_PALETTE: BannerPalette = { a: BANNER_RED, b: BANNER_ORANGE };
const END_PALETTE: BannerPalette = { a: BANNER_BLUE, b: BANNER_GREEN };

/** 8×8 banner: fully packed 2-color checker. */
function smallBannerColor(
  x: number,
  y: number,
  phase: number,
  palette: BannerPalette,
): RGB {
  return (x + y + phase) % 2 === 0 ? palette.b : palette.a;
}

/** Larger banner: half-packed 4×4 tile.
 *  Lit cells: (tx + ty) even, where (tx, ty) = (x ± phase, y) mod 4.
 *  Within lit cells, colors alternate by 2×2 sub-block parity. */
function largeBannerColor(
  x: number,
  y: number,
  phase: number,
  scrollRight: boolean,
  palette: BannerPalette,
): RGB | null {
  const xOff = scrollRight ? -phase : phase;
  const tx = (((x + xOff) % 4) + 4) % 4;
  const ty = ((y % 4) + 4) % 4;
  if ((tx + ty) % 2 !== 0) return null;
  return (Math.floor(tx / 2) + Math.floor(ty / 2)) % 2 === 0
    ? palette.a
    : palette.b;
}

function drawTopBanner(
  rows: number,
  phase: number,
  palette: BannerPalette,
): void {
  if (rows <= 0) return;
  if (_h <= 8) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < _w; x++) {
        setPx(x, y, smallBannerColor(x, y, phase, palette));
      }
    }
    return;
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < _w; x++) {
      const c = largeBannerColor(x, y, phase, true, palette);
      if (c) setPx(x, y, c);
    }
  }
}

function drawBottomBanner(
  rows: number,
  phase: number,
  palette: BannerPalette,
): void {
  if (rows <= 0) return;
  const top = _h - rows;
  for (let localY = 0; localY < rows; localY++) {
    for (let x = 0; x < _w; x++) {
      const c = largeBannerColor(x, localY, phase, false, palette);
      if (c) setPx(x, top + localY, c);
    }
  }
}

// ─── Text helpers ──────────────────────────────────────────────────────────

function chooseScoreFont(): { font: GlyphSet; height: number } {
  if (_h <= 8) return { font: FONT_3X5, height: 5 };
  if (_h <= 16) return { font: FONT_5X8, height: 8 };
  return { font: FONT_7X9, height: 12 };
}

function glyphFor(font: GlyphSet, ch: string): string[] | undefined {
  if (ch in font) return font[ch];
  const u = ch.toUpperCase();
  if (u in font) return font[u];
  return font[" "];
}

function measureText(text: string, font: GlyphSet): number {
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const g = glyphFor(font, text[i]);
    if (!g || !g[0]) continue;
    total += g[0].length;
    if (i < text.length - 1) total += 1; // kerning gap
  }
  return total;
}

function drawText(
  text: string,
  x0: number,
  y0: number,
  font: GlyphSet,
  color: RGB,
): void {
  let cx = x0;
  for (const ch of text) {
    const g = glyphFor(font, ch);
    if (!g || !g[0]) continue;
    const w = g[0].length;
    for (let gy = 0; gy < g.length; gy++) {
      const row = g[gy];
      for (let gx = 0; gx < w; gx++) {
        if (row[gx] === "X") setPx(cx + gx, y0 + gy, color);
      }
    }
    cx += w + 1;
  }
}

function scoreYRange(): { y0: number; height: number } {
  const layout = bannerLayout();
  const labelRows = showsScoreLabel() ? 5 + 1 : 0; // label height + gap
  const top = layout.top + 1 + labelRows; // 1-row gap below banner
  const bottom = _h - layout.bottom - 1; // 1-row gap above bottom banner
  return { y0: top, height: Math.max(0, bottom - top) };
}

function scoreLabelY(): number {
  // Sits just below the top banner, with a 1-row gap above the label too.
  return bannerLayout().top + 2;
}

async function _showStaticGameOver(text: string): Promise<"restart" | "exit"> {
  const { font, height: fontH } = chooseScoreFont();
  const layout = bannerLayout();
  const range = scoreYRange();
  // Center the score vertically inside its available band.
  const scoreY0 = range.y0 + Math.max(0, Math.floor((range.height - fontH) / 2));
  const textW = measureText(text, font);
  const scoreX0 = Math.max(0, Math.floor((_w - textW) / 2));

  let phase = 0;
  let lastStep = ticks_ms();

  function frame(): void {
    _clear();
    drawTopBanner(layout.top, phase, GAMEOVER_PALETTE);
    drawBottomBanner(layout.bottom, phase, GAMEOVER_PALETTE);
    if (showsScoreLabel()) {
      const labelW = measureText("SCORE", FONT_3X5);
      const labelX = Math.max(0, Math.floor((_w - labelW) / 2));
      drawText("SCORE", labelX, scoreLabelY(), FONT_3X5, SCORE_LABEL_COLOR);
    }
    drawText(text, scoreX0, scoreY0, font, SCORE_COLOR);
    np().write();
  }

  frame();
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
    if (ticks_diff(now, lastStep) >= BANNER_STEP_MS) {
      lastStep = now;
      phase = (phase + 1) % 4;
      frame();
    }
    await sleep_ms(15);
  }
}

async function _marqueeGameOver(text: string): Promise<"restart" | "exit"> {
  const { font, height: fontH } = chooseScoreFont();
  const layout = bannerLayout();
  const range = scoreYRange();
  const scoreY0 = range.y0 + Math.max(0, Math.floor((range.height - fontH) / 2));
  const textW = measureText(text, font);
  // Total scrolling content width: text + 1-display-width trailing gap.
  const total = textW + _w;

  let bannerPhase = 0;
  let scrollOffset = -_w; // start fully off the right side
  let lastBanner = ticks_ms();
  let lastScroll = ticks_ms();

  function frame(): void {
    _clear();
    drawTopBanner(layout.top, bannerPhase, GAMEOVER_PALETTE);
    drawBottomBanner(layout.bottom, bannerPhase, GAMEOVER_PALETTE);
    if (showsScoreLabel()) {
      const labelW = measureText("SCORE", FONT_3X5);
      const labelX = Math.max(0, Math.floor((_w - labelW) / 2));
      drawText("SCORE", labelX, scoreLabelY(), FONT_3X5, SCORE_LABEL_COLOR);
    }
    // Draw text shifted so that x=scrollOffset puts the text's first column
    // at display x=-scrollOffset; let drawText clip by setPx bounds checking.
    drawText(text, -scrollOffset, scoreY0, font, SCORE_COLOR);
    np().write();
  }

  frame();
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
    let dirty = false;
    if (ticks_diff(now, lastBanner) >= BANNER_STEP_MS) {
      lastBanner = now;
      bannerPhase = (bannerPhase + 1) % 4;
      dirty = true;
    }
    if (ticks_diff(now, lastScroll) >= MARQUEE_STEP_MS) {
      lastScroll = now;
      scrollOffset += 1;
      if (scrollOffset > total) scrollOffset = -_w;
      dirty = true;
    }
    if (dirty) frame();
    await sleep_ms(15);
  }
}

export async function game_over_screen(
  score: number,
): Promise<"restart" | "exit"> {
  _exitPressStart = null;
  _exitConsumed = false;
  await _waitRelease();

  const text = String(Math.trunc(score));
  const { font } = chooseScoreFont();
  const textW = measureText(text, font);
  if (textW <= _w) return _showStaticGameOver(text);
  return _marqueeGameOver(text);
}

// ─── End screen ────────────────────────────────────────────────────────────

interface ArrowDesign {
  readonly pixels: ReadonlyArray<readonly [number, number]>;
  readonly w: number;
  readonly h: number;
}

/** Generate a left-pointing arrow with a filled isoceles-triangle head whose
 *  apex sits on the bbox's left edge, plus a thick rectangular shaft running
 *  to the right edge. shaftRows controls the shaft thickness (centered). */
function makeArrow(bboxW: number, bboxH: number, shaftRows: number): ArrowDesign {
  const pixels: [number, number][] = [];
  const cy = Math.floor((bboxH - 1) / 2);
  const headWidth = cy + 1; // 45° head: at row y the leftmost x = |y - cy|
  const shaftTop = cy - Math.floor(shaftRows / 2);
  const shaftBottom = shaftTop + shaftRows - 1;
  for (let y = 0; y < bboxH; y++) {
    const xLeft = Math.abs(y - cy);
    if (xLeft >= headWidth) continue;
    const inShaft = y >= shaftTop && y <= shaftBottom;
    const xRight = inShaft ? bboxW - 1 : headWidth - 1;
    for (let x = xLeft; x <= xRight; x++) pixels.push([x, y]);
  }
  return { pixels, w: bboxW, h: bboxH };
}

/** 8×8 arrow — original kit design, single-pixel diagonals. Bbox is in
 *  the (1..6, 3..7) region of the source 8×8 frame, expressed here in local
 *  bbox coords (0..5, 0..4) so it composes the same way as the larger ones. */
const ARROW_8: ArrowDesign = {
  pixels: [
    [2, 0],
    [1, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
    [1, 3],
    [2, 4],
  ],
  w: 6,
  h: 5,
};

/** 16×16 arrow — 14×9 filled triangle head + 3-row shaft. */
const ARROW_16: ArrowDesign = makeArrow(14, 9, 3);

/** 32×32 arrow — 28×19 filled triangle head + 5-row shaft. */
const ARROW_32: ArrowDesign = makeArrow(28, 19, 5);

/** Pick the largest pre-designed arrow that fits inside the available middle
 *  band. The 8×8 fallback gets integer-scaled if both dims have room. */
function chooseArrow(): { design: ArrowDesign; scale: number } {
  const layout = bannerLayout();
  const middleH = _h - layout.top - layout.bottom;
  if (_w >= ARROW_32.w && middleH >= ARROW_32.h) return { design: ARROW_32, scale: 1 };
  if (_w >= ARROW_16.w && middleH >= ARROW_16.h) return { design: ARROW_16, scale: 1 };
  const scale = Math.max(
    1,
    Math.min(Math.floor(_w / ARROW_8.w), Math.floor(middleH / ARROW_8.h)),
  );
  return { design: ARROW_8, scale };
}

function drawEndArrow(): void {
  const layout = bannerLayout();
  const middleTop = layout.top;
  const middleH = _h - layout.top - layout.bottom;

  const { design, scale } = chooseArrow();
  const renderedW = design.w * scale;
  const renderedH = design.h * scale;
  const offsetX = Math.floor((_w - renderedW) / 2);
  const offsetY = middleTop + Math.floor((middleH - renderedH) / 2);

  for (const [vx, vy] of design.pixels) {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        setPx(offsetX + vx * scale + dx, offsetY + vy * scale + dy, END_ARROW);
      }
    }
  }
}

export async function end_screen(): Promise<"restart" | "exit"> {
  _exitPressStart = null;
  _exitConsumed = false;
  await _waitRelease();

  const layout = bannerLayout();
  let phase = 0;
  let lastStep = ticks_ms();

  function frame(): void {
    _clear();
    drawTopBanner(layout.top, phase, END_PALETTE);
    drawBottomBanner(layout.bottom, phase, END_PALETTE);
    drawEndArrow();
    np().write();
  }

  frame();
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
    if (ticks_diff(now, lastStep) >= BANNER_STEP_MS) {
      lastStep = now;
      phase = (phase + 1) % 4;
      frame();
    }
    await sleep_ms(15);
  }
}

// ─── show_digit_briefly ────────────────────────────────────────────────────

export async function show_digit_briefly(
  digit: number | string,
  color: RGB,
  holdMs: number,
): Promise<"exit" | null> {
  const text = String(
    Math.trunc(typeof digit === "string" ? Number(digit) : digit),
  );
  const { font, height: fontH } = chooseScoreFont();
  const textW = measureText(text, font);
  const x0 = Math.max(0, Math.floor((_w - textW) / 2));
  const y0 = Math.max(0, Math.floor((_h - fontH) / 2));
  _clear();
  drawText(text, x0, y0, font, color);
  np().write();
  const t0 = ticks_ms();
  while (ticks_diff(ticks_ms(), t0) < holdMs) {
    if (check_exit()) return "exit";
    await sleep_ms(15);
  }
  return null;
}
