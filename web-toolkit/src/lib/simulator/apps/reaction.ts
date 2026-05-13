import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";
import * as screens from "../screens";
import type { Joystick, NeoPixel, Pin, RGB } from "../types";

export const NAME = "ArrowReaction";

const NUM_LEDS = 64;

type Direction = "up" | "down" | "left" | "right";
const DIRS: readonly Direction[] = ["up", "down", "left", "right"];

const ARROW_PALETTE: readonly RGB[] = [
  [0, 25, 60],
  [45, 0, 55],
  [55, 0, 25],
  [55, 25, 0],
  [0, 45, 45],
  [50, 0, 50],
  [45, 40, 0],
  [10, 50, 0],
];

const BAR_GREEN: RGB = [0, 45, 0];
const BAR_AMBER: RGB = [45, 25, 0];
const BAR_RED: RGB = [55, 0, 0];
const HIT_GREEN: RGB = [0, 60, 0];

const ARROWS: Record<Direction, ReadonlyArray<readonly [number, number]>> = {
  up: [
    [3, 7], [4, 7],
    [2, 6], [3, 6], [4, 6], [5, 6],
    [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
    [3, 4], [4, 4],
    [3, 3], [4, 3],
    [3, 2], [4, 2],
    [3, 1], [4, 1],
  ],
  down: [
    [3, 7], [4, 7],
    [3, 6], [4, 6],
    [3, 5], [4, 5],
    [3, 4], [4, 4],
    [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
    [2, 2], [3, 2], [4, 2], [5, 2],
    [3, 1], [4, 1],
  ],
  left: [
    [2, 6],
    [1, 5], [2, 5],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
    [1, 2], [2, 2],
    [2, 1],
  ],
  right: [
    [5, 6],
    [5, 5], [6, 5],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
    [5, 2], [6, 2],
    [5, 1],
  ],
};

let np: NeoPixel;
const PINS = {} as Record<Direction, Pin>;

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

function drawArrow(direction: Direction, color: RGB): void {
  for (const [c, r] of ARROWS[direction]) px(c, r, color);
}

function barColor(length: number): RGB {
  if (length >= 6) return BAR_GREEN;
  if (length >= 3) return BAR_AMBER;
  return BAR_RED;
}

function drawBar(length: number): void {
  const color = barColor(length);
  for (let c = 0; c < 8; c++) {
    px(c, 0, c < length ? color : [0, 0, 0]);
  }
}

function readJoystick(): Direction | null {
  for (const d of DIRS) {
    if (PINS[d].value() === 0) return d;
  }
  return null;
}

function choice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

type RoundResult =
  | { kind: "exit" }
  | { kind: "timeout"; direction: Direction }
  | { kind: "wrong"; direction: Direction }
  | { kind: "hit"; bar: number; direction: Direction };

async function playRound(
  durationMs: number,
  arrowColor: RGB,
): Promise<RoundResult> {
  const direction = choice(DIRS);
  clear();
  drawArrow(direction, arrowColor);
  let bar = 8;
  drawBar(bar);
  np.write();

  const start = ticks_ms();
  while (true) {
    if (screens.check_exit()) return { kind: "exit" };
    const elapsed = ticks_diff(ticks_ms(), start);
    let newBar = 8 - Math.floor((elapsed * 8) / durationMs);
    if (newBar < 0) newBar = 0;
    if (newBar !== bar) {
      bar = newBar;
      drawBar(bar);
      np.write();
    }
    if (bar === 0) return { kind: "timeout", direction };
    const pressed = readJoystick();
    if (pressed !== null) {
      if (pressed === direction) return { kind: "hit", bar, direction };
      return { kind: "wrong", direction };
    }
    await sleep_ms(15);
  }
}

async function flashHit(direction: Direction): Promise<void> {
  for (let i = 0; i < 2; i++) {
    clear();
    drawArrow(direction, HIT_GREEN);
    np.write();
    await sleep_ms(80);
    clear();
    np.write();
    await sleep_ms(50);
  }
}

function pickArrowColor(prev: RGB | null): RGB {
  while (true) {
    const c = choice(ARROW_PALETTE);
    if (c !== prev) return c;
  }
}

async function playOneGame(): Promise<number | null> {
  let score = 0;
  let duration = 1800;
  let prevColor: RGB | null = null;
  while (true) {
    clear();
    np.write();
    await sleep_ms(180);
    const color = pickArrowColor(prevColor);
    prevColor = color;
    const result = await playRound(duration, color);
    if (result.kind === "exit") return null;
    if (result.kind === "hit") {
      score += result.bar;
      await flashHit(result.direction);
      if (duration > 600) duration -= 60;
    } else {
      return score;
    }
  }
}

export async function run(
  neopixel: NeoPixel,
  joystick: Joystick,
): Promise<void> {
  np = neopixel;
  PINS.up = joystick.up;
  PINS.down = joystick.down;
  PINS.left = joystick.left;
  PINS.right = joystick.right;
  screens.init(neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
