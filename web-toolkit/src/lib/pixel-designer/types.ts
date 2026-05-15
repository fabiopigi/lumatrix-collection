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

export type Mode = "pixel" | "mask";

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

export interface Config {
  width: number;
  height: number;
  colorMode: ColorMode;
  origin: Origin;
  axis: Axis;
  serpentine: boolean;
  letterMask: string;
}

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

export interface Snapshot {
  pages: Page[];
  currentPage: number;
}
