// Packed structure groups: many small assets (e.g. a tree library) stored
// as one gzipped binary blob instead of hundreds of verbose TS files. The
// baker packs; the game unpacks lazily on first use.
//
// Binary layout (little-endian), gzipped then base64 for embedding:
//   [v2+] u16 0xFFFF sentinel, u8 version (legacy packs open with a real
//         assetCount, which can never be 0xFFFF)
//   u16 assetCount
//   u16 paletteCount, then per entry: u16 byteLen + UTF-8 JSON block spec
//   per asset: u8 nameLen + UTF-8 name, u16 sx, u16 sy, u16 sz, u8 sink,
//              u8 species (index into SPECIES, 255 = none), u16 ax, u16 az,
//              u32 blockCount,
//              blockCount varints: delta-1 of the linear cell index
//                ((y*sz + z)*sx + x, strictly ascending),
//              blockCount palette indices: u8 in v1, varint in v2 (v1 capped
//                the palette at 256 entries — too few for large recolored
//                libraries, so v2 widened the per-block index to a varint)
// Delta + split streams keep the raw bytes low-entropy so gzip crushes
// them (leaf canopies become long runs).

/** Current pack format version (see the layout note above). */
const PACK_VERSION = 2;

/** Max distinct assets a lazily-opened pack keeps decoded at once (LRU). A few
 *  chunks' worth of nearby structures; well above what renders simultaneously. */
const DECODE_CACHE_CAP = 64;

import { gunzipSync } from "fflate";
import type { StructureAsset, StructureBlock } from "./types";

type PaletteSpec = Omit<StructureBlock, "x" | "y" | "z">;

/** Wood species/varieties indexable by a byte in the pack format. */
export const SPECIES = [
  "oak", "spruce", "birch", "jungle", "acacia", "dark_oak",
  "mangrove", "cherry", "crimson", "warped", "pale_oak", "bamboo",
  "blossom", "ember", "glow", "dusk",
] as const;

class ByteWriter {
  private chunks: number[] = [];
  u8(v: number): void { this.chunks.push(v & 0xff); }
  u16(v: number): void { this.u8(v); this.u8(v >> 8); }
  u32(v: number): void { this.u16(v); this.u16(v >>> 16); }
  varint(v: number): void {
    while (v >= 0x80) { this.u8((v & 0x7f) | 0x80); v >>>= 7; }
    this.u8(v);
  }
  bytes(b: Uint8Array): void { for (const x of b) this.chunks.push(x); }
  out(): Uint8Array { return Uint8Array.from(this.chunks); }
}

/** Pack assets (bake-time). Dimensions fit u16; palette indices fit a byte. */
export function packStructures(assets: StructureAsset[]): Uint8Array {
  const paletteKeys: string[] = [];
  const paletteIndex = new Map<string, number>();
  const encoded = assets.map((asset) => {
    if (asset.sx > 65535 || asset.sy > 65535 || asset.sz > 65535) {
      throw new Error(`${asset.name}: too large to pack`);
    }
    const blocks = asset.blocks.map((b) => {
      const { x, y, z, ...spec } = b;
      const key = JSON.stringify(spec);
      let idx = paletteIndex.get(key);
      if (idx === undefined) {
        idx = paletteKeys.length;
        paletteKeys.push(key);
        paletteIndex.set(key, idx);
      }
      return { linear: (y * asset.sz + z) * asset.sx + x, idx };
    });
    blocks.sort((a, b) => a.linear - b.linear);
    return { asset, blocks };
  });
  if (paletteKeys.length > 65535) throw new Error("Pack palette overflow");

  const w = new ByteWriter();
  const utf8 = new TextEncoder();
  w.u16(0xffff); // format sentinel: distinguishes v2+ from legacy u8-index packs
  w.u8(PACK_VERSION);
  w.u16(assets.length);
  w.u16(paletteKeys.length);
  for (const key of paletteKeys) {
    const bytes = utf8.encode(key);
    w.u16(bytes.length);
    w.bytes(bytes);
  }
  for (const { asset, blocks } of encoded) {
    const name = utf8.encode(asset.name);
    if (name.length > 255) throw new Error(`${asset.name}: name too long`);
    w.u8(name.length);
    w.bytes(name);
    w.u16(asset.sx); w.u16(asset.sy); w.u16(asset.sz); w.u8(asset.sink);
    const speciesIdx = asset.species ? (SPECIES as readonly string[]).indexOf(asset.species) : -1;
    w.u8(speciesIdx < 0 ? 255 : speciesIdx);
    w.u16(asset.ax ?? Math.floor(asset.sx / 2));
    w.u16(asset.az ?? Math.floor(asset.sz / 2));
    w.u32(blocks.length);
    let prev = -1;
    for (const b of blocks) {
      if (b.linear === prev) throw new Error(`${asset.name}: duplicate block cell`);
      w.varint(b.linear - prev - 1);
      prev = b.linear;
    }
    for (const b of blocks) w.varint(b.idx);
  }
  return w.out();
}

/** Sequential little-endian reader over a raw (un-gzipped) pack. */
class PackReader {
  pos = 0;
  private static dec = new TextDecoder();
  constructor(readonly bin: Uint8Array) {}
  u8(): number { return this.bin[this.pos++]; }
  u16(): number { return this.u8() | (this.u8() << 8); }
  u32(): number { return (this.u16() | (this.u16() << 16)) >>> 0; }
  varint(): number {
    let v = 0, shift = 0;
    for (;;) {
      if (this.pos >= this.bin.length) throw new Error("Pack data ended early.");
      const byte = this.u8();
      v |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return v >>> 0;
      shift += 7;
      if (shift > 28) throw new Error("Pack data is corrupt (varint overflow).");
    }
  }
  str(len: number): string {
    const s = PackReader.dec.decode(this.bin.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }
}

interface AssetMeta {
  name: string; sx: number; sy: number; sz: number; sink: number;
  speciesIdx: number; ax: number; az: number; blockCount: number;
}

function readHeader(r: PackReader): { version: number; assetCount: number; palette: PaletteSpec[] } {
  // v2+ opens with a 0xFFFF sentinel + version byte; legacy packs open
  // straight into the (never-0xFFFF) asset count.
  const first = r.u16();
  const version = first === 0xffff ? r.u8() : 1;
  const assetCount = version >= 2 ? r.u16() : first;
  const palette: PaletteSpec[] = [];
  const paletteCount = r.u16();
  for (let i = 0; i < paletteCount; i++) palette.push(JSON.parse(r.str(r.u16())) as PaletteSpec);
  return { version, assetCount, palette };
}

function readAssetMeta(r: PackReader): AssetMeta {
  const name = r.str(r.u8());
  const sx = r.u16(), sy = r.u16(), sz = r.u16(), sink = r.u8();
  const speciesIdx = r.u8();
  const ax = r.u16(), az = r.u16();
  const blockCount = r.u32();
  return { name, sx, sy, sz, sink, speciesIdx, ax, az, blockCount };
}

/** Read the two block streams (positioned right after the meta) into an asset. */
function readAssetBlocks(r: PackReader, m: AssetMeta, palette: PaletteSpec[], version: number): StructureAsset {
  const linear = new Array<number>(m.blockCount);
  let prev = -1;
  for (let j = 0; j < m.blockCount; j++) {
    prev += r.varint() + 1;
    linear[j] = prev;
  }
  const blocks: StructureBlock[] = new Array(m.blockCount);
  for (let j = 0; j < m.blockCount; j++) {
    const cell = linear[j];
    const idx = version >= 2 ? r.varint() : r.u8();
    blocks[j] = {
      x: cell % m.sx,
      z: Math.floor(cell / m.sx) % m.sz,
      y: Math.floor(cell / (m.sx * m.sz)),
      ...palette[idx],
    };
  }
  return {
    name: m.name, format: "legacy-schematic", sx: m.sx, sy: m.sy, sz: m.sz, sink: m.sink,
    species: m.speciesIdx === 255 ? undefined : SPECIES[m.speciesIdx],
    ax: m.ax, az: m.az, blocks, unmapped: [],
  };
}

/** Advance past an asset's block streams without materializing blocks. */
function skipAssetBlocks(r: PackReader, m: AssetMeta, version: number): void {
  for (let j = 0; j < m.blockCount; j++) r.varint(); // linear-index deltas
  if (version >= 2) for (let j = 0; j < m.blockCount; j++) r.varint(); // palette indices
  else r.pos += m.blockCount; // legacy u8 indices
}

/** Unpack a raw (already un-gzipped) pack — decodes every asset eagerly. */
export function unpackStructures(bin: Uint8Array): StructureAsset[] {
  const r = new PackReader(bin);
  const { version, assetCount, palette } = readHeader(r);
  const assets: StructureAsset[] = [];
  for (let i = 0; i < assetCount; i++) {
    assets.push(readAssetBlocks(r, readAssetMeta(r), palette, version));
  }
  return assets;
}

/** A pack opened for lazy, per-asset decoding — used for large libraries
 *  (thousands of houses) where eagerly materializing every asset's blocks
 *  would cost hundreds of megabytes. The index scan reads no block objects. */
export interface PackHandle {
  names: string[];
  decode(name: string): StructureAsset | undefined;
}

/** Index a raw pack: record each asset's byte offset, decode on demand. */
export function openPack(bin: Uint8Array): PackHandle {
  const r = new PackReader(bin);
  const { version, assetCount, palette } = readHeader(r);
  const offsets = new Map<string, number>();
  const names: string[] = [];
  for (let i = 0; i < assetCount; i++) {
    const start = r.pos;
    const meta = readAssetMeta(r);
    offsets.set(meta.name, start);
    names.push(meta.name);
    skipAssetBlocks(r, meta, version);
  }
  // Bounded LRU: only the handful of assets near the player are live at once,
  // and re-decoding is cheap and deterministic — so cap the decoded set rather
  // than pinning every house the player ever walked past (the whole point of
  // decoding lazily was to avoid holding the entire library resident).
  const cache = new Map<string, StructureAsset>();
  return {
    names,
    decode(name: string): StructureAsset | undefined {
      const off = offsets.get(name);
      if (off === undefined) return undefined;
      const hit = cache.get(name);
      if (hit) {
        cache.delete(name); // refresh recency
        cache.set(name, hit);
        return hit;
      }
      const rr = new PackReader(bin);
      rr.pos = off;
      const asset = readAssetBlocks(rr, readAssetMeta(rr), palette, version);
      cache.set(name, asset);
      if (cache.size > DECODE_CACHE_CAP) cache.delete(cache.keys().next().value!);
      return asset;
    },
  };
}

/**
 * Bake-time optimization for monumental assets: drop cube blocks that are
 * fully enclosed by opaque cubes on all six sides (invisible hill innards).
 * Blocks in the collision layers (y <= sink+1) are always kept so ground
 * blocking never changes.
 */
export function cullEnclosedCubes(asset: StructureAsset): StructureAsset {
  const solid = new Set(
    asset.blocks
      .filter((b) => b.kind === "cube" && !b.translucent)
      .map((b) => `${b.x},${b.y},${b.z}`),
  );
  const blocks = asset.blocks.filter((b) => {
    if (b.kind !== "cube" || b.translucent) return true;
    if (b.y <= asset.sink + 1) return true;
    return !(
      solid.has(`${b.x + 1},${b.y},${b.z}`) && solid.has(`${b.x - 1},${b.y},${b.z}`) &&
      solid.has(`${b.x},${b.y + 1},${b.z}`) && solid.has(`${b.x},${b.y - 1},${b.z}`) &&
      solid.has(`${b.x},${b.y},${b.z + 1}`) && solid.has(`${b.x},${b.y},${b.z - 1}`)
    );
  });
  return { ...asset, blocks };
}

/** Gunzip a base64-embedded pack to its raw bytes. */
function inflate(base64: string): Uint8Array {
  return gunzipSync(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)));
}

/** Load a base64-embedded gzipped pack into an id -> asset map (eager). */
export function loadPack(base64: string, idPrefix: string): Map<string, StructureAsset> {
  const map = new Map<string, StructureAsset>();
  for (const asset of unpackStructures(inflate(base64))) map.set(`${idPrefix}${asset.name}`, asset);
  return map;
}

/** Open a base64-embedded gzipped pack for lazy, per-asset decoding. */
export function openPackBase64(base64: string): PackHandle {
  return openPack(inflate(base64));
}
