# Snake

> Classic snake. Eat the food, grow, don't crash into yourself. Edges wrap.

## How to play

You control a snake that starts 3 segments long, sitting horizontally in the middle of the matrix. The snake stays stationary until you press a direction; from then on it moves automatically. Eat the red food pixel to grow by 1 segment and score +1. Crashing into your own body ends the game. Edges of the matrix wrap (top↔bottom, left↔right).

| Input | Action |
|---|---|
| Up | Move up |
| Down | Move down |
| Left | Move left (blocked at start — would be instant self-collision) |
| Right | Move right (initial direction) |
| Hold center 1.5 s | Exit to launcher |

You can't reverse 180° (a queued direction-change is rejected if it's the opposite of the current direction).

## Scoring

- **+1 per food eaten.** No bonuses.

| Score | Means |
|---|---|
| **5** | Comfortable run |
| **15** | Solid sustained play |
| **30+** | Getting tight — snake is long and fast |
| **61** | Hard cap — snake fills the entire 64-cell grid (you "win"). Triggers a green flash + score marquee. |

61 is the absolute maximum (you start at length 3, grid is 64). Reaching it triggers a special **win** state instead of a normal game-over.

## Mechanics

### Movement

- Snake is a list of `(col, row)` cells, head last.
- Each move tick: compute `new_head = ((head_col + dx) % 8, (head_row + dy) % 8)` (edge wrap via modulo).
- If `new_head` is on food → eat (grow, +1 score, spawn new food).
- If `new_head` is on the snake body (excluding the current tail, which is about to move) → game over.
- Otherwise: append `new_head`, pop tail to maintain length.

### Speed-up

- Initial move interval: `START_INTERVAL = 6` frames per move (300 ms at 50 fps).
- Every `SPEEDUP_EVERY = 5` foods eaten: interval decreases by 1 frame, floor at `MIN_INTERVAL = 2` (100 ms).
- At max speed (after 20 foods eaten), snake moves at 10 cells/sec.

### Direction queuing

- One pending direction change can be queued between moves. Subsequent direction presses overwrite the pending one **only if** they're valid (not opposite of current). Invalid presses (180° reversal) are silently ignored, preserving the previous queued direction.
- This prevents the classic "double-tap reversal" bug.

### Food

- A single food pixel appears on a random unoccupied cell.
- When eaten, immediately spawned somewhere else.
- If no free cells remain (snake fills grid): win flash + return.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Frame rate. |
| `START_INTERVAL` | 6 | Initial frames per snake move. Lower = faster start. |
| `MIN_INTERVAL` | 2 | Floor for the move interval (max speed). |
| `SPEEDUP_EVERY` | 5 | Foods eaten between speedups. |

## Implementation notes

- The snake is stored both as a list (for ordered iteration) and a set (for O(1) collision lookup). Both are kept in sync.
- Head color is bright cyan-green (visually distinct from the body's darker green) so the player always knows which end is which.
- The "can't 180° reverse" rule is enforced when accepting input, not when applying it. Pressing the reverse direction simply doesn't change the queued direction.
- Win condition (length = 64) is checked when `spawn_food()` returns `None`. The win flash is a 5×green strobe.
- The game starts with `current_dir = (1, 0)` (right) but `started = False`, so the snake doesn't actually move until the user presses any valid direction. This gives the player a moment to orient.
