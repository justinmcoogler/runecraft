// Click-to-open doors: a door blocks the way until clicked, then swings shut
// again once the player is clear.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { RegionSpec, BlockType } from "../world";

// A wall across a 5x3 corridor with a single door at (2,1).
function makeDoorRegion(): RegionSpec {
  const width = 5;
  const depth = 3;
  const heights: number[] = [];
  const blocks: BlockType[] = [];
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      // The wall cells beside the door are cliffs you can't step over.
      heights.push(x === 2 && z !== 1 ? 6 : 1);
      blocks.push("grass");
    }
  }
  return {
    id: "region.door_test",
    width,
    depth,
    heights,
    blocks,
    nodes: [],
    objects: [{ instanceId: "d1", defId: "object.door.wood", cell: { x: 2, z: 1 } }],
    npcs: [],
    spawn: { x: 1, z: 1 },
  };
}

function runFor(sim: GameSimulation, ticks: number) {
  for (let i = 0; i < ticks; i++) sim.tick();
}

describe("click-to-open doors", () => {
  it("blocks the way until opened", () => {
    const sim = new GameSimulation(makeDoorRegion(), 1);
    // The door cell is blocked, so the far side is unreachable.
    expect(sim.world.walkable({ x: 2, z: 1 })).toBe(false);
    sim.actions.moveTo({ x: 4, z: 1 });
    runFor(sim, 200);
    expect(sim.movement.currentCell().x).toBeLessThan(2);
  });

  it("opens on interact, letting the player through", () => {
    const sim = new GameSimulation(makeDoorRegion(), 1);
    sim.enqueue({ type: "interact", targetId: "d1" });
    // Run until the door swings open (player walks up and clicks it).
    let opened = false;
    for (let i = 0; i < 300 && !opened; i++) {
      for (const e of sim.tick()) if (e.type === "doorOpened" && e.instanceId === "d1") opened = true;
    }
    expect(opened).toBe(true);
    // While it's open, cross to the far side (well within the 12s window).
    sim.actions.moveTo({ x: 4, z: 1 });
    runFor(sim, 80);
    expect(sim.movement.currentCell().x).toBe(4);
  });

  it("swings shut again once the player is clear", () => {
    const sim = new GameSimulation(makeDoorRegion(), 1);
    sim.openDoor("d1");
    expect(sim.world.walkable({ x: 2, z: 1 })).toBe(true);
    // Player stays on the near side; after the open window it re-closes.
    let closed = false;
    for (let i = 0; i < 200; i++) {
      for (const e of sim.tick()) if (e.type === "doorClosed" && e.instanceId === "d1") closed = true;
    }
    expect(closed).toBe(true);
    expect(sim.world.walkable({ x: 2, z: 1 })).toBe(false);
  });
});
