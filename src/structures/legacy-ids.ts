// Legacy MCEdit .schematic support: numeric block IDs + 4-bit data values
// (pre-1.13) resolved to modern block-state names, which then flow through
// the normal mapping. Covers the common building/vegetation set; unknown
// IDs return null and are reported by the baker.

const COLOR_NAMES = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
];

const WOOD_1 = ["oak", "spruce", "birch", "jungle"]; // ids 17/18
const WOOD_2 = ["acacia", "dark_oak"]; // ids 162/161
const WOOD_6 = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"]; // ids 5/125/126
const STONE_SLABS = [
  "smooth_stone", "sandstone", "oak", "cobblestone", "brick", "stone_brick", "nether_brick", "quartz",
];

/** Legacy stairs: bits 0-1 facing, bit 4 upside-down. */
function stairs(name: string, data: number): LegacyState {
  const facing = ["east", "west", "south", "north"][data & 3];
  return { name, props: { facing, half: data & 4 ? "top" : "bottom" } };
}

function slab(root: string, data: number): LegacyState {
  return { name: `${root}_slab`, props: { type: data & 8 ? "top" : "bottom" } };
}

export interface LegacyState {
  name: string;
  props: Record<string, string>;
}

/** Resolve a legacy (id, data) pair; null = unknown id (baker reports it). */
export function legacyBlockState(id: number, data: number): LegacyState | null {
  const plain = (name: string): LegacyState => ({ name, props: {} });
  switch (id) {
    case 0: return plain("air");
    case 1:
      return plain(
        ["stone", "granite", "polished_granite", "diorite", "polished_diorite", "andesite", "polished_andesite"][data] ?? "stone",
      );
    case 2: return plain("grass_block");
    case 3: return plain(["dirt", "coarse_dirt", "podzol"][data] ?? "dirt");
    case 4: return plain("cobblestone");
    case 5: return plain(`${WOOD_6[data & 7] ?? "oak"}_planks`);
    case 6: return plain("oak_sapling"); // skipped by mapping
    case 7: return plain("bedrock");
    case 8: case 9: return plain("water");
    case 10: case 11: return plain("lava");
    case 12: return plain(data === 1 ? "red_sand" : "sand");
    case 13: return plain("gravel");
    case 14: return plain("gold_ore");
    case 15: return plain("iron_ore");
    case 16: return plain("coal_ore");
    case 17: return plain(`${WOOD_1[data & 3]}_log`);
    case 18: return plain(`${WOOD_1[data & 3]}_leaves`);
    case 19: return plain("sponge");
    case 20: return plain("glass");
    case 21: return plain("lapis_ore");
    case 22: return plain("lapis_block");
    case 24: return plain("sandstone");
    case 25: return plain("note_block");
    case 30: return plain("cobweb");
    case 31: case 32: return plain("grass");
    case 35: return plain(`${COLOR_NAMES[data & 15]}_wool`);
    case 37: return plain("dandelion");
    case 38: return plain("poppy");
    case 39: return plain("brown_mushroom");
    case 40: return plain("red_mushroom");
    case 41: return plain("gold_block");
    case 42: return plain("iron_block");
    case 43: return plain(`${STONE_SLABS[data & 7]}_planks`.replace("oak_planks_planks", "oak_planks")); // double slab -> full block
    case 44: return slab(STONE_SLABS[data & 7], data);
    case 45: return plain("bricks");
    case 47: return plain("bookshelf");
    case 48: return plain("mossy_cobblestone");
    case 49: return plain("obsidian");
    case 50: return plain("torch");
    case 52: return plain("spawner");
    case 53: return stairs("oak_stairs", data);
    case 54: return plain("chest");
    case 56: return plain("diamond_ore");
    case 57: return plain("diamond_block");
    case 58: return plain("crafting_table");
    case 59: return plain("wheat");
    case 60: return plain("farmland");
    case 61: case 62: return plain("furnace");
    case 64: return { name: "oak_door", props: { facing: ["east", "south", "west", "north"][data & 3] } };
    case 65: return plain("ladder");
    case 66: return plain("rail");
    case 67: return stairs("cobblestone_stairs", data);
    case 78: return plain("snow"); // the thin layer (skipped)
    case 79: return plain("ice");
    case 80: return plain("snow_block");
    case 81: return plain("cactus");
    case 82: return plain("clay");
    case 83: return plain("sugar_cane");
    case 85: return plain("oak_fence");
    case 86: return plain("pumpkin");
    case 87: return plain("netherrack");
    case 88: return plain("soul_sand");
    case 89: return plain("glowstone");
    case 91: return plain("jack_o_lantern");
    case 95: return plain(`${COLOR_NAMES[data & 15]}_stained_glass`);
    case 96: return plain("oak_trapdoor");
    case 97: return plain("stone_bricks"); // infested
    case 98: return plain(["stone_bricks", "mossy_stone_bricks", "cracked_stone_bricks", "chiseled_stone_bricks"][data & 3]);
    case 99: return plain("brown_mushroom_block");
    case 100: return plain("red_mushroom_block");
    case 101: return plain("iron_bars");
    case 102: return plain("glass_pane");
    case 103: return plain("melon");
    case 106: return plain("vine");
    case 107: return plain("oak_fence_gate");
    case 108: return stairs("brick_stairs", data);
    case 109: return stairs("stone_brick_stairs", data);
    case 110: return plain("mycelium");
    case 111: return plain("lily_pad");
    case 112: return plain("nether_bricks");
    case 113: return plain("nether_brick_fence");
    case 114: return stairs("nether_brick_stairs", data);
    case 121: return plain("end_stone");
    case 125: return plain(`${WOOD_6[data & 7] ?? "oak"}_planks`); // double wooden slab
    case 126: return slab(WOOD_6[data & 7] ?? "oak", data);
    case 127: return plain("cocoa"); // pod decor, skipped by mapping
    case 128: return stairs("sandstone_stairs", data);
    case 129: return plain("emerald_ore");
    case 133: return plain("emerald_block");
    case 134: return stairs("spruce_stairs", data);
    case 135: return stairs("birch_stairs", data);
    case 136: return stairs("jungle_stairs", data);
    case 139: return plain(data === 1 ? "mossy_cobblestone_wall" : "cobblestone_wall");
    case 141: return plain("carrots");
    case 142: return plain("potatoes");
    case 155: return plain("quartz_block");
    case 156: return stairs("quartz_stairs", data);
    case 159: return plain(`${COLOR_NAMES[data & 15]}_terracotta`);
    case 160: return plain(`${COLOR_NAMES[data & 15]}_stained_glass_pane`);
    case 161: return plain(`${WOOD_2[data & 3] ?? "acacia"}_leaves`);
    case 162: return plain(`${WOOD_2[data & 3] ?? "acacia"}_log`);
    case 163: return stairs("acacia_stairs", data);
    case 164: return stairs("dark_oak_stairs", data);
    case 165: return plain("slime_block");
    case 167: return plain("iron_trapdoor");
    case 168: return plain(["prismarine", "prismarine_bricks", "dark_prismarine"][data] ?? "prismarine");
    case 169: return plain("sea_lantern");
    case 170: return plain("hay_block");
    case 171: return plain(`${COLOR_NAMES[data & 15]}_carpet`);
    case 172: return plain("terracotta");
    case 173: return plain("coal_block");
    case 174: return plain("packed_ice");
    case 175: return plain("tall_grass"); // double plants (skipped)
    case 179: return plain("red_sandstone");
    case 180: return stairs("red_sandstone_stairs", data);
    case 182: return slab("red_sandstone", data);
    case 183: return plain("spruce_fence_gate");
    case 184: return plain("birch_fence_gate");
    case 185: return plain("jungle_fence_gate");
    case 186: return plain("dark_oak_fence_gate");
    case 187: return plain("acacia_fence_gate");
    case 188: return plain("spruce_fence");
    case 189: return plain("birch_fence");
    case 190: return plain("jungle_fence");
    case 191: return plain("dark_oak_fence");
    case 192: return plain("acacia_fence");
    case 193: return { name: "spruce_door", props: { facing: ["east", "south", "west", "north"][data & 3] } };
    case 194: return { name: "birch_door", props: { facing: ["east", "south", "west", "north"][data & 3] } };
    case 195: return { name: "jungle_door", props: { facing: ["east", "south", "west", "north"][data & 3] } };
    case 196: return { name: "acacia_door", props: { facing: ["east", "south", "west", "north"][data & 3] } };
    case 197: return { name: "dark_oak_door", props: { facing: ["east", "south", "west", "north"][data & 3] } };
    case 198: return plain("end_rod");
    case 201: return plain("purpur_block");
    case 203: return stairs("purpur_stairs", data);
    case 205: return slab("purpur", data);
    case 206: return plain("end_stone_bricks");
    case 208: return plain("dirt_path");
    case 212: return plain("frosted_ice");
    case 213: return plain("magma_block");
    case 214: return plain("nether_wart_block");
    case 216: return plain("bone_block");
    case 251: return plain(`${COLOR_NAMES[data & 15]}_concrete`);
    case 252: return plain(`${COLOR_NAMES[data & 15]}_concrete_powder`);
    default: return null;
  }
}
