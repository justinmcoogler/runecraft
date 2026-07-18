// The shared bank vault: every bank chest opens one inventory, so a deposit
// at one bank is visible (and withdrawable) at every other, and the vault
// travels through the save as player state rather than region state.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { RegionSpec, BlockType } from "../world";
import { captureRegionState, captureSharedState, applySharedState } from "../../save/save";

function flatRegion(objects: RegionSpec["objects"]): RegionSpec {
  const width = 16;
  const depth = 16;
  return {
    id: "region.bank_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects,
    npcs: [],
    spawn: { x: 1, z: 1 },
  };
}

describe("shared bank", () => {
  it("shows a deposit made at one bank chest inside every other bank chest", () => {
    const sim = new GameSimulation(flatRegion([
      { instanceId: "bank.a", defId: "object.chest.bank", cell: { x: 4, z: 4 } },
      { instanceId: "bank.b", defId: "object.chest.bank", cell: { x: 10, z: 10 } },
    ]));
    const a = sim.containers.get("bank.a")!;
    const b = sim.containers.get("bank.b")!;
    expect(a).toBe(b);
    expect(a).toBe(sim.bankInventory);
    a.add("item.log.basic", 5);
    expect(b.slots.some((s) => s?.itemId === "item.log.basic" && s.qty === 5)).toBe(true);
  });

  it("persists the vault as shared state, not per-region container state", () => {
    const sim = new GameSimulation(flatRegion([
      { instanceId: "bank.a", defId: "object.chest.bank", cell: { x: 4, z: 4 } },
    ]));
    sim.bankInventory.add("item.ore.copper", 7);
    // Region snapshots skip the shared vault (stale copies must never clobber it).
    expect(captureRegionState(sim).containers["bank.a"]).toBeUndefined();
    // Shared state carries it into a fresh sim.
    const shared = captureSharedState(sim);
    const sim2 = new GameSimulation(flatRegion([]));
    applySharedState(sim2, shared);
    expect(sim2.bankInventory.slots.some((s) => s?.itemId === "item.ore.copper" && s.qty === 7)).toBe(true);
  });
});
