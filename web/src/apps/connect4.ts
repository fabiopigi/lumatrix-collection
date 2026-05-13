import type { NeoPixel, RGB } from "../hardware/neopixel";
import type { Joystick, Pin } from "../hardware/joystick";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "Connect4";

const NUM_LEDS = 64;
const COLS = 8;
const ROWS = 7; // LED rows 0..6 hold pieces; LED row 7 is the cursor lane.

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

const FRAME_MS = 50;
const FALL_STEP_MS = 70;
const PULSE_CYCLES = 3;
const PULSE_HALF_MS = 220;
const DRAW_HOLD_MS = 1200;

let np: NeoPixel;
let JOY_LEFT: Pin;
let JOY_RIGHT: Pin;
let JOY_CENTER: Pin;

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

type Board = number[][]; // board[col][row]; 0 = empty.

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
      if (v) px(c, r, PLACED[v as Player]);
    }
  }
}

function renderBoard(board: Board, cursorCol: number, cursorPlayer: Player | null): void {
  clear();
  drawPieces(board);
  if (cursorPlayer !== null) {
    px(cursorCol, 7, CURSOR[cursorPlayer]);
  }
  np.write();
}

function columnTop(board: Board, col: number): number | null {
  for (let r = 0; r < ROWS; r++) {
    if (board[col][r] === 0) return r;
  }
  return null;
}

async function animateDrop(board: Board, col: number, targetRow: number, player: Player): Promise<boolean> {
  const color = PLACED[player];
  for (let r = 6; r >= targetRow; r--) {
    if (screens.check_exit()) return false;
    clear();
    drawPieces(board);
    px(col, r, color);
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
    while (c >= 0 && c < COLS && r >= 0 && r < ROWS && board[c][r] === player) {
      line.push([c, r]);
      c += dc;
      r += dr;
    }
    c = col - dc;
    r = row - dr;
    while (c >= 0 && c < COLS && r >= 0 && r < ROWS && board[c][r] === player) {
      line.push([c, r]);
      c -= dc;
      r -= dr;
    }
    if (line.length >= 4) return line;
  }
  return null;
}

async function pulseLine(board: Board, line: Array<[number, number]>, player: Player): Promise<boolean> {
  const bright = PLACED[player];
  const dim: RGB = [Math.floor(bright[0] / 4), Math.floor(bright[1] / 4), Math.floor(bright[2] / 4)];
  const cells = new Set(line.map(([c, r]) => `${c},${r}`));
  for (let i = 0; i < PULSE_CYCLES; i++) {
    for (const color of [dim, bright]) {
      if (screens.check_exit()) return false;
      clear();
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          const v = board[c][r];
          if (!v) continue;
          const onLine = cells.has(`${c},${r}`);
          px(c, r, onLine ? color : PLACED[v as Player]);
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
  let cursorCol = 4;
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
          if (!(await animateDrop(board, cursorCol, target, player))) return null;
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

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
  np = neopixel;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  JOY_CENTER = joystick.center;
  screens.init(neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const outcome = await playOneRound();
    if (outcome === null) return;
    if ((await screens.end_screen()) === "exit") return;
  }
}
