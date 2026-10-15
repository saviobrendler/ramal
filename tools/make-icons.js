// Gera os ícones PNG do app (icons/) a partir do desenho do logo, sem dependências.
// Uso: node tools/make-icons.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BLUE = [31, 79, 224], WHITE = [255, 255, 255], SUN = [255, 207, 51];

// Logo no espaço 32x32 (igual ao SVG).
const bez = Array.from({ length: 65 }, (_, i) => {
  const t = i / 64, u = 1 - t;
  return [u ** 3 * 12 + 3 * u * u * t * 12 + 3 * u * t * t * 15 + t ** 3 * 21, u ** 3 * 18 + 3 * u * u * t * 14 + 3 * u * t * t * 11.5 + t ** 3 * 11.5];
});
function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function colorAt(x, y, maskable) {
  if (!maskable) {
    const r = 9, cx = Math.min(Math.max(x, r), 32 - r), cy = Math.min(Math.max(y, r), 32 - r);
    if (Math.hypot(x - cx, y - cy) > r) return null;
  }
  if (Math.hypot(x - 21, y - 11.5) <= 2.6) return SUN;
  if (segDist(x, y, [12, 7], [12, 25]) <= 1.5) return WHITE;
  for (let i = 0; i < bez.length - 1; i++) if (segDist(x, y, bez[i], bez[i + 1]) <= 1.5) return WHITE;
  return BLUE;
}

function render(size, maskable) {
  const S = 4, buf = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.72 : 1, off = (32 - 32 * scale) / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        let x = ((px + (sx + 0.5) / S) / size) * 32, y = ((py + (sy + 0.5) / S) / size) * 32;
        let c;
        if (maskable) {
          const lx = (x - off) / scale, ly = (y - off) / scale;
          c = lx >= 0 && lx <= 32 && ly >= 0 && ly <= 32 ? colorAt(lx, ly, true) : BLUE;
        } else c = colorAt(x, y, false);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const i = (py * size + px) * 4, n = S * S;
      buf[i] = a ? r / a : 0; buf[i + 1] = a ? g / a : 0; buf[i + 2] = a ? b / a : 0; buf[i + 3] = (a / n) * 255;
    }
  }
  return png(size, buf);
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const dir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), render(192, false));
fs.writeFileSync(path.join(dir, 'icon-512.png'), render(512, false));
fs.writeFileSync(path.join(dir, 'maskable-512.png'), render(512, true));
fs.writeFileSync(path.join(dir, 'icon.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#1f4fe0"/><path d="M12 25V7M12 18c0-4 3-6.5 9-6.5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="21" cy="11.5" r="2.6" fill="#ffcf33"/></svg>');
console.log('Ícones gerados em icons/');
