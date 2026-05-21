/**
 * Open/closed state for LumenDesigner's collapsible side panels, persisted
 * as one JSON blob in localStorage under PANEL_STATE_KEY:
 *
 *   {
 *     schemaVersion: 1,
 *     open: { [panelId]: boolean }
 *   }
 *
 * Keyed by stable panel id (kebab-case, picked by the panel itself); ids
 * not present in the map fall back to the panel's `defaultOpen` prop.
 */

export const PANEL_STATE_KEY = "lumen-designer:panels";

/** Default open/closed state by panel id. Used when a panel has no entry in
 *  the persisted state yet (fresh user, or a newly-added panel). Both the
 *  side-panel renderer and the toggle handler read from this map so they
 *  always agree on what "the default" means. */
export const PANEL_DEFAULT_OPEN: Record<string, boolean> = {
  mode: true,
  preview: true,
  color: true,
  text: true,
  symbols: false,
  annotations: false,
  shortcuts: false,
};

export interface PanelState {
  schemaVersion: 1;
  open: Record<string, boolean>;
}

function empty(): PanelState {
  return { schemaVersion: 1, open: {} };
}

export function loadPanelState(): PanelState {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(PANEL_STATE_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as PanelState;
    if (
      parsed &&
      parsed.schemaVersion === 1 &&
      parsed.open &&
      typeof parsed.open === "object"
    ) {
      return parsed;
    }
  } catch {
    // Fall through to empty.
  }
  return empty();
}

export function savePanelState(state: PanelState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PANEL_STATE_KEY, JSON.stringify(state));
  } catch {
    // Quota / serialization — swallow; in-memory state stays consistent.
  }
}

export function setPanelOpen(
  state: PanelState,
  id: string,
  open: boolean,
): PanelState {
  if (state.open[id] === open) return state;
  const next: PanelState = {
    ...state,
    open: { ...state.open, [id]: open },
  };
  savePanelState(next);
  return next;
}

export function isPanelOpen(
  state: PanelState,
  id: string,
  fallback: boolean,
): boolean {
  const v = state.open[id];
  return typeof v === "boolean" ? v : fallback;
}
