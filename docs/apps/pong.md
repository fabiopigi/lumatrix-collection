# Pong

> Classic Pong on an 8×8 matrix. You play the left paddle; the CPU plays the right. The ball gets faster every 10 hits.

## How to play

A ball bounces between your paddle (2-pixel cyan column at col 0) and the CPU paddle (2-pixel red column at col 7). Use up/down to keep the ball in play. Each successful hit scores +1.

| Input | Action |
|---|---|
| Up | Move paddle up |
| Down | Move paddle down |
| Hold center 1.5 s | Exit to launcher |

The CPU paddle perfectly tracks the ball's vertical position, so **only your misses end the game**.

## Scoring

- **+1 per ball hit on the player paddle.** No score on CPU hits, no bonuses.
- Game ends when the ball passes your paddle (left edge with no paddle contact).

| Score | Means |
|---|---|
| **5–10** | A reasonable rally, multiple hits |
| **20–30** | You're tracking the deflection angles well |
| **50** | Expert play at increasing speeds |
| **99+** | Sustained perfect tracking past the speed cap (rare) |

## Mechanics

### Ball physics

- Ball position is float `(x, y)` in `[0, 7]`. Velocity is float `(vx, vy)`.
- Each frame: `x += vx`, `y += vy`.
- Bounces off top/bottom walls: `vy = -vy`.
- Bounces off paddles: `vx = -vx`, with **deflection** — the part of the paddle the ball hits modifies `vy`. Hitting near the top of the paddle kicks upward; near the bottom kicks downward. Center = straight bounce. This lets a skilled player aim shots.

### Speed-up

- Every 10 total paddle hits (`SPEEDUP_HITS`), both `vx` and `vy` get multiplied by `SPEEDUP_FACTOR` (1.15 = +15%).
- Speeds are capped at `MAX_VX = 1.20` and `MAX_VY = 0.80` (per-frame). The cap means the ball is hard but not impossible at high scores.

### Paddles

- Player paddle: `PADDLE_LEN = 2` pixels tall, moves at `PLAYER_SPEED = 0.50` pixels/frame.
- CPU paddle: same length, **instantly tracks** the ball's y position. The CPU never misses.

### Initial state

- Ball spawns at `(4.0, 3.5)` with random horizontal direction and random vertical direction.
- A 14-frame intro pause lets the player orient before the ball moves.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Frame rate (50 ms = 20 fps). |
| `PLAYER_SPEED` | 0.50 | Paddle move speed. |
| `INITIAL_VX` | 0.40 | Starting ball horizontal speed. |
| `INITIAL_VY_MIN`, `INITIAL_VY_MAX` | 0.15, 0.30 | Range for random starting vertical speed. |
| `MAX_VX`, `MAX_VY` | 1.20, 0.80 | Speed caps. |
| `SPEEDUP_HITS` | 10 | Hits between speed-ups. Lower = ramp faster. |
| `SPEEDUP_FACTOR` | 1.15 | Per-speedup multiplier. |
| `DEFLECTION` | 0.18 | How much paddle-hit position deflects vy. |

To make the game tighter (lower score ceiling), reduce `SPEEDUP_HITS` to 7 or 8.

## Implementation notes

- The CPU's "instant tracking" sets `cpu_y = ball_y - 0.5` every frame, clamped to `[0, 6]` (so the 2-pixel paddle stays on-screen).
- Wall bounces use reflection: if the ball would cross `y < 0` or `y > 7`, position is reflected back inside and velocity inverted. This works correctly for any speed up to `MAX_VY`.
- Paddle hit detection uses `int(round(ball_y))` for the row check. With sub-pixel ball positions, the player can sometimes "save" a ball that's mathematically about to cross the edge.
- The deflection formula: `vy += (ball_y - paddle_center) * DEFLECTION`. With `DEFLECTION = 0.18` and a 2-pixel paddle, hitting near an edge changes `vy` by up to ±0.18 — a noticeable shift but not extreme.
