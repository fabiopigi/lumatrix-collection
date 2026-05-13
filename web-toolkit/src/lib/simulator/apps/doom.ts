import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "Doom";

/**
 * 1D raycaster — fires W rays per frame (was hardcoded 8) and keeps a float
 * z-buffer per column. Walls and sprites are painted with solid integer
 * pixels (no alpha blending — it was too slow on larger displays).
 *
 * Every frame starts with a subtle sky / floor gradient as the backdrop, so
 * empty cells aren't pure black. Walls and sprites overwrite the backdrop
 * directly where they cover.
 */
export const RESPONSIVE = true;

const IDLE_MS = 10_000;

const MAP_SIZE = 10;
const FOV = Math.PI / 3;
const BRIGHTNESS = 0.15;
const MAX_DIST = 8.0;

let np: NeoPixel;
let JOY_UP: Pin, JOY_DOWN: Pin, JOY_LEFT: Pin, JOY_RIGHT: Pin, JOY_SEL: Pin;

let W = 8;
let H = 8;
let N = 64;

let px = 1.5;
let py = 1.5;
let pa = 0.0;
let worldMap: number[][] = [];
let zBuffer: number[] = new Array(8).fill(MAX_DIST);
type Enemy = [number, number, number, number]; // x, y, hp, hitFlashFrames
type Projectile = [number, number, number]; // x, y, angle
let enemies: Enemy[] = [];
let projectiles: Projectile[] = [];
// Float-valued frame buffer in [r, g, b] triples; `showBuffer()` clamps + dims
// to 8-bit when writing to the NeoPixel.
let frameBuffer: number[][] = [];

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
    if (
      worldMap[ey][ex] === 0 &&
      (Math.abs(ex - px) > 2 || Math.abs(ey - py) > 2)
    ) {
      enemies.push([ex + 0.5, ey + 0.5, 1, 0]);
    }
  }
}

/** Fill the frame buffer with a vertical sky → floor gradient. */
function fillBackdrop(): void {
  // y is in DISPLAY space (visual row, 0 = top). LED row = H-1-y.
  // We write directly to frameBuffer indexed in visual-y * W + x for clarity,
  // and the showBuffer() step converts to LED order.
  const horizon = (H - 1) / 2;
  for (let y = 0; y < H; y++) {
    let r = 0;
    let g = 0;
    let b = 0;
    if (y < horizon) {
      // Sky: dim blue at top, fading toward the horizon. We scale by 1/0.15
      // because showBuffer multiplies by BRIGHTNESS = 0.15 at write time.
      const t = (horizon - y) / horizon; // 1 at top, 0 at horizon
      r = 40 * t;
      g = 60 * t;
      b = 140 * t + 20;
    } else {
      // Floor: dim brown, fading toward the horizon.
      const t = (y - horizon) / horizon;
      r = 90 * t + 25;
      g = 50 * t + 15;
      b = 25 * t + 8;
    }
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      frameBuffer[idx][0] = r;
      frameBuffer[idx][1] = g;
      frameBuffer[idx][2] = b;
    }
  }
}

function showBuffer(): void {
  // frameBuffer is in visual-y indexing. NeoPixel uses LED row = H-1-y.
  for (let y = 0; y < H; y++) {
    const ledRow = H - 1 - y;
    for (let x = 0; x < W; x++) {
      const src = y * W + x;
      const r = Math.min(255, Math.floor(frameBuffer[src][0] * BRIGHTNESS));
      const g = Math.min(255, Math.floor(frameBuffer[src][1] * BRIGHTNESS));
      const b = Math.min(255, Math.floor(frameBuffer[src][2] * BRIGHTNESS));
      np[ledRow * W + x] = [r, g, b] as RGB;
    }
  }
  np.write();
}

/** Write a solid colour into the frame buffer at (ix, iy) (visual-y). */
function setPixel(
  ix: number,
  iy: number,
  color: readonly number[],
): void {
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
  const idx = iy * W + ix;
  frameBuffer[idx][0] = color[0];
  frameBuffer[idx][1] = color[1];
  frameBuffer[idx][2] = color[2];
}

/** Draw a sprite as a solid block — paints every cell whose centre is inside
 *  the float bounds, gated by the z-buffer per column. */
function drawSprite(
  xPos: number,
  yPos: number,
  dist: number,
  size: number,
  color: readonly number[],
): void {
  const halfS = size / 2;
  const startX = Math.round(xPos - halfS);
  const endX = Math.round(xPos + halfS);
  const startY = Math.round(yPos - halfS);
  const endY = Math.round(yPos + halfS);
  for (let ix = startX; ix < endX; ix++) {
    if (ix < 0 || ix >= W) continue;
    if (dist >= zBuffer[ix]) continue;
    for (let iy = startY; iy < endY; iy++) {
      if (iy < 0 || iy >= H) continue;
      setPixel(ix, iy, color);
    }
  }
}

function renderWorld(): void {
  // Walls — one ray per display column.
  for (let i = 0; i < W; i++) {
    // Sample the ray at the column's centre.
    const rayAngle = pa - FOV / 2 + ((i + 0.5) / W) * FOV;
    let d = 0;
    while (d < MAX_DIST) {
      d += 0.05;
      const mx = Math.floor(px + Math.cos(rayAngle) * d);
      const my = Math.floor(py + Math.sin(rayAngle) * d);
      if (worldMap[my] && worldMap[my][mx] === 1) break;
    }

    const actualDist = d * Math.cos(rayAngle - pa);
    zBuffer[i] = actualDist;

    // Integer wall slab height, clamped to fit the display.
    const wallH = Math.min(H, Math.max(1, Math.round(H / (actualDist + 0.01))));
    const yStart = Math.max(0, Math.floor((H - wallH) / 2));
    const yEnd = Math.min(H - 1, yStart + wallH - 1);

    // Closer = warmer wall colour; farther = cooler blue.
    const nz = Math.max(0, Math.min(1, 1 - actualDist / 7));
    const wallColor: RGB = [200 * nz, 50 * nz * nz, 255 * (1 - nz)];

    for (let y = yStart; y <= yEnd; y++) {
      setPixel(i, y, wallColor);
    }
  }

  // Sprites — enemies + projectiles.
  const t = ticks_ms();
  for (const e of enemies) {
    const dx = e[0] - px;
    const dy = e[1] - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let angle = Math.atan2(dy, dx) - pa;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    while (angle > Math.PI) angle -= 2 * Math.PI;

    if (Math.abs(angle) < FOV) {
      // Project to a float screen-x — no quantisation.
      const sx = (angle / FOV + 0.5) * W;
      // Sprite size in cells scales with display resolution. The 0.75-of-min
      // factor keeps roughly the same on-screen size across W and H.
      const baseSize = (0.75 * Math.min(W, H)) / (dist + 0.5);
      const size = Math.max(1, baseSize);
      const color = e[3] > 0
        ? [255, 255, 255]
        : [255, (Math.sin(t / 100) + 1) * 100, 0];
      if (e[3] > 0) e[3] -= 1;
      drawSprite(sx, (H - 1) / 2, dist, size, color);
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
      const sx = (angle / FOV + 0.5) * W;
      // Projectiles GROW visually as they fly away from the player (close to
      // the muzzle = tiny dot; near the wall they hit = chunkier flare).
      const size = Math.max(
        0.6,
        (0.75 * Math.min(W, H)) / (dist + 0.5) - 0.5,
      );
      drawSprite(sx, H / 2, dist, size, [255, 255, 100]);
    }
  }
}

function updateGame(): void {
  const newProjs: Projectile[] = [];
  for (const p of projectiles) {
    p[0] += Math.cos(p[2]) * 0.4;
    p[1] += Math.sin(p[2]) * 0.4;

    if (
      worldMap[Math.floor(p[1])] &&
      worldMap[Math.floor(p[1])][Math.floor(p[0])] === 1
    )
      continue;

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

    if (
      !hitEnemy &&
      Math.sqrt((p[0] - px) ** 2 + (p[1] - py) ** 2) < MAX_DIST
    ) {
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
    if (JOY_LEFT.value() === 0) {
      pa -= 0.15;
      active = true;
    }
    if (JOY_RIGHT.value() === 0) {
      pa += 0.15;
      active = true;
    }

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
    if (
      worldMap[Math.floor(ny)] &&
      worldMap[Math.floor(ny)][Math.floor(nx)] === 0
    ) {
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
    fillBackdrop();
    renderWorld();
    showBuffer();

    if (enemies.length === 0) generateMap();

    await sleep_ms(30);
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
  JOY_LEFT = joystick.left;
  JOY_RIGHT = joystick.right;
  JOY_SEL = joystick.center;
  W = display?.width ?? 8;
  H = display?.height ?? 8;
  N = W * H;
  zBuffer = new Array(W).fill(MAX_DIST);
  frameBuffer = Array.from({ length: N }, () => [0, 0, 0]);
  screens.init(screensNp ?? neopixel, joystick);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const outcome = await playDoom();
    if (outcome === "exit") return;
    if ((await screens.end_screen()) === "exit") return;
  }
}
