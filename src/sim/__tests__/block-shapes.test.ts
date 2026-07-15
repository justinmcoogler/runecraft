// Shaped world blocks (slabs/stairs) stand a half-block proud, so the sim
// treats stepping onto them as a half-step, not a wall — the native-grid half
// of the Minecraft block-behavior parity requirement (see game/CLAUDE.md).

import { describe, expect, it } from "vitest";
import type { BlockType } from "../../content/blocks";
import type { RegionSpec } from "../world";
import { WorldState } from "../world";

// A 1-deep strip: grass floor, a stone slab, a full stone wall.
function strip(blocks: BlockType[], heights: number[]): WorldState {
  const region: RegionSpec = {
    id: "test.strip",
    width: blocks.length,
    depth: 1,
    heights,
    blocks,
    nodes: [],
    objects: [],
    npcs: [],
    spawn: { x: 0, z: 0 },
  };
  return new WorldState(region);
}

describe("shaped world blocks", () => {
  const w = strip(["grass", "stone_slab", "stone", "stone_stairs"], [1, 1, 3, 1]);

  it("raises the walk surface of a slab/stair by half a block", () => {
    expect(w.surfaceY({ x: 0, z: 0 })).toBe(1); // full cube: flush
    expect(w.surfaceY({ x: 1, z: 0 })).toBe(1.5); // slab: +0.5
    expect(w.surfaceY({ x: 2, z: 0 })).toBe(3); // full cube
    expect(w.surfaceY({ x: 3, z: 0 })).toBe(1.5); // stair: +0.5
  });

  it("makes a raised slab a walkable half-step, not a wall", () => {
    expect(w.walkable({ x: 1, z: 0 })).toBe(true);
    expect(w.stepOk({ x: 0, z: 0 }, { x: 1, z: 0 })).toBe(true); // 1.0 -> 1.5
    expect(w.stepOk({ x: 1, z: 0 }, { x: 0, z: 0 })).toBe(true); // 1.5 -> 1.0
  });

  it("still blocks a full two-block rise the slab doesn't bridge", () => {
    // grass(1.0) -> stone(3.0) is a 2-block wall.
    expect(w.stepOk({ x: 0, z: 0 }, { x: 2, z: 0 })).toBe(false);
  });

  it("makes fences/walls impassable and glass walkable", () => {
    const b = strip(["grass", "oak_fence", "stone_wall", "glass"], [1, 1, 1, 1]);
    expect(b.walkable({ x: 0, z: 0 })).toBe(true); // grass
    expect(b.walkable({ x: 1, z: 0 })).toBe(false); // fence blocks
    expect(b.walkable({ x: 2, z: 0 })).toBe(false); // wall blocks
    expect(b.walkable({ x: 3, z: 0 })).toBe(true); // glass: stand on it
  });
});
