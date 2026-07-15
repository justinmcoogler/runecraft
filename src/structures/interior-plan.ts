// Reconstruct a top-down floor plan for a building's ground storey, so its
// interior room reads as the SAME shape and floor as the imported house — not a
// generic rectangle. We slice the asset at its ground-floor level: the enclosed
// walkable area becomes floor (carrying the house's own floor block), the solid
// mass around it becomes walls, and the ground-floor door becomes the way out.

import type { BlockType } from "../content/blocks";
import type { StructureAsset, StructureBlock } from "./types";

export interface InteriorPlan {
  /** Region dimensions (cropped to the room + its walls). */
  w: number;
  d: number;
  /** Local "x,z" → floor block (walkable). */
  floor: Map<string, BlockType>;
  /** Local "x,z" → wall block for the room's own shell (raised, blocks). */
  walls: Map<string, BlockType>;
  /** Fill block for the rest of the wall ring (the dominant wall material). */
  wallFill: BlockType;
  /** Local cell of the exit door (a floor cell carrying the door object). */
  door: { x: number; z: number };
  /** Which way the exit door faces (outward from the room). */
  doorFacing?: "north" | "south" | "east" | "west";
  /** Local floor cell just inside the door — where you arrive. */
  arrival: { x: number; z: number };
}

/** Map an imported block's logical material id to the nearest region BlockType,
 *  so the interior floor/walls render with the house's own surfaces. */
export function materialToBlockType(mat: string | undefined, color: string | undefined): BlockType {
  if (!mat) {
    // Wool/concrete authored as a bare color: leave it as plank (a warm floor).
    return "plank";
  }
  const m = mat.toLowerCase();
  if (m.startsWith("terrain.plank") || m.startsWith("roof.") || m.startsWith("resource.tree")) return "plank";
  if (m.startsWith("block.concrete.")) {
    const c = m.slice("block.concrete.".length);
    return (`concrete_${c}` as BlockType);
  }
  if (m.startsWith("block.wool.")) {
    const c = m.slice("block.wool.".length);
    return (`wool_${c}` as BlockType);
  }
  if (m.startsWith("block.terracotta")) return "terracotta";
  if (m.includes("stonebrick")) return "stonebrick";
  if (m.includes("cobble")) return "stone";
  if (m.includes("blackstone")) return "blackstone";
  if (m.includes("deepslate")) return "deepslate";
  if (m.includes("darkprismarine")) return "darkprismarine";
  if (m.includes("prismarine")) return "prismarine";
  if (m.includes("calcite")) return "calcite";
  if (m.includes("quartz")) return "quartz";
  if (m.includes("diorite")) return "diorite";
  if (m.includes("granite")) return "granite";
  if (m.includes("andesite")) return "andesite";
  if (m.includes("basalt")) return "basalt";
  if (m.includes("netherbrick")) return "netherbrick";
  if (m.includes("sand")) return "sand";
  if (m.includes("mud")) return "mud";
  if (m.includes("gravel")) return "gravel";
  if (m.includes("clay")) return "clay";
  if (m.includes("stone")) return "stone";
  return "plank";
}

/** The largest 4-connected component of a cell set, with enclosed holes filled
 *  in — one solid room instead of a scatter of pockets. */
function solidifyRoom(cells: Set<string>, W: number, D: number): Set<string> {
  const seen = new Set<string>();
  let best: string[] = [];
  for (const start of cells) {
    if (seen.has(start)) continue;
    const comp: string[] = [];
    const q = [start];
    seen.add(start);
    while (q.length) {
      const k = q.shift()!;
      comp.push(k);
      const [x, z] = k.split(",").map(Number);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nk = `${x + dx},${z + dz}`;
        if (cells.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  const room = new Set(best);
  if (room.size === 0) return room;
  // Fill holes: flood the "outside" of the room within its bounding box; any
  // in-box cell the flood can't reach is an enclosed hole → part of the room.
  let minX = W, minZ = D, maxX = 0, maxZ = 0;
  for (const k of room) {
    const [x, z] = k.split(",").map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  minX -= 1; minZ -= 1; maxX += 1; maxZ += 1;
  const out = new Set<string>();
  const q: Array<[number, number]> = [];
  const push = (x: number, z: number) => {
    const k = `${x},${z}`;
    if (x < minX || z < minZ || x > maxX || z > maxZ || room.has(k) || out.has(k)) return;
    out.add(k); q.push([x, z]);
  };
  for (let x = minX; x <= maxX; x++) { push(x, minZ); push(x, maxZ); }
  for (let z = minZ; z <= maxZ; z++) { push(minX, z); push(maxX, z); }
  while (q.length) { const [x, z] = q.shift()!; push(x + 1, z); push(x - 1, z); push(x, z + 1); push(x, z - 1); }
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const k = `${x},${z}`;
      if (!room.has(k) && !out.has(k)) room.add(k); // enclosed hole
    }
  }
  return room;
}

function topOf(b: StructureBlock): number | null {
  if (b.kind === "cube") return b.y + 1;
  if (b.kind === "slab" || b.kind === "stairs") return b.y + (b.top ? 1 : 0.5);
  return null;
}
const WALL_KIND = (k: StructureBlock["kind"]) => k === "cube" || k === "post" || k === "stairs" || k === "pane";

/**
 * Extract the best ground-storey plan, or null when the build has no enclosed
 * room (a wall, a plaza) — the caller then falls back to a plain rectangle.
 *
 * Houses raised on a foundation or plinth put their living floor high up, so we
 * don't assume the floor is at the bottom: we try every level that has floor
 * blocks and keep the one enclosing the largest room. That accounts for floors
 * that start a lot higher, and for builds whose lowest slab is just a doorstep.
 */
export function houseInteriorPlan(asset: StructureAsset): InteriorPlan | null {
  // Candidate floor tops: the distinct heights at which floor-like blocks sit.
  const tops = new Set<number>();
  for (const b of asset.blocks) {
    const t = topOf(b);
    if (t !== null) tops.add(Math.round(t));
  }
  const levels = [...tops].sort((a, b) => a - b);
  const plans = levels.map((gTop) => planAtLevel(asset, gTop));
  const maxArea = Math.max(0, ...plans.map((p) => p?.floor.size ?? 0));
  if (maxArea === 0) return null;
  // The ground storey is the LOWEST level that still forms a substantial room —
  // not the level with the most floor. Upper storeys and roof platforms cover
  // more area, so "largest" climbs to the top of the house; "lowest real room"
  // lands on the floor you'd actually walk in. A raised build's foundation is
  // solid (no enclosed room), so it's skipped and the first real room wins.
  const threshold = Math.max(16, maxArea * 0.5);
  for (const plan of plans) {
    if (plan && plan.floor.size >= threshold) return plan;
  }
  // Nothing crossed the bar (small builds): fall back to the roomiest level.
  return plans.reduce<InteriorPlan | null>((b, p) => (p && p.floor.size > (b?.floor.size ?? 0) ? p : b), null);
}

/** Build the interior plan slicing the asset at one floor top, or null if that
 *  level encloses no real room. */
function planAtLevel(asset: StructureAsset, gTop: number): InteriorPlan | null {
  if (gTop <= 0) return null;
  const floorLevel = Math.round(gTop); // walk height above the floor block
  const W = asset.sx, D = asset.sz;

  // Per-column: the floor block nearest the ground-floor top, the solid block
  // levels just above the floor (to tell a real wall from a stick of furniture),
  // and any ground-floor doorway.
  const floorMat = new Map<string, BlockType>();
  const bestFloorDist = new Map<string, number>();
  const solidYs = new Map<string, Set<number>>();               // col -> y levels present
  const wallTally = new Map<string, Map<BlockType, number>>();  // col -> material counts
  const doors: Array<{ x: number; z: number }> = [];
  for (const b of asset.blocks) {
    const k = `${b.x},${b.z}`;
    const t = topOf(b);
    if (t !== null && Math.abs(t - gTop) <= 0.75) {
      const dist = Math.abs(t - gTop);
      if (!bestFloorDist.has(k) || dist < bestFloorDist.get(k)!) {
        bestFloorDist.set(k, dist);
        floorMat.set(k, materialToBlockType(b.material, b.color));
      }
    }
    if (WALL_KIND(b.kind) && b.y >= floorLevel && b.y <= floorLevel + 3) {
      (solidYs.get(k) ?? solidYs.set(k, new Set()).get(k)!).add(b.y);
      const t2 = wallTally.get(k) ?? wallTally.set(k, new Map()).get(k)!;
      const mat = materialToBlockType(b.material, b.color);
      t2.set(mat, (t2.get(mat) ?? 0) + 1);
    }
    // A doorway at THIS floor level (a raised floor puts its door up high too).
    if (b.kind === "panel" && Math.abs(b.y - floorLevel) <= 1) doors.push({ x: b.x, z: b.z });
  }

  // A wall is a genuine barrier: solid at BOTH the feet and head band above the
  // floor. A single block (furniture, a pillar cap, a step) is NOT a wall — in
  // this 2.5D grid a one-tall block is a step you climb, so it never encloses.
  // Its material is the DOMINANT block over the wall's height, so a wood wall on
  // a one-course stone/sand base still reads as wood, not the base course.
  const wallMat = new Map<string, BlockType>();
  for (const [k, ys] of solidYs) {
    if (!(ys.has(floorLevel) && ys.has(floorLevel + 1))) continue;
    let best: BlockType = "stonebrick", n = 0;
    for (const [mat, c] of wallTally.get(k)!) if (c > n) { n = c; best = mat; }
    wallMat.set(k, best);
  }

  // Barrier for enclosure = walls plus the (sealed) doorway, so the flood from
  // outside can't leak through the door and swallow the room.
  const barrier = new Set<string>(wallMat.keys());
  for (const dr of doors) barrier.add(`${dr.x},${dr.z}`);

  // Flood the exterior from the footprint border across non-barrier cells.
  const outside = new Set<string>();
  const queue: Array<{ x: number; z: number }> = [];
  const seed = (x: number, z: number) => {
    const k = `${x},${z}`;
    if (x < 0 || z < 0 || x >= W || z >= D || barrier.has(k) || outside.has(k)) return;
    outside.add(k); queue.push({ x, z });
  };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, D - 1); }
  for (let z = 0; z < D; z++) { seed(0, z); seed(W - 1, z); }
  while (queue.length) {
    const c = queue.shift()!;
    seed(c.x + 1, c.z); seed(c.x - 1, c.z); seed(c.x, c.z + 1); seed(c.x, c.z - 1);
  }

  // Interior = cells the exterior flood never reached and that aren't wall.
  const raw = new Set<string>();
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const k = `${x},${z}`;
      if (!outside.has(k) && !wallMat.has(k)) raw.add(k);
    }
  }
  // One clean room: the largest connected floor blob, with its inner holes
  // (furniture, pillars, missed slabs) filled — so we don't get a scatter of
  // pockets that turns every gap into wall.
  const interior = solidifyRoom(raw, W, D);
  if (interior.size < 6) return null; // too small to be a real room

  // Pick the door nearest the interior (the ground-floor entrance).
  const inCell = (k: string) => interior.has(k);
  let door = doors.find((dr) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => inCell(`${dr.x + dx},${dr.z + dz}`)),
  ) ?? doors[0];
  if (!door) {
    // No panel doorway: carve one into the wall. Pick a wall-ring cell with the
    // room on one side and the outside on the other, and open it — so the door
    // sits IN the wall (a real doorway), not on a floor cell mid-room. Prefer a
    // south-facing (front) opening, then the shortest reach to the border.
    const isOutside = (x: number, z: number) =>
      x < 0 || z < 0 || x >= W || z >= D || outside.has(`${x},${z}`);
    let best: { x: number; z: number } | null = null, bestScore = Infinity;
    for (const k of wallMat.keys()) {
      const [x, z] = k.split(",").map(Number);
      const inside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => inCell(`${x + dx},${z + dz}`));
      const out = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isOutside(x + dx, z + dz));
      if (!inside || !out) continue;
      // Bias toward the front (larger z is "south"/front in these plans).
      const score = Math.min(x, z, W - 1 - x, D - 1 - z) + (D - 1 - z) * 0.01;
      if (score < bestScore) { bestScore = score; best = { x, z }; }
    }
    // Last resort (no clean perimeter wall): the interior cell nearest the border.
    if (!best) {
      let bd = Infinity;
      for (const k of interior) {
        const [x, z] = k.split(",").map(Number);
        const dd = Math.min(x, z, W - 1 - x, D - 1 - z);
        if (dd < bd) { bd = dd; best = { x, z }; }
      }
    }
    door = best!;
  }
  // Arrival: the interior floor cell orthogonally adjacent to the door.
  const arrivalWorld =
    [[0, 1], [0, -1], [1, 0], [-1, 0]]
      .map(([dx, dz]) => ({ x: door!.x + dx, z: door!.z + dz }))
      .find((c) => inCell(`${c.x},${c.z}`)) ?? door;
  // Which way the door faces: outward, away from the room (toward the arrival's
  // opposite side), so it reads as set into the wall facing out.
  const facing: "north" | "south" | "east" | "west" =
    arrivalWorld.z > door.z ? "north" : arrivalWorld.z < door.z ? "south"
      : arrivalWorld.x > door.x ? "west" : "east";

  // Crop TIGHT to the room itself (plus its door), with a single-cell margin
  // for the surrounding wall. We deliberately do NOT extend the box out over the
  // house's thick exterior walls — that just fills the region with a big block
  // mass next to the room. One ring of wall is all a room needs.
  let minX = W, minZ = D, maxX = 0, maxZ = 0;
  for (const k of [...interior, `${door.x},${door.z}`]) {
    const [x, z] = k.split(",").map(Number);
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  minX -= 1; minZ -= 1; maxX += 1; maxZ += 1;
  const w = maxX - minX + 1, d = maxZ - minZ + 1;
  const inCrop = (x: number, z: number) => x >= minX && x <= maxX && z >= minZ && z <= maxZ;

  const floor = new Map<string, BlockType>();
  for (const k of interior) {
    const [x, z] = k.split(",").map(Number);
    floor.set(`${x - minX},${z - minZ}`, floorMat.get(k) ?? "plank");
  }
  // Per-cell wall material only for the room's OWN shell — the asset-wall cells
  // touching the floor. Everything else in the (tight) box uses the dominant
  // wall material, so the shell reads as the house's walls, not random blocks.
  const walls = new Map<string, BlockType>();
  const tally = new Map<BlockType, number>();
  for (const [k, mat] of wallMat) {
    const [x, z] = k.split(",").map(Number);
    if (!inCrop(x, z)) continue;
    const touchesFloor = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      .some(([dx, dz]) => interior.has(`${x + dx},${z + dz}`));
    if (!touchesFloor) continue;
    const lk = `${x - minX},${z - minZ}`;
    if (!floor.has(lk)) { walls.set(lk, mat); tally.set(mat, (tally.get(mat) ?? 0) + 1); }
  }
  let wallFill: BlockType = "stonebrick";
  let bestN = 0;
  for (const [mat, n] of tally) if (n > bestN) { bestN = n; wallFill = mat; }

  // The door cell is a floor cell (you stand in the doorway to leave).
  const doorLocal = { x: door.x - minX, z: door.z - minZ };
  floor.set(`${doorLocal.x},${doorLocal.z}`, floorMat.get(`${door.x},${door.z}`) ?? "plank");
  walls.delete(`${doorLocal.x},${doorLocal.z}`);

  return {
    w, d, floor, walls, wallFill,
    door: doorLocal,
    doorFacing: facing,
    arrival: { x: arrivalWorld.x - minX, z: arrivalWorld.z - minZ },
  };
}
