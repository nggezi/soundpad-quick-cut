import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outFile = join(root, "build", "icon.ico");

// ---------- Minimal PNG encoder (256x256 ICO entry) ----------
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(size, rgba) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- BMP encoder (16/32/48 ICO entries) ----------
function encodeBmp(size, rgba) {
  const andStride = Math.ceil(size / 32) * 4;
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const srcY = size - 1 - y; // BMP rows are bottom-up
    for (let x = 0; x < size; x++) {
      const si = (srcY * size + x) * 4;
      const di = (y * size + x) * 4;
      xor[di] = rgba[si + 2]; // B
      xor[di + 1] = rgba[si + 1]; // G
      xor[di + 2] = rgba[si]; // R
      xor[di + 3] = rgba[si + 3]; // A
    }
  }
  const header = Buffer.alloc(40);
  header.writeInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // XOR + AND masks
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  header.writeUInt32LE(xor.length, 20);
  return Buffer.concat([header, xor, Buffer.alloc(andStride * size)]);
}

// ---------- Artwork: rounded gradient tile + waveform bars ----------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const top = hexToRgb("#4a9ef6");
  const bottom = hexToRgb("#8b5cf6");
  const half = size / 2;
  const ext = size * 0.46;
  const radius = size * 0.18;
  const barLeft = size * 0.22;
  const barRight = size * 0.78;
  const bars = 23;
  const spacing = (barRight - barLeft) / bars;

  const heights = [];
  for (let i = 0; i < bars; i++) {
    const s = Math.abs(Math.sin(i * 1.9)) * 0.5 + Math.abs(Math.cos(i * 0.77)) * 0.5;
    heights.push(size * (0.1 + 0.28 * s) * (i % 4 === 0 ? 1.12 : 1));
  }

  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = top.r + (bottom.r - top.r) * t;
    const g = top.g + (bottom.g - top.g) * t;
    const b = top.b + (bottom.b - top.b) * t;
    for (let x = 0; x < size; x++) {
      const qx = Math.abs(x - half) - ext + radius;
      const qy = Math.abs(y - half) - ext + radius;
      const dist =
        Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
        Math.min(Math.max(qx, qy), 0) -
        radius;
      const alpha = Math.max(0, Math.min(1, 0.5 - dist));

      let pr = r;
      let pg = g;
      let pb = b;
      const rel = (x - barLeft) / (barRight - barLeft);
      const idx = rel * bars;
      const bi = Math.floor(idx);
      if (bi >= 0 && bi < bars) {
        const inBar = Math.abs(idx - bi - 0.5) < 0.3;
        const hw = heights[bi] / 2;
        if (inBar && Math.abs(y - half) <= hw) {
          const mix = 0.85;
          pr = 255 * mix + r * (1 - mix);
          pg = 255 * mix + g * (1 - mix);
          pb = 255 * mix + b * (1 - mix);
        }
      }

      const di = (y * size + x) * 4;
      rgba[di] = Math.round(pr);
      rgba[di + 1] = Math.round(pg);
      rgba[di + 2] = Math.round(pb);
      rgba[di + 3] = Math.round(alpha * 255);
    }
  }
  return rgba;
}

// ---------- ICO assembly ----------
const entries = [];
for (const size of [16, 32, 48]) {
  entries.push({ size, data: encodeBmp(size, drawIcon(size)) });
}
entries.push({ size: 256, data: encodePng(256, drawIcon(256)) });

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(entries.length, 4);

const dirs = [];
let offset = 6 + entries.length * 16;
for (const entry of entries) {
  const dir = Buffer.alloc(16);
  dir[0] = entry.size >= 256 ? 0 : entry.size;
  dir[1] = entry.size >= 256 ? 0 : entry.size;
  dir[2] = 0;
  dir[3] = 0;
  dir.writeUInt16LE(1, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(entry.data.length, 8);
  dir.writeUInt32LE(offset, 12);
  dirs.push(dir);
  offset += entry.data.length;
}

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, Buffer.concat([header, ...dirs, ...entries.map((e) => e.data)]));
console.log(`[generate-icon] wrote ${outFile}`);
