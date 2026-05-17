# LUMATRIX references audit

Every place "lumatrix", "luma matrix", or "luma trix" appears in the tree (case-insensitive, excluding `node_modules/`, `.next/`, and `.git/`). Grouped by what each reference does so you can decide what a repo rename actually needs to touch.

The product name itself ("LUMATRIX" / "LumaTrix") refers to the ZHAW kit at <https://lumatrix.zhaw.ch>. Renaming the GitHub repo is independent of rebranding the product — most references below are brand mentions that can stay if you keep using the LUMATRIX kit.

## 1. Repo identity — change if renaming

These embed the GitHub slug or npm package name.

| Reference | File / line | Use |
|---|---|---|
| `https://github.com/fabiopigi/lumatrix-collection.git` | `.git/config` (origin URL — not a tracked file) | Push/pull remote. Update with `git remote set-url origin <new>` after renaming. |
| `"name": "lumatrix-simulator"` | `web/package.json:2` | npm package name for the legacy 8×8 simulator under `web/`. |
| `"name": "lumatrix-simulator"` | `web/package-lock.json:2`, `:8` | Mirrors the package.json name. Regenerates on `npm install`. |

`web-toolkit/package.json` does **not** carry a lumatrix-named identifier, so the Next.js toolkit is unaffected.

## 2. localStorage keys — user-data persistence

Changing these breaks existing browser sessions (designs / display configs revert to defaults).

| Key | File / line | Use |
|---|---|---|
| `lumatrix-pixel-designer-design` | `web-toolkit/src/lib/pixel-designer/config.ts:51` | Stores the user's current pixel-designer design across reloads. |
| `lumatrix-simulator-display` | `web-toolkit/src/lib/simulator/display-config.ts:33` | Stores the user's selected display preset (8×8 / 16×16 / …). |
| `lumatrix-pixel-designer-config` | `docs/pixel-designer-usage.md:287` | **Doc-only reference** — actual code uses `…-design`. Either the doc is stale or a second key was planned. Worth fixing while you're here. |

## 3. JSON schema identifiers — cross-tool contract

Schema strings embedded in shared JSON files. Loaders may pin/version against these.

| Schema | File / line | Use |
|---|---|---|
| `lumatrix-fonts-v1` | `shared/fonts.json:2` | Schema id for the shared pixel-font catalog (read by simulator, Python apps, designer). |
| `lumatrix-hardware-presets-v1` | `shared/hardware-presets.json:2` | Schema id for the canonical hardware presets file (just added). |

The web/ bundle copies `fonts.json` verbatim into `web-apps/simulator.html`, so its `lumatrix-fonts-v1` schema string appears in the build artifact too.

## 4. Internal code identifiers

Variable, function, and constant names. Pure refactor if you rename them — no external contract.

| Identifier | File / line | Use |
|---|---|---|
| `LUMATRIX_MASK` | `web-toolkit/src/lib/pixel-designer/config.ts:3,22` | Default 8×8 word-clock letter mask. |
| `LUMATRIX_MASK` | `web-toolkit/src/app/pixel-designer/_components/config-modal.tsx:4,221` | Imported + used by the "Use LUMATRIX preset" button. |
| `isLumatrix(cfg)` | `web-toolkit/src/lib/simulator/display-config.ts:98` | Predicate: is the configured display the native 8×8? |
| `isLumatrix` | `web-toolkit/src/app/simulator/_components/simulator-grid.tsx:15,82` | Drives mask-mode rendering. |
| `isLumatrix` | `web-toolkit/src/app/simulator/_components/simulator.tsx:7,50` | Gates mask-mode availability. |
| `lumatrixNp` | `web-toolkit/src/lib/simulator/launcher.ts:458,494` (and comments at `:11`, `:455`) | The legacy 64-LED source buffer used for non-responsive apps. |

## 5. Product/brand name in user-facing strings & docs

These describe the LUMATRIX kit. Keep as-is unless you're rebranding the project away from the ZHAW kit.

### UI strings (visible to users)

| File / line | Use |
|---|---|
| `web/index.html:6` | `<title>LUMATRIX Simulator</title>` — browser tab title for legacy simulator. |
| `web-apps/simulator.html:6` | Same title in the built bundle. Regenerates from `web/`. |
| `web-toolkit/src/app/pixel-designer/_components/config-modal.tsx:224` | Button label "Use LUMATRIX preset". |
| `web-toolkit/src/app/pixel-designer/_components/config-modal.tsx:242` | Button label "Reset to LUMATRIX defaults". |
| `web-toolkit/src/app/simulator/_components/mode-toggle.tsx:32` | Tooltip explaining mask mode is the LUMATRIX 8×8 word-clock layout. |
| `shared/hardware-presets.json:5` | Preset label `"8×8 (LumaTrix)"` shown in dropdowns. |

### Comments / docstrings

| File / line | Use |
|---|---|
| `python/apps/_screens.py:1` | Module docstring: "Shared lifecycle screens for LUMATRIX apps." |
| `python/apps/_fonts.py:1` | Module docstring: "Common font definitions for LUMATRIX apps." |
| `python/apps/dinojump.py:1` | "Chrome-dino-style side scroller for LUMATRIX." |
| `web/src/letter-mask.ts:2` | Comment: "Physical letter overlay printed on the LUMATRIX matrix." |
| `web-toolkit/src/lib/pixel-designer/png-export.ts:27` | Doc comment with `"8×8 (LumaTrix)"` as an example column label. |
| `web-toolkit/src/lib/simulator/screens.ts:86,586` | Comments referring to the LUMATRIX 8×8 source and original arrow design. |
| `web-toolkit/src/lib/simulator/types.ts:53,57,62,66` | Doc comments on the `App` interface describing the LUMATRIX 8×8 source buffer. |
| `web-toolkit/src/lib/simulator/display-config.ts:4` | Module-level comment on the LUMATRIX native buffer. |
| `web-toolkit/src/lib/simulator/launcher.ts:11,335,455` | Comments referencing the LUMATRIX source buffer / boot-animation flow. |
| `web-toolkit/src/lib/simulator/apps/snake.ts:13` | Comment noting `screens` is bound to the LUMATRIX 8×8 source. |
| `web-toolkit/src/lib/simulator/apps/dinojump.ts:1` | Mirrors the Python docstring. |

### Design JSON descriptions

| File / line | Use |
|---|---|
| `shared/design/boot-animation.json:36` | Animation description references the previous "LUMA TRIX" marquee. |
| `shared/fonts.json:3` | Description: "Pixel fonts for LUMATRIX and similar LED-matrix displays." |
| `shared/hardware-presets.json:3` | Description references the LUMATRIX-aware tooling. |

### Documentation

| File / line | Use |
|---|---|
| `README.md:1,3,7,26,76,77,146` | Project title, kit description, simulator pointer, deployment notes, letter-mask note, licensing note. |
| `web-toolkit/README.md:3` | Tagline: "a Next.js app for the LUMATRIX kit". |
| `docs/AUTHORING.md:1,129,697,1066` | Title, repo tree comment, screenshot caption, cheat-sheet pointer. |
| `docs/pixel-designer-usage.md:1,3,7,215,217,240,248,255,280,287,486` | Designer guide title, intro, screenshot alts, LUMATRIX-preset references, hardware-row in the indexing table. |
| `docs/responsive-scaling.md:3,9,55` | Describes how apps behave outside the LUMATRIX-native 8×8. |
| `docs/apps/letters.md:16,58,60` | App doc explaining the LUMATRIX word-clock mask binding. |

## 6. External URL — do not change

| URL | File / line | Use |
|---|---|---|
| `https://lumatrix.zhaw.ch` | `README.md:3,9` | Link to the actual ZHAW LUMATRIX kit. Independent of this repo. |

## 7. Generated build artifact — regenerates from source

| File | Use |
|---|---|
| `web-apps/simulator.html` | Built bundle of `web/`. Contains the `<title>` and an inlined copy of `shared/fonts.json` (so its `lumatrix-fonts-v1` schema string appears in the minified JS). Rebuilds with `cd web && npm run build` — don't hand-edit. |

## What a pure GitHub rename actually requires

If you only want to change the GitHub slug (say `lumatrix-collection` → `<new>`):

1. Rename on GitHub (Settings → General).
2. `git remote set-url origin git@github.com:fabiopigi/<new>.git` here.
3. Done — everything else is brand text tied to the ZHAW kit, not to the repo URL. The npm package name in `web/package.json` is `lumatrix-simulator`, which is a publish identifier; it doesn't have to match the repo slug unless you publish it.

If you also want to drop the LUMATRIX naming from the codebase (rebrand), the affected surfaces in priority order are: localStorage keys (§2, migration cost), JSON schema strings (§3, contract bump), code identifiers (§4, mechanical), UI strings (§5 UI subsection, user-visible), then comments/docs (§5 remainder).
