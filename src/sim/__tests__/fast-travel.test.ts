// Fast-travel: discovering a landmark records a persisted waypoint, saves carry
// it, and travelling to one drops the player on solid ground beside it — but
// only from the open endless world.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { captureSharedState, applySharedState } from "../../save/save";
import { ENDLESS_CENTER } from "../worldgen/endless";

describe("fast travel", () => {
  it("records a waypoint when a landmark is discovered", () => {
    const sim = GameSimulation.createEndless(42);
    const p = sim.movement.currentCell();
    sim.world.region.structures = [
      { instanceId: "test.ruin", structureId: "ruin_broch", cell: { x: p.x + 2, z: p.z + 2 } },
    ];
    sim.tick();
    const wp = sim.waypoints.find((w) => w.id === "test.ruin");
    expect(wp).toBeTruthy();
    expect(wp!.x).toBe(p.x + 2);
    expect(wp!.z).toBe(p.z + 2);
    expect(wp!.name).toContain("ruin");
  });

  it("carries waypoints through a shared-state save round-trip", () => {
    const sim = GameSimulation.createEndless(42);
    sim.restoreWaypoints([{ id: "a", name: "a landmark", x: 100, z: 200 }]);
    const shared = captureSharedState(sim);
    expect(shared.waypoints).toEqual([{ id: "a", name: "a landmark", x: 100, z: 200 }]);

    const fresh = GameSimulation.createEndless(42);
    applySharedState(fresh, shared);
    expect(fresh.waypoints).toEqual([{ id: "a", name: "a landmark", x: 100, z: 200 }]);
  });

  it("jumps the player to a discovered waypoint on solid ground", () => {
    const sim = GameSimulation.createEndless(99);
    const target = { x: ENDLESS_CENTER + 2500, z: ENDLESS_CENTER + 1800 };
    sim.restoreWaypoints([{ id: "far", name: "a watchtower", x: target.x, z: target.z }]);

    const ok = sim.fastTravelTo("far");
    expect(ok).toBe(true);
    // Landed within a few paces of the target, on a walkable, dry cell.
    const at = sim.movement.currentCell();
    expect(Math.abs(at.x - target.x)).toBeLessThanOrEqual(6);
    expect(Math.abs(at.z - target.z)).toBeLessThanOrEqual(6);
    expect(sim.world.walkable(at)).toBe(true);
    expect(sim.world.blockAt(at)).not.toBe("water");
  });

  it("refuses unknown waypoints and travel from outside the open world", () => {
    const sim = GameSimulation.createEndless(99);
    expect(sim.fastTravelTo("nope")).toBe(false);
    // Pretend we're inside a dungeon: travel is barred.
    sim.restoreWaypoints([{ id: "x", name: "a dungeon", x: ENDLESS_CENTER, z: ENDLESS_CENTER }]);
    sim.world.region.id = "dyn_crypt_1_1_1_0_0";
    expect(sim.fastTravelTo("x")).toBe(false);
  });

  it("dedupes a landmark discovered more than once", () => {
    const sim = GameSimulation.createEndless(42);
    const p = sim.movement.currentCell();
    sim.world.region.structures = [
      { instanceId: "dup.ruin", structureId: "ruin_broch", cell: { x: p.x + 2, z: p.z + 2 } },
    ];
    sim.tick();
    sim.tick();
    expect(sim.waypoints.filter((w) => w.id === "dup.ruin").length).toBe(1);
  });
});
