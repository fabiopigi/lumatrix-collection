# LumenLab

A browser toolkit and a MicroPython app collection for LED-matrix kits such as the [ZHAW LUMATRIX](https://lumatrix.zhaw.ch) (Raspberry Pi Pico + 8×8 NeoPixel + 5-way joystick + slide switch). The toolkit supports a range of matrix sizes via hardware presets; the Pico apps and Hardware reference below are LUMATRIX-shaped, with [ESP32 / other targets](docs/ideas/esp32-flash-target.md) on the backlog.

The fastest way to try it: open **[lumenlab.fabs.au](https://lumenlab.fabs.au)**, paint a few pages in LumenDesigner, hit *Export → Generate app → Add to Simulator*. No Pico required.

![device](https://lumatrix.zhaw.ch)

## Web toolkit

Four browser apps live under `web-toolkit/` (Next.js). Run `cd web-toolkit && npm install && npm run dev` for local dev, or use the hosted version.

| Tool | What it does |
| --- | --- |
| **[LumenSimulator](https://lumenlab.fabs.au/simulator)** | Boot the launcher and run apps in your browser. Virtual joystick, keyboard shortcuts, mobile swipe gestures. Three render modes: flat pixels, realistic LEDs, or the word-clock letter mask. Drop in your own JS apps. |
| **[LumenDesigner](https://lumenlab.fabs.au/pixel-designer)** | Paint pixels, build multi-frame animations with per-frame timing and fade-in, save designs to a named library, share via a hash-fragment URL, export JSON / PNG, and generate runnable apps (JS + Python) from frame loops. |
| **[LumenCreate](https://lumenlab.fabs.au/create)** | Two paths to your own app, tabbed. *Pure animation*: Designer → Export → Generate, no code. *Interactive app*: hand the bundled LLM prompt to an AI chat, attach your design + a description, iterate in the simulator. |
| **[LumenFlash](https://lumenlab.fabs.au/flash)** | Browser-based Pico installer over Web Serial. Pick hardware + apps, plug your Pico into USB, click Flash. Custom Python apps (from LumenCreate or your own) slot in next to the built-ins. |

## Pico apps

`python/main.py` boots into a launcher that lets you pick from the installed apps. Center-click launches; left/right cycles through the list; hold-center for 1.5 s from anywhere inside an app brings you back.

| # | App | Type | Doc |
|---|---|---|---|
| 1 | ArrowReaction | Reaction-time game with timer | [reaction.md](docs/apps/reaction.md) |
| 2 | LetterDisplay | Serial-driven letter display (word-clock mask) | [letters.md](docs/apps/letters.md) |
| 3 | FlappyPixels | Flappy Bird with a gravity/float slide switch | [flappy.md](docs/apps/flappy.md) |
| 4 | Pong | 2-paddle Pong vs. perfect-tracking CPU | [pong.md](docs/apps/pong.md) |
| 5 | SpaceInvaders | Descending aliens, auto-firing ship, 5 weapon levels | [invaders.md](docs/apps/invaders.md) |
| 6 | Doom | 1D raycaster dungeon explorer | [doom.md](docs/apps/doom.md) |
| 7 | Breakout | Bricks, paddle, 5 levels, 3 lives | [breakout.md](docs/apps/breakout.md) |
| 8 | Snake | Edge-wrapping snake with speedup | [snake.md](docs/apps/snake.md) |
| 9 | Watch | Digital `HH:MM` clock; slide switch swaps palette | [watch.md](docs/apps/watch.md) |
| 10 | Connect4 | Two-player Connect Four on the 8×8 grid | [connect4.md](docs/apps/connect4.md) |
| 11 | DinoJump | Chrome-dino side-scroller — dodge cacti and birds | [dinojump.md](docs/apps/dinojump.md) |
| 12 | Simon Says | Copy the growing sequence of directional flashes | [simonsays.md](docs/apps/simonsays.md) |
| 13 | TicTacToe | Two-player tic-tac-toe with a directional cursor | [tictactoe.py](python/apps/tictactoe.py) |

## Getting an app onto the device

**Easiest (browser-only):** open [LumenFlash](https://lumenlab.fabs.au/flash), plug your Pico into USB, pick the apps you want, click Flash. Requires MicroPython firmware already on the Pico and a Chromium-based browser (Web Serial). Custom apps you've generated from LumenDesigner or written via LumenCreate appear in the same list alongside the built-ins.

**Manual (Thonny or similar):**

1. Copy `python/main.py` to the Pico's filesystem root.
2. Copy the contents of `python/apps/` to `/apps/` on the Pico.
3. Copy `shared/fonts.json` to the Pico's root as `_fonts.json`.
4. Reset the Pico.

To run a single app standalone (for development) without going through the launcher: open the app file in Thonny and hit *Run*. Each app's `if __name__ == "__main__":` block constructs the hardware itself.

## Repo layout

```
LumaMatrix/
├── python/                       ← MicroPython sources (deployed to the Pico)
│   ├── main.py                   ← launcher
│   └── apps/
│       ├── _screens.py           ← shared loading / game-over / end screens
│       ├── _fonts.py             ← font loader (exposes FONT_3X5 / FONT_5X8)
│       └── *.py                  ← one file per built-in app
├── shared/
│   ├── fonts.json                ← font definitions (Python + web-toolkit)
│   ├── hardware-presets.json     ← canonical display sizes
│   └── design/                   ← shared design JSON (boot animation, etc.)
├── web-toolkit/                  ← Next.js: Simulator / Designer / Create / Flash
│   └── src/
│       ├── app/                  ← per-route pages + components
│       ├── components/           ← shared header / footer
│       └── lib/                  ← simulator runtime, designer libs, pico flash
└── docs/
    ├── AUTHORING.md              ← how to write a new app by hand
    ├── pixel-designer-usage.md   ← LumenDesigner reference
    ├── llm-app-prompt.md         ← the LLM prompt LumenCreate hands out
    ├── responsive-scaling.md     ← display-size handling notes
    ├── apps/                     ← per-app documentation
    └── ideas/                    ← idea backlog (shipped / in-progress / parked)
```

## Writing a new app

Three paths, in increasing order of effort:

**1. Pure frame-loop animation — no code.** Design pages in [LumenDesigner](https://lumenlab.fabs.au/pixel-designer), set per-page duration and optional fade-in via the ⓘ button, then hit *Export → Generate app*. The generator emits both the JS (for the simulator) and the Python (for the Pico), and one click installs them into LumenSimulator or LumenFlash. See [LumenCreate's *Pure animation* tab](https://lumenlab.fabs.au/create?tab=animation) for the walkthrough.

**2. Interactive app (input, state, game logic) — LLM-assisted.** Use the [*Interactive app* tab](https://lumenlab.fabs.au/create?tab=interactive). Hand the bundled prompt to any modern LLM, attach a JSON export of your design (optional) and a one-paragraph description, iterate until happy. The AI emits both JS and Python files matching the same contracts the built-ins use.

**3. By hand.** [docs/AUTHORING.md](docs/AUTHORING.md) covers the 3-screen lifecycle (loading → app → game-over), shared modules, coordinate systems, joystick input patterns, scoring methodology, and per-app documentation requirements. Copy the closest existing app's `.py` and `.md` files as a starting point.

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

- Make sure your app follows the lifecycle in [docs/AUTHORING.md](docs/AUTHORING.md).
- Add a `docs/apps/<name>.md` covering gameplay, scoring (if applicable), and mechanics.
- Test in standalone mode (Thonny "Run") *and* through the launcher.
- Confirm hold-center-1.5 s exits cleanly from every state of your app.

Ideas that haven't been built yet live in [docs/ideas/](docs/ideas/) — feel free to pick one up.

## License

This collection is intended as educational material for the LUMATRIX kit. See individual files for any explicit copyright notices.
