# Local design storage

**Status:** shipped (PR #15)
**Tags:** web-toolkit, lumen-designer, ux, persistence

## What

Let LumenDesigner save designs locally in the browser so you can keep multiple named designs, start a new one, and reopen previous ones later — without touching a server or the filesystem. Browser-tied is fine; portability across machines is out of scope (for now).

## Why

Today a session in the designer is ephemeral: refresh or navigate away and the work is gone unless you JSON-export it manually. That's friction for iterating on multiple ideas in parallel, comparing variants, or coming back to something the next day. A lightweight "save / new / open" loop turns the designer from a scratchpad into a tiny personal library.

## Sketch

LumenDesigner already has a JSON serialization (used for export/import). Local storage can reuse it as the on-disk format — the question is just *where* to put it and *how* to index named entries.

Storage options, roughly ordered by complexity:

- **localStorage** — simple sync API, ~5–10 MB cap, strings only (so `JSON.stringify` the design). Plenty for 8×8 designs even with many pages. Easiest to ship.
- **IndexedDB** — async, structured, much larger. Worth it if designs grow (animations with many frames, large matrices, embedded assets) or if we want querying.
- **File System Access API / OPFS** — real files, but Chromium-mostly and adds permission UX. Probably overkill unless we want true "files on disk" semantics.

Likely shape regardless of backend:

- A list of saved designs keyed by id, each with `{ id, name, createdAt, updatedAt, data }`.
- UI: a "Designs" menu/drawer with **New**, **Save**, **Save as…**, **Open**, **Rename**, **Delete**. Current design name shown somewhere in the header.
- Dirty-state indicator so you know when there are unsaved changes.
- Autosave to a "scratch" slot so a refresh never loses work, even before naming.
- **Unsaved-changes prompt on page close** (`beforeunload`) — but only past an *effort threshold* so a quick poke at the designer doesn't trigger a nag. Threshold could be time spent (e.g. >30s of activity), number of edits (e.g. >N pixel changes), or both. Skip the prompt entirely if autosave-to-scratch already covers the loss.

## Open questions

- localStorage vs IndexedDB — start simple (localStorage) and migrate later if we hit limits, or pick IndexedDB upfront to avoid a migration?
- Naming on save: prompt for a name, or auto-name (`Untitled 1`, `Untitled 2`) and let the user rename?
- Should "New" prompt to save unsaved changes, or always autosave into a slot?
- Export/import: keep JSON file export as the "leave the browser" escape hatch — does Import become "Import into library" instead of replacing current?
- Versioning the saved format — add a `schemaVersion` from day one so future LumenDesigner changes don't orphan old saves?
- Do we want a thumbnail/preview per design in the Open list (rendered from page 1)?
- Effort threshold for the close-page prompt — tune by time, edit count, or "has the design diverged from blank"? And does autosave-to-scratch make the prompt redundant entirely?

## Notes

- Reuses the existing JSON export/import format — no new serialization needed.
- Browser-scoped is acceptable; cross-device sync is a separate, much bigger idea.
- Related: a future "share design via URL" idea could piggyback on the same format ([[share-design-link]] — not written yet).
