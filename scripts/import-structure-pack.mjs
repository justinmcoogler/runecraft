// Bake a DIRECTORY of structure files into one gzipped packed group —
// used for libraries of many small assets (trees, rocks, props) where
// hundreds of individual TS files would bloat the bundle.
//
//   node game/scripts/import-structure-pack.mjs <dir> <groupName> <idPrefix>
//   e.g. node game/scripts/import-structure-pack.mjs ./trees trees tree.
//
// Emits game/src/content/structures/<groupName>.ts with a base64 blob.
// Unknown block names are reported (they render with texture-table or
// guessed colors; use import-structure.mjs on one file to learn them
// into custom-blocks.ts if needed).

import { build } from "esbuild";
import { gzipSync } from "zlib";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , dir, groupName, idPrefix] = process.argv;
if (!dir || !groupName || !idPrefix) {
  console.error("usage: node game/scripts/import-structure-pack.mjs <dir> <groupName> <idPrefix>");
  process.exit(1);
}

const bundled = await build({
  stdin: {
    contents: `
      export { parseStructureFile } from "./src/structures/formats";
      export { packStructures } from "./src/structures/packed";
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
const importer = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

const EXT = /\.(nbt|schem|schematic|litematic)$/i;
const files = readdirSync(dir).filter((f) => EXT.test(f)).sort();
if (files.length === 0) {
  console.error(`no structure files in ${dir}`);
  process.exit(1);
}

const assets = [];
const allUnmapped = new Map();
const failures = [];
for (const file of files) {
  try {
    const asset = importer.parseStructureFile(new Uint8Array(readFileSync(join(dir, file))), file);
    for (const u of asset.unmapped) allUnmapped.set(u, (allUnmapped.get(u) ?? 0) + 1);
    asset.unmapped = [];
    assets.push(asset);
  } catch (err) {
    failures.push(`${file}: ${err.message}`);
  }
}

const raw = importer.packStructures(assets);
const b64 = gzipSync(Buffer.from(raw), { level: 9 }).toString("base64");

const outDir = join(gameDir, "src/content/structures");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${groupName}.ts`);
writeFileSync(
  outFile,
  `// Packed structure group "${groupName}" baked by import-structure-pack.mjs.
// ${assets.length} assets, ids "${idPrefix}<name>". Do not hand-edit.

export const ${groupName.toUpperCase()}_PACK_PREFIX = ${JSON.stringify(idPrefix)};

export const ${groupName.toUpperCase()}_PACK = ${JSON.stringify(b64)};
`,
);

const totalBlocks = assets.reduce((n, a) => n + a.blocks.length, 0);
const bySpecies = new Map();
for (const a of assets) {
  const key = a.species ?? "(none)";
  if (!bySpecies.has(key)) bySpecies.set(key, []);
  bySpecies.get(key).push(a);
}
console.log(`baked  ${outFile}`);
for (const [species, list] of [...bySpecies.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const sizes = list.map((a) => Math.max(a.sx, a.sz)).sort((a, b) => a - b);
  const sample = list
    .sort((a, b) => Math.max(a.sx, a.sz) - Math.max(b.sx, b.sz))
    .slice(0, 6)
    .map((a) => `${a.name}(${a.sx}x${a.sy}x${a.sz})`)
    .join(" ");
  console.log(`wood   ${species}: ${list.length} trees, width ${sizes[0]}-${sizes[sizes.length - 1]}; smallest: ${sample}`);
}
console.log(`assets ${assets.length} (${totalBlocks} blocks, ${Math.round(raw.length / 1024)} KB raw -> ${Math.round((b64.length * 3) / 4 / 1024)} KB gzipped)`);
if (failures.length > 0) {
  console.log(`failed ${failures.length}:`);
  for (const f of failures) console.log(`       ${f}`);
}
if (allUnmapped.size > 0) {
  console.log(`note   unmapped names (render via texture table / guess): ${
    [...allUnmapped.entries()].map(([k, v]) => `${k} x${v}`).join(", ")}`);
}
console.log(`next   register the pack in game/src/content/structures/index.ts`);
