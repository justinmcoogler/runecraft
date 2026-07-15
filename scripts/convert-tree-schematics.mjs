// Convert a folder of classic MCEdit .schematic trees (gzipped NBT) into
// the game's compact tree-model JSON. Usage:
//   node game/scripts/convert-tree-schematics.mjs "<dir with *.schematic>"
// Output: game/src/content/trees-data.json
//
// Each tree becomes { id, species, w, h, d, vox } where vox is base64 of
// 4-byte voxels (x, y, z, kind): x/z biased +32, kind 0 = log, 1 = leaves.
// Species comes from the majority log species in the schematic. Trees are
// normalized so the trunk-base centroid sits at (0, 0, 0).

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { gunzipSync } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const SRC = process.argv[2];
if (!SRC) {
  console.error("usage: node convert-tree-schematics.mjs <schematic dir>");
  process.exit(1);
}

function parseNbt(buf) {
  let pos = 0;
  const u8 = () => buf[pos++];
  const i16 = () => { const v = buf.readInt16BE(pos); pos += 2; return v; };
  const i32 = () => { const v = buf.readInt32BE(pos); pos += 4; return v; };
  const str = () => { const n = buf.readUInt16BE(pos); pos += 2; const s = buf.toString("utf8", pos, pos + n); pos += n; return s; };
  function payload(t) {
    switch (t) {
      case 1: return u8();
      case 2: return i16();
      case 3: return i32();
      case 4: pos += 8; return 0;
      case 5: pos += 4; return 0;
      case 6: pos += 8; return 0;
      case 7: { const n = i32(); const b = buf.subarray(pos, pos + n); pos += n; return b; }
      case 8: return str();
      case 9: { const et = u8(); const n = i32(); const out = []; for (let i = 0; i < n; i++) out.push(payload(et)); return out; }
      case 10: { const d = {}; for (;;) { const tt = u8(); if (tt === 0) break; d[str()] = payload(tt); } return d; }
      case 11: { const n = i32(); pos += 4 * n; return []; }
      case 12: { const n = i32(); pos += 8 * n; return []; }
      default: throw new Error(`bad NBT tag ${t} at ${pos}`);
    }
  }
  const t = u8();
  str(); // root name
  return payload(t);
}

const LOG_SPECIES = { 17: ["oak", "spruce", "birch", "jungle"], 162: ["acacia", "darkoak"] };
const LEAF_IDS = new Set([18, 161]);

const files = readdirSync(SRC).filter((f) => f.endsWith(".schematic")).sort();
const trees = [];
const speciesCount = {};
const skipped = [];

for (const f of files) {
  const root = parseNbt(gunzipSync(readFileSync(join(SRC, f))));
  const W = root.Width, H = root.Height, L = root.Length;
  const blocks = root.Blocks, data = root.Data;
  const logs = [];
  const leaves = [];
  const logSpecies = {};
  for (let y = 0; y < H; y++) {
    for (let z = 0; z < L; z++) {
      for (let x = 0; x < W; x++) {
        const i = (y * L + z) * W + x;
        const b = blocks[i];
        if (b === 17 || b === 162) {
          logs.push([x, y, z]);
          const sp = LOG_SPECIES[b][data[i] & 3] ?? "oak";
          logSpecies[sp] = (logSpecies[sp] || 0) + 1;
        } else if (LEAF_IDS.has(b)) {
          leaves.push([x, y, z]);
        }
      }
    }
  }
  if (logs.length === 0) { skipped.push(f); continue; }
  const species = Object.entries(logSpecies).sort((a, b) => b[1] - a[1])[0][0];
  // Trunk base: log cells on the lowest log layer; recenter on their centroid.
  const minY = Math.min(...logs.map((v) => v[1]));
  const base = logs.filter((v) => v[1] === minY);
  const cx = Math.round(base.reduce((s, v) => s + v[0], 0) / base.length);
  const cz = Math.round(base.reduce((s, v) => s + v[2], 0) / base.length);
  // Drop voxels enclosed on all six sides — they can never be seen, and
  // leaves' interiors are most of a schematic's bulk.
  const solid = new Set();
  for (const [x, y, z] of [...logs, ...leaves]) solid.add(`${x},${y},${z}`);
  const exposed = ([x, y, z]) =>
    !solid.has(`${x + 1},${y},${z}`) || !solid.has(`${x - 1},${y},${z}`) ||
    !solid.has(`${x},${y + 1},${z}`) || !solid.has(`${x},${y - 1},${z}`) ||
    !solid.has(`${x},${y},${z + 1}`) || !solid.has(`${x},${y},${z - 1}`);
  const kept = [];
  let maxAbs = 0;
  let maxH = 0;
  for (const [kind, list] of [[0, logs], [1, leaves]]) {
    for (const [x, y, z] of list) {
      if (!exposed([x, y, z])) continue;
      const dx = x - cx, dy = y - minY, dz = z - cz;
      maxAbs = Math.max(maxAbs, Math.abs(dx), Math.abs(dz));
      maxH = Math.max(maxH, dy);
      kept.push([dx, dy, dz, kind]);
    }
  }
  // Run-length encode along x: (y, z+32, x0+32, len, kind) per run. Leaf
  // layers are long horizontal slabs, so this roughly halves the payload.
  kept.sort((a, b) => a[3] - b[3] || a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  const vox = [];
  for (let i = 0; i < kept.length; ) {
    const [x0, y, z, kind] = kept[i];
    let len = 1;
    while (
      i + len < kept.length &&
      kept[i + len][3] === kind && kept[i + len][1] === y &&
      kept[i + len][2] === z && kept[i + len][0] === x0 + len &&
      len < 255
    ) len++;
    vox.push(y, z + 32, x0 + 32, len, kind);
    i += len;
  }
  if (maxAbs > 31 || maxH > 255) { skipped.push(`${f} (too big: r=${maxAbs} h=${maxH})`); continue; }
  speciesCount[species] = (speciesCount[species] || 0) + 1;
  trees.push({
    id: f.replace(".schematic", ""),
    species,
    r: maxAbs,
    h: maxH + 1,
    logs: logs.length,
    vox: Buffer.from(vox).toString("base64"),
  });
}

const out = { version: 1, trees };
const __dir = dirname(fileURLToPath(import.meta.url));
const dest = join(__dir, "../src/content/trees-data.ts");
const json = JSON.stringify(out);
writeFileSync(
  dest,
  "// Generated by game/scripts/convert-tree-schematics.mjs — do not edit.\n" +
    "// Voxel tree models converted from the user-licensed schematic library.\n" +
    `export const TREES_JSON: string = ${JSON.stringify(json)};\n`,
);
const bytes = json.length;
console.log(`converted ${trees.length}/${files.length} trees -> ${dest} (${(bytes / 1024).toFixed(0)} KB)`);
console.log("species:", speciesCount);
if (skipped.length) console.log("skipped:", skipped.join(", "));
const sizes = trees.map((t) => t.h * 1000 + t.r);
console.log("height range:", Math.min(...trees.map((t) => t.h)), "-", Math.max(...trees.map((t) => t.h)));
