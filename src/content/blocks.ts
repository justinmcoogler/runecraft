// The block registry — the single source of truth for every world block type
// and its Minecraft-faithful behavior. The sim reads `solid`/`liquid` for
// walkability; the renderer reads `top`/`strata` for face textures. Keeping
// both on one table is what lets a parsed asset's blocks behave like vanilla
// (see game/CLAUDE.md, "Minecraft block behavior parity"). Every tile id below
// is a Faithful-pack texture baked into render/default-textures.ts.

/** Natural terrain surfaces — the original heightfield palette. */
export type NaturalBlock =
  | "grass" | "dirt" | "stone" | "sand" | "water" | "plank" | "snow" | "ice"
  | "mud" | "redsand" | "mycelium" | "drygrass" | "stonebrick" | "gravel"
  | "coarsedirt" | "podzol" | "clay" | "moss" | "andesite" | "calcite"
  | "terracotta" | "redterracotta" | "orangeterracotta" | "whiteterracotta"
  | "bridge" | "gatearch";

/** Solid stone/building blocks whose Faithful textures are already baked. */
export type StoneBlock =
  | "basalt" | "diorite" | "granite" | "endstone" | "netherbrick"
  | "prismarine" | "darkprismarine" | "purpur" | "quartz"
  | "blackstone" | "deepslate" | "cobble";

/** Minecraft's 16 dye colors (all baked from the Faithful pack). */
export const DYE_COLORS = [
  "white", "orange", "magenta", "yellow", "lime", "pink", "gray",
  "cyan", "purple", "blue", "brown", "green", "red", "black",
  "light_blue", "light_gray",
] as const;
export type DyeColor = (typeof DYE_COLORS)[number];

export type WoolBlock = `wool_${DyeColor}`;
export type ConcreteBlock = `concrete_${DyeColor}`;

/** Non-full-cube world blocks: a half slab or a stepped stair, both raised a
 *  half block above the ground they sit on (like a bottom slab in Minecraft). */
export type ShapedBlock =
  | "stone_slab" | "stone_stairs" | "cobble_slab" | "cobble_stairs"
  | "plank_slab" | "plank_stairs" | "quartz_slab" | "quartz_stairs"
  | "purpur_slab" | "purpur_stairs";

/** Obstacle posts you can't walk through, and see-through glass. */
export type BarrierBlock =
  | "oak_fence" | "stone_wall" | "cobble_wall" | "glass";

export type BlockType = NaturalBlock | StoneBlock | WoolBlock | ConcreteBlock | ShapedBlock | BarrierBlock;

/** How a block occupies its cell. Cubes fill it; slabs/stairs sit as a raised
 *  half-block you can step onto; fences/walls are thin posts you can't pass. */
export type BlockShape = "cube" | "slab" | "stairs" | "fence" | "wall";

export interface BlockDef {
  id: BlockType;
  /** Display name (vanilla-style). */
  name: string;
  /** Can a walker stand on top of it? Only liquids are non-solid. */
  solid: boolean;
  /** Glass/ice/water — rendered see-through (only water uses it today). */
  translucent?: boolean;
  /** Water and other fluids — a boat floats over them. */
  liquid?: boolean;
  /** Full cube (default), raised half slab, stepped stair, or thin post. */
  shape?: BlockShape;
  /** Fences/walls: a thin post that blocks horizontal movement (you can't
   *  stand on or walk through the cell), the way a fence does in Minecraft. */
  obstacle?: boolean;
  /** Glass/ice: rendered as a see-through tinted cube instead of an atlas
   *  tile. Pairs with `translucent`. */
  tint?: string;
  /** Fences/walls: the ground block rendered under the post (a fence sits on
   *  grass; a wall on stone). The post itself uses `top`. */
  base?: BlockType;
  /** Atlas tile for the top face. */
  top: string;
  /**
   * Cliff-strata: the wall-face tile by depth below the surface unit (0 = the
   * lip). Beyond the last band the face falls to `terrain.stone`. Absent means
   * a uniform block whose side face is the same as its top.
   */
  strata?: Array<{ upTo: number; tile: string }>;
}

const uniform = (id: BlockType, name: string, top: string): BlockDef => ({ id, name, solid: true, top });

// Soils that top a dirt column and give way to stone at depth.
const soil = (id: BlockType, name: string, surface: string): BlockDef => ({
  id, name, solid: true, top: surface,
  strata: [{ upTo: 0, tile: surface }, { upTo: 2, tile: "terrain.dirt" }],
});

const NATURAL: BlockDef[] = [
  { id: "grass", name: "Grass Block", solid: true, top: "terrain.grass.top",
    strata: [{ upTo: 0, tile: "terrain.grass.side" }, { upTo: 2, tile: "terrain.dirt" }] },
  { id: "dirt", name: "Dirt", solid: true, top: "terrain.dirt", strata: [{ upTo: 2, tile: "terrain.dirt" }] },
  uniform("stone", "Stone", "terrain.stone"),
  { id: "sand", name: "Sand", solid: true, top: "terrain.sand", strata: [{ upTo: 3, tile: "terrain.sand" }] },
  { id: "water", name: "Water", solid: false, liquid: true, translucent: true, top: "terrain.water" },
  uniform("plank", "Planks", "terrain.plank"),
  { id: "snow", name: "Snow", solid: true, top: "terrain.snow", strata: [{ upTo: 0, tile: "terrain.snow" }] },
  uniform("ice", "Ice", "terrain.ice"),
  { id: "mud", name: "Mud", solid: true, top: "terrain.mud", strata: [{ upTo: 2, tile: "terrain.mud" }] },
  { id: "redsand", name: "Red Sand", solid: true, top: "terrain.redsand", strata: [{ upTo: 3, tile: "terrain.redsand" }] },
  soil("mycelium", "Mycelium", "terrain.mycelium"),
  soil("drygrass", "Dry Grass", "terrain.drygrass"),
  uniform("stonebrick", "Stone Bricks", "terrain.stonebrick"),
  uniform("gravel", "Gravel", "terrain.gravel"),
  { id: "coarsedirt", name: "Coarse Dirt", solid: true, top: "terrain.coarsedirt", strata: [{ upTo: 2, tile: "terrain.coarsedirt" }] },
  soil("podzol", "Podzol", "terrain.podzol"),
  uniform("clay", "Clay", "terrain.clay"),
  soil("moss", "Moss Block", "terrain.moss"),
  uniform("andesite", "Andesite", "terrain.andesite"),
  uniform("calcite", "Calcite", "terrain.calcite"),
  uniform("terracotta", "Terracotta", "terrain.terracotta"),
  uniform("redterracotta", "Red Terracotta", "terrain.redterracotta"),
  uniform("orangeterracotta", "Orange Terracotta", "terrain.orangeterracotta"),
  uniform("whiteterracotta", "White Terracotta", "terrain.whiteterracotta"),
  // A plank bridge deck: solid to walk on, but rendered as a real bridge
  // (open underneath, on stone piers) rather than a filled plank column.
  uniform("bridge", "Bridge", "terrain.plank"),
  // A gateway threshold: a gravel floor you walk on, with a stone-brick arch
  // drawn over it (the covered top of the castle gate, matching the wall).
  uniform("gatearch", "Gate Arch", "terrain.gravel"),
];

const STONE: BlockDef[] = [
  uniform("basalt", "Basalt", "terrain.basalt"),
  uniform("diorite", "Diorite", "terrain.diorite"),
  uniform("granite", "Granite", "terrain.granite"),
  uniform("endstone", "End Stone", "terrain.endstone"),
  uniform("netherbrick", "Nether Bricks", "terrain.netherbrick"),
  uniform("prismarine", "Prismarine", "terrain.prismarine"),
  uniform("darkprismarine", "Dark Prismarine", "terrain.darkprismarine"),
  uniform("purpur", "Purpur Block", "terrain.purpur"),
  uniform("quartz", "Quartz Block", "terrain.quartz"),
  uniform("blackstone", "Blackstone", "terrain.blackstone"),
  uniform("deepslate", "Deepslate", "terrain.deepslate"),
  uniform("cobble", "Cobblestone", "terrain.cobble"),
];

const TITLE = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);
const DYED: BlockDef[] = DYE_COLORS.flatMap((c) => [
  uniform(`wool_${c}`, `${TITLE(c)} Wool`, `block.wool.${c}`),
  uniform(`concrete_${c}`, `${TITLE(c)} Concrete`, `block.concrete.${c}`),
]);

// Slabs and stairs reuse an existing full-block tile; `shape` drives the
// raised-half geometry and walk surface. (Textures are shared with the parent
// block — a dedicated slab-side tile isn't needed at this scale.)
const shaped = (id: BlockType, name: string, top: string, shape: BlockShape): BlockDef =>
  ({ id, name, solid: true, top, shape });
const SHAPED: BlockDef[] = [
  shaped("stone_slab", "Stone Slab", "terrain.stone", "slab"),
  shaped("stone_stairs", "Stone Stairs", "terrain.stone", "stairs"),
  shaped("cobble_slab", "Cobblestone Slab", "terrain.gravel", "slab"),
  shaped("cobble_stairs", "Cobblestone Stairs", "terrain.gravel", "stairs"),
  shaped("plank_slab", "Plank Slab", "terrain.plank", "slab"),
  shaped("plank_stairs", "Plank Stairs", "terrain.plank", "stairs"),
  shaped("quartz_slab", "Quartz Slab", "terrain.quartz", "slab"),
  shaped("quartz_stairs", "Quartz Stairs", "terrain.quartz", "stairs"),
  shaped("purpur_slab", "Purpur Slab", "terrain.purpur", "slab"),
  shaped("purpur_stairs", "Purpur Stairs", "terrain.purpur", "stairs"),
];

// Fences and walls: thin posts that block movement. Walls are the wider 8px
// variant (shape "wall"); both reuse a full-block tile for their faces.
const fence = (id: BlockType, name: string, top: string, shape: BlockShape, base: BlockType): BlockDef =>
  ({ id, name, solid: true, obstacle: true, top, shape, base });
const BARRIERS: BlockDef[] = [
  fence("oak_fence", "Oak Fence", "terrain.plank", "fence", "grass"),
  fence("stone_wall", "Stone Wall", "terrain.stone", "wall", "stone"),
  fence("cobble_wall", "Cobblestone Wall", "terrain.gravel", "wall", "stone"),
  // Glass: a full cube you can stand on, rendered see-through (no atlas tile).
  { id: "glass", name: "Glass", solid: true, translucent: true, tint: "#cfe8ff", top: "terrain.ice" },
];

export const BLOCKS: Record<BlockType, BlockDef> = Object.fromEntries(
  [...NATURAL, ...STONE, ...DYED, ...SHAPED, ...BARRIERS].map((b) => [b.id, b]),
) as Record<BlockType, BlockDef>;

/** All block ids, for atlas ordering and tests. */
export const BLOCK_TYPES = Object.keys(BLOCKS) as BlockType[];

export function isSolid(block: BlockType): boolean {
  return BLOCKS[block]?.solid !== false;
}
export function blockShape(block: BlockType): BlockShape {
  return BLOCKS[block]?.shape ?? "cube";
}
/** How far a block's walk surface sits above its cell floor: a full cube is
 *  flush (0); a slab/stair is a raised half-block (0.5). */
export function surfaceOffset(block: BlockType): number {
  const s = BLOCKS[block]?.shape;
  return s === "slab" || s === "stairs" ? 0.5 : 0;
}
export function isLiquid(block: BlockType): boolean {
  return BLOCKS[block]?.liquid === true;
}
/** Fences/walls: block horizontal movement (can't be walked onto or through). */
export function isObstacle(block: BlockType): boolean {
  return BLOCKS[block]?.obstacle === true;
}
export function isTranslucent(block: BlockType): boolean {
  return BLOCKS[block]?.translucent === true;
}
/** The ground block rendered under a fence/wall post (null for normal blocks). */
export function blockBase(block: BlockType): BlockType | null {
  return BLOCKS[block]?.base ?? null;
}
export function blockTint(block: BlockType): string {
  return BLOCKS[block]?.tint ?? "#cfe8ff";
}
export function topTile(block: BlockType): string {
  return BLOCKS[block]?.top ?? "terrain.dirt";
}
/** Cliff-face tile `depth` units below the surface (0 = the lip). */
export function sideTile(block: BlockType, depth: number): string {
  const def = BLOCKS[block];
  if (!def) return depth <= 2 ? "terrain.dirt" : "terrain.stone";
  if (!def.strata) return def.top; // uniform block: side == top
  for (const band of def.strata) if (depth <= band.upTo) return band.tile;
  return "terrain.stone";
}
