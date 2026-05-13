# Watch

> 24-hour digital clock with two overlapping color layers.

## How to play

The screen shows the current time `HH:MM`. The hour digits sit in the top of the
matrix; the minute digits sit in the bottom and share two rows with the hours.
Where pixels from both layers light up, the two colors blend.

- **Right** — hour +1 (wraps 23 → 00).
- **Left** — hour −1 (wraps 00 → 23).
- **Up** — minute +1 (wraps 59 → 00, doesn't carry the hour).
- **Down** — minute −1 (wraps 00 → 59).
- **Slide switch** — toggle between palette A (orange/green) and palette B
  (blue/yellow). Live; flick it any time.
- **Hold center 1.5 s** — exit to launcher.

Hold a direction to auto-repeat (one step every ~110 ms after a short delay), so
spinning the time forward a few hours is quick.

Starting time is `12:00`. The minute advances on its own once per real minute.
After 30 s without any direction press the watch yields to the end screen — tap
to restart, hold center to exit.

## Behavior

Passive app. No score. Time progresses in real time using `ticks_ms()` from
boot; there is no RTC, so the clock starts at 12:00 every session and isn't
preserved across power cycles. User adjustments edit the displayed value
directly without resetting the underlying tick anchor — only the next minute
boundary will bump the value.

## Mechanics

The display is two layers rendered into an off-screen RGB buffer, then written
to the strip in one pass:

1. **Hour layer** — two 3×5 glyphs from `FONT_3X5`, drawn at visual
   `(x=0, y=0)` and `(x=4, y=0)` in `hour_color`.
2. **Minute layer** — two 3×5 glyphs drawn at `(x=1, y=3)` and `(x=5, y=3)` in
   `minute_color`. The minute digits are shifted one column right of the hour
   digits, which gives the overlap a deliberate, asymmetric pattern.

When a minute pixel lands on a lit hour pixel, the two colors are combined with
a saturating add (`min(a+b, 255)` per channel). For palette A this is the most
visible: orange + green produces an amber-yellow that's distinct from either
source. For palette B the overlap saturates toward white.

> Note on "multiply": the spec called for multiplied colors. A true multiplicative
> blend (`a*b/255`) on LEDs darkens the overlap into near-black, which defeats
> the visual. Saturating add matches the Pixel Designer reference and is how
> two LEDs at the same pixel physically combine.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `FRAME_MS` | 30 | Main loop tick. Lower = more responsive joystick, more CPU. |
| `IDLE_MS` | 30_000 | Inactivity before the end screen fires. |
| `REPEAT_DELAY_MS` | 380 | Hold a direction this long before auto-repeat kicks in. |
| `REPEAT_TICK_MS` | 110 | Auto-repeat interval once held. |
| `MS_PER_MINUTE` | 60_000 | Real time per displayed minute. Reduce for a fast-forward demo. |
| `BRIGHTNESS` | 0.25 | Scales the source hex colors. ~25% is the project default. |
| `PALETTE_A` | orange/green | Hour/minute colors when the slide switch is at 0. |
| `PALETTE_B` | blue/yellow | Hour/minute colors when the slide switch is at 1. |

## Implementation notes

- **Glyph layout matches the Pixel Designer reference.** The hour digits start
  at `x=0`/`x=4`, the minute digits start at `x=1`/`x=5`. That one-column
  horizontal offset is intentional; it shapes the overlap pattern in rows 3..4.
- **Time anchor.** `next_tick` is initialised to `ticks_ms() + MS_PER_MINUTE`
  and advanced by `MS_PER_MINUTE` each rollover. Adjusting the time via the
  joystick does not touch the anchor, so the next minute tick still fires at
  its original schedule — you set the *value*, not the *phase*.
- **Off-screen buffer.** Each frame is composed into a `buf` list and copied to
  `np` only at the end. Without the buffer, the blend would either flicker (if
  you cleared between layers) or always show the second layer (if you didn't).
- **Auto-repeat.** Single direction press = one step. Holding past
  `REPEAT_DELAY_MS` flips into repeat-every-`REPEAT_TICK_MS` mode. Releasing the
  direction (or switching to a different one) resets the state.
- **Slide switch is read every frame.** Toggle is live; no need to leave and
  re-enter the watch to switch palettes.

## Responsive scaling

**Feasibility: Limited — more elaborate clock face, not a bigger app.**

The four-digit `HH:MM` layout fills the 8×8 source. On a larger display you could add a seconds row, a date row, or replace the digit clock with an analog face. None of that is required — the existing rendering scaled up looks fine, just blockier.

Things to think about: the two-palette toggle (orange-green vs blue-yellow) could grow into a real palette picker. At 32×32 you have room for a settings overlay; on 8×8 you don't.
