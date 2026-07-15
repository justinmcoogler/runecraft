// Structure file formats -> StructureAsset.
//   1. Vanilla structure-block .nbt: {size:[x,y,z], palette:[{Name,Properties}], blocks:[{pos,state}]}
//      (multi-variant files store `palettes`, a list of palettes; we use the first)
//   2. Sponge/WorldEdit .schem v2/v3: {Width,Height,Length, Palette{"name[props]":id}, BlockData varints}
//   3. Litematica .litematic: {Regions:{name:{Position, Size, BlockStatePalette,
//      BlockStates: bit-packed long array}}} — entries span long boundaries
// All funnel through toStructureBlock so mapping rules live in one place.

import { legacyBlockState } from "./legacy-ids";
import { toStructureBlock, woodSpeciesOf } from "./mapping";
import { parseNbt, type NbtRoot, type NbtValue } from "./nbt";
import type { StructureAsset, StructureBlock } from "./types";

// Minecraft-scale limits: builds may span a full region footprint and the
// modern world height (384 blocks). Nothing gets cropped on import.
const MAX_DIM_XZ = 512;
const MAX_DIM_Y = 384;
const MAX_BLOCKS = 64_000_000; // volume guard for the decode loops

function asCompound(v: NbtValue | undefined): { [key: string]: NbtValue } | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as { [key: string]: NbtValue }) : null;
}

function asList(v: NbtValue | undefined): NbtValue[] {
  return Array.isArray(v) ? (v as NbtValue[]) : [];
}

function asNumber(v: NbtValue | undefined, fallback = 0): number {
  return typeof v === "number" ? v : fallback;
}

function asString(v: NbtValue | undefined): string {
  return typeof v === "string" ? v : "";
}

/**
 * Wood classification: tallies log blocks per species while a parser runs,
 * then reports the dominant species plus the trunk-base anchor cell (the
 * centroid of the lowest log layer). Fantasy canopies override log species:
 * pink wool/terracotta -> "blossom", warm terracotta/wool -> "ember",
 * stained glass -> "dusk", glowstone/sea lanterns -> "glow". Non-tree
 * builds get no species and a footprint-center anchor.
 */
class WoodTally {
  private counts = new Map<string, number>();
  private lowY = Infinity;
  private lowLogs: Array<{ x: number; z: number }> = [];
  private leaves = 0;
  private pink = 0;
  private warm = 0;
  private glass = 0;
  private glowing = 0;

  count(name: string, x: number, y: number, z: number): void {
    const clean = name.replace(/^minecraft:/, "");
    if (/_leaves$/.test(clean)) this.leaves++;
    else if (/^(pink|magenta)_(wool|terracotta|concrete)$/.test(clean)) this.pink++;
    else if (/^(orange|red|yellow)_(wool|terracotta|concrete)$/.test(clean)) this.warm++;
    else if (/stained_glass/.test(clean)) this.glass++;
    else if (clean === "glowstone" || clean === "sea_lantern" || clean === "shroomlight") this.glowing++;
    const species = woodSpeciesOf(clean);
    if (!species) return;
    this.counts.set(species, (this.counts.get(species) ?? 0) + 1);
    if (y < this.lowY) {
      this.lowY = y;
      this.lowLogs = [];
    }
    if (y === this.lowY) this.lowLogs.push({ x, z });
  }

  finish(sx: number, sz: number): { species?: string; ax: number; az: number } {
    let species: string | undefined;
    let best = 0;
    for (const [name, n] of this.counts) {
      if (n > best) { best = n; species = name; }
    }
    // Canopy variety beats log species (a blossom tree on acacia logs is a
    // blossom tree). Only applies to things that are actually trees.
    if (species !== undefined || this.leaves > 0) {
      const canopy = this.leaves + this.pink + this.warm + this.glass;
      if (canopy > 0 && this.glass / canopy > 0.4) species = "dusk";
      else if (canopy > 0 && this.pink / canopy > 0.4) species = "blossom";
      else if (canopy > 0 && this.warm / canopy > 0.4) species = "ember";
      else if (this.glowing >= 4) species = "glow";
    }
    if (this.lowLogs.length === 0) {
      return { species, ax: Math.floor(sx / 2), az: Math.floor(sz / 2) };
    }
    const ax = Math.round(this.lowLogs.reduce((s, c) => s + c.x, 0) / this.lowLogs.length);
    const az = Math.round(this.lowLogs.reduce((s, c) => s + c.z, 0) / this.lowLogs.length);
    return { species, ax, az };
  }
}

/**
 * Builds saved with a floor slab in layer y0 sink one block into the ground
 * so their floor top sits at terrain height and interiors stay walkable.
 */
function computeSink(blocks: StructureBlock[], sx: number, sz: number): number {
  const floorColumns = new Set<string>();
  for (const b of blocks) {
    if (b.y === 0 && b.kind === "cube") floorColumns.add(`${b.x},${b.z}`);
  }
  return floorColumns.size >= sx * sz * 0.5 ? 1 : 0;
}

/**
 * Trim empty bottom layers so the lowest block sits at y=0. Some exported
 * builds float above their own origin (a pocket of air below the floor);
 * without this they render hovering over the terrain and their walls, sitting
 * above the feet/head layers computeSink and blockedColumns inspect, block
 * nothing. Mutates blocks in place and returns the corrected height.
 */
function normalizeFloor(blocks: StructureBlock[], sy: number): number {
  let minY = Infinity;
  for (const b of blocks) if (b.y < minY) minY = b.y;
  if (!Number.isFinite(minY) || minY <= 0) return sy;
  for (const b of blocks) b.y -= minY;
  return sy - minY;
}

function checkDims(sx: number, sy: number, sz: number): string | null {
  if (sx <= 0 || sy <= 0 || sz <= 0) return "Structure has no size.";
  if (sx > MAX_DIM_XZ || sz > MAX_DIM_XZ || sy > MAX_DIM_Y) {
    return `Structure is too large (${sx}x${sy}x${sz}; limits are ${MAX_DIM_XZ} wide and ${MAX_DIM_Y} tall).`;
  }
  return null;
}

/** Vanilla structure-block file (saved with a structure block, usually .nbt). */
export function parseVanillaStructure(root: NbtRoot, name: string): StructureAsset {
  const v = root.value;
  const size = asList(v["size"]).map((n) => asNumber(n));
  const [sx, sy, sz] = [size[0] ?? 0, size[1] ?? 0, size[2] ?? 0];
  const dimError = checkDims(sx, sy, sz);
  if (dimError) throw new Error(dimError);

  // Jigsaw-style files carry several palette variants under "palettes".
  const paletteTag = v["palette"] ?? asList(v["palettes"])[0];
  const palette = asList(paletteTag).map((entry) => {
    const c = asCompound(entry);
    const props: Record<string, string> = {};
    const propsTag = asCompound(c?.["Properties"]);
    if (propsTag) {
      for (const [key, value] of Object.entries(propsTag)) props[key] = asString(value);
    }
    return { name: asString(c?.["Name"]) || "air", props };
  });
  if (palette.length === 0) throw new Error("Structure file has no palette.");

  const blockTags = asList(v["blocks"]);
  if (blockTags.length > MAX_BLOCKS) throw new Error("Structure has too many blocks.");
  const blocks: StructureBlock[] = [];
  const unmapped = new Set<string>();
  const wood = new WoodTally();
  for (const tag of blockTags) {
    const c = asCompound(tag);
    if (!c) continue;
    const pos = asList(c["pos"]).map((n) => asNumber(n));
    const state = asNumber(c["state"], -1);
    const entry = palette[state];
    if (!entry || pos.length !== 3) continue;
    const { block, unmapped: miss } = toStructureBlock(pos[0], pos[1], pos[2], entry.name, entry.props);
    if (miss) unmapped.add(entry.name.replace(/^minecraft:/, ""));
    if (block) {
      blocks.push(block);
      wood.count(entry.name, block.x, block.y, block.z);
    }
  }
  return {
    name, format: "vanilla-nbt", sx, sy: normalizeFloor(blocks, sy), sz,
    sink: computeSink(blocks, sx, sz),
    ...wood.finish(sx, sz),
    blocks, unmapped: [...unmapped].sort(),
  };
}

/** "minecraft:oak_stairs[facing=north,half=bottom]" -> name + props. */
export function parsePaletteKey(key: string): { name: string; props: Record<string, string> } {
  const bracket = key.indexOf("[");
  if (bracket < 0) return { name: key, props: {} };
  const name = key.slice(0, bracket);
  const props: Record<string, string> = {};
  for (const pair of key.slice(bracket + 1).replace(/\]$/, "").split(",")) {
    const eq = pair.indexOf("=");
    if (eq > 0) props[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return { name, props };
}

/** Decode the .schem varint block array into palette indices. */
export function decodeVarints(data: number[], expected: number): number[] {
  const out = new Array<number>(expected);
  let pos = 0;
  for (let i = 0; i < expected; i++) {
    let value = 0;
    let shift = 0;
    for (;;) {
      if (pos >= data.length) throw new Error("Structure block data ended early.");
      const byte = data[pos++] & 0xff;
      value |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
      if (shift > 28) throw new Error("Structure block data is corrupt.");
    }
    out[i] = value;
  }
  return out;
}

/** Sponge/WorldEdit .schem, versions 2 and 3. */
export function parseSpongeSchem(root: NbtRoot, name: string): StructureAsset {
  // v3 nests everything under a "Schematic" compound; v2 is flat.
  const v = asCompound(root.value["Schematic"]) ?? root.value;
  const sx = asNumber(v["Width"]);
  const sy = asNumber(v["Height"]);
  const sz = asNumber(v["Length"]);
  const dimError = checkDims(sx, sy, sz);
  if (dimError) throw new Error(dimError);

  // v3 wraps palette + data in "Blocks"; v2 has Palette/BlockData at top level.
  const blocksTag = asCompound(v["Blocks"]);
  const paletteTag = asCompound(blocksTag?.["Palette"] ?? v["Palette"]);
  const dataTag = blocksTag?.["Data"] ?? v["BlockData"];
  if (!paletteTag || !Array.isArray(dataTag)) {
    throw new Error("This .schem file is missing its palette or block data.");
  }

  const palette = new Map<number, { name: string; props: Record<string, string> }>();
  for (const [key, id] of Object.entries(paletteTag)) {
    palette.set(asNumber(id, -1), parsePaletteKey(key));
  }

  const total = sx * sy * sz;
  if (total > MAX_BLOCKS) throw new Error("Structure has too many blocks.");
  const indices = decodeVarints(dataTag as number[], total);

  const blocks: StructureBlock[] = [];
  const unmapped = new Set<string>();
  const wood = new WoodTally();
  for (let i = 0; i < total; i++) {
    const entry = palette.get(indices[i]);
    if (!entry) continue;
    // Sponge order: index = x + z*Width + y*Width*Length
    const x = i % sx;
    const z = Math.floor(i / sx) % sz;
    const y = Math.floor(i / (sx * sz));
    const { block, unmapped: miss } = toStructureBlock(x, y, z, entry.name, entry.props);
    if (miss) unmapped.add(entry.name.replace(/^minecraft:/, ""));
    if (block) {
      blocks.push(block);
      wood.count(entry.name, x, y, z);
    }
  }
  return {
    name, format: "sponge-schem", sx, sy: normalizeFloor(blocks, sy), sz,
    sink: computeSink(blocks, sx, sz),
    ...wood.finish(sx, sz),
    blocks, unmapped: [...unmapped].sort(),
  };
}

/**
 * Litematica packs palette indices into a contiguous bitstream across
 * 64-bit longs (entries may straddle long boundaries), LSB first.
 */
export function unpackPackedLongs(longs: bigint[], bits: number, count: number): number[] {
  const mask = (1n << BigInt(bits)) - 1n;
  const out = new Array<number>(count);
  for (let i = 0; i < count; i++) {
    const bitIndex = i * bits;
    const li = bitIndex >> 6;
    const off = BigInt(bitIndex & 63);
    if (li >= longs.length) throw new Error("Structure block data ended early.");
    let value = longs[li] >> off;
    const spill = off + BigInt(bits) - 64n;
    if (spill > 0n) {
      if (li + 1 >= longs.length) throw new Error("Structure block data ended early.");
      value |= longs[li + 1] << (BigInt(bits) - spill);
    }
    out[i] = Number(value & mask);
  }
  return out;
}

function asBigints(v: NbtValue | undefined): bigint[] {
  return Array.isArray(v) && (v.length === 0 || typeof v[0] === "bigint") ? (v as bigint[]) : [];
}

/** Litematica .litematic (mod format). Regions merge into one asset. */
export function parseLitematic(root: NbtRoot, name: string): StructureAsset {
  const v = root.value;
  const regionsTag = asCompound(v["Regions"]);
  if (!regionsTag) throw new Error("This .litematic file has no regions.");

  // Regions may have negative sizes (they extend backwards from Position).
  const regions = Object.values(regionsTag).map((entry) => {
    const c = asCompound(entry);
    if (!c) throw new Error("Malformed litematic region.");
    const pos = asCompound(c["Position"]);
    const size = asCompound(c["Size"]);
    const s = {
      x: asNumber(size?.["x"]), y: asNumber(size?.["y"]), z: asNumber(size?.["z"]),
    };
    const min = {
      x: asNumber(pos?.["x"]) + Math.min(s.x + 1, 0),
      y: asNumber(pos?.["y"]) + Math.min(s.y + 1, 0),
      z: asNumber(pos?.["z"]) + Math.min(s.z + 1, 0),
    };
    return {
      min,
      dims: { x: Math.abs(s.x), y: Math.abs(s.y), z: Math.abs(s.z) },
      palette: asList(c["BlockStatePalette"]).map((p) => {
        const pc = asCompound(p);
        const props: Record<string, string> = {};
        const propsTag = asCompound(pc?.["Properties"]);
        if (propsTag) {
          for (const [key, value] of Object.entries(propsTag)) props[key] = asString(value);
        }
        return { name: asString(pc?.["Name"]) || "air", props };
      }),
      states: asBigints(c["BlockStates"]),
    };
  });
  if (regions.length === 0) throw new Error("This .litematic file has no regions.");

  const lo = {
    x: Math.min(...regions.map((r) => r.min.x)),
    y: Math.min(...regions.map((r) => r.min.y)),
    z: Math.min(...regions.map((r) => r.min.z)),
  };
  const hi = {
    x: Math.max(...regions.map((r) => r.min.x + r.dims.x)),
    y: Math.max(...regions.map((r) => r.min.y + r.dims.y)),
    z: Math.max(...regions.map((r) => r.min.z + r.dims.z)),
  };
  const [sx, sy, sz] = [hi.x - lo.x, hi.y - lo.y, hi.z - lo.z];
  const dimError = checkDims(sx, sy, sz);
  if (dimError) throw new Error(dimError);
  if (sx * sy * sz > MAX_BLOCKS) throw new Error("Structure has too many blocks.");

  const blocks: StructureBlock[] = [];
  const unmapped = new Set<string>();
  const wood = new WoodTally();
  for (const region of regions) {
    const volume = region.dims.x * region.dims.y * region.dims.z;
    if (volume === 0 || region.palette.length === 0) continue;
    const bits = Math.max(2, Math.ceil(Math.log2(region.palette.length)));
    const indices = unpackPackedLongs(region.states, bits, volume);
    for (let i = 0; i < volume; i++) {
      const entry = region.palette[indices[i]];
      if (!entry) continue;
      // Litematica order: index = (y * sizeZ + z) * sizeX + x
      const x = i % region.dims.x;
      const z = Math.floor(i / region.dims.x) % region.dims.z;
      const y = Math.floor(i / (region.dims.x * region.dims.z));
      const { block, unmapped: miss } = toStructureBlock(
        x + region.min.x - lo.x,
        y + region.min.y - lo.y,
        z + region.min.z - lo.z,
        entry.name,
        entry.props,
      );
      if (miss) unmapped.add(entry.name.replace(/^minecraft:/, ""));
      if (block) {
        blocks.push(block);
        wood.count(entry.name, block.x, block.y, block.z);
      }
    }
  }
  return {
    name, format: "litematic", sx, sy: normalizeFloor(blocks, sy), sz,
    sink: computeSink(blocks, sx, sz),
    ...wood.finish(sx, sz),
    blocks, unmapped: [...unmapped].sort(),
  };
}

/**
 * Legacy MCEdit .schematic (pre-1.13): numeric block IDs in a byte array
 * plus 4-bit data values, resolved through the legacy ID table. AddBlocks
 * (IDs above 255) is not handled — nothing in that range is mappable here.
 */
export function parseLegacySchematic(root: NbtRoot, name: string): StructureAsset {
  const v = root.value;
  const sx = asNumber(v["Width"]);
  const sy = asNumber(v["Height"]);
  const sz = asNumber(v["Length"]);
  const dimError = checkDims(sx, sy, sz);
  if (dimError) throw new Error(dimError);
  const ids = v["Blocks"];
  const data = v["Data"];
  if (!Array.isArray(ids) || !Array.isArray(data)) {
    throw new Error("This .schematic file is missing its block arrays.");
  }
  const total = sx * sy * sz;
  if (total > MAX_BLOCKS || ids.length < total) {
    throw new Error("Structure has too many blocks.");
  }

  const blocks: StructureBlock[] = [];
  const unmapped = new Set<string>();
  const wood = new WoodTally();
  for (let i = 0; i < total; i++) {
    const id = (ids[i] as number) & 0xff;
    if (id === 0) continue;
    const state = legacyBlockState(id, ((data[i] as number) ?? 0) & 15);
    if (!state) {
      unmapped.add(`legacy id ${id}`);
      continue;
    }
    // Legacy order: index = (y * Length + z) * Width + x
    const x = i % sx;
    const z = Math.floor(i / sx) % sz;
    const y = Math.floor(i / (sx * sz));
    const { block, unmapped: miss } = toStructureBlock(x, y, z, state.name, state.props);
    if (miss) unmapped.add(state.name);
    if (block) {
      blocks.push(block);
      wood.count(state.name, x, y, z);
    }
  }
  return {
    name, format: "legacy-schematic", sx, sy: normalizeFloor(blocks, sy), sz,
    sink: computeSink(blocks, sx, sz),
    ...wood.finish(sx, sz),
    blocks, unmapped: [...unmapped].sort(),
  };
}

/** Sniff + parse any supported structure file. */
export function parseStructureFile(bytes: Uint8Array, fileName: string): StructureAsset {
  const name = fileName.replace(/\.(nbt|schem|schematic|litematic)$/i, "").replace(/[^\w-]+/g, "_");
  const root = parseNbt(bytes);
  const v = root.value;
  if (v["size"] && (v["palette"] ?? v["palettes"]) && v["blocks"]) {
    return parseVanillaStructure(root, name);
  }
  if (v["Regions"] && (v["Version"] !== undefined || v["MinecraftDataVersion"] !== undefined)) {
    return parseLitematic(root, name);
  }
  const schem = asCompound(v["Schematic"]) ?? v;
  if (schem["Width"] !== undefined && schem["Palette" as string] !== undefined) {
    return parseSpongeSchem(root, name);
  }
  if (schem["Width"] !== undefined && asCompound(schem["Blocks"])) {
    return parseSpongeSchem(root, name);
  }
  if (Array.isArray(v["Blocks"]) && Array.isArray(v["Data"]) && v["Width"] !== undefined) {
    return parseLegacySchematic(root, name);
  }
  throw new Error(
    "Unrecognized structure file. Use a structure block .nbt, a WorldEdit .schem, a Litematica .litematic, or a legacy .schematic.",
  );
}
