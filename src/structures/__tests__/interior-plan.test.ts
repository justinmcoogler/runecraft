import { describe, expect, it } from "vitest";
import { houseInteriorPlan, materialToBlockType } from "../interior-plan";
import { getStructure, structureIds } from "../../content/structures";

describe("house interior floor plan", () => {
  it("maps house materials to floor block types", () => {
    expect(materialToBlockType("terrain.plank.spruce", undefined)).toBe("plank");
    expect(materialToBlockType("terrain.stonebrick", undefined)).toBe("stonebrick");
    expect(materialToBlockType("block.concrete.white", undefined)).toBe("concrete_white");
    expect(materialToBlockType("terrain.prismarine", undefined)).toBe("prismarine");
    expect(materialToBlockType(undefined, undefined)).toBe("plank");
  });

  for (const id of ["v1house", "testhouse", "z6house"]) {
    it(`${id}: one connected room, door on the floor, no scatter`, () => {
      const asset = getStructure(id);
      if (!asset) return;
      const plan = houseInteriorPlan(asset);
      expect(plan, `${id} should reconstruct a room`).not.toBeNull();
      if (!plan) return;

      // The floor is a SINGLE connected region (solidified) — not scattered.
      const floor = new Set(plan.floor.keys());
      const [first] = floor;
      const seen = new Set([first]);
      const q = [first];
      while (q.length) {
        const [x, z] = q.shift()!.split(",").map(Number);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nk = `${x + dx},${z + dz}`;
          if (floor.has(nk) && !seen.has(nk)) { seen.add(nk); q.push(nk); }
        }
      }
      expect(seen.size).toBe(floor.size);

      // The door and arrival are real floor cells; arrival touches the door.
      expect(floor.has(`${plan.door.x},${plan.door.z}`)).toBe(true);
      expect(floor.has(`${plan.arrival.x},${plan.arrival.z}`)).toBe(true);
      expect(Math.abs(plan.arrival.x - plan.door.x) + Math.abs(plan.arrival.z - plan.door.z)).toBeLessThanOrEqual(1);

      // A real room, not a closet, and not the whole 32x32 footprint (which
      // would mean we grabbed a roof/foundation slab, not the living floor).
      expect(plan.floor.size).toBeGreaterThanOrEqual(12);
      expect(plan.w).toBeLessThanOrEqual(asset.sx);
      expect(plan.d).toBeLessThanOrEqual(asset.sz);
    });
  }

  it("every registered structure either reconstructs or is left to the fallback", () => {
    // Just exercise the extractor on all assets so a bad asset can't crash it.
    for (const id of structureIds()) {
      expect(() => houseInteriorPlan(getStructure(id)!)).not.toThrow();
    }
  });
});
