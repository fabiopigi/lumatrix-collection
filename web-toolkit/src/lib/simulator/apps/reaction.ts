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

// Arrow shapes are defined in source space (col, row with row 0 = bottom).
// The bottom row (row 0) is reserved for the timing bar in the source; the
// arrows draw in rows 1..(H-1).
type ArrowSet = Record<Direction, ReadonlyArray<readonly [number, number]>>;

// 8×8 source — used at small displays (scaled by an integer factor for larger
// ones that aren't exactly 16×16).
const ARROWS_8: ArrowSet = {
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

// 16×16 native — a more refined arrow than the 2× scale-up of the 8×8 shape.
// Arrowhead is a 12-cell-wide triangle, stem is 4 cells wide × 6 cells deep.
// Bar still occupies row 0 (drawn dynamically by drawBar).
const ARROWS_16: ArrowSet = {
  up: [
    [7, 15], [8, 15],
    [6, 14], [7, 14], [8, 14], [9, 14],
    [5, 13], [6, 13], [7, 13], [8, 13], [9, 13], [10, 13],
    [4, 12], [5, 12], [6, 12], [7, 12], [8, 12], [9, 12], [10, 12], [11, 12],
    [3, 11], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11], [9, 11], [10, 11], [11, 11], [12, 11],
    [2, 10], [3, 10], [4, 10], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10], [11, 10], [12, 10], [13, 10],
    [6, 9], [7, 9], [8, 9], [9, 9],
    [6, 8], [7, 8], [8, 8], [9, 8],
    [6, 7], [7, 7], [8, 7], [9, 7],
    [6, 6], [7, 6], [8, 6], [9, 6],
    [6, 5], [7, 5], [8, 5], [9, 5],
    [6, 4], [7, 4], [8, 4], [9, 4],
  ],
  down: [
    [6, 12], [7, 12], [8, 12], [9, 12],
    [6, 11], [7, 11], [8, 11], [9, 11],
    [6, 10], [7, 10], [8, 10], [9, 10],
    [6, 9], [7, 9], [8, 9], [9, 9],
    [6, 8], [7, 8], [8, 8], [9, 8],
    [6, 7], [7, 7], [8, 7], [9, 7],
    [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6], [12, 6], [13, 6],
    [3, 5], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [11, 5], [12, 5],
    [4, 4], [5, 4], [6, 4], [7, 4], [8, 4], [9, 4], [10, 4], [11, 4],
    [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3],
    [6, 2], [7, 2], [8, 2], [9, 2],
    [7, 1], [8, 1],
  ],
  left: [
    [0, 8], [0, 7],
    [1, 9], [1, 8], [1, 7], [1, 6],
    [2, 10], [2, 9], [2, 8], [2, 7], [2, 6], [2, 5],
    [3, 11], [3, 10], [3, 9], [3, 8], [3, 7], [3, 6], [3, 5], [3, 4],
    [4, 12], [4, 11], [4, 10], [4, 9], [4, 8], [4, 7], [4, 6], [4, 5], [4, 4], [4, 3],
    [5, 13], [5, 12], [5, 11], [5, 10], [5, 9], [5, 8], [5, 7], [5, 6], [5, 5], [5, 4], [5, 3], [5, 2],
    [6, 9], [7, 9], [8, 9], [9, 9], [10, 9], [11, 9],
    [6, 8], [7, 8], [8, 8], [9, 8], [10, 8], [11, 8],
    [6, 7], [7, 7], [8, 7], [9, 7], [10, 7], [11, 7],
    [6, 6], [7, 6], [8, 6], [9, 6], [10, 6], [11, 6],
  ],
  right: [
    [4, 9], [5, 9], [6, 9], [7, 9], [8, 9], [9, 9],
    [4, 8], [5, 8], [6, 8], [7, 8], [8, 8], [9, 8],
    [4, 7], [5, 7], [6, 7], [7, 7], [8, 7], [9, 7],
    [4, 6], [5, 6], [6, 6], [7, 6], [8, 6], [9, 6],
    [10, 13], [10, 12], [10, 11], [10, 10], [10, 9], [10, 8], [10, 7], [10, 6], [10, 5], [10, 4], [10, 3], [10, 2],
    [11, 12], [11, 11], [11, 10], [11, 9], [11, 8], [11, 7], [11, 6], [11, 5], [11, 4], [11, 3],
    [12, 11], [12, 10], [12, 9], [12, 8], [12, 7], [12, 6], [12, 5], [12, 4],
    [13, 10], [13, 9], [13, 8], [13, 7], [13, 6], [13, 5],
    [14, 9], [14, 8], [14, 7], [14, 6],
    [15, 8], [15, 7],
  ],
};

// 32×32 native — built procedurally so the head reads as a smooth triangle
// rather than a 4×-scaled-up 8×8 with chunky 4-pixel steps. 12-row triangular
// head (apex 2 px → base 24 px wide), 8-wide × 14-deep stem, 5-row gap above
// the bar. The up arrow is built explicitly; down mirrors it vertically and
// right/left are 90° rotations + horizontal mirror.
const ARROWS_32: ArrowSet = (() => {
  const HEAD_DEPTH = 12;
  const STEM_LEN = 14;
  const STEM_WIDTH = 8;
  const SIZE = 32;
  const up: Array<readonly [number, number]> = [];
  for (let i = 0; i < HEAD_DEPTH; i++) {
    const r = SIZE - 1 - i;
    const half = i + 1;
    const cMin = SIZE / 2 - half;
    const cMax = SIZE / 2 - 1 + half;
    for (let c = cMin; c <= cMax; c++) up.push([c, r]);
  }
  const stemTop = SIZE - 1 - HEAD_DEPTH;
  const stemBot = stemTop - STEM_LEN + 1;
  const stemColMin = (SIZE - STEM_WIDTH) / 2;
  for (let r = stemBot; r <= stemTop; r++) {
    for (let c = stemColMin; c < stemColMin + STEM_WIDTH; c++) up.push([c, r]);
  }
  // Down: mirror vertically about the bar; row 0 stays empty (bar lives there).
  const down: Array<readonly [number, number]> = up.map(
    ([c, r]) => [c, SIZE - r] as const,
  );
  // Right: rotate up 90° CW around the centre, then left mirrors right.
  const right: Array<readonly [number, number]> = up.map(
    ([c, r]) => [r, SIZE - 1 - c] as const,
  );
  const left: Array<readonly [number, number]> = right.map(
    ([c, r]) => [SIZE - 1 - c, r] as const,
  );
  return { up, down, left, right };
})();

let ARROWS: ArrowSet = ARROWS_8;

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

  if (W === 16 && H === 16) {
    // Native 16×16 shapes — no scaling, no offset.
    ARROWS = ARROWS_16;
    ARROW_SCALE = 1;
    ARROW_OX = 0;
    ARROW_OY = 0;
  } else if (W === 32 && H === 32) {
    // Native 32×32 shapes — smooth triangle, no scaling.
    ARROWS = ARROWS_32;
    ARROW_SCALE = 1;
    ARROW_OX = 0;
    ARROW_OY = 0;
  } else {
    // 8×8 source scaled by an integer factor that fits both axes.
    // Row 0 is the bar; the arrow uses source rows 1..7 (7 cells of height).
    ARROWS = ARROWS_8;
    ARROW_SCALE = Math.max(
      1,
      Math.min(Math.floor(W / 8), Math.floor((H - 1) / 7)),
    );
    ARROW_OX = Math.floor((W - 8 * ARROW_SCALE) / 2);
    ARROW_OY = 0;
  }

  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
