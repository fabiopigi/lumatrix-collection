/**
 * Sprite library: named sets of stamps the Designer's Sprites panel renders.
 * A set is one of two shapes:
 *
 *  1. Inline mono set — no PNG, pixel data is `.`/`X` strings authored in
 *     code. Painted in the active brush colour at stamp time. Today's
 *     hand-typed "Classic" symbols are this kind.
 *
 *  2. PNG-backed colourful set — manifest names cells of a sprite-sheet
 *     PNG; each cell has its own RGBA, painted as-is at stamp time. New
 *     packs land as `public/sprites/<id>/sheet.png` + `manifest.json`,
 *     registered by id in COLORFUL_MANIFESTS below.
 *
 * Public consumers (the side panel, the stamp tool) talk to `SpriteSet`
 * objects with pre-resolved pixel arrays — synchronous after `loadAllSets`
 * has fulfilled once. The first call kicks off the PNG fetches; subsequent
 * calls reuse the resolved cache.
 */

import { CLASSIC_SPRITE_DATA } from "./symbols";

export interface SpriteSet {
  id: string;
  name: string;
  /** Square cell size (e.g. 8 means 8×8). */
  size: number;
  /** When false, the active brush colour is used at stamp time and every
   *  filled cell shares that one colour. When true, each cell carries its
   *  own hex from the sheet. */
  colorful: boolean;
  license?: string;
  attribution?: string;
  attributionUrl?: string;
  sprites: ResolvedSprite[];
}

export interface ResolvedSprite {
  name: string;
  /** Flat `size * size` array of hex strings or null (= empty cell). For
   *  mono sets every filled cell carries a placeholder hex; thumbnails
   *  ignore it and use a tint, the stamp tool paints in the active colour. */
  pixels: (string | null)[];
}

/** Manifest as authored on disk. Loader resolves it into a SpriteSet. */
interface SpriteSetManifest {
  id: string;
  name: string;
  size: number;
  colorful: boolean;
  sheet: string;
  columns: number;
  sprites: Array<{ name: string; row: number; col: number }>;
  license?: string;
  attribution?: string;
  attributionUrl?: string;
}

/** Registry of colourful PNG-backed sets. Append a new manifest path here
 *  to make the set show up in the panel — no other wiring required. */
const COLORFUL_MANIFEST_URLS: string[] = [
  "/sprites/8x8-demo/manifest.json",
];

/** Encoded "set:sprite" id used in the editor's selected-symbol state.
 *  Single string keeps existing state plumbing unchanged; parse + format
 *  helpers below isolate the encoding from callers. */
export type SpriteKey = `${string}:${string}`;
export function formatSpriteKey(setId: string, name: string): SpriteKey {
  return `${setId}:${name}` as SpriteKey;
}
export function parseSpriteKey(
  key: SpriteKey,
): { setId: string; name: string } {
  const i = key.indexOf(":");
  if (i < 0) {
    // Defensive fallback: a bare string is treated as a Classic-set name,
    // matching pre-sets behaviour. Lets old persisted state degrade gracefully.
    return { setId: "classic-mono", name: key };
  }
  return { setId: key.slice(0, i), name: key.slice(i + 1) };
}

// ============ resolution ============

const PLACEHOLDER_MONO_HEX = "#ffffff";

function buildClassicSet(): SpriteSet {
  // The legacy hand-typed glyphs vary in size (5×5 to 7×7). Pad each one
  // up to 8×8 so the panel's grid is uniform. Padding goes on the right /
  // bottom — keeps the artwork anchored at (0,0).
  const sprites: ResolvedSprite[] = CLASSIC_SPRITE_DATA.map(({ name, rows }) => {
    const h = rows.length;
    const w = rows[0]?.length ?? 0;
    const size = 8;
    const pixels: (string | null)[] = new Array(size * size).fill(null);
    for (let y = 0; y < Math.min(h, size); y++) {
      for (let x = 0; x < Math.min(w, size); x++) {
        if (rows[y][x] === "X") {
          pixels[y * size + x] = PLACEHOLDER_MONO_HEX;
        }
      }
    }
    return { name, pixels };
  });
  return {
    id: "classic-mono",
    name: "Classic (8×8 mono)",
    size: 8,
    colorful: false,
    sprites,
  };
}

async function loadColorfulSet(manifestUrl: string): Promise<SpriteSet> {
  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new Error(
      `sprite manifest ${manifestUrl} → ${res.status} ${res.statusText}`,
    );
  }
  const manifest = (await res.json()) as SpriteSetManifest;
  const pixelsByName = await decodeSheet(manifest);
  return {
    id: manifest.id,
    name: manifest.name,
    size: manifest.size,
    colorful: manifest.colorful,
    license: manifest.license,
    attribution: manifest.attribution,
    attributionUrl: manifest.attributionUrl,
    sprites: manifest.sprites.map((s) => ({
      name: s.name,
      pixels: pixelsByName.get(s.name) ?? new Array(manifest.size * manifest.size).fill(null),
    })),
  };
}

/** Decode the sheet PNG into one (string|null)[] per sprite, keyed by name.
 *  Uses a <canvas> via Image — works in any modern browser, never runs SSR. */
async function decodeSheet(
  manifest: SpriteSetManifest,
): Promise<Map<string, (string | null)[]>> {
  if (typeof window === "undefined") {
    // SSR: nothing meaningful to decode — return empty so callers stay safe.
    return new Map();
  }
  const img = await loadImage(manifest.sheet);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context — cannot decode sprite sheet");
  ctx.drawImage(img, 0, 0);

  const out = new Map<string, (string | null)[]>();
  const sz = manifest.size;
  // Alpha threshold for "filled vs. empty". Anti-aliased sprite edges land
  // somewhere between 0 and 255 — anything ≥128 counts as filled. Per-set
  // override could go in the manifest later if a pack needs a different cut.
  const ALPHA_CUTOFF = 128;
  for (const s of manifest.sprites) {
    const sx0 = s.col * sz;
    const sy0 = s.row * sz;
    const data = ctx.getImageData(sx0, sy0, sz, sz).data;
    const pixels: (string | null)[] = new Array(sz * sz).fill(null);
    for (let y = 0; y < sz; y++) {
      for (let x = 0; x < sz; x++) {
        const i = (y * sz + x) * 4;
        const a = data[i + 3];
        if (a < ALPHA_CUTOFF) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        pixels[y * sz + x] =
          "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      }
    }
    out.set(s.name, pixels);
  }
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error(`failed to load sprite sheet ${src}`));
    img.src = src;
  });
}

// ============ public API ============

let allSetsPromise: Promise<SpriteSet[]> | null = null;

/** Resolve every registered set into ready-to-use SpriteSet objects.
 *  Returns the same Promise on repeat calls so PNGs only decode once. */
export function loadAllSpriteSets(): Promise<SpriteSet[]> {
  if (!allSetsPromise) {
    allSetsPromise = (async () => {
      const classic = buildClassicSet();
      // Run colourful loads in parallel; on failure, the set is dropped from
      // the list with a console warning rather than torching the whole panel.
      const colorful = await Promise.all(
        COLORFUL_MANIFEST_URLS.map(async (url) => {
          try {
            return await loadColorfulSet(url);
          } catch (err) {
            console.warn(`sprite set ${url} failed to load:`, err);
            return null;
          }
        }),
      );
      return [classic, ...colorful.filter((s): s is SpriteSet => s !== null)];
    })();
  }
  return allSetsPromise;
}

/** Pixel data for a single sprite, parsed from the editor's selected-symbol
 *  key. Returns null when the key resolves to nothing (stale set / sprite). */
export function spritePixelsByKey(
  sets: SpriteSet[],
  key: SpriteKey,
): { pixels: (string | null)[]; size: number; colorful: boolean } | null {
  const { setId, name } = parseSpriteKey(key);
  const set = sets.find((s) => s.id === setId);
  if (!set) return null;
  const sprite = set.sprites.find((s) => s.name === name);
  if (!sprite) return null;
  return { pixels: sprite.pixels, size: set.size, colorful: set.colorful };
}
