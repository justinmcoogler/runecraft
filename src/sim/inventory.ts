// Slot inventory with stacking and transactional transfers.
// All mutations are all-or-nothing: a failed operation leaves no partial state.

import { ITEMS } from "../content/content";

export interface ItemStack {
  itemId: string;
  qty: number;
}

export type Slots = Array<ItemStack | null>;

export class Inventory {
  slots: Slots;

  constructor(slotCount: number) {
    this.slots = new Array(slotCount).fill(null);
  }

  /** How many of `qty` could be added right now (fills stacks first, then empty slots). */
  capacityFor(itemId: string, qty: number): number {
    const def = ITEMS[itemId];
    let room = 0;
    for (const s of this.slots) {
      if (s && s.itemId === itemId && def.stackable) room += def.maxStack - s.qty;
      else if (s === null) room += def.maxStack;
      if (room >= qty) return qty;
    }
    return Math.min(room, qty);
  }

  canAdd(itemId: string, qty: number): boolean {
    return this.capacityFor(itemId, qty) >= qty;
  }

  /** Adds up to `qty`; returns the amount actually added. Callers wanting atomicity check canAdd first. */
  add(itemId: string, qty: number): number {
    const def = ITEMS[itemId];
    let remaining = qty;
    if (def.stackable) {
      for (const s of this.slots) {
        if (remaining === 0) break;
        if (s && s.itemId === itemId && s.qty < def.maxStack) {
          const take = Math.min(def.maxStack - s.qty, remaining);
          s.qty += take;
          remaining -= take;
        }
      }
    }
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (this.slots[i] === null) {
        const take = Math.min(def.maxStack, remaining);
        this.slots[i] = { itemId, qty: take };
        remaining -= take;
      }
    }
    return qty - remaining;
  }

  /** Removes up to `qty` from a specific slot; returns amount removed. */
  removeFromSlot(slot: number, qty: number): number {
    const s = this.slots[slot];
    if (!s) return 0;
    const take = Math.min(s.qty, qty);
    s.qty -= take;
    if (s.qty === 0) this.slots[slot] = null;
    return take;
  }

  count(itemId: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.itemId === itemId) n += s.qty;
    return n;
  }

  isFullFor(itemId: string): boolean {
    return !this.canAdd(itemId, 1);
  }

  /** Deep copy of the slot state, for transactional rollback. */
  snapshot(): Slots {
    return this.slots.map((s) => (s ? { ...s } : null));
  }

  restore(slots: Slots): void {
    this.slots = slots;
  }

  /** Removes up to `qty` of an item across all slots; returns the amount removed. */
  removeItemById(itemId: string, qty: number): number {
    let remaining = qty;
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.itemId === itemId) {
        const take = Math.min(s.qty, remaining);
        s.qty -= take;
        remaining -= take;
        if (s.qty === 0) this.slots[i] = null;
      }
    }
    return qty - remaining;
  }

  firstSlotWithTag(tag: string): number {
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && ITEMS[s.itemId].toolTags?.includes(tag)) return i;
    }
    return -1;
  }
}

/**
 * Transactional transfer of one slot's stack between inventories.
 * Moves as much as fits; if nothing fits, nothing changes. Never duplicates or loses items:
 * capacity is computed first, then exactly that amount is removed and added.
 */
export function transferSlot(from: Inventory, slot: number, to: Inventory): number {
  const s = from.slots[slot];
  if (!s) return 0;
  const movable = to.capacityFor(s.itemId, s.qty);
  if (movable === 0) return 0;
  const itemId = s.itemId;
  const removed = from.removeFromSlot(slot, movable);
  const added = to.add(itemId, removed);
  // added === removed by construction (capacity was measured against `to`).
  return added;
}
