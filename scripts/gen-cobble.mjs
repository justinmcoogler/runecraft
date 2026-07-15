// Generate a 16x16 cobblestone tile (grey cobbles in dark mortar) as a base64
// PNG, for DEFAULT_TEXTURES["terrain.cobble"]. Pure Node (zlib), no deps.
import zlib from "node:zlib";

const S = 16;
// Deterministic hash → [0,1)
const h = (x, y) => {
  let n = (x * 374761393 + y * 668265263) >>> 0;
  n = (n ^ (n >>> 13)) * 1274126177 >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
// A handful of cobble seed points; each pixel takes the nearest seed's shade,
// and pixels near a cell boundary become dark mortar.
const seeds = [];
for (let i = 0; i < 7; i++) seeds.push({ x: h(i, 11) * S, y: h(i, 29) * S, s: 0.78 + h(i, 7) * 0.32 });

const px = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let best = 1e9, second = 1e9, shade = 1;
    for (const p of seeds) {
      // wrap-around distance so the tile is seamless
      let dx = Math.abs(x - p.x); dx = Math.min(dx, S - dx);
      let dy = Math.abs(y - p.y); dy = Math.min(dy, S - dy);
      const d = dx * dx + dy * dy;
      if (d < best) { second = best; best = d; shade = p.s; }
      else if (d < second) second = d;
    }
    const edge = Math.sqrt(second) - Math.sqrt(best); // small near borders
    const mortar = edge < 1.1;
    const grain = (h(x, y) - 0.5) * 18;
    let base = mortar ? 74 : 138 * shade;
    let v = Math.max(40, Math.min(210, base + grain));
    const i = (y * S + x) * 4;
    // Slight cool-grey tint.
    px[i] = v; px[i + 1] = v; px[i + 2] = Math.min(255, v + 4); px[i + 3] = 255;
  }
}

// Encode PNG (one IDAT, filter 0 per scanline).
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
console.log(png.toString("base64"));
