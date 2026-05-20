# Letter mask generator (separate tool)

**Status:** raw idea
**Tags:** web-toolkit, letter-mask, wordclock, generator, svg, fabrication

## What

A separate app in the toolkit — not part of LumenDesigner — that **generates** letter masks: arrange a set of phrases / words / symbols on a grid so each phrase can be expressed by lighting contiguous cells. Inputs include grid size, required tokens (with weights), alphabet / character set, and direction rules. Outputs the grid (drop-in for the designer's letter mask field), the phrase → cells mapping (drives the device app), and an **SVG with letter paths** suitable for fabrication on a laser cutter, Cricut, or laser-printed-on-transparency mask.

## Why

Today's letter mask is a free-form textarea — you type characters per cell. That's *fine* for using the shipped English LUMATRIX word clock, but it's a real obstacle for anything else:

- A German, French, Spanish, Italian, etc. word clock means hand-solving a packing puzzle.
- A custom phrase set ("Wordle-style", "MEETING / FOCUS / LUNCH / AFK" status board, sports scoreboard, etc.) requires the same hand-solve.
- A Wordle grid, emoji status, or stylized layout all face the same friction.

It's a constraint-satisfaction problem disguised as a textarea. Once the *generator* exists, this whole class of designs becomes a config screen, and SVG export means anyone with a laser cutter or Cricut can fabricate a physical mask — no more "how do I get crisp letter cutouts" being the bottleneck.

## Sketch

Conceptually two pieces: a layout generator, and an SVG exporter.

**Inputs:**

- Grid size (W × H — 8×8 by default, configurable).
- A list of required tokens (words / symbols / emoji), each tagged with a weight or hard-required flag.
- Optional: phrase groups (for word clocks, each time phrase is a *set* of tokens that must light together — e.g. `HALF PAST FIVE` = three tokens that need to coexist on the grid in a sane reading order).
- Alphabet / character set (Latin, Greek, Cyrillic, emoji subset).
- Direction rules: horizontal-only (default), allow vertical, allow diagonal.

**Layout algorithm (rough thinking):**

- Start from a random or seeded placement.
- Score = weighted count of required tokens that can be expressed as contiguous strokes under the direction rules.
- Local search: swap letters, shift placements, simulated-annealing-style.
- Stop when all hard-required tokens fit; keep optimizing weighted score until a time budget runs out.
- For very constrained inputs (lots of phrases, small grid), surface a "doesn't fit" error with the offending phrases highlighted — better than silently dropping coverage.

**Outputs:**

- The grid as text — same format the LumenDesigner letter-mask textarea expects, so it pastes directly.
- A **phrase → cells** mapping (JSON), which is what an on-device app actually needs to light the right cells for a given time / status.
- An **SVG** with each cell drawn as a fixed-size square and the letter rendered as path data, so the file is resolution-independent and ready for vector tooling. Optional cell outlines for alignment.

**SVG / fabrication thoughts:**

- Default to **stencil-safe glyphs** so cut shapes don't fall out (the inner counter of `O`, `A`, `D`, `Q`, `R` etc. needs bridges). Offer a toggle for "printed mask" (any font, no bridges) vs. "laser cut" (stencil bridges enforced).
- Embed font glyphs as paths (`<path>` data) rather than `<text>` — every cutter / printer renders the same thing, no font dependency.
- Include kerf offset as a parameter for laser cutters.
- Suggest a few open-license fonts as defaults (a clean sans for printing, a stencil font for cutting).

## Open questions

- **Where does this app live?** A new route in `web-toolkit/src/app/letter-mask/` next to `pixel-designer` and `simulator`? Linked to from the designer's config modal as "Need a custom mask? Open the generator"?
- **Algorithm choice:** annealing? Genetic? Constraint solver (e.g. backtracking with MRV heuristic)? For an 8×8 grid the search space is small enough that something simple-and-correct beats clever-and-fragile.
- **Phrase grouping semantics:** for word clocks the *order* of tokens within a phrase matters (you want `HALF PAST FIVE` readable left-to-right / top-to-bottom). Encode reading order as a constraint, or accept any contiguous arrangement and trust the user to verify?
- **Language presets:** ship preset phrase lists for the obvious word-clock languages? Or keep it strictly bring-your-own-phrases?
- **Emoji / wide-character cells:** technically each cell holds one Unicode code point, but emoji rendering is messy in SVG and harder to fabricate physically. Defer? Or support with caveats?
- **Round-trip with the designer:** "Open in LumenDesigner" → pre-fills the letter mask field, switches to Letter mask mode, ready to design.
- **Phrase → cells mapping consumption:** does [[generate-app-from-design]] grow a "word clock" emitter that takes this mapping plus a time function and outputs a runnable app? Probably yes — that turns this into the front half of a full word-clock authoring pipeline.
- **Validation against the shipped LUMATRIX preset:** feed in the English phrase set used by `FOURNINE / TWELEVEN / …` and confirm the generator finds the shipped layout (or a working equivalent). Good regression test.
- **Physical fabrication docs:** alongside the SVG, ship a short guide ("What to do with this file") covering Cricut, laser cutter, and laser-printer-on-transparency workflows.

## Notes

- Today's letter mask infra: `web-toolkit/src/lib/pixel-designer/config.ts` plus the textarea in `pixel-designer/_components/config-modal.tsx`. The data model doesn't need to change — the generator just produces a string that fills the same field.
- Reference: the existing LUMATRIX word-clock preset (`FOURNINE / TWELEVEN / SIXTHREE / FIVEIGHT / WTPASTOR / AHALFIVE / HQUARTER / ZATWENTY`) — documented in `docs/pixel-designer-usage.md`.
- Strong pairing with [[generate-app-from-design]]: the phrase→cells mapping is the core of a word-clock app; if codegen can consume it, the whole pipeline becomes "pick phrases → generate mask → generate app → flash".
- The fabrication angle (SVG → physical mask) is a separate kind of value from the on-device clock — even people without a LUMATRIX could use the tool just to design and cut their own analog stencil. Nice broadening of the audience.
