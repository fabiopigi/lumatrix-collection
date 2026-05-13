import type { Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms } from "../runtime/time";

export const NAME = "Snake";

const NUM_LEDS = 64;

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

let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin, JOY_LEFT: Pin, JOY_RIGHT: Pin;

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
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
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
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
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < NUM_LEDS; j++) np[j] = WIN_COLOR;
    np.write();
    await sleep_ms(90);
    clear();
    np.write();
    await sleep_ms(70);
  }
}

async function playOneGame(): Promise<number | null> {
  const snake: Cell[] = [[3, 4], [4, 4], [5, 4]];
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
          ((head[0] + currentDir[0]) % 8 + 8) % 8,
          ((head[1] + currentDir[1]) % 8 + 8) % 8,
        ];
        const newKey = `${newHead[0]},${newHead[1]}`;
        const ateFood = food !== null && newHead[0] === food[0] && newHead[1] === food[1];

        let collision = false;
        if (snakeSet.has(newKey)) {
          if (ateFood) {
            collision = true;
          } else {
            const tail = snake[0];
            if (newHead[0] !== tail[0] || newHead[1] !== tail[1]) collision = true;
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

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
  np = neopixel;
  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  screens.init(neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
