// Sleepable beds: interacting sets the respawn point and skips to dawn;
// dying returns the player there, travelling back across regions when far.

import { describe, expect, it } from "vitest";
import { GameSimulation, DAY_LENGTH_S } from "../simulation";
import type { SimEvent } from "../types";
import type { RegionSpec, BlockType } from "../world";

function makeBedRegion(id = "region.bed_test"): RegionSpec {
  const width = 10;
  const depth = 10;
  return {
    id,
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes: [],
    objects: [
      // Head at (5,5), foot at (5,6): a two-cell bed.
      { instanceId: "t.bed", defId: "object.bed.basic", cell: { x: 5, z: 5 }, footprint: [{ x: 5, z: 6 }] },
    ],
    npcs: [],
    spawn: { x: 2, z: 2 },
  };
}

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 3000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

describe("sleepable beds", () => {
  it("sleeping in a bed at night sets the respawn point beside it and wakes at dawn", () => {
    const sim = new GameSimulation(makeBedRegion(), 1);
    // Late night (23:00), before dawn.
    sim.timeS = DAY_LENGTH_S * (23 / 24);
    expect(sim.homePoint).toBeNull();

    sim.enqueue({ type: "interact", targetId: "t.bed" });
    const events = runUntil(sim, (e) => e.type === "playerSlept");
    const slept = events.find((e) => e.type === "playerSlept");
    expect(slept && slept.type === "playerSlept" && slept.restedTillDawn).toBe(true);

    expect(sim.homePoint).not.toBeNull();
    expect(sim.homePoint!.regionId).toBe("region.bed_test");
    // Landed on a walkable cell adjacent to the bed (never on the bed itself).
    const home = sim.homePoint!.cell;
    expect(sim.world.walkable(home)).toBe(true);
    // Woke at dawn (06:00 = 0.25 of the day).
    expect(sim.dayFrac()).toBeCloseTo(6 / 24, 5);
  });

  it("resting in a bed by day sets the spawn without skipping the clock", () => {
    const sim = new GameSimulation(makeBedRegion(), 1);
    sim.timeS = DAY_LENGTH_S * 0.5; // noon
    sim.enqueue({ type: "interact", targetId: "t.bed" });
    const events = runUntil(sim, (e) => e.type === "playerSlept");
    const slept = events.find((e) => e.type === "playerSlept");
    expect(slept && slept.type === "playerSlept" && slept.restedTillDawn).toBe(false);
    expect(sim.homePoint).not.toBeNull();
    // The clock advanced only by the walk-to-bed ticks, not a whole night.
    expect(sim.dayFrac()).toBeCloseTo(0.5, 1);
  });

  it("dying returns the player to the bed's landing cell", () => {
    const sim = new GameSimulation(makeBedRegion(), 1);
    sim.enqueue({ type: "interact", targetId: "t.bed" });
    runUntil(sim, (e) => e.type === "playerSlept");
    const home = { ...sim.homePoint!.cell };

    // Walk away, then die.
    sim.movement.setCellPosition({ x: 8, z: 8 });
    sim.damagePlayer(9999);

    expect(sim.hp).toBe(sim.maxHp());
    expect(sim.movement.currentCell()).toEqual(home);
  });

  it("dying in another region emits a respawnTravel back to the bed's region", () => {
    const sim = new GameSimulation(makeBedRegion(), 1);
    sim.enqueue({ type: "interact", targetId: "t.bed" });
    runUntil(sim, (e) => e.type === "playerSlept");

    // Simulate having travelled to a dungeon: a fresh sim in another region,
    // carrying the same home point.
    const dungeon = new GameSimulation(makeBedRegion("region.dungeon_test"), 1);
    dungeon.homePoint = { ...sim.homePoint! };

    dungeon.damagePlayer(9999);
    const events = dungeon.events.drain();
    const travel = events.find((e) => e.type === "respawnTravel");
    expect(travel).toBeDefined();
    if (travel && travel.type === "respawnTravel") {
      expect(travel.targetRegionId).toBe("region.bed_test");
      expect(travel.targetCell).toEqual(sim.homePoint!.cell);
    }
    // HP is restored so the traveller arrives alive.
    expect(dungeon.hp).toBe(dungeon.maxHp());
  });

  it("no bed set: death still falls back to the region spawn", () => {
    const sim = new GameSimulation(makeBedRegion(), 1);
    sim.movement.setCellPosition({ x: 8, z: 8 });
    sim.damagePlayer(9999);
    expect(sim.movement.currentCell()).toEqual(sim.world.region.spawn);
  });
});
