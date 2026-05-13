# DinoJump

> Chrome's dino game on an 8×8 matrix. Run rightward through a procedurally generated landscape, jumping ground obstacles and ducking under flying ones, until you hit something.

## How to play

A green 2-pixel dinosaur sits in column 2 (3rd from the left). The world scrolls in from the right and the dino has to dodge two kinds of obstacles:

| Obstacle | Row | What you do |
|---|---|---|
| Short (on the ground) | y = 6 | Tap **up** to jump |
| High (in the air) | y = 5 | Hold **down** to duck |

| Input | Effect |
|---|---|
| Up (tap) | Jump — lifts the dino 1 pixel for 2 world-steps, then lands |
| Down (hold) | Duck — shrinks the dino to 1 px while held |
| Hold center 1.5 s | Exit to launcher |

You can't duck mid-jump; the duck input is ignored until the dino lands.

## Scoring

- **+1 per obstacle cleared.**
- **+3 bonus every 50 pixels traveled** (i.e. each time the world speeds up).

Game ends the instant the dino's pixels overlap an obstacle's pixel at column 2.

| Score | Means |
|---|---|
| **5–10** | First handful of obstacles — a casual run |
| **20–40** | You've found the rhythm |
| **60–80** | Sustained play through several speedup tiers |
| **99+** | Marquee territory — long expert survival |

## Mechanics

### Dino state

| State | Rows occupied (visual y) |
|---|---|
| Standing | 5, 6 |
| Jumping | 4, 5 |
| Ducking | 6 |

The dino always sits at column 2.

### Jumping

- Edge-triggered: each press of up counts once. Holding doesn't queue jumps.
- A jump sets `jump_t = JUMP_TICKS` (2). On each world step the collision check runs against the airborne row pair (4, 5), then `jump_t` decrements. After 2 world steps the dino lands.
- Practically: press jump when an obstacle is at column 3 or 4 — that's the reachable window.

### Ducking

- Continuous: ducking is on as long as down is held and the dino is on the ground.
- Releases the moment down is let go, even mid-obstacle.

### Obstacles

- 1 pixel each, at either y=6 (ground) or y=5 (air). 50/50 random.
- Spawn at x=8 (off-screen right) and scroll left 1 column per world step.
- Gap between consecutive spawns is `random.randint(GAP_MIN, GAP_MAX)` world steps — 3 to 10 by default.
- The first obstacle is delayed by `INITIAL_DELAY_TICKS` so the player can orient.

### Collision and score

Both happen at the moment an obstacle's `x` reaches `DINO_COL` (column 2):
- If `oy` is in the dino's current row set → game over (the final frame is rendered before returning).
- Otherwise → score += 1 and the obstacle continues scrolling left harmlessly.

### Speedup

`move_interval` starts at 320 ms and shaves off `SPEEDUP_STEP_MS` (30 ms) every `SPEEDUP_EVERY_PX` (50) steps, until it floors at `MOVE_INTERVAL_MIN` (100 ms). Each speedup also adds `SPEEDUP_BONUS` (3) to the score. From start to max speed: 7 speedups, ≈ 67 seconds of survival, ≈ 21 bonus points.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 40 | Input/render frame cap. 40 ms = 25 fps. |
| `MOVE_INTERVAL_START` | 320 | ms per world step at game start. Higher = slower start. |
| `MOVE_INTERVAL_MIN` | 100 | Fastest world step. Lower = higher skill ceiling. |
| `SPEEDUP_EVERY_PX` | 50 | World steps between difficulty bumps. |
| `SPEEDUP_STEP_MS` | 30 | ms shaved off each bump. |
| `SPEEDUP_BONUS` | 3 | Score bonus at each speedup. |
| `GAP_MIN` / `GAP_MAX` | 3 / 10 | Spacing range between obstacles, in world steps. |
| `JUMP_TICKS` | 2 | World steps the dino is airborne. Higher = forgiving jumps. |
| `INITIAL_DELAY_TICKS` | 4 | Pre-first-spawn buffer at the start of a round. |

## Implementation notes

- All rendering uses visual coordinates via `px_visual(x, y, color)` (y=0 top). The single LED-index conversion lives in that helper.
- Obstacles are `[x, y]` lists (mutable so we could rewrite in-place, though the current code rebuilds the list each step instead).
- The dino's airborne window is **2 world steps of collision check**, achieved by checking collision *before* decrementing `jump_t`. That gives the player a 2-tick reaction window for jumps — pressing when the obstacle is at column 3 or 4 both succeed.
- Jumping into an air obstacle (y=5) kills you — the airborne row set (4, 5) overlaps. Ducking under a ground obstacle (y=6) kills you for the same reason. The game forces the player to identify each obstacle type before reacting.
- `random.getrandbits(1)` is preferred over `random.choice(...)` for the air/ground coin flip — it's available on every MicroPython port, while `choice` is occasionally trimmed out.
- No backwards-compatibility for missing joystick keys: the launcher always provides up/down. Standalone mode constructs them locally.

## Responsive scaling

**Feasibility: Yes — longer track, more variety.**

A wider display directly extends the side-scroller: more obstacles visible at once, longer reaction window. A taller display opens the door to taller obstacles, multi-height jump arcs, or platforms. The world-step cadence (`MOVE_INTERVAL_*`) might want a slower default at higher widths so the speed feels right at the new pixel scale.

Things to think about: obstacle spawn variety would benefit from a second axis — e.g., flying birds at the top half on a tall display.
