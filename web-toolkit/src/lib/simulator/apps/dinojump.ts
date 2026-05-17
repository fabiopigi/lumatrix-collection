/** DinoJump — Chrome-dino-style side scroller for LumenLab. */
import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "DinoJump";

const NUM_LEDS = 64;

// Visual coordinates: y=0 is top, y=7 is bottom.
const DINO_COL = 2;
const GROUND_Y = 7;
const OBSTACLE_GROUND_Y = 6;
const OBSTACLE_AIR_Y = 5;

const FRAME_MS = 40;
const MOVE_INTERVAL_START = 320;
const MOVE_INTERVAL_MIN = 100;
const SPEEDUP_EVERY_PX = 50;
const SPEEDUP_STEP_MS = 30;
const SPEEDUP_BONUS = 3;
const GAP_MIN = 3;
const GAP_MAX = 10;
const JUMP_TICKS = 2;
const INITIAL_DELAY_TICKS = 4;

const BRIGHTNESS = 0.25;

function dim(hex: string, scale = BRIGHTNESS): RGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Math.floor(parseInt(h.slice(0, 2), 16) * scale),
    Math.floor(parseInt(h.slice(2, 4), 16) * scale),
    Math.floor(parseInt(h.slice(4, 6), 16) * scale),
  ];
}

const GROUND_COLOR = dim("#404048");
const OBSTACLE_COLOR = dim("#A0A0A8");
const DINO_COLOR = dim("#669C35");

let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin;

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function pxVisual(x: number, y: number, color: RGB): void {
  if (x >= 0 && x <= 7 && y >= 0 && y <= 7) {
    np[(7 - y) * 8 + x] = color;
  }
}

function dinoRows(airborne: boolean, ducking: boolean): readonly number[] {
  if (airborne) return [4, 5];
  if (ducking) return [6];
  return [5, 6];
}

function render(obstacles: ReadonlyArray<[number, number]>, airborne: boolean, ducking: boolean): void {
  clear();
  for (let x = 0; x < 8; x++) pxVisual(x, GROUND_Y, GROUND_COLOR);
  for (const [ox, oy] of obstacles) pxVisual(ox, oy, OBSTACLE_COLOR);
  for (const dy of dinoRows(airborne, ducking)) pxVisual(DINO_COL, dy, DINO_COLOR);
  np.write();
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function playOneRound(): Promise<number | null> {
  let obstacles: [number, number][] = [];
  let spawnCooldown = INITIAL_DELAY_TICKS;
  let jumpT = 0;
  let prevUp = false;
  let score = 0;
  let distance = 0;
  let moveInterval = MOVE_INTERVAL_START;
  let lastTick = ticks_ms();

  render(obstacles, false, false);

  while (true) {
    if (screens.check_exit()) return null;

    const curUp = JOY_UP.value() === 0;
    let airborne = jumpT > 0;
    if (curUp && !prevUp && !airborne) {
      jumpT = JUMP_TICKS;
      airborne = true;
    }
    prevUp = curUp;
    const ducking = !airborne && JOY_DOWN.value() === 0;

    const now = ticks_ms();
    if (ticks_diff(now, lastTick) >= moveInterval) {
      lastTick = now;

      const newObs: [number, number][] = [];
      for (const [ox, oy] of obstacles) {
        const nx = ox - 1;
        if (nx >= 0) newObs.push([nx, oy]);
      }
      obstacles = newObs;

      spawnCooldown -= 1;
      if (spawnCooldown <= 0) {
        const oy = Math.random() < 0.5 ? OBSTACLE_AIR_Y : OBSTACLE_GROUND_Y;
        obstacles.push([8, oy]);
        spawnCooldown = randInt(GAP_MIN, GAP_MAX);
      }

      distance += 1;
      if (distance % SPEEDUP_EVERY_PX === 0 && moveInterval > MOVE_INTERVAL_MIN) {
        moveInterval = Math.max(MOVE_INTERVAL_MIN, moveInterval - SPEEDUP_STEP_MS);
        score += SPEEDUP_BONUS;
      }

      const dinoYs = dinoRows(airborne, ducking);
      for (const [ox, oy] of obstacles) {
        if (ox === DINO_COL) {
          if (dinoYs.includes(oy)) {
            render(obstacles, airborne, ducking);
            return score;
          }
          score += 1;
        }
      }

      if (jumpT > 0) jumpT -= 1;
    }

    render(obstacles, airborne, ducking);
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
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneRound();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
