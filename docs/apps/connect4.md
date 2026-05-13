# Connect 4

> Two-player turn-based drop game. First to line up four pieces (horizontal, vertical, or diagonal) wins.

## How to play

Red moves first. A dim red marker sits on the top row to show where the next piece will fall.

- **Joystick left / right** — slide the marker along the top row.
- **Tap center** — drop a piece into the column under the marker. It falls to the lowest empty cell.
- The turn then passes to Yellow; the marker switches to dim yellow.
- **Hold center 1.5 s** — exit to the launcher at any time.

The first player to get **4 in a row** (horizontal, vertical, or diagonal) wins; the winning line pulses in the winner's color before the end screen appears. If the board fills with no winner, the round ends in a draw.

After the end screen: tap any direction to play another round (Red starts again), hold center to leave.

## Mechanics

The playing field is **8 columns × 7 rows**. The 8th row (LED row 7, the topmost) is reserved for the drop marker — pieces never rest there. Pieces drop column-major: a tap places the active player's piece in the lowest empty cell of the column under the marker.

Each drop animates: the piece slides from just below the marker down to its landing row at `FALL_STEP_MS` per step. After the piece lands, `winning_line()` checks the four line directions through the new piece for a run of ≥4 same-colored cells. A win triggers `pulse_line()` (the winning cells fade between full and quarter brightness for `PULSE_CYCLES` cycles) before control returns to the lifecycle.

A full column is a no-op — pressing center while the marker is over a full column does nothing and does not pass the turn.

`screens.end_screen()` handles the post-round UI for both wins and draws. There's no numeric score because the natural outcome is a winner, not a count — the pulsing winning line is the in-game signal of who took the round.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 50 | Idle frame rate cap during marker movement. |
| `FALL_STEP_MS` | 70 | Time per row during the drop animation. Lower = snappier fall. |
| `PULSE_CYCLES` | 3 | Number of dim→bright cycles for the winning line. |
| `PULSE_HALF_MS` | 220 | Half-cycle duration for the winning-line pulse. |
| `DRAW_HOLD_MS` | 1200 | How long the full board stays visible after a draw before the end screen. |

## Implementation notes

The marker (cursor) lives on LED row 7 only. Internally `column_top()` searches rows 0..6 — a piece can land on row 6 at the top of a column stack, never on row 7. This keeps the marker visually unambiguous: the dim color is always exactly one cell, never overlapping a placed piece.

Center is handled on **release**, not on press, so it can coexist with `screens.check_exit()`'s hold-center-to-exit semantic: if the press lasted < `EXIT_HOLD_MS` it's treated as a drop tap; longer presses are consumed by `check_exit` and the round returns `None`. Left and right are edge-triggered (one move per tap) — a held direction does not auto-repeat.

The color palette mirrors the Pixel Designer source (#ff0000, #ffff00, #800000) pre-dimmed to ~25% at module import: placed Red `(64, 0, 0)`, placed Yellow `(64, 64, 0)`, cursor Red `(32, 0, 0)`, cursor Yellow `(32, 32, 0)`. The pulse's "dim" state is a further /4 of the placed color, so the contrast stays inside the same hue and the winning line reads as a single throbbing element rather than a color change.

`winning_line()` walks forward and backward from the just-placed piece in each of the four line directions, collecting same-colored cells. Returning the full collected run (which can exceed 4 on a 5-in-a-row) lets the pulse highlight the whole line rather than an arbitrary 4-cell slice.
