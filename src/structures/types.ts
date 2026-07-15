// Baked structure assets: the output of importing a Minecraft structure
// file (.nbt from a structure block, or a Sponge/WorldEdit .schem). Assets
// are plain data checked into the repo; the renderer and sim consume them.

/** How a block renders. Everything is a Minecraft shape at Minecraft sizes. */
export type BlockKind =
  | "cube" // full 16x16x16 block
  | "slab" // half block (bottom or top)
  | "stairs" // lower half-slab + set-back upper half, oriented by facing
  | "post" // fence/wall: 4px (fence) or 8px (wall) centered post
  | "panel" // door: 3px thin panel against the cell's facing edge
  | "pane" // glass pane / iron bars: 2px sheet through the cell center
  | "thin" // trapdoor/carpet: 3px horizontal slab
  | "glow" // light sources: small emissive box
  | "cross" // plants: two crossed 16x16 sprite planes (grass, flowers, crops)
  | "sign" // a plank board on a short post
  | "banner"; // a tall dyed cloth on a pole

export type Facing = "north" | "south" | "east" | "west";

export interface StructureBlock {
  x: number;
  y: number;
  z: number;
  kind: BlockKind;
  /** Logical material id (texture-pack safe) — or unset when color is used. */
  material?: string;
  /** Plain color fallback for blocks with no material mapping (wool etc.). */
  color?: string;
  /** True for translucent blocks (glass, water). */
  translucent?: boolean;
  facing?: Facing;
  /** slab/stairs/thin: piece occupies the top half instead of the bottom. */
  top?: boolean;
  /** post: wide variant (walls are 8px, fences 4px). */
  wide?: boolean;
  /** thin (trapdoor): open = a vertical panel hinged on its facing edge,
   *  used as wall trim/shutters; closed = a flat horizontal panel. */
  open?: boolean;
}

export interface StructureAsset {
  name: string;
  /** Source file format, for provenance. */
  format: "vanilla-nbt" | "sponge-schem" | "litematic" | "legacy-schematic";
  sx: number;
  sy: number;
  sz: number;
  /**
   * Ground-layer embedding: builds saved with their floor in layer y0 sink
   * one block into the terrain, so the floor's top sits at ground level and
   * interiors stay walkable. 0 = the build sits directly on the grass.
   */
  sink: number;
  /** Dominant wood species ("oak", "spruce"...) for trees; unset otherwise. */
  species?: string;
  /** Anchor cell (trunk base for trees; footprint center otherwise). */
  ax?: number;
  az?: number;
  blocks: StructureBlock[];
  /** Block names the importer had no mapping for (rendered as plain gray). */
  unmapped: string[];
}

/** A structure placed in a region at a ground cell (its min corner). */
export interface StructurePlacement {
  instanceId: string;
  structureId: string;
  cell: { x: number; z: number };
  /**
   * Solid landmark: the whole built mass blocks movement (you walk around it,
   * not through it) and it grows no walkable interior surface. Large multi-storey
   * imports use this — you enter through a door-portal into a purpose-built
   * interior region rather than clambering over the flattened 2.5D shell.
   */
  solid?: boolean;
}

/**
 * Every footprint column that carries any body-bearing block — the solid mass
 * of a build (walls, floors, stairs, posts, panes, doors). Empty yard columns
 * are excluded so they stay walkable around the building. Used to block a
 * `solid` landmark wholesale.
 */
export function solidColumns(asset: StructureAsset): Array<{ x: number; z: number }> {
  const set = new Set<string>();
  for (const b of asset.blocks) if (bodySpan(b)) set.add(`${b.x},${b.z}`);
  return [...set].map((k) => {
    const [x, z] = k.split(",").map(Number);
    return { x, z };
  });
}

/**
 * Ground-collision rule: a column blocks movement when a solid piece
 * occupies the space a walker needs — feet or head height, i.e. the two
 * layers above the (possibly sunken) floor. Doorway columns stay walkable,
 * as do carpets, floor trapdoors and step-height bottom slabs.
 */
/**
 * Runtime burial depth. The baked `sink` only ever drops a build one block —
 * enough for a floor slab, but a mansion on a tall stone foundation or plinth
 * (with a grand external stair) ends up with its living floor floating several
 * blocks above the flat walkable grid, so its door can't be reached. Bury the
 * whole solid base instead, so the living floor sits at ground and you walk
 * straight in. Never buries less than the baked sink, and is capped so a
 * genuinely short building is never sunk into a pit.
 */
export function effectiveSink(asset: StructureAsset): number {
  // The lobby ships pre-tiled with a fixed sink so every tile's floor lands at
  // the same plateau height — never re-derive it per tile (a plaza tile would
  // sink differently from a terrace tile and tear the seams).
  if (asset.name.startsWith("lobby")) return asset.sink;
  const cols = asset.sx * asset.sz;
  if (cols === 0) return asset.sink;
  // Count the consecutive bottom layers that read as a solid deck (a floor or
  // foundation slab), stopping at the first open (walls-and-interior) layer.
  let solid = 0;
  for (let y = 0; y < asset.sy; y++) {
    let cubes = 0;
    for (const b of asset.blocks) if (b.y === y && b.kind === "cube") cubes++;
    if (cubes >= cols * 0.4) solid++;
    else break;
  }
  return Math.min(Math.max(asset.sink, solid), Math.max(1, Math.floor(asset.sy / 2)));
}

/**
 * Walkable surfaces of an imported build, so its floors and steps behave like
 * Minecraft blocks instead of one solid blob. Flood-fills from the exterior
 * ground (relative height 0): from a cell at height h you can step to a
 * neighbour whose standable surface is within ±1 (a slab/stair is +0.5, a full
 * block +1), or continue at h through an open passage (a doorway). Cells the
 * fill reaches get their walk-surface height (relative to the build's floor);
 * solid cells it never reaches are walls that block navigation.
 *
 * The 2.5D grid holds one height per cell, so only the reachable ground storey
 * is walkable — upper floors a fill can't climb to stay blocked.
 */
const SOLID_KIND = (k: BlockKind) => k === "cube" || k === "post";
function surfaceTopOf(b: StructureBlock): number | null {
  if (b.kind === "cube") return b.y + 1;
  if (b.kind === "slab" || b.kind === "stairs") return b.y + (b.top ? 1 : 0.5);
  if (b.kind === "thin") return b.open ? null : b.y + (b.top ? 1 : 0.1875); // an open trapdoor is a wall shutter, not a floor
  return null; // pane/panel/glow/cross/sign/banner: not a floor
}

/**
 * The walk-surface height of a build's ground storey — the lowest indoor floor
 * that has headroom and a ceiling/upper floor above it. Used to cap walkability
 * (you enter the ground opening, not climb to the roof) and to slice the roof
 * so the ground room's floor and walls stay visible. 0 when the build has no
 * enclosed interior (a plaza, a wall).
 */
export function groundFloorTop(asset: StructureAsset): number {
  const solid = new Set<string>();
  for (const b of asset.blocks) if (SOLID_KIND(b.kind)) solid.add(`${b.x},${b.y},${b.z}`);
  const solidAt = (x: number, y: number, z: number) => solid.has(`${x},${y},${z}`);
  let ground = Infinity;
  for (const b of asset.blocks) {
    const t = surfaceTopOf(b);
    if (t === null) continue;
    const fy = Math.floor(t + 1e-6);
    if (solidAt(b.x, fy, b.z) || solidAt(b.x, fy + 1, b.z)) continue; // needs headroom
    let ceiling = false;
    for (let k = 2; k <= 5; k++) if (solidAt(b.x, fy + k, b.z)) { ceiling = true; break; }
    if (ceiling && t < ground) ground = t;
  }
  return Number.isFinite(ground) ? ground : 0;
}

/** Vertical [bottom, top] a block occupies for body-collision, or null if a
 *  walker passes through it (plants, signs, banners, light sources). */
function bodySpan(b: StructureBlock): [number, number] | null {
  switch (b.kind) {
    case "cube": case "stairs": case "post": case "pane": case "panel": return [b.y, b.y + 1];
    case "slab": return b.top ? [b.y + 0.5, b.y + 1] : [b.y, b.y + 0.5];
    case "thin": return b.open ? null : b.top ? [b.y + 0.8, b.y + 1] : [b.y, b.y + 0.2]; // open trapdoor: wall shutter, walk-through
    default: return null; // cross / sign / banner / glow — walk-through
  }
}

export function walkableSurfaces(asset: StructureAsset): {
  surfaces: Array<{ x: number; z: number; top: number }>;
  blocked: Array<{ x: number; z: number }>;
} {
  const W = asset.sx;
  const D = asset.sz;
  // Per-cell body-collision spans and stand-on surface tops.
  const spans = new Map<string, Array<[number, number]>>();
  const tops = new Map<string, number[]>();
  for (const b of asset.blocks) {
    const k = `${b.x},${b.z}`;
    const span = bodySpan(b);
    if (span) (spans.get(k) ?? spans.set(k, []).get(k)!).push(span);
    const t = surfaceTopOf(b);
    if (t !== null) (tops.get(k) ?? tops.set(k, []).get(k)!).push(t);
  }
  // A surface is standable only with clear body space above it: a block whose
  // BOTTOM sits on or just above the surface (a wall/half-stone standing on the
  // floor) obstructs; the step/slab that PROVIDES the surface (its bottom is
  // below it) does not. This is what makes a half-stone wall block instead of
  // being walked through, while you still stand on a stair or slab.
  const bodyClear = (k: string, top: number): boolean => {
    const sp = spans.get(k);
    if (!sp) return true;
    return !sp.some(([b]) => b >= top - 0.1 && b < top + 1.7);
  };
  // Only walk the ground storey and its entrance steps — never climb to an
  // upper floor or onto the roof (one height per cell in a 2.5D grid).
  const ground = groundFloorTop(asset);
  const cap = ground > 0 ? ground + 0.75 : Infinity;
  const cand = new Map<string, number[]>();
  for (const [k, list] of tops) {
    for (const t of list) if (t <= cap && bodyClear(k, t)) (cand.get(k) ?? cand.set(k, []).get(k)!).push(t);
  }
  const pick = (k: string, h: number): number | null => {
    const list = cand.get(k);
    if (!list) return null;
    let best: number | null = null;
    for (const s of list) {
      if (Math.abs(s - h) <= 1 && (best === null || Math.abs(s - h) < Math.abs(best - h))) best = s;
    }
    return best;
  };
  const surface = new Map<string, number>();
  const queue: Array<{ x: number; z: number; h: number }> = [];
  const enter = (x: number, z: number, h: number) => {
    const k = `${x},${z}`;
    if (surface.has(k)) return;
    let s = pick(k, h);
    // A ground-level doorway gap: the terrain floor carries through when the
    // body band is clear and the cell has no floor block of its own.
    if (s === null && h <= 0.6 && !cand.has(k) && bodyClear(k, h)) s = h;
    if (s === null) return;
    surface.set(k, s);
    queue.push({ x, z, h: s });
  };
  // Seed from the footprint border, entering from the exterior ground (h = 0).
  for (let x = 0; x < W; x++) { enter(x, 0, 0); enter(x, D - 1, 0); }
  for (let z = 0; z < D; z++) { enter(0, z, 0); enter(W - 1, z, 0); }
  while (queue.length) {
    const { x, z, h } = queue.shift()!;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, nz = z + dz;
      if (nx >= 0 && nz >= 0 && nx < W && nz < D) enter(nx, nz, h);
    }
  }
  const surfaces = [...surface].map(([k, top]) => {
    const [x, z] = k.split(",").map(Number);
    return { x, z, top };
  });
  // Blocked: a cell with body-mass in the walkable band the fill never stood on
  // — a wall or pillar (full block or half-stone), not a walk-through prop.
  const blocked: Array<{ x: number; z: number }> = [];
  for (const [k, sp] of spans) {
    if (surface.has(k)) continue;
    if (sp.some(([b, t]) => t > 0.2 && b < cap + 1.7)) {
      const [x, z] = k.split(",").map(Number);
      blocked.push({ x, z });
    }
  }
  return { surfaces, blocked };
}

export function blockedColumns(
  asset: StructureAsset,
  options?: { ignoreLeaves?: boolean },
): Array<{ x: number; z: number }> {
  const feetY = effectiveSink(asset);
  const blocked = new Set<string>();
  for (const b of asset.blocks) {
    if (b.y < feetY || b.y > feetY + 1) continue;
    if (b.kind === "cross" || b.kind === "sign" || b.kind === "banner") continue; // decor is walk-through
    if (b.kind === "thin" && b.y === feetY && !b.top) continue; // carpets/floor trapdoors
    if (b.kind === "slab" && b.y === feetY && !b.top) continue; // step-height slabs
    // Bottom stairs are a step, not a wall — you walk up them (e.g. the steps
    // leading to a raised door). Only the floor-level stair is walkable; a
    // stair at head height is part of a wall/roof and still blocks.
    if (b.kind === "stairs" && b.y === feetY && !b.top) continue;
    if (b.kind === "panel") continue; // doors and gates are doorways, not walls
    // Choppable trees: ground-hugging foliage never seals off the trunk.
    if (options?.ignoreLeaves && b.material === "resource.tree.leaves") continue;
    blocked.add(`${b.x},${b.z}`);
  }
  return [...blocked].map((key) => {
    const [x, z] = key.split(",").map(Number);
    return { x, z };
  });
}
