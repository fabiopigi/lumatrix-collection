import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms } from "../runtime/time";

export const NAME = "Snake";

/**
 * Snake is the cleanest fit for responsive scaling — the grid wrap-around
 * already uses modular arithmetic, and the gameplay loop doesn't care about
 * dimensions beyond W × H. A 16×16 display gives 256 cells of room; a 32×32
 * gives 1024. The win condition (length === total cells) scales naturally.
 *
 * The screens module is still bound to the 8×8 source buffer — its
 * loading-spinner / game-over UI keeps rendering at 8×8 and the simulator
 * scales that up. Only gameplay uses the W×H buffer directly.
 */
export const RESPONSIVE = true;

const BODY_COLOR: RGB = [0, 40, 5];
const HEAD_COLOR: RGB = [25, 55, 30];
const FOOD_COLOR: RGB = [55, 15, 0];
const WIN_COLOR: RGB = [0, 55, 10];

const FRAME_MS = 50;
const START_INTERVAL = 6;
const MIN_INTERVAL = 2;
const SPEEDUP_EVERY = 5;

type Cell = readonly [number, number];
type Dir = readonly [number, number];

// Hardware bindings + display geometry are bound inside run().
let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin, JOY_LEFT: Pin, JOY_RIGHT: Pin;
let W = 8;
let H = 8;

function clear(): void {
  const n = W * H;
  for (let i = 0; i < n; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col < W && row >= 0 && row < H) {
    np[row * W + col] = color;
  }
}

function readDir(): Dir | null {
  if (JOY_UP.value() === 0) return [0, 1];
  if (JOY_DOWN.value() === 0) return [0, -1];
  if (JOY_LEFT.value() === 0) return [-1, 0];
  if (JOY_RIGHT.value() === 0) return [1, 0];
  return null;
}

function spawnFood(snakeSet: Set<string>): Cell | null {
  const free: Cell[] = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (!snakeSet.has(`${c},${r}`)) free.push([c, r]);
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}

function render(snake: Cell[], food: Cell | null): void {
  clear();
  if (food !== null) px(food[0], food[1], FOOD_COLOR);
  for (let i = 0; i < snake.length; i++) {
    const [c, r] = snake[i];
    px(c, r, i === snake.length - 1 ? HEAD_COLOR : BODY_COLOR);
  }
  np.write();
}

function moveInterval(score: number): number {
  return Math.max(MIN_INTERVAL, START_INTERVAL - Math.floor(score / SPEEDUP_EVERY));
}

async function winFlash(): Promise<void> {
  const n = W * H;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < n; j++) np[j] = WIN_COLOR;
    np.write();
    await sleep_ms(90);
    clear();
    np.write();
    await sleep_ms(70);
  }
}

async function playOneGame(): Promise<number | null> {
  // Start the snake horizontally centred in the lower-middle of the playfield,
  // a 3-cell segment. Scales to any reasonable W × H.
  const startRow = Math.floor(H / 2);
  const startCol = Math.max(1, Math.floor(W / 2) - 1);
  const snake: Cell[] = [
    [startCol, startRow],
    [startCol + 1, startRow],
    [startCol + 2, startRow],
  ];
  const snakeSet = new Set(snake.map(([c, r]) => `${c},${r}`));
  let food = spawnFood(snakeSet);
  let score = 0;
  let currentDir: Dir = [1, 0];
  let pendingDir: Dir | null = null;
  let started = false;
  let moveTimer = 0;

  while (true) {
    if (screens.check_exit()) return null;

    const inp = readDir();
    if (inp !== null) {
      const opp: Dir = [-currentDir[0], -currentDir[1]];
      if (inp[0] !== opp[0] || inp[1] !== opp[1]) {
        if (!started) {
          started = true;
          currentDir = inp;
          pendingDir = null;
        } else {
          pendingDir = inp;
        }
      }
    }

    if (started) {
      moveTimer += 1;
      if (moveTimer >= moveInterval(score)) {
        moveTimer = 0;
        if (pendingDir !== null) {
          currentDir = pendingDir;
          pendingDir = null;
        }

        const head = snake[snake.length - 1];
        const newHead: Cell = [
          ((head[0] + currentDir[0]) % W + W) % W,
          ((head[1] + currentDir[1]) % H + H) % H,
        ];
        const newKey = `${newHead[0]},${newHead[1]}`;
        const ateFood =
          food !== null && newHead[0] === food[0] && newHead[1] === food[1];

        let collision = false;
        if (snakeSet.has(newKey)) {
          if (ateFood) {
            collision = true;
          } else {
            const tail = snake[0];
            if (newHead[0] !== tail[0] || newHead[1] !== tail[1])
              collision = true;
          }
        }

        if (collision) {
          render(snake, food);
          return score;
        }

        snake.push(newHead);
        snakeSet.add(newKey);
        if (!ateFood) {
          const tail = snake.shift()!;
          snakeSet.delete(`${tail[0]},${tail[1]}`);
        } else {
          score += 1;
          food = spawnFood(snakeSet);
          if (food === null) {
            render(snake, food);
            await winFlash();
            return score;
          }
        }
      }
    }

    render(snake, food);
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
  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  W = display?.width ?? 8;
  H = display?.height ?? 8;
  // The launcher passes a W×H displayNp as screensNp so loading/game-over
  // fills the whole display natively. screensNp falls back to `neopixel`
  // only if the host didn't supply one.
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
