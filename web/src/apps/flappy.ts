import type { NeoPixel, RGB } from "../hardware/neopixel";
import type { Joystick, Pin } from "../hardware/joystick";
import * as screens from "../screens";
import { sleep_ms } from "../runtime/time";

export const NAME = "FlappyPixels";

const NUM_LEDS = 64;

const PLAYER_COL = 0;
const WALL_COLOR: RGB = [0, 40, 10];
const PLAYER_COLOR_GRAVITY: RGB = [60, 45, 0];
const PLAYER_COLOR_FLOAT: RGB = [0, 45, 55];

const FRAME_MS = 50;
const GAP_SIZE = 3;
const WALL_TICK = 6;
const SPAWN_TICK = 24;

const GRAVITY = 0.05;
const JUMP_DELTA = 0.4;
const JUMP_CAP = -1.0;
const TERMINAL_VEL = 1.5;

const FLOAT_ACCEL = 0.025;
const FLOAT_TERMINAL = 0.4;

type Mode = "gravity" | "float";
interface Wall { col: number; gap: number; }

let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin;
let JOY_SLIDE: Pin | undefined;

function slideMode(): Mode {
  if (!JOY_SLIDE) return "gravity";
  return JOY_SLIDE.value() === 0 ? "gravity" : "float";
}

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

function render(playerY: number, walls: ReadonlyArray<Wall>, mode: Mode): void {
  clear();
  for (const w of walls) {
    if (w.col < 0 || w.col > 7) continue;
    for (let r = 0; r < 8; r++) {
      const y = 7 - r;
      if (y < w.gap || y >= w.gap + GAP_SIZE) px(w.col, r, WALL_COLOR);
    }
  }
  const pyInt = Math.max(0, Math.min(7, Math.floor(playerY)));
  const color = mode === "float" ? PLAYER_COLOR_FLOAT : PLAYER_COLOR_GRAVITY;
  px(PLAYER_COL, 7 - pyInt, color);
  np.write();
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function playOneGame(): Promise<number | null> {
  let playerY = 3.5;
  let velocity = 0.0;
  let walls: Wall[] = [];
  let score = 0;
  let frame = 0;
  let prevUp = false;
  const introFrames = 14;

  while (true) {
    if (screens.check_exit()) return null;

    const mode = slideMode();
    const curUp = JOY_UP.value() === 0;
    const curDown = JOY_DOWN.value() === 0;

    if (mode === "gravity") {
      if (curUp && !prevUp) velocity = Math.max(velocity - JUMP_DELTA, JUMP_CAP);
      velocity = Math.min(velocity + GRAVITY, TERMINAL_VEL);
    } else {
      if (curUp && !curDown) velocity -= FLOAT_ACCEL;
      else if (curDown && !curUp) velocity += FLOAT_ACCEL;
      if (velocity > FLOAT_TERMINAL) velocity = FLOAT_TERMINAL;
      else if (velocity < -FLOAT_TERMINAL) velocity = -FLOAT_TERMINAL;
    }

    prevUp = curUp;
    playerY += velocity;

    if (playerY < 0) {
      playerY = 0;
      if (velocity < 0) velocity = 0;
    }

    let groundHit = false;
    if (mode === "gravity") {
      groundHit = playerY >= 7.5;
    } else {
      if (playerY > 7) {
        playerY = 7;
        if (velocity > 0) velocity = 0;
      }
    }

    if (frame >= introFrames) {
      if (frame % WALL_TICK === 0) {
        const newWalls: Wall[] = [];
        let hit = false;
        for (const w of walls) {
          const newCol = w.col - 1;
          if (newCol === PLAYER_COL) {
            const pyInt = Math.max(0, Math.min(7, Math.floor(playerY)));
            if (w.gap <= pyInt && pyInt < w.gap + GAP_SIZE) {
              score += 1;
            } else {
              newWalls.push({ col: newCol, gap: w.gap });
              hit = true;
            }
          } else if (newCol >= 0) {
            newWalls.push({ col: newCol, gap: w.gap });
          }
        }
        walls = newWalls;
        if (hit) {
          render(playerY, walls, mode);
          return score;
        }
      }

      if ((frame - introFrames) % SPAWN_TICK === 0) {
        walls.push({ col: 7, gap: randInt(0, 7 - GAP_SIZE) });
      }
    }

    render(playerY, walls, mode);

    if (groundHit) return score;

    await sleep_ms(FRAME_MS);
    frame += 1;
  }
}

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
  np = neopixel;
  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  JOY_SLIDE = joystick.slide;
  screens.init(neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
