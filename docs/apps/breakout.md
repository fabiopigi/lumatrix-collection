# Breakout

> Classic brick-breaker. Bounce the ball off your paddle to clear the bricks. 5 levels of layouts and increasing ball speeds, with 3 lives.

## How to play

A ball bounces between your paddle (3 pixels wide, bottom row) and the bricks at the top. Each hit destroys one brick and adds +1 to the score. Lose all 3 lives → game over. Clear a level → advance to the next.

| Input | Action |
|---|---|
| Left | Slide paddle left |
| Right | Slide paddle right |
| Hold center 1.5 s | Exit to launcher |

Each life starts with the ball **stuck to the paddle for 600 ms** (you can already move during this), then auto-launches upward with a slight random angle.

## Scoring

- **+1 per brick destroyed.** No bonuses.
- Clearing all bricks in a level doesn't score extra — the next level just starts.
- Game over when lives reach 0.

### Score per layout

| Level | Layout | Bricks | Speed |
|---|---|---|---|
| 1 | 1 row at top | 8 | 0.30 |
| 2 | 2 rows full | 16 | 0.34 |
| 3 | 3-row checkerboard | 12 | 0.38 |
| 4 | 3 rows full | 24 | 0.42 |
| 5 | Pyramid | 21 | 0.48 |

| Score | Means |
|---|---|
| **8** | Cleared level 1 |
| **24** | Cleared levels 1 + 2 |
| **36** | Cleared levels 1–3 |
| **60** | Cleared levels 1–4 |
| **81** | Cleared all 5 levels |
| **99+** | Looped back to level 1 and kept going |

After level 5, levels loop back to level 1 at the same ball speed — no further speedup. This caps casual play at around 80 unless you really sustain.

## Mechanics

### Paddle

- 3 pixels wide, position is a float `paddle_center` in `[1, 6]` (so the 3-pixel paddle never goes off the edges).
- `update_paddle()` is called every frame; holding left/right slides at `PADDLE_SPEED = 0.50` pixels/frame.

### Ball physics

- Float position `(ball_x, ball_y)` with float velocity `(ball_vx, ball_vy)`.
- Bounces off left/right walls and top wall via reflection.
- Hits a brick → brick destroyed, score +1, velocity reflected. The reflection axis (vy vs vx) is determined by which side the ball entered through, calculated from previous-frame position.
- Hits the paddle → reflect upward, deflect vy based on horizontal offset from paddle center. Hitting near a paddle edge angles the ball away from center.
- Misses the paddle (`ball_y ≤ 0` and not on paddle) → life lost.

### Lives

- Start of game: `lives = INIT_LIVES = 3`.
- Before each ball launch, `screens.show_digit_briefly(lives, LIFE_COL, 500)` displays the remaining life count in red for 500 ms.
- Before each level, `screens.show_digit_briefly(level + 1, LEVEL_COL, 600)` displays the level number in green for 600 ms.

### Bricks

- Each level is defined as an 8×8 bitmap string where `#` = brick and `.` = empty. The top row is row 7, bottom is row 0.
- Bricks are stored in a dict `bricks = {(col, row): True}`. Collision is `(int(round(ball_x)), int(round(ball_y))) in bricks`.
- Brick color depends on row: red (row 7), orange (6), yellow (5), green (4), blue (anything else).

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Frame rate. |
| `PADDLE_SPEED` | 0.50 | Paddle horizontal speed. |
| `INIT_LIVES` | 3 | Starting lives. |
| `LAUNCH_HOLD_MS` | 600 | How long the ball sticks to the paddle before launch. |
| `DEFLECTION` | 0.18 | How much paddle-hit position deflects ball vy. |
| `MAX_VX`, `MAX_VY` | 0.55, 0.55 | Speed caps. |
| `LEVELS` | 5 layouts | Per-level layout + speed. |

Want a tighter score ceiling? Either:
- Reduce `INIT_LIVES` to 2.
- Make levels loop with progressively faster ball speeds (currently they loop at the same speed).

## Implementation notes

- The brick collision reflection logic uses **previous-frame position** to figure out which side the ball entered through:
  - If only the vertical axis crossed the brick boundary → reflect vy.
  - If only the horizontal axis crossed → reflect vx.
  - If both crossed (corner hit) → reflect both.
- This means corner hits look right rather than always reflecting one way.
- `play_ball()` returns one of: `("cleared", score, paddle_center)`, `("lost", score, paddle_center)`, `("exit", score, paddle_center)`. The outer loop in `play_one_game()` handles each case.
- The "level cleared" flash is 2 green strobes (~280 ms total).
- Three nested timers/loops make this app the longest — outer for the game, middle for the level, inner for the ball. Each layer is self-contained.
