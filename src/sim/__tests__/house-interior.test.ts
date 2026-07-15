// Big imported builds are solid landmarks you enter through a door-portal into
// a clean, purpose-built interior room — "click the house, go inside" — rather
// than clambering over a flattened 2.5D shell.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { getStructure } from "../../content/structures";
import { buildRegion, houseInteriorArrival, houseInteriorId } from "../world";

describe("house interiors", () => {
  it("builds a walkable interior with an exit door back to the yard", () => {
    const exit = { x: 1234, z: -56 };
    const region = buildRegion(houseInteriorId("v1house", exit));
    // Arrival cell is a walkable floor.
    const arrival = houseInteriorArrival("v1house");
    const sim = new GameSimulation(region, 1);
    expect(sim.world.walkable(arrival)).toBe(true);
    // Exactly one exit door, a portal back to the endless world at the yard cell.
    const doors = region.objects.filter((o) => o.portal);
    expect(doors).toHaveLength(1);
    expect(doors[0].portal).toMatchObject({
      targetRegionId: "region.endless",
      targetCell: { x: exit.x, z: exit.z },
    });
    // The room is furnished, not empty.
    expect(region.objects.length).toBeGreaterThan(1);
  });

  it("the interior arrival cell is walkable in the sim", () => {
    const sim = new GameSimulation(buildRegion(houseInteriorId("testhouse", { x: 5, z: 5 })), 3);
    expect(sim.world.walkable(houseInteriorArrival("testhouse"))).toBe(true);
  });

  it("leaves the starter vale a clean natural canvas to build on", () => {
    const sim = GameSimulation.createEndless(7);
    const region = sim.world.region;
    // No pre-built village — the player raises their own town with the editor.
    const townBuildings = (region.structures ?? []).filter((s) => s.instanceId.startsWith("town."));
    expect(townBuildings.length).toBe(0);
    // Spawn is a walkable, gentle spot and its immediate surroundings are open.
    expect(sim.world.walkable(region.spawn)).toBe(true);
    let ok = 0, tot = 0;
    for (let dz = -8; dz <= 8; dz += 4) for (let dx = -8; dx <= 8; dx += 4) {
      tot++;
      if (sim.world.walkable({ x: region.spawn.x + dx, z: region.spawn.z + dz })) ok++;
    }
    expect(ok / tot).toBeGreaterThan(0.75);
  });

  it("clicking a solid house walks to it and enters its interior — no door object", () => {
    // A hand-built overworld tile with one solid house and NO door object:
    // clicking the building itself paths the player to the yard, then steps
    // inside its reconstructed interior.
    const houseId = "v1house";
    const W = 48, D = 48;
    const region = {
      id: "region.test", width: W, depth: D,
      heights: new Array(W * D).fill(4),
      blocks: new Array(W * D).fill("grass"),
      nodes: [], npcs: [], enemies: [], objects: [],
      structures: [{ instanceId: "h", structureId: houseId, cell: { x: 12, z: 12 }, solid: true }],
      spawn: { x: 2, z: 2 },
    };
    const sim = new GameSimulation(region as never, 7);
    // Click the building itself (its instance id), not a door.
    sim.enqueue({ type: "interact", targetId: "h" });
    let entered: { targetRegionId: string } | undefined;
    for (let i = 0; i < 200 && !entered; i++) {
      for (const ev of sim.tick()) if (ev.type === "portalEntered") entered = ev;
    }
    expect(entered?.targetRegionId.startsWith(`houseint_${houseId}_`)).toBe(true);
  });
});
