import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "TicTacToe";
export const RESPONSIVE = true;

const FRAME_MS = 35;
const WIN_FLASH_MS = 2200;

let np: NeoPixel;
let W = 8;
let H = 8;
let NUM_LEDS = 64;
let JOY_UP: Pin, JOY_DOWN: Pin, JOY_LEFT: Pin, JOY_RIGHT: Pin, JOY_CENTER: Pin;

const RED: RGB = [64, 0, 0];
const RED_DARK: RGB = [24, 0, 0];
const ORANGE: RGB = [64, 28, 0];
const GREEN: RGB = [32, 64, 0];
const GREEN_DARK: RGB = [12, 24, 0];
const CYAN: RGB = [0, 48, 64];
const GRID: RGB = [16, 16, 18];

const GREEN_32 = ["...####...", "..######..", ".########.", "####..####", "###....###", "###....###", "####..####", ".########.", "..######..", "...####..."];
const RED_32 = [".#......#.", "###....###", ".###..###.", "..######..", "...####...", "...####...", "..######..", ".###..###.", "###....###", ".#......#."];
const GREEN_16 = [".##.", "####", "####", ".##."];
const RED_16 = ["####", "#..#", "#..#", "####"];
const GREEN_8 = ["##", "##"];
const RED_8 = ["##", "##"];

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function indexXY(x: number, y: number): number {
  return (H - 1 - y) * W + x;
}

function px(x: number, y: number, color: RGB): void {
  if (x >= 0 && x < W && y >= 0 && y < H) {
    np[indexXY(x, y)] = color;
  }
}

function scaleColor(color: RGB, t: number): RGB {
  return [Math.floor(color[0] * t), Math.floor(color[1] * t), Math.floor(color[2] * t)];
}

function pulseFactor(): number {
  const p = ticks_ms() % 1000;
  const t = p < 500 ? 1.0 - p / 500.0 : (p - 500) / 500.0;
  return 0.35 + 0.65 * t;
}

function smallCellPixels(cellX: number, cellY: number): [[number, number], [number, number]] {
  const xs = ([[0, 1], [3, 4], [6, 7]] as [[number, number], [number, number], [number, number]])[cellX];
  const ys = ([[0, 1], [3, 4], [6, 7]] as [[number, number], [number, number], [number, number]])[cellY];
  return [xs, ys];
}

function drawSmallScaledPixel(vx: number, vy: number, color: RGB, scale: number): void {
  const x0 = vx * scale;
  const y0 = vy * scale;
  for (let y = y0; y < y0 + scale; y++) {
    for (let x = x0; x < x0 + scale; x++) px(x, y, color);
  }
}

function drawSmallScaledGrid(scale: number): void {
  for (const v of [2, 5]) {
    for (let y = 0; y < 8; y++) drawSmallScaledPixel(v, y, GRID, scale);
    for (let x = 0; x < 8; x++) drawSmallScaledPixel(x, v, GRID, scale);
  }
}

function cellBounds32(cellX: number, cellY: number): [number, number, number, number] {
  const xs = ([[0, 9], [11, 20], [22, 31]] as [[number, number], [number, number], [number, number]])[cellX];
  const ys = ([[0, 9], [11, 20], [22, 31]] as [[number, number], [number, number], [number, number]])[cellY];
  return [xs[0], ys[0], xs[1], ys[1]];
}

function drawGrid32(): void {
  for (const x of [10, 21]) {
    for (let y = 0; y < 32; y++) px(x, y, GRID);
  }
  for (const y of [10, 21]) {
    for (let x = 0; x < 32; x++) px(x, y, GRID);
  }
}

function patternForSize(player: number): string[] {
  if (W >= 32 && H >= 32) return player === 1 ? RED_32 : GREEN_32;
  if (W >= 16 && H >= 16) return player === 1 ? RED_16 : GREEN_16;
  return player === 1 ? RED_8 : GREEN_8;
}

function drawPatternAt(x0: number, y0: number, pattern: string[], color: RGB): void {
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern[y].length; x++) {
      if (pattern[y][x] === "#") px(x0 + x, y0 + y, color);
    }
  }
}

function drawSelection(cellX: number, cellY: number, player: number): void {
  const color = scaleColor(player === 1 ? RED_DARK : GREEN_DARK, pulseFactor());

  if (W >= 32 && H >= 32) {
    const [x0, y0, x1, y1] = cellBounds32(cellX, cellY);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) px(x, y, color);
    }
    return;
  }

  const scale = Math.max(1, Math.floor(W / 8));
  const [xs, ys] = smallCellPixels(cellX, cellY);
  for (let vy = ys[0]; vy <= ys[1]; vy++) {
    for (let vx = xs[0]; vx <= xs[1]; vx++) drawSmallScaledPixel(vx, vy, color, scale);
  }
}

function drawMark(cellX: number, cellY: number, player: number, overrideColor?: RGB): void {
  const color = overrideColor ?? (player === 1 ? RED : GREEN);
  const pattern = patternForSize(player);

  if (W >= 32 && H >= 32) {
    const [x0, y0] = cellBounds32(cellX, cellY);
    drawPatternAt(x0, y0, pattern, color);
    return;
  }

  const scale = Math.max(1, Math.floor(W / 8));
  const [xs, ys] = smallCellPixels(cellX, cellY);
  drawPatternAt(xs[0] * scale, ys[0] * scale, pattern, color);
}

function winner(board: number[]): [number, number[]] {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return [board[a], [a, b, c]];
  }
  if (board.every(Boolean)) return [3, []];
  return [0, []];
}

function render(
  board: number[],
  cursorX: number,
  cursorY: number,
  player: number,
  winLine: number[] = [],
  winFlash = false,
): void {
  clear();

  if (W >= 32 && H >= 32) drawGrid32();
  else drawSmallScaledGrid(Math.max(1, Math.floor(W / 8)));

  const selectedIdx = cursorY * 3 + cursorX;
  if (!winFlash && board[selectedIdx] === 0) drawSelection(cursorX, cursorY, player);

  const flashAlt = Math.floor(ticks_ms() / 180) % 2 === 1;

  for (let i = 0; i < board.length; i++) {
    const mark = board[i];
    if (!mark) continue;
    let color: RGB | undefined;
    if (winFlash && winLine.includes(i)) {
      color = mark === 1 ? (flashAlt ? ORANGE : RED) : (flashAlt ? CYAN : GREEN);
    }
    drawMark(i % 3, Math.floor(i / 3), mark, color);
  }

  np.write();
}

async function showWinFlash(board: number[], cursorX: number, cursorY: number, player: number, line: number[]): Promise<"done" | null> {
  const start = ticks_ms();
  while (ticks_diff(ticks_ms(), start) < WIN_FLASH_MS) {
    if (screens.check_exit()) return null;
    render(board, cursorX, cursorY, player, line, true);
    await sleep_ms(FRAME_MS);
  }
  return "done";
}

async function playOneRound(): Promise<number | null> {
  const board = Array(9).fill(0);
  let cursorX = 1;
  let cursorY = 1;
  let player = 1; // Red starts.

  let prevUp = false, prevDown = false, prevLeft = false, prevRight = false, prevCenter = false;

  while (true) {
    if (screens.check_exit()) return null;

    const curUp = JOY_UP.value() === 0;
    const curDown = JOY_DOWN.value() === 0;
    const curLeft = JOY_LEFT.value() === 0;
    const curRight = JOY_RIGHT.value() === 0;
    const curCenter = JOY_CENTER.value() === 0;

    if (curUp && !prevUp) cursorY = Math.max(0, cursorY - 1);
    if (curDown && !prevDown) cursorY = Math.min(2, cursorY + 1);
    if (curLeft && !prevLeft) cursorX = Math.max(0, cursorX - 1);
    if (curRight && !prevRight) cursorX = Math.min(2, cursorX + 1);

    if (curCenter && !prevCenter) {
      const idx = cursorY * 3 + cursorX;
      if (board[idx] === 0) {
        board[idx] = player;
        const [result, line] = winner(board);
        if (result) {
          if (line.length) {
            if ((await showWinFlash(board, cursorX, cursorY, player, line)) === null) return null;
          } else {
            render(board, cursorX, cursorY, player);
            await sleep_ms(900);
          }
          if (result === 1) return 1;
          if (result === 2) return 2;
          return 0;
        }
        player = player === 1 ? 2 : 1;
      }
    }

    prevUp = curUp;
    prevDown = curDown;
    prevLeft = curLeft;
    prevRight = curRight;
    prevCenter = curCenter;

    render(board, cursorX, cursorY, player);
    await sleep_ms(FRAME_MS);
  }
}

export async function run(
  neopixel: NeoPixel,
  joystick: Joystick,
  display?: DisplayDims,
  screensNp?: NeoPixel,
): Promise<void> {
  np = neopixel;
  W = display?.width ?? 8;
  H = display?.height ?? 8;
  NUM_LEDS = W * H;

  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  JOY_CENTER = joystick.center;

  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);

  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneRound();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
