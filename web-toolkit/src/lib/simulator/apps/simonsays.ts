import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "Simon Says";

/**
 * The four panels scale with the display: each is a chevron tapering inward
 * from the edge it lives on, sized by min(W, H) so panels stay readable on
 * 16×16 / 32×32 instead of a 4×-pixellated 8×8 source.
 *
 * Two small corner indicators tell the player which phase the game is in —
 * pink at bottom-left during sequence playback, green at bottom-right while
 * waiting for the player's echo. Both are placed clear of any panel pixels.
 */
export const RESPONSIVE = true;

const PATTERN_LEN = 32;
const FLASH_MS = 500;
const GAP_MS = 200;
const PRE_PLAYBACK_MS = 700;
const PRESS_FLASH_MS = 150;
const INPUT_TIMEOUT_MS = 3000;
const ROUND_CLEAR_MS = 400;

const BRIGHT_SCALE = 0.5;
const DIM_SCALE = 0.06;

// Phase-indicator colours, ~25% of full brightness to match BRIGHT_SCALE panels.
const PHASE_PLAYBACK: RGB = [64, 0, 64]; // #FF00FF
const PHASE_ECHO: RGB = [0, 64, 32]; // #00FF80

type DirName = "up" | "down" | "left" | "right";
const DIRS: readonly DirName[] = ["up", "down", "left", "right"];

type Letter = "R" | "G" | "B" | "Y";

type PixelList = ReadonlyArray<readonly [number, number]>;

interface Panel {
  bright: RGB;
  dim: RGB;
  pixels: PixelList;
  dir: DirName;
}

function scaleHex(hex: string, scale: number): RGB {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [
    Math.floor(parseInt(h.slice(0, 2), 16) * scale),
    Math.floor(parseInt(h.slice(2, 4), 16) * scale),
    Math.floor(parseInt(h.slice(4, 6), 16) * scale),
  ];
}

interface PanelDef {
  letter: Letter;
  hex: string;
  dir: DirName;
}

const PANEL_DEFS: readonly PanelDef[] = [
  { letter: "R", hex: "#800000", dir: "left" },
  { letter: "G", hex: "#4e7a27", dir: "up" },
  { letter: "B", hex: "#0042a9", dir: "down" },
  { letter: "Y", hex: "#a67b01", dir: "right" },
];

const PANELS: Record<Letter, Panel> = {} as Record<Letter, Panel>;

let np: NeoPixel;
const PINS = {} as Record<DirName, Pin>;

let W = 8;
let H = 8;
// Side length of each corner phase-indicator block (1 on 8×8, 2 on 16×16, 4 on 32×32).
let STATUS_SIZE = 1;
// Ellipse mask for the indicator block — null = solid square (≤ 3 px side).
let STATUS_MASK: boolean[][] | null = null;

type Phase = "idle" | "playback" | "echo";
let phase: Phase = "idle";

function buildShapes(): Record<DirName, PixelList> {
  // Scale the original 8×8 chevron (4-wide outer row, 2-wide inner row) by
  // unit = floor(min(W, H) / 8). Each step inward narrows by 2, so the chevron
  // always ends in a 2-wide tip.
  const unit = Math.max(1, Math.floor(Math.min(W, H) / 8));
  const outerWidth = 4 * unit;
  const depth = 2 * unit;

  const up: Array<[number, number]> = [];
  for (let i = 0; i < depth; i++) {
    const w = outerWidth - 2 * i;
    if (w <= 0) break;
    const row = H - 1 - i;
    const cMin = Math.floor((W - w) / 2);
    for (let c = 0; c < w; c++) up.push([cMin + c, row]);
  }

  const down: Array<[number, number]> = up.map(([c, r]) => [c, H - 1 - r]);

  const left: Array<[number, number]> = [];
  for (let i = 0; i < depth; i++) {
    const h = outerWidth - 2 * i;
    if (h <= 0) break;
    const col = i;
    const rMin = Math.floor((H - h) / 2);
    for (let r = 0; r < h; r++) left.push([col, rMin + r]);
  }

  const right: Array<[number, number]> = left.map(([c, r]) => [W - 1 - c, r]);

  return { up, down, left, right };
}

function buildEllipseMask(size: number): boolean[][] {
  const c = (size - 1) / 2;
  const r = size / 2;
  const mask: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) {
      const nx = (x - c) / r;
      const ny = (y - c) / r;
      row.push(nx * nx + ny * ny <= 1);
    }
    mask.push(row);
  }
  return mask;
}

function configureLayout(): void {
  const shapes = buildShapes();
  for (const def of PANEL_DEFS) {
    PANELS[def.letter] = {
      bright: scaleHex(def.hex, BRIGHT_SCALE),
      dim: scaleHex(def.hex, DIM_SCALE),
      pixels: shapes[def.dir],
      dir: def.dir,
    };
  }
  STATUS_SIZE = Math.max(1, Math.floor(Math.min(W, H) / 8));
  STATUS_MASK = STATUS_SIZE >= 4 ? buildEllipseMask(STATUS_SIZE) : null;
}

function clear(): void {
  const n = W * H;
  for (let i = 0; i < n; i++) np[i] = [0, 0, 0];
}

function setPx(col: number, row: number, color: RGB): void {
  if (col >= 0 && col < W && row >= 0 && row < H) {
    np[row * W + col] = color;
  }
}

function drawCornerBlock(col0: number, row0: number, color: RGB): void {
  for (let dy = 0; dy < STATUS_SIZE; dy++) {
    for (let dx = 0; dx < STATUS_SIZE; dx++) {
      if (STATUS_MASK !== null && !STATUS_MASK[dy][dx]) continue;
      setPx(col0 + dx, row0 + dy, color);
    }
  }
}

function render(highlight: Letter | null = null): void {
  clear();
  for (const letter of Object.keys(PANELS) as Letter[]) {
    const panel = PANELS[letter];
    const color = letter === highlight ? panel.bright : panel.dim;
    for (const [c, r] of panel.pixels) setPx(c, r, color);
  }
  if (phase === "playback") {
    drawCornerBlock(0, 0, PHASE_PLAYBACK);
  } else if (phase === "echo") {
    drawCornerBlock(W - STATUS_SIZE, 0, PHASE_ECHO);
  }
  np.write();
}

async function flashPanel(letter: Letter, ms: number): Promise<void> {
  render(letter);
  await sleep_ms(ms);
  render();
}

async function playback(
  pattern: string,
  length: number,
): Promise<"exit" | null> {
  phase = "playback";
  render();
  await sleep_ms(PRE_PLAYBACK_MS);
  for (let i = 0; i < length; i++) {
    if (screens.check_exit()) return "exit";
    render(pattern[i] as Letter);
    await sleep_ms(FLASH_MS);
    render();
    await sleep_ms(GAP_MS);
  }
  return null;
}

function readDirection(): DirName | null {
  for (const d of DIRS) {
    if (PINS[d].value() === 0) return d;
  }
  return null;
}

async function waitForRelease(): Promise<"exit" | null> {
  while (readDirection() !== null) {
    if (screens.check_exit()) return "exit";
    await sleep_ms(10);
  }
  return null;
}

async function waitForPress(): Promise<DirName | "timeout" | "exit"> {
  const start = ticks_ms();
  while (ticks_diff(ticks_ms(), start) < INPUT_TIMEOUT_MS) {
    if (screens.check_exit()) return "exit";
    const d = readDirection();
    if (d !== null) return d;
    await sleep_ms(10);
  }
  return "timeout";
}

type EchoResult = "correct" | "wrong" | "timeout" | "exit";

async function echo(pattern: string, length: number): Promise<EchoResult> {
  phase = "echo";
  render();
  for (let i = 0; i < length; i++) {
    if ((await waitForRelease()) === "exit") return "exit";
    const press = await waitForPress();
    if (press === "exit" || press === "timeout") return press;
    const letter = pattern[i] as Letter;
    if (press !== PANELS[letter].dir) return "wrong";
    await flashPanel(letter, PRESS_FLASH_MS);
  }
  return "correct";
}

function generatePattern(): string {
  const letters: Letter[] = ["R", "G", "B", "Y"];
  let out = "";
  for (let i = 0; i < PATTERN_LEN; i++) {
    out += letters[Math.floor(Math.random() * letters.length)];
  }
  return out;
}

async function playOneGame(): Promise<number | null> {
  const pattern = generatePattern();
  let completed = 0;
  for (let length = 1; length <= PATTERN_LEN; length++) {
    if ((await playback(pattern, length)) === "exit") {
      phase = "idle";
      return null;
    }
    const result = await echo(pattern, length);
    phase = "idle";
    if (result === "exit") return null;
    if (result === "wrong" || result === "timeout") return completed;
    completed = length;
    render();
    await sleep_ms(ROUND_CLEAR_MS);
  }
  return completed;
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
  configureLayout();
  phase = "idle";
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
