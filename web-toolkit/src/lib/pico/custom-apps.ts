/**
 * Shape + lightweight validation for user-supplied .py apps that the flash
 * wizard ships alongside the built-ins. The wizard keeps these in component
 * state for the duration of a session — no persistence yet.
 *
 * The Python `main.py` on the Pico imports apps via `__import__(name)` from
 * `/apps/<id>.py`, so the id must be a valid module name (a-z, 0-9, _).
 */

export interface CustomPicoApp {
  /** Module name (and basename of the .py file on the Pico). */
  readonly id: string;
  /** Display label — mirrors NAME in the .py if we can find it. */
  readonly name: string;
  readonly contents: string;
}

const ID_RE = /^[a-z][a-z0-9_]{0,31}$/;

export function isValidAppId(id: string): boolean {
  return ID_RE.test(id);
}

export function slugifyAppId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return base || "custom_app";
}

/** Best-effort NAME extraction. Falls back to the supplied default. */
export function extractName(contents: string, fallback: string): string {
  const match = contents.match(/^\s*NAME\s*=\s*["']([^"']+)["']/m);
  return match ? match[1] : fallback;
}

export const CUSTOM_PICO_APPS_STORAGE_KEY = "lumatrix.customPicoApps.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readCustomPicoApps(): CustomPicoApp[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PICO_APPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: CustomPicoApp[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (
        typeof e.id !== "string" ||
        typeof e.name !== "string" ||
        typeof e.contents !== "string"
      ) {
        continue;
      }
      if (!isValidAppId(e.id)) continue;
      out.push({ id: e.id, name: e.name, contents: e.contents });
    }
    return out;
  } catch {
    return [];
  }
}

export function writeCustomPicoApps(list: readonly CustomPicoApp[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(CUSTOM_PICO_APPS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Quota or serialization failure — silent; component state still holds
    // the current session's apps.
  }
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly warnings: readonly string[];
}

export function validatePicoApp(contents: string): ValidationResult {
  const warnings: string[] = [];
  if (!/^\s*NAME\s*=/m.test(contents)) {
    warnings.push("Missing module-level `NAME = \"...\"` assignment.");
  }
  if (!/^\s*def\s+run\s*\(/m.test(contents)) {
    warnings.push("Missing `def run(neopixel, joystick, …):` function.");
  }
  if (/^\s*NeoPixel\s*\(/m.test(contents) || /^\s*Pin\s*\([^)]*\)\s*=/m.test(contents)) {
    warnings.push(
      "Hardware appears to be constructed at module top level — move it inside `run()`.",
    );
  }
  return { ok: warnings.length === 0, warnings };
}
