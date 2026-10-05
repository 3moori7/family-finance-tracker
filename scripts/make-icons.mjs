// Generates the app icons (solid teal tile with a white coin) without any image library.
import fs from "node:fs";
import zlib from "node:zlib";

function crc32(buf) {
  let c, crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, { maskable }) {
  const bg = [15, 110, 98], fg = [255, 255, 255], ring = [217, 239, 233];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = size / 2;
  // maskable icons need a safe zone: keep the art inside ~60% of the canvas
  const R = size * (maskable ? 0.22 : 0.3);
  const corner = maskable ? 0 : size * 0.22;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      // rounded-rect alpha for non-maskable
      let a = 255;
      if (corner > 0) {
        const dx = Math.max(corner - x, 0, x - (size - 1 - corner));
        const dy = Math.max(corner - y, 0, y - (size - 1 - corner));
        if (dx * dx + dy * dy > corner * corner) a = 0;
      }
      const d = Math.hypot(x - c, y - c);
      let col = bg;
      if (d <= R) col = fg;
      if (d <= R * 0.72 && d >= R * 0.58) col = ring;
      // a small vertical bar in the middle of the coin
      if (Math.abs(x - c) < R * 0.07 && Math.abs(y - c) < R * 0.4) col = bg;
      raw[i] = col[0]; raw[i + 1] = col[1]; raw[i + 2] = col[2]; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}
fs.mkdirSync("public/icons", { recursive: true });
fs.writeFileSync("public/icons/icon-192.png", png(192, {}));
fs.writeFileSync("public/icons/icon-512.png", png(512, {}));
fs.writeFileSync("public/icons/maskable-512.png", png(512, { maskable: true }));
fs.writeFileSync("public/icons/apple-touch-icon.png", png(180, { maskable: true }));
console.log("icons written");
