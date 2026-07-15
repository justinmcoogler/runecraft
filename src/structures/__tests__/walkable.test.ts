// walkableSurfaces flood-fills an imported build so its steps climb and its
// floors are walkable, while walls block — the fix for "assemble the house
// like Minecraft blocks so they're walkable".

import { describe, expect, it } from "vitest";
import type { StructureBlock } from "../types";
import { walkableSurfaces } from "../types";

function asset(blocks: StructureBlock[]) {
  return { name: "t", format: "vanilla-nbt" as const, sx: 3, sy: 4, sz: 3, sink: 0, blocks, unmapped: [] };
}
const surfAt = (r: { surfaces: Array<{ x: number; z: number; top: number }> }, x: number, z: number) =>
  r.surfaces.find((s) => s.x === x && s.z === z)?.top;
const isBlocked = (r: { blocked: Array<{ x: number; z: number }> }, x: number, z: number) =>
  r.blocked.some((b) => b.x === x && b.z === z);

describe("walkableSurfaces", () => {
  it("climbs a step onto a raised floor and blocks the flanking walls", () => {
    const blocks: StructureBlock[] = [
      // Open front row (z=0) is the entrance. A stair rises at z=1, floor at z=2.
      { x: 1, y: 0, z: 1, kind: "stairs", material: "m" },
      { x: 1, y: 0, z: 2, kind: "cube", material: "m" },
    ];
    // 3-tall walls flanking the path at x=0 and x=2.
    for (const z of [1, 2]) for (const x of [0, 2]) for (const y of [0, 1, 2]) {
      blocks.push({ x, y, z, kind: "cube", material: "m" });
    }
    const r = walkableSurfaces(asset(blocks));

    // The stair is a +0.5 step, the floor a +1 surface — both reachable.
    expect(surfAt(r, 1, 1)).toBe(0.5);
    expect(surfAt(r, 1, 2)).toBe(1);
    // The 3-tall side walls are unreachable and block navigation.
    for (const z of [1, 2]) for (const x of [0, 2]) expect(isBlocked(r, x, z)).toBe(true);
  });

  it("leaves a fully-open pad walkable at ground level", () => {
    const r = walkableSurfaces(asset([{ x: 1, y: 0, z: 1, kind: "cube", material: "m" }]));
    // The single floor block's top is a +1 surface, reachable from the open edge.
    expect(surfAt(r, 1, 1)).toBe(1);
    expect(r.blocked.length).toBe(0);
  });
});
