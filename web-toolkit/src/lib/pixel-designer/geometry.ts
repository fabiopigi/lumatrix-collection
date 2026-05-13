import type { Point } from "./types";

export function linePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Point[] {
  const out: Point[] = [];
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let cx = x0;
  let cy = y0;
  while (true) {
    out.push({ x: cx, y: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      cx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      cy += sy;
    }
  }
  return out;
}

export function rectPoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
): Point[] {
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  const out: Point[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const onEdge = x === minX || x === maxX || y === minY || y === maxY;
      if (filled || onEdge) out.push({ x, y });
    }
  }
  return out;
}

export function ellipsePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  filled: boolean,
  width: number,
  height: number,
): Point[] {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max(0.5, Math.abs(x1 - x0) / 2 + 0.25);
  const ry = Math.max(0.5, Math.abs(y1 - y0) / 2 + 0.25);
  const inside = (x: number, y: number) => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny <= 1.0;
  };
  const out: Point[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      if (filled) {
        out.push({ x, y });
        continue;
      }
      let edge = false;
      for (let dx = -1; dx <= 1 && !edge; dx++) {
        for (let dy = -1; dy <= 1 && !edge; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (!inside(x + dx, y + dy)) edge = true;
        }
      }
      if (edge) out.push({ x, y });
    }
  }
  return out;
}

export function fillPoints(
  x0: number,
  y0: number,
  width: number,
  height: number,
  pixels: (string | null)[],
): Point[] {
  const target = pixels[y0 * width + x0];
  const out: Point[] = [];
  const seen = new Set<number>();
  const stack: [number, number][] = [[x0, y0]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const key = y * width + x;
    if (seen.has(key)) continue;
    if (pixels[key] !== target) continue;
    seen.add(key);
    out.push({ x, y });
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return out;
}
