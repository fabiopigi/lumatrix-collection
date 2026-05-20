/**
 * Local library of named designs. Persists everything as one JSON blob in
 * localStorage under LIBRARY_KEY:
 *
 *   {
 *     schemaVersion: 1,
 *     designs: { [id]: DesignRecord },
 *     currentId: string,   // always points to a real entry; "scratch" reserved
 *   }
 *
 * One designs entry is always present with id "scratch" — the unsaved-work pad
 * the user lands on when there's nothing named, and the destination for fresh
 * "New" canvases. Promoting scratch to a named design is `renameDesign` from
 * "scratch" to a new id; the scratch slot is recreated lazily after.
 *
 * Every edit in the Designer autosaves to `library.designs[currentId].data`,
 * so closing the tab never loses work — even on scratch.
 */

import { cloneDesign, DEFAULT_DESIGN, STORAGE_KEY as OLD_DESIGN_KEY } from "./config";
import type { Design } from "./types";

export const LIBRARY_KEY = "lumenlab-design-library";
export const SCRATCH_ID = "scratch";
export const SCRATCH_NAME = "Scratch";

export interface DesignRecord {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  data: Design;
}

export interface Library {
  schemaVersion: 1;
  designs: Record<string, DesignRecord>;
  currentId: string;
}

function now(): number {
  return Date.now();
}

function newId(): string {
  // Small unique id — collision-resistant enough for a single-user library.
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyLibrary(): Library {
  const scratch: DesignRecord = {
    id: SCRATCH_ID,
    name: SCRATCH_NAME,
    createdAt: now(),
    updatedAt: now(),
    data: cloneDesign(DEFAULT_DESIGN),
  };
  return {
    schemaVersion: 1,
    designs: { [SCRATCH_ID]: scratch },
    currentId: SCRATCH_ID,
  };
}

/** Load the library, running a one-shot migration from the pre-library
 *  single-design key if no library exists yet. */
export function loadLibrary(): Library {
  if (typeof window === "undefined") return emptyLibrary();
  try {
    const raw = window.localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Library;
      if (parsed && parsed.schemaVersion === 1 && parsed.designs && parsed.currentId) {
        // Make sure scratch always exists — it's the fallback canvas.
        if (!parsed.designs[SCRATCH_ID]) {
          parsed.designs[SCRATCH_ID] = {
            id: SCRATCH_ID,
            name: SCRATCH_NAME,
            createdAt: now(),
            updatedAt: now(),
            data: cloneDesign(DEFAULT_DESIGN),
          };
        }
        if (!parsed.designs[parsed.currentId]) {
          parsed.currentId = SCRATCH_ID;
        }
        return parsed;
      }
    }
  } catch {
    // Fall through to migration / empty.
  }

  // Migrate the old single-design key, if present, into the first named slot.
  // Wipes the old key so we don't migrate twice.
  try {
    const oldRaw = window.localStorage.getItem(OLD_DESIGN_KEY);
    if (oldRaw) {
      const oldDesign = JSON.parse(oldRaw) as Design;
      if (oldDesign && oldDesign.version === 4) {
        const lib = emptyLibrary();
        // Drop the migrated design straight into scratch so the user's last
        // session opens exactly where they left off, with no menu detour.
        lib.designs[SCRATCH_ID] = {
          ...lib.designs[SCRATCH_ID],
          data: cloneDesign(oldDesign),
          updatedAt: now(),
        };
        window.localStorage.removeItem(OLD_DESIGN_KEY);
        saveLibrary(lib);
        return lib;
      }
    }
  } catch {
    // Migration is best-effort; if it fails we just hand back an empty library.
  }

  return emptyLibrary();
}

export function saveLibrary(library: Library): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  } catch {
    // Quota or serialization error — surface upstream via thrown? For now
    // we swallow; the in-memory state stays consistent and the next write
    // will retry.
  }
}

/** Autosave: update the current entry's data + updatedAt and persist. */
export function autosave(library: Library, data: Design): Library {
  const current = library.designs[library.currentId];
  if (!current) return library;
  const next: Library = {
    ...library,
    designs: {
      ...library.designs,
      [library.currentId]: {
        ...current,
        data: cloneDesign(data),
        updatedAt: now(),
      },
    },
  };
  saveLibrary(next);
  return next;
}

/** Create a new named entry from the current design (Save as…). The new entry
 *  becomes current. Caller is expected to keep editing into it; subsequent
 *  autosaves land in the new slot. */
export function saveAs(library: Library, name: string, data: Design): Library {
  const trimmed = name.trim() || nextUntitledName(library);
  const id = newId();
  const record: DesignRecord = {
    id,
    name: trimmed,
    createdAt: now(),
    updatedAt: now(),
    data: cloneDesign(data),
  };
  const next: Library = {
    ...library,
    designs: { ...library.designs, [id]: record },
    currentId: id,
  };
  saveLibrary(next);
  return next;
}

/** Start a fresh blank canvas. Switches currentId to scratch and resets its
 *  data; any work already in scratch is lost (user is expected to have named
 *  it via Save as… first if they cared). */
export function newDesign(library: Library): Library {
  const scratch: DesignRecord = {
    id: SCRATCH_ID,
    name: SCRATCH_NAME,
    createdAt: now(),
    updatedAt: now(),
    data: cloneDesign(DEFAULT_DESIGN),
  };
  const next: Library = {
    ...library,
    designs: { ...library.designs, [SCRATCH_ID]: scratch },
    currentId: SCRATCH_ID,
  };
  saveLibrary(next);
  return next;
}

/** Open a named entry (sets currentId). Autosave continues into the picked
 *  entry from here on. */
export function openDesign(library: Library, id: string): Library {
  if (!library.designs[id]) return library;
  const next: Library = { ...library, currentId: id };
  saveLibrary(next);
  return next;
}

export function renameDesign(
  library: Library,
  id: string,
  name: string,
): Library {
  const trimmed = name.trim();
  if (!trimmed) return library;
  const record = library.designs[id];
  if (!record) return library;
  const next: Library = {
    ...library,
    designs: {
      ...library.designs,
      [id]: { ...record, name: trimmed, updatedAt: now() },
    },
  };
  saveLibrary(next);
  return next;
}

/** Delete a named entry. Scratch can't be deleted; deleting the current
 *  named entry falls back to scratch. */
export function deleteDesign(library: Library, id: string): Library {
  if (id === SCRATCH_ID) return library;
  if (!library.designs[id]) return library;
  const nextDesigns = { ...library.designs };
  delete nextDesigns[id];
  const nextCurrent = library.currentId === id ? SCRATCH_ID : library.currentId;
  const next: Library = {
    ...library,
    designs: nextDesigns,
    currentId: nextCurrent,
  };
  saveLibrary(next);
  return next;
}

/** Add an imported design to the library as a new entry and switch to it.
 *  The proposed name is auto-deduped against existing entries. */
export function importIntoLibrary(
  library: Library,
  data: Design,
  proposedName: string,
): Library {
  const name = uniqueName(library, proposedName.trim() || "Imported design");
  return saveAs(library, name, data);
}

/** Generate the next "Untitled N" that isn't already in use. */
export function nextUntitledName(library: Library): string {
  return uniqueName(library, "Untitled");
}

/** Given a base name, return either base itself (if unused) or base + " N"
 *  with the smallest N that's free. Comparison is case-sensitive — matches
 *  the user's exact naming. */
function uniqueName(library: Library, base: string): string {
  const taken = new Set(
    Object.values(library.designs).map((d) => d.name),
  );
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} ${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base} ${Date.now()}`;
}

/** Sorted view: named designs only, most-recently-updated first. Scratch is
 *  filtered out — it isn't a "saved" design from the user's perspective. */
export function listDesigns(library: Library): DesignRecord[] {
  return Object.values(library.designs)
    .filter((d) => d.id !== SCRATCH_ID)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCurrent(library: Library): DesignRecord {
  return library.designs[library.currentId] ?? library.designs[SCRATCH_ID];
}

export function isScratch(library: Library): boolean {
  return library.currentId === SCRATCH_ID;
}
