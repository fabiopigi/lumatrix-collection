/** Decode a raster image file (PNG) into a pixel array sized to a given
 *  hardware grid. Supports upscaled pixel art: if the image is an integer
 *  multiple of the hardware dimensions, each hardware pixel is sampled at the
 *  centre of its matching block (so a 128×128 PNG of 8×8 art reads cleanly).
 *
 *  Non-integer ratios are rejected — pixel art at, say, 100×100 for an 8×8
 *  grid would sample inconsistently across rows, so we'd rather fail loudly
 *  than guess.
 */

const OFF_ALPHA_THRESHOLD = 128;

export interface ImageDecodeResult {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

async function decodeImageFile(file: File): Promise<ImageDecodeResult> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not create 2D canvas context");
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, data: img.data };
  } finally {
    bitmap.close?.();
  }
}

function toHexChannel(v: number): string {
  return v.toString(16).padStart(2, "0");
}

/** Sample the centre of each hardware-pixel-sized block in `img` and return
 *  a flat row-major pixel array. Cells with alpha below the threshold OR a
 *  resolved colour of pure black are returned as null. */
export function sampleToGrid(
  img: ImageDecodeResult,
  hwWidth: number,
  hwHeight: number,
): (string | null)[] {
  const out: (string | null)[] = new Array(hwWidth * hwHeight).fill(null);
  for (let y = 0; y < hwHeight; y++) {
    const sy = Math.floor(((y + 0.5) * img.height) / hwHeight);
    for (let x = 0; x < hwWidth; x++) {
      const sx = Math.floor(((x + 0.5) * img.width) / hwWidth);
      const off = (sy * img.width + sx) * 4;
      const a = img.data[off + 3];
      if (a < OFF_ALPHA_THRESHOLD) continue;
      const r = img.data[off];
      const g = img.data[off + 1];
      const b = img.data[off + 2];
      if (r === 0 && g === 0 && b === 0) continue;
      out[y * hwWidth + x] = `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(b)}`;
    }
  }
  return out;
}

export interface ImageImportResult {
  /** Filename with extension stripped — suitable as a page label. */
  label: string;
  pixels: (string | null)[];
}

/** Decode `file` and produce pixel data for a hardware grid of the given
 *  dimensions. Throws if the image's dimensions are not an integer multiple
 *  of the hardware's. */
export async function importImageForHardware(
  file: File,
  hwWidth: number,
  hwHeight: number,
): Promise<ImageImportResult> {
  let img: ImageDecodeResult;
  try {
    img = await decodeImageFile(file);
  } catch (err) {
    throw new Error(`Could not decode image: ${(err as Error).message}`);
  }

  if (img.width % hwWidth !== 0 || img.height % hwHeight !== 0) {
    throw new Error(
      `Image is ${img.width}×${img.height}, which is not an integer multiple of the ${hwWidth}×${hwHeight} hardware grid. ` +
        `Use a ${hwWidth}×${hwHeight}, ${hwWidth * 2}×${hwHeight * 2}, ${hwWidth * 4}×${hwHeight * 4}, … image.`,
    );
  }

  const sxRatio = img.width / hwWidth;
  const syRatio = img.height / hwHeight;
  if (sxRatio !== syRatio) {
    throw new Error(
      `Image aspect ratio (${img.width}×${img.height}) doesn't match the ${hwWidth}×${hwHeight} hardware grid.`,
    );
  }

  const baseName = file.name.replace(/\.[^./\\]+$/, "");
  return {
    label: baseName || "Imported image",
    pixels: sampleToGrid(img, hwWidth, hwHeight),
  };
}
