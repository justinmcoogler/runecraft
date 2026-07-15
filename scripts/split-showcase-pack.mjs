// Split a "showcase" schematic — many builds displayed on pedestals over a
// shared ground plate — into individual assets and bake them as one packed
// group. Used for house/prop bundles where each build sits on its own
// display stand.
//
//   node game/scripts/split-showcase-pack.mjs <file> <groupName> <idPrefix>
//   e.g. node game/scripts/split-showcase-pack.mjs HouseBundle.schematic houses house.
//
// How the split works:
//   1. The y=0 ground plate is dropped.
//   2. Above-plate columns cluster by XZ adjacency (diagonal counts) —
//      each cluster is one display: pedestal + build.
//   3. Within a cluster, the pedestal is cut at the platform plate: the
//      lowest layer where one material fills a large solid rectangle.
//      The plate stays as the build's floor (sink 1), so verandas and
//      yards sit flush with the terrain in-game.
//   4. Each build is cropped to its own bounding box, enclosed invisible
//      cubes are culled, and everything packs into one gzipped blob.

import { build } from "esbuild";
import { gzipSync } from "zlib";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , input, groupName, idPrefix] = process.argv;
if (!input || !groupName || !idPrefix) {
  console.error("usage: node game/scripts/split-showcase-pack.mjs <file> <groupName> <idPrefix>");
  process.exit(1);
}

const bundled = await build({
  stdin: {
    contents: `
      export { parseStructureFile } from "./src/structures/formats";
      export { packStructures, cullEnclosedCubes } from "./src/structures/packed";
      export { blockedColumns } from "./src/structures/types";
    `,
    resolveDir: gameDir,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});
const eng = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const bundleAsset = eng.parseStructureFile(new Uint8Array(readFileSync(input)), groupName);
const { sx, sz } = bundleAsset;

// ---- 1+2: cluster above-plate columns (8-connectivity) ----
const occ = new Uint8Array(sx * sz);
for (const b of bundleAsset.blocks) if (b.y >= 1) occ[b.z * sx + b.x] = 1;
const cluster = new Int32Array(sx * sz).fill(-1);
let nClusters = 0;
const stack = [];
for (let i = 0; i < sx * sz; i++) {
  if (!occ[i] || cluster[i] !== -1) continue;
  const id = nClusters++;
  stack.push(i);
  cluster[i] = id;
  while (stack.length) {
    const j = stack.pop();
    const x = j % sx;
    const z = (j / sx) | 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= sx || nz >= sz) continue;
        const k = nz * sx + nx;
        if (occ[k] && cluster[k] === -1) {
          cluster[k] = id;
          stack.push(k);
        }
      }
    }
  }
}
const byCluster = new Map();
for (const b of bundleAsset.blocks) {
  if (b.y < 1) continue;
  const c = cluster[b.z * sx + b.x];
  if (c < 0) continue;
  if (!byCluster.has(c)) byCluster.set(c, []);
  byCluster.get(c).push(b);
}

// ---- 3: find each cluster's platform plate and cut the pedestal ----
/**
 * Display stands are built from showcase materials: stone/stone brick with
 * ore-block bling (lapis, emerald, diamond, iron) and gray accents. Build
 * bodies and stilts are house materials (planks, logs, shingles, walls) —
 * that difference, not layer sizes, tells a pedestal from a stilt house.
 */
function standLike(b) {
  if (
    b.material === "terrain.stone" ||
    b.material === "terrain.stonebrick" ||
    b.material === "terrain.gravel"
  ) {
    return true;
  }
  // Ore-block bling: lapis, emerald, diamond, iron.
  return ["#1f4699", "#2cb857", "#62e9dd", "#d8d8d8"].includes(b.color ?? "");
}

function platformY(blocks) {
  const perY = new Map();
  for (const b of blocks) {
    if (!perY.has(b.y)) perY.set(b.y, []);
    perY.get(b.y).push(b);
  }
  const ys = [...perY.keys()].sort((a, b) => a - b);
  const total = blocks.length;
  const span = ys[ys.length - 1] - ys[0];
  let below = 0;
  let belowStand = 0;
  for (const y of ys) {
    const layer = perY.get(y);
    // A platform plate: a near-solid one-material rectangle in the lower
    // part of the cluster whose underside is a display stand. Decks and
    // flat roofs never match (the build's body lies below them), and
    // stilt houses keep their legs (wood below, not stand stone).
    const isCandidate =
      layer.length >= 100 &&
      y - ys[0] <= span * 0.6 &&
      below / total < 0.5 &&
      (below === 0 || belowStand / below >= 0.5);
    if (isCandidate) {
      const byMat = new Map();
      for (const b of layer) {
        if (b.kind !== "cube") continue;
        const key = b.material ?? b.color ?? "?";
        if (!byMat.has(key)) byMat.set(key, []);
        byMat.get(key).push(b);
      }
      for (const group of byMat.values()) {
        if (group.length < 100) continue;
        let x0 = 1e9, x1 = -1, z0 = 1e9, z1 = -1;
        for (const b of group) {
          x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x);
          z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z);
        }
        // The lowest qualifying plate is the stand's top: everything
        // beneath it is stand material, so anything above is the build.
        if (group.length / ((x1 - x0 + 1) * (z1 - z0 + 1)) >= 0.9) return y;
      }
    }
    below += layer.length;
    for (const b of layer) if (standLike(b)) belowStand++;
  }
  return null;
}

const assets = [];
const skipped = [];
for (const [c, blocks] of [...byCluster.entries()].sort((a, b) => a[0] - b[0])) {
  if (blocks.length < 60) {
    skipped.push(`cluster ${c}: only ${blocks.length} blocks (display debris)`);
    continue;
  }
  const plate = platformY(blocks);
  const yFloor = plate ?? Math.min(...blocks.map((b) => b.y));
  const kept = blocks.filter((b) => b.y >= yFloor);
  let x0 = 1e9, x1 = -1, z0 = 1e9, z1 = -1, y1 = 0;
  for (const b of kept) {
    x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x);
    z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z);
    y1 = Math.max(y1, b.y);
  }
  // A found plate becomes the sunken floor layer: its top sits flush with
  // the grass. Builds standing directly on the ground keep their level.
  const floorArea = kept.filter((b) => b.y === yFloor && b.kind === "cube").length;
  const footprint = (x1 - x0 + 1) * (z1 - z0 + 1);
  const sink = plate !== null && floorArea / footprint >= 0.4 ? 1 : 0;
  const asset = eng.cullEnclosedCubes({
    name: `${String(assets.length + 1).padStart(2, "0")}`,
    format: bundleAsset.format,
    sx: x1 - x0 + 1,
    sy: y1 - yFloor + 1,
    sz: z1 - z0 + 1,
    sink,
    blocks: kept.map((b) => ({ ...b, x: b.x - x0, y: b.y - yFloor, z: b.z - z0 })),
    unmapped: [],
  });
  assets.push(asset);
}

// Stable ids by plot position (west-to-east, north-to-south already via cluster order).
const raw = eng.packStructures(assets);
const b64 = gzipSync(Buffer.from(raw), { level: 9 }).toString("base64");
const outDir = join(gameDir, "src/content/structures");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${groupName}.ts`);
writeFileSync(
  outFile,
  `// Packed structure group "${groupName}" baked by split-showcase-pack.mjs.
// ${assets.length} assets, ids "${idPrefix}<name>". Do not hand-edit.

export const ${groupName.toUpperCase()}_PACK_PREFIX = ${JSON.stringify(idPrefix)};

export const ${groupName.toUpperCase()}_PACK = ${JSON.stringify(b64)};
`,
);

console.log(`baked  ${outFile}`);
for (const a of assets) {
  const blocked = eng.blockedColumns(a).length;
  console.log(
    `asset  ${idPrefix}${a.name}: ${a.sx}x${a.sy}x${a.sz} sink=${a.sink} blocks=${a.blocks.length} blockedCols=${blocked}`,
  );
}
for (const s of skipped) console.log(`skip   ${s}`);
if (bundleAsset.unmapped.length > 0) {
  console.log(`note   unmapped in source: ${bundleAsset.unmapped.join(", ")}`);
}
console.log(`pack   ${assets.length} assets, ${Math.round(raw.length / 1024)} KB raw -> ${Math.round((b64.length * 3) / 4 / 1024)} KB gzipped`);
console.log(`next   register the pack in game/src/content/structures/index.ts`);
