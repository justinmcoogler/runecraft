// Minecraft-Java-style resource pack importer, compatibility level 2:
// static block/item PNGs alias-mapped onto our logical material IDs (kept
// at their native square resolution, 16..128), plus the whitelisted entity
// textures (mob skins, chest atlas) at native size. Imported packs change
// pixels and nothing else. The archive is never executed or written
// anywhere; we read a whitelist of entries in memory and keep only
// converted textures.

import { unzipSync } from "fflate";
import { ENTITY_PATH_KEYS, planEntityTextures } from "./entities";

export const IMPORT_LIMITS = {
  maxArchiveBytes: 32 * 1024 * 1024,
  // Complete mainline packs ship ~10k files; only whitelisted textures are
  // ever decompressed, so the count guard is purely anti-pathological.
  maxEntries: 16384,
  maxEntryBytes: 8 * 1024 * 1024,
  maxImageDimension: 512,
};

export interface AliasDef {
  materialId: string;
  /** Accepted file names (no path), first match wins. */
  files: string[];
  /** Grayscale-in-vanilla textures get this tint applied (biome coloring). */
  tint?: string;
  note?: string;
}

/** Our alias table: which pack filenames feed which logical materials. */
export const ALIASES: AliasDef[] = [
  { materialId: "terrain.grass.top", files: ["grass_block_top.png", "grass_top.png"], tint: "#79c05a", note: "grass tinted" },
  { materialId: "terrain.grass.side", files: ["grass_block_side.png", "grass_side.png"] },
  { materialId: "terrain.dirt", files: ["dirt.png"] },
  { materialId: "terrain.stone", files: ["stone.png"] },
  { materialId: "terrain.sand", files: ["sand.png"] },
  { materialId: "terrain.water", files: ["water_still.png"], tint: "#3f76c9", note: "water tinted, first frame" },
  { materialId: "terrain.snow", files: ["snow.png"] },
  { materialId: "terrain.ice", files: ["ice.png"] },
  { materialId: "terrain.mud", files: ["mud.png"] },
  { materialId: "terrain.redsand", files: ["red_sand.png"] },
  { materialId: "terrain.mycelium", files: ["mycelium_top.png"] },
  { materialId: "resource.tree.birch.side", files: ["birch_log.png", "log_birch.png"] },
  { materialId: "terrain.stonebrick", files: ["stone_bricks.png", "stonebrick.png"] },
  { materialId: "roof.shingle", files: ["spruce_planks.png", "planks_spruce.png"] },
  { materialId: "roof.darkoak", files: ["dark_oak_planks.png", "planks_big_oak.png"] },
  { materialId: "roof.slate", files: ["deepslate_tiles.png", "stone_bricks.png"] },
  { materialId: "resource.tree.log.side", files: ["oak_log.png", "log_oak.png"] },
  { materialId: "resource.tree.log.top", files: ["oak_log_top.png", "log_oak_top.png"] },
  { materialId: "resource.tree.stump.top", files: ["oak_log_top.png", "log_oak_top.png"] },
  { materialId: "resource.tree.leaves", files: ["oak_leaves.png", "leaves_oak.png"], tint: "#59ae30", note: "leaves tinted" },
  { materialId: "resource.tree.spruce.side", files: ["spruce_log.png", "log_spruce.png"] },
  { materialId: "resource.tree.jungle.side", files: ["jungle_log.png", "log_jungle.png"] },
  { materialId: "resource.tree.acacia.side", files: ["acacia_log.png", "log_acacia.png"] },
  { materialId: "resource.tree.darkoak.side", files: ["dark_oak_log.png", "log_big_oak.png"] },
  { materialId: "resource.tree.blossom.side", files: ["cherry_log.png", "birch_log.png"] },
  { materialId: "resource.tree.birch.leaves", files: ["birch_leaves.png", "leaves_birch.png"], tint: "#80a755", note: "leaves tinted" },
  { materialId: "resource.tree.spruce.leaves", files: ["spruce_leaves.png", "leaves_spruce.png"], tint: "#619961", note: "leaves tinted" },
  { materialId: "resource.tree.jungle.leaves", files: ["jungle_leaves.png", "leaves_jungle.png"], tint: "#48b518", note: "leaves tinted" },
  { materialId: "resource.tree.acacia.leaves", files: ["acacia_leaves.png", "leaves_acacia.png"], tint: "#a3a23c", note: "leaves tinted" },
  { materialId: "resource.tree.darkoak.leaves", files: ["dark_oak_leaves.png", "leaves_big_oak.png"], tint: "#4e7a28", note: "leaves tinted" },
  { materialId: "resource.tree.blossom.leaves", files: ["cherry_leaves.png"], note: "cherry ships pre-colored" },
  { materialId: "resource.rock.stone", files: ["stone.png"] },
  { materialId: "resource.rock.copper", files: ["copper_ore.png"] },
  { materialId: "resource.rock.tin", files: ["iron_ore.png"], note: "tin uses iron ore art" },
  { materialId: "resource.rock.iron", files: ["iron_ore.png"] },
  { materialId: "resource.rock.coal", files: ["coal_ore.png"] },
  { materialId: "resource.rock.gold", files: ["gold_ore.png"] },
  { materialId: "resource.rock.diamond", files: ["diamond_ore.png"] },
  { materialId: "terrain.plank", files: ["oak_planks.png", "planks_oak.png"] },
  // Richer ground surfaces (the pack's own tiles).
  { materialId: "terrain.gravel", files: ["gravel.png"] },
  { materialId: "terrain.coarsedirt", files: ["coarse_dirt.png"] },
  { materialId: "terrain.podzol", files: ["podzol_top.png"] },
  { materialId: "terrain.clay", files: ["clay.png"] },
  { materialId: "terrain.moss", files: ["moss_block.png"] },
  { materialId: "terrain.andesite", files: ["andesite.png"] },
  { materialId: "terrain.terracotta", files: ["terracotta.png", "hardened_clay.png"] },
  { materialId: "terrain.redterracotta", files: ["red_terracotta.png"] },
  { materialId: "terrain.orangeterracotta", files: ["orange_terracotta.png"] },
  { materialId: "terrain.whiteterracotta", files: ["white_terracotta.png"] },
  // Per-species plank finishes — the pack's own plank art per wood.
  { materialId: "terrain.plank.birch", files: ["birch_planks.png", "planks_birch.png"] },
  { materialId: "terrain.plank.jungle", files: ["jungle_planks.png", "planks_jungle.png"] },
  { materialId: "terrain.plank.acacia", files: ["acacia_planks.png", "planks_acacia.png"] },
  { materialId: "terrain.plank.mangrove", files: ["mangrove_planks.png"] },
  { materialId: "terrain.plank.cherry", files: ["cherry_planks.png"] },
  { materialId: "terrain.plank.crimson", files: ["crimson_planks.png"] },
  { materialId: "terrain.plank.warped", files: ["warped_planks.png"] },
  { materialId: "terrain.plank.bamboo", files: ["bamboo_planks.png"] },
  { materialId: "terrain.plank.paleoak", files: ["pale_oak_planks.png"] },
  // Stone / brick families with the pack's own tiles.
  { materialId: "terrain.diorite", files: ["diorite.png"] },
  { materialId: "terrain.granite", files: ["granite.png"] },
  { materialId: "terrain.quartz", files: ["quartz_block_side.png", "quartz_block.png"] },
  { materialId: "terrain.calcite", files: ["calcite.png"] },
  { materialId: "terrain.basalt", files: ["basalt_side.png", "smooth_basalt.png"] },
  { materialId: "terrain.netherbrick", files: ["nether_bricks.png", "nether_brick.png"] },
  { materialId: "terrain.prismarine", files: ["prismarine.png", "prismarine_bricks.png"] },
  { materialId: "terrain.darkprismarine", files: ["dark_prismarine.png"] },
  { materialId: "terrain.purpur", files: ["purpur_block.png"] },
  { materialId: "terrain.endstone", files: ["end_stone.png", "end_stone_bricks.png"] },
  { materialId: "terrain.blackstone", files: ["blackstone.png", "polished_blackstone.png"] },
  { materialId: "terrain.deepslate", files: ["deepslate.png", "cobbled_deepslate.png"] },
  { materialId: "block.glass", files: ["glass.png"] },
  { materialId: "block.tintedglass", files: ["tinted_glass.png", "glass.png"] },
  { materialId: "terrain.drygrass", files: ["grass_block_top.png", "grass_top.png"], tint: "#bfb755", note: "dry grass tinted" },
  { materialId: "wall.plaster", files: ["white_terracotta.png", "hardened_clay_stained_white.png", "mushroom_block_inside.png"] },
  { materialId: "resource.digsite.face", files: ["rooted_dirt.png", "coarse_dirt.png"] },
  { materialId: "object.workbench.top", files: ["crafting_table_top.png"] },
  { materialId: "object.workbench.side", files: ["crafting_table_front.png", "crafting_table_side.png"] },
  { materialId: "object.pumpkin.side", files: ["pumpkin_side.png"] },
  { materialId: "object.pumpkin.top", files: ["pumpkin_top.png"] },
  { materialId: "object.melon.side", files: ["melon_side.png"] },
  { materialId: "object.melon.top", files: ["melon_top.png"] },
  { materialId: "object.barrel.side", files: ["barrel_side.png"] },
  { materialId: "object.barrel.top", files: ["barrel_top.png"] },
  { materialId: "object.cauldron.side", files: ["cauldron_side.png"] },
  { materialId: "object.haybale.side", files: ["hay_block_side.png"] },
  { materialId: "object.haybale.top", files: ["hay_block_top.png"] },
  { materialId: "object.door.top", files: ["oak_door_top.png", "door_wood_upper.png"] },
  { materialId: "object.door.bottom", files: ["oak_door_bottom.png", "door_wood_lower.png"] },
  { materialId: "object.lantern.sheet", files: ["lantern.png"], note: "lantern body from the block sheet" },
  { materialId: "sprite.bush.berry.full", files: ["sweet_berry_bush_stage3.png"] },
  { materialId: "sprite.bush.berry.bare", files: ["sweet_berry_bush_stage1.png"] },
  { materialId: "sprite.crop.wheat.full", files: ["wheat_stage7.png", "wheat_stage_7.png"] },
  { materialId: "sprite.crop.wheat.sprout", files: ["wheat_stage2.png", "wheat_stage_2.png"] },
  { materialId: "sprite.herb.full", files: ["fern.png"], tint: "#59ae30", note: "herbs use tinted fern art" },
  { materialId: "sprite.herb.bare", files: ["dead_bush.png", "deadbush.png"] },
  { materialId: "sprite.flowers.wild", files: ["oxeye_daisy.png", "flower_oxeye_daisy.png"] },
  { materialId: "sprite.reeds", files: ["sugar_cane.png", "reeds.png"], tint: "#87b25a", note: "reeds tinted" },
  { materialId: "sprite.grass.tuft", files: ["short_grass.png", "grass.png", "tallgrass.png"], tint: "#79b855", note: "grass tinted" },
  { materialId: "sprite.flame", files: ["fire_0.png", "fire_layer_0.png"], note: "flame uses the first fire frame" },
  { materialId: "object.furnace.side", files: ["furnace_side.png"] },
  { materialId: "object.furnace.front", files: ["furnace_front.png", "furnace_front_on.png"] },
  { materialId: "sprite.item.axe", files: ["iron_axe.png", "stone_axe.png"] },
  { materialId: "sprite.item.pickaxe", files: ["iron_pickaxe.png", "stone_pickaxe.png"] },
  { materialId: "sprite.item.sword", files: ["iron_sword.png", "stone_sword.png"] },
  { materialId: "sprite.item.rod", files: ["fishing_rod.png", "fishing_rod_uncast.png"] },
  { materialId: "sprite.item.hammer", files: [] , note: "no standard art; built-in kept" },
  // Inventory icons: recognizable vanilla item art, tinted where the game's
  // material has no exact vanilla counterpart.
  { materialId: "icon.log", files: ["oak_log.png", "log_oak.png"] },
  { materialId: "icon.plank", files: ["oak_planks.png", "planks_oak.png"] },
  { materialId: "icon.bar.iron", files: ["iron_ingot.png"] },
  { materialId: "icon.bar.gold", files: ["gold_ingot.png"] },
  { materialId: "icon.bar.copper", files: ["copper_ingot.png"] },
  { materialId: "icon.bar.tin", files: ["iron_ingot.png"], tint: "#dfe6ea" },
  { materialId: "icon.bar.bronze", files: ["copper_ingot.png"], tint: "#d9a05a" },
  { materialId: "icon.ore.iron", files: ["raw_iron.png"] },
  { materialId: "icon.ore.gold", files: ["raw_gold.png"] },
  { materialId: "icon.ore.copper", files: ["raw_copper.png"] },
  { materialId: "icon.ore.tin", files: ["raw_iron.png"], tint: "#e3e9ee" },
  { materialId: "icon.ore.coal", files: ["coal.png"] },
  { materialId: "icon.gem.diamond", files: ["diamond.png"] },
  { materialId: "icon.fish.raw", files: ["cod.png", "fish_cod_raw.png"] },
  { materialId: "icon.fish.cooked", files: ["cooked_cod.png", "fish_cod_cooked.png"] },
  { materialId: "icon.fish.fancy", files: ["salmon.png", "fish_salmon_raw.png"] },
  { materialId: "icon.fish.fancy.cooked", files: ["cooked_salmon.png"] },
  { materialId: "icon.berries", files: ["sweet_berries.png"] },
  { materialId: "icon.bread", files: ["bread.png"] },
  { materialId: "icon.wheat", files: ["wheat.png"] },
  { materialId: "icon.carrot", files: ["carrot.png"] },
  { materialId: "icon.potato", files: ["potato.png"] },
  { materialId: "icon.potato.baked", files: ["baked_potato.png"] },
  { materialId: "icon.melon", files: ["melon_slice.png"] },
  { materialId: "icon.beef.raw", files: ["beef.png", "beef_raw.png"] },
  { materialId: "icon.beef.cooked", files: ["cooked_beef.png"] },
  { materialId: "icon.pork.raw", files: ["porkchop.png", "porkchop_raw.png"] },
  { materialId: "icon.pork.cooked", files: ["cooked_porkchop.png"] },
  { materialId: "icon.chicken.raw", files: ["chicken.png", "chicken_raw.png"] },
  { materialId: "icon.chicken.cooked", files: ["cooked_chicken.png"] },
  { materialId: "icon.mutton.raw", files: ["mutton.png", "mutton_raw.png"] },
  { materialId: "icon.mutton.cooked", files: ["cooked_mutton.png"] },
  { materialId: "icon.rabbit.cooked", files: ["cooked_rabbit.png"] },
  { materialId: "icon.rabbit.raw", files: ["rabbit.png", "rabbit_raw.png"] },
  { materialId: "icon.bone", files: ["bone.png"] },
  { materialId: "icon.slime", files: ["slime_ball.png", "slimeball.png"] },
  { materialId: "icon.venom", files: ["spider_eye.png"] },
  { materialId: "icon.leather", files: ["leather.png"] },
  { materialId: "icon.hide.wolf", files: ["rabbit_hide.png", "leather.png"], tint: "#9b9186" },
  { materialId: "icon.feather", files: ["feather.png"] },
  { materialId: "icon.coin", files: ["gold_nugget.png"] },
  { materialId: "icon.wool", files: ["string.png"], tint: "#eceff1" },
  { materialId: "icon.rope", files: ["string.png"], tint: "#c9a86a" },
  { materialId: "icon.egg", files: ["egg.png"] },
  { materialId: "icon.stone", files: ["cobblestone.png"] },
  { materialId: "icon.brick", files: ["brick.png"] },
  { materialId: "icon.seeds", files: ["wheat_seeds.png", "seeds_wheat.png"] },
  { materialId: "icon.helmet.leather", files: ["leather_helmet.png"] },
  { materialId: "icon.chest.leather", files: ["leather_chestplate.png"] },
  { materialId: "icon.legs.leather", files: ["leather_leggings.png"] },
  { materialId: "icon.boots.leather", files: ["leather_boots.png"] },
  { materialId: "icon.helmet.iron", files: ["iron_helmet.png"] },
  { materialId: "icon.chest.iron", files: ["iron_chestplate.png"] },
  { materialId: "icon.legs.iron", files: ["iron_leggings.png"] },
  { materialId: "icon.boots.iron", files: ["iron_boots.png"] },
];

/** The 16 dye colors, in vanilla order — used to generate the coloured
 *  block-family aliases below. */
export const DYE_COLORS = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
] as const;

// Coloured block families (wool, concrete, terracotta) get the pack's own
// per-colour tile instead of a flat swatch — logical id block.<family>.<color>.
for (const family of ["wool", "concrete", "terracotta"] as const) {
  for (const color of DYE_COLORS) {
    ALIASES.push({ materialId: `block.${family}.${color}`, files: [`${color}_${family}.png`] });
  }
}
ALIASES.push({ materialId: "block.terracotta.plain", files: ["terracotta.png", "hardened_clay.png"] });
// Stained glass keeps its own per-colour tile (rendered translucent).
for (const color of DYE_COLORS) {
  ALIASES.push({ materialId: `block.stained_glass.${color}`, files: [`${color}_stained_glass.png`] });
}

export interface ImportReport {
  packName: string;
  recognized: Array<{ materialId: string; file: string }>;
  missing: string[];
  ignoredCount: number;
  notes: string[];
}

export interface ExtractResult {
  entries: Record<string, Uint8Array>; // basename -> bytes (whitelisted textures)
  /** entity-relative path (e.g. "pig/temperate_pig.png") -> bytes */
  entityEntries: Record<string, Uint8Array>;
  ignoredCount: number;
  error?: string;
}

const TEXTURE_DIR = /(^|\/)assets\/minecraft\/textures\/(block|blocks|item|items)\/[^/]+\.png$/;
const ENTITY_DIR = /(^|\/)assets\/minecraft\/textures\/entity\/(.+\.png)$/;

/** Entity-relative path when this archive entry is a whitelisted entity texture. */
function entityPathOf(name: string): string | null {
  const match = ENTITY_DIR.exec(name);
  if (!match) return null;
  return ENTITY_PATH_KEYS.has(match[2]) ? match[2] : null;
}

/**
 * Safely enumerate + extract only whitelisted texture entries from a pack ZIP.
 * Enforces archive/entry/count limits and rejects suspicious paths.
 */
export function extractCandidates(zipBytes: Uint8Array): ExtractResult {
  if (zipBytes.length > IMPORT_LIMITS.maxArchiveBytes) {
    return { entries: {}, entityEntries: {}, ignoredCount: 0, error: "Archive is larger than 32 MB." };
  }
  let entryCount = 0;
  let ignoredCount = 0;
  let tooMany = false;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zipBytes, {
      filter: (file) => {
        entryCount++;
        if (entryCount > IMPORT_LIMITS.maxEntries) {
          tooMany = true;
          return false;
        }
        const name = file.name;
        // No traversal/absolute paths, no oversized entries, textures only.
        if (name.includes("..") || name.startsWith("/") || /^[a-zA-Z]:/.test(name)) {
          ignoredCount++;
          return false;
        }
        if (file.originalSize > IMPORT_LIMITS.maxEntryBytes) {
          ignoredCount++;
          return false;
        }
        if (!TEXTURE_DIR.test(name) && entityPathOf(name) === null) {
          ignoredCount++;
          return false;
        }
        return true;
      },
    });
  } catch {
    return { entries: {}, entityEntries: {}, ignoredCount, error: "This file is not a readable ZIP archive." };
  }
  if (tooMany) {
    return { entries: {}, entityEntries: {}, ignoredCount, error: "Archive has too many entries (limit 4096)." };
  }
  const entries: Record<string, Uint8Array> = {};
  const entityEntries: Record<string, Uint8Array> = {};
  // Some names exist as both block and item art (lantern.png): block wins,
  // regardless of archive order — block aliases outnumber item ones and
  // item sprites are only ever matched by item-exclusive names.
  const fromBlockDir = new Map<string, boolean>();
  const isBlockPath = (p: string) => /(^|\/)textures\/(block|blocks)\//.test(p);
  for (const [path, bytes] of Object.entries(files)) {
    const entityPath = entityPathOf(path);
    if (entityPath !== null) {
      if (!(entityPath in entityEntries)) entityEntries[entityPath] = bytes;
      continue;
    }
    const base = path.split("/").pop()!;
    const isBlock = isBlockPath(path);
    if (!(base in entries) || (isBlock && !fromBlockDir.get(base))) {
      entries[base] = bytes;
      fromBlockDir.set(base, isBlock);
    }
  }
  return { entries, entityEntries, ignoredCount };
}

export interface PlannedTexture {
  materialId: string;
  file: string;
  tint?: string;
  note?: string;
}

/** Match extracted filenames against the alias table. Pure and testable. */
export function planAliases(availableFiles: string[]): {
  planned: PlannedTexture[];
  missing: string[];
  notes: string[];
} {
  const available = new Set(availableFiles);
  const planned: PlannedTexture[] = [];
  const missing: string[] = [];
  const notes = new Set<string>();
  for (const alias of ALIASES) {
    const file = alias.files.find((f) => available.has(f));
    if (file) {
      planned.push({ materialId: alias.materialId, file, tint: alias.tint, note: alias.note });
      if (alias.note) notes.add(alias.note);
    } else {
      missing.push(alias.materialId);
    }
  }
  return { planned, missing, notes: [...notes] };
}

/** Browser-only: PNG bytes -> HTMLImageElement (or null). */
async function decodeImage(bytes: Uint8Array): Promise<HTMLImageElement | null> {
  const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("bad png"));
      el.src = url;
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Browser-only: decode a block/item PNG, crop animation strips to frame 0,
 * keep the pack's native square resolution (clamped to 16..128; held-item
 * sprites force 16 because the hand voxelizes them per pixel).
 */
async function toNormalizedCanvas(bytes: Uint8Array, tint?: string, forceSize?: number): Promise<HTMLCanvasElement | null> {
  const img = await decodeImage(bytes);
  if (!img) return null;
  const { width, height } = img;
  if (width < 8 || width > IMPORT_LIMITS.maxImageDimension) return null;
  if (height < 8 || height > IMPORT_LIMITS.maxImageDimension * 32) return null;
  const frame = Math.min(height, width); // animation strips: first square frame
  const size = forceSize ?? Math.max(16, Math.min(128, frame));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0, width, frame, 0, 0, size, size);
  if (tint) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(img, 0, 0, width, frame, 0, 0, size, size); // restore alpha
    ctx.globalCompositeOperation = "source-over";
  }
  return canvas;
}

/** Browser-only: decode an entity texture at its native size (no cropping). */
async function toEntityCanvas(bytes: Uint8Array): Promise<HTMLCanvasElement | null> {
  const img = await decodeImage(bytes);
  if (!img) return null;
  const { width, height } = img;
  if (width < 32 || width > IMPORT_LIMITS.maxImageDimension) return null;
  if (height < 16 || height > IMPORT_LIMITS.maxImageDimension) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  return canvas;
}

export interface ImportedPack {
  id: string;
  name: string;
  createdAt: string;
  /**
   * materialId -> PNG data URL (native square size for blocks/items), plus
   * entity skin keys ("entity.pig", ...) -> native-size entity textures.
   */
  textures: Record<string, string>;
  report: ImportReport;
}

/** Full browser import pipeline: File -> validated, converted, reportable pack. */
export async function importPackFile(file: File): Promise<{ pack?: ImportedPack; error?: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extracted = extractCandidates(bytes);
  if (extracted.error) return { error: extracted.error };

  const { planned, missing, notes } = planAliases(Object.keys(extracted.entries));
  if (planned.length === 0) {
    return { error: "No recognizable textures found in this pack." };
  }

  const textures: Record<string, string> = {};
  const recognized: Array<{ materialId: string; file: string }> = [];
  const failed: string[] = [];
  for (const plan of planned) {
    const forceSize = plan.materialId.startsWith("sprite.item.") || plan.materialId.startsWith("icon.") ? 16 : undefined;
    const canvas = await toNormalizedCanvas(extracted.entries[plan.file], plan.tint, forceSize);
    if (canvas) {
      textures[plan.materialId] = canvas.toDataURL("image/png");
      recognized.push({ materialId: plan.materialId, file: plan.file });
    } else {
      failed.push(plan.file);
      missing.push(plan.materialId);
    }
  }
  if (recognized.length === 0) return { error: "The pack's textures could not be decoded." };
  // Entity skins (mobs, the chest atlas) come along at native size.
  for (const plan of planEntityTextures(Object.keys(extracted.entityEntries))) {
    const canvas = await toEntityCanvas(extracted.entityEntries[plan.path]);
    if (canvas) {
      textures[plan.key] = canvas.toDataURL("image/png");
      recognized.push({ materialId: plan.key, file: plan.path });
    } else {
      failed.push(plan.path);
    }
  }
  if (failed.length > 0) notes.push(`${failed.length} texture(s) failed to decode and were skipped`);
  notes.push("block art kept at the pack's native resolution");

  const name = file.name.replace(/\.zip$/i, "");
  return {
    pack: {
      id: `pack.${Date.now().toString(36)}`,
      name,
      createdAt: new Date().toISOString(),
      textures,
      report: {
        packName: name,
        recognized,
        missing: [...new Set(missing)].sort(),
        ignoredCount: extracted.ignoredCount,
        notes,
      },
    },
  };
}
