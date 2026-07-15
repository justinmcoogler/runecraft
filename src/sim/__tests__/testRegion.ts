// Tiny authored region for headless simulation tests.

import type { RegionSpec, BlockType } from "../world";

export function makeTestRegion(withNpc = false): RegionSpec {
  const width = 10;
  const depth = 10;
  const heights = new Array<number>(width * depth).fill(0);
  const blocks = new Array<BlockType>(width * depth).fill("grass");
  return {
    id: "region.test",
    width,
    depth,
    heights,
    blocks,
    nodes: [
      { instanceId: "test.tree.001", defId: "resource.tree.basic", cell: { x: 6, z: 6 } },
    ],
    objects: [
      { instanceId: "test.chest.001", defId: "object.storage_chest.basic", cell: { x: 2, z: 6 } },
    ],
    npcs: withNpc
      ? [{ instanceId: "test.npc.001", name: "Test Warden", cell: { x: 8, z: 2 }, wanderRadius: 1 }]
      : [],
    spawn: { x: 2, z: 2 },
  };
}
