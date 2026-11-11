// アプリのアイコン（PNG）を作る。外部ライブラリなし。`npm run icons`
// 青い背景に白いカードを2枚重ねた図柄。
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [29, 78, 216];
const CARD = [255, 255, 255];
const CARD_BACK = [191, 219, 254];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// 角丸長方形の中にあるか（アンチエイリアス用に被覆率 0..1 を返す）
function roundRectCoverage(x, y, rx, ry, rw, rh, r) {
  const cx = Math.min(Math.max(x, rx + r), rx + rw - r);
  const cy = Math.min(Math.max(y, ry + r), ry + rh - r);
  const d = Math.hypot(x - cx, y - cy);
  return Math.min(1, Math.max(0, r + 0.5 - d));
}

function render(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const s = size / 512;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let col = [...BG];
      const layers = [
        [CARD_BACK, 150 * s, 120 * s, 250 * s, 300 * s, 28 * s],
        [CARD, 112 * s, 92 * s, 250 * s, 300 * s, 28 * s],
      ];
      for (const [c, rx, ry, rw, rh, r] of layers) {
        const a = roundRectCoverage(px, py, rx, ry, rw, rh, r);
        col = col.map((v, i) => v * (1 - a) + c[i] * a);
      }
      // カード上の2本線（単語と意味）
      const lines = [
        [150 * s, 200 * s, 150 * s, 30 * s],
        [150 * s, 270 * s, 110 * s, 20 * s],
      ];
      for (const [lx, ly, lw, lh] of lines) {
        const a = roundRectCoverage(px, py, lx, ly, lw, lh, lh / 2);
        col = col.map((v, i) => v * (1 - a) + BG[i] * a);
      }
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(col[0]);
      raw[o + 1] = Math.round(col[1]);
      raw[o + 2] = Math.round(col[2]);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = new URL('../public/icons/', import.meta.url);
mkdirSync(outDir, { recursive: true });
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(new URL(name, outDir), render(size));
  console.log(`${name} (${size}px)`);
}
