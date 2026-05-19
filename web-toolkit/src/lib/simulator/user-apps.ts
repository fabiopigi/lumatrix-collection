/**
 * Loader + storage for user-uploaded simulator apps.
 *
 * A user app is a plain ES module string with `NAME` and `run` exports.
 * It runs in the main thread alongside built-in apps; a buggy app can
 * freeze the tab and the user recovers by reloading. We accept that
 * tradeoff in exchange for a single contract that matches built-ins.
 *
 * Loading via blob-URL dynamic `import()` keeps the user code as a real
 * ES module — top-level `export` works, async functions work, the
 * launcher just sees another App object. The bare `import("…")` is
 * wrapped in `new Function` so the bundler doesn't try to resolve it
 * at build time.
 */

import type { App } from "./types";

export interface UserAppSource {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface CompiledUserApp {
  readonly source: UserAppSource;
  readonly app: App;
}

export class UserAppLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserAppLoadError";
  }
}

export const USER_APPS_STORAGE_KEY = "lumatrix.userApps.v1";

const dynamicImport: (url: string) => Promise<Record<string, unknown>> =
  new Function("u", "return import(u)") as (
    url: string,
  ) => Promise<Record<string, unknown>>;

export async function loadUserApp(source: UserAppSource): Promise<App> {
  if (typeof URL === "undefined" || typeof Blob === "undefined") {
    throw new UserAppLoadError("Not running in a browser");
  }
  const blob = new Blob([source.code], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  let mod: Record<string, unknown>;
  try {
    mod = await dynamicImport(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new UserAppLoadError(`Failed to parse JS: ${message}`);
  } finally {
    URL.revokeObjectURL(url);
  }
  const candidate =
    (mod.default && typeof mod.default === "object"
      ? (mod.default as Record<string, unknown>)
      : mod) ?? mod;
  const name = candidate.NAME ?? mod.NAME;
  const run = candidate.run ?? mod.run;
  const responsive = candidate.RESPONSIVE ?? mod.RESPONSIVE;
  if (typeof name !== "string" || name.length === 0) {
    throw new UserAppLoadError("App is missing a string `NAME` export.");
  }
  if (typeof run !== "function") {
    throw new UserAppLoadError("App is missing a `run` function export.");
  }
  return {
    NAME: name,
    RESPONSIVE: responsive === true,
    run: run as App["run"],
  };
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function readUserApps(): UserAppSource[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(USER_APPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: UserAppSource[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      if (typeof e.id !== "string" || typeof e.code !== "string") continue;
      out.push({
        id: e.id,
        code: e.code,
        label: typeof e.label === "string" ? e.label : e.id,
        createdAt: typeof e.createdAt === "number" ? e.createdAt : Date.now(),
        updatedAt: typeof e.updatedAt === "number" ? e.updatedAt : Date.now(),
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function writeUserApps(list: readonly UserAppSource[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(USER_APPS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Quota or serialization failure — silent; UI state is the source of truth
    // for the current session.
  }
}

export function generateUserAppId(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const base = slug || "app";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
