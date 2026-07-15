// Bake ONE structure file (any supported format, any size up to 512 wide x
// 384 tall) into a packed gzipped asset — used for monumental builds where
// a plain TS asset would be huge. Nothing is cropped; fully enclosed cubes
// (invisible hill innards) are culled at bake time, which never changes
// ground collision.
//
//   node game/scripts/import-structure-packed.mjs <file> <name> <idPrefix> [rotate] [sink]
// rotate: 0 (default) or 180 — spins the build in plan so its front can
// face the approach road.
// sink: overrides ground embedding (default: auto floor detection). Builds
// with landscaped bases sink to their walking level so their grounds sit
// flush with the terrain and stay walkable.

import { build } from "esbuild";
import { gzipSync } from "zlib";
import { readFileSync, writeFileSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , input, name, idPrefix, rotateArg, sinkArg] = process.argv;
const rotate = Number(rotateArg ?? 0);
const sinkOverride = sinkArg === undefined ? null : Number(sinkArg);
if (!input || !name || !idPrefix || ![0, 180].includes(rotate) || (sinkOverride !== null && Number.isNaN(sinkOverride))) {
  console.error("usage: node game/scripts/import-structure-packed.mjs <file> <name> <idPrefix> [0|180] [sink]");
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

let parsed = eng.parseStructureFile(new Uint8Array(readFileSync(input)), name);
if (rotate === 180) {
  const flip = { north: "south", south: "north", east: "west", west: "east" };
  parsed = {
    ...parsed,
    ax: parsed.ax === undefined ? undefined : parsed.sx - 1 - parsed.ax,
    az: parsed.az === undefined ? undefined : parsed.sz - 1 - parsed.az,
    blocks: parsed.blocks.map((b) => ({
      ...b,
      x: parsed.sx - 1 - b.x,
      z: parsed.sz - 1 - b.z,
      facing: b.facing ? flip[b.facing] : undefined,
    })),
  };
}
if (sinkOverride !== null) parsed = { ...parsed, sink: sinkOverride };
const before = parsed.blocks.length;
const asset = eng.cullEnclosedCubes(parsed);

const raw = eng.packStructures([asset]);
const b64 = gzipSync(Buffer.from(raw), { level: 9 }).toString("base64");
const outFile = join(gameDir, "src/content/structures", `${name}.ts`);
writeFileSync(
  outFile,
  `// Packed structure "${name}" baked by import-structure-packed.mjs from
// ${basename(input)} (uncropped). Do not hand-edit.

export const ${name.toUpperCase()}_PACK_PREFIX = ${JSON.stringify(idPrefix)};

export const ${name.toUpperCase()}_PACK = ${JSON.stringify(b64)};
`,
);

const blocked = eng.blockedColumns(asset);
console.log(`baked  ${outFile}${rotate ? ` (rotated ${rotate}\u00b0)` : ""}`);
console.log(`size   ${asset.sx}x${asset.sy}x${asset.sz}  (${before} blocks, ${asset.blocks.length} after enclosed-cube culling -> ${Math.round((b64.length * 3) / 4 / 1024)} KB gzipped)`);
console.log(`ground ${blocked.length} blocked columns of ${asset.sx * asset.sz}`);
if (parsed.unmapped.length > 0) console.log(`note   unmapped: ${parsed.unmapped.join(", ")}`);
