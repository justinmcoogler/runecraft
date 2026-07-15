// Bake a Minecraft structure file into a checked-in game asset.
//
//   node game/scripts/import-structure.mjs <file> [assetName]
//
// Supported inputs: vanilla structure-block .nbt, Sponge/WorldEdit .schem
// (v2/v3), and Litematica .litematic. Emits
// game/src/content/structures/<name>.ts (plain data) and prints an import
// report. Block types the built-in mapping doesn't know are AUTO-ADDED to
// game/src/structures/custom-blocks.ts with a guessed color, so every
// upload permanently teaches the game its blocks. Register the asset in
// game/src/content/structures/index.ts, then place it via a
// StructurePlacement in game/src/sim/world.ts.

import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve, basename } from "path";
import { fileURLToPath } from "url";
import { lookupVanillaBlockColor } from "./png-color.mjs";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , input, nameArg] = process.argv;
if (!input) {
  console.error("usage: node game/scripts/import-structure.mjs <file.nbt|.schem|.litematic> [assetName]");
  process.exit(1);
}

// Bundle the TypeScript importer so this script always runs the same code
// the tests cover. Re-bundled after learning new blocks so the second parse
// sees the updated table.
async function loadImporter() {
  const bundled = await build({
    stdin: {
      contents: `
        export { parseStructureFile } from "./src/structures/formats";
        export { guessColor } from "./src/structures/mapping";
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
  const url = `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`;
  return import(url);
}

const bytes = new Uint8Array(readFileSync(input));
let importer = await loadImporter();
let asset = importer.parseStructureFile(bytes, nameArg ?? basename(input));

// ---- learn unknown block types ----
const customFile = join(gameDir, "src/structures/custom-blocks.ts");
const learned = [];
if (asset.unmapped.length > 0) {
  let source = readFileSync(customFile, "utf8");
  const marker = "  // -- auto-added entries below this line --";
  if (!source.includes(marker)) {
    console.error(`cannot auto-add blocks: marker comment missing from ${customFile}`);
    process.exit(1);
  }
  for (const blockName of asset.unmapped) {
    if (source.includes(`"${blockName}":`)) continue; // already learned
    // The real vanilla texture's average color, when we can reach it;
    // the keyword guess only covers offline bakes and non-vanilla blocks.
    const looked = lookupVanillaBlockColor(blockName);
    const color = looked?.color ?? importer.guessColor(blockName);
    source = source.replace(
      marker,
      `${marker}\n  "${blockName}": { kind: "cube", color: "${color}" },${looked ? ` // ${looked.texture}` : " // guessed (texture lookup failed)"}`,
    );
    learned.push({ blockName, color, texture: looked?.texture });
  }
  if (learned.length > 0) {
    writeFileSync(customFile, source);
    // Re-parse with the updated table so the asset bakes clean.
    importer = await loadImporter();
    asset = importer.parseStructureFile(bytes, nameArg ?? basename(input));
  }
}

// ---- emit the asset ----
const ident = /^[a-zA-Z_]/.test(asset.name) ? asset.name : `s_${asset.name}`;
const outDir = join(gameDir, "src/content/structures");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, `${asset.name}.ts`);
const source = `// Baked from ${basename(input)} (${asset.format}) by import-structure.mjs. Do not hand-edit.

import type { StructureAsset } from "../../structures/types";

export const ${ident}: StructureAsset = ${JSON.stringify(asset, null, 2)};
`;
writeFileSync(outFile, source);

const blocked = importer.blockedColumns(asset);
console.log(`baked  ${outFile}`);
console.log(`size   ${asset.sx}x${asset.sy}x${asset.sz}  (${asset.blocks.length} rendered blocks, sink ${asset.sink})`);
console.log(`ground ${blocked.length} blocked columns of ${asset.sx * asset.sz}`);
for (const { blockName, color, texture } of learned) {
  console.log(
    texture
      ? `learn  added "${blockName}" as ${color} (average of vanilla ${texture})`
      : `learn  added "${blockName}" as ${color} (GUESSED — texture lookup failed, hand-tune if off)`,
  );
}
if (asset.unmapped.length > 0) {
  console.log(`note   still unmapped after learning (should not happen): ${asset.unmapped.join(", ")}`);
}
console.log(`next   1) register "${ident}" in game/src/content/structures/index.ts`);
console.log(`       2) place it: structures: [{ instanceId: "...", structureId: "${asset.name}", cell: { x, z } }]`);
