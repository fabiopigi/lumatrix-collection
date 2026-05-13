# ArrowReaction

> A reaction-time game. An arrow appears, you press the matching joystick direction before the timer bar runs out.

## How to play

- An arrow appears (up / down / left / right) in a per-round color, with an 8-pixel green bar at the bottom showing remaining time.
- Press the joystick in the direction the arrow points **before the bar runs out**.
- Press correctly → score += pixels remaining in the bar (1–8 points).
- Press wrong direction → game over.
- Don't press at all (bar reaches 0) → game over.

The bar shrinks faster each round, so rounds get tighter as you survive.

| Input | Action |
|---|---|
| Up / Down / Left / Right | Match the arrow's direction |
| Hold center 1.5 s | Exit to launcher |

## Scoring

You score the **number of pixels remaining** in the bar at the moment you press the correct direction. Faster reaction = more points per round.

| Score | Roughly means |
|---|---|
| **10** | ~2 quick reactions OR ~4 slow ones |
| **30** | A solid run — multiple fast reactions |
| **60** | Lots of fast reactions in a row |
| **99** | Expert-level sustained reflexes (uncommon) |

The bar's color shifts as it shrinks: green (≥6 pixels) → amber (3–5) → red (≤2). Hitting at red gives 1–2 points; hitting at green gives 6–8.

## Mechanics

- Round duration starts at **1800 ms** (`duration = 1800`).
- After each successful hit, duration shrinks by **60 ms**, floor **600 ms**. So by round ~20 you're at the floor (very tight).
- Bar length is computed each frame from elapsed time: `bar = 8 - (elapsed × 8) ÷ duration`.
- Arrow color cycles through an 8-color palette, never the same color twice in a row.
- On a successful hit, the matching arrow flashes green briefly before the next round.

The check at game over time uses `screens.game_over_screen(score)`, which means:
- Tap any direction → restart from a fresh round.
- Hold center 1.5 s → exit to launcher.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` (game loop sleep) | 15 ms | How often the bar redraws. Lower = smoother countdown, more CPU. |
| Initial `duration` (in `play_one_game`) | 1800 ms | Starting time per round. |
| Duration decrement per hit | 60 ms | How fast the game gets harder. Lower = gentler ramp. |
| Duration floor | 600 ms | Minimum time per round (cap on difficulty). |
| `ARROW_PALETTE` | 8 colors | The per-round arrow color rotation. |

## Implementation notes

- The arrows use chunky bitmaps in `ARROWS` (a dict from direction to list of `(col, row)` tuples). Each shape is ~20 pixels.
- `play_round()` returns one of: `("hit", pixels_left, dir)`, `("wrong", 0, dir)`, `("timeout", 0, dir)`, `("exit", 0, dir)`. Only "hit" continues; the others end the game.
- The flash-on-hit is intentionally subtle (two quick toggles, ~250 ms total) so it doesn't slow the pace.
- Game length scales reasonably with skill. A casual player runs ~5–10 rounds (~10–25 points). An expert sustains ~25–40 rounds (~60–99 points). Sustained 99+ is rare.

## Responsive scaling

**Feasibility: Limited — bigger pixels, not a bigger game.**

The arrow and bar already fill the 8×8 frame; rendered on a larger display they'd just be visually larger (which is fine for readability). The gameplay loop — pick a direction, react before the bar empties — doesn't gain depth from more pixels.

Things to think about: at 16×16 you could afford a thicker, more detailed arrow shape, and the timing bar could be replaced with a more elaborate visual (e.g., a shrinking ring). Cosmetic, not mechanical.
