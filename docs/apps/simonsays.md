# Simon Says

> Classic memory game: watch the growing flash sequence, repeat it with the joystick.

## How to play

Four arrows sit dimly on the screen, one in each direction:

| Panel | Position | Press |
|---|---|---|
| Red | left edge | Joystick **left** |
| Yellow | right edge | Joystick **right** |
| Green | top edge | Joystick **up** |
| Blue | bottom edge | Joystick **down** |

Each round one panel (or two, then three, ...) flashes bright in order. After the playback ends, repeat the same sequence by pushing the joystick in the matching directions. Survive as many rounds as you can.

- **Joystick direction** matches panel position.
- **Hold center 1.5 s** to exit to the launcher.
- **3 s timeout** between presses; missing the deadline ends the game.
- One wrong direction ends the game.

## Scoring

Score = number of rounds fully completed before the mistake. Failing the very first prompt scores 0; completing 5 rounds and missing the 6th scores 5. The pre-generated pattern is 32 letters long, so the maximum reachable score is 32.

Typical scores: 4–10 for casual play, 12–18 for focused play, 20+ is expert territory. The 32-round cap keeps the score under the marquee threshold even on a perfect run.

## Mechanics

At the start of each game, a random 32-letter pattern is generated from the alphabet `R G B Y` (e.g. `"GRRGYBBYRGBYBBYYY..."`). Round *N* plays back the first *N* letters at `FLASH_MS` per flash with `GAP_MS` between them. After playback, the player must press the matching direction for each letter in order. A correct press flashes the corresponding panel for `PRESS_FLASH_MS` as feedback. A wrong press or a press that exceeds `INPUT_TIMEOUT_MS` from the previous one ends the game.

Playback timing is constant across all rounds — the difficulty ramp is purely memory length.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `PATTERN_LEN` | 32 | Maximum rounds (also the score ceiling). |
| `FLASH_MS` | 500 | Panel-on duration during playback. Lower = harder to memorize. |
| `GAP_MS` | 200 | Pause between flashes during playback. Lower = harder to distinguish repeats. |
| `PRE_PLAYBACK_MS` | 700 | "Get ready" pause before each round's playback starts. |
| `PRESS_FLASH_MS` | 150 | Length of feedback flash on a correct press. |
| `INPUT_TIMEOUT_MS` | 3000 | Per-press timeout during the echo phase. |
| `ROUND_CLEAR_MS` | 400 | Pause after completing a round before the next playback. |
| `BRIGHT_SCALE` | 0.5 | Brightness multiplier for the active panel. |
| `DIM_SCALE` | 0.06 | Brightness multiplier for idle panels (faint outline). |

## Implementation notes

Panel pixel positions come from a Pixel Designer JSON of the four colored arrow shapes. The design's hex colors are pre-scaled at module import into `bright` and `dim` RGB tuples per panel — no per-frame hex parsing.

`echo()` waits for **all four directional pins to be released** before reading each next press. Without this, holding a direction across two slots in the sequence would register as two presses instantly. Hold-center is checked inside that wait too, so the player can always bail mid-input.

The random pattern is generated once per game (32 letters). Losing on round 5 and restarting starts a fresh pattern, not a re-roll of the failed letter — that's deliberate; the player is always memorizing a fresh sequence.

`screens.game_over_screen(score)` handles the red flash + score render; the app itself never draws end-of-session UI.
