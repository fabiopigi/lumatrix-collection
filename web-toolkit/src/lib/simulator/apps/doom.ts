import type { Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "Doom";

const NUM_LEDS = 64;
const IDLE_MS = 10_000;

const MAP_SIZE = 10;
const FOV = Math.PI / 3;
const BRIGHTNESS = 0.15;
const MAX_DIST = 8.0;

let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin, JOY_LEFT: Pin, JOY_RIGHT: Pin, JOY_SEL: Pin;

let px = 1.5;
let py = 1.5;
let pa = 0.0;
let worldMap: number[][] = [];
const zBuffer: number[] = new Array(8).fill(MAX_DIST);
type Enemy = [number, number, number, number]; // x, y, hp, hitFlashFrames
type Projectile = [number, number, number]; // x, y, angle
let enemies: Enemy[] = [];
let projectiles: Projectile[] = [];
const frameBuffer: number[][] = Array.from({ length: NUM_LEDS }, () => [0, 0, 0]);

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMap(): void {
  enemies = [];
  worldMap = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_SIZE; x++) row.push(1);
    worldMap.push(row);
  }
  let cx = randInt(1, 8);
  let cy = randInt(1, 8);
  px = cx;
  py = cy;
  for (let i = 0; i < 40; i++) {
    worldMap[cy][cx] = 0;
    const dir = choice<[number, number]>([[0, 1], [0, -1], [1, 0], [-1, 0]]);
    const nx = cx + dir[0];
    const ny = cy + dir[1];
    if (nx > 0 && nx < MAP_SIZE - 1 && ny > 0 && ny < MAP_SIZE - 1) {
      cx = nx;
      cy = ny;
    }
  }

  while (enemies.length < 3) {
    const ex = randInt(1, 8);
    const ey = randInt(1, 8);
    if (worldMap[ey][ex] === 0 && (Math.abs(ex - px) > 2 || Math.abs(ey - py) > 2)) {
      enemies.push([ex + 0.5, ey + 0.5, 1, 0]);
    }
  }
}

function clearBuffer(): void {
  for (let i = 0; i < NUM_LEDS; i++) {
    frameBuffer[i][0] = 0;
    frameBuffer[i][1] = 0;
    frameBuffer[i][2] = 0;
  }
}

function showBuffer(): void {
  for (let i = 0; i < NUM_LEDS; i++) {
    const r = Math.min(255, Math.floor(frameBuffer[i][0] * BRIGHTNESS));
    const g = Math.min(255, Math.floor(frameBuffer[i][1] * BRIGHTNESS));
    const b = Math.min(255, Math.floor(frameBuffer[i][2] * BRIGHTNESS));
    np[i] = [r, g, b] as RGB;
  }
  np.write();
}

function drawSprite(xPos: number, yPos: number, dist: number, size: number, color: readonly number[]): void {
  const halfS = size / 2;
  const startX = Math.floor(xPos - halfS + 0.5);
  const endX = Math.floor(xPos + halfS + 0.5);
  const startY = Math.floor(yPos - halfS + 0.5);
  const endY = Math.floor(yPos + halfS + 0.5);
  for (let ix = startX; ix <= endX; ix++) {
    if (ix >= 0 && ix < 8 && dist < zBuffer[ix]) {
      for (let iy = startY; iy <= endY; iy++) {
        if (iy >= 0 && iy < 8) {
          const idx = iy * 8 + ix;
          frameBuffer[idx][0] = Math.min(255, frameBuffer[idx][0] + color[0]);
          frameBuffer[idx][1] = Math.min(255, frameBuffer[idx][1] + color[1]);
          frameBuffer[idx][2] = Math.min(255, frameBuffer[idx][2] + color[2]);
        }
      }
    }
  }
}

function renderWorld(): void {
  for (let i = 0; i < 8; i++) {
    const rayAngle = pa - FOV / 2 + (i / 8) * FOV;
    let rx = px, ry = py, d = 0;
    while (d < MAX_DIST) {
      d += 0.1;
      const mx = Math.floor(rx + Math.cos(rayAngle) * d);
      const my = Math.floor(ry + Math.sin(rayAngle) * d);
      if (worldMap[my] && worldMap[my][mx] === 1) break;
    }

    const actualDist = d * Math.cos(rayAngle - pa);
    zBuffer[i] = actualDist;
    const height = Math.min(8, Math.max(1, Math.floor(8 / (actualDist + 0.01))));
    const startY = Math.floor((8 - height) / 2);
    const nz = Math.max(0, Math.min(1, 1 - actualDist / 7));
    for (let y = startY; y < startY + height; y++) {
      frameBuffer[y * 8 + i] = [200 * nz, 50 * nz * nz, 255 * (1 - nz)];
    }
  }

  const t = ticks_ms();
  for (const e of enemies) {
    const dx = e[0] - px;
    const dy = e[1] - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx) - pa;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    while (angle > Math.PI) angle -= 2 * Math.PI;

    if (Math.abs(angle) < FOV) {
      const sx = (angle / FOV + 0.5) * 8;
      const size = Math.max(1, Math.floor(6 / (dist + 0.5)));
      const color = e[3] > 0
        ? [255, 255, 255]
        : [255, (Math.sin(t / 100) + 1) * 100, 0];
      if (e[3] > 0) e[3] -= 1;
      drawSprite(sx, 3.5, dist, size, color);
    }
  }

  for (const p of projectiles) {
    const dx = p[0] - px;
    const dy = p[1] - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx) - pa;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    while (angle > Math.PI) angle -= 2 * Math.PI;

    if (Math.abs(angle) < FOV) {
      const sx = (angle / FOV + 0.5) * 8;
      const size = Math.max(1, 6 - dist * 4);
      drawSprite(sx, 4, dist, size, [255, 255, 100]);
    }
  }
}

function updateGame(): void {
  const newProjs: Projectile[] = [];
  for (const p of projectiles) {
    p[0] += Math.cos(p[2]) * 0.4;
    p[1] += Math.sin(p[2]) * 0.4;

    if (worldMap[Math.floor(p[1])] && worldMap[Math.floor(p[1])][Math.floor(p[0])] === 1) continue;

    let hitEnemy = false;
    for (const e of enemies) {
      const edist = Math.sqrt((p[0] - e[0]) ** 2 + (p[1] - e[1]) ** 2);
      if (edist < 0.4) {
        e[2] -= 1;
        e[3] = 3;
        hitEnemy = true;
        break;
      }
    }

    if (!hitEnemy && Math.sqrt((p[0] - px) ** 2 + (p[1] - py) ** 2) < MAX_DIST) {
      newProjs.push(p);
    }
  }
  projectiles = newProjs;
  enemies = enemies.filter((e) => e[2] > 0);
}

async function playDoom(): Promise<"exit" | "idle"> {
  projectiles = [];
  pa = 0.0;
  generateMap();

  let lastActivity = ticks_ms();

  while (true) {
    if (screens.check_exit()) return "exit";

    let active = false;
    if (JOY_LEFT.value() === 0) { pa -= 0.15; active = true; }
    if (JOY_RIGHT.value() === 0) { pa += 0.15; active = true; }

    let nx = px, ny = py;
    if (JOY_UP.value() === 0) {
      nx += Math.cos(pa) * 0.15;
      ny += Math.sin(pa) * 0.15;
      active = true;
    }
    if (JOY_DOWN.value() === 0) {
      nx -= Math.cos(pa) * 0.15;
      ny -= Math.sin(pa) * 0.15;
      active = true;
    }
    if (worldMap[Math.floor(ny)] && worldMap[Math.floor(ny)][Math.floor(nx)] === 0) {
      px = nx;
      py = ny;
    }

    if (JOY_SEL.value() === 0) {
      if (projectiles.length === 0) projectiles.push([px, py, pa]);
      active = true;
    }

    if (active) {
      lastActivity = ticks_ms();
    } else if (ticks_diff(ticks_ms(), lastActivity) >= IDLE_MS) {
      return "idle";
    }

    updateGame();
    clearBuffer();
    renderWorld();
    showBuffer();

    if (enemies.length === 0) generateMap();

    await sleep_ms(30);
  }
}

export async function run(neopixel: NeoPixel, joystick: Joystick): Promise<void> {
  np = neopixel;
  JOY_UP = joystick.up;
  JOY_DOWN = joystick.down;
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  JOY_SEL = joystick.center;
  screens.init(neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const outcome = await playDoom();
    if (outcome === "exit") return;
    if ((await screens.end_screen()) === "exit") return;
  }
}
