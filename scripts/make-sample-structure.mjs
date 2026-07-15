// Generate game/samples/wayshrine.nbt — an original little roadside shrine
// written as a genuine vanilla structure-block file (gzipped NBT). It doubles
// as an end-to-end fixture for the structure importer and a format reference.
//
//   node game/scripts/make-sample-structure.mjs

import { gzipSync } from "zlib";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

// ---- minimal big-endian NBT writer ----
const out = [];
const byte = (v) => out.push(v & 0xff);
const short = (v) => { byte(v >> 8); byte(v); };
const int = (v) => { byte(v >> 24); byte(v >> 16); byte(v >> 8); byte(v); };
const str = (s) => {
  const bytes = new TextEncoder().encode(s);
  short(bytes.length);
  for (const b of bytes) byte(b);
};
const TAG = { byte: 1, int: 3, string: 8, list: 9, compound: 10 };
const named = (type, name) => { byte(type); str(name); };

const compound = (entries) => {
  for (const write of entries) write();
  byte(0); // TAG_END
};
const intList = (name, values) => () => {
  named(TAG.list, name);
  byte(TAG.int);
  int(values.length);
  for (const v of values) int(v);
};
const compoundList = (name, items) => () => {
  named(TAG.list, name);
  byte(items.length === 0 ? 0 : TAG.compound);
  int(items.length);
  for (const item of items) compound(item);
};
const intTag = (name, v) => () => { named(TAG.int, name); int(v); };
const stringTag = (name, v) => () => { named(TAG.string, name); str(v); };
const compoundTag = (name, entries) => () => { named(TAG.compound, name); compound(entries); };

// ---- the wayshrine: 5x6x5, floor + corner pillars + stepped stair roof ----
const palette = [
  { name: "minecraft:stone_bricks" },
  { name: "minecraft:cobblestone_wall" },
  { name: "minecraft:lantern", props: { hanging: "true" } },
  { name: "minecraft:oak_stairs", props: { facing: "south", half: "bottom" } },
  { name: "minecraft:oak_stairs", props: { facing: "north", half: "bottom" } },
  { name: "minecraft:oak_stairs", props: { facing: "east", half: "bottom" } },
  { name: "minecraft:oak_stairs", props: { facing: "west", half: "bottom" } },
  { name: "minecraft:oak_slab", props: { type: "bottom" } },
  { name: "minecraft:oak_planks" },
];

const blocks = [];
const put = (x, y, z, state) => blocks.push({ x, y, z, state });

for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) put(x, 0, z, 0); // floor
for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) {
  for (let y = 1; y <= 3; y++) put(x, y, z, 1); // corner pillars
}
put(2, 3, 2, 2); // hanging lantern
for (let x = 0; x < 5; x++) {
  for (let z = 0; z < 5; z++) {
    const edge = x === 0 || x === 4 || z === 0 || z === 4;
    if (!edge) { put(x, 4, z, 8); continue; } // roof deck
    const corner = (x === 0 || x === 4) && (z === 0 || z === 4);
    if (corner) { put(x, 4, z, 7); continue; } // corner slabs
    put(x, 4, z, z === 0 ? 3 : z === 4 ? 4 : x === 0 ? 5 : 6); // eaves rise inward
  }
}
for (let x = 1; x <= 3; x++) for (let z = 1; z <= 3; z++) put(x, 5, z, 7); // cap slabs

// ---- write the vanilla structure NBT ----
named(TAG.compound, ""); // root
compound([
  intList("size", [5, 6, 5]),
  compoundList("entities", []),
  compoundList(
    "blocks",
    blocks.map((b) => [intList("pos", [b.x, b.y, b.z]), intTag("state", b.state)]),
  ),
  compoundList(
    "palette",
    palette.map((p) => [
      stringTag("Name", p.name),
      ...(p.props
        ? [compoundTag("Properties", Object.entries(p.props).map(([k, v]) => stringTag(k, v)))]
        : []),
    ]),
  ),
  intTag("DataVersion", 3465),
]);

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(gameDir, "samples");
mkdirSync(dir, { recursive: true });
const file = join(dir, "wayshrine.nbt");
writeFileSync(file, gzipSync(Buffer.from(Uint8Array.from(out))));
console.log(`wrote ${file} (${blocks.length} blocks, ${palette.length} palette entries)`);
