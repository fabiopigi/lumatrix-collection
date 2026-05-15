import { FONT_3X5 } from "../fonts";
import type { DisplayDims, Joystick, NeoPixel, Pin, RGB } from "../types";
import * as screens from "../screens";
import { sleep_ms, ticks_diff, ticks_ms } from "../runtime/time";

export const NAME = "Doom";

/**
 * 1D-raycaster shooter. Now an actual game:
 *
 *  - The player has HP (3 by default). Each enemy projectile that hits the
 *    player costs 1 HP. At 0 → game over with the current score.
 *  - Each level spawns 3 enemies in a procedurally generated maze. Clearing
 *    all of them advances to the next level and restores 1 HP (capped at
 *    MAX_HP).
 *  - Every 3rd level spawns 1 boss in place of one of the regulars: more HP,
 *    bigger sprite, a faster shoot cadence.
 *  - Enemies fire back when they have line of sight to the player. Higher
 *    levels mean shorter enemy cooldown and faster projectiles.
 *  - Player projectiles render as a single pixel-centred dot far away,
 *    expanding to a 3×3 burst when they're about to land — no more
 *    off-centre 2×2 blobs.
 *
 *  Score: +1 per regular kill, +3 per boss kill. Calibrated so a casual
 *  session lands around 10–20, a focused session 30–60, and reaching 90+
 *  requires surviving deep levels where bosses + faster fire push the
 *  difficulty up against MAX_HP.
 */
export const RESPONSIVE = true;

const MAP_SIZE = 10;
const FOV = Math.PI / 3;
const BRIGHTNESS = 0.15;
const MAX_DIST = 8.0;

// ── Gameplay tunables ───────────────────────────────────────────────────
const MAX_HP = 3;
const PLAYER_SHOOT_COOLDOWN_MS = 280;
const PROJ_SPEED_PLAYER = 0.45;
const PROJ_SPEED_ENEMY_BASE = 0.20;
const PROJ_HIT_RADIUS_SQ = 0.36;
const ENEMIES_PER_LEVEL = 3;
const BOSS_EVERY_N_LEVELS = 3;
const BOSS_HP = 3;
const ENEMY_SIGHT_RANGE_SQ = 25;
const FIRE_FLASH_MS = 80;
// Reaction time: enemies must keep the player in sight this long before they
// can fire. Resets when LOS breaks. Gives the player a "peek out, shoot, hide
// behind a wall" gameplay loop.
const ENEMY_REACTION_MS = 1000;
const BOSS_REACTION_MS = 600;
// Initial level-start grace period — extra time before the FIRST shot fires,
// stacked on top of the regular cooldown. Gives the player a beat to orient.
const LEVEL_START_GRACE_MS = 2000;
const LEVEL_START_GRACE_BOSS_MS = 1500;
// Frames the level transition stays on screen (~1 s at 30 ms/frame).
const TRANSITION_FRAMES = 32;

// Per-level enemy cooldown range — shrinks as `level` grows so deep play is
// noticeably more dangerous than level 1.
function enemyCooldownRange(level: number): { min: number; max: number } {
  const min = Math.max(1100, 3000 - level * 150);
  const max = Math.max(2000, 5500 - level * 250);
  return { min, max };
}
function bossCooldownRange(level: number): { min: number; max: number } {
  const min = Math.max(700, 1800 - level * 80);
  const max = Math.max(1200, 2800 - level * 120);
  return { min, max };
}
function enemyProjectileSpeed(level: number): number {
  return Math.min(0.35, PROJ_SPEED_ENEMY_BASE + level * 0.012);
}

// ── Hardware bindings ───────────────────────────────────────────────────
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
let frameBuffer: number[][] = [];

// ── Entities ────────────────────────────────────────────────────────────
interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  nextShot: number; // ticks_ms at which this enemy may next fire
  // When this enemy first acquired LOS on the player. Resets to null when LOS
  // breaks. The enemy only fires after ENEMY_REACTION_MS (or BOSS_REACTION_MS)
  // of continuous sight has passed.
  spottedAt: number | null;
  isBoss: boolean;
}
interface Projectile {
  x: number;
  y: number;
  angle: number;
  speed: number;
  fromPlayer: boolean;
}
let enemies: Enemy[] = [];
let projectiles: Projectile[] = [];

// ── Game state ──────────────────────────────────────────────────────────
let playerHp = MAX_HP;
let score = 0;
let levelIdx = 1;
let damageFlashFrames = 0;
let levelClearFrames = 0;
let muzzleFlashUntil = 0;
let lastPlayerShot = 0;

// ── Helpers ─────────────────────────────────────────────────────────────
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function choice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isWall(x: number, y: number): boolean {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  return !worldMap[iy] || worldMap[iy][ix] === 1;
}

/** Line-of-sight test by sampling cells along the segment. */
function hasLineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist * 6);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    if (isWall(x, y)) return false;
  }
  return true;
}

function generateMap(): void {
  worldMap = [];
  for (let y = 0; y < MAP_SIZE; y++) {
    const row: number[] = [];
    for (let x = 0; x < MAP_SIZE; x++) row.push(1);
    worldMap.push(row);
  }
  let cx = randInt(1, 8);
  let cy = randInt(1, 8);
  px = cx + 0.5;
  py = cy + 0.5;
  pa = 0;
  // Drunk-walk carver — 60 steps, picks a random adjacent floor each tick.
  for (let i = 0; i < 60; i++) {
    worldMap[cy][cx] = 0;
    const dir = choice<[number, number]>([[0, 1], [0, -1], [1, 0], [-1, 0]]);
    const nx = cx + dir[0];
    const ny = cy + dir[1];
    if (nx > 0 && nx < MAP_SIZE - 1 && ny > 0 && ny < MAP_SIZE - 1) {
      cx = nx;
      cy = ny;
    }
  }
}

function setupLevel(level: number): void {
  generateMap();
  enemies = [];
  projectiles = [];
  const now = ticks_ms();
  const isBossLevel = level % BOSS_EVERY_N_LEVELS === 0;
  const { min: emin, max: emax } = enemyCooldownRange(level);
  const { min: bmin, max: bmax } = bossCooldownRange(level);

  let placed = 0;
  let tries = 0;
  while (placed < ENEMIES_PER_LEVEL && tries < 1000) {
    tries++;
    const ex = randInt(1, 8);
    const ey = randInt(1, 8);
    if (worldMap[ey][ex] !== 0) continue;
    if (Math.abs(ex + 0.5 - px) < 2 && Math.abs(ey + 0.5 - py) < 2) continue;
    if (
      enemies.some(
        (e) => Math.abs(e.x - (ex + 0.5)) < 1 && Math.abs(e.y - (ey + 0.5)) < 1,
      )
    )
      continue;
    const isBoss = isBossLevel && placed === 0;
    const cool = isBoss ? bmax : emax; // start with the long end so the first shot isn't instant
    const grace = isBoss ? LEVEL_START_GRACE_BOSS_MS : LEVEL_START_GRACE_MS;
    enemies.push({
      x: ex + 0.5,
      y: ey + 0.5,
      hp: isBoss ? BOSS_HP : 1,
      maxHp: isBoss ? BOSS_HP : 1,
      hitFlash: 0,
      nextShot: now + randInt(isBoss ? bmin : emin, cool) + grace,
      spottedAt: null,
      isBoss,
    });
    placed++;
  }
}

// ── Frame buffer ────────────────────────────────────────────────────────
function fillBackdrop(): void {
  // Subtle sky / floor gradient so empty cells aren't pure black.
  const horizon = (H - 1) / 2;
  // If the player just took damage, tint the sky red.
  const dmgTint =
    damageFlashFrames > 0 ? Math.min(1, damageFlashFrames / 6) : 0;
  // If the level just cleared, tint the sky green.
  const clrTint =
    levelClearFrames > 0 ? Math.min(1, levelClearFrames / 6) : 0;

  for (let y = 0; y < H; y++) {
    let r = 0,
      g = 0,
      b = 0;
    if (y < horizon) {
      const t = (horizon - y) / Math.max(1, horizon);
      r = 40 * t;
      g = 60 * t;
      b = 140 * t + 20;
    } else {
      const t = (y - horizon) / Math.max(1, horizon);
      r = 90 * t + 25;
      g = 50 * t + 15;
      b = 25 * t + 8;
    }
    // Apply tints.
    r += 200 * dmgTint + 0 * clrTint;
    g += 0 * dmgTint + 180 * clrTint;
    b += 0 * dmgTint + 40 * clrTint;
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      frameBuffer[idx][0] = Math.min(255, r);
      frameBuffer[idx][1] = Math.min(255, g);
      frameBuffer[idx][2] = Math.min(255, b);
    }
  }
}

function setPixel(ix: number, iy: number, color: readonly number[]): void {
  if (ix < 0 || ix >= W || iy < 0 || iy >= H) return;
  const idx = iy * W + ix;
  frameBuffer[idx][0] = color[0];
  frameBuffer[idx][1] = color[1];
  frameBuffer[idx][2] = color[2];
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

// ── Rendering ───────────────────────────────────────────────────────────
function drawSpriteBlock(
  xPos: number,
  yPos: number,
  dist: number,
  size: number,
  color: readonly number[],
): void {
  // Render as an odd-sized integer block centred on (round(xPos), round(yPos))
  // so even-size requests don't slide off-centre. Size is clamped to >= 1.
  const odd = Math.max(1, Math.round(size) | 1); // force to odd
  const half = (odd - 1) / 2;
  const cx = Math.round(xPos);
  const cy = Math.round(yPos);
  for (let dx = -half; dx <= half; dx++) {
    const ix = cx + dx;
    if (ix < 0 || ix >= W) continue;
    if (dist >= zBuffer[ix]) continue;
    for (let dy = -half; dy <= half; dy++) {
      const iy = cy + dy;
      if (iy < 0 || iy >= H) continue;
      setPixel(ix, iy, color);
    }
  }
}

function drawProjectileDot(
  xPos: number,
  yPos: number,
  dist: number,
  color: readonly number[],
): void {
  // Always pixel-centred: 1×1 far, 3×3 close. No more drifting 2×2 blobs.
  const cx = Math.round(xPos);
  const cy = Math.round(yPos);
  const close = dist < 1.2;
  if (!close) {
    if (cx < 0 || cx >= W || cy < 0 || cy >= H) return;
    if (dist >= zBuffer[cx]) return;
    setPixel(cx, cy, color);
    return;
  }
  // 3×3 burst centred on (cx, cy).
  for (let dx = -1; dx <= 1; dx++) {
    const ix = cx + dx;
    if (ix < 0 || ix >= W) continue;
    if (dist >= zBuffer[ix]) continue;
    for (let dy = -1; dy <= 1; dy++) {
      const iy = cy + dy;
      if (iy < 0 || iy >= H) continue;
      setPixel(ix, iy, color);
    }
  }
}

function projectToScreen(angle: number): number {
  // Center of FOV maps to (W-1)/2; the projection is symmetric on either side.
  return ((angle - pa) / FOV) * W + (W - 1) / 2;
}

function normaliseAngle(a: number): number {
  while (a < -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

function renderWorld(): void {
  // Walls — one ray per display column. Z-buffer per column.
  for (let i = 0; i < W; i++) {
    const rayAngle = pa - FOV / 2 + ((i + 0.5) / W) * FOV;
    let d = 0;
    while (d < MAX_DIST) {
      d += 0.05;
      if (isWall(px + Math.cos(rayAngle) * d, py + Math.sin(rayAngle) * d))
        break;
    }
    const actualDist = d * Math.cos(rayAngle - pa);
    zBuffer[i] = actualDist;

    const wallH = Math.min(H, Math.max(1, Math.round(H / (actualDist + 0.01))));
    const yStart = Math.max(0, Math.floor((H - wallH) / 2));
    const yEnd = Math.min(H - 1, yStart + wallH - 1);

    const nz = Math.max(0, Math.min(1, 1 - actualDist / 7));
    const wallColor: RGB = [200 * nz, 50 * nz * nz, 255 * (1 - nz)];
    for (let y = yStart; y <= yEnd; y++) setPixel(i, y, wallColor);
  }

  // Enemies — sprite. Bosses are bigger and purple; regulars orange.
  const t = ticks_ms();
  for (const e of enemies) {
    const dx = e.x - px;
    const dy = e.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const a = normaliseAngle(Math.atan2(dy, dx) - pa);
    if (Math.abs(a) >= FOV) continue;

    const sx = projectToScreen(pa + a);
    const baseFactor = e.isBoss ? 1.1 : 0.7;
    const sz = Math.max(1, (baseFactor * Math.min(W, H)) / (dist + 0.5));

    let color: readonly number[];
    if (e.hitFlash > 0) {
      color = [255, 255, 255];
      e.hitFlash--;
    } else if (e.isBoss) {
      const wobble = (Math.sin(t / 90) + 1) * 0.5;
      color = [180 + 60 * wobble, 30, 200 + 40 * wobble];
    } else {
      const wobble = (Math.sin(t / 100) + 1) * 0.5;
      color = [255, 70 + 110 * wobble, 0];
    }
    drawSpriteBlock(sx, (H - 1) / 2, dist, sz, color);
  }

  // Projectiles. Player = yellow; enemies = red.
  for (const p of projectiles) {
    const dx = p.x - px;
    const dy = p.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const a = normaliseAngle(Math.atan2(dy, dx) - pa);
    if (Math.abs(a) >= FOV) continue;
    const sx = projectToScreen(pa + a);
    const color: readonly number[] = p.fromPlayer
      ? [255, 255, 100]
      : [255, 60, 60];
    drawProjectileDot(sx, (H - 1) / 2, dist, color);
  }

  // Muzzle flash — a small bright spot in the centre, briefly, after firing.
  if (ticks_ms() < muzzleFlashUntil) {
    const cx = Math.round((W - 1) / 2);
    const cy = Math.round((H - 1) / 2);
    setPixel(cx, cy, [255, 255, 220]);
  }

  // HP pips — 1 cell per HP in the top-left corner.
  for (let i = 0; i < MAX_HP; i++) {
    const x = i;
    const y = 0; // top row (visual-y = 0 = display top)
    const lit = i < playerHp;
    setPixel(x, y, lit ? [200, 30, 30] : [40, 10, 10]);
  }
}

// ── Update logic ────────────────────────────────────────────────────────
function updateProjectiles(): void {
  const newProjs: Projectile[] = [];
  for (const p of projectiles) {
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;

    if (isWall(p.x, p.y)) continue;

    if (p.fromPlayer) {
      let hit = false;
      for (const e of enemies) {
        const ed = (p.x - e.x) ** 2 + (p.y - e.y) ** 2;
        if (ed < PROJ_HIT_RADIUS_SQ) {
          e.hp -= 1;
          e.hitFlash = 3;
          hit = true;
          if (e.hp <= 0) score += e.isBoss ? 3 : 1;
          break;
        }
      }
      if (hit) continue;
    } else {
      const pd = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (pd < PROJ_HIT_RADIUS_SQ) {
        playerHp -= 1;
        damageFlashFrames = 8;
        continue;
      }
    }

    const pd = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (pd < MAX_DIST * MAX_DIST) newProjs.push(p);
  }
  projectiles = newProjs;
  enemies = enemies.filter((e) => e.hp > 0);
}

/** Random shot-angle offset (radians). Shrinks with level so early-game enemies
 *  miss a lot and late-game ones are pinpoint. Bosses are markedly better
 *  shots than regular grunts at the same level. */
function inaccuracyRadians(level: number, isBoss: boolean): number {
  const base = isBoss ? 0.20 : 0.40; // ~11° / ~23° at level 1
  return Math.max(0.04, base - level * 0.03);
}

function updateEnemyFire(level: number): void {
  const now = ticks_ms();
  const proj = enemyProjectileSpeed(level);
  for (const e of enemies) {
    const dx = px - e.x;
    const dy = py - e.y;
    const distSq = dx * dx + dy * dy;
    const inRange = distSq < ENEMY_SIGHT_RANGE_SQ;
    const sees = inRange && hasLineOfSight(e.x, e.y, px, py);

    if (!sees) {
      // Lost (or never had) LOS — reset reaction so re-acquiring sight costs
      // another full reaction time. This is what makes peek-shoot-hide work.
      e.spottedAt = null;
      continue;
    }

    // Acquire / hold sight.
    if (e.spottedAt === null) e.spottedAt = now;

    const reactionMs = e.isBoss ? BOSS_REACTION_MS : ENEMY_REACTION_MS;
    if (now - e.spottedAt < reactionMs) continue; // still aiming
    if (now < e.nextShot) continue; // cooling down

    // Aim with per-shot inaccuracy that improves with level.
    const inacc = inaccuracyRadians(level, e.isBoss);
    const offset = (Math.random() - 0.5) * 2 * inacc;
    const aimAngle = Math.atan2(dy, dx) + offset;

    // Spawn just outside the enemy's hitbox so it doesn't instantly self-hit.
    const sx = e.x + Math.cos(aimAngle) * 0.4;
    const sy = e.y + Math.sin(aimAngle) * 0.4;
    projectiles.push({
      x: sx,
      y: sy,
      angle: aimAngle,
      speed: proj,
      fromPlayer: false,
    });
    const range = e.isBoss
      ? bossCooldownRange(level)
      : enemyCooldownRange(level);
    e.nextShot = now + randInt(range.min, range.max);
  }
}

// ── Level indicator ─────────────────────────────────────────────────────
function drawDigit(ch: string, x0: number, y0: number, color: RGB): void {
  const g = FONT_3X5[ch];
  if (!g) return;
  for (let gy = 0; gy < g.length; gy++) {
    const row = g[gy];
    for (let gx = 0; gx < row.length; gx++) {
      if (row[gx] === "X") setPixel(x0 + gx, y0 + gy, color);
    }
  }
}

/** Paint the level number centred on the display, on top of whatever else is
 *  already in the frame buffer. Wide displays accommodate 2-digit levels. */
function renderLevelOverlay(level: number, color: RGB): void {
  const text = String(level);
  const widths = [...text].map((ch) => {
    const g = FONT_3X5[ch];
    return g && g[0] ? g[0].length : 0;
  });
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + Math.max(0, widths.length - 1);
  if (totalWidth > W || H < 5) return;
  const x0 = Math.floor((W - totalWidth) / 2);
  const y0 = Math.floor((H - 5) / 2);
  let pos = x0;
  for (let i = 0; i < text.length; i++) {
    drawDigit(text[i], pos, y0, color);
    pos += widths[i] + 1;
  }
}

// ── Death / level transitions ───────────────────────────────────────────
async function deathSequence(): Promise<void> {
  // Red flash, then black.
  const n = W * H;
  for (let pulse = 0; pulse < 3; pulse++) {
    for (let i = 0; i < n; i++) {
      np[i] = [120, 0, 0] as RGB;
    }
    np.write();
    await sleep_ms(110);
    for (let i = 0; i < n; i++) np[i] = [0, 0, 0] as RGB;
    np.write();
    await sleep_ms(70);
  }
}

// ── Main game loop ──────────────────────────────────────────────────────
async function playGame(): Promise<number | null> {
  score = 0;
  playerHp = MAX_HP;
  levelIdx = 1;
  damageFlashFrames = 0;
  levelClearFrames = 0;
  lastPlayerShot = 0;
  setupLevel(levelIdx);

  while (true) {
    if (screens.check_exit()) return null;

    // ── Input ──
    if (JOY_LEFT.value() === 0) pa -= 0.15;
    if (JOY_RIGHT.value() === 0) pa += 0.15;

    let nx = px,
      ny = py;
    if (JOY_UP.value() === 0) {
      nx += Math.cos(pa) * 0.13;
      ny += Math.sin(pa) * 0.13;
    }
    if (JOY_DOWN.value() === 0) {
      nx -= Math.cos(pa) * 0.13;
      ny -= Math.sin(pa) * 0.13;
    }
    // Slide along walls — try X and Y axes independently.
    if (!isWall(nx, py)) px = nx;
    if (!isWall(px, ny)) py = ny;

    const now = ticks_ms();
    if (
      JOY_SEL.value() === 0 &&
      now - lastPlayerShot >= PLAYER_SHOOT_COOLDOWN_MS
    ) {
      // Spawn projectile just in front of the player so it doesn't
      // immediately register a near-zero distance.
      projectiles.push({
        x: px + Math.cos(pa) * 0.3,
        y: py + Math.sin(pa) * 0.3,
        angle: pa,
        speed: PROJ_SPEED_PLAYER,
        fromPlayer: true,
      });
      lastPlayerShot = now;
      muzzleFlashUntil = now + FIRE_FLASH_MS;
    }

    // ── Simulation ──
    updateProjectiles();
    updateEnemyFire(levelIdx);

    if (damageFlashFrames > 0) damageFlashFrames--;
    if (levelClearFrames > 0) levelClearFrames--;

    // ── Lose ──
    if (playerHp <= 0) {
      await deathSequence();
      return score;
    }

    // ── Level cleared ──
    if (enemies.length === 0) {
      // 1) Green clear-tint pulse on the current map (~0.5 s).
      for (let i = 0; i < 14; i++) {
        if (screens.check_exit()) return null;
        levelClearFrames = 14 - i; // fade out
        fillBackdrop();
        renderWorld();
        showBuffer();
        await sleep_ms(30);
      }
      levelClearFrames = 0;

      // 2) Generate the next level + restore 1 HP, then show a cyan "get
      // ready" overlay with the new level number on top of the freshly
      // generated map (~1 s).
      playerHp = Math.min(MAX_HP, playerHp + 1);
      levelIdx++;
      setupLevel(levelIdx);

      const nextLevelColor: RGB = [60, 200, 240]; // cyan "ready"
      for (let f = 0; f < TRANSITION_FRAMES; f++) {
        if (screens.check_exit()) return null;
        fillBackdrop();
        renderWorld();
        // Pulse the digit's brightness so it reads as an alert, not a
        // static label.
        const pulse = 0.65 + 0.35 * Math.abs(Math.sin((f / 6) * Math.PI));
        renderLevelOverlay(levelIdx, [
          Math.floor(nextLevelColor[0] * pulse),
          Math.floor(nextLevelColor[1] * pulse),
          Math.floor(nextLevelColor[2] * pulse),
        ]);
        showBuffer();
        await sleep_ms(30);
      }
      continue;
    }

    // ── Render ──
    fillBackdrop();
    renderWorld();
    showBuffer();

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
  screens.init(screensNp ?? neopixel, joystick, display?.width, display?.height);
  while (true) {
    if ((await screens.loading_screen()) === "exit") return;
    const finalScore = await playGame();
    if (finalScore === null) return;
    if ((await screens.game_over_screen(finalScore)) === "exit") return;
  }
}
