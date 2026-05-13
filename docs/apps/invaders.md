# SpaceInvaders

> Aliens descend from the top. You're a 3-pixel ship on the bottom, sliding left and right with auto-firing bullets. Survive long enough to unlock multi-stream weapons.

## How to play

Your ship (3 pixels wide, green) sits on the bottom row. Aliens (red) spawn at the top and march downward. Bullets (yellow) fire automatically from your ship at intervals defined by your current weapon level.

| Input | Action |
|---|---|
| Left | Slide ship left |
| Right | Slide ship right |
| Hold center 1.5 s | Exit to launcher |

You can move freely while bullets keep firing. **Game over when any alien reaches the bottom row.**

## Scoring

- **+1 per alien destroyed.** No bonuses, no combos.

| Score | Means |
|---|---|
| **5–10** | Comfortable start, single-stream weapon |
| **20–34** | You've reached level 3 (2-stream weapon) |
| **35–54** | Level 4 (3-stream weapon, faster shooting) |
| **55+** | Level 5 (max weapon, max alien speed) |
| **99+** | Sustained max-difficulty play |

The ship's color shifts through 5 stages as you level up (dim green → bright cyan-green → cyan) so you always know what tier you're in.

## Mechanics

### Levels and progression

Score thresholds promote you to the next level. The five levels:

| Level | Score | Streams | Shoot interval | Alien descent | Spawn rate |
|---|---|---|---|---|---|
| 1 | 0–7   | 1 (center) | 14 fr (700 ms) | 28 fr (1.4 s) | 50 fr (2.5 s) |
| 2 | 8–19  | 1 (center) | 10 fr (500 ms) | 22 fr (1.1 s) | 40 fr (2.0 s) |
| 3 | 20–34 | 2 (sides)  |  9 fr (450 ms) | 18 fr (0.9 s) | 32 fr (1.6 s) |
| 4 | 35–54 | 3 (sides + center) | 7 fr (350 ms) | 14 fr (0.7 s) | 26 fr (1.3 s) |
| 5 | 55+   | 3          |  5 fr (250 ms) | 10 fr (0.5 s) | 22 fr (1.1 s) |

A brief white flash plays when you level up.

### Streams

- 1 stream: bullet fires from `(player_col, 1)`.
- 2 streams: bullets fire from `(player_col - 1, 1)` and `(player_col + 1, 1)`. **No center stream** — flanking shots only.
- 3 streams: all three (`-1, 0, +1`).

Player column is clamped to `[1, 6]` so the 3-wide ship doesn't go off the edge.

### Alien movement and collisions

- All aliens descend in lockstep when the `alien_step` timer fires. Between steps, only bullets move.
- Bullets advance 1 row per frame.
- Collision check fires twice per alien-step: once after bullets move, once after aliens move. This prevents bullets from "passing through" an alien that descended into them on the same tick.
- Aliens spawn at `(random_col, row 7)` at the spawn cadence.

### Intro

The first 14 frames are pause-only — aliens don't spawn or move, bullets don't fire. Lets the player orient.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Frame rate. |
| `MOVE_SPEED` | 0.30 | Ship horizontal speed. |
| `LEVELS` | (table above) | Per-level parameters. Tune to change difficulty curve. |
| `LEVEL_THRESHOLDS` | `(8, 20, 35, 55)` | Score thresholds for promotions. |

For a tighter score ceiling, raise the level 5 spawn rate (more aliens = faster lose).

## Implementation notes

- Aliens are stored as `[col, row]` lists; bullets the same. Lists, not tuples, because both lists get mutated each frame (the row index in particular).
- `handle_collisions(bullets, aliens, score)` builds a `(col, row) → alien_index` dict and walks bullets, removing matches from both lists. Returns updated `(bullets, aliens, score)`.
- The 3-pixel-wide ship rendering uses simple `for off in (-1, 0, 1): px(player_col + off, 0, ship_color)`.
- `stream_offsets(n)` returns the bullet offset list for a given stream count: `(0,)`, `(-1, 1)`, `(-1, 0, 1)`, or `(-2, -1, 0, 1, 2)` for higher stream counts not used by default levels.

## Responsive scaling

**Feasibility: Yes — more dramatic descent.**

A taller display directly extends the aliens' fall time, making the difficulty pacing gentler. A wider display means more horizontal travel for the player and more spawn variety. Bullet streams (already configurable 1/2/3 per shot) scale naturally. The `LEVELS` table would want rebalancing — current step-rates assume 8-row descent.

Things to think about: spawning a wave of multiple aliens simultaneously becomes more interesting at 16-wide+, and could be a new level mechanic.
