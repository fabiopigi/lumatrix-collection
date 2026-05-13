import type { Config } from "./types";

export const LUMATRIX_MASK =
  "ZATWENTY\n" +
  "HQUARTER\n" +
  "AHALFIVE\n" +
  "WTPASTOR\n" +
  "FIVEIGHT\n" +
  "SIXTHREE\n" +
  "TWELEVEN\n" +
  "FOURNINE";

export const DEFAULT_CONFIG: Config = {
  width: 8,
  height: 8,
  colorMode: "rgb",
  origin: "bottom-left",
  axis: "row",
  serpentine: false,
  letterMask: LUMATRIX_MASK,
};

export const STORAGE_KEY = "lumatrix-pixel-designer-config";

export function loadConfig(): Config {
  if (typeof window === "undefined") return { ...DEFAULT_CONFIG };
  try {
    const j = window.localStorage.getItem(STORAGE_KEY);
    if (j) return { ...DEFAULT_CONFIG, ...JSON.parse(j) };
  } catch {}
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: Config) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

export function getCellLetter(config: Config, x: number, y: number): string {
  const mask = config.letterMask || "";
  if (!mask) return "";
  const lines = mask.split("\n");
  if (y < 0 || y >= lines.length) return "";
  const line = lines[y];
  if (x < 0 || x >= line.length) return "";
  const ch = line[x];
  if (!ch || ch === " " || ch === ".") return "";
  return ch.toUpperCase();
}

export function isMaskAvailable(config: Config): boolean {
  if (!config.letterMask) return false;
  return /[A-Za-z0-9]/.test(config.letterMask);
}

export function computeCellSize(width: number, height: number): number {
  const maxArea = 540;
  const gap = 4;
  const wMax = Math.floor((maxArea - (width - 1) * gap) / width);
  const hMax = Math.floor((maxArea - (height - 1) * gap) / height);
  return Math.max(8, Math.min(50, Math.min(wMax, hMax)));
}

export const CELL_GAP = 4;
