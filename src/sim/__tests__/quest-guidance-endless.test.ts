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
});
