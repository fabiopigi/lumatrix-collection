# LetterDisplay

> Type letters on the Mac, see them on the matrix. Lowercase lights the corresponding cell on the word-clock mask; uppercase renders the full 8×8 letter.

## How to play

This is the only app that takes input over USB serial instead of the joystick. To use it:

1. Disconnect Thonny from the Pico (it holds the serial port).
2. Find the serial device: `ls /dev/tty.usbmodem*` on macOS.
3. Open a serial terminal: `screen /dev/tty.usbmodemXXXX 115200`.
4. Type letters.

| Key typed | What happens |
|---|---|
| Lowercase `a`–`z` | Lights up one LED on the LUMATRIX word-clock letter mask. Each repeat of the same letter cycles to the next instance of that letter on the mask. |
| Uppercase `A`–`Z` | Renders the full 8×8 (5×8 font) version of the letter, centered. |
| Any other character | Ignored. |
| `Ctrl-C` / `Ctrl-D` | Exits to the launcher (so Thonny can reconnect). |

Each typed letter holds for 1 second, then fades out over 300 ms.

| Input | Action |
|---|---|
| Type a letter (serial) | Display it |
| Hold center 1.5 s | Exit to launcher |
| 10 s of no input | Auto-show end screen |

## Behavior (no score)

This is a passive app — there's no win or lose state, no points, no game over. After 10 s of no serial input (and no joystick), `screens.end_screen()` takes over until the user taps a direction (restarts the session) or holds center (exits).

## Mechanics

- Each typed character is colored by `letter_color(ch)` — a hue derived from the character's position in the alphabet, so every letter has its own color.
- The word-clock mask is hardcoded as `MASK`, a dict from each lowercase letter to a list of LED indices. The mask spells: `ZATWENTY / HQUARTER / AHALFIVE / WTPASTOR / FIVEIGHT / SIXTHREE / TWELEVEN / FOURNINE` (top to bottom).
- `CURSOR` tracks which instance to use next for each lowercase letter. Reset on `run()` so each session starts fresh.
- Uppercase letters use `FONT_5X8` (from `apps/fonts.py`). Glyph is 5 cols wide, rendered at cols 1..5; rows fill the matrix top to bottom, with the 5×8 font's blank baseline at row 0 giving a natural 1px bottom margin.
- Fading uses a `scale` multiplier on each pixel's stored RGB. Linear fade from 1.0 to 0.0 over `FADE_MS`.

## Tunables

| Constant | Default | Effect |
|---|---|---|
| `HOLD_MS` (inside `show_letters`) | 1000 ms | How long a letter stays at full brightness. |
| `FADE_MS` (inside `show_letters`) | 300 ms | How long the fade-out takes. |
| `IDLE_MS` | 10 000 ms | Inactivity timeout that triggers the end screen. |

## Implementation notes

- Non-blocking serial read via `select.poll()`. `sys.stdin.read(1)` is called only when `poll.poll(0)` reports input is available, so the loop isn't blocked.
- Explicit Ctrl-C / Ctrl-D handling: the byte 0x03 gets swallowed by `sys.stdin.read(1)` instead of triggering `KeyboardInterrupt` like it normally would, so this app has to check for it manually and return cleanly.
- The mask is small (20 unique lowercase letters cover all 64 LEDs). 6 letters never appear: `b c d j k m`. Typing those does nothing for the lowercase variant; the uppercase variant still works because it uses the font.
- This is the only app in the collection that connects to serial — it expects Thonny to be **disconnected**. If Thonny is connected, the bytes go to Thonny instead of the running script.

## Responsive scaling

**Feasibility: No — bound to the LUMATRIX 8×8 word-clock layout.**

The whole point of this app is to drive the physical word-clock mask cut into the LUMATRIX faceplate, which is exactly 8×8 with specific letter positions per LED. The MASK constant maps LED indices to letters in that layout. A different display size has no corresponding mask.

If you want a Letters-style app on a larger display, the right move is a separate app with its own mask layout, not generalising this one.
