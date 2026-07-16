// Ground items: stacks lying in the world that the player can pick up. Kill
// loot that won't fit a full pack falls here, and chickens lay eggs here. They
// carry no nav blocker (you walk over them), auto-pickup when the player steps
// near, and despawn after a while so the ground never litters forever. They are
// transient — not saved — matching how streamed enemies/nodes are treated.

import type { Cell, SimRng } from "./types";
import { chebyshev } from "./types";

export interface GroundItem {
  instanceId: string;
  itemId: string;
  qty: number;
  cell: Cell;
  despawnRemainingS: number;
}

export interface GroundItemDeps {
  getPlayerCell(): Cell;
  isPlayerAlive(): boolean;
  /** Try to add the stack to the pack; true if it fit (and was taken). */
  tryPickup(itemId: string, qty: number): boolean;
}

const DESPAWN_S = 120; // two minutes on the ground before it fades
const MAX_ITEMS = 64; // hard cap so a dropped-loot flood can't grow unbounded

export class GroundItemSystem {
  instances = new Map<string, GroundItem>();
  private deps: GroundItemDeps;
  private seq = 0;

  constructor(deps: GroundItemDeps) {
    this.deps = deps;
  }

  /** Drop a stack on the ground. Oldest item is evicted past the cap. */
  spawn(itemId: string, qty: number, cell: Cell, despawnS = DESPAWN_S): GroundItem {
    if (this.instances.size >= MAX_ITEMS) {
      const oldest = this.instances.keys().next().value;
      if (oldest) this.instances.delete(oldest);
    }
    const instanceId = `ground.${this.seq++}.${itemId}`;
    const item: GroundItem = { instanceId, itemId, qty, cell, despawnRemainingS: despawnS };
    this.instances.set(instanceId, item);
    return item;
  }

  get(instanceId: string): GroundItem | undefined {
    return this.instances.get(instanceId);
  }

  remove(instanceId: string): boolean {
    return this.instances.delete(instanceId);
  }

  tick(dtSeconds: number, _rng?: SimRng): void {
    if (this.instances.size === 0) return;
    const playerCell = this.deps.getPlayerCell();
    const alive = this.deps.isPlayerAlive();
    for (const item of [...this.instances.values()]) {
      item.despawnRemainingS -= dtSeconds;
      if (item.despawnRemainingS <= 0) {
        this.instances.delete(item.instanceId);
        continue;
      }
      // Step near it (or onto it) and it's yours — as long as the pack has room.
      if (alive && chebyshev(playerCell, item.cell) <= 1 && this.deps.tryPickup(item.itemId, item.qty)) {
        this.instances.delete(item.instanceId);
      }
    }
  }
}
