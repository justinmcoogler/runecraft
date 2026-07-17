// Players can never stand on nav-blocked nodes (ores, trees). Walking is
// blocker-checked at path time, but teleport-family arrivals and chunks
// streaming a node in under a standing player used to leave the player
// perched on the rock — from where clicking it even started mining.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";

describe("ore collision", () => {
  it("ore cells are unwalkable and click-to-walk refuses them", () => {
    const sim = GameSimulation.createEndless(42);
    for (let i = 0; i < 3; i++) sim.tick();
    const rocks = sim.world.region.nodes.filter((n) => n.defId.startsWith("resource.rock."));
    expect(rocks.length).toBeGreaterThan(0);
    for (const r of rocks) {
      expect(sim.world.blockerAt(r.cell), `${r.defId} has no blocker`).toBeTruthy();
      expect(sim.world.walkable(r.cell), `${r.defId} is walkable`).toBe(false);
    }
    const t = rocks[0];
    sim.enqueue({ type: "moveTo", cell: { ...t.cell } });
    for (let i = 0; i < 300; i++) sim.tick();
    const end = sim.movement.currentCell();
    expect(end.x === t.cell.x && end.z === t.cell.z, "player walked onto an ore").toBe(false);
  });

  it("a node streamed in under a standing player nudges them off", () => {
    const sim = GameSimulation.createEndless(42);
    for (let i = 0; i < 3; i++) sim.tick();
    const p = sim.movement.currentCell();
    // Simulate a chunk streaming a copper rock onto the player's exact cell.
    sim.addEditorNodePlain({ instanceId: "test.underfoot", defId: "resource.rock.copper", cell: { ...p } });
    expect(sim.world.walkable(p)).toBe(false);
    sim.tick();
    const after = sim.movement.currentCell();
    expect(after.x === p.x && after.z === p.z, "player still standing on the ore").toBe(false);
    expect(sim.world.walkable(after)).toBe(true);
  });
});
