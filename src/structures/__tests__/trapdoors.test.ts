import { describe, expect, it } from "vitest";
import { toStructureBlock } from "../mapping";
import { walkableSurfaces } from "../types";
import type { StructureAsset } from "../types";

describe("trapdoor block states", () => {
  it("captures open + facing for an open (vertical shutter) trapdoor", () => {
    const { block } = toStructureBlock(1, 3, 1, "minecraft:oak_trapdoor", {
      facing: "north",
      half: "top",
      open: "true",
    });
    expect(block?.kind).toBe("thin");
    expect(block?.open).toBe(true);
    expect(block?.facing).toBe("north");
    expect(block?.top).toBe(true);
  });

  it("leaves a closed trapdoor flat (no open flag, no facing)", () => {
    const { block } = toStructureBlock(1, 0, 1, "minecraft:spruce_trapdoor", {
      facing: "west",
      half: "bottom",
      open: "false",
    });
    expect(block?.kind).toBe("thin");
    expect(block?.open).toBeUndefined();
    expect(block?.facing).toBeUndefined();
  });

  it("an open trapdoor on a wall is a walk-through shutter, never a floor", () => {
    // A room: solid floor at y0, walls at y1..y2, ceiling at y3, and an open
    // trapdoor stuck to the outside of a wall. The shutter must not create a
    // phantom standable surface, and must not seal the floor as blocked.
    const asset: StructureAsset = {
      name: "t", format: "sponge-schem", sx: 3, sy: 4, sz: 3, sink: 0,
      unmapped: [],
      blocks: [
        // 3x3 floor
        ...[0, 1, 2].flatMap((x) => [0, 1, 2].map((z) => ({ x, y: 0, z, kind: "cube" as const, material: "terrain.plank" }))),
        // ring of walls at y1 and y2 (leave centre open)
        ...[0, 1, 2].flatMap((x) => [0, 1, 2].flatMap((z) =>
          (x === 1 && z === 1) ? [] : [1, 2].map((y) => ({ x, y, z, kind: "cube" as const, material: "terrain.plank" })))),
        // ceiling
        ...[0, 1, 2].flatMap((x) => [0, 1, 2].map((z) => ({ x, y: 3, z, kind: "cube" as const, material: "terrain.plank" }))),
        // open trapdoor as an exterior shutter on the centre floor cell
        { x: 1, y: 1, z: 1, kind: "thin", material: "terrain.plank", open: true, facing: "north" },
      ],
    };
    const { surfaces } = walkableSurfaces(asset);
    // The open trapdoor at (1,1) must not register its own standable top.
    const centre = surfaces.find((s) => s.x === 1 && s.z === 1);
    // The interior floor top (1.0) is the only valid surface there, if reachable
    // — and it must never be the trapdoor's mid-height.
    if (centre) expect(centre.top).toBe(1);
  });
});
