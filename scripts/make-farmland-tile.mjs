// One-off: synthesize a "terrain.farmland" tile from the baked dirt texture —
// darkened furrow rows so crop fields read as tilled rows, not raw dirt.
// Appends/updates the entry in src/render/default-textures.ts.
import { readFileSync, writeFileSync } from "fs";
import { deflateSync, inflateSync } from "zlib";

const file = "src/render/default-textures.ts";
const src = readFileSync(file, "utf8");
const m = src.match(/"terrain\.dirt": "([^"]+)"/);
if (!m) throw new Error("terrain.dirt not found");

// --- minimal PNG decode (8-bit RGBA/RGB, filters 0-4) ---
function decodePng(buf) {
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("bit depth " + bitDepth);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : (() => { throw new Error("colorType " + colorType); })();
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const rgba = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = row[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      rgba[(y * width + x) * 4] = cur[x * ch];
      rgba[(y * width + x) * 4 + 1] = cur[x * ch + 1];
      rgba[(y * width + x) * 4 + 2] = cur[x * ch + 2];
      rgba[(y * width + x) * 4 + 3] = ch === 4 ? cur[x * ch + 3] : 255;
    }
    prev.set(cur);
  }
  return { width, height, rgba };
}

// --- minimal PNG encode (RGBA, filter 0) ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(b) { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0); out.write(type, 4, "ascii"); data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePng(rgba, w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dirt = decodePng(Buffer.from(m[1], "base64"));
const { width: W, height: H } = dirt;
const out = new Uint8Array(dirt.rgba);
// Furrows: repeating ridge-and-trench rows (period H/8), trenches darkened,
// ridge crests lightened — reads as tilled crop rows from the top-down camera.
const period = Math.max(4, Math.round(H / 8));
for (let y = 0; y < H; y++) {
  const ph = y % period;
  const trench = ph < Math.max(1, Math.round(period * 0.375));
  const crest = ph === period - 1;
  const mul = trench ? 0.52 : crest ? 1.14 : 0.94;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    // A touch of along-row variation so furrows aren't laser-straight bands.
    const jitter = ((x * 7 + y * 13) % 5) * 0.012;
    for (let c = 0; c < 3; c++) out[i + c] = Math.min(255, Math.round(out[i + c] * (mul + jitter)));
  }
}
const b64 = encodePng(out, W, H).toString("base64");
const entry = `  "terrain.farmland": "${b64}",`;
const updated = src.includes('"terrain.farmland"')
  ? src.replace(/ {2}"terrain\.farmland": "[^"]+",/, entry)
  : src.replace(/( {2}"terrain\.dirt": "[^"]+",)/, `$1\n${entry}`);
writeFileSync(file, updated);
console.log(`terrain.farmland written (${W}x${H})`);
