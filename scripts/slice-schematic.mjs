// Slice a combined "asset map" .schematic (a grid of many trees/rocks on a
// shared floor) into individual assets. Trees are re-emitted as classic
// MCEdit .schematic files so convert-tree-schematics.mjs stays the single
// tree pipeline; rocks are written as rocks-data JSON runs.
//
// Usage:
//   node game/scripts/slice-schematic.mjs <combined.schematic> <outdir> [prefix]
//
// Asset classes:
//   tree — component with >= 2 log blocks (ids 17/162) and >= 8 leaves (18/161)
//   rock — stone-family component (stone/cobble/mossy/gravel), 6..4000 blocks,
//          radius <= 12, at least 2 tall, with no wood in it

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { gunzipSync, gzipSync } from "zlib";
import { join } from "path";

const [src, outDir, prefix = "sl"] = process.argv.slice(2);
if (!src || !outDir) {
  console.error("usage: node slice-schematic.mjs <combined.schematic> <outdir> [prefix]");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

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
      default: throw new Error(`tag ${t} @ ${pos}`);
    }
  }
  const t = u8(); str();
  return payload(t);
}

/** Minimal NBT writer for the classic schematic shape. */
function writeSchematic(path, W, H, L, blocks, data) {
  const parts = [];
  const strBuf = (s) => { const b = Buffer.from(s, "utf8"); const len = Buffer.alloc(2); len.writeUInt16BE(b.length); return Buffer.concat([len, b]); };
  const tag = (type, name) => Buffer.concat([Buffer.from([type]), strBuf(name)]);
  const short = (v) => { const b = Buffer.alloc(2); b.writeInt16BE(v); return b; };
  const int = (v) => { const b = Buffer.alloc(4); b.writeInt32BE(v); return b; };
  parts.push(tag(10, "Schematic"));
  parts.push(tag(2, "Height"), short(H));
  parts.push(tag(2, "Length"), short(L));
  parts.push(tag(2, "Width"), short(W));
  parts.push(tag(8, "Materials"), strBuf("Alpha"));
  parts.push(tag(7, "Blocks"), int(blocks.length), Buffer.from(blocks));
  parts.push(tag(7, "Data"), int(data.length), Buffer.from(data));
  parts.push(Buffer.from([0])); // end of root compound
  writeFileSync(path, gzipSync(Buffer.concat(parts)));
}

const LOGS = new Set([17, 162]);
const LEAVES = new Set([18, 161]);
const ROCKY = new Set([1, 4, 13, 48]); // stone, cobble, gravel, mossy cobble

const root = parseNbt(gunzipSync(readFileSync(src)));
const { Width: W, Height: H, Length: L } = root;
const blocks = root.Blocks;
const data = root.Data;
const at = (x, y, z) => (y * L + z) * W + x;

// Collect asset cells only (tiny fraction of the map).
const assetIdx = new Map(); // packed index -> list position
const cells = [];
for (let y = 0; y < H; y++) {
  for (let z = 0; z < L; z++) {
    for (let x = 0; x < W; x++) {
      const i = at(x, y, z);
      const b = blocks[i];
      if (LOGS.has(b) || LEAVES.has(b) || ROCKY.has(b)) {
        assetIdx.set(i, cells.length);
        cells.push([x, y, z, b, data[i]]);
      }
    }
  }
}
console.log(`asset cells: ${cells.length} of ${W}x${H}x${L}`);

// 6-connected components over asset cells.
const compOf = new Int32Array(cells.length).fill(-1);
let nComp = 0;
const stack = [];
for (let s = 0; s < cells.length; s++) {
  if (compOf[s] !== -1) continue;
  const comp = nComp++;
  compOf[s] = comp;
  stack.push(s);
  while (stack.length) {
    const c = stack.pop();
    const [x, y, z] = cells[c];
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= W || ny >= H || nz >= L) continue;
      const li = assetIdx.get(at(nx, ny, nz));
      if (li !== undefined && compOf[li] === -1) {
        compOf[li] = comp;
        stack.push(li);
      }
    }
  }
}
console.log(`components: ${nComp}`);

const byComp = new Map();
for (let i = 0; i < cells.length; i++) {
  let list = byComp.get(compOf[i]);
  if (!list) byComp.set(compOf[i], (list = []));
  list.push(cells[i]);
}

let trees = 0;
let rocks = 0;
const rockModels = [];
for (const list of byComp.values()) {
  let logN = 0, leafN = 0, rockN = 0;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, y, z, b] of list) {
    if (LOGS.has(b)) logN++;
    else if (LEAVES.has(b)) leafN++;
    else rockN++;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x);
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    z0 = Math.min(z0, z); z1 = Math.max(z1, z);
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, l = z1 - z0 + 1;

  if (logN >= 2 && leafN >= 8 && rockN === 0 && w <= 64 && l <= 64 && h <= 100) {
    // A tree: re-emit as its own schematic (wood + leaves only).
    const sb = new Uint8Array(w * h * l);
    const sd = new Uint8Array(w * h * l);
    for (const [x, y, z, b, d] of list) {
      if (!LOGS.has(b) && !LEAVES.has(b)) continue;
      const i = ((y - y0) * l + (z - z0)) * w + (x - x0);
      sb[i] = b;
      sd[i] = d;
    }
    trees++;
    writeSchematic(join(outDir, `${prefix}${String(trees).padStart(3, "0")}.schematic`), w, h, l, sb, sd);
  } else if (rockN >= 6 && rockN <= 4000 && logN === 0 && leafN === 0 && h >= 2 && w <= 25 && l <= 25 && h <= 30) {
    // A rock: runs of (y, z, x0, len, material) — 0 stone, 1 cobble, 2 gravel, 3 mossy.
    const MAT = { 1: 0, 4: 1, 13: 2, 48: 3 };
    const kept = list
      .map(([x, y, z, b]) => [x - Math.round((x0 + x1) / 2), y - y0, z - Math.round((z0 + z1) / 2), MAT[b] ?? 0])
      .sort((a, b) => a[3] - b[3] || a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
    const runs = [];
    for (let i = 0; i < kept.length; ) {
      const [rx, ry, rz, m] = kept[i];
      let len = 1;
      while (i + len < kept.length && kept[i + len][3] === m && kept[i + len][1] === ry && kept[i + len][2] === rz && kept[i + len][0] === rx + len && len < 255) len++;
      runs.push(ry, rz + 32, rx + 32, len, m);
      i += len;
    }
    rocks++;
    rockModels.push({ id: `${prefix}r${String(rocks).padStart(3, "0")}`, r: Math.max(x1 - x0, z1 - z0) >> 1, h, n: rockN, vox: Buffer.from(runs).toString("base64") });
  }
}
console.log(`sliced: ${trees} trees -> ${outDir}, ${rocks} rocks`);
if (rockModels.length) {
  writeFileSync(join(outDir, `${prefix}-rocks.json`), JSON.stringify({ rocks: rockModels }));
  console.log(`rocks json: ${join(outDir, `${prefix}-rocks.json`)}`);
}
