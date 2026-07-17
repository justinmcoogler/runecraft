// Streams endless-world chunks through the live simulation: as the player
// moves, nearby chunks' nodes, scenery and beasts are activated into the
// sim (region arrays + node/enemy systems + nav blockers), and far chunks
// are retired again. Terrain itself is served lazily by EndlessTerrain via
// WorldState's TerrainSource — this manager only handles entities.

import { OBJECTS } from "../content/content";
import { isModelEnabled } from "../render/model-prefs";
import { Inventory } from "./inventory";
import type { GameSimulation } from "./simulation";
import type { Cell } from "./types";
import { villagerQuestFor } from "./villager-quests";
import { ECHUNK, type EndlessTerrain } from "./worldgen/endless";

/** Chunks kept active around the player (radius in chunks). ENTITY_RADIUS
 *  in the renderer is 180 cells; 3 chunks = 192 cells, comfortably beyond. */
const ACTIVE_RADIUS = 3;

export class ChunkManager {
  private active = new Set<string>();

  constructor(
    private sim: GameSimulation,
    private terrain: EndlessTerrain,
  ) {}

  update(player: Cell): void {
    const pcx = Math.floor(player.x / ECHUNK);
    const pcz = Math.floor(player.z / ECHUNK);
    const wanted = new Set<string>();
    for (let dz = -ACTIVE_RADIUS; dz <= ACTIVE_RADIUS; dz++) {
      for (let dx = -ACTIVE_RADIUS; dx <= ACTIVE_RADIUS; dx++) {
        // A disc, not a square: the box's corners sit ~40% farther out than
        // its faces, so content used to pop in earlier or later depending on
        // heading. A circle keeps the loaded ring even all around the player.
        if (dx * dx + dz * dz > ACTIVE_RADIUS * ACTIVE_RADIUS + 1) continue;
        wanted.add(`${pcx + dx},${pcz + dz}`);
      }
    }
    for (const key of wanted) if (!this.active.has(key)) this.activate(key);
    for (const key of [...this.active]) if (!wanted.has(key)) this.retire(key);
  }

  private activate(key: string): void {
    const [cx, cz] = key.split(",").map(Number);
    const chunk = this.terrain.chunk(cx, cz);
    const region = this.sim.world.region;
    for (const node of chunk.nodes) {
      // A "deleted" asset (disabled in the editor) never streams into the wild.
      if (!isModelEnabled(node.defId)) continue;
      region.nodes.push(node);
      this.sim.nodes.addInstance(node, this.sim.rng);
    }
    for (const obj of chunk.objects) {
      if (!isModelEnabled(obj.defId)) continue;
      region.objects.push(obj);
      const odef = OBJECTS[obj.defId];
      if (odef.blocksNav) {
        this.sim.world.registerBlocker(obj.instanceId, obj.cell);
        for (const cell of obj.footprint ?? []) this.sim.world.registerBlocker(obj.instanceId, cell);
      }
      // Lootable props (barrels/crates) need their container spun up + stocked.
      if (odef.containerSlots && !this.sim.containers.has(obj.instanceId)) {
        const inv = new Inventory(odef.containerSlots);
        this.sim.seedRandomLoot(inv, odef);
        this.sim.containers.set(obj.instanceId, inv);
      }
    }
    const foes = (region.enemies ??= []);
    for (const foe of chunk.enemies) {
      if (this.sim.spawnFilter && !this.sim.spawnFilter(foe.defId)) continue;
      foes.push(foe);
      this.sim.enemies.addPlacement(foe, this.sim.rng);
    }
    // Wild homesteads: region-level structures with nav blockers, streamed
    // into visuals by distance in the renderer (like the rest of the window).
    for (const structure of chunk.structures) {
      if (!isModelEnabled(structure.structureId)) continue;
      this.sim.addEditorStructure(structure);
    }
    // Village folk: streamed like beasts so hamlets in the wild are peopled.
    for (const npc of chunk.npcs) {
      region.npcs.push(npc);
      this.sim.npcs.addPlacement(npc, this.sim.rng);
      // Skill-home residents each carry one procedural errand. The def is a
      // pure function of (seed, npc id), so streaming back in re-registers
      // the identical quest — saved progress on it survives untouched.
      const errand = villagerQuestFor(this.sim.seed, npc);
      if (errand) this.sim.quests.addDef(errand);
    }
    this.active.add(key);
  }

  private retire(key: string): void {
    const prefix = `end.${key.replace(",", ".")}.`;
    const region = this.sim.world.region;
    // NOTE (phase 1): no per-chunk diffs yet — a retired chunk regenerates
    // fresh on return, so felled trees regrow. Diffs land with saves.
    for (let i = region.nodes.length - 1; i >= 0; i--) {
      const node = region.nodes[i];
      if (!node.instanceId.startsWith(prefix)) continue;
      this.sim.nodes.removeInstance(node.instanceId);
      region.nodes.splice(i, 1);
    }
    for (let i = region.objects.length - 1; i >= 0; i--) {
      const obj = region.objects[i];
      if (!obj.instanceId.startsWith(prefix)) continue;
      if (OBJECTS[obj.defId].blocksNav) {
        if (this.sim.world.blockerAt(obj.cell) === obj.instanceId) this.sim.world.unregisterBlocker(obj.cell);
        for (const cell of obj.footprint ?? []) {
          if (this.sim.world.blockerAt(cell) === obj.instanceId) this.sim.world.unregisterBlocker(cell);
        }
      }
      this.sim.containers.delete(obj.instanceId);
      region.objects.splice(i, 1);
    }
    const foes = region.enemies ?? [];
    for (let i = foes.length - 1; i >= 0; i--) {
      const foe = foes[i];
      if (!foe.instanceId.startsWith(prefix)) continue;
      this.sim.enemies.removePlacement(foe.instanceId);
      foes.splice(i, 1);
    }
    for (const structure of [...(region.structures ?? [])]) {
      if (structure.instanceId.startsWith(prefix)) this.sim.removeEditorStructure(structure.instanceId);
    }
    for (let i = region.npcs.length - 1; i >= 0; i--) {
      if (!region.npcs[i].instanceId.startsWith(prefix)) continue;
      this.sim.npcs.remove(region.npcs[i].instanceId);
      region.npcs.splice(i, 1);
    }
    this.active.delete(key);
  }
}
