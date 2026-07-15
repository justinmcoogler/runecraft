// Wandering NPCs. Authoritative position/wandering lives in the simulation;
// dialogue content and visuals are presentation concerns.

import { MovementController } from "./movement";
import { findPath } from "./pathfinding";
import type { Cell, SimRng } from "./types";
import type { NpcPlacement, WorldState } from "./world";

export interface NpcState {
  instanceId: string;
  name: string;
  home: Cell;
  wanderRadius: number;
  movement: MovementController;
  holdS: number; // > 0: stand still (being approached / talking)
  wanderCooldownS: number;
  lines?: string[];
}

export class NpcSystem {
  npcs = new Map<string, NpcState>();
  private world: WorldState;

  constructor(world: WorldState, rng: SimRng) {
    this.world = world;
    for (const placement of world.region.npcs) this.addPlacement(placement, rng);
  }

  /** Spawn one NPC live (used at build time and by chunk streaming). */
  addPlacement(placement: NpcPlacement, rng: SimRng): void {
    if (this.npcs.has(placement.instanceId)) return;
    const movement = new MovementController();
    movement.speedCellsPerS = 1.7;
    movement.setCellPosition(placement.cell);
    this.npcs.set(placement.instanceId, {
      instanceId: placement.instanceId,
      name: placement.name,
      home: placement.cell,
      wanderRadius: placement.wanderRadius,
      lines: placement.lines,
      movement,
      holdS: 0,
      wanderCooldownS: 2 + rng.next() * 4,
    });
  }

  /** Despawn an NPC (chunk streaming out). */
  remove(instanceId: string): void {
    this.npcs.delete(instanceId);
  }

  get(instanceId: string): NpcState | undefined {
    return this.npcs.get(instanceId);
  }

  /** Keep an NPC in place for a while (targeted or mid-conversation). */
  hold(instanceId: string, seconds: number): void {
    const npc = this.npcs.get(instanceId);
    if (npc) {
      npc.holdS = Math.max(npc.holdS, seconds);
      npc.movement.stop();
    }
  }

  tick(dtSeconds: number, rng: SimRng): void {
    for (const npc of this.npcs.values()) {
      if (npc.holdS > 0) {
        npc.holdS -= dtSeconds;
        continue;
      }
      npc.movement.tick(dtSeconds);
      if (npc.movement.isMoving()) continue;
      npc.wanderCooldownS -= dtSeconds;
      if (npc.wanderCooldownS > 0) continue;
      npc.wanderCooldownS = 3 + rng.next() * 6;
      for (let attempt = 0; attempt < 8; attempt++) {
        const target: Cell = {
          x: npc.home.x + rng.intBetween(-npc.wanderRadius, npc.wanderRadius),
          z: npc.home.z + rng.intBetween(-npc.wanderRadius, npc.wanderRadius),
        };
        if (!this.world.walkable(target)) continue;
        const path = findPath(this.world, npc.movement.currentCell(), target);
        if (path && path.length > 0) {
          npc.movement.setPath(path);
          break;
        }
      }
    }
  }
}
