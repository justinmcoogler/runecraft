// The world-editor's edit layer: a plain-data overlay of structure and
// tree placements (and removals of authored pieces) applied on top of the
// authored world at boot. Pure sim-side logic — the panel UI lives in
// panel.ts. The layer serializes to JSON so edits persist locally and can
// be exported for baking into the authored world permanently.

import { getStructure } from "../content/structures";
import { blockedColumns } from "../structures/types";
import type { GameSimulation } from "../sim/simulation";
import type { Cell } from "../sim/types";

export interface EditorTreePlacement {
  instanceId: string;
  defId: string;
  structureId: string;
  cell: Cell;
}

export interface EditorStructurePlacement {
  instanceId: string;
  structureId: string;
  cell: Cell;
}

export interface EditorEntityPlacement {
  instanceId: string;
  defId: string;
  cell: Cell;
}

export interface EditorLayer {
  version: 1;
  counter: number;
  structures: EditorStructurePlacement[];
  trees: EditorTreePlacement[];
  /** Full-editor placements: any resource node, object, or creature. */
  nodes: EditorEntityPlacement[];
  objects: EditorEntityPlacement[];
  enemies: EditorEntityPlacement[];
  /** Authored piece ids deleted in the editor (trees, rocks, spawns…). */
  removed: string[];
}

export function emptyLayer(): EditorLayer {
  return { version: 1, counter: 0, structures: [], trees: [], nodes: [], objects: [], enemies: [], removed: [] };
}

export function serializeLayer(layer: EditorLayer): string {
  return JSON.stringify(layer, null, 2);
}

export function parseLayer(json: string): EditorLayer | null {
  try {
    const raw = JSON.parse(json) as Partial<EditorLayer>;
    if (raw.version !== 1) return null;
    return {
      version: 1,
      counter: typeof raw.counter === "number" ? raw.counter : 0,
      structures: Array.isArray(raw.structures) ? raw.structures : [],
      trees: Array.isArray(raw.trees) ? raw.trees : [],
      nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
      objects: Array.isArray(raw.objects) ? raw.objects : [],
      enemies: Array.isArray(raw.enemies) ? raw.enemies : [],
      removed: Array.isArray(raw.removed) ? raw.removed : [],
    };
  } catch {
    return null;
  }
}

/** The woodcutting node def for a tree structure's species. */
export function treeDefForSpecies(species: string | undefined): string {
  switch (species) {
    case "spruce": return "resource.tree.spruce";
    case "birch": return "resource.tree.birch";
    case "jungle": return "resource.tree.jungle";
    case "acacia": return "resource.tree.acacia";
    case "dark_oak": return "resource.tree.darkoak";
    case "blossom": return "resource.tree.grand.blossom";
    case "ember": return "resource.tree.grand.ember";
    case "glow": return "resource.tree.grand.glow";
    case "dusk": return "resource.tree.grand.dusk";
    default: return "resource.tree.basic";
  }
}

/** Ground cells a placement would block (trees anchor at the trunk). */
export function placementCells(structureId: string, cell: Cell, isTree: boolean): Cell[] {
  const asset = getStructure(structureId);
  if (!asset) return [];
  const ax = isTree ? asset.ax ?? 0 : 0;
  const az = isTree ? asset.az ?? 0 : 0;
  return blockedColumns(asset, { ignoreLeaves: isTree }).map((col) => ({
    x: cell.x + col.x - ax,
    z: cell.z + col.z - az,
  }));
}

/** A placement is valid on dry, unoccupied, in-bounds ground. */
export function isValidPlacement(
  sim: GameSimulation,
  structureId: string,
  cell: Cell,
  isTree: boolean,
): boolean {
  const cells = placementCells(structureId, cell, isTree);
  if (cells.length === 0 && !isTree) return false;
  const probe = [...cells, cell];
  const player = sim.movement.currentCell();
  return probe.every(
    (c) =>
      sim.world.inBounds(c) &&
      sim.world.blockAt(c) !== "water" &&
      sim.world.blockerAt(c) === undefined &&
      !(c.x === player.x && c.z === player.z),
  );
}

/** Apply a saved layer to a freshly built vale simulation. */
export function applyLayerToSim(sim: GameSimulation, layer: EditorLayer): void {
  if (sim.world.region.id !== "region.vale_clearing") return;
  for (const id of layer.removed) {
    if (sim.removeEditorStructure(id)) continue;
    if (sim.removeEditorNode(id)) continue;
    if (sim.removeEditorObject(id)) continue;
    sim.removeEditorEnemy(id);
  }
  for (const placement of layer.structures) {
    if (getStructure(placement.structureId)) sim.addEditorStructure(placement);
  }
  for (const tree of layer.trees) {
    if (getStructure(tree.structureId)) sim.addEditorTree(tree);
  }
  for (const node of layer.nodes) sim.addEditorNodePlain(node);
  for (const object of layer.objects) sim.addEditorObject(object);
  for (const enemy of layer.enemies) sim.addEditorEnemy(enemy);
}

/**
 * What an editor click on a cell would delete: an editor or authored
 * structure/tree whose footprint covers the cell. The starting village
 * stays protected.
 */
const PROTECTED = new Set(["vale.structure.village"]);
/** World fabric that must survive editing: transit and quest anchors. */
const PROTECTED_DEFS = /^object\.(portal|stairs|keep|spire|store|counter)\./;

export type EditableKind = "structure" | "tree" | "node" | "object" | "enemy";

export function findEditableAt(sim: GameSimulation, cell: Cell): { kind: EditableKind; instanceId: string } | null {
  // Creatures standing on the cell come first — they're what you can see.
  for (const [id, enemy] of sim.enemies.enemies) {
    if (enemy.phase !== "alive") continue;
    const c = enemy.movement.currentCell();
    if (Math.abs(c.x - cell.x) <= 0 && Math.abs(c.z - cell.z) <= 0) return { kind: "enemy", instanceId: id };
  }
  const blocker = sim.world.blockerAt(cell);
  if (blocker && !PROTECTED.has(blocker)) {
    const node = sim.nodes.get(blocker);
    if (node?.structureId) return { kind: "tree", instanceId: blocker };
    if (node) return { kind: "node", instanceId: blocker };
    const blockObj = sim.world.region.objects.find((o) => o.instanceId === blocker);
    if (blockObj) {
      // World-fabric objects (transit/quest anchors) are protected, but a copy
      // the player placed with the editor is always theirs to remove again.
      const guarded = PROTECTED_DEFS.test(blockObj.defId) && !blocker.startsWith("edit.");
      return guarded ? null : { kind: "object", instanceId: blocker };
    }
    if ((sim.world.region.structures ?? []).some((s) => s.instanceId === blocker)) {
      return { kind: "structure", instanceId: blocker };
    }
  }
  // Non-blocking pieces sitting on the cell (herbs, fishing spots, flowers).
  for (const node of sim.nodes.instances.values()) {
    if (node.cell.x === cell.x && node.cell.z === cell.z && !PROTECTED.has(node.instanceId)) {
      return { kind: node.structureId ? "tree" : "node", instanceId: node.instanceId };
    }
  }
  for (const object of sim.world.region.objects) {
    const guarded = PROTECTED_DEFS.test(object.defId) && !object.instanceId.startsWith("edit.");
    if (
      object.cell.x === cell.x && object.cell.z === cell.z &&
      !PROTECTED.has(object.instanceId) && !guarded
    ) {
      return { kind: "object", instanceId: object.instanceId };
    }
  }
  // Structures whose visual bbox covers the cell (open lawns block nothing).
  for (const placement of sim.world.region.structures ?? []) {
    if (PROTECTED.has(placement.instanceId)) continue;
    const asset = getStructure(placement.structureId);
    if (!asset) continue;
    if (
      cell.x >= placement.cell.x && cell.x < placement.cell.x + asset.sx &&
      cell.z >= placement.cell.z && cell.z < placement.cell.z + asset.sz
    ) {
      return { kind: "structure", instanceId: placement.instanceId };
    }
  }
  return null;
}
