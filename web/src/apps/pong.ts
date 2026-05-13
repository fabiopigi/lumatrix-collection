import type { NeoPixel, RGB } from "../hardware/neopixel";
import type { Joystick, Pin } from "../hardware/joystick";
import * as screens from "../screens";
import { sleep_ms } from "../runtime/time";

export const NAME = "Pong";

const NUM_LEDS = 64;
const PLAYER_COL = 0;
const CPU_COL = 7;
const PADDLE_LEN = 2;

const PLAYER_COLOR: RGB = [0, 30, 60];
const CPU_COLOR: RGB = [55, 0, 0];
const BALL_COLOR: RGB = [55, 55, 55];

const FRAME_MS = 50;
const PLAYER_SPEED = 0.5;

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

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

function drawPaddle(col: number, topY: number, color: RGB): void {
  const ty = Math.max(0, Math.min(8 - PADDLE_LEN, Math.floor(topY)));
  for (let k = 0; k < PADDLE_LEN; k++) {
    const y = ty + k;
    px(col, 7 - y, color);
  }
}

function render(playerY: number, cpuY: number, ballX: number, ballY: number): void {
  clear();
  drawPaddle(PLAYER_COL, playerY, PLAYER_COLOR);
  drawPaddle(CPU_COL, cpuY, CPU_COLOR);
  const bx = Math.max(0, Math.min(7, Math.floor(ballX)));
  const by = Math.max(0, Math.min(7, Math.floor(ballY)));
  px(bx, 7 - by, BALL_COLOR);
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
  let playerY = 3.0;
  let cpuY = 3.0;
  let ballX = 4.0;
  let ballY = 3.5;
  let ballVx = INITIAL_VX * pickSign();
  let ballVy = pickSign() * (INITIAL_VY_MIN + (INITIAL_VY_MAX - INITIAL_VY_MIN) * Math.random());

  let score = 0;
  let hits = 0;
  const introFrames = 14;
  let frame = 0;

  while (true) {
    if (screens.check_exit()) return null;

    if (JOY_UP.value() === 0) playerY -= PLAYER_SPEED;
    if (JOY_DOWN.value() === 0) playerY += PLAYER_SPEED;
    if (playerY < 0) playerY = 0;
    if (playerY > 8 - PADDLE_LEN) playerY = 8 - PADDLE_LEN;

    let cpuTarget = ballY - (PADDLE_LEN - 1) / 2;
    if (cpuTarget < 0) cpuTarget = 0;
    if (cpuTarget > 8 - PADDLE_LEN) cpuTarget = 8 - PADDLE_LEN;
    cpuY = cpuTarget;

    if (frame >= introFrames) {
      ballX += ballVx;
      ballY += ballVy;

      if (ballY < 0) {
        ballY = -ballY;
        ballVy = -ballVy;
      } else if (ballY > 7) {
        ballY = 14 - ballY;
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

      if (ballX > 7) {
        ballX = 14 - ballX;
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

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
  np = neopixel;
  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  screens.init(neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
