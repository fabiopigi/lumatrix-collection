import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";
import * as screens from "../screens";
import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";

export const NAME = "Connect4";

/**
 * Layout strategy:
 * - When the display is a clean uniform scale of 8×8 (16×16, 24×24, 32×32, …)
 *   we keep the original 8 cols × 7 piece rows board and grow each cell into a
 *   scale×scale block. Cells ≥ 4 px square render as filled ellipses ("discs")
 *   instead of solid squares so the pieces read as coins on larger displays.
 * - Otherwise (non-uniform aspect like 32×8 / 8×32, or non-multiple sizes) the
 *   board fills the available area at 1×1 cells: COLS = W, piece rows = H − 1,
 *   with the top LED row reserved as the cursor lane. Four-in-a-row still
 *   wins; the game just gets longer on bigger boards.
 */
export const RESPONSIVE = true;

const RED = 1;
const YELLOW = 2;
type Player = typeof RED | typeof YELLOW;

const PLACED: Record<Player, RGB> = {
  [RED]: [64, 0, 0],
  [YELLOW]: [64, 64, 0],
};
const CURSOR: Record<Player, RGB> = {
  [RED]: [32, 0, 0],
  [YELLOW]: [32, 32, 0],
};
// Faint landing-spot hint — visibly dimmer than the top cursor.
const PREVIEW: Record<Player, RGB> = {
  [RED]: [8, 0, 0],
  [YELLOW]: [8, 8, 0],
};

const FRAME_MS = 50;
const FALL_STEP_MS = 70;
const PULSE_CYCLES = 3;
const PULSE_HALF_MS = 220;
const DRAW_HOLD_MS = 1200;

let np: NeoPixel;
let JOY_LEFT: Pin;
let JOY_RIGHT: Pin;
let JOY_CENTER: Pin;

let W = 8;
let H = 8;
let COLS = 8;
let ROWS = 7;
let CELL_W = 1;
let CELL_H = 1;
let OX = 0;
// Mask of which (dx, dy) pixels inside a cell are lit. null = solid block.
let CELL_MASK: boolean[][] | null = null;

function buildEllipseMask(w: number, h: number): boolean[][] {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rx = w / 2;
  const ry = h / 2;
  const mask: boolean[][] = [];
  for (let y = 0; y < h; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < w; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      row.push(nx * nx + ny * ny <= 1);
    }
    mask.push(row);
  }
  return mask;
}

function configureLayout(): void {
  const scaleX = Math.max(1, Math.floor(W / 8));
  const scaleY = Math.max(1, Math.floor(H / 8));
  const uniform =
    scaleX === scaleY && W === 8 * scaleX && H === 8 * scaleY;
  if (uniform) {
    COLS = 8;
    ROWS = 7;
    CELL_W = scaleX;
    CELL_H = scaleY;
  } else {
    CELL_W = 1;
    CELL_H = 1;
    COLS = W;
    ROWS = H - 1;
  }
  OX = Math.max(0, Math.floor((W - COLS * CELL_W) / 2));
  CELL_MASK =
    CELL_W >= 4 && CELL_H >= 4 ? buildEllipseMask(CELL_W, CELL_H) : null;
}

function clearAll(): void {
  const n = W * H;
  for (let i = 0; i < n; i++) np[i] = [0, 0, 0];
}

function setPx(col: number, row: number, color: RGB): void {
  if (col >= 0 && col < W && row >= 0 && row < H) {
    np[row * W + col] = color;
  }
}

/** Draw a logical board cell at (col, row), row 0 = bottom piece row. */
function drawCell(col: number, row: number, color: RGB): void {
  const ledX0 = OX + col * CELL_W;
  const ledY0 = row * CELL_H;
  for (let dy = 0; dy < CELL_H; dy++) {
    for (let dx = 0; dx < CELL_W; dx++) {
      if (CELL_MASK !== null && !CELL_MASK[dy][dx]) continue;
      setPx(ledX0 + dx, ledY0 + dy, color);
    }
  }
}

/** Cursor sits in the top lane: LED rows [ROWS*CELL_H, ROWS*CELL_H + CELL_H). */
function drawCursorCell(col: number, color: RGB): void {
  const ledX0 = OX + col * CELL_W;
  const ledY0 = ROWS * CELL_H;
  for (let dy = 0; dy < CELL_H; dy++) {
    for (let dx = 0; dx < CELL_W; dx++) {
      if (CELL_MASK !== null && !CELL_MASK[dy][dx]) continue;
      setPx(ledX0 + dx, ledY0 + dy, color);
    }
  }
}

type Board = number[][];

function makeBoard(): Board {
  const b: Board = [];
  for (let c = 0; c < COLS; c++) {
    const col: number[] = [];
    for (let r = 0; r < ROWS; r++) col.push(0);
    b.push(col);
  }
  return b;
}

function drawPieces(board: Board): void {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const v = board[c][r];
      if (v) drawCell(c, r, PLACED[v as Player]);
    }
  }
}

function renderBoard(
  board: Board,
  cursorCol: number,
  cursorPlayer: Player | null,
): void {
  clearAll();
  drawPieces(board);
  if (cursorPlayer !== null) {
    const target = columnTop(board, cursorCol);
    if (target !== null) {
      drawCell(cursorCol, target, PREVIEW[cursorPlayer]);
    }
    drawCursorCell(cursorCol, CURSOR[cursorPlayer]);
  }
  np.write();
}

function columnTop(board: Board, col: number): number | null {
  for (let r = 0; r < ROWS; r++) {
    if (board[col][r] === 0) return r;
  }
  return null;
}

async function animateDrop(
  board: Board,
  col: number,
  targetRow: number,
  player: Player,
): Promise<boolean> {
  const color = PLACED[player];
  for (let r = ROWS - 1; r >= targetRow; r--) {
    if (screens.check_exit()) return false;
    clearAll();
    drawPieces(board);
    drawCell(col, r, color);
    np.write();
    await sleep_ms(FALL_STEP_MS);
  }
  return true;
}

function winningLine(
  board: Board,
  col: number,
  row: number,
  player: Player,
): Array<[number, number]> | null {
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (const [dc, dr] of dirs) {
    const line: Array<[number, number]> = [[col, row]];
    let c = col + dc;
    let r = row + dr;
    while (
      c >= 0 &&
      c < COLS &&
      r >= 0 &&
      r < ROWS &&
      board[c][r] === player
    ) {
      line.push([c, r]);
      c += dc;
      r += dr;
    }
    c = col - dc;
    r = row - dr;
    while (
      c >= 0 &&
      c < COLS &&
      r >= 0 &&
      r < ROWS &&
      board[c][r] === player
    ) {
      line.push([c, r]);
      c -= dc;
      r -= dr;
    }
    if (line.length >= 4) return line;
  }
  return null;
}

async function pulseLine(
  board: Board,
  line: Array<[number, number]>,
  player: Player,
): Promise<boolean> {
  const bright = PLACED[player];
  const dim: RGB = [
    Math.floor(bright[0] / 4),
    Math.floor(bright[1] / 4),
    Math.floor(bright[2] / 4),
  ];
  const cells = new Set(line.map(([c, r]) => `${c},${r}`));
  for (let i = 0; i < PULSE_CYCLES; i++) {
    for (const color of [dim, bright]) {
      if (screens.check_exit()) return false;
      clearAll();
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          const v = board[c][r];
          if (!v) continue;
          const onLine = cells.has(`${c},${r}`);
          drawCell(c, r, onLine ? color : PLACED[v as Player]);
        }
      }
      np.write();
      await sleep_ms(PULSE_HALF_MS);
    }
  }
  return true;
}

async function holdWithExit(ms: number): Promise<boolean> {
  const t0 = ticks_ms();
  while (ticks_diff(ticks_ms(), t0) < ms) {
    if (screens.check_exit()) return true;
    await sleep_ms(15);
  }
  return false;
}

async function playOneRound(): Promise<Player | 0 | null> {
  const board = makeBoard();
  let cursorCol = Math.floor(COLS / 2);
  let player: Player = RED;
  let moves = 0;

  let prevLeft = false;
  let prevRight = false;
  let centerPressStart: number | null = null;

  while (true) {
    if (screens.check_exit()) return null;

    const curLeft = JOY_LEFT.value() === 0;
    const curRight = JOY_RIGHT.value() === 0;
    const curCenter = JOY_CENTER.value() === 0;

    if (curLeft && !prevLeft && cursorCol > 0) cursorCol -= 1;
    if (curRight && !prevRight && cursorCol < COLS - 1) cursorCol += 1;

    if (curCenter && centerPressStart === null) {
      centerPressStart = ticks_ms();
    } else if (!curCenter && centerPressStart !== null) {
      const held = ticks_diff(ticks_ms(), centerPressStart);
      centerPressStart = null;
      if (held < screens.EXIT_HOLD_MS) {
        const target = columnTop(board, cursorCol);
        if (target !== null) {
          if (!(await animateDrop(board, cursorCol, target, player)))
            return null;
          board[cursorCol][target] = player;
          moves += 1;

          const line = winningLine(board, cursorCol, target, player);
          if (line) {
            if (!(await pulseLine(board, line, player))) return null;
            return player;
          }

          if (moves >= COLS * ROWS) {
            renderBoard(board, cursorCol, null);
            if (await holdWithExit(DRAW_HOLD_MS)) return null;
            return 0;
          }

          player = player === RED ? YELLOW : RED;
        }
      }
    }

    prevLeft = curLeft;
    prevRight = curRight;

    renderBoard(board, cursorCol, player);
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
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  JOY_CENTER = joystick.center;
  W = display?.width ?? 8;
  H = display?.height ?? 8;
  configureLayout();
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const outcome = await playOneRound();
    if (outcome === null) return;
    if ((await screens.end_screen()) === "exit") return;
  }
}
