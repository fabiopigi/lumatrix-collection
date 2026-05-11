# FlappyPixels

> Flappy Bird on an 8×8 matrix. You're the leftmost pixel; walls scroll in from the right. Tap up to flap, navigate through the gaps.

## How to play

You control a single pixel that sits in column 0. Gravity pulls it down (gravity mode) or it floats in place (float mode, toggled by the slide switch). Walls scroll from right to left, each with a 3-pixel gap. Get the pixel into the gap before the wall reaches you.

| Input | Gravity mode | Float mode |
|---|---|---|
| Up | Flap (small upward kick, stacks if you keep tapping) | Accelerate up (continuous) |
| Down | — | Accelerate down (continuous) |
| Slide switch (GPIO 9) | (toggle) | (toggle) |
| Hold center 1.5 s | Exit to launcher | Exit to launcher |

The player pixel is **yellow** in gravity mode and **cyan** in float mode, so you can see at a glance which physics you're under.

You can flip the slide mid-game; physics changes instantly, your current velocity carries through.

## Scoring

- **+1 per wall passed.** No combos, no bonuses.
- Game ends when you collide with a wall (your column lines up with a wall pixel that isn't the gap), or in gravity mode, when you hit the floor.

| Score | Means |
|---|---|
| **5–10** | Made it past the first half-dozen walls — a normal first run |
| **20–30** | You've got the rhythm |
| **50** | Long sustained play |
| **99+** | Edge of what's possible at the default speeds; marquees the score |

Walls don't speed up at the default settings, so a skilled player can sustain indefinitely. That's the only app in the collection where 99+ is realistically reachable without effort — see Tunables if you want a tighter ceiling.

## Mechanics

### Gravity mode (slide=0)

- Each frame: `velocity += GRAVITY`, then `y += velocity`. So your fall accelerates.
- Tapping up applies `velocity = max(velocity - JUMP_DELTA, JUMP_CAP)`. Each tap is an additive kick (stacks), capped so spamming up doesn't shoot you to escape velocity.
- Hitting `y = 0` (ceiling) clamps with zero velocity. Hitting `y ≥ 7.5` (floor) is game over.
- Up input is **edge-triggered**: each press counts once, even if held.

### Float mode (slide=1)

- No gravity at all.
- Up held: `velocity -= FLOAT_ACCEL`. Down held: `velocity += FLOAT_ACCEL`. Caps at ±`FLOAT_TERMINAL`.
- Floor and ceiling both just clamp velocity to 0. **No death from either edge** — only walls kill.
- Up/Down inputs are **continuous** (held = accelerating).

### Walls

- A wall is a column of 8 LEDs with a 3-pixel gap somewhere. Gap position is random per wall, range `0..(7 - GAP_SIZE) = 0..4`.
- Walls move 1 column left every `WALL_TICK` frames (6 frames = 300 ms default).
- A new wall spawns every `SPAWN_TICK` frames (24 = 1.2 s default), so walls are about 4 columns apart on screen.
- When a wall reaches column 0 (player's column), the collision check fires: if `int(y)` is inside the gap, score+1 and the wall is consumed; otherwise game over.

### Intro

- The first 14 frames (`intro_frames`) of every round are "stand-still" — gravity applies but no walls spawn or move. Gives the player a moment to orient.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Frame rate. 50 ms = 20 fps. |
| `GRAVITY` | 0.05 | How fast you fall in gravity mode. Higher = harder. |
| `JUMP_DELTA` | 0.40 | How much each tap subtracts from velocity. |
| `JUMP_CAP` | -1.0 | Max upward velocity from stacked taps. |
| `TERMINAL_VEL` | 1.5 | Max downward velocity (cap). |
| `FLOAT_ACCEL` | 0.025 | Float-mode hold-direction acceleration. |
| `FLOAT_TERMINAL` | 0.40 | Float-mode max speed cap. |
| `WALL_TICK` | 6 | Frames between wall-column moves. Lower = walls move faster = harder. |
| `SPAWN_TICK` | 24 | Frames between wall spawns. Lower = walls closer together = harder. |
| `GAP_SIZE` | 3 | Pixels of gap per wall. Lower = harder. |

To tighten the score ceiling toward 99, lower `WALL_TICK` over time (e.g. `params["wall_tick"] = max(2, 6 - score // 20)`).

## Implementation notes

- Player position `player_y` is a float in `[0, 7]`. Rendering uses `int(player_y)` for the LED row.
- Walls are stored as `{"col": int, "gap": int}` dicts in a list, ordered by spawn time.
- The wall-collision check happens at the moment a wall transitions from column 1 to column 0, not while it sits at 0. This way the wall never visually overlaps the player.
- Float mode is the more forgiving mode; great for kids or first-time players. Gravity mode is the "real" mode with the floor-hit-equals-death rule.
