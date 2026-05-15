/**
 * Helpers for creating a new variant from an existing one.
 *
 * `scaleVariant` is nearest-neighbour integer upscale of the source, centred
 * on the target canvas. The scale factor is the largest s such that
 * s*srcW ≤ dstW AND s*srcH ≤ dstH; if either source axis is bigger than the
 * target, the result is `null` and the caller should refuse the action.
 *
 * `centerVariant` is a 1:1 paste of the source pixels at the centre of the
 * target canvas; the surround is left blank. Source must fit within target;
 * otherwise `null`.
 */

export interface VariantSource {
  width: number;
  height: number;
  pixels: (string | null)[];
}

export interface VariantTarget {
  width: number;
  height: number;
}

export function fits(src: VariantSource, dst: VariantTarget): boolean {
  return src.width <= dst.width && src.height <= dst.height;
}

export function scaleVariant(
  src: VariantSource,
  dst: VariantTarget,
): (string | null)[] | null {
  if (!fits(src, dst)) return null;
  const scale = Math.max(
    1,
    Math.min(Math.floor(dst.width / src.width), Math.floor(dst.height / src.height)),
  );
  const drawnW = src.width * scale;
  const drawnH = src.height * scale;
  const offX = Math.floor((dst.width - drawnW) / 2);
  const offY = Math.floor((dst.height - drawnH) / 2);
  const out: (string | null)[] = new Array(dst.width * dst.height).fill(null);
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const c = src.pixels[sy * src.width + sx];
      if (!c) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = offX + sx * scale + dx;
          const y = offY + sy * scale + dy;
          out[y * dst.width + x] = c;
        }
      }
    }
  }
  return out;
}

export function centerVariant(
  src: VariantSource,
  dst: VariantTarget,
): (string | null)[] | null {
  if (!fits(src, dst)) return null;
  const offX = Math.floor((dst.width - src.width) / 2);
  const offY = Math.floor((dst.height - src.height) / 2);
  const out: (string | null)[] = new Array(dst.width * dst.height).fill(null);
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const c = src.pixels[sy * src.width + sx];
      if (!c) continue;
      out[(offY + sy) * dst.width + (offX + sx)] = c;
    }
  }
  return out;
}
