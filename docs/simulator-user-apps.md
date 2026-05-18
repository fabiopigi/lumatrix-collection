# Runtime app loading in the web simulator — findings

Investigation into whether a user of the deployed LumenSimulator (no repo, no Node toolchain) could upload or paste an app and run it in the browser. Not yet implemented — this is a design-level write-up of what's involved and a recommendation.

## TL;DR

**Yes, it's feasible.** Two viable shapes:

- **Route A (declarative JSON apps)** — small interpreter, no code execution, covers slideshows / clocks / Pixel-Designer-driven animations. ~1 day of work.
- **Route B (TypeScript/JS upload)** — ship a transpiler to the browser, inject the shared runtime as globals, sandbox to taste. Covers real games. ~2–3 days.

**Recommendation: start with Route A.** It matches the non-coder workflow the LLM prompt already targets (most "I have a design JSON and want it to play" requests are declarative), avoids the XSS surface, and the schema doubles as a clean LLM target. Add Route B when someone has a game-shaped request the JSON can't express.

## Current architecture (constraints)

- Apps are **statically imported at build time**: `web-toolkit/src/lib/simulator/launcher.ts:16-26` does `import * as snake from "./apps/snake"` etc., and `APPS` is a hardcoded `const` array (`launcher.ts:43-55`).
- Apps are authored as `.ts` files, but the deployed simulator only ships the **bundled JS** Next.js produces — there is no TypeScript compiler in the browser.
- The app contract is just two symbols (`web-toolkit/src/lib/simulator/types.ts:48-74`):
  - `NAME: string`
  - `run(np, joy, display?, screensNp?): Promise<void>`
  - plus an optional `RESPONSIVE: boolean` flag.
- Apps reach the shared runtime through compile-time module resolution: `import * as screens from "../screens"` and `import { sleep_ms, ticks_ms, ticks_diff } from "../runtime/time"`. These paths don't exist at runtime in the deployed bundle — they were resolved by Webpack.
- `simulator.tsx:41` reads apps once at mount via `launcher.getApps()` and renders them as a static list. Nothing in the host plumbs through a "user app" path.

So enabling user-supplied apps needs three pieces this project does not currently have:

1. A way to **accept and parse** user content (JSON or JS/TS).
2. A way to **resolve `screens` / `sleep_ms` / `ticks_*` at runtime** for that content (Route B only).
3. **UI + storage** to add, persist, and launch the user's apps.

## Route A — Declarative JSON apps

Define a small schema that describes an app as `pages × inputs × transitions` — Pixel Designer's existing JSON plus an animation/interaction layer. The simulator ships a generic interpreter that wraps one of these into an `App` object (matching the existing contract) and slots it into the `APPS` array at runtime.

### Sketch of the schema

```jsonc
{
  "name": "MyClock",
  "kind": "passive",                          // "game" or "passive"
  "fps": 20,
  "pages": [
    { "id": "p1", "pixels": [...] },          // same shape as Pixel Designer
    { "id": "p2", "pixels": [...] }
  ],
  "behavior": {
    "type": "cycle",                          // "cycle" | "input" | "time-driven"
    "intervalMs": 2000,                       // for "cycle"
    "transition": "cut"                       // "cut" | "fade"
  },
  "inputs": {                                 // optional overrides
    "left":  { "action": "prev-page" },
    "right": { "action": "next-page" },
    "up":    { "action": "set-page", "id": "p1" }
  }
}
```

Behaviors the interpreter understands:

- `cycle` — auto-advance pages every `intervalMs`.
- `input` — page index driven entirely by joystick events (good for "press to advance" slideshows and word-clock-style state apps).
- `time-driven` — page selected by a small expression over `Date` (hour, minute) for clocks. Need to nail down a safe expression grammar; could be as restricted as `"hour % 12 == 3"` keyword matching against the page id.

What it can do well: clocks, slideshows, multi-frame animations, ambient mood backgrounds, alternate states driven by button presses, anything Pixel-Designer-shaped.

What it can't do: collision, physics, scoring curves, anything stateful beyond "which page is up." A real game is out of scope for this format on purpose.

### Implementation pieces

- `web-toolkit/src/lib/simulator/user-apps/json-interpreter.ts` — schema validator + factory that returns an `App`.
- `web-toolkit/src/lib/simulator/user-apps/storage.ts` — localStorage CRUD + URL fragment share/load.
- Hook into `launcher.getApps()` so the user's apps are concatenated to the static `APPS` (or kept in a separate "User" section in the quick-launch rail).
- "Add app" tile in `app-launcher.tsx:49` opens a modal with **Upload JSON** / **Paste JSON** tabs and an autosave to localStorage.

### Pros / cons

- **+** No code execution — zero XSS surface.
- **+** Schema doubles as an LLM target: the prompt doc would emit one JSON file instead of two source files, simplifying the non-coder workflow dramatically.
- **+** Sharable via URL fragment trivially (base64-encode the JSON).
- **+** Small footprint — interpreter is ~5 KB, no new dependencies.
- **−** Only covers a slice of "apps." Anything game-shaped needs Route B.

## Route B — TypeScript/JS code upload

Accept user `.ts` or `.js`, transpile in the browser if needed, and run it against the existing app contract.

### The three problems and how to solve each

**1. Transpile in browser.** Sucrase (~120 KB, lazy-loadable on first "Add app" click) strips TS types and ES module syntax in milliseconds. The full TypeScript compiler is overkill and 10× heavier. Sucrase doesn't type-check — fine here, the user trusts their LLM's output.

**2. Module resolution.** User code can't `import * as screens from "../screens"` at runtime. Two clean options:

- **Globals**: expose `globalThis.LumenLab = { screens, sleep_ms, ticks_ms, ticks_diff }`. Document a slightly different shape for user apps:
  ```ts
  const { screens, sleep_ms } = globalThis.LumenLab;
  export const NAME = "MyApp";
  export async function run(np, joy, display, screensNp) { ... }
  ```
- **Factory wrapping**: transpile the user file to a function body, then `new Function("screens", "sleep_ms", "ticks_ms", "ticks_diff", code)`. Caller invokes it with the runtime modules. The user's source still reads like a normal ES module; we strip the imports during transpile and inject the locals via the factory signature. Slightly more magic but lets the user-side code look identical to a repo-installed app.

I'd pick **factory wrapping** — keeps the LLM prompt's existing TS template valid as user-paste content with one tiny pre-processing step (drop the `import` lines).

**3. UI + storage.** Same as Route A: "Add app" modal with upload / paste / share-from-URL, persisted to localStorage. Each user app shows up in the launcher with a small "user" badge.

### Sandboxing — pick a level

User code runs **in the page context** by default. That means full access to DOM, localStorage, cookies, network, etc. — effectively XSS-as-a-feature. For a hobby tool used on the user's own browser with their own code, that's arguably acceptable, with a clear "this runs arbitrary code from whoever sent you the link" warning before installing a shared app.

If/when that's not acceptable, the upgrade path is a **Web Worker sandbox**:

- The user app runs inside the worker.
- The NeoPixel buffer is shared via `SharedArrayBuffer` (or copied across postMessage if you don't want to enable COOP/COEP headers).
- The `screens` module runs alongside in the worker and renders into the same buffer.
- Joystick input arrives via postMessage.
- `terminate()` cleanly kills a runaway app.

That's a bigger change — `screens.ts` would need to become worker-portable, and the host has to set up the message protocol — but it cleanly decouples user code from the page.

**Recommendation for v1: skip the worker.** Ship the simpler in-page version with a clear trust warning. Add the worker if sharing user apps via URL takes off and the trust footprint becomes a real concern.

### Implementation pieces

- `web-toolkit/src/lib/simulator/user-apps/ts-loader.ts` — `loadUserApp(source: string): Promise<App>`. Lazy-imports sucrase, strips imports, factory-wraps, returns an `App`.
- `web-toolkit/src/lib/simulator/user-apps/storage.ts` — shared with Route A.
- Same `app-launcher.tsx` modal as Route A, with an extra "Code" tab.
- A clear warning UI before installing an app that came from a URL ("This will run JavaScript from whoever sent you this link.").

### Pros / cons

- **+** Full power. Any app the repo-installed simulator can run, a user can run.
- **+** Existing apps in `web-toolkit/src/lib/simulator/apps/*.ts` work as-is after stripping imports — the LLM's TS template is already valid input.
- **−** Code-execution surface. Needs trust warnings; long-term needs worker isolation.
- **−** Larger footprint: sucrase + glue is ~150 KB lazy-loaded.

## Hybrid

Ship Route A first. Add Route B in a follow-up when there's a concrete game-shaped request the JSON format can't express. The two routes share storage, share UI surface, and share the `App` integration point — no architectural conflict.

If we go hybrid, the `docs/llm-app-prompt.md` doc grows a section explaining when the LLM should emit JSON vs TS, and the prompt branches based on the user's described complexity.

## Open questions

- **Pixel Designer JSON as the source-of-truth for Route A?** Adding `behavior` and `inputs` fields to the existing Pixel Designer export format would let users design and configure the app entirely in the designer — no second file. That couples the designer to the simulator's interpreter, which may or may not be desirable.
- **Share-via-URL limits.** URL fragments are practically capped around 8–32 KB depending on browser. A multi-frame 32×32 design pushes that. Probably fine for 8×8 but worth measuring before shipping.
- **Naming collisions.** A user app named "Snake" conflicts with the bundled one. Either namespace user apps in the UI (`User: Snake`) or auto-rename on install.
- **Pico path.** Route A is web-only by design. Route B in principle generates a `.py` the user could also flash, but the bridge is non-trivial (TS-to-MicroPython is what the LLM prompt already does — we wouldn't want the simulator doing it too).
