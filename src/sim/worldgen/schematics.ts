// Hand-authorable structure schematics for the endless world.
//
// A schematic is up to three aligned character grids plus legends:
//   ground — the surface block stamped per cell ("." keeps the terrain's own)
//   lift   — extra terrain height per cell, digits 1-9, on top of the
//            flattened anchor height (columns render with their block's
//            side tiles, so a lifted stonebrick cell reads as a pillar)
//   marks  — object/node/enemy placements per cell ("." is empty)
// The stamper flattens the footprint to the anchor height first, so a
// schematic drops onto any reasonably level site. This is the format that
// player-provided houses, trees and other assets slot into later: author
// the grids, register the schematic, and add it to a site table.

import type { BlockType } from "../world";
import type { Cell } from "../types";

export interface SchematicMark {
  kind: "object" | "node" | "enemy";
  defId: string;
}

export interface Schematic {
  name: string;
  ground: string[];
  lift?: string[];
  marks?: string[];
  groundLegend: Record<string, BlockType>;
  markLegend?: Record<string, SchematicMark>;
}

export interface StampTarget {
  /** Chunk terrain, row-major size×size. */
  heights: Int16Array;
  blocks: Uint8Array;
  size: number;
  blockId: Record<string, number>;
  blockList: BlockType[];
  addObject(defId: string, cell: Cell): void;
  addNode(defId: string, cell: Cell): void;
  addEnemy(defId: string, cell: Cell): void;
}

export function schematicSize(s: Schematic): { w: number; d: number } {
  return { w: s.ground[0]?.length ?? 0, d: s.ground.length };
}

/**
 * Check the footprint at chunk-local (ox, oz): fully inside the chunk,
 * dry land, and no more than `tolerance` blocks of relief.
 */
export function schematicFits(s: Schematic, t: StampTarget, ox: number, oz: number, tolerance = 2): boolean {
  const { w, d } = schematicSize(s);
  if (ox < 1 || oz < 1 || ox + w >= t.size - 1 || oz + d >= t.size - 1) return false;
  let lo = Infinity;
  let hi = -Infinity;
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const i = (oz + dz) * t.size + (ox + dx);
      const b = t.blockList[t.blocks[i]];
      if (b === "water" || b === "ice") return false;
      const h = t.heights[i];
      lo = Math.min(lo, h);
      hi = Math.max(hi, h);
    }
  }
  return hi - lo <= tolerance;
}

/**
 * Stamp the schematic at chunk-local (ox, oz). The footprint is flattened
 * to the center cell's height; world cells for marks come from (x0 + local).
 */
export function stampSchematic(s: Schematic, t: StampTarget, ox: number, oz: number, x0: number, z0: number): void {
  const { w, d } = schematicSize(s);
  const anchor = t.heights[(oz + (d >> 1)) * t.size + (ox + (w >> 1))];
  for (let dz = 0; dz < d; dz++) {
    for (let dx = 0; dx < w; dx++) {
      const i = (oz + dz) * t.size + (ox + dx);
      const g = s.ground[dz][dx];
      const liftCh = s.lift?.[dz]?.[dx] ?? ".";
      const lift = liftCh >= "1" && liftCh <= "9" ? liftCh.charCodeAt(0) - 48 : 0;
      t.heights[i] = anchor + lift;
      const block = s.groundLegend[g];
      if (block !== undefined) t.blocks[i] = t.blockId[block];
      const m = s.marks?.[dz]?.[dx];
      const mark = m !== undefined ? s.markLegend?.[m] : undefined;
      if (mark) {
        const cell = { x: x0 + ox + dx, z: z0 + oz + dz };
        if (mark.kind === "object") t.addObject(mark.defId, cell);
        else if (mark.kind === "node") t.addNode(mark.defId, cell);
        else t.addEnemy(mark.defId, cell);
      }
    }
  }
}

/** A tumbled ring of standing stones over a weathered brick floor, with
 *  an old strongbox for anyone who pokes around the rubble. */
export const RUIN_STONE_CIRCLE: Schematic = {
  name: "ruin.stone.circle",
  ground: [
    ".#####.",
    "#######",
    "##...##",
    "##...##",
    "##...##",
    "#######",
    ".#####.",
  ],
  lift: [
    ".......",
    ".2...2.",
    ".......",
    ".......",
    ".......",
    ".2...2.",
    ".......",
  ],
  marks: [
    ".......",
    ".......",
    "...B...",
    "..X....",
    ".......",
    "....B..",
    ".......",
  ],
  groundLegend: { "#": "stonebrick" },
  markLegend: {
    B: { kind: "object", defId: "object.boulder.stone" },
    X: { kind: "node", defId: "resource.strongbox.old" },
  },
};

/** Schematics the endless world may scatter as discoveries. */
export const WILD_SCHEMATICS: Schematic[] = [RUIN_STONE_CIRCLE];
