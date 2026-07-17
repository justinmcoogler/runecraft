// Regression: an errand whose target isn't streamed in must NEVER resolve to
// an overworld cell — those live in a different coordinate space, and pointing
// guidance at one sent the pathfinder marching 30,000 cells (freeze + crash).

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { ENDLESS_CENTER } from "../worldgen/endless";
import { activeQuestTarget, npcCell } from "../../ui/quest-helper";

describe("quest guidance in the endless world", () => {
  it("never points at foreign-coordinate fallbacks", () => {
    const sim = GameSimulation.createEndless(42);
    sim.tick();
    // A tracked errand from a giver who is NOT streamed into the region, with
    // a slay objective for an enemy that has no live spawn nearby.
    sim.quests.addDef({
      id: "vq.end.999.999.res",
      name: "Wolf Cull",
      giverNpcId: "end.999.999.res",
      objectives: [
        { id: "kill", type: "slay", enemyDefId: "enemy.wolf", qty: 3, label: "Slay 3 wolves" },
        { id: "back", type: "talk", npcId: "end.999.999.res", label: "Report back" },
      ],
      rewards: [],
    } as never);
    sim.quests.states["vq.end.999.999.res"] = { status: "active", objectiveIndex: 0, progress: 0 };
    sim.trackedQuestId = "vq.end.999.999.res";

    expect(npcCell(sim, "end.999.999.res"), "unstreamed giver resolves to nothing").toBeNull();
    const target = activeQuestTarget(sim);
    if (target) {
      // Any resolvable target must be in endless coordinates, near the player.
      const p = sim.movement.currentCell();
      const d = Math.max(Math.abs(target.cell.x - p.x), Math.abs(target.cell.z - p.z));
      expect(d, `target ${target.cell.x},${target.cell.z} is impossibly far`).toBeLessThan(2000);
      expect(target.cell.x).toBeGreaterThan(ENDLESS_CENTER - 5000);
      expect(target.cell.z).toBeGreaterThan(ENDLESS_CENTER - 5000);
    }
  });

  it("an errand's guidance points at the giver's remembered home when unstreamed", () => {
    const sim = GameSimulation.createEndless(42);
    sim.tick();
    const home = { x: ENDLESS_CENTER + 300, z: ENDLESS_CENTER + 120 };
    sim.quests.addDef({
      id: "vq.end.7.7.res",
      name: "Herb Basket",
      giverNpcId: "end.7.7.res",
      giverCell: home,
      giverName: "Wren",
      objectives: [
        { id: "back", type: "talk", npcId: "end.7.7.res", label: "Bring the basket back" },
      ],
      rewards: [],
    } as never);
    sim.quests.states["vq.end.7.7.res"] = { status: "active", objectiveIndex: 0, progress: 0 };
    sim.trackedQuestId = "vq.end.7.7.res";
    const target = activeQuestTarget(sim);
    expect(target, "guidance must not go dark").not.toBeNull();
    expect(target!.cell).toEqual(home);
  });

  it("tracking self-heals in the wild: a completed quest hands the pin on", () => {
    const sim = GameSimulation.createEndless(42);
    sim.tick();
    for (const [id, status] of [["vq.a", "completed"], ["vq.b", "active"]] as const) {
      sim.quests.addDef({
        id, name: id, giverNpcId: "end.1.1.res",
        giverCell: { x: ENDLESS_CENTER, z: ENDLESS_CENTER },
        objectives: [{ id: "t", type: "talk", npcId: "end.1.1.res", label: "talk" }],
        rewards: [],
      } as never);
      sim.quests.states[id] = { status, objectiveIndex: 0, progress: 0 };
    }
    sim.trackedQuestId = "vq.a"; // finished — stale pin
    sim.tick();
    expect(sim.trackedQuestId).toBe("vq.b");
  });
});
