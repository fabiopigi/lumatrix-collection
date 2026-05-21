#!/usr/bin/env node
// Generates a stand-in colourful sprite sheet for LumenDesigner's sprite
// library, plus a matching manifest.json. Lets us prove out the loader and
// the panel UI before any real artwork lands. Idempotent — safe to re-run.
//
// Output:
//   public/sprites/8x8-demo/sheet.png
//   public/sprites/8x8-demo/manifest.json
//
// Sprites are defined inline as ASCII grids; the palette letters resolve to
// hex colours below. Edit, re-run, commit the regenerated PNG + manifest.

import { writeFile, mkdir } from "node:fs/promises";
import { deflateSync, crc32 } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "..", "public", "sprites", "8x8-demo");

const PAL = {
  ".": null,
  R: "#ff3030", r: "#800000",
  P: "#ff80c0",
  Y: "#ffd700", y: "#cc9000",
  G: "#40c040", g: "#208020",
  W: "#ffffff", K: "#000000",
  L: "#c0a060", D: "#604030",
  B: "#4080ff", O: "#ff8000",
};

const SPRITES = [
  { name: "heart", rows: [
    ".RR..RR.",
    "RRRRRRRR",
    "RRRRRRRR",
    "RRRRRRRR",
    ".RRRRRR.",
    "..RRRR..",
    "...RR...",
    "........",
  ]},
  { name: "smiley", rows: [
    ".YYYYYY.",
    "YYYYYYYY",
    "YKYYYYKY",
    "YYYYYYYY",
    "YYYYYYYY",
    "YKYYYYKY",
    ".YKKKKY.",
    "..YYYY..",
  ]},
  { name: "star", rows: [
    "...YY...",
    "...YY...",
    "YYYYYYYY",
    ".YYYYYY.",
    "..YYYY..",
    ".YYYYYY.",
    "YY....YY",
    "........",
  ]},
  { name: "ghost", rows: [
    "..WWWW..",
    ".WWWWWW.",
    "WWKWWKWW",
    "WWKWWKWW",
    "WWWWWWWW",
    "WWWWWWWW",
    "WWWWWWWW",
    "W.W.W.W.",
  ]},
  { name: "bug", rows: [
    ".G....G.",
    "G.GGGG.G",
    "GGGGGGGG",
    "GGKGGKGG",
    "GGGGGGGG",
    "GGGGGGGG",
    ".G.GG.G.",
    "G......G",
  ]},
  { name: "coin", rows: [
    "..yyyy..",
    ".yYYYYy.",
    "yYYYYYYy",
    "yYYYYYYy",
    "yYYYYYYy",
    "yYYYYYYy",
    ".yYYYYy.",
    "..yyyy..",
  ]},
  { name: "apple", rows: [
    "....G...",
    "....G...",
    "..RR.RR.",
    ".RRRRRRR",
    "RRRRRRRR",
    "RRRRRRRR",
    ".RRRRRR.",
    "..RRRR..",
  ]},
  { name: "mushroom", rows: [
    "..RRRR..",
    ".RWRRWR.",
    "RWRRRRWR",
    "RRRRRRRR",
    ".WWWWWW.",
    ".WLLLLW.",
    "..WLLW..",
    "..WLLW..",
  ]},
];

const SIZE = 8;
const COLS = 4;
const ROWS = Math.ceil(SPRITES.length / COLS);

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

// Build a flat RGBA buffer for a (COLS*SIZE) × (ROWS*SIZE) image.
function buildRgba() {
  const w = COLS * SIZE;
  const h = ROWS * SIZE;
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < SPRITES.length; i++) {
    const sprite = SPRITES[i];
    const sCol = i % COLS;
    const sRow = Math.floor(i / COLS);
    for (let y = 0; y < SIZE; y++) {
      const line = sprite.rows[y];
      for (let x = 0; x < SIZE; x++) {
        const ch = line[x];
        if (!(ch in PAL)) throw new Error(`unknown palette char ${ch} in ${sprite.name}`);
        const hex = PAL[ch];
        const px = sCol * SIZE + x;
        const py = sRow * SIZE + y;
        const off = (py * w + px) * 4;
        if (hex === null) {
          buf[off + 3] = 0; // transparent
        } else {
          const [r, g, b] = hexToRgb(hex);
          buf[off] = r;
          buf[off + 1] = g;
          buf[off + 2] = b;
          buf[off + 3] = 255;
        }
      }
    }
  }
  return { buf, w, h };
}

// Minimal PNG encoder: signature + IHDR + IDAT + IEND, color type 6 (RGBA),
// bit depth 8, no interlace. Each scanline is prefixed with a filter byte
// (0 = none) before deflation.
function encodePng(rgba, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Apply filter byte 0 per scanline, then deflate.
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = deflateSync(raw);

  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  // Node 22 exposes zlib.crc32 (added in 22.2). We compute CRC32 of type+data.
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const { buf, w, h } = buildRgba();
  const png = encodePng(buf, w, h);
  await writeFile(path.join(OUT_DIR, "sheet.png"), png);

  const manifest = {
    id: "8x8-demo",
    name: "Demo (8×8 colourful)",
    size: SIZE,
    colorful: true,
    sheet: "/sprites/8x8-demo/sheet.png",
    columns: COLS,
    sprites: SPRITES.map((s, i) => ({
      name: s.name,
      row: Math.floor(i / COLS),
      col: i % COLS,
    })),
    license: "Stand-in (placeholder asset)",
    attribution: "LumenLab",
  };
  await writeFile(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  console.log(
    `[sprite-sheet] wrote ${path.relative(process.cwd(), OUT_DIR)} — ${SPRITES.length} sprites, sheet ${w}×${h}`,
  );
}

main();
