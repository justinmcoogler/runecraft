// The biome catalog. The world's terrain classifier assigns a small set of
// numeric base biome ids per cell (see terrainAt); this registry gives each
// base a name and a handful of named *variants*. The variant a cell falls in
// is a deterministic, low-frequency overlay — so a single "Oak Forest" base
// reads as Oakwood here, a Mushroom Edge there — multiplying the world's
// apparent variety into a large named catalog without a fragile hundred-way
// climate cascade. Variant is computed, never stored, so the base id (and every
// switch that keys on it) is untouched.

import { vnoise } from "./noise";

export interface BiomeDef {
  /** The base category name. */
  name: string;
  /** Named variants; the overlay picks one per cell. First is the default. */
  variants: string[];
}

// Base ids match the classifier in endless.ts. Keep them in sync.
export const BIOME_DEFS: Record<number, BiomeDef> = {
  0: { name: "Plains", variants: ["Green Plains", "Grassy Downs", "Wildflower Plains", "Windswept Steppe"] },
  1: { name: "Oak Forest", variants: ["Oakwood", "Mixed Wood", "Mushroom Edge", "Berry Thicket", "Old Growth"] },
  2: { name: "Taiga", variants: ["Taiga", "Spruce Taiga", "Snow-dusted Taiga", "Stony Taiga"] },
  3: { name: "Desert", variants: ["Dunes", "Red Desert", "Oasis Basin", "Cracked Flats"] },
  4: { name: "Swamp", variants: ["Mire", "Mangrove Swamp", "Sunken Marsh", "Reedwater"] },
  5: { name: "Snowfield", variants: ["Snowfield", "Frozen Flats", "Ice Barrens"] },
  6: { name: "Savanna", variants: ["Savanna", "Dry Savanna", "Acacia Veldt"] },
  7: { name: "Jungle", variants: ["Jungle", "Deep Jungle", "Palm Coast", "Bamboo Tangle"] },
  8: { name: "Birch Grove", variants: ["Birchwood", "Silver Grove", "Sunlit Glade"] },
  9: { name: "Woodland Meadow", variants: ["Woodland Meadow", "Grazing Meadow", "Copsewood"] },
  10: { name: "Wildflower Steppe", variants: ["Wildflower Steppe", "Poppy Field", "Open Heath"] },
  11: { name: "Mushroom Isle", variants: ["Mushroom Isle", "Mycelic Shore", "Spore Fields"] },
  12: { name: "Moorland", variants: ["Moorland", "Heather Moor", "Windy Uplands", "Crag Moor"] },
  13: { name: "Elder Grove", variants: ["Elder Grove", "Ancient Wood", "Whispering Grove"] },
  14: { name: "Badlands", variants: ["Badlands", "Painted Mesa", "Bone Flats", "Rust Canyon"] },
  15: { name: "Fen", variants: ["Fen", "Cool Marsh", "Peat Bog"] },
  16: { name: "Gravemoor", variants: ["Gravemoor", "Ashen Waste", "Cursed Heath"] },
  17: { name: "Blightwood", variants: ["Blightwood", "Rotwood", "Gloom Fen"] },
  18: { name: "Volcanic Wastes", variants: ["Volcanic Wastes", "Cinder Fields", "Obsidian Flats"] },
  19: { name: "Glacier", variants: ["Glacier", "Glacial Sheet", "Frozen Deep"] },
  20: { name: "Alpine Forest", variants: ["Alpine Forest", "Highland Pines", "Cloud Wood"] },
  21: { name: "Cherry Orchard", variants: ["Cherry Orchard", "Blossom Grove", "Pink Vale"] },
  22: { name: "Redwood Forest", variants: ["Redwood Forest", "Giant Redwoods", "Fern Deep"] },
  23: { name: "Sunflower Prairie", variants: ["Sunflower Prairie", "Golden Fields", "Meadowlands"] },
  24: { name: "Autumn Woods", variants: ["Autumn Woods", "Amber Forest", "Maple Vale"] },
  25: { name: "Glowshroom Hollow", variants: ["Glowshroom Hollow", "Luminous Wood", "Fae Hollow"] },
  26: { name: "Bamboo Forest", variants: ["Bamboo Forest", "Green Thicket", "Panda Grove"] },
  27: { name: "Mangrove Coast", variants: ["Mangrove Coast", "Root Tangle", "Brackish Shore"] },
  28: { name: "Ice Spikes", variants: ["Ice Spikes", "Frozen Spires", "Glittering Barrens"] },
  29: { name: "Salt Flats", variants: ["Salt Flats", "Bleached Pan", "White Desert"] },
  30: { name: "Mesa Highlands", variants: ["Mesa Highlands", "Red Benches", "Painted Uplands"] },
  31: { name: "Flower Meadow", variants: ["Flower Meadow", "Bloomfield", "Petal Vale"] },
  32: { name: "Highland Heath", variants: ["Highland Heath", "Windy Heath", "Stony Moor"] },
  33: { name: "Ashland", variants: ["Ashland", "Cinder Barrens", "Charwood"] },
  34: { name: "Crystal Barrens", variants: ["Crystal Barrens", "Frost Crystal Fields", "Glacier Shards"] },
  35: { name: "Amber Marsh", variants: ["Amber Marsh", "Peat Hollow", "Moss Fen"] },
};

/** Deterministic variant index (0..variants-1) for a cell's base biome. */
export function biomeVariantIndex(seed: number, x: number, z: number, base: number): number {
  const def = BIOME_DEFS[base];
  const n = def ? def.variants.length : 0;
  if (n <= 1) return 0;
  // A coarse noise field so variants form patches within a base biome, offset
  // per base so different biomes don't share the same variant boundaries.
  const salt = (seed * 2654435761 + base * 8675309) >>> 0;
  const v = vnoise(x + 1234, z - 987, 190, salt);
  return Math.max(0, Math.min(n - 1, Math.floor(v * n)));
}

/** The full named biome for a cell (its variant name), e.g. "Mushroom Edge". */
export function biomeName(seed: number, x: number, z: number, base: number): string {
  const def = BIOME_DEFS[base];
  if (!def) return "Wildlands";
  return def.variants[biomeVariantIndex(seed, x, z, base)] ?? def.name;
}

/** Every named biome in the catalog (bases × their variants). */
export const BIOME_CATALOG: string[] = Object.values(BIOME_DEFS).flatMap((d) => d.variants);
