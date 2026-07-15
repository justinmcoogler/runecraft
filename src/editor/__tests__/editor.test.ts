// World-editor layer: live placement/removal of structures and trees on
// the sim, persistence round-trip, and placement validity rules.

import { describe, expect, it } from "vitest";
import { STRUCTURES } from "../../content/structures";
import { GameSimulation } from "../../sim/simulation";
import { buildRegion } from "../../sim/world";
import type { StructureAsset } from "../../structures/types";
import {
  applyLayerToSim,
  emptyLayer,
  findEditableAt,
  isValidPlacement,
  parseLayer,
  placementCells,
  serializeLayer,
  treeDefForSpecies,
} from "../layer";

// The imported tree library was removed pending better source files, so
// editor tree mechanics run against a small synthetic stand-in.
const TEST_TREE: StructureAsset = {
  name: "test-oak", format: "vanilla-nbt", sx: 3, sy: 5, sz: 3, sink: 0,
  species: "oak", ax: 1, az: 1,
  blocks: [
    { x: 1, y: 0, z: 1, kind: "cube", material: "resource.tree.log.side" },
    { x: 1, y: 1, z: 1, kind: "cube", material: "resource.tree.log.side" },
    { x: 1, y: 2, z: 1, kind: "cube", material: "resource.tree.log.side" },
    { x: 0, y: 3, z: 1, kind: "cube", material: "resource.tree.leaves" },
    { x: 1, y: 3, z: 1, kind: "cube", material: "resource.tree.leaves" },
    { x: 2, y: 3, z: 1, kind: "cube", material: "resource.tree.leaves" },
    { x: 1, y: 3, z: 0, kind: "cube", material: "resource.tree.leaves" },
    { x: 1, y: 3, z: 2, kind: "cube", material: "resource.tree.leaves" },
    { x: 1, y: 4, z: 1, kind: "cube", material: "resource.tree.leaves" },
  ],
  unmapped: [],
};
STRUCTURES["tree.test"] = TEST_TREE;

// The imported wayshrine asset was removed with the rest of the old pack set;
// editor structure mechanics run against a small synthetic stand-in registered
// under the same id — a 5×5 shrine with four corner pillars (blockers) around
// an open, lantern-lit interior.
const TEST_WAYSHRINE: StructureAsset = {
  name: "test-wayshrine", format: "vanilla-nbt", sx: 5, sy: 4, sz: 5, sink: 0,
  blocks: [
    ...([[0, 0], [4, 0], [0, 4], [4, 4]] as const).flatMap(([x, z]) => [
      { x, y: 0, z, kind: "post" as const, material: "terrain.stonebrick" },
      { x, y: 1, z, kind: "post" as const, material: "terrain.stonebrick" },
    ]),
    { x: 2, y: 3, z: 2, kind: "glow", color: "#ffd873" },
  ],
  unmapped: [],
};
STRUCTURES["wayshrine"] = TEST_WAYSHRINE;

const OPEN = { x: 1020, z: 1440 }; // open meadow south-west of Greenvale

describe("editor placements", () => {
  it("places and removes a structure with live blockers", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 5);
    expect(sim.world.walkable(OPEN)).toBe(true);
    sim.addEditorStructure({ instanceId: "edit.s.1", structureId: "wayshrine", cell: OPEN });
    // The wayshrine blocks its four pillar corners.
    expect(sim.world.walkable({ x: OPEN.x, z: OPEN.z })).toBe(false);
    expect(sim.world.walkable({ x: OPEN.x + 2, z: OPEN.z + 2 })).toBe(true); // under the lantern
    expect(sim.removeEditorStructure("edit.s.1")).toBe(true);
    expect(sim.world.walkable(OPEN)).toBe(true);
    expect(sim.world.region.structures?.some((s) => s.instanceId === "edit.s.1")).toBe(false);
  });

  it("places a choppable editor tree and removes it cleanly", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 6);
    const cell = { x: 1084, z: 1440 };
    sim.addEditorTree({
      instanceId: "edit.t.1",
      defId: treeDefForSpecies("oak"),
      structureId: "tree.test",
      cell,
    });
    expect(sim.world.walkable(cell)).toBe(false); // the trunk
    // It's a real woodcutting node.
    sim.movement.setCellPosition({ x: cell.x - 3, z: cell.z });
    sim.enqueue({ type: "interact", targetId: "edit.t.1" });
    let gotLog = false;
    for (let i = 0; i < 3000 && !gotLog; i++) {
      for (const ev of sim.tick()) {
        if (ev.type === "itemGained" && ev.itemId === "item.log.basic") gotLog = true;
      }
    }
    expect(gotLog).toBe(true);
    expect(sim.removeEditorNode("edit.t.1")).toBe(true);
    expect(sim.world.walkable(cell)).toBe(true);
  });

  it("validates placement against water and existing blockers", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 7);
    expect(isValidPlacement(sim, "tree.test", { x: 1084, z: 1440 }, true)).toBe(true);
    expect(isValidPlacement(sim, "tree.test", { x: 1505, z: 1505 }, true)).toBe(false); // the Silverlake
    // On top of the plaza well: blockers in the way.
    expect(isValidPlacement(sim, "wayshrine", { x: 1250, z: 1375 }, false)).toBe(false);
    expect(placementCells("wayshrine", { x: 0, z: 0 }, false).length).toBeGreaterThan(0);
  });

  it("round-trips a layer and re-applies it to a fresh sim", () => {
    const layer = emptyLayer();
    layer.counter = 2;
    layer.trees.push({
      instanceId: "edit.t.1",
      defId: treeDefForSpecies("spruce"),
      structureId: "tree.test",
      cell: { x: 1028, z: 1440 },
    });
    layer.structures.push({ instanceId: "edit.s.2", structureId: "wayshrine", cell: { x: 1032, z: 1444 } });
    layer.removed.push("vale.structure.wayshrine"); // delete the authored shrine
    const restored = parseLayer(serializeLayer(layer))!;
    expect(restored).toEqual(layer);

    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 8);
    applyLayerToSim(sim, restored);
    expect(sim.nodes.get("edit.t.1")).toBeDefined();
    expect(sim.world.walkable({ x: 1032, z: 1444 })).toBe(false); // placed shrine pillar
    // The authored wayshrine is gone and its corners freed.
    expect(sim.world.region.structures?.some((s) => s.instanceId === "vale.structure.wayshrine")).toBe(false);
    expect(sim.world.walkable({ x: 1291, z: 1451 })).toBe(true);
  });

  it("finds what an editor click would remove", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 9);
    sim.addEditorTree({
      instanceId: "edit.t.9",
      defId: treeDefForSpecies("oak"),
      structureId: "tree.test",
      cell: { x: 1084, z: 1440 },
    });
    expect(findEditableAt(sim, { x: 1084, z: 1440 })).toEqual({ kind: "tree", instanceId: "edit.t.9" });
    // The authored wayshrine is editable; the keep is protected.
    expect(findEditableAt(sim, { x: 1291, z: 1451 })?.instanceId).toBe("vale.structure.wayshrine");
    expect(findEditableAt(sim, { x: 1250, z: 1338 })).toBe(null);
    expect(findEditableAt(sim, { x: 1020, z: 1440 })).toBe(null);
  });
});
