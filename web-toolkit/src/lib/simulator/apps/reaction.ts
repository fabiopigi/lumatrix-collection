import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "ArrowReaction";

/**
 * The gameplay loop — react to a random direction before the timing bar
 * empties — doesn't gain depth from a bigger display. What does gain: the
 * arrow grows to fill the available space, and the timing bar uses the full
 * display width, so the user has a longer visual countdown to follow. The
 * 8×8 arrow shapes are scaled up by an integer factor and centred.
 */
export const RESPONSIVE = true;

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

type Direction = "up" | "down" | "left" | "right";
const DIRS: readonly Direction[] = ["up", "down", "left", "right"];

// Arrow shapes are defined in 8×8 source space (col, row with row 0 = bottom).
// The bottom row (row 0) is reserved for the timing bar in the source; the
// arrows draw in rows 1..7.
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
let W = 8;
let H = 8;
// Integer scale-up applied to the 8×8 arrow shapes.
let ARROW_SCALE = 1;
// Top-left offset of the arrow within the W×H display (centres the scaled-up
// arrow). The arrow source uses rows 1..7; row 0 is reserved for the bar.
let ARROW_OX = 0;
let ARROW_OY = 0;
// Width of the timing bar — always the full display width.
let BAR_WIDTH = 8;

function clear(): void {
  const n = W * H;
  for (let i = 0; i < n; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col < W && row >= 0 && row < H) {
    np[row * W + col] = color;
  }
}

/** Draw a source pixel at (sx, sy) as a scaled square in the W×H buffer. */
function drawSource(sx: number, sy: number, color: RGB): void {
  const dx0 = ARROW_OX + sx * ARROW_SCALE;
  const dy0 = ARROW_OY + sy * ARROW_SCALE;
  for (let i = 0; i < ARROW_SCALE; i++) {
    for (let j = 0; j < ARROW_SCALE; j++) {
      px(dx0 + i, dy0 + j, color);
    }
  }
}

function drawArrow(direction: Direction, color: RGB): void {
  for (const [c, r] of ARROWS[direction]) drawSource(c, r, color);
}

function barColor(length: number): RGB {
  // Thresholds scale with the bar width so green/amber/red bands feel right
  // at any display size.
  if (length >= Math.ceil(BAR_WIDTH * 6 / 8)) return BAR_GREEN;
  if (length >= Math.ceil(BAR_WIDTH * 3 / 8)) return BAR_AMBER;
  return BAR_RED;
}

function drawBar(length: number): void {
  const color = barColor(length);
  for (let c = 0; c < BAR_WIDTH; c++) {
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
  let bar = BAR_WIDTH;
  drawBar(bar);
  np.write();

  const start = ticks_ms();
  while (true) {
    if (screens.check_exit()) return { kind: "exit" };
    const elapsed = ticks_diff(ticks_ms(), start);
    let newBar = BAR_WIDTH - Math.floor((elapsed * BAR_WIDTH) / durationMs);
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
      // Hit reward scales with the bar — wider bar = more max reward per hit.
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
  display?: DisplayDims,
  screensNp?: NeoPixel,
): Promise<void> {
  np = neopixel;
  PINS.up = joystick.up;
  PINS.down = joystick.down;
  PINS.left = joystick.left;
  PINS.right = joystick.right;
  W = display?.width ?? 8;
  H = display?.height ?? 8;

  // Bar always spans the full display width.
  BAR_WIDTH = W;

  // The arrow shape is 8×8 source (cols 0-7, rows 0-7). Row 0 is the bar row;
  // the arrow uses rows 1-7. We need 8 cells of usable height above the bar
  // and 8 cells of width. Pick the largest integer scale that fits both, then
  // centre.
  ARROW_SCALE = Math.max(1, Math.min(Math.floor(W / 8), Math.floor((H - 1) / 7)));
  ARROW_OX = Math.floor((W - 8 * ARROW_SCALE) / 2);
  // Place the bar on row 0 (bottom) and the arrow above it. The arrow's
  // own source rows 1..7 already start one row up; offset Y aligns row 1
  // of source with the row just above the bar.
  ARROW_OY = 0;

  screens.init(screensNp ?? neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
