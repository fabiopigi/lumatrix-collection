/** Decode a raster image file (PNG or GIF) into per-frame pixel arrays sized
 *  to a given hardware grid. Supports upscaled pixel art: if the image is an
 *  integer multiple of the hardware dimensions, each hardware pixel is sampled
 *  at the centre of its matching block (so a 128×128 PNG of 8×8 art reads
 *  cleanly).
 *
 *  GIF frames are decoded via the browser's WebCodecs `ImageDecoder`, which
 *  composites disposal frames internally — each `VideoFrame` we receive is
 *  the fully-composed canvas at that point in the animation, with the GIF's
 *  global dimensions. Per-frame delay comes through as `VideoFrame.duration`
 *  (microseconds).
 *
 *  Non-integer ratios are rejected — pixel art at, say, 100×100 for an 8×8
 *  grid would sample inconsistently across rows, so we'd rather fail loudly
 *  than guess.
 */

const OFF_ALPHA_THRESHOLD = 128;

/** Default if a GIF frame has no delay set or a delay of 0cs; matches what
 *  most GIF viewers substitute (browsers tend to clamp 0/1cs up to ~100ms). */
const DEFAULT_GIF_FRAME_MS = 100;

export interface ImageDecodeResult {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

interface GifFrame extends ImageDecodeResult {
  durationMs: number;
}

async function decodeStillImage(file: File): Promise<ImageDecodeResult> {
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

interface ImageDecoderLike {
  tracks: {
    ready: Promise<void>;
    selectedTrack: { frameCount: number } | null;
  };
  completed: Promise<void>;
  decode(init: { frameIndex: number }): Promise<{ image: VideoFrame }>;
  close?: () => void;
}

interface ImageDecoderCtor {
  new (init: { data: ArrayBuffer | ReadableStream; type: string }): ImageDecoderLike;
}

async function decodeGifFrames(file: File): Promise<GifFrame[]> {
  const Ctor = (globalThis as unknown as { ImageDecoder?: ImageDecoderCtor })
    .ImageDecoder;
  if (!Ctor) {
    throw new Error(
      "This browser doesn't support animated GIF decoding (WebCodecs ImageDecoder required). Try a recent Chrome, Safari, or Firefox.",
    );
  }
  const buffer = await file.arrayBuffer();
  const decoder = new Ctor({ data: buffer, type: file.type || "image/gif" });
  try {
    await decoder.tracks.ready;
    // Wait until metadata for every frame is parsed — `frameCount` is only
    // final after the demuxer has seen the whole file.
    await decoder.completed;
    const track = decoder.tracks.selectedTrack;
    if (!track) throw new Error("Could not read GIF track metadata");
    const frameCount = Math.max(1, track.frameCount);
    const out: GifFrame[] = [];
    for (let i = 0; i < frameCount; i++) {
      const { image: vf } = await decoder.decode({ frameIndex: i });
      try {
        const canvas = document.createElement("canvas");
        canvas.width = vf.codedWidth;
        canvas.height = vf.codedHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Could not create 2D canvas context");
        ctx.drawImage(vf, 0, 0);
        const img = ctx.getImageData(0, 0, vf.codedWidth, vf.codedHeight);
        // VideoFrame.duration is in microseconds. GIF authors sometimes leave
        // delay at 0 expecting "use viewer default" — fall back to 100ms so
        // a single bad frame doesn't blink past instantly.
        const dur = vf.duration ?? 0;
        const durationMs =
          dur > 0 ? Math.max(10, Math.round(dur / 1000)) : DEFAULT_GIF_FRAME_MS;
        out.push({
          width: vf.codedWidth,
          height: vf.codedHeight,
          data: img.data,
          durationMs,
        });
      } finally {
        vf.close();
      }
    }
    return out;
  } finally {
    decoder.close?.();
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

function validateDims(
  imgWidth: number,
  imgHeight: number,
  hwWidth: number,
  hwHeight: number,
): void {
  if (imgWidth % hwWidth !== 0 || imgHeight % hwHeight !== 0) {
    throw new Error(
      `Image is ${imgWidth}×${imgHeight}, which is not an integer multiple of the ${hwWidth}×${hwHeight} hardware grid. ` +
        `Use a ${hwWidth}×${hwHeight}, ${hwWidth * 2}×${hwHeight * 2}, ${hwWidth * 4}×${hwHeight * 4}, … image.`,
    );
  }
  if (imgWidth / hwWidth !== imgHeight / hwHeight) {
    throw new Error(
      `Image aspect ratio (${imgWidth}×${imgHeight}) doesn't match the ${hwWidth}×${hwHeight} hardware grid.`,
    );
  }
}

export interface ImportedFrame {
  /** Suggested page label — filename (or filename + frame index for GIFs). */
  label: string;
  pixels: (string | null)[];
  /** Frame display time in ms. Set for GIF frames; undefined for stills. */
  durationMs?: number;
}

function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, "") || "Imported image";
}

function isGifFile(file: File): boolean {
  return file.type === "image/gif" || /\.gif$/i.test(file.name);
}

/** Decode `file` (PNG or GIF) and produce one frame per image / GIF frame,
 *  sampled to the given hardware grid. Throws if the image's dimensions are
 *  not an integer multiple of the hardware's. */
export async function importImageForHardware(
  file: File,
  hwWidth: number,
  hwHeight: number,
): Promise<ImportedFrame[]> {
  const baseName = stripExt(file.name);

  if (isGifFile(file)) {
    let frames: GifFrame[];
    try {
      frames = await decodeGifFrames(file);
    } catch (err) {
      throw new Error(`Could not decode GIF: ${(err as Error).message}`);
    }
    if (frames.length === 0) {
      throw new Error("GIF contains no frames");
    }
    validateDims(frames[0].width, frames[0].height, hwWidth, hwHeight);
    return frames.map((f, i) => ({
      label: frames.length > 1 ? `${baseName} ${i + 1}` : baseName,
      pixels: sampleToGrid(f, hwWidth, hwHeight),
      durationMs: f.durationMs,
    }));
  }

  let img: ImageDecodeResult;
  try {
    img = await decodeStillImage(file);
  } catch (err) {
    throw new Error(`Could not decode image: ${(err as Error).message}`);
  }
  validateDims(img.width, img.height, hwWidth, hwHeight);
  return [
    {
      label: baseName,
      pixels: sampleToGrid(img, hwWidth, hwHeight),
    },
  ];
}
