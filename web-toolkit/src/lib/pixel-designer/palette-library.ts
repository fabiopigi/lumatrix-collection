/**
 * Local library of named custom colour palettes for LumenDesigner. Persists
 * as one JSON blob in localStorage under PALETTE_LIBRARY_KEY:
 *
 *   {
 *     schemaVersion: 1,
 *     palettes: { [id]: PaletteRecord },
 *   }
 *
 * Pair to library.ts (designs); same shape, simpler — palettes don't have a
 * "current" pointer, the active source is editor UI state.
 */

export const PALETTE_LIBRARY_KEY = "lumenlab-palette-library";

export interface PaletteRecord {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PaletteLibrary {
  schemaVersion: 1;
  palettes: Record<string, PaletteRecord>;
}

function now(): number {
  return Date.now();
}

function newId(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLibrary(): PaletteLibrary {
  return { schemaVersion: 1, palettes: {} };
}

export function loadPaletteLibrary(): PaletteLibrary {
  if (typeof window === "undefined") return emptyLibrary();
  try {
    const raw = window.localStorage.getItem(PALETTE_LIBRARY_KEY);
    if (!raw) return emptyLibrary();
    const parsed = JSON.parse(raw) as PaletteLibrary;
    if (
      parsed &&
      parsed.schemaVersion === 1 &&
      parsed.palettes &&
      typeof parsed.palettes === "object"
    ) {
      return parsed;
    }
  } catch {
    // Fall through to empty.
  }
  return emptyLibrary();
}

export function savePaletteLibrary(library: PaletteLibrary): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PALETTE_LIBRARY_KEY, JSON.stringify(library));
  } catch {
    // Quota or serialization error — swallow; next write retries.
  }
}

/** Sorted view: most-recently-updated first. */
export function listPalettes(library: PaletteLibrary): PaletteRecord[] {
  return Object.values(library.palettes).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
}

/** Save a new named palette. Returns the new library and the new id so the
 *  caller can switch the active palette source onto it. */
export function savePalette(
  library: PaletteLibrary,
  name: string,
  colors: string[],
): { library: PaletteLibrary; id: string } {
  const trimmed = name.trim() || nextUntitledName(library);
  const id = newId();
  const record: PaletteRecord = {
    id,
    name: uniqueName(library, trimmed),
    colors: colors.slice(),
    createdAt: now(),
    updatedAt: now(),
  };
  const next: PaletteLibrary = {
    ...library,
    palettes: { ...library.palettes, [id]: record },
  };
  savePaletteLibrary(next);
  return { library: next, id };
}

export function renamePalette(
  library: PaletteLibrary,
  id: string,
  name: string,
): PaletteLibrary {
  const trimmed = name.trim();
  if (!trimmed) return library;
  const record = library.palettes[id];
  if (!record) return library;
  const next: PaletteLibrary = {
    ...library,
    palettes: {
      ...library.palettes,
      [id]: { ...record, name: trimmed, updatedAt: now() },
    },
  };
  savePaletteLibrary(next);
  return next;
}

export function deletePalette(
  library: PaletteLibrary,
  id: string,
): PaletteLibrary {
  if (!library.palettes[id]) return library;
  const nextPalettes = { ...library.palettes };
  delete nextPalettes[id];
  const next: PaletteLibrary = { ...library, palettes: nextPalettes };
  savePaletteLibrary(next);
  return next;
}

/** Append a colour to a custom palette. Compares case-insensitively against
 *  existing colours and silently no-ops on duplicates so clicking "+ Add"
 *  twice with the same active colour doesn't bloat the swatch grid. */
export function addColorToPalette(
  library: PaletteLibrary,
  id: string,
  color: string,
): PaletteLibrary {
  const record = library.palettes[id];
  if (!record) return library;
  const normalized = color.toLowerCase();
  if (record.colors.some((c) => c.toLowerCase() === normalized)) {
    return library;
  }
  const next: PaletteLibrary = {
    ...library,
    palettes: {
      ...library.palettes,
      [id]: {
        ...record,
        colors: [...record.colors, color],
        updatedAt: now(),
      },
    },
  };
  savePaletteLibrary(next);
  return next;
}

/** Remove the first colour matching `color` (case-insensitive) from a custom
 *  palette. No-ops when nothing matches so the caller doesn't have to know. */
export function removeColorFromPalette(
  library: PaletteLibrary,
  id: string,
  color: string,
): PaletteLibrary {
  const record = library.palettes[id];
  if (!record) return library;
  const normalized = color.toLowerCase();
  const idx = record.colors.findIndex((c) => c.toLowerCase() === normalized);
  if (idx < 0) return library;
  const colors = record.colors.slice();
  colors.splice(idx, 1);
  const next: PaletteLibrary = {
    ...library,
    palettes: {
      ...library.palettes,
      [id]: { ...record, colors, updatedAt: now() },
    },
  };
  savePaletteLibrary(next);
  return next;
}

export function nextUntitledName(library: PaletteLibrary): string {
  return uniqueName(library, "Untitled palette");
}

function uniqueName(library: PaletteLibrary, base: string): string {
  const taken = new Set(Object.values(library.palettes).map((p) => p.name));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base} ${Date.now()}`;
}
