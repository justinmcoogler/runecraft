// Minecraft block-state -> render spec mapping. Materials resolve through
// the same logical ids as everything else (texture-pack safe); blocks with
// no natural material get a plain color. Shapes follow vanilla model sizes.
//
// Resolution order: CUSTOM_BLOCKS (learned from uploads) > skip list >
// shaped families > named cubes > color families > keyword/hash guess.
// Nothing ever renders featureless gray: unknown blocks get a deterministic
// guessed color and are reported so the bake can add them to CUSTOM_BLOCKS.

import { CUSTOM_BLOCKS } from "./custom-blocks";
import { BLOCK_TEXTURE_COLORS } from "./texture-colors";
import type { BlockKind, Facing, StructureBlock } from "./types";

export interface BlockSpec {
  kind: BlockKind | "skip";
  material?: string;
  color?: string;
  translucent?: boolean;
  wide?: boolean;
}

const WOOL_COLORS: Record<string, string> = {
  white: "#e9ecec", orange: "#f07613", magenta: "#bd44b3", light_blue: "#3aafd9",
  yellow: "#f8c527", lime: "#70b919", pink: "#ed8dac", gray: "#3e4447",
  light_gray: "#8e8e86", cyan: "#158991", purple: "#792aac", blue: "#35399d",
  brown: "#724728", green: "#546d1b", red: "#a12722", black: "#141519",
};

const PLANK_COLORS: Record<string, string> = {
  oak: "", // -> terrain.plank
  spruce: "", // -> roof.shingle
  dark_oak: "", // -> roof.darkoak
  birch: "#d9c9a3", jungle: "#9a6e4e", acacia: "#a85a32", mangrove: "#773934",
  cherry: "#e2b6b0", bamboo: "#c4a54e", crimson: "#7e3a56", warped: "#398382",
  pale_oak: "#e7e0d4",
};

/** Per-species plank/slab/stair finish — a real texture, not a flat swatch. */
const PLANK_MATERIAL: Record<string, string> = {
  oak: "terrain.plank", spruce: "roof.shingle", dark_oak: "roof.darkoak",
  birch: "terrain.plank.birch", jungle: "terrain.plank.jungle",
  acacia: "terrain.plank.acacia", mangrove: "terrain.plank.mangrove",
  cherry: "terrain.plank.cherry", crimson: "terrain.plank.crimson",
  warped: "terrain.plank.warped", bamboo: "terrain.plank.bamboo",
  pale_oak: "terrain.plank.paleoak",
};

/** Per-species log/wood bark side, so timber walls aren't all oak. */
const LOG_SIDE: Record<string, string> = {
  birch: "resource.tree.birch.side", spruce: "resource.tree.spruce.side",
  jungle: "resource.tree.jungle.side", acacia: "resource.tree.acacia.side",
  dark_oak: "resource.tree.darkoak.side", cherry: "resource.tree.blossom.side",
};

/** Stone/brick families that now carry a real texture instead of a colour. */
const STONE_MATERIAL: Record<string, string> = {
  diorite: "terrain.diorite", polished_diorite: "terrain.diorite", calcite: "terrain.calcite",
  granite: "terrain.granite", polished_granite: "terrain.granite",
  quartz_block: "terrain.quartz", smooth_quartz: "terrain.quartz", chiseled_quartz_block: "terrain.quartz",
  quartz_pillar: "terrain.quartz", quartz_bricks: "terrain.quartz", nether_quartz_ore: "terrain.stone",
  nether_bricks: "terrain.netherbrick", chiseled_nether_bricks: "terrain.netherbrick",
  cracked_nether_bricks: "terrain.netherbrick",
  basalt: "terrain.basalt", polished_basalt: "terrain.basalt", smooth_basalt: "terrain.basalt",
  prismarine: "terrain.prismarine", prismarine_bricks: "terrain.prismarine",
  dark_prismarine: "terrain.darkprismarine",
  purpur_block: "terrain.purpur", purpur_pillar: "terrain.purpur",
  end_stone: "terrain.endstone", end_stone_bricks: "terrain.endstone",
};

/** Whole-block colors for vanilla families with no logical material. */
const NAMED_CUBES: Record<string, string> = {
  // stones & processed stone (diorite/granite/quartz/calcite now textured
  // through baseMaterial, so they no longer live here)
  dripstone_block: "#866043", podzol: "#5b4021", gravel: "#807c7b",
  bedrock: "#565656", amethyst_block: "#8662bf", budding_amethyst: "#8662bf",
  // nether
  netherrack: "#7a3535", soul_sand: "#513e33", soul_soil: "#4b3a30",
  magma_block: "#8e3f20", nether_wart_block: "#74090c", warped_wart_block: "#167e86",
  glowstone: "#ffe9a8", obsidian: "#221d2e", crying_obsidian: "#31264a",
  ancient_debris: "#61443a", netherite_block: "#42383b",
  // ocean (prismarine/end/purpur textured through baseMaterial)
  sea_lantern: "#c8ded6",
  // metals & minerals
  iron_block: "#d8d8d8", gold_block: "#f8c527", raw_gold_block: "#dda92f",
  raw_iron_block: "#d8af93", coal_block: "#141519", redstone_block: "#ab1e09",
  lapis_block: "#1f4699", emerald_block: "#2cb857", diamond_block: "#62e9dd",
  // organic
  hay_block: "#d9b03f", bone_block: "#d5d1b0", clay: "#9aa2ad",
  sponge: "#b7b246", wet_sponge: "#a0a03a", melon: "#6d9930",
  cactus: "#5b7e33", moss_block: "#596e2d", honeycomb_block: "#e8a33c",
  dried_kelp_block: "#333b26", target: "#d2ab8f",
  red_mushroom_block: "#b02e26", brown_mushroom_block: "#957051",
  mushroom_stem: "#cbc4b9", bamboo_block: "#84a32f", stripped_bamboo_block: "#c4a54e",
  mangrove_roots: "#4a3d2a", muddy_mangrove_roots: "#54442e",
  // sculk
  sculk: "#0d2129", sculk_catalyst: "#1e3437", sculk_sensor: "#0f3843",
  sculk_shrieker: "#2a3d3f", reinforced_deepslate: "#4c4f4a",
  // froglights & light cubes handled below; utility blocks
  crafting_table: "", bookshelf: "", chiseled_bookshelf: "", barrel: "",
  composter: "", cartography_table: "", fletching_table: "", loom: "",
  smithing_table: "#37343c", lodestone: "#7c7e82", jukebox: "#6b4f33",
  note_block: "#6b4f33", piston: "#6e6960", sticky_piston: "#6e6960",
  observer: "#62615d", dispenser: "", dropper: "", tnt: "#a8442c",
  redstone_lamp: "#7a4d2b", slime_block: "#6fc05b", honey_block: "#f0a929",
  beacon: "#74e8e3", conduit: "#9a8464", shulker_box: "#8f668f",
  ender_chest: "#2c3e3f", enchanting_table: "#a4243b", respawn_anchor: "#4b2557",
  cake: "#efe6d5",
};

/** Coral blocks (and their dead gray forms). */
const CORAL_COLORS: Record<string, string> = {
  tube: "#3156d2", brain: "#d05fa3", bubble: "#a61ba3", fire: "#a3241f", horn: "#d1ba3f",
};

/** Copper's oxidation stages (any *copper* name picks its stage color). */
function copperColor(name: string): string {
  if (name.includes("oxidized")) return "#53a284";
  if (name.includes("weathered")) return "#6da583";
  if (name.includes("exposed")) return "#a87762";
  if (name.includes("raw")) return "#9a4b26";
  return "#c47a3d";
}

/**
 * Auto-recognition: any block with a texture in the extracted color table
 * resolves to that texture's average color, so vanilla blocks we never
 * explicitly mapped still render true. Tries the usual texture-name
 * variants (top/side/front, waxed_ stripping, wood->log).
 */
export function textureColorFor(name: string): string | null {
  const base = name.replace(/^waxed_/, "");
  const candidates = [
    base,
    `${base}_top`,
    `${base}_side`,
    `${base}_front`,
    base.replace(/_block$/, ""),
    `${base}_still`,
    base.replace(/_wood$/, "_log"),
    base.replace(/_hyphae$/, "_stem"),
  ];
  for (const candidate of candidates) {
    const color = BLOCK_TEXTURE_COLORS[candidate];
    if (color) return color;
  }
  return null;
}

/** Deterministic muted color for a name — same block, same color, always. */
export function guessColor(name: string): string {
  const KEYWORDS: Array<[RegExp, string]> = [
    [/quartz|white|bone|calcite|snow/, "#dcdcd8"],
    [/black|coal|basalt|blackstone/, "#2a2a2e"],
    [/deepslate|slate|tuff/, "#57595c"],
    [/stone|rock|cobble|andesite|brick/, "#8a8a8a"],
    [/oak|spruce|birch|wood|plank|log|bamboo/, "#9a7648"],
    [/crimson|red|fire/, "#a12722"],
    [/warped|cyan|teal/, "#398382"],
    [/gold|yellow|honey/, "#e0b13c"],
    [/copper|orange/, "#c47a3d"],
    [/iron|silver|gray/, "#a8a8a8"],
    [/emerald|green|moss|leaf|leaves/, "#4f7f3c"],
    [/lapis|blue|sapphire/, "#35529d"],
    [/purple|amethyst|purpur/, "#8662bf"],
    [/pink|cherry/, "#e2a6b0"],
    [/mud|dirt|soil|brown/, "#6b4f33"],
    [/sand/, "#dbcfa3"],
    [/end/, "#dbde9e"],
    [/nether|soul/, "#6b4038"],
  ];
  for (const [re, color] of KEYWORDS) if (re.test(name)) return color;
  // Hash the name onto a muted hue so distinct unknowns stay distinct.
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  return hslHex(hue, 0.3, 0.55);
}

function hslHex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Ground plants rendered as crossed 16x16 sprites (see renderer crossSprite).
 *  Flowers share one wild-flower sprite; grasses/ferns a tuft; crops a wheat
 *  sprite; canes/bamboo reeds; berry bush and mushrooms a herb sprite. */
const PLANT_SPRITE: Record<string, string> = {
  grass: "sprite.grass.tuft", short_grass: "sprite.grass.tuft", tall_grass: "sprite.grass.tuft",
  fern: "sprite.grass.tuft", large_fern: "sprite.grass.tuft", dead_bush: "sprite.grass.tuft",
  seagrass: "sprite.grass.tuft", tall_seagrass: "sprite.grass.tuft", nether_sprouts: "sprite.grass.tuft",
  crimson_roots: "sprite.grass.tuft", warped_roots: "sprite.grass.tuft",
  wheat: "sprite.crop.wheat.full", carrots: "sprite.crop.wheat.full", potatoes: "sprite.crop.wheat.full",
  beetroots: "sprite.crop.wheat.full", nether_wart: "sprite.crop.wheat.full",
  torchflower_crop: "sprite.crop.wheat.sprout", pitcher_crop: "sprite.crop.wheat.sprout",
  sugar_cane: "sprite.reeds", bamboo: "sprite.reeds", kelp: "sprite.reeds", kelp_plant: "sprite.reeds",
  sweet_berry_bush: "sprite.bush.berry.full",
  brown_mushroom: "sprite.herb.full", red_mushroom: "sprite.herb.full",
  crimson_fungus: "sprite.herb.full", warped_fungus: "sprite.herb.full",
};
const FLOWERS = new Set([
  "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "oxeye_daisy",
  "cornflower", "lily_of_the_valley", "wither_rose", "torchflower", "pitcher_plant",
  "sunflower", "lilac", "rose_bush", "peony", "spore_blossom",
]);
function plantSprite(name: string): string | null {
  if (FLOWERS.has(name)) return "sprite.flowers.wild";
  if (PLANT_SPRITE[name]) return PLANT_SPRITE[name];
  if (name.endsWith("_sapling")) return "sprite.grass.tuft";
  if (name.endsWith("_tulip")) return "sprite.flowers.wild";
  return null;
}

/** Plants, tiny redstone parts, and pure decor skipped at this scale. */
const SKIP_EXACT = new Set([
  "air", "cave_air", "void_air", "structure_void", "barrier", "light",
  "grass", "short_grass", "tall_grass", "fern", "large_fern", "seagrass", "tall_seagrass",
  "vine", "glow_lichen", "sculk_vein", "snow", // the thin layer, not the block
  "dead_bush", "sugar_cane", "bamboo", "bamboo_sapling", "cobweb",
  "wheat", "carrots", "potatoes", "beetroots", "sweet_berry_bush", "cocoa", "sapling",
  "melon_stem", "pumpkin_stem", "attached_melon_stem", "attached_pumpkin_stem",
  "nether_wart", "torchflower_crop", "pitcher_crop", "kelp", "kelp_plant",
  "cave_vines", "cave_vines_plant", "twisting_vines", "twisting_vines_plant",
  "weeping_vines", "weeping_vines_plant", "hanging_roots", "spore_blossom",
  "big_dripleaf", "big_dripleaf_stem", "small_dripleaf", "pink_petals",
  "dandelion", "poppy", "blue_orchid", "allium", "azure_bluet", "oxeye_daisy",
  "cornflower", "lily_of_the_valley", "wither_rose", "torchflower", "pitcher_plant",
  "sunflower", "lilac", "rose_bush", "peony", "lily_pad",
  "brown_mushroom", "red_mushroom", "crimson_fungus", "warped_fungus",
  "crimson_roots", "warped_roots", "nether_sprouts",
  "pointed_dripstone", "frogspawn", "turtle_egg", "sniffer_egg",
  "redstone_wire", "repeater", "comparator", "lever", "tripwire", "tripwire_hook",
  "string", "sea_pickle", "bell", "flower_pot",
]);

const SKIP_SUFFIX = [
  "_sapling", "_button", "_pressure_plate", "_tulip", "_potted",
  "_coral", "_coral_fan", "_coral_wall_fan", "_head", "_skull", "_candle_cake",
];

/** Signs -> a plank board on a post; the wood species picks the finish.
 *  Matches oak_sign, oak_wall_sign, oak_hanging_sign, oak_wall_hanging_sign. */
function signMaterial(name: string): string | null {
  if (!name.endsWith("_sign")) return null;
  const wood = name.replace(/(_wall)?(_hanging)?_sign$/, "");
  return PLANK_MATERIAL[wood] ?? "terrain.plank";
}
/** Banners (standing or wall) -> a dyed cloth; the color is the dye. */
function bannerColor(name: string): string | null {
  if (!name.endsWith("_banner")) return null;
  const color = name.replace(/(_wall)?_banner$/, "");
  return WOOL_COLORS[color] ?? "#e9ecec";
}

/** Resolve one block name (minecraft: prefix stripped) + properties. */
export function specFor(name: string, props: Record<string, string>): BlockSpec {
  // ---- learned blocks override everything ----
  const custom = CUSTOM_BLOCKS[name];
  if (custom) return { ...custom };

  // ---- ground plants -> crossed sprites (before the skip list) ----
  const plant = plantSprite(name);
  if (plant) return { kind: "cross", material: plant };

  // ---- signs and banners ----
  const signMat = signMaterial(name);
  if (signMat) return { kind: "sign", material: signMat };
  const bannerCol = bannerColor(name);
  if (bannerCol) return { kind: "banner", color: bannerCol };

  // ---- air and pure decor we skip at this scale ----
  if (SKIP_EXACT.has(name) || SKIP_SUFFIX.some((s) => name.endsWith(s))) {
    return { kind: "skip" };
  }
  if (name.startsWith("potted_")) return { kind: "skip" };

  // ---- shaped families first (suffix routing) ----
  if (name.endsWith("_stairs")) {
    return { kind: "stairs", ...baseMaterial(name.slice(0, -7)) };
  }
  if (name.endsWith("_slab")) {
    return { kind: "slab", ...baseMaterial(name.slice(0, -5)) };
  }
  if (name.endsWith("_fence_gate")) {
    // Gates swing open — a door panel, so walkers pass through the gateway.
    return { kind: "panel", ...baseMaterial(name.slice(0, -11)) };
  }
  if (name.endsWith("_fence")) {
    return { kind: "post", ...baseMaterial(name.slice(0, -6)) };
  }
  if (name.endsWith("_wall")) {
    return { kind: "post", wide: true, ...baseMaterial(name.slice(0, -5)) };
  }
  if (name.endsWith("_door")) {
    return { kind: "panel", ...baseMaterial(name.slice(0, -5)) };
  }
  if (name.endsWith("_trapdoor")) {
    return { kind: "thin", ...baseMaterial(name.slice(0, -9)) };
  }
  if (name.endsWith("_shelf")) {
    // 1.21 wooden shelves — a full-ish wooden block at this scale.
    const wood = name.slice(0, -6);
    return { kind: "cube", material: PLANK_MATERIAL[wood] ?? "terrain.plank" };
  }
  if (name.endsWith("_carpet") || name === "moss_carpet") {
    const root = name.replace(/_carpet$/, "");
    if (WOOL_COLORS[root]) return { kind: "thin", material: `block.wool.${root}`, color: WOOL_COLORS[root] };
    return { kind: "thin", color: root === "moss" ? "#596e2d" : guessColor(root) };
  }
  if (name.endsWith("_bed")) {
    // Beds are 9/16 high — a colored slab reads right.
    return { kind: "slab", color: WOOL_COLORS[name.slice(0, -4)] ?? "#a12722" };
  }
  if (name.endsWith("_pane") || name === "iron_bars") {
    return name === "iron_bars"
      ? { kind: "pane", color: "#a8adad" }
      : { kind: "pane", color: "#cfe8ff", translucent: true };
  }
  if (name === "chain") return { kind: "post", color: "#33363f" };
  if (name === "ladder" || name === "scaffolding") {
    return { kind: "post", material: "terrain.plank" };
  }
  if (name.endsWith("_rail") || name === "rail") return { kind: "thin", color: "#8c7853" };
  // Block-shaped utility furniture: real materials so they don't all read as
  // the same grey post. Cauldrons reuse the painted cauldron shell, the
  // stone tools take a stone face, the lectern is planks.
  if (name === "cauldron" || name === "water_cauldron" || name === "lava_cauldron") {
    return { kind: "cube", material: "object.cauldron.side" };
  }
  if (name === "anvil" || name === "chipped_anvil" || name === "damaged_anvil") {
    return { kind: "cube", color: "#43464b" };
  }
  if (name === "grindstone" || name === "stonecutter") {
    return { kind: "cube", material: "terrain.stone" };
  }
  if (name === "lectern") return { kind: "cube", material: "terrain.plank" };
  if (name === "decorated_pot") return { kind: "cube", color: "#b5814f" };
  if (name === "hopper") return { kind: "post", wide: true, color: "#3a3d42" };
  if (name === "brewing_stand") return { kind: "post", color: "#6f6a58" };
  if (name === "chest" || name === "trapped_chest") {
    return { kind: "cube", material: "object.chest.side" };
  }
  if (name === "campfire" || name === "soul_campfire") {
    return { kind: "glow", color: name === "campfire" ? "#ffb85c" : "#7fd0d6" };
  }

  // ---- light sources ----
  if (
    name === "torch" || name === "wall_torch" || name === "lantern" ||
    name === "soul_lantern" || name === "end_rod" || name === "candle" ||
    name.endsWith("_candle") || name === "redstone_torch" || name === "redstone_wall_torch" ||
    name === "soul_torch" || name === "soul_wall_torch"
  ) {
    const soul = name.includes("soul");
    return { kind: "glow", color: soul ? "#7fd0d6" : "#ffd873" };
  }
  if (name === "azalea" || name === "bush" || name === "firefly_bush") {
    return { kind: "cube", material: "resource.tree.leaves" };
  }
  if (name === "flowering_azalea") return { kind: "cube", color: "#8aa85a" };
  if (name === "leaf_litter") return { kind: "thin", color: "#596e2d" };
  if (name === "infested_cobblestone" || name === "infested_stone") return { kind: "cube", material: "terrain.stone" };
  if (name === "shroomlight") return { kind: "cube", color: "#f2974c" };
  if (name.endsWith("_froglight")) {
    return {
      kind: "cube",
      color: name.startsWith("ochre") ? "#f5eb9c" : name.startsWith("verdant") ? "#b8f5b0" : "#f0c7e0",
    };
  }

  // ---- full cubes ----
  const named = NAMED_CUBES[name];
  if (named !== undefined) {
    if (named !== "") return { kind: "cube", color: named };
    // "" -> covered by baseMaterial below (plank-faced utility blocks etc.)
  }
  // Wool / concrete / terracotta / shulker color families — the reference
  // pack's texture average wins so the game matches its look; translucency
  // must be decided here (a bare texture color would lose it).
  const colorMatch = name.match(
    /^(\w+?)_(wool|concrete|concrete_powder|terracotta|glazed_terracotta|stained_glass|shulker_box)$/,
  );
  if (colorMatch && (WOOL_COLORS[colorMatch[1]] || textureColorFor(name))) {
    const [, color, family] = colorMatch;
    const tint = textureColorFor(name) ?? WOOL_COLORS[color];
    // Solid dyed families take the pack's own per-colour tile (baked into the
    // default set, so never a missing-texture). Glazed patterns and shulker
    // boxes keep a flat colour.
    if (family === "wool" || family === "concrete" || family === "terracotta") {
      return { kind: "cube", material: `block.${family}.${color}`, color: tint };
    }
    if (family === "concrete_powder") {
      return { kind: "cube", material: `block.concrete.${color}`, color: tint };
    }
    if (family === "stained_glass") {
      return { kind: "cube", material: `block.stained_glass.${color}`, translucent: true };
    }
    return { kind: "cube", color: tint, translucent: false };
  }
  if (name === "terracotta") return { kind: "cube", material: "block.terracotta.plain", color: "#96604a" };
  if (name === "glass") return { kind: "cube", material: "block.glass", translucent: true };
  if (name === "tinted_glass") return { kind: "cube", material: "block.tintedglass", translucent: true };
  if (name === "water" || name === "bubble_column") {
    return { kind: "cube", material: "terrain.water", translucent: true };
  }
  if (name === "lava") return { kind: "cube", color: "#e2903a" };
  const coral = name.match(/^(dead_)?(\w+?)_coral_block$/);
  if (coral) {
    return { kind: "cube", color: coral[1] ? "#7d7873" : CORAL_COLORS[coral[2]] ?? "#7d7873" };
  }
  const cube = baseMaterial(name);
  if (cube.material || cube.color) {
    return { kind: "cube", ...cube };
  }
  void props;
  // Auto-recognition: the extracted texture-color table covers every block
  // the reference pack ships, even ones never explicitly mapped.
  const tex = textureColorFor(name);
  if (tex) return { kind: "cube", color: tex };
  // Unmapped: deterministic guessed color; the baker records the name so it
  // can be added to CUSTOM_BLOCKS.
  return { kind: "cube" };
}

/** Material for a family root: "oak_planks", "stone_brick", "cobble"... */
function baseMaterial(root: string): { material?: string; color?: string } {
  const r = root.replace(/^minecraft:/, "");
  // Woods.
  const plankMatch = r.match(/^(\w+?)_planks?$/) ?? (r in PLANK_COLORS ? [r, r] : null);
  if (plankMatch) {
    const wood = plankMatch[1];
    if (PLANK_MATERIAL[wood]) return { material: PLANK_MATERIAL[wood] };
    if (PLANK_COLORS[wood]) return { color: PLANK_COLORS[wood] };
  }
  if (/_log$|_wood$|^stripped_|_stem$|_hyphae$/.test(r)) {
    const species = woodSpeciesOf(r);
    return { material: (species && LOG_SIDE[species]) ?? "resource.tree.log.side" };
  }
  if (/leaves$/.test(r)) return { material: "resource.tree.leaves" };
  // Stones.
  if (/^(chiseled_|cracked_|mossy_|infested_)?stone_bricks?$/.test(r)) {
    return { material: "terrain.stonebrick" };
  }
  if (/^(bricks?|mud_bricks?|packed_mud)$/.test(r)) {
    return r.startsWith("mud") || r === "packed_mud" ? { material: "terrain.mud" } : { material: "terrain.stonebrick" };
  }
  if (STONE_MATERIAL[r]) return { material: STONE_MATERIAL[r] };
  if (/nether_bricks?$/.test(r)) {
    return r.startsWith("red") ? { color: "#4a1c1e" } : { material: "terrain.netherbrick" };
  }
  if (/blackstone/.test(r)) return { material: "terrain.blackstone" };
  if (/deepslate/.test(r)) return { material: "terrain.deepslate" };
  if (/^(cobblestone|mossy_cobblestone|stone|smooth_stone|andesite|polished_andesite|tuff|polished_tuff|tuff_bricks|chiseled_tuff)$/.test(r)) {
    return { material: "terrain.stone" };
  }
  if (/prismarine/.test(r)) {
    return { material: r === "dark_prismarine" ? "terrain.darkprismarine" : "terrain.prismarine" };
  }
  if (/purpur/.test(r)) return { material: "terrain.purpur" };
  if (/end_stone/.test(r)) return { material: "terrain.endstone" };
  if (/quartz/.test(r)) return { material: "terrain.quartz" };
  if (/^(diorite|polished_diorite|calcite)$/.test(r)) return { material: "terrain.diorite" };
  if (/^(granite|polished_granite)$/.test(r)) return { material: "terrain.granite" };
  if (/basalt/.test(r)) return { material: "terrain.basalt" };
  if (/sandstone/.test(r) && !/red/.test(r)) return { material: "terrain.sand" };
  if (r === "sand") return { material: "terrain.sand" };
  if (r === "red_sand" || /red_sandstone/.test(r)) return { material: "terrain.redsand" };
  if (r === "grass_block") return { material: "terrain.grass.top" };
  if (r === "dirt" || r === "coarse_dirt" || r === "rooted_dirt" || r === "dirt_path" || r === "farmland" || r === "podzol") {
    return { material: "terrain.dirt" };
  }
  if (r === "mud") return { material: "terrain.mud" };
  if (r === "snow_block" || r === "powder_snow") return { material: "terrain.snow" };
  if (r === "ice" || r === "packed_ice" || r === "blue_ice" || r === "frosted_ice") {
    return { material: "terrain.ice" };
  }
  if (r === "mycelium") return { material: "terrain.mycelium" };
  if (r === "bookshelf" || r === "chiseled_bookshelf" || r === "barrel" || r === "composter" ||
      r === "crafting_table" || r === "cartography_table" || r === "fletching_table" || r === "loom") {
    return { material: "terrain.plank" };
  }
  if (r === "pumpkin" || r === "carved_pumpkin" || r === "jack_o_lantern") {
    return { material: "object.pumpkin.side" };
  }
  if (r === "furnace" || r === "blast_furnace" || r === "smoker" || r === "dispenser" || r === "dropper") {
    return { material: "object.furnace.side" };
  }
  if (/copper/.test(r)) return { color: copperColor(r) };
  if (/_ore$/.test(r)) {
    return /deepslate/.test(r) ? { material: "roof.slate" } : { material: "terrain.stone" };
  }
  if (r === "iron") return { color: "#d8d8d8" }; // iron doors/trapdoors
  const named = NAMED_CUBES[r];
  if (named) return { color: named };
  // Shaped families over unknown materials ("resin_brick_stairs") resolve
  // through the texture table via their root (singular or plural texture).
  const tex = textureColorFor(r) ?? textureColorFor(`${r}s`);
  if (tex) return { color: tex };
  return {};
}

/** Wood species of a log/stem block name, or null for everything else. */
export function woodSpeciesOf(name: string): string | null {
  const m = name
    .replace(/^minecraft:/, "")
    .replace(/^stripped_/, "")
    .match(/^(\w+?)_(log|wood|stem|hyphae)$/);
  return m ? m[1] : null;
}

/** Facing property -> our enum (structure defaults face north). */
export function facingOf(props: Record<string, string>): Facing {
  const f = props["facing"];
  return f === "south" || f === "east" || f === "west" ? f : "north";
}

export function isTopHalf(props: Record<string, string>): boolean {
  return props["half"] === "top" || props["type"] === "top";
}

export function isDoubleSlab(props: Record<string, string>): boolean {
  return props["type"] === "double";
}

/** The final per-block record, or null to skip. */
export function toStructureBlock(
  x: number,
  y: number,
  z: number,
  name: string,
  props: Record<string, string>,
): { block: StructureBlock | null; unmapped: boolean } {
  const clean = name.replace(/^minecraft:/, "");
  const spec = specFor(clean, props);
  if (spec.kind === "skip") return { block: null, unmapped: false };
  const unmapped = !spec.material && !spec.color;
  const kind: BlockKind = spec.kind === "slab" && isDoubleSlab(props) ? "cube" : spec.kind;
  // Panes connect via boolean sides rather than a facing property.
  const paneFacing: Facing =
    props["east"] === "true" || props["west"] === "true" ? "east" : "north";
  return {
    block: {
      x, y, z, kind,
      material: spec.material,
      color: spec.color ?? (unmapped ? textureColorFor(clean) ?? guessColor(clean) : undefined),
      translucent: spec.translucent,
      facing:
        kind === "stairs" || kind === "panel" || kind === "sign" || kind === "banner" ? facingOf(props)
        // An open trapdoor is a vertical shutter hinged on its facing edge —
        // keep the facing so the renderer stands it up against that wall.
        : kind === "thin" && props["open"] === "true" ? facingOf(props)
        : kind === "pane" ? paneFacing
        : undefined,
      top: kind === "slab" || kind === "stairs" || kind === "thin" ? isTopHalf(props) : undefined,
      open: kind === "thin" && props["open"] === "true" ? true : undefined,
      wide: spec.wide,
    },
    unmapped,
  };
}
