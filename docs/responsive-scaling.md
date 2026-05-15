# Responsive scaling per app

How each LumenSimulator app currently behaves when the display size leaves the LUMATRIX-native 8×8. The simulator's runtime supports three rendering strategies; each app sits in one of them today.

## The three categories

| Category | What it means | How the app code looks |
|---|---|---|
| **Pixel-matching upscale** | The app is unchanged — writes to the 8×8 LUMATRIX source buffer. The simulator scales that source up by the largest integer factor that fits the configured display and centres it. Non-square aspect ratios get black bars on the long sides. | `export const RESPONSIVE = false` (or omitted). Hardcoded `8`s throughout. |
| **UI upscaling** | The app opts in to the responsive path and renders to a `W × H` buffer that matches the actual display. UI elements either stay logical-size 1 cell (e.g. snake segments) or scale proportionally with the canvas (e.g. paddle length). The drawing **shapes** stay the same — what changes is *where* and *how big* they're drawn. | `RESPONSIVE = true`. Reads `display.width / display.height`, uses them in coordinate math and sprite sizing. |
| **Drawing upscaling** | The app renders its visuals from real math (raycaster, ray-based sprite projection, gradients). Higher resolution = more rays / finer projection / smoother lighting. The output is qualitatively different at 32×32 than at 8×8, not just bigger. | `RESPONSIVE = true`. Drawing routines do per-display-pixel computation rather than mapping fixed shapes onto cells. |

All three categories can coexist — every app is independent. Pixel-matching is the default because it requires zero per-app work; UI upscaling is the typical "good fit" for grid games; drawing upscaling is for apps that have something to gain from the extra resolution.

## Per-app classification

| App | Category | Source convention | Proposed UI change | Notes |
|---|---|---|---|---|
| **ArrowReaction** | UI upscaling | Responsive |  | Arrow uses the 8×8 source design painted as `s × s` blocks centred on the display; the timing bar uses the full display width and the per-hit reward scales with the bar length. |
| **Connect4** | Pixel-matching | 8×8 only |  | Board is 8 cols × 7 rows with a cursor lane on row 7 — currently 8×8 only. Could be a UI upscale: cols / rows would parameterise on display. |
| **Pong** | UI upscaling | Responsive |  | Field is `W × H`. Paddle length scales with `H` (`max(2, floor(H/4))`). CPU has a per-frame speed cap so wider fields are beatable. Ball physics in floats. |
| **Breakout** | Pixel-matching | 8×8 only |  | Brick layouts are fixed `8×7` string arrays. Could be a UI upscale with parametric layouts. |
| **Simon Says** | Pixel-matching | 8×8 only |  | The four corner panels are hardcoded LED-index lists, so the layout is bound to 8×8. UI upscaling would mean regenerating the panel positions per display. |
| **DinoJump** | Pixel-matching | 8×8 only |  | Track is fixed-length (8 cols), ground row is hardcoded at visual y=7. A UI upscale would let the dino column and ground row scale with display height. |
| **Snake** | UI upscaling | Responsive |  | Grid is `W × H`. Each snake segment + the food stays 1 cell. Wrap math uses `% W` / `% H`. Win condition (length === `W·H`) scales naturally. |
| **FlappyPixels** | Pixel-matching | 8×8 only |  | Wall scroll is column-by-column with a fixed gap size. Could be UI upscale with `GAP_SIZE` proportional to `H`. |
| **SpaceInvaders** | Pixel-matching | 8×8 only |  | Alien spawn row, ship row, bullet path are all hardcoded to 8×8. UI upscale would scale alien_step with `H` and allow wider waves. |
| **Doom** | Drawing upscaling | Responsive |  | Fires `W` rays per frame and projects each into a column with a real float-valued wall height; sprite sizes are derived from `min(W, H) / (dist + 0.5)`. Sky / floor gradient is rebuilt per row of the display. The output at 32×32 has visibly smoother walls than at 8×8 — not just bigger pixels. |
| **Watch** | Pixel-matching | 8×8 only |  | Two 2-digit clock blocks placed via hardcoded `(x, y)` offsets. A UI upscale could centre the digits on the actual display; a drawing upscale (e.g. analog face with sub-pixel hands) would be a complete redesign. |

## Cross-reference: per-app docs

Each app's own `docs/apps/<name>.md` has a **Responsive scaling** section noting feasibility and what would change in practice. This document is the engine-level overview; the per-app docs are where the gameplay nuance lives.

## What "Drawing upscaling" actually unlocks (Doom case study)

Doom is the only app currently in the drawing-upscaling tier, so it's the clearest illustration of what the category buys you:

- **Walls.** At 8×8, the wall height is one of 8 integer values; small player movements can suddenly jump a wall from row 4 to row 3. At 32×32, the heights step through 32 values and movement feels continuous.
- **FOV resolution.** 8 rays at 8×8 means each "column" of the screen represents 1/8 of the FOV — chunky turning. 32 rays at 32×32 means each ray covers 1/32 of the FOV — turning is smooth, walls don't slide as a single chunk.
- **Sprites.** Enemies and projectiles use a `0.75 · min(W, H) / (dist + 0.5)` size formula. On 8×8 a far enemy is 1 cell, a close one is ~5. On 32×32 the same far enemy is ~3 cells (still recognisable), a close one is ~22 cells (commanding screen presence).
- **Gradient.** The sky / floor gradient steps through `H` rows. At 8×8 it's effectively two bands; at 32×32 it's a real fade.

The cost: per-frame work scales with `W × H` rather than 64. At 32×32 that's 16× the cell writes. For Doom this is still fine — the original alpha-blending attempt was abandoned for performance reasons (see [the per-app doc](apps/doom.md#responsive-scaling) for context), but the integer-pixel version runs well.

## How to move an app up a tier

The migration cost grows roughly with the gap you cross:

- **Pixel-matching → UI upscaling** is the cheap path for the next round of porting. Pattern (see `snake.ts` for the template):
  1. Add `export const RESPONSIVE = true`.
  2. Bind `W = display?.width ?? 8` and `H = display?.height ?? 8` inside `run()`.
  3. Replace every hardcoded `8` with `W` or `H`.
  4. Replace `np[row * 8 + col]` writes with `np[row * W + col]`.
  5. Pass the launcher's `screensNp` (4th `run()` arg) to `screens.init()` so the loading / game-over screens keep rendering at the LUMATRIX 8×8 scale-up.
  6. Audit any hardcoded shape arrays — for Breakout that means rewriting the level layouts as functions of `(W, H)` instead of static `"########"` strings.
- **UI upscaling → Drawing upscaling** is a much bigger lift and only makes sense for apps with real procedural drawing potential (raycasters, physics-driven visuals, particle systems). Most simple grid games don't benefit.

## Summary

- 7 apps are pixel-matching (the default).
- 3 are UI upscaling (Snake / Pong / ArrowReaction).
- 1 is drawing upscaling (Doom).

The next batch of conversions that would have the highest impact-per-effort:
- **Breakout** → UI upscaling (the level system is the only stateful bit to parameterise).
- **SpaceInvaders** → UI upscaling (the wave / fire / spawn timing would benefit from a taller display).
- **DinoJump** → UI upscaling (longer track at higher widths is meaningful new gameplay).
- **FlappyPixels** → UI upscaling (`GAP_SIZE` proportional to `H` makes a taller display fairer; wider gives more reaction time).

Connect4, Simon Says, and Watch are good 8×8 designs that don't gain much from larger displays — leaving them on pixel-matching is fine and the scaled-up output reads correctly.
