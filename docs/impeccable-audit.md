# LumenLab — Impeccable Audit

_Generated 2026-05-20 via `/impeccable audit` against the `web-toolkit/` Next.js app at commit `e08008b`._

No PRODUCT.md / DESIGN.md were present at audit time. Register was inferred as **product** (tool UI for Simulator / Designer / Flash / Create, plus a brand-ish landing page). Findings are grounded in code reads, not heuristics over `package.json` or screenshots.

## Audit Health Score

| # | Dimension | Score | Key finding |
|---|---|---|---|
| 1 | Accessibility | 2 | `aria-hidden` site nav still has tab-focusable `<Link>`s; modals are dialog-shaped but have no role / focus-trap |
| 2 | Performance | 3 | Healthy. Box-shadow + transition on every cell is bounded; no layout thrash |
| 3 | Theming | 2 | Token system exists in `globals.css` but most components bypass it with raw `#xxxxxx` literals |
| 4 | Responsive Design | 1 | Simulator and Designer use **zero** `sm:` / `md:` / `lg:` breakpoints — desktop-only by accident, not design |
| 5 | Anti-Patterns | 2 | Gradient text + bounce easing in the Flash success state; em dashes peppered through marketing copy |
| **Total** | | **10/20** | **Acceptable (significant work needed)** |

## Anti-patterns verdict — fails, but quietly

This does **not** look AI-generated at the system level. The Bitcount-Grid display font, the `»` rotating hamburger, the per-tool `Lumen<accent>X</accent>` wordmark pattern, the OLED-glow cell shadows, and the deliberately tiny mono caption text are all distinctive human choices.

Three specific shared-law violations break through:

- **Gradient text** — `web-toolkit/src/app/globals.css:272` (`.lf-success-title`) clips a `linear-gradient(135deg, #6cf, #80ffc0, #ffc66c)` to text. Decorative; banned.
- **Bounce easing** — same block, `cubic-bezier(0.34, 1.56, 0.64, 1)` on `lf-success-pop`. The "back" overshoot is the elastic curve the laws explicitly call out.
- **Em dashes in copy** — `app/page.tsx`, `app/layout.tsx` metadata, and `app/create/page.tsx` (both `en` and `de` blocks) are studded with `—`. Multiple violations per page.

## Executive summary

- **10 / 20 — Acceptable.** Strong identity, weak hygiene.
- Issue counts: **3 P1**, **6 P2**, **3 P3**, plus the 3 anti-pattern hits above.
- Top issues:
  1. Site-nav `<Link>`s are tab-reachable while the menu is closed (`site-header.tsx:71-93`). Keyboard users tab into invisible items.
  2. Designer / Simulator have no responsive breakpoints. Fixed `w-14` + grid + `w-[340px]` sidebar in the Designer; fixed-px joystick grid in the Simulator.
  3. Design tokens are declared but ignored. ~30+ raw hex literals across components (`#22222a`, `#1d2937`, `#4a90e2`, `#0a0a0c`, etc.) for what the token system already names (`panel-2`, `edge`, `accent`, `background`).

## Detailed findings

### P1 — Major

#### [P1] Tab focus leaks into closed site nav

- **Location:** `web-toolkit/src/components/site-header.tsx:71-93`
- **Category:** Accessibility
- **Impact:** Keyboard users tabbing through the page land on 5 invisible `<Link>` items even when the menu is closed. `aria-hidden={!open}` + `pointer-events-none` doesn't remove links from the tab order.
- **WCAG:** 2.4.3 Focus Order (A), 4.1.2 Name / Role / Value (A)
- **Fix:** Add `tabIndex={open ? 0 : -1}` to each `<Link>`, or `inert` on the `<nav>` (modern, well-supported).
- **Command:** `/impeccable harden`

#### [P1] Modals are not announced as dialogs

- **Location:** `web-toolkit/src/app/designer/_components/modal-shell.tsx` (used by every designer modal + flash-wizard's ErrorPanel-shaped dialogs)
- **Category:** Accessibility
- **Impact:** No `role="dialog"`, no `aria-modal="true"`, no focus trap, no focus return on close. Screen-reader users get no announcement; keyboard users can tab out into the background page.
- **WCAG:** 4.1.2 (A), 2.4.3 (A)
- **Fix:** Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at a heading inside, an initial-focus target, and a focus trap (`useEffect` that returns focus to the previously-focused element on unmount).
- **Command:** `/impeccable harden`

#### [P1] Simulator and Designer are desktop-only by accident

- **Location:** `web-toolkit/src/app/simulator/_components/simulator.tsx:259-331` and `web-toolkit/src/app/designer/_components/designer.tsx:1636-1828`. `grep` for `sm:|md:|lg:|xl:` in either tree returns zero matches.
- **Category:** Responsive
- **Impact:** At ≤900 px the Designer's `w-14` toolbar + scrolling canvas + `w-[340px]` sidepanel collide; the Simulator's `flex items-start gap-8` with three children and a fixed `w-48` rail overflows. The joystick grid is hard-coded `grid-template-columns: repeat(3, 56px)`.
- **Fix:** If desktop-only is the intent (Web Serial is Chromium-desktop anyway), at least gate with a "Use a desktop browser" notice ≤768 px. Otherwise: stack the Simulator panels vertically below `md`, collapse the Designer sidepanel into a sheet / drawer below `lg`, switch the joystick to `min(56px, calc((100vw - 4rem) / 5))`.
- **Command:** `/impeccable adapt`

### P2 — Minor

#### [P2] Hard-coded hex literals bypass the token system

- **Location:** Pervasive. `toolbar.tsx`, `side-panel.tsx`, `designer.tsx`, `modal-shell.tsx`, every flash step, plus inline accent `#4a90e2` (which is **different** from the declared `--accent: #6cf` in `globals.css:9`).
- **Category:** Theming
- **Impact:** Two systems running in parallel. The "primary CTA" is `#4a90e2` everywhere; the token-system accent is `#6cf`. Changing brand color requires touching ~30 files.
- **Fix:** Decide one accent. Add `--accent-cta`, `--surface-1`, `--surface-2`, `--border-default`, `--border-strong`, `--text-subtle`, `--text-faint` to `globals.css`. Replace literals with token classes (`bg-panel`, `text-muted`) and add the missing tones.
- **Command:** `/impeccable extract`

#### [P2] Multiple text colors fail WCAG AA contrast

- **Location:** `side-panel.tsx` `Tip` uses `text-[#666]` (~3:1 on `#0e0e10`), `text-[#555]` (~2:1) for empty states and italics; `flash-wizard.tsx:188` Stepper uses `text-muted/60` for "todo" steps; `designer.tsx:1715` `text-[#aaa] italic` is fine but `text-[#777]` for status row fails.
- **Category:** Accessibility
- **Impact:** Status text, hints, and inactive states are functionally invisible to anyone with imperfect vision in a bright room.
- **WCAG:** 1.4.3 Contrast (Minimum) (AA)
- **Fix:** Raise the floor to `~#a0a0a8` (~5:1). Reserve `#666` / `#555` for decorative dividers only.
- **Command:** `/impeccable colorize`

#### [P2] Touch targets under 44 × 44 in the Designer

- **Location:** `designer.tsx:1693-1712` (page row's `w-6 h-6` info + delete buttons = 24 × 24); `toolbar.tsx:81` tool buttons `w-11 h-10` (44 × 40, short on height); `site-header.tsx:86` nav links `py-2` ≈ 33 px tall.
- **Category:** Accessibility / Responsive
- **Impact:** WCAG 2.5.5 (AAA) recommends 44 × 44; WCAG 2.5.8 (AA, 2.2) mandates 24 × 24 with spacing. The page-row buttons hit 24 × 24 only with no surrounding spacing buffer.
- **Fix:** Bump info / delete to `w-8 h-8` with `gap-1` between. Tool buttons to `w-11 h-11`. Nav links to `py-2.5`.
- **Command:** `/impeccable adapt`

#### [P2] No `prefers-reduced-motion` support

- **Location:** `globals.css:235-294` (confetti, success pop) and the transform-based menu animation in `site-header.tsx:74-77`.
- **Category:** Accessibility
- **Impact:** Vestibular-sensitive users get a confetti shower they can't opt out of.
- **Fix:** Wrap `lf-confetti-fall` and `lf-success-pop` keyframes in `@media (prefers-reduced-motion: no-preference)`; provide a 0-duration fallback.
- **Command:** `/impeccable harden`

#### [P2] Form inputs labeled only by placeholder

- **Location:** `side-panel.tsx:104` (color hex), `side-panel.tsx:159` (text-to-stamp), `side-panel.tsx:373` (annotation draft), `designer.tsx:1685` (page label).
- **Category:** Accessibility
- **Impact:** Screen readers announce placeholder once on first focus; if cleared, the field has no name. WCAG 3.3.2 Labels (A).
- **Fix:** Add `aria-label` matching the visible context, or visible `<label>` siblings.
- **Command:** `/impeccable harden`

#### [P2] Em dashes in user-facing copy

- **Location:** `app/page.tsx:11`, `app/layout.tsx:18` (metadata), `app/create/page.tsx` (English + German blocks, many).
- **Category:** Anti-pattern
- **Impact:** Per the shared design laws, em dashes are banned in this skill's copy register. They also fight against the otherwise punchy, technical brand voice.
- **Fix:** Replace with commas, colons, periods, or parentheses. `"Pixel-art tools for LED matrices: design, animate, simulate, flash to your board."`
- **Command:** `/impeccable clarify`

### P3 — Polish

#### [P3] Gradient text + bounce easing in Flash success

- **Location:** `globals.css:272-293`
- **Category:** Anti-pattern
- **Fix:** Solid color (`text-accent`), weight + scale for emphasis. Replace `cubic-bezier(0.34, 1.56, 0.64, 1)` with `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo). Keep the celebration; lose the SaaS-cliché execution.
- **Command:** `/impeccable distill`

#### [P3] Home page is a 4-identical-card grid

- **Location:** `app/page.tsx:14-35`
- **Category:** Anti-pattern (borderline — the 4 tools are genuinely peer-equal)
- **Fix:** Differentiate at least the primary card (Simulator, the first thing a new visitor should hit). A single 2-row layout with the simulator taking a wider span; the other three as smaller siblings underneath. Or visualize each tool with a tiny pixel-art glyph that matches its function.
- **Command:** `/impeccable bolder`

#### [P3] Sidepanel forces a scrollbar regardless of content

- **Location:** `side-panel.tsx:59` `overflow-y-scroll` (vs `overflow-y-auto`)
- **Category:** Polish
- **Impact:** A recent commit pinned this on purpose (`796a3ab Designer: pin the right-side panel's scrollbar`) to keep the layout stable across content changes. On macOS the track hides when idle so this is mostly invisible; on Windows / Linux the visible empty track adds noise. Acceptable trade-off; consider `scrollbar-gutter: stable` for the same stability without the always-visible track.

## Patterns & systemic issues

- **Two-accent problem.** `#6cf` is the declared token. `#4a90e2` is what the CTA buttons (`+ Add page`, `+ Add variant`, etc.) actually use. The two never appear together on screen, so it's not visually broken, but it means there's no single source of truth for "primary blue."
- **Hex inflation.** Every component invents its own gray. `#0a0a0c`, `#131316`, `#16161a`, `#18181d`, `#1a1a1f`, `#1c1c22`, `#1f1f25`, `#22222a`, `#25252b`, `#2a2a30`, `#2c2c34`, `#2f2f37`, `#3a3a42` are all in active use. There are 4 distinct "panel background" colors and 5 distinct "subtle border" colors.
- **Responsive design exists only on landing-style pages.** `home`, `create`, and `flash`-wizard scaffolding use `sm:`. Anything that opens an actual tool surface ignores breakpoints entirely.
- **Modals share `ModalShell` — fix it once and every modal improves.** Same for the missing `prefers-reduced-motion`: fixing the two keyframe blocks in `globals.css` covers the whole site.

## Positive findings

- **Distinctive identity.** Bitcount-Grid-Double display font + the `Lumen<accent>X</accent>` mark + the rotating `»` hamburger + the OLED-glow cells form a coherent voice that isn't trying to look like Linear or Vercel. The category-reflex test passes: this doesn't look like "AI-built dev tool."
- **Real keyboard shortcuts in the Designer** (`P` / `E` / `F` / `I` / `L` / `R` / `O` / `S` / `T` / `M` / `X` + `⌘Z` / `⌘⇧Z` / `⌘⌫`) with input-focus guards. Rare to find this thought-through in a hobby project.
- **Input focus indicators are intentional.** Text inputs use `outline-none focus:border-[#4a90e2]` rather than dropping the indicator entirely.
- **Joystick pad uses 56 px hit targets and supports both pointer + touch events** with proper `preventDefault` on touch.
- **Hydration patterns are correct.** `setState` in `useEffect` for localStorage-backed values is the right shape, and the codebase comments call out why: server / client render stay identical.
- **Token-aware where it matters.** `app/page.tsx`, `flash-wizard.tsx`, `site-header.tsx`, `site-footer.tsx` use `bg-panel` / `text-muted` / `text-accent`. The discipline collapsed inside the tool components, not at the top level.

## Recommended actions

1. **[P1] `/impeccable harden`** — Fix the closed-nav tab leak (`site-header.tsx`), the modal a11y in `ModalShell`, and add `prefers-reduced-motion` to the two keyframe blocks. Single biggest a11y improvement for the least effort.
2. **[P1] `/impeccable adapt`** — Decide Simulator / Designer responsive policy: either stack / drawer below `md` / `lg`, or gate with a desktop-only notice. Bump page-row + toolbar touch targets to ≥ 44 px.
3. **[P2] `/impeccable extract`** — Consolidate the ~30 hard-coded grays into 4–6 named surface / border tokens. Reconcile `#4a90e2` vs `--accent: #6cf` — pick one accent.
4. **[P2] `/impeccable colorize`** — Raise the contrast floor from `#666` / `#555` to `~#a0a0a8` for any text that has a job. Keep darker values for decorative-only dividers.
5. **[P2] `/impeccable clarify`** — Strip em dashes from the home, layout metadata, and `create` (both `en` and `de`) copy.
6. **[P3] `/impeccable distill`** — Replace the gradient-text + bounce-easing in the Flash success with a quieter, weight-driven version.
7. **[P3] `/impeccable polish`** — Final pass once the above land: re-audit, catch the remaining cosmetic drift, confirm no regressions.

Re-run `/impeccable audit` after fixes to see the score improve. For richer subsequent audits, run `/impeccable teach` first so PRODUCT.md / DESIGN.md exist — the register-specific anti-pattern checks then have more to compare against.
