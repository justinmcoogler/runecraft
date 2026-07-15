// Convert Sponge v2 .schem assets (the Rebirth rock & plant packs) into the
// game's voxel-prop library. Each model keeps a compact palette of
// {color, shape} entries mapped from Minecraft block ids, plus RLE voxel
// runs. Interior voxels are pruned; oversized set pieces are skipped.
//
// Usage:
//   node game/scripts/convert-schem-props.mjs <cat>=<dir> [<cat>=<dir> ...]
// Output: game/src/content/props-data.ts

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { gunzipSync } from "zlib";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: node convert-schem-props.mjs <cat>=<dir> [...]");
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
      case 9: { const et = u8(); const n = i32(); const o = []; for (let i = 0; i < n; i++) o.push(payload(et)); return o; }
      case 10: { const d = {}; for (;;) { const tt = u8(); if (tt === 0) break; d[str()] = payload(tt); } return d; }
      case 11: { const n = i32(); pos += 4 * n; return []; }
      case 12: { const n = i32(); pos += 8 * n; return []; }
      default: throw new Error(`tag ${t}`);
    }
  }
  const t = u8(); str();
  return payload(t);
}

// Block colors: Minecraft-faithful flats. Family fallbacks catch the rest.
const COLORS = {
  stone: "#7f7f7f", andesite: "#888c8d", diorite: "#cecece", granite: "#9f6b58",
  tuff: "#6c6e67", deepslate: "#535353", calcite: "#dfe0dc", smooth_stone: "#9e9e9e",
  cobblestone: "#7a7a7a", mossy_cobblestone: "#6a7c58", blackstone: "#2a252c",
  smooth_basalt: "#48484e", end_stone: "#dbde9e", netherrack: "#6d3533",
  grass_block: "#6aac37", moss_block: "#5c8630", dirt: "#8a6144", coarse_dirt: "#7a5640",
  rooted_dirt: "#8a6144", mud: "#3c3a3d", packed_mud: "#8f6b50", clay: "#a0a6b2",
  sand: "#dbcfa3", sandstone: "#d8cb9b", smooth_sandstone: "#d8cb9b", red_sand: "#b8622f",
  smooth_red_sandstone: "#b8622f", gravel: "#84807f", snow_block: "#f5fbfb", ice: "#a5c3f0", packed_ice: "#8fb4e6",
  prismarine: "#63a397", prismarine_bricks: "#63b0a4", dark_prismarine: "#345f4f",
  sea_lantern: "#c9d7d3", sponge: "#c3c447",
  tube_coral_block: "#3054c4", fire_coral_block: "#c43121", bubble_coral_block: "#a1229a",
  horn_coral_block: "#d0ba3f", dead_fire_coral_block: "#867f7a", dead_brain_coral_block: "#867f7a",
  mushroom_stem: "#cbc4b8", brown_mushroom_block: "#916748", red_mushroom_block: "#c02722",
  nether_wart_block: "#71161a", warped_wart_block: "#177879", crimson_planks: "#6b344c",
  warped_planks: "#2b6963", nether_bricks: "#2c161a", red_nether_bricks: "#450709",
  purpur_block: "#a97ba9", quartz_block: "#ece5de", smooth_quartz: "#ece5de", chiseled_quartz_block: "#e7e0d9",
  bone_block: "#e0dcc9", honeycomb_block: "#e5951d", honey_block: "#f8b322", melon: "#8f9222", pumpkin: "#c67617",
  emerald_block: "#2cb05a", redstone_block: "#ab1a09", lapis_block: "#1f438c", diamond_block: "#62e0d8",
  gold_block: "#f6d33c", raw_gold_block: "#dda92f", iron_block: "#d8d8d8", coal_block: "#101010",
  copper_block: "#c06c50", cut_copper: "#bf6a4e", exposed_copper: "#a17e68", weathered_copper: "#6c9c6c",
  oxidized_copper: "#52a284", amethyst_block: "#8662bf", note_block: "#5c3c28",
  end_stone_bricks: "#d9dc9f", terracotta: "#985e43", cherry_leaves: "#f0a3c2", cobweb: "#e6eaea",
  wither_skeleton_skull: "#2a2a2a", end_rod: "#dcd3c6", iron_trapdoor: "#c6c6c6",
};
const WOOL = {
  white: "#e9ecec", orange: "#f07613", magenta: "#bd44b3", light_blue: "#3aafd9",
  yellow: "#f8c527", lime: "#70b919", pink: "#ed8dac", gray: "#3e4447",
  light_gray: "#8e8e86", cyan: "#158991", purple: "#792aac", blue: "#35399d",
  brown: "#724728", green: "#546d1b", red: "#a12722", black: "#141519",
};
function colorFor(name) {
  if (COLORS[name]) return COLORS[name];
  const m = name.match(/^([a-z_]+?)_(wool|concrete|concrete_powder|terracotta|stained_glass|stained_glass_pane|glazed_terracotta|candle)$/);
  if (m && WOOL[m[1]]) return WOOL[m[1]];
  // Wood family: planks/slabs/stairs/fences/logs by species tone.
  const woods = {
    oak: "#a8834f", spruce: "#735531", birch: "#c6b578", jungle: "#9a6e4d", acacia: "#a85a32",
    dark_oak: "#4a3117", mangrove: "#763631", cherry: "#e2b1a8", bamboo: "#c4ae53", crimson: "#6b344c", warped: "#2b6963",
  };
  for (const [w, c] of Object.entries(woods)) {
    if (name.startsWith(`${w}_`) || name.startsWith(`stripped_${w}`)) return c;
  }
  if (/quartz/.test(name)) return "#ece5de";
  if (/purpur/.test(name)) return "#a97ba9";
  if (/sandstone/.test(name)) return "#d8cb9b";
  if (/prismarine/.test(name)) return "#63a397";
  if (/blackstone/.test(name)) return "#2a252c";
  if (/stone_brick|mud_brick/.test(name)) return "#787878";
  if (/copper/.test(name)) return "#bf6a4e";
  if (/torch|candle|button|skull|rod|grass$|flower/.test(name)) return null; // tiny deco: skip
  return "#9a9a9a";
}
/** Shape: 0 full cube, 1 bottom slab, 2 thin post/pane, 3 carpet-thin. */
function shapeFor(name, state) {
  if (/_slab$/.test(name)) return /type=top/.test(state) ? 4 : 1;
  if (/trapdoor$/.test(name)) return 3;
  if (/_pane$|_fence$|_wall$|_rod$|fence_gate$/.test(name)) return 2;
  return 0;
}

const models = [];
const catCounts = {};
const catBytes = {};
// Per-category size gates; recolor-heavy families get capped variants.
const LIMITS = {
  rock: { r: 24, h: 40, n: 9000 },
  default: { r: 16, h: 26, n: 3400 },
};
const FAMILY_CAP = { details: 3, flowers: 6, mushrooms: 6, plants: 6 };
// Families that don't belong in the world (server-hub kit, ground decals).
const FAMILY_SKIP = { details: /^(texture|platform|board|npc_platform|portal)/ };
const familySeen = new Map();
for (const arg of args) {
  const [cat, dir] = arg.split("=");
  const lim = cat.startsWith("rock") ? LIMITS.rock : LIMITS.default;
  const famCap = FAMILY_CAP[cat];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".schem")).sort()) {
    const famName = basename(file, ".schem").replace(/[0-9]+$/, "");
    if (FAMILY_SKIP[cat]?.test(famName)) continue;
    if (famCap) {
      const family = `${cat}/${famName}`;
      const seen = familySeen.get(family) ?? 0;
      if (seen >= famCap) continue;
      familySeen.set(family, seen + 1);
    }
    const root = parseNbt(gunzipSync(readFileSync(join(dir, file))));
    const W = root.Width, H = root.Height, L = root.Length;
    // Palette: id -> {color, shape} or null (air/skip)
    const byId = new Map();
    for (const [key, id] of Object.entries(root.Palette)) {
      const name = key.replace("minecraft:", "").replace(/\[.*/, "");
      const state = key.includes("[") ? key.slice(key.indexOf("[")) : "";
      if (name === "air" || name === "cave_air") { byId.set(id, null); continue; }
      const c = colorFor(name);
      byId.set(id, c ? { c, s: shapeFor(name, state) } : null);
    }
    // BlockData: varints, YZX order.
    const data = root.BlockData;
    const cells = [];
    let pos = 0;
    for (let y = 0; y < H; y++) {
      for (let z = 0; z < L; z++) {
        for (let x = 0; x < W; x++) {
          let v = 0, shift = 0;
          for (;;) {
            const b = data[pos++];
            v |= (b & 0x7f) << shift;
            if ((b & 0x80) === 0) break;
            shift += 7;
          }
          const entry = byId.get(v);
          if (entry) cells.push([x, y, z, entry]);
        }
      }
    }
    if (cells.length < 3) continue;

    // Normalize: base at the lowest solid layer, centered on x/z.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, z0 = Infinity, z1 = -Infinity, y1 = -Infinity;
    for (const [x, y, z] of cells) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    const r = Math.max(x1 - x0, z1 - z0) >> 1;
    const h = y1 - y0 + 1;
    if (r > lim.r || h > lim.h || cells.length > lim.n) continue; // set pieces, not props
    const cx = Math.round((x0 + x1) / 2);
    const cz = Math.round((z0 + z1) / 2);

    // Palette per model; prune interior voxels (6-side enclosed full cubes).
    const solid = new Set();
    for (const [x, y, z, e] of cells) if (e.s === 0) solid.add(`${x},${y},${z}`);
    const enclosed = ([x, y, z]) =>
      solid.has(`${x + 1},${y},${z}`) && solid.has(`${x - 1},${y},${z}`) &&
      solid.has(`${x},${y + 1},${z}`) && solid.has(`${x},${y - 1},${z}`) &&
      solid.has(`${x},${y},${z + 1}`) && solid.has(`${x},${y},${z - 1}`);
    const pal = [];
    const palIdx = new Map();
    const kept = [];
    for (const [x, y, z, e] of cells) {
      if (e.s === 0 && enclosed([x, y, z])) continue;
      const key = `${e.c}/${e.s}`;
      let pi = palIdx.get(key);
      if (pi === undefined) {
        pi = pal.length;
        pal.push({ c: e.c, s: e.s });
        palIdx.set(key, pi);
      }
      kept.push([x - cx, y - y0, z - cz, pi]);
    }
    if (pal.length > 250) continue;
    kept.sort((a, b) => a[3] - b[3] || a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
    const runs = [];
    for (let i = 0; i < kept.length; ) {
      const [rx, ry, rz, pi] = kept[i];
      let len = 1;
      while (i + len < kept.length && kept[i + len][3] === pi && kept[i + len][1] === ry && kept[i + len][2] === rz && kept[i + len][0] === rx + len && len < 255) len++;
      runs.push(ry, rz + 32, rx + 32, len, pi);
      i += len;
    }
    models.push({
      id: `${cat}.${basename(file, ".schem")}`,
      cat,
      r,
      h,
      n: cells.length,
      pal,
      vox: Buffer.from(runs).toString("base64"),
    });
    catCounts[cat] = (catCounts[cat] || 0) + 1;
    catBytes[cat] = (catBytes[cat] || 0) + runs.length + JSON.stringify(pal).length;
  }
}

const json = JSON.stringify({ version: 1, models });
const __dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(
  join(__dir, "../src/content/props-data.ts"),
  "// Generated by game/scripts/convert-schem-props.mjs — do not edit.\n" +
    "// Voxel props baked from the user-licensed Rebirth rock/plant packs.\n" +
    `export const PROPS_JSON: string = ${JSON.stringify(json)};\n`,
);
console.log(`-> props-data.ts (${(json.length / 1024).toFixed(0)} KB)`, catCounts);
console.log("approx KB per cat:", Object.fromEntries(Object.entries(catBytes).map(([k, v]) => [k, Math.round(v / 1024)])));
