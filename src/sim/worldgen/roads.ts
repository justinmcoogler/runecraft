// Province roads: spline corridors stamped into the geography with an
// enforced walking grade (adjacent path cells never differ by more than one
// block), automatic plank bridges wherever a corridor crosses water,
// boardwalk causeways over fen mud, and cut-and-fill shoulders blended back
// into the surrounding terrain. Every road returns its centerline so towns,
// signposts and discoveries can hang off real geometry.

import type { BlockType } from "../world";
import { BIOME, type Geography } from "./geo";
import { splinePath, vnoise } from "./noise";
import { WORLD } from "./regions";

export interface RoadResult {
  id: string;
  centerline: Array<[number, number]>;
  bridges: Array<{ x: number; z: number; over: "river" | "water" }>;
}

export interface RoadSpec {
  id: string;
  points: Array<[number, number]>;
  width: number; // paved width in blocks (>= 3 on primary routes)
  surface?: BlockType; // default per-biome
}

/** Wobble control points slightly so no leg runs mathematically straight. */
function wobbled(points: Array<[number, number]>, amount = 14): Array<[number, number]> {
  return points.map(([x, z], i) =>
    i === 0 || i === points.length - 1
      ? ([x, z] as [number, number])
      : ([
          x + (vnoise(x, z, 90, 501) - 0.5) * 2 * amount,
          z + (vnoise(x, z, 90, 503) - 0.5) * 2 * amount,
        ] as [number, number]),
  );
}

export function carveRoad(geo: Geography, spec: RoadSpec): RoadResult {
  const W = WORLD;
  const { heights, blocks, biome, locked } = geo;
  const at = (x: number, z: number) => z * W + x;
  const path = splinePath(wobbled(spec.points), 2);
  const half = Math.max(1, Math.floor(spec.width / 2));
  const bridges: RoadResult["bridges"] = [];
  const centerline: Array<[number, number]> = [];

  // Grade-locked altitude along the centerline: the road may climb or drop
  // at most one block per two-block step, cutting into rises and banking
  // over dips. Bridges hold the altitude flat across the water.
  let grade = heights[at(Math.round(path[0][0]), Math.round(path[0][1]))];
  if (grade < 0) grade = 0;
  let lastBridge = -20;

  for (let k = 0; k < path.length; k++) {
    const [fx, fz] = path[k];
    const cx = Math.round(fx);
    const cz = Math.round(fz);
    if (cx < 2 || cz < 2 || cx >= W - 2 || cz >= W - 2) continue;
    centerline.push([cx, cz]);

    const here = at(cx, cz);
    const overWater = blocks[here] === "water";
    if (!overWater) {
      const target = heights[here];
      grade += Math.max(-1, Math.min(1, target - grade));
    }
    if (overWater && k - lastBridge > 12) {
      bridges.push({ x: cx, z: cz, over: biome[here] === BIOME.sea ? "water" : "river" });
      lastBridge = k;
    }

    for (let dz = -half; dz <= half; dz++) {
      for (let dx = -half; dx <= half; dx++) {
        if (dx * dx + dz * dz > half * half + half) continue;
        const x = cx + dx;
        const z = cz + dz;
        const i = at(x, z);
        if (blocks[i] === "water") {
          // Bridge deck / boardwalk piling: level with the road grade.
          blocks[i] = "plank";
          heights[i] = grade;
          locked[i] = 1;
          continue;
        }
        heights[i] = grade;
        const b = biome[i];
        blocks[i] =
          spec.surface ??
          (b === BIOME.swamp
            ? "plank" // raised fen causeway
            : b === BIOME.mountain || b === BIOME.highland
              ? "stone"
              : "dirt");
        locked[i] = 1;
      }
    }
  }

  // Blend the shoulders: pull unlocked terrain beside the corridor toward
  // the road grade so cuttings and embankments step down naturally.
  for (const [cx, cz] of centerline) {
    for (let dz = -half - 3; dz <= half + 3; dz++) {
      for (let dx = -half - 3; dx <= half + 3; dx++) {
        const x = cx + dx;
        const z = cz + dz;
        if (x < 1 || z < 1 || x >= W - 1 || z >= W - 1) continue;
        const i = at(x, z);
        if (locked[i] || blocks[i] === "water") continue;
        const ring = Math.max(Math.abs(dx), Math.abs(dz)) - half;
        if (ring <= 0) continue;
        const roadH = heights[at(cx, cz)];
        const max = roadH + ring;
        const min = roadH - ring;
        if (heights[i] > max) heights[i] = max;
        else if (heights[i] < min) heights[i] = min;
      }
    }
  }

  return { id: spec.id, centerline, bridges };
}

/**
 * Final safety net run once after all stamping: any unlocked cell still
 * more than one block above a cardinal neighbour along road shoulders gets
 * relaxed by the global pass in geo; this helper re-checks the paved cells
 * themselves and flattens any residual two-block seam between overlapping
 * road corridors (junctions carved at different grades).
 */
export function healJunctions(geo: Geography): void {
  const W = WORLD;
  const { heights, blocks, locked } = geo;
  for (let pass = 0; pass < 4; pass++) {
    let changed = 0;
    for (let z = 1; z < W - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        const i = z * W + x;
        if (!locked[i] || blocks[i] === "water") continue;
        for (const j of [i - 1, i + 1, i - W, i + W]) {
          if (!locked[j] || blocks[j] === "water") continue;
          if (heights[i] - heights[j] > 1) {
            heights[i] = heights[j] + 1;
            changed++;
          }
        }
      }
    }
    if (changed === 0) break;
  }
}
