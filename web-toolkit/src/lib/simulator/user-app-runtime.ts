/**
 * Exposes the simulator runtime to user-uploaded JS apps under
 * `globalThis.lumatrix`. User code references it instead of `import`ing,
 * which keeps the loaded module self-contained — no bundler awareness,
 * no import-map needed, just a known global the LLM prompt can document.
 */

import { sleep_ms, ticks_diff, ticks_ms } from "./runtime/time";
import * as screens from "./screens";

export interface LumatrixRuntime {
  readonly screens: typeof screens;
  readonly sleep_ms: typeof sleep_ms;
  readonly ticks_ms: typeof ticks_ms;
  readonly ticks_diff: typeof ticks_diff;
}

declare global {
  var lumatrix: LumatrixRuntime | undefined;
}

let installed = false;

export function installUserAppRuntime(): void {
  if (installed) return;
  installed = true;
  const runtime: LumatrixRuntime = {
    screens,
    sleep_ms,
    ticks_ms,
    ticks_diff,
  };
  (globalThis as { lumatrix?: LumatrixRuntime }).lumatrix = runtime;
}
