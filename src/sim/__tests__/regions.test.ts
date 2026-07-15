// Multi-region tests: Copper Hollow layout, portal events, and state
// transfer between regions via the shared/snapshot helpers.

import { describe, expect, it } from "vitest";
import {
  applyRegionState,
  applySharedState,
  captureRegionState,
  captureSharedState,
  clearSave,
  loadFromStorage,
  peekRegionId,
  saveToStorage,
  type RegionSnapshot,
} from "../../save/save";
import { GameSimulation } from "../simulation";
import type { Cell, SimEvent } from "../types";
import { buildRegion, makeCopperHollow, WorldState } from "../world";

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 6000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

describe("Copper Hollow", () => {
  it("has walls that block movement and content reachable from the arrival cell", () => {
    const region = makeCopperHollow();
    const world = new WorldState(region);
    // Walls are 2 high: stepping from the floor onto one is impossible.
    expect(world.stepOk(region.spawn, { x: region.spawn.x, z: region.spawn.z + 3 })).toBe(false); // the chamber wall

    // BFS from spawn respecting step rules: exit, boss, and every rock must be reachable.
    const reachable = new Set<string>();
    const queue: Cell[] = [region.spawn];
    reachable.add(`${region.spawn.x},${region.spawn.z}`);
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const next = { x: cur.x + dx, z: cur.z + dz };
        const key = `${next.x},${next.z}`;
        if (reachable.has(key)) continue;
        if (!world.inBounds(next) || !world.stepOk(cur, next)) continue;
        if (world.heightAt(next) !== 0) continue;
        reachable.add(key);
        queue.push(next);
      }
    }
    const adjacentReachable = (cell: Cell) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].some(([dx, dz]) =>
        reachable.has(`${cell.x + dx},${cell.z + dz}`),
      );
    for (const node of region.nodes) expect(adjacentReachable(node.cell)).toBe(true);
    for (const enemy of region.enemies ?? []) expect(adjacentReachable(enemy.cell)).toBe(true);
    for (const obj of region.objects) expect(adjacentReachable(obj.cell)).toBe(true);
    expect(region.enemies?.some((e) => e.defId === "enemy.old_gnasher")).toBe(true);
  });

  it("the province's mine mouth emits a portal event pointing at the hollow", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 3);
    const mouth = sim.world.region.objects.find(
      (o) => o.portal?.targetRegionId === "region.copper_hollow",
    )!;
    sim.movement.setCellPosition({ x: mouth.cell.x, z: mouth.cell.z + 3 });
    sim.enqueue({ type: "interact", targetId: mouth.instanceId });
    const events = runUntil(sim, (e) => e.type === "portalEntered");
    const portal = events.find((e) => e.type === "portalEntered");
    expect(portal).toMatchObject({
      targetRegionId: "region.copper_hollow",
      targetCell: { x: 34, z: 24 },
    });
  });
});

describe("region transitions", () => {
  it("shared state travels; region state stays parked and comes back", () => {
    const vale = new GameSimulation(buildRegion("region.vale_clearing"), 3);
    vale.skills.grantXp("skill.mining", 500);
    vale.inventory.add("item.ore.copper", 9);
    vale.hp = 12;
    vale.nodes.get("gv.oak.001")!.phase = "depleted";

    // Depart: park the vale, carry the player into the hollow.
    const parked = captureRegionState(vale);
    const shared = captureSharedState(vale);
    const hollow = new GameSimulation(makeCopperHollow(), 3);
    applySharedState(hollow, shared);
    expect(hollow.skills.xp["skill.mining"]).toBe(500);
    expect(hollow.inventory.count("item.ore.copper")).toBe(9);
    expect(hollow.hp).toBe(12);

    // Do things in the hollow, then return: the vale remembers, the pack follows.
    hollow.inventory.add("item.gem.emberstone", 1);
    const sharedBack = captureSharedState(hollow);
    const valeAgain = new GameSimulation(buildRegion("region.vale_clearing"), 8);
    applySharedState(valeAgain, sharedBack);
    applyRegionState(valeAgain, parked);
    expect(valeAgain.inventory.count("item.gem.emberstone")).toBe(1);
    expect(valeAgain.nodes.get("gv.oak.001")!.phase).toBe("depleted");
  });

  it("saves remember the current region and parked regions", () => {
    clearSave();
    const vale = new GameSimulation(buildRegion("region.vale_clearing"), 3);
    const parkedVale = captureRegionState(vale);
    const hollow = new GameSimulation(makeCopperHollow(), 3);
    hollow.nodes.get("hollow.rock.001")!.phase = "depleted";
    expect(saveToStorage(hollow, { "region.vale_clearing": parkedVale })).toBe(true);

    expect(peekRegionId()).toBe("region.copper_hollow");

    const restored = new GameSimulation(makeCopperHollow(), 9);
    const store: Record<string, RegionSnapshot> = {};
    expect(loadFromStorage(restored, store)).toBe(true);
    expect(restored.nodes.get("hollow.rock.001")!.phase).toBe("depleted");
    expect(store["region.vale_clearing"]).toBeDefined();
    expect(store["region.vale_clearing"].nodes.length).toBeGreaterThan(0);
    clearSave();
  });
});
