export type RGB = readonly [number, number, number];

export interface NeoPixel {
  readonly length: number;
  [index: number]: RGB;
  write(): void;
  fill(color: RGB): void;
}

export type FlushCallback = (buffer: Uint8ClampedArray) => void;

export function createNeoPixel(numLeds: number, onFlush: FlushCallback): NeoPixel {
  const buffer = new Uint8ClampedArray(numLeds * 3);

  const target = {
    length: numLeds,
    write(): void {
      onFlush(buffer);
    },
    fill(color: RGB): void {
      for (let i = 0; i < numLeds; i++) {
        const base = i * 3;
        buffer[base] = color[0];
        buffer[base + 1] = color[1];
        buffer[base + 2] = color[2];
      }
    },
  };

  return new Proxy(target as unknown as NeoPixel, {
    get(_obj, prop): unknown {
      if (typeof prop === "string") {
        const idx = Number(prop);
        if (Number.isInteger(idx) && idx >= 0 && idx < numLeds) {
          const base = idx * 3;
          return [buffer[base], buffer[base + 1], buffer[base + 2]] as RGB;
        }
      }
      return Reflect.get(target, prop);
    },
    set(_obj, prop, value): boolean {
      if (typeof prop === "string") {
        const idx = Number(prop);
        if (Number.isInteger(idx) && idx >= 0 && idx < numLeds) {
          const c = value as RGB;
          const base = idx * 3;
          buffer[base] = c[0];
          buffer[base + 1] = c[1];
          buffer[base + 2] = c[2];
          return true;
        }
      }
      return Reflect.set(target, prop, value);
    },
  });
}
