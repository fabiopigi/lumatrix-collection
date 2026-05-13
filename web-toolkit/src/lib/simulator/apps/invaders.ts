import type { Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms } from "../runtime/time";

export const NAME = "SpaceInvaders";

const NUM_LEDS = 64;

const ALIEN_COLOR: RGB = [50, 0, 0];
const BULLET_COLOR: RGB = [45, 40, 5];
const LEVELUP_COL: RGB = [45, 45, 45];

const SHIP_COLORS: readonly RGB[] = [
  [0, 30, 0],
  [0, 45, 5],
  [0, 50, 25],
  [0, 40, 50],
  [15, 50, 55],
];

const FRAME_MS = 50;
const MOVE_SPEED = 0.3;

interface LevelParams { streams: number; shoot: number; alien_step: number; spawn: number; }

const LEVELS: readonly LevelParams[] = [
  { streams: 1, shoot: 14, alien_step: 28, spawn: 50 },
  { streams: 1, shoot: 10, alien_step: 22, spawn: 40 },
  { streams: 2, shoot: 9,  alien_step: 18, spawn: 32 },
  { streams: 3, shoot: 7,  alien_step: 14, spawn: 26 },
  { streams: 3, shoot: 5,  alien_step: 10, spawn: 22 },
];

const LEVEL_THRESHOLDS: readonly number[] = [8, 20, 35, 55];

let np: NeoPixel;
let JOY_LEFT: Pin, JOY_RIGHT: Pin;

function levelIndex(score: number): number {
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (score < LEVEL_THRESHOLDS[i]) return i;
  }
  return LEVEL_THRESHOLDS.length;
}

function streamOffsets(n: number): readonly number[] {
  if (n === 1) return [0];
  if (n === 2) return [-1, 1];
  if (n === 3) return [-1, 0, 1];
  if (n === 5) return [-2, -1, 0, 1, 2];
  return [0];
}

function clear(): void {
  for (let i = 0; i < NUM_LEDS; i++) np[i] = [0, 0, 0];
}

function px(col: number, row: number, color: RGB): void {
  if (col >= 0 && col <= 7 && row >= 0 && row <= 7) {
    np[row * 8 + col] = color;
  }
}

type Cell = [number, number];

function render(playerCol: number, shipColor: RGB, aliens: ReadonlyArray<Cell>, bullets: ReadonlyArray<Cell>): void {
  clear();
  for (const off of [-1, 0, 1]) {
    const c = playerCol + off;
    if (c >= 0 && c <= 7) px(c, 0, shipColor);
  }
  for (const a of aliens) if (a[1] >= 0 && a[1] <= 7) px(a[0], a[1], ALIEN_COLOR);
  for (const b of bullets) if (b[1] >= 0 && b[1] <= 7) px(b[0], b[1], BULLET_COLOR);
  np.write();
}

function handleCollisions(
  bullets: Cell[],
  aliens: Cell[],
  score: number,
): { bullets: Cell[]; aliens: Cell[]; score: number } {
  if (aliens.length === 0 || bullets.length === 0) return { bullets, aliens, score };
  const alienPos = new Map<string, number[]>();
  for (let i = 0; i < aliens.length; i++) {
    const key = `${aliens[i][0]},${aliens[i][1]}`;
    let arr = alienPos.get(key);
    if (!arr) { arr = []; alienPos.set(key, arr); }
    arr.push(i);
  }
  const killed = new Set<number>();
  const remaining: Cell[] = [];
  for (const b of bullets) {
    const key = `${b[0]},${b[1]}`;
    let hit = false;
    const idxs = alienPos.get(key);
    if (idxs) {
      for (const ai of idxs) {
        if (!killed.has(ai)) {
          killed.add(ai);
          score += 1;
          hit = true;
          break;
        }
      }
    }
    if (!hit) remaining.push(b);
  }
  const newAliens = aliens.filter((_, i) => !killed.has(i));
  return { bullets: remaining, aliens: newAliens, score };
}

async function levelUpFlash(): Promise<void> {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < NUM_LEDS; j++) np[j] = LEVELUP_COL;
    np.write();
    await sleep_ms(60);
    clear();
    np.write();
    await sleep_ms(40);
  }
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function playOneGame(): Promise<number | null> {
  let playerColF = 4.0;
  let aliens: Cell[] = [];
  let bullets: Cell[] = [];
  let score = 0;
  let shootTimer = 0;
  let alienTimer = 0;
  let spawnTimer = 0;
  let prevLevel = levelIndex(0);
  let frame = 0;
  const introFrames = 14;

  while (true) {
    if (screens.check_exit()) return null;

    const curLevel = levelIndex(score);
    const params = LEVELS[Math.min(curLevel, LEVELS.length - 1)];

    if (curLevel > prevLevel) {
      await levelUpFlash();
      prevLevel = curLevel;
    }

    const shipColor = SHIP_COLORS[Math.min(curLevel, SHIP_COLORS.length - 1)];

    if (JOY_LEFT.value() === 0) playerColF -= MOVE_SPEED;
    if (JOY_RIGHT.value() === 0) playerColF += MOVE_SPEED;
    if (playerColF < 1.0) playerColF = 1.0;
    if (playerColF > 6.0) playerColF = 6.0;
    const playerCol = Math.round(playerColF);

    const newBullets: Cell[] = [];
    for (const b of bullets) {
      b[1] += 1;
      if (b[1] <= 7) newBullets.push(b);
    }
    bullets = newBullets;

    ({ bullets, aliens, score } = handleCollisions(bullets, aliens, score));

    if (frame >= introFrames) {
      alienTimer += 1;
      if (alienTimer >= params.alien_step) {
        alienTimer = 0;
        for (const a of aliens) a[1] -= 1;
        ({ bullets, aliens, score } = handleCollisions(bullets, aliens, score));
        if (aliens.some((a) => a[1] <= 0)) {
          render(playerCol, shipColor, aliens, bullets);
          return score;
        }
      }
    }

    if (frame >= introFrames) {
      shootTimer += 1;
      if (shootTimer >= params.shoot) {
        shootTimer = 0;
        for (const off of streamOffsets(params.streams)) {
          const bx = playerCol + off;
          if (bx >= 0 && bx <= 7) bullets.push([bx, 1]);
        }
      }
    }

    if (frame >= introFrames) {
      spawnTimer += 1;
      if (spawnTimer >= params.spawn) {
        spawnTimer = 0;
        aliens.push([randInt(0, 7), 7]);
      }
    }

    render(playerCol, shipColor, aliens, bullets);
    await sleep_ms(FRAME_MS);
    frame += 1;
  }
}

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
  np = neopixel;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  screens.init(neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const score = await playOneGame();
    if (score === null) return;
    if ((await screens.game_over_screen(score)) === "exit") return;
  }
}
