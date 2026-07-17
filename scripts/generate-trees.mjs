// Hand-authored procedural voxel-tree generator — the game's canonical tree
// roster. Every species has its own silhouette grammar (below); each grammar
// grows many unique individuals from a seeded RNG, so a stand of oaks is a
// stand of distinct trees and the same world seed always regrows the same
// forest. Output matches the schematic converter's format exactly, so the
// renderer (tree-models.ts) consumes it unchanged.
//
//   run:  node game/scripts/generate-trees.mjs
//   out:  game/src/content/trees-data.ts   (export const TREES_JSON)
//
// Voxel model: kind 0 = log, 1 = leaf. Coordinates are (dx, dy, dz) with the
// trunk base at (0, 0, 0), dy >= 0 up. RLE run = (y, z+32, x0+32, len, kind).

import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) so the roster is reproducible across rebuilds.
// ---------------------------------------------------------------------------
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const chance = (r, p) => r() < p;

// ---------------------------------------------------------------------------
// A voxel canvas: logs win over leaves on the same cell; helpers stamp the
// primitives the grammars are built from.
// ---------------------------------------------------------------------------
class Tree {
  constructor() {
    this.log = new Map(); // key -> [x,y,z]
    this.leaf = new Map();
  }
  key(x, y, z) { return `${x},${y},${z}`; }
  putLog(x, y, z) { const k = this.key(x, y, z); this.leaf.delete(k); this.log.set(k, [x, y, z]); }
  putLeaf(x, y, z) { const k = this.key(x, y, z); if (!this.log.has(k)) this.leaf.set(k, [x, y, z]); }

  /** A vertical (optionally leaning) trunk column, `w` cells thick. */
  trunk(h, w = 1, lean = null, r = null) {
    let ox = 0, oz = 0;
    for (let y = 0; y <= h; y++) {
      // Gradual lean: shift the column sideways as it climbs (palm/acacia).
      if (lean && y > lean.from) {
        if (r ? chance(r, 0.7) : true) ox += lean.dx;
        oz += lean.dz;
      }
      const half = w - 1;
      for (let dx = 0; dx <= half; dx++)
        for (let dz = 0; dz <= half; dz++)
          this.putLog(ox + dx, y, oz + dz);
    }
    return { x: ox + (w - 1) / 2 | 0, y: h, z: oz + (w - 1) / 2 | 0 };
  }

  /** A diagonal branch of logs from (x,y,z) heading (dx,dy,dz) for `len`. */
  branch(x, y, z, dx, dy, dz, len) {
    let cx = x, cy = y, cz = z;
    for (let i = 0; i < len; i++) {
      cx += dx; cy += dy; cz += dz;
      this.putLog(Math.round(cx), Math.round(cy), Math.round(cz));
    }
    return [Math.round(cx), Math.round(cy), Math.round(cz)];
  }

  /** A leaf ellipsoid, edges eroded by noise so no two canopies read alike. */
  blob(cx, cy, cz, rx, ry, rz, r, erode = 0.28, flatBottom = false) {
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      if (flatBottom && y < 0) continue;
      for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
        for (let z = -Math.ceil(rz); z <= Math.ceil(rz); z++) {
          const d = (x * x) / (rx * rx + 0.1) + (y * y) / (ry * ry + 0.1) + (z * z) / (rz * rz + 0.1);
          if (d > 1) continue;
          // Erode the shell; keep the interior so the canopy stays solid.
          if (d > 0.55 && chance(r, erode)) continue;
          this.putLeaf(cx + x, cy + y, cz + z);
        }
      }
    }
  }

  /** A flat leaf disk (conifer tiers, acacia umbrella, palm crown). */
  disk(cy, cx, cz, rad, r, erode = 0.25, thick = 1) {
    for (let t = 0; t < thick; t++)
      for (let x = -rad; x <= rad; x++)
        for (let z = -rad; z <= rad; z++) {
          const dd = Math.hypot(x, z);
          if (dd > rad + 0.2) continue;
          if (dd > rad - 0.9 && chance(r, erode)) continue;
          this.putLeaf(cx + x, cy + t, cz + z);
        }
  }

  /** A drooping frond of leaves cascading down from a rim cell (willow/palm). */
  droop(x, y, z, dx, dz, len, r) {
    let cx = x, cz = z, cy = y;
    for (let i = 0; i < len; i++) {
      cx += dx * (chance(r, 0.6) ? 1 : 0);
      cz += dz * (chance(r, 0.6) ? 1 : 0);
      cy -= 1;
      this.putLeaf(Math.round(cx), cy, Math.round(cz));
      if (chance(r, 0.4)) this.putLeaf(Math.round(cx), cy, Math.round(cz) + (chance(r, 0.5) ? 1 : -1));
    }
  }
}

// ---------------------------------------------------------------------------
// Species grammars. Each returns a Tree grown from the given RNG. The visual
// identity of the roster lives here.
// ---------------------------------------------------------------------------
const GRAMMARS = {
  // Rounded broadleaf: a stout trunk under a fat, slightly flattened crown.
  oak(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 9, 13) : pick(r, 4, 6);
    const top = t.trunk(h, grand && chance(r, 0.5) ? 2 : 1);
    const rad = grand ? pick(r, 4, 5) : pick(r, 2, 3);
    t.blob(top.x, top.y + rad - 1, top.z, rad, rad - 0.5, rad, r, 0.26);
    if (grand) t.blob(top.x, top.y + 1, top.z, rad - 1, 1.4, rad - 1, r, 0.4);
    return t;
  },
  // Papery white broadleaf: a full, softly rounded crown on a clean trunk —
  // slim, but never the bare pole with a pinhead it used to be.
  birch(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 9, 12) : pick(r, 5, 8);
    const top = t.trunk(h, 1);
    const rad = grand ? 3 : pick(r, 2, 3);
    t.blob(top.x, top.y, top.z, rad, grand ? 3.2 : 2.6, rad, r, 0.24);
    t.blob(top.x, top.y + 2, top.z, Math.max(1, rad - 1), 1.6, Math.max(1, rad - 1), r, 0.3);
    return t;
  },
  // Conifer: stacked disks tapering to a point — the lowest tier stays well
  // off the ground so the cone never wears a grass-level skirt.
  spruce(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 12, 17) : pick(r, 7, 11);
    t.trunk(h, 1);
    const baseR = grand ? 4 : 3;
    const lowest = 3;
    const tiers = Math.max(2, Math.floor((h - 1 - lowest) / 2) + 1);
    for (let i = 0; i < tiers; i++) {
      const y = h - 1 - i * 2;
      if (y < lowest) break;
      const rad = Math.max(1, Math.round(baseR * ((i + 1) / tiers)));
      t.disk(y, 0, 0, rad, r, 0.2, 1);
      if (rad > 1) t.disk(y - 1, 0, 0, rad - 1, r, 0.3, 1);
    }
    t.putLeaf(0, h, 0); t.putLeaf(0, h + 1, 0); // sharp crown
    return t;
  },
  // Pine: a clean bole under a proper deep conifer crown — every tier carries
  // real width, so it reads as a tree, not a flagpole with a tuft.
  pine(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 12, 16) : pick(r, 8, 11);
    t.trunk(h, 1);
    const crownBase = Math.max(3, Math.floor(h * 0.45));
    const baseR = grand ? 4 : 3;
    const tiers = Math.max(2, Math.floor((h + 1 - crownBase) / 2) + 1);
    for (let i = 0; i < tiers; i++) {
      const y = h + 1 - i * 2;
      if (y < crownBase) break;
      const rad = Math.max(1, Math.round(baseR * ((i + 1) / tiers)));
      t.disk(y, 0, 0, rad, r, 0.24, 1);
      if (rad > 1) t.disk(y - 1, 0, 0, rad - 1, r, 0.32, 1);
    }
    t.putLeaf(0, h + 1, 0); t.putLeaf(0, h + 2, 0);
    return t;
  },
  // Rainforest giant: a very tall bole, a high spreading umbrella, and vines.
  jungle(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 20, 28) : pick(r, 11, 17);
    const w = grand ? 2 : chance(r, 0.4) ? 2 : 1;
    const top = t.trunk(h, w);
    const rad = grand ? 5 : 4;
    t.blob(top.x, top.y, top.z, rad, 2.2, rad, r, 0.3, true);
    t.disk(top.y - 1, top.x, top.z, rad - 1, r, 0.35);
    // Hanging vines from the canopy rim.
    const vines = grand ? 7 : 4;
    for (let i = 0; i < vines; i++) {
      const a = r() * Math.PI * 2;
      const vx = top.x + Math.round(Math.cos(a) * rad);
      const vz = top.z + Math.round(Math.sin(a) * rad);
      const len = pick(r, 2, grand ? 6 : 4);
      for (let k = 0; k < len; k++) t.putLeaf(vx, top.y - 1 - k, vz);
    }
    return t;
  },
  // Dark oak: a thick 2x2 bole under a broad, low, dense dome.
  darkoak(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 8, 11) : pick(r, 4, 7);
    const top = t.trunk(h, 2);
    const rad = grand ? 5 : 4;
    t.blob(top.x, top.y + 1, top.z, rad, 2, rad, r, 0.24, false);
    t.blob(top.x, top.y - 1, top.z, rad - 1, 1.4, rad - 1, r, 0.34);
    return t;
  },
  // Savanna acacia: a bent bole that forks, crowned by a flat umbrella.
  acacia(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 8, 11) : pick(r, 5, 8);
    const dir = chance(r, 0.5) ? 1 : -1;
    const top = t.trunk(h, 1, { from: Math.floor(h * 0.4), dx: dir, dz: 0 }, r);
    // A second fork for the classic split canopy.
    const forkTop = chance(r, 0.6)
      ? t.branch(top.x, top.y, top.z, -dir * 0.6, 1, 0, pick(r, 2, 3))
      : [top.x, top.y, top.z];
    const rad = grand ? 5 : 4;
    t.disk(top.y + 1, top.x, top.z, rad, r, 0.28, 1);
    t.disk(top.y, top.x, top.z, rad - 1, r, 0.4, 1);
    t.disk(forkTop[1] + 1, forkTop[0], forkTop[2], rad - 1, r, 0.3, 1);
    return t;
  },
  // Weeping willow: a wide soft dome whose rim cascades toward the ground.
  willow(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 7, 10) : pick(r, 5, 7);
    const top = t.trunk(h, grand ? 2 : 1);
    const rad = grand ? 5 : 4;
    t.blob(top.x, top.y, top.z, rad, 2, rad, r, 0.26, false);
    // Draping fronds all around the canopy edge — the willow signature.
    const drapes = grand ? 16 : 11;
    for (let i = 0; i < drapes; i++) {
      const a = (i / drapes) * Math.PI * 2 + r() * 0.3;
      const ex = top.x + Math.round(Math.cos(a) * rad);
      const ez = top.z + Math.round(Math.sin(a) * rad);
      t.droop(ex, top.y, ez, Math.cos(a) * 0.3, Math.sin(a) * 0.3, pick(r, 3, grand ? 6 : 5), r);
    }
    return t;
  },
  // Maple: oak-like but taller and rounder — the palette (renderer) makes it
  // blaze in autumn oranges and reds.
  maple(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 10, 14) : pick(r, 5, 8);
    const top = t.trunk(h, grand && chance(r, 0.5) ? 2 : 1);
    const rad = grand ? 5 : 3;
    t.blob(top.x, top.y + rad - 2, top.z, rad, rad, rad, r, 0.22);
    return t;
  },
  // Palm: a tall curved bole, clean below, with fronds radiating out and down
  // from the crown like a starburst.
  palm(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 12, 16) : pick(r, 7, 11);
    const dir = chance(r, 0.5) ? 1 : -1;
    const top = t.trunk(h, 1, { from: 2, dx: dir, dz: 0 }, r);
    const fronds = grand ? 8 : 6;
    t.putLeaf(top.x, top.y + 1, top.z);
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a);
      const len = pick(r, 3, grand ? 6 : 5);
      let cx = top.x, cz = top.z, cy = top.y + 1;
      for (let k = 0; k < len; k++) {
        cx += dx; cz += dz;
        if (k > 1) cy -= 1; // arch outward then droop
        t.putLeaf(Math.round(cx), cy, Math.round(cz));
        if (k > 0 && chance(r, 0.5)) t.putLeaf(Math.round(cx), cy, Math.round(cz) + (chance(r, 0.5) ? 1 : -1));
      }
    }
    return t;
  },
  // Dead snag: a gnarled leafless bole with a few bare, forking branch stubs.
  dead(r, grand) {
    const t = new Tree();
    const h = grand ? pick(r, 8, 13) : pick(r, 5, 9);
    const top = t.trunk(h, grand ? 2 : 1, chance(r, 0.6) ? { from: Math.floor(h / 2), dx: chance(r, 0.5) ? 1 : -1, dz: 0 } : null, r);
    const arms = pick(r, 2, grand ? 5 : 3);
    for (let i = 0; i < arms; i++) {
      const y = pick(r, Math.floor(h * 0.4), h);
      const a = r() * Math.PI * 2;
      t.branch(top.x, y, top.z, Math.cos(a) * 0.8, chance(r, 0.6) ? 1 : 0, Math.sin(a) * 0.8, pick(r, 2, grand ? 5 : 3));
    }
    return t;
  },
};

// The magical grands reuse a shape but get their own identity from the
// renderer (emissive tints, particles, light). Distinct silhouettes still.
GRAMMARS.blossom = (r, grand) => {
  const t = new Tree();
  const h = grand ? pick(r, 8, 12) : pick(r, 5, 8);
  const top = t.trunk(h, grand && chance(r, 0.5) ? 2 : 1);
  const rad = grand ? 5 : 3;
  // Broad, softly-layered cherry crown.
  t.blob(top.x, top.y + 1, top.z, rad, 1.8, rad, r, 0.22);
  t.blob(top.x, top.y + rad - 1, top.z, rad - 1, 1.6, rad - 1, r, 0.3);
  return t;
};
GRAMMARS.ember = (r, grand) => {
  // Molten oak: a dense, dark, low dome that the renderer sets aglow.
  const t = new Tree();
  const h = grand ? pick(r, 9, 12) : pick(r, 5, 8);
  const top = t.trunk(h, 2);
  const rad = grand ? 5 : 4;
  t.blob(top.x, top.y, top.z, rad, 2.2, rad, r, 0.2);
  return t;
};
GRAMMARS.glow = (r, grand) => {
  // Bioluminescent rainforest tree: tall, luminous high canopy.
  const t = new Tree();
  const h = grand ? pick(r, 16, 22) : pick(r, 10, 15);
  const top = t.trunk(h, grand ? 2 : 1);
  const rad = grand ? 5 : 4;
  t.blob(top.x, top.y, top.z, rad, 2.4, rad, r, 0.24, true);
  const vines = grand ? 6 : 4;
  for (let i = 0; i < vines; i++) {
    const a = r() * Math.PI * 2;
    const vx = top.x + Math.round(Math.cos(a) * rad);
    const vz = top.z + Math.round(Math.sin(a) * rad);
    for (let k = 0; k < pick(r, 2, 5); k++) t.putLeaf(vx, top.y - 1 - k, vz);
  }
  return t;
};
GRAMMARS.dusk = (r, grand) => {
  // Twilight tree: a wide, deep dome the renderer shimmers violet.
  const t = new Tree();
  const h = grand ? pick(r, 9, 12) : pick(r, 5, 8);
  const top = t.trunk(h, 2);
  const rad = grand ? 5 : 4;
  t.blob(top.x, top.y + 1, top.z, rad, 2.4, rad, r, 0.24);
  t.blob(top.x, top.y - 1, top.z, rad - 1, 1.4, rad - 1, r, 0.34);
  return t;
};

// How many wild and grand individuals to grow per species. More variety for
// the common woods the player sees constantly.
const ROSTER = {
  oak: [22, 8], birch: [22, 8], spruce: [18, 6], pine: [16, 6],
  jungle: [16, 6], darkoak: [16, 6], acacia: [16, 6], willow: [14, 6],
  maple: [16, 6], palm: [14, 5], dead: [14, 5],
  blossom: [10, 6], ember: [8, 5], glow: [10, 6], dusk: [8, 5],
};

// ---------------------------------------------------------------------------
// Bake one Tree to the compact model record (recenter, cull hidden, RLE).
// ---------------------------------------------------------------------------
function bake(id, species, tree) {
  const logs = [...tree.log.values()];
  const leaves = [...tree.leaf.values()];
  if (logs.length === 0) return null;
  const minY = Math.min(...logs.map((v) => v[1]));
  const base = logs.filter((v) => v[1] === minY);
  const cx = Math.round(base.reduce((s, v) => s + v[0], 0) / base.length);
  const cz = Math.round(base.reduce((s, v) => s + v[2], 0) / base.length);
  const solid = new Set([...logs, ...leaves].map(([x, y, z]) => `${x},${y},${z}`));
  const exposed = ([x, y, z]) =>
    !solid.has(`${x + 1},${y},${z}`) || !solid.has(`${x - 1},${y},${z}`) ||
    !solid.has(`${x},${y + 1},${z}`) || !solid.has(`${x},${y - 1},${z}`) ||
    !solid.has(`${x},${y},${z + 1}`) || !solid.has(`${x},${y},${z - 1}`);
  const kept = [];
  let maxAbs = 0, maxH = 0;
  for (const [kind, list] of [[0, logs], [1, leaves]]) {
    for (const [x, y, z] of list) {
      if (!exposed([x, y, z])) continue;
      const dx = x - cx, dy = y - minY, dz = z - cz;
      if (Math.abs(dx) > 31 || Math.abs(dz) > 31 || dy > 255 || dy < 0) continue;
      maxAbs = Math.max(maxAbs, Math.abs(dx), Math.abs(dz));
      maxH = Math.max(maxH, dy);
      kept.push([dx, dy, dz, kind]);
    }
  }
  kept.sort((a, b) => a[3] - b[3] || a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  const vox = [];
  for (let i = 0; i < kept.length;) {
    const [x0, y, z, kind] = kept[i];
    let len = 1;
    while (
      i + len < kept.length && kept[i + len][3] === kind && kept[i + len][1] === y &&
      kept[i + len][2] === z && kept[i + len][0] === x0 + len && len < 255
    ) len++;
    vox.push(y, z + 32, x0 + 32, len, kind);
    i += len;
  }
  return { id, species, r: maxAbs, h: maxH + 1, logs: logs.length, vox: Buffer.from(vox).toString("base64") };
}

// ---------------------------------------------------------------------------
// Grow the whole roster.
// ---------------------------------------------------------------------------
const trees = [];
const counts = {};
let seed = 0x51ee7;
for (const [species, [nWild, nGrand]] of Object.entries(ROSTER)) {
  const grammar = GRAMMARS[species];
  const want = nWild + nGrand;
  const seen = new Set();
  let made = 0, attempts = 0;
  // First nWild individuals use the everyday grammar, the rest the grand one.
  // tree-models.ts splits each species' pool by relative size, so we only need
  // both a small and a large cohort here — no absolute height band to hit.
  while (made < want && attempts < want * 12) {
    attempts++;
    const grand = made >= nWild;
    const r = rng(seed++);
    const rec = bake(`${species}${made + 1}`, species, grammar(r, grand));
    if (!rec) continue;
    const sig = `${rec.h}:${rec.r}:${rec.logs}:${rec.vox.length}`;
    if (seen.has(sig)) continue; // no exact-duplicate individuals
    seen.add(sig);
    trees.push(rec);
    counts[species] = (counts[species] || 0) + 1;
    made++;
  }
}

const out = { version: 1, trees };
const json = JSON.stringify(out);
const dest = join(dirname(fileURLToPath(import.meta.url)), "../src/content/trees-data.ts");
writeFileSync(
  dest,
  "// Generated by game/scripts/generate-trees.mjs — do not edit.\n" +
    "// Hand-authored procedural voxel-tree roster (distinct silhouette per species).\n" +
    `export const TREES_JSON: string = ${JSON.stringify(json)};\n`,
);
console.log(`grew ${trees.length} trees -> ${dest} (${(json.length / 1024).toFixed(0)} KB)`);
console.log("species:", counts);
console.log("height range:", Math.min(...trees.map((t) => t.h)), "-", Math.max(...trees.map((t) => t.h)));
console.log("radius range:", Math.min(...trees.map((t) => t.r)), "-", Math.max(...trees.map((t) => t.r)));
