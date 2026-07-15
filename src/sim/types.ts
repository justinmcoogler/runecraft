// Shared simulation types: commands in, events out. No engine imports.

export interface Cell {
  x: number;
  z: number;
}

export const cellKey = (c: Cell): string => `${c.x},${c.z}`;
export const cellsEqual = (a: Cell, b: Cell): boolean => a.x === b.x && a.z === b.z;
export const chebyshev = (a: Cell, b: Cell): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

export type Command =
  | { type: "moveTo"; cell: Cell }
  | { type: "interact"; targetId: string }
  | { type: "cancel" }
  | { type: "equipSlot"; slot: number }
  | { type: "unequip" }
  | { type: "deposit"; slot: number }
  | { type: "depositAll" }
  | { type: "withdraw"; slot: number }
  | { type: "closeContainer" }
  | { type: "craft"; stationId: string; recipeId: string }
  | { type: "eatSlot"; slot: number }
  | { type: "burnSlot"; slot: number }
  | { type: "burySlot"; slot: number }
  | { type: "alchSlot"; slot: number; high: boolean }
  | { type: "unequipArmor"; slot: ArmorSlot }
  | { type: "shopBuy"; itemId: string }
  | { type: "shopSell"; slot: number };

export type ArmorSlot = "head" | "body" | "legs" | "feet";

export type RejectReason =
  | "no_target"
  | "node_unavailable"
  | "level_too_low"
  | "missing_tool"
  | "missing_inputs"
  | "unreachable";

export type ActionEndState = "completed" | "failed" | "cancelled" | "interrupted";

export type SimEvent =
  | { type: "targetSelected"; targetId: string; cell: Cell }
  | { type: "destinationSet"; cell: Cell }
  | { type: "actionRejected"; reason: RejectReason; targetId?: string }
  | { type: "actionStarted"; targetId: string }
  | { type: "actionCycle"; targetId: string; success: boolean }
  | { type: "itemGained"; itemId: string; qty: number }
  | { type: "gemFound"; itemId: string }
  | { type: "logBurned"; itemId: string }
  | { type: "bonesBuried"; itemId: string }
  | { type: "spellCast"; spell: string; coins: number }
  | { type: "xpGained"; skillId: string; amount: number }
  | { type: "levelUp"; skillId: string; level: number }
  | { type: "inventoryChanged" }
  | { type: "equipmentChanged" }
  | { type: "inventoryFull" }
  | { type: "nodeDepleted"; instanceId: string }
  | { type: "nodeRespawned"; instanceId: string }
  | { type: "actionEnded"; state: ActionEndState; reason: string }
  | { type: "containerOpened"; instanceId: string }
  | { type: "containerClosed" }
  | { type: "workstationOpened"; instanceId: string }
  | { type: "workstationClosed" }
  | { type: "shopOpened"; instanceId: string; shopId: string }
  | { type: "shopClosed" }
  | { type: "npcChat"; instanceId: string; name: string }
  | { type: "questStarted"; questId: string; name: string }
  | { type: "questAdvanced"; questId: string; label: string }
  | { type: "questCompleted"; questId: string; name: string }
  | { type: "playerAttack"; instanceId: string; damage: number | null; killed: boolean }
  | { type: "enemyAttack"; instanceId: string; damage: number | null }
  | { type: "healthChanged"; hp: number; maxHp: number }
  | { type: "ateFood"; itemId: string; healed: number }
  | { type: "playerDied" }
  | { type: "enemyDied"; instanceId: string }
  | { type: "enemyRespawned"; instanceId: string }
  | { type: "portalEntered"; targetRegionId: string; targetCell: Cell }
  | { type: "playerSlept"; cell: Cell; restedTillDawn: boolean }
  | { type: "respawnTravel"; targetRegionId: string; targetCell: Cell }
  | { type: "doorOpened"; instanceId: string; cell: Cell }
  | { type: "doorClosed"; instanceId: string; cell: Cell }
  | { type: "stairsChoice"; cell: Cell; options: Array<{ dir: "up" | "down"; targetRegionId: string; targetCell: Cell }> }
  | { type: "worldFlagSet"; flag: string }
  | { type: "poiDiscovered"; id: string; name: string; reward: number; total: number }
  | { type: "dungeonCleared"; id: string; name: string; reward: number; total: number }
  | { type: "tutorialObjective"; index: number; total: number; title: string; blurb: string }
  | { type: "tutorialLessonDone"; index: number; title: string; optional?: boolean; skillId?: string }
  | { type: "tutorialComplete" }
  | { type: "buffApplied"; itemId: string; kind: string }
  | { type: "planted"; instanceId: string; seedItemId: string }
  | { type: "shortcutUsed"; instanceId: string }
  | { type: "thieveryCaught"; targetId: string; damage: number }
  | { type: "slayerTaskAssigned"; enemyName: string; count: number }
  | { type: "slayerTaskProgress"; enemyName: string; remaining: number }
  | { type: "slayerTaskComplete"; xp: number; coins: number }
  | { type: "relicDonated"; itemId: string; qty: number; xp: number; firstOfKind: boolean }
  | { type: "relicCollectionComplete"; coins: number }
  | { type: "zoneEntered"; zoneId: string; name: string; blurb: string };

/** Per-tick event buffer. Simulation appends; the app shell drains after each tick. */
export class SimEventBus {
  private buffer: SimEvent[] = [];
  emit(event: SimEvent): void {
    this.buffer.push(event);
  }
  drain(): SimEvent[] {
    const out = this.buffer;
    this.buffer = [];
    return out;
  }
}

/** Deterministic seeded RNG (mulberry32) so simulation tests are reproducible. */
export class SimRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  intBetween(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

export const TICK_HZ = 10;
export const TICK_DT = 1 / TICK_HZ;
export const secondsToTicks = (s: number): number => Math.max(1, Math.round(s * TICK_HZ));
