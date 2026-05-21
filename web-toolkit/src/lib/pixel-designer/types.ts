export type ColorMode =
  | "rgb"
  | "single-white"
  | "single-red"
  | "single-green"
  | "single-blue"
  | "single-amber"
  | "rg"
  | "rog"
  | "rgb3";

export type Origin =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type Axis = "row" | "col";

export type Mode = "pixel" | "mask" | "led";

export type FontKey = "3x5" | "5x8" | "7x9";

export type Tool =
  | "pencil"
  | "eraser"
  | "fill"
  | "eyedrop"
  | "line"
  | "rect"
  | "rectfill"
  | "ellipse"
  | "ellipsefill"
  | "select"
  | "text"
  | "stamp";

/** Per-preset hardware settings. Shared by every variant of the same preset
 *  across every page — wiring/origin/mask describe the physical device, not
 *  the artwork. Stored once in Design.hardware, keyed by presetId. */
export interface Hardware {
  presetId: string; // one of HARDWARE_PRESETS ids, or "custom"
  width: number;
  height: number;
  origin: Origin;
  axis: Axis;
  serpentine: boolean;
  letterMask: string;
}

/** A free-form labelled rectangle attached to a variant. Coordinates are in
 *  the variant's own pixel grid (so the same logical annotation in a 16×16
 *  variant lands at different coordinates than in an 8×8 variant). */
export interface Annotation {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

/** One variant of one page — the pixel data for that page on that hardware. */
export interface Variant {
  pixels: (string | null)[];
  annotations?: Annotation[];
}

/** A page in storage: a label plus a map of variants keyed by presetId.
 *  Optional `title`/`description`/`duration`/`fadeInTime` are extra metadata
 *  surfaced in the JSON export; consumers that don't care can ignore them. */
export interface DesignPage {
  label: string;
  variants: Record<string, Variant>;
  /** Display title shown on the page in the editor (and exposed in JSON for
   *  downstream renderers that want it). Optional. */
  title?: string;
  /** Free-form description, JSON-only — never surfaced in the editor UI
   *  outside the page-metadata modal. */
  description?: string;
  /** How long this page is shown when auto-playing, in milliseconds. */
  duration?: number;
  /** How long to fade this page in when auto-playing, in milliseconds. */
  fadeInTime?: number;
}

/** Whole-design source of truth. Persisted; what undo/redo snapshots. */
export interface Design {
  version: 4;
  colorMode: ColorMode;
  hardware: Record<string, Hardware>;
  pages: DesignPage[];
}

/** Editor "view" of the active variant — what tools and renderers operate on.
 *  Derived from a Design + (activePage, activePreset). Not persisted. */
export interface Config {
  width: number;
  height: number;
  colorMode: ColorMode;
  origin: Origin;
  axis: Axis;
  serpentine: boolean;
  letterMask: string;
}

/** View-shape page: label + the flat pixels array for the active preset. */
export interface Page {
  label: string;
  pixels: (string | null)[];
}

export interface Point {
  x: number;
  y: number;
}

export interface PreviewPoint extends Point {
  color: string;
  ghost?: boolean;
}

export interface Preview {
  points: PreviewPoint[];
}

export interface Selection {
  x: number;
  y: number;
  w: number;
  h: number;
  contents: (string | null)[];
  floating: boolean;
  transient?: boolean;
}

/** Undo/redo snapshot. Captures the full design plus which page was focused
 *  so undoing a stroke also restores cursor position. Per-page active variant
 *  is ephemeral UI state and not part of the snapshot — the resolver falls
 *  back to the first available variant if the stored selection becomes
 *  stale after an undo. */
export interface Snapshot {
  design: Design;
  activePage: number;
}
