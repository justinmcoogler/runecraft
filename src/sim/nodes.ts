// Resource-node instance state and lifecycle (ACTIVE -> DEPLETED -> respawn -> ACTIVE).
// Definitions are shared/immutable; instances carry only mutable state.

import { NODES } from "../content/content";
import { getStructure } from "../content/structures";
import { blockedColumns } from "../structures/types";
import type { Cell, SimEventBus, SimRng } from "./types";
import type { WorldState } from "./world";

export type NodePhase = "active" | "depleted";

export interface NodeInstance {
  instanceId: string;
  defId: string;
  cell: Cell;
  /** Imported-structure visual (grand trees). */
  structureId?: string;
  remaining: number;
  phase: NodePhase;
  respawnRemainingS: number;
  /** Farm plots must be plowed (hoe) before a seed will take; true for
   *  everything that isn't a plantable plot. */
  plowed: boolean;
}

export class ResourceNodeSystem {
  instances = new Map<string, NodeInstance>();
  private events: SimEventBus;

  private world: WorldState;

  constructor(world: WorldState, events: SimEventBus, rng: SimRng) {
    this.events = events;
    this.world = world;
    for (const placement of world.region.nodes) this.addInstance(placement, rng);
  }

  /** Cells a placement blocks (single cell + any structure footprint). */
  private blockerCells(placement: { defId: string; cell: Cell; structureId?: string }): Cell[] {
    const cells: Cell[] = [];
    if (NODES[placement.defId].blocksNav) cells.push(placement.cell);
    if (placement.structureId) {
      const asset = getStructure(placement.structureId);
      if (asset) {
        for (const col of blockedColumns(asset, { ignoreLeaves: true })) {
          cells.push({
            x: placement.cell.x + col.x - (asset.ax ?? 0),
            z: placement.cell.z + col.z - (asset.az ?? 0),
          });
        }
      }
    }
    return cells;
  }

  /** Register a node instance (world build or live editor placement). */
  addInstance(
    placement: { instanceId: string; defId: string; cell: Cell; structureId?: string },
    rng: SimRng,
  ): NodeInstance {
    const def = NODES[placement.defId];
    const instance: NodeInstance = {
      instanceId: placement.instanceId,
      defId: placement.defId,
      cell: placement.cell,
      structureId: placement.structureId,
      // -1 marks an inexhaustible node (fishing spots): never depletes.
      remaining: def.depletes ? rng.intBetween(def.resourceMin, def.resourceMax) : -1,
      // Farm plots start empty and dormant (-1: waiting to be planted).
      phase: def.plantable ? "depleted" : "active",
      respawnRemainingS: def.plantable ? -1 : 0,
      plowed: !def.plantable,
    };
    this.instances.set(instance.instanceId, instance);
    // Depleted stumps keep blocking navigation, so the blocker is permanent.
    for (const cell of this.blockerCells(placement)) {
      this.world.registerBlocker(instance.instanceId, cell);
    }
    return instance;
  }

  /** Remove a node instance and free its blocked cells (editor only). */
  removeInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;
    for (const cell of this.blockerCells(instance)) {
      this.world.unregisterBlocker(cell, instanceId);
    }
    this.instances.delete(instanceId);
    return true;
  }

  get(instanceId: string): NodeInstance | undefined {
    return this.instances.get(instanceId);
  }

  /** Called by the action pipeline after a successful cycle. */
  consumeOne(instanceId: string): void {
    const node = this.instances.get(instanceId);
    if (!node || node.phase !== "active") return;
    if (!NODES[node.defId].depletes) return; // inexhaustible
    node.remaining -= 1;
    if (node.remaining <= 0) this.deplete(node);
  }

  private deplete(node: NodeInstance): void {
    node.phase = "depleted";
    node.remaining = 0;
    // Harvested plots go dormant until replanted; everything else respawns.
    node.respawnRemainingS = NODES[node.defId].plantable ? -1 : NODES[node.defId].respawnS;
    this.events.emit({ type: "nodeDepleted", instanceId: node.instanceId });
  }

  /** Plow a dormant plot with a hoe: fresh furrows, ready to sow. */
  plow(instanceId: string): boolean {
    const node = this.instances.get(instanceId);
    const grow = node ? NODES[node.defId].plantable : undefined;
    if (!node || !grow || node.plowed || node.phase !== "depleted" || node.respawnRemainingS >= 0) return false;
    node.plowed = true;
    return true;
  }

  /** Plant a plowed, dormant farm plot: starts its grow timer. */
  plant(instanceId: string): boolean {
    const node = this.instances.get(instanceId);
    const grow = node ? NODES[node.defId].plantable : undefined;
    if (!node || !grow || !node.plowed || node.phase !== "depleted" || node.respawnRemainingS >= 0) return false;
    node.respawnRemainingS = grow.growS;
    return true;
  }

  tick(dtSeconds: number, rng: SimRng): void {
    for (const node of this.instances.values()) {
      if (node.phase !== "depleted") continue;
      if (node.respawnRemainingS < 0) continue; // dormant: an unplanted plot
      node.respawnRemainingS -= dtSeconds;
      if (node.respawnRemainingS <= 0) {
        const def = NODES[node.defId];
        node.phase = "active";
        node.respawnRemainingS = 0;
        node.remaining = rng.intBetween(def.resourceMin, def.resourceMax);
        this.events.emit({ type: "nodeRespawned", instanceId: node.instanceId });
      }
    }
  }
}
