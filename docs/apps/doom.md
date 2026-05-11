# Doom

> First-person raycasting on an 8×8 matrix. Wander a procedurally-generated dungeon, shoot the wandering enemies, clear rooms one after another.

## How to play

You see the world through a 1-dimensional raycaster: 8 vertical "strips" representing the view ahead, color-shaded for distance. Walls render as full-height columns when nearby and shorter columns when far. Enemies glow as colored sprites; projectiles streak forward.

| Input | Action |
|---|---|
| Up | Walk forward |
| Down | Walk backward |
| Left | Rotate view left |
| Right | Rotate view right |
| Center (tap) | Fire (one projectile in flight at a time) |
| Hold center 1.5 s | Exit to launcher |
| 10 s of no input | Auto-show end screen |

The center button is **dual-purpose**: tap to fire (one shot at a time, "recharge" feel), or hold for 1.5 s to exit. Holding will fire one initial shot before the exit threshold trips.

## Behavior (no score)

This is a passive app — there's no win condition and no game over. After clearing a room (killing all 3 enemies), a new room generates automatically and you keep going. There's no score tracking.

After 10 s of no input (no movement, no firing), `screens.end_screen()` takes over.

## Mechanics

### Map generation

- A 10×10 grid (`MAP_SIZE = 10`) starts filled with walls.
- A random walker carves 40 cells of open space starting from a random interior cell. The walker can revisit cells (so the open area has organic, irregular shape).
- 3 enemies spawn in random open cells, at least 2 cells away from the player.
- The player spawns where the walker started.

### Raycasting renderer

- The screen is 8 columns wide; one ray is cast per column.
- Each ray starts at the player, advances in steps of 0.1 in world units, and stops when it hits a wall cell.
- The "fish-eye correction" multiplies by `cos(ray_angle - player_angle)` so walls look straight rather than curved.
- The closer the wall, the taller the rendered column. The 8-pixel viewport gets a centred column of `int(8 / distance)`-tall pixels.
- Color shifts from blue (far) to red/orange (close).

### Enemies and sprites

- Enemies aim themselves at the player by reflecting the angle from `atan2(dy, dx) - player_angle`.
- An enemy is rendered when it's inside the field of view (`abs(angle) < FOV`). Sprite size scales with distance (closer = bigger).
- Enemies have a "hit flash" — a 3-frame white flicker when hit.
- Projectiles are rendered identically but in yellow, and start small (1px) on hit, growing rapidly as they fly forward.

### Projectiles

- One projectile in flight at a time. New shots are ignored until the current one despawns.
- Despawn when: hits a wall, hits an enemy, or travels more than `MAX_DIST = 8` units from the player.
- Enemy collision radius is 0.4 world units.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `MAP_SIZE` | 10 | Side length of the world grid. Larger = more wandering. |
| `FOV` | π/3 (60°) | Horizontal field of view. |
| `BRIGHTNESS` | 0.15 | Global LED brightness multiplier. Doom's frame buffer uses internal 0–255 range; this scales it down. |
| `MAX_DIST` | 8.0 | Render culling distance; also projectile despawn distance. |
| Movement step | 0.15 | World-units per frame when walking. |
| Rotation step | 0.15 rad | Per frame when turning. |
| `IDLE_MS` | 10 000 | Inactivity timeout. |

## Implementation notes

- Internal coordinates use a `frame_buffer` (list of `[r, g, b]` floats in 0–255 range). At write time, each value is multiplied by `BRIGHTNESS` and clamped to 0–255 before being written to the NeoPixel buffer. This lets sprites "blend additively" (multiple sprites overlapping brighten the pixel).
- The renderer also maintains a `z_buffer` of one float per column (the wall distance for that column). Sprites are occluded by walls in front of them via this z-test.
- The `int(8 / (distance + 0.01))` math protects against division by zero when the player is touching a wall.
- Procedural map generation runs every time enemies are cleared, so each "room" is unique. There's no persistent map.
- This app has no win condition, no death, no score. It's a passive exploration mode. If you want a doom-with-health-and-death variant, that's a fork rather than a tweak.
