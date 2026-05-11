# LUMATRIX collection

MicroPython apps for the [ZHAW LUMATRIX](https://lumatrix.zhaw.ch) kit — a Raspberry Pi Pico driving an 8×8 NeoPixel matrix with a 5-way joystick and a slide switch.

`main.py` boots into a launcher that lets you pick from the installed apps. Center-click launches; left/right cycles through the list; hold-center-1.5 s from anywhere inside an app brings you back.

![device](https://lumatrix.zhaw.ch)

## Apps

| # | App | Type | Doc |
|---|---|---|---|
| 1 | ArrowReaction | Reaction-time game with timer | [reaction.md](docs/apps/reaction.md) |
| 2 | LetterDisplay | Serial-driven letter display (word-clock mask) | [letters.md](docs/apps/letters.md) |
| 3 | FlappyPixels | Flappy Bird with a gravity/float switch | [flappy.md](docs/apps/flappy.md) |
| 4 | Pong | 2-paddle Pong vs. perfect-tracking CPU | [pong.md](docs/apps/pong.md) |
| 5 | SpaceInvaders | Descending aliens, auto-firing ship, 5 weapon levels | [invaders.md](docs/apps/invaders.md) |
| 6 | Doom | 1D raycaster dungeon explorer | [doom.md](docs/apps/doom.md) |
| 7 | Breakout | Bricks, paddle, 5 levels, 3 lives | [breakout.md](docs/apps/breakout.md) |
| 8 | Snake | Edge-wrapping snake with speedup | [snake.md](docs/apps/snake.md) |

## Quick start

To deploy to your LUMATRIX:

1. Copy `main.py` to the Pico's filesystem root.
2. Copy the entire `apps/` folder to the root.
3. Copy `fonts.json` to the root.
4. Reset the Pico.

The launcher boots automatically.

To run a single app standalone (for development) without going through the launcher: open the app file in Thonny and hit Run. Each app's `if __name__ == "__main__":` block constructs the hardware itself.

## Repo layout

```
LumaMatrix/
├── main.py                  ← launcher
├── fonts.json               ← font definitions (deploy to Pico root)
├── apps/
│   ├── _screens.py          ← shared loading / game-over / end screens
│   ├── _fonts.py            ← font loader, exposes FONT_3X5 / FONT_5X8
│   ├── reaction.py
│   ├── letters.py
│   ├── flappy.py
│   ├── pong.py
│   ├── invaders.py
│   ├── doom.py
│   ├── breakout.py
│   └── snake.py
└── docs/
    ├── AUTHORING.md         ← how to write a new app
    └── apps/                ← per-app documentation
        ├── reaction.md
        ├── letters.md
        ├── flappy.md
        ├── pong.md
        ├── invaders.md
        ├── doom.md
        ├── breakout.md
        └── snake.md
```

## Writing a new app

The full guide is in **[docs/AUTHORING.md](docs/AUTHORING.md)**. It covers:

- The 3-screen lifecycle (loading → app → game-over / end)
- The shared modules (`_screens.py` and `_fonts.py`)
- Coordinate systems (LED coords vs. visual coords)
- Joystick input patterns (continuous, edge-triggered, hold-to-exit)
- **Scoring methodology** — how to design a scoring curve where ~10 is reachable casually and 99 is the soft ceiling for the static score display
- Per-app documentation requirements (every new app needs a `docs/apps/<name>.md`)
- Do's and don'ts (~20 specific failure modes)
- Boilerplate templates for game-style and passive apps

If you're adding an app, read AUTHORING first, then copy the closest existing app's `.py` and `.md` files as a starting point.

## Hardware reference

| Component | GPIO | Notes |
|---|---|---|
| NeoPixel data | 19 | 64 LEDs, ws2812-compatible |
| Joystick up | 3 | active-low |
| Joystick down | 6 | active-low |
| Joystick left | 7 | active-low |
| Joystick right | 2 | active-low |
| Joystick center (click) | 8 | active-low; tap = action, hold 1.5 s = exit |
| Slide switch | 9 | toggle, 0 or 1 |

LED indexing: `index = row * 8 + col`, where row 0 is the bottom strip and row 7 is the top, col 0 is left.

## Contributing

This is a hobby project but pull requests are welcome. Before opening one:

- Make sure your app follows the lifecycle in `docs/AUTHORING.md`.
- Add a `docs/apps/<name>.md` covering gameplay, scoring (if applicable), and mechanics.
- Test in standalone mode (Thonny "Run") *and* through the launcher.
- Confirm hold-center-1.5 s exits cleanly from every state of your app.

## License

This collection is intended as educational material for the LUMATRIX kit. See individual files for any explicit copyright notices.
