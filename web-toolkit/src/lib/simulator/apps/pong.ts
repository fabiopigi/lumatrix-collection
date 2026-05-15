import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms } from "../runtime/time";

export const NAME = "Pong";

/**
 * Pong scales naturally: a wider playfield means more anticipation between
 * paddle hits, a taller playfield means a longer paddle (kept proportional)
 * which roughly preserves difficulty across sizes. The deflection physics
 * are already in floats and work at any resolution. The CPU's perfect-
 * tracker behaviour is intentionally capped by `CPU_SPEED_PER_FRAME` so it
 * isn't unbeatable at higher widths.
 */
export const RESPONSIVE = true;

const PLAYER_COLOR: RGB = [0, 30, 60];
const CPU_COLOR: RGB = [55, 0, 0];
const BALL_COLOR: RGB = [55, 55, 55];

const FRAME_MS = 50;
const PLAYER_SPEED = 0.5;

// The CPU is a "perfect tracker" with a per-frame speed cap so a wider
// field gives the player a fighting chance. Tuned to feel similar at 8×8
// (where the CPU is unbeatable anyway) and 16×16+ (where it's beatable).
const CPU_SPEED_PER_FRAME = 0.4;

const INITIAL_VX = 0.4;
const INITIAL_VY_MIN = 0.15;
const INITIAL_VY_MAX = 0.3;
const MAX_VX = 1.2;
const MAX_VY = 0.8;
const SPEEDUP_HITS = 10;
const SPEEDUP_FACTOR = 1.15;
const DEFLECTION = 0.18;

let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin;
let W = 8;
let H = 8;
let PLAYER_COL = 0;
let CPU_COL = 7;
let PADDLE_LEN = 2;

function clear(): void {
  const n = W * H;
  for (let i = 0; i < n; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col < W && row >= 0 && row < H) {
    np[row * W + col] = color;
  }
}

function drawPaddle(col: number, topY: number, color: RGB): void {
  const ty = Math.max(0, Math.min(H - PADDLE_LEN, Math.floor(topY)));
  for (let k = 0; k < PADDLE_LEN; k++) {
    const y = ty + k;
    px(col, H - 1 - y, color);
  }
}

function render(
  playerY: number,
  cpuY: number,
  ballX: number,
  ballY: number,
): void {
  clear();
  drawPaddle(PLAYER_COL, playerY, PLAYER_COLOR);
  drawPaddle(CPU_COL, cpuY, CPU_COLOR);
  const bx = Math.max(0, Math.min(W - 1, Math.floor(ballX)));
  const by = Math.max(0, Math.min(H - 1, Math.floor(ballY)));
  px(bx, H - 1 - by, BALL_COLOR);
  np.write();
}

function capSpeed(vx: number, vy: number): [number, number] {
  if (vx > MAX_VX) vx = MAX_VX;
  else if (vx < -MAX_VX) vx = -MAX_VX;
  if (vy > MAX_VY) vy = MAX_VY;
  else if (vy < -MAX_VY) vy = -MAX_VY;
  return [vx, vy];
}

function pickSign(): 1 | -1 {
  return Math.random() < 0.5 ? -1 : 1;
}

async function playOneGame(): Promise<number | null> {
  let playerY = H / 2 - PADDLE_LEN / 2;
  let cpuY = H / 2 - PADDLE_LEN / 2;
  let ballX = W / 2;
  let ballY = H / 2;
  let ballVx = INITIAL_VX * pickSign();
  let ballVy =
    pickSign() *
    (INITIAL_VY_MIN + (INITIAL_VY_MAX - INITIAL_VY_MIN) * Math.random());

  let score = 0;
  let hits = 0;
  const introFrames = 14;
  let frame = 0;

  while (true) {
    if (screens.check_exit()) return null;

    if (JOY_UP.value() === 0) playerY -= PLAYER_SPEED;
    if (JOY_DOWN.value() === 0) playerY += PLAYER_SPEED;
    if (playerY < 0) playerY = 0;
    if (playerY > H - PADDLE_LEN) playerY = H - PADDLE_LEN;

    // CPU tracks the ball but is capped per-frame so wider fields give the
    // player something to work with.
    let cpuTarget = ballY - (PADDLE_LEN - 1) / 2;
    if (cpuTarget < 0) cpuTarget = 0;
    if (cpuTarget > H - PADDLE_LEN) cpuTarget = H - PADDLE_LEN;
    const dy = cpuTarget - cpuY;
    if (Math.abs(dy) <= CPU_SPEED_PER_FRAME) cpuY = cpuTarget;
    else cpuY += Math.sign(dy) * CPU_SPEED_PER_FRAME;

    if (frame >= introFrames) {
      ballX += ballVx;
      ballY += ballVy;

      if (ballY < 0) {
        ballY = -ballY;
        ballVy = -ballVy;
      } else if (ballY > H - 1) {
        ballY = 2 * (H - 1) - ballY;
        ballVy = -ballVy;
      }

      if (ballX < 0) {
        const bi = Math.round(ballY);
        const pyTop = Math.floor(playerY);
        if (pyTop <= bi && bi <= pyTop + PADDLE_LEN - 1) {
          ballX = -ballX;
          ballVx = -ballVx;
          score += 1;
          hits += 1;
          const paddleCenter = playerY + (PADDLE_LEN - 1) / 2;
          ballVy += (ballY - paddleCenter) * DEFLECTION;
          if (hits % SPEEDUP_HITS === 0) {
            ballVx *= SPEEDUP_FACTOR;
            ballVy *= SPEEDUP_FACTOR;
          }
          [ballVx, ballVy] = capSpeed(ballVx, ballVy);
        } else {
          render(playerY, cpuY, ballX, ballY);
          return score;
        }
      }

      if (ballX > W - 1) {
        ballX = 2 * (W - 1) - ballX;
        ballVx = -ballVx;
        hits += 1;
        const paddleCenter = cpuY + (PADDLE_LEN - 1) / 2;
        ballVy += (ballY - paddleCenter) * DEFLECTION;
        if (hits % SPEEDUP_HITS === 0) {
          ballVx *= SPEEDUP_FACTOR;
          ballVy *= SPEEDUP_FACTOR;
        }
        [ballVx, ballVy] = capSpeed(ballVx, ballVy);
      }
    }

    render(playerY, cpuY, ballX, ballY);
    await sleep_ms(FRAME_MS);
    frame += 1;
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
  W = display?.width ?? 8;
  H = display?.height ?? 8;
  // Paddle scales with height: 2 cells tall on 8×8 (original), 4 on 16-tall,
  // 6 on 24-tall. Rounded down to keep difficulty similar.
  PADDLE_LEN = Math.max(2, Math.floor(H / 4));
  PLAYER_COL = 0;
  CPU_COL = W - 1;
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
