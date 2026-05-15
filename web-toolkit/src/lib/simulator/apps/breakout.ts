import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "Breakout";

const NUM_LEDS = 64;

const PADDLE_COLOR: RGB = [0, 40, 50];
const BALL_COLOR: RGB = [50, 50, 50];
const LEVEL_COL: RGB = [0, 50, 30];
const LIFE_COL: RGB = [55, 0, 0];

const FRAME_MS = 50;
const PADDLE_SPEED = 0.5;
const INIT_LIVES = 3;
const LAUNCH_HOLD_MS = 600;
const DEFLECTION = 0.18;
const MAX_VX = 0.55;
const MAX_VY = 0.55;

interface Level { speed: number; layout: readonly string[]; }

const LEVELS: readonly Level[] = [
  { speed: 0.30, layout: [
    "########",
    "........", "........", "........",
    "........", "........", "........", "........",
  ]},
  { speed: 0.34, layout: [
    "########", "########",
    "........", "........", "........",
    "........", "........", "........",
  ]},
  { speed: 0.38, layout: [
    "#.#.#.#.", ".#.#.#.#", "#.#.#.#.",
    "........", "........", "........",
    "........", "........",
  ]},
  { speed: 0.42, layout: [
    "########", "########", "########",
    "........", "........", "........",
    "........", "........",
  ]},
  { speed: 0.48, layout: [
    "...##...", "..####..", ".######.", "########",
    "........", "........", "........", "........",
  ]},
];

let np: NeoPixel;
let JOY_LEFT: Pin, JOY_RIGHT: Pin;

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

type Bricks = Map<string, [number, number]>;

function parseLevel(layout: readonly string[]): Bricks {
  const bricks: Bricks = new Map();
  for (let i = 0; i < layout.length; i++) {
    const row = 7 - i;
    const line = layout[i];
    for (let col = 0; col < Math.min(8, line.length); col++) {
      if (line[col] === "#") bricks.set(`${col},${row}`, [col, row]);
    }
  }
  return bricks;
}

function brickColor(row: number): RGB {
  if (row === 7) return [55, 0, 0];
  if (row === 6) return [50, 25, 0];
  if (row === 5) return [45, 40, 0];
  if (row === 4) return [0, 45, 0];
  return [0, 25, 50];
}

function drawPaddle(paddleCenter: number): void {
  const pc = Math.round(paddleCenter);
  for (const off of [-1, 0, 1]) {
    const c = pc + off;
    if (c >= 0 && c <= 7) px(c, 0, PADDLE_COLOR);
  }
}

function drawBricks(bricks: Bricks): void {
  for (const [c, r] of bricks.values()) px(c, r, brickColor(r));
}

function render(paddleCenter: number, ballX: number, ballY: number, bricks: Bricks, ballVisible = true): void {
  clear();
  drawBricks(bricks);
  drawPaddle(paddleCenter);
  if (ballVisible) {
    const bx = Math.round(ballX);
    const by = Math.round(ballY);
    px(bx, by, BALL_COLOR);
  }
  np.write();
}

function capSpeed(vx: number, vy: number): [number, number] {
  if (vx > MAX_VX) vx = MAX_VX;
  else if (vx < -MAX_VX) vx = -MAX_VX;
  if (vy > MAX_VY) vy = MAX_VY;
  else if (vy < -MAX_VY) vy = -MAX_VY;
  return [vx, vy];
}

function updatePaddle(paddleCenter: number): number {
  if (JOY_LEFT.value() === 0) paddleCenter -= PADDLE_SPEED;
  if (JOY_RIGHT.value() === 0) paddleCenter += PADDLE_SPEED;
  if (paddleCenter < 1.0) paddleCenter = 1.0;
  if (paddleCenter > 6.0) paddleCenter = 6.0;
  return paddleCenter;
}

type BallOutcome = "cleared" | "lost" | "exit";

async function playBall(
  bricks: Bricks,
  baseSpeed: number,
  paddleCenter: number,
  score: number,
): Promise<{ outcome: BallOutcome; score: number; paddleCenter: number }> {
  let ballX = paddleCenter;
  let ballY = 1.0;
  let ballVx = 0.0;
  let ballVy = 0.0;

  const t0 = ticks_ms();
  while (ticks_diff(ticks_ms(), t0) < LAUNCH_HOLD_MS) {
    if (screens.check_exit()) return { outcome: "exit", score, paddleCenter };
    paddleCenter = updatePaddle(paddleCenter);
    ballX = paddleCenter;
    render(paddleCenter, ballX, ballY, bricks);
    await sleep_ms(FRAME_MS);
  }

  ballVy = baseSpeed;
  ballVx = (Math.random() - 0.5) * 0.3;

  while (true) {
    if (screens.check_exit()) return { outcome: "exit", score, paddleCenter };

    paddleCenter = updatePaddle(paddleCenter);

    ballX += ballVx;
    ballY += ballVy;

    if (ballX < 0) {
      ballX = -ballX;
      ballVx = -ballVx;
    } else if (ballX > 7) {
      ballX = 14 - ballX;
      ballVx = -ballVx;
    }

    if (ballY > 7) {
      ballY = 14 - ballY;
      ballVy = -ballVy;
    }

    const bc = Math.round(ballX);
    const br = Math.round(ballY);
    const key = `${bc},${br}`;
    if (bc >= 0 && bc <= 7 && br >= 0 && br <= 7 && bricks.has(key)) {
      bricks.delete(key);
      score += 1;
      const prevX = ballX - ballVx;
      const prevY = ballY - ballVy;
      const crossedY = Math.round(prevY) !== br;
      const crossedX = Math.round(prevX) !== bc;
      if (crossedY && !crossedX) ballVy = -ballVy;
      else if (crossedX && !crossedY) ballVx = -ballVx;
      else {
        ballVy = -ballVy;
        ballVx = -ballVx;
      }
    }

    if (ballY <= 0 && ballVy < 0) {
      if (Math.abs(ballX - paddleCenter) <= 1.5) {
        ballY = -ballY;
        ballVy = -ballVy;
        const offset = ballX - paddleCenter;
        ballVx += offset * DEFLECTION;
        [ballVx, ballVy] = capSpeed(ballVx, ballVy);
      } else {
        render(paddleCenter, ballX, ballY, bricks, false);
        return { outcome: "lost", score, paddleCenter };
      }
    }

    if (bricks.size === 0) {
      render(paddleCenter, ballX, ballY, bricks);
      await sleep_ms(200);
      return { outcome: "cleared", score, paddleCenter };
    }

    render(paddleCenter, ballX, ballY, bricks);
    await sleep_ms(FRAME_MS);
  }
}

async function levelClearFlash(): Promise<void> {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < NUM_LEDS; j++) np[j] = [0, 50, 30];
    np.write();
    await sleep_ms(80);
    clear();
    np.write();
    await sleep_ms(60);
  }
}

async function playOneGame(): Promise<number | null> {
  let score = 0;
  let lives = INIT_LIVES;
  let levelIdx = 0;
  let paddleCenter = 4.0;

  while (true) {
    if (screens.check_exit()) return null;

    if ((await screens.show_digit_briefly(levelIdx + 1, LEVEL_COL, 600)) === "exit") return null;

    const bricks = parseLevel(LEVELS[levelIdx].layout);
    const speed = LEVELS[levelIdx].speed;

    while (bricks.size > 0 && lives > 0) {
      if (screens.check_exit()) return null;

      if ((await screens.show_digit_briefly(lives, LIFE_COL, 500)) === "exit") return null;

      const res = await playBall(bricks, speed, paddleCenter, score);
      score = res.score;
      paddleCenter = res.paddleCenter;
      if (res.outcome === "exit") return null;
      if (res.outcome === "lost") lives -= 1;
      else if (res.outcome === "cleared") break;
    }

    if (lives <= 0) return score;

    await levelClearFlash();
    levelIdx = (levelIdx + 1) % LEVELS.length;
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
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
