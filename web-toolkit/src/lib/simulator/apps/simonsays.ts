import type { Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "Simon Says";

const NUM_LEDS = 64;

const PATTERN_LEN = 32;
const FLASH_MS = 500;
const GAP_MS = 200;
const PRE_PLAYBACK_MS = 700;
const PRESS_FLASH_MS = 150;
const INPUT_TIMEOUT_MS = 3000;
const ROUND_CLEAR_MS = 400;

const BRIGHT_SCALE = 0.5;
const DIM_SCALE = 0.06;

type DirName = "up" | "down" | "left" | "right";
const DIRS: readonly DirName[] = ["up", "down", "left", "right"];

type Letter = "R" | "G" | "B" | "Y";

interface Panel {
  bright: RGB;
  dim: RGB;
  leds: readonly number[];
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

interface PanelDef { letter: Letter; hex: string; leds: readonly number[]; dir: DirName; }

const PANEL_DEFS: readonly PanelDef[] = [
  { letter: "R", hex: "#800000", leds: [16, 24, 25, 32, 33, 40], dir: "left" },
  { letter: "G", hex: "#4e7a27", leds: [51, 52, 58, 59, 60, 61], dir: "up" },
  { letter: "B", hex: "#0042a9", leds: [2, 3, 4, 5, 11, 12],     dir: "down" },
  { letter: "Y", hex: "#a67b01", leds: [23, 30, 31, 38, 39, 47], dir: "right" },
];

const PANELS: Record<Letter, Panel> = {} as Record<Letter, Panel>;
for (const def of PANEL_DEFS) {
  PANELS[def.letter] = {
    bright: scaleHex(def.hex, BRIGHT_SCALE),
    dim: scaleHex(def.hex, DIM_SCALE),
    leds: def.leds,
    dir: def.dir,
  };
}

let np: NeoPixel;
const PINS = {} as Record<DirName, Pin>;

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function render(highlight: Letter | null = null): void {
  clear();
  for (const letter of Object.keys(PANELS) as Letter[]) {
    const panel = PANELS[letter];
    const color = letter === highlight ? panel.bright : panel.dim;
    for (const idx of panel.leds) np[idx] = color;
  }
  np.write();
}

async function flashPanel(letter: Letter, ms: number): Promise<void> {
  render(letter);
  await sleep_ms(ms);
  render();
}

async function playback(pattern: string, length: number): Promise<"exit" | null> {
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
    if ((await playback(pattern, length)) === "exit") return null;
    const result = await echo(pattern, length);
    if (result === "exit") return null;
    if (result === "wrong" || result === "timeout") return completed;
    completed = length;
    render();
    await sleep_ms(ROUND_CLEAR_MS);
  }
  return completed;
}

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
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
