// Bake the game's DEFAULT texture set from a resource pack the project is
// licensed to ship. Runs the same alias pipeline as the in-game importer
// and emits game/src/render/default-textures.ts with PNG-encoded tiles
// (decoded synchronously at boot by src/texturepacks/png.ts) plus the
// pack's entity textures (mob skins, chest atlas) as-is.
//
//   node game/scripts/bake-default-textures.mjs <pack.zip> [size]
//
// size (default 16) bakes block art at higher native resolutions (e.g. 64
// for a 64x pack). Held-item sprites (sprite.item.*) always bake at 16 —
// the character rig voxelizes them pixel-by-pixel at Minecraft item scale.

import { build } from "esbuild";
import { readFileSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { deflateSync } from "zlib";
import { decodePng } from "./png-color.mjs";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , packZip, sizeArg] = process.argv;
const bakeSize = Number(sizeArg ?? 16);
if (!packZip || !Number.isInteger(bakeSize) || bakeSize < 16 || bakeSize > 128) {
  console.error("usage: node game/scripts/bake-default-textures.mjs <pack.zip> [size 16..128]");
  process.exit(1);
}

const bundled = await build({
  stdin: {
    contents:
      'export { extractCandidates, planAliases } from "./src/texturepacks/importer";' +
      'export { planEntityTextures } from "./src/texturepacks/entities";',
    resolveDir: gameDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const importer = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const bytes = new Uint8Array(readFileSync(packZip));
const extracted = importer.extractCandidates(bytes);
if (extracted.error) {
  console.error(`pack error: ${extracted.error}`);
  process.exit(1);
}
const { planned, missing } = importer.planAliases(Object.keys(extracted.entries));

/** First square frame, nearest-neighbor scaled to size x size, tint multiplied. */
function normalize(decoded, tint, size) {
  const frame = Math.min(decoded.width, decoded.height);
  const out = new Uint8Array(size * size * 4);
  const t = tint
    ? [parseInt(tint.slice(1, 3), 16), parseInt(tint.slice(3, 5), 16), parseInt(tint.slice(5, 7), 16)]
    : null;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(frame - 1, Math.floor((x * frame) / size));
      const sy = Math.min(frame - 1, Math.floor((y * frame) / size));
      const src = (sy * decoded.width + sx) * 4;
      const dst = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const v = decoded.rgba[src + c];
        out[dst + c] = t ? Math.round((v * t[c]) / 255) : v;
      }
      out[dst + 3] = decoded.rgba[src + 3];
    }
  }
  return out;
}

// --- Minimal PNG encoder (RGBA8, filter 0) so tiles ship compressed. ---
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const entries = [];
const failed = [];
for (const plan of planned) {
  const decoded = decodePng(extracted.entries[plan.file]);
  if (!decoded || decoded.width < 8) {
    failed.push(plan.file);
    continue;
  }
  // Item sprites stay 16x16 (they are voxelized per pixel in the hand).
  const size = plan.materialId.startsWith("sprite.item.") ? 16 : bakeSize;
  const rgba = normalize(decoded, plan.tint, size);
  entries.push([plan.materialId, encodePng(rgba, size, size).toString("base64")]);
}

if (entries.length < 10) {
  console.error(`only ${entries.length} textures baked — wrong pack?`);
  process.exit(1);
}

// Entity textures ship as the pack's own PNG bytes (already compressed);
// each must round-trip through our decoder, since the browser decodes with
// the same algorithm at boot.
const entityEntries = [];
for (const plan of importer.planEntityTextures(Object.keys(extracted.entityEntries))) {
  const raw = extracted.entityEntries[plan.path];
  const decoded = decodePng(raw);
  if (!decoded || decoded.width < 32 || raw.length > 1_500_000) {
    failed.push(plan.path);
    continue;
  }
  entityEntries.push([plan.key, Buffer.from(raw).toString("base64")]);
}

const faithful = /faithful/i.test(basename(packZip))
  ? `// from "Classic Faithful 64x Jappa" (https://faithfulpack.net/) — placeholder
// art for testing under the Faithful License v3; see game/CREDITS.md and
// game/docs/third-party/FAITHFUL-LICENSE.txt.
`
  : `// See game/CREDITS.md for third-party art credits and licenses.
`;
const out = join(gameDir, "src/render/default-textures.ts");
writeFileSync(
  out,
  `// Default texture set baked by bake-default-textures.mjs
${faithful}// Each entry is a base64 PNG decoded synchronously at boot
// (src/texturepacks/png.ts). Do not hand-edit; re-run:
//   node game/scripts/bake-default-textures.mjs <pack.zip> [size]
//
// size (default 16) bakes block art at higher native resolutions (e.g. 64
// for a 64x pack). Held-item sprites (sprite.item.*) always bake at 16 —
// the character rig voxelizes them pixel-by-pixel at Minecraft item scale.
// Entity textures (mob skins, the chest atlas) are the pack's own PNGs at
// native size, keyed by logical skin keys from texturepacks/entities.ts.

export const DEFAULT_TEXTURES: Record<string, string> = {
${entries.map(([k, v]) => `  "${k}": "${v}",`).join("\n")}
};

export const DEFAULT_ENTITY_TEXTURES: Record<string, string> = {
${entityEntries.map(([k, v]) => `  "${k}": "${v}",`).join("\n")}
};
`,
);
console.log(`baked  ${out} (${entries.length} materials, ${entityEntries.length} entity textures from ${basename(packZip)})`);
if (missing.length > 0) console.log(`kept   built-in art for: ${missing.join(", ")}`);
if (failed.length > 0) console.log(`failed to decode: ${failed.join(", ")}`);
