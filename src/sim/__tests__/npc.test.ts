import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { makeTestRegion } from "./testRegion";

const NPC = "test.npc.001";

describe("NPCs", () => {
  it("wander within their radius on walkable cells", () => {
    const sim = new GameSimulation(makeTestRegion(true), 5);
    const npc = sim.npcs.get(NPC)!;
    for (let i = 0; i < 600; i++) {
      sim.tick();
      const cell = npc.movement.currentCell();
      expect(sim.world.inBounds(cell)).toBe(true);
      expect(Math.abs(cell.x - npc.home.x)).toBeLessThanOrEqual(npc.wanderRadius + 1);
      expect(Math.abs(cell.z - npc.home.z)).toBeLessThanOrEqual(npc.wanderRadius + 1);
    }
  });

  it("player walks over and gets a chat event; NPC holds still while approached", () => {
    const sim = new GameSimulation(makeTestRegion(true), 5);
    sim.enqueue({ type: "interact", targetId: NPC });
    let chatted = false;
    for (let i = 0; i < 400 && !chatted; i++) {
      const events = sim.tick();
      if (events.some((e) => e.type === "npcChat" && e.instanceId === NPC && e.name === "Test Warden")) {
        chatted = true;
      }
    }
    expect(chatted).toBe(true);
    // Player ended adjacent to the NPC.
    const npcCell = sim.npcs.get(NPC)!.movement.currentCell();
    const playerCell = sim.movement.currentCell();
    expect(Math.max(Math.abs(npcCell.x - playerCell.x), Math.abs(npcCell.z - playerCell.z))).toBeLessThanOrEqual(1);
  });
});
