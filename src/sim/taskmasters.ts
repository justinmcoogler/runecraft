// The village taskmasters: Warden Brusk hands out slaying assignments, and
// Curator Fenwick takes relics off your hands for the village collection.
// Both react to npcChat events inside the tick, quest-service style, and
// their state is plain data for the save system.

import { ENEMIES, ITEMS } from "../content/content";
import type { EnemySystem } from "./enemies";
import type { Inventory } from "./inventory";
import type { SkillService } from "./skills";
import type { SimEvent, SimEventBus } from "./types";

export const SLAYER_NPC_ID = "village.npc.brusk";
export const CURATOR_NPC_ID = "village.npc.fenwick";

/**
 * The assignment ladder: unlocks by Slaying level, counts scale with it.
 * Every entry MUST be an enemy that actually spawns in the world — an
 * assignment nobody can complete is a broken game, not a challenge.
 */
export const ASSIGNMENTS: Array<{ defId: string; minLevel: number; baseCount: number; xp: number; coins: number }> = [
  { defId: "enemy.spider", minLevel: 1, baseCount: 4, xp: 120, coins: 15 },
  { defId: "enemy.timber_wolf", minLevel: 1, baseCount: 3, xp: 160, coins: 22 },
  { defId: "enemy.cave_spider", minLevel: 4, baseCount: 4, xp: 240, coins: 35 },
  { defId: "enemy.dust_scuttler", minLevel: 5, baseCount: 4, xp: 270, coins: 40 },
  { defId: "enemy.bog_slime", minLevel: 6, baseCount: 4, xp: 300, coins: 45 },
  { defId: "enemy.vine_stalker", minLevel: 8, baseCount: 3, xp: 360, coins: 55 },
  { defId: "enemy.mire_husk", minLevel: 9, baseCount: 4, xp: 390, coins: 60 },
  { defId: "enemy.frost_wolf", minLevel: 10, baseCount: 3, xp: 420, coins: 65 },
  { defId: "enemy.dune_husk", minLevel: 12, baseCount: 4, xp: 500, coins: 78 },
  { defId: "enemy.spore_shambler", minLevel: 13, baseCount: 3, xp: 540, coins: 85 },
  { defId: "enemy.rust_construct", minLevel: 14, baseCount: 3, xp: 580, coins: 95 },
  // The first capstone bounty: Old Gnasher himself, once per rotation.
  { defId: "enemy.old_gnasher", minLevel: 16, baseCount: 1, xp: 700, coins: 120 },
  // Mid-game: the danger-tier-2/3 beasts of the deeper wild.
  { defId: "enemy.dire_wolf", minLevel: 20, baseCount: 4, xp: 900, coins: 150 },
  { defId: "enemy.marsh_lurker", minLevel: 24, baseCount: 4, xp: 1050, coins: 175 },
  { defId: "enemy.grave_shambler", minLevel: 28, baseCount: 4, xp: 1200, coins: 200 },
  { defId: "enemy.moss_golem", minLevel: 32, baseCount: 3, xp: 1400, coins: 235 },
  { defId: "enemy.gloom_spinner", minLevel: 36, baseCount: 4, xp: 1600, coins: 270 },
  { defId: "enemy.stone_sentinel", minLevel: 42, baseCount: 3, xp: 1900, coins: 320 },
  // Late game: the tier-4 bruisers, then the tier-5 horrors far from home.
  { defId: "enemy.barrow_lord", minLevel: 50, baseCount: 3, xp: 2400, coins: 400 },
  { defId: "enemy.silt_king", minLevel: 58, baseCount: 3, xp: 2900, coins: 480 },
  { defId: "enemy.glacial_wight", minLevel: 66, baseCount: 3, xp: 3500, coins: 580 },
  { defId: "enemy.canyon_construct", minLevel: 72, baseCount: 3, xp: 4000, coins: 660 },
  { defId: "enemy.warden", minLevel: 80, baseCount: 2, xp: 4800, coins: 800 },
  { defId: "enemy.ravager", minLevel: 88, baseCount: 2, xp: 5600, coins: 950 },
];

export interface SlayerState {
  taskDefId: string | null;
  /** Index into ASSIGNMENTS, so duplicate-enemy tiers pay their own rate. */
  taskIndex?: number;
  remaining: number;
  tasksDone: number;
}

export class SlayerService {
  state: SlayerState = { taskDefId: null, remaining: 0, tasksDone: 0 };

  constructor(
    private deps: {
      events: SimEventBus;
      skills: SkillService;
      inventory: Inventory;
      enemies: EnemySystem;
    },
  ) {}

  /** Deterministic rotation through the assignments this level unlocks. */
  private nextAssignmentIndex(): number {
    const level = this.deps.skills.levelOf("skill.slaying");
    const pool = ASSIGNMENTS.map((a, i) => [a, i] as const).filter(([a]) => a.minLevel <= level);
    return pool[this.state.tasksDone % pool.length][1];
  }

  process(events: SimEvent[]): void {
    const d = this.deps;
    for (const ev of events) {
      // Kills tick the tally down.
      if (ev.type === "playerAttack" && ev.killed && this.state.taskDefId) {
        const defId = d.enemies.get(ev.instanceId)?.defId;
        if (defId === this.state.taskDefId && this.state.remaining > 0) {
          this.state.remaining -= 1;
          d.events.emit({
            type: "slayerTaskProgress",
            enemyName: ENEMIES[defId].name,
            remaining: this.state.remaining,
          });
        }
      }
      // Talking to the warden assigns, reminds, or pays out.
      if (ev.type === "npcChat" && ev.instanceId === SLAYER_NPC_ID) {
        if (this.state.taskDefId && this.state.remaining <= 0) {
          const done =
            ASSIGNMENTS[this.state.taskIndex ?? -1] ??
            ASSIGNMENTS.find((a) => a.defId === this.state.taskDefId);
          if (done) {
            d.skills.grantXp("skill.slaying", done.xp);
            if (d.inventory.canAdd("item.coin", done.coins)) {
              d.inventory.add("item.coin", done.coins);
              d.events.emit({ type: "itemGained", itemId: "item.coin", qty: done.coins });
              d.events.emit({ type: "inventoryChanged" });
            }
            d.events.emit({ type: "slayerTaskComplete", xp: done.xp, coins: done.coins });
          }
          this.state.taskDefId = null;
          this.state.tasksDone += 1;
        }
        if (!this.state.taskDefId) {
          const index = this.nextAssignmentIndex();
          const next = ASSIGNMENTS[index];
          this.state.taskDefId = next.defId;
          this.state.taskIndex = index;
          this.state.remaining = next.baseCount + Math.floor(this.state.tasksDone / 2);
          d.events.emit({
            type: "slayerTaskAssigned",
            enemyName: ENEMIES[next.defId].name,
            count: this.state.remaining,
          });
        } else if (this.state.remaining > 0) {
          d.events.emit({
            type: "slayerTaskProgress",
            enemyName: ENEMIES[this.state.taskDefId].name,
            remaining: this.state.remaining,
          });
        }
      }
    }
  }
}

/** Donation values: what each relic teaches, and the collection roster. */
const RELIC_XP: Record<string, number> = {
  "item.relic.shard": 8,
  "item.relic.idol": 45,
  "item.relic.urn": 60,
  "item.relic.coin": 55,
  "item.relic.tablet": 90,
  "item.relic.mask": 130,
};
/** Distinct pieces the museum wants one of each (shards are too common to count). */
const COLLECTION = ["item.relic.idol", "item.relic.urn", "item.relic.coin", "item.relic.tablet", "item.relic.mask"];
const COLLECTION_REWARD_COINS = 250;
const COLLECTION_REWARD_XP = 400;

export class CuratorService {
  /** Relic types donated at least once (persisted). */
  donated = new Set<string>();
  /** Two-tap confirm: the first chat offers, the second actually donates —
   *  the curator no longer sweeps relics out of your pack unannounced. */
  private offerArmed = false;

  constructor(
    private deps: {
      events: SimEventBus;
      skills: SkillService;
      inventory: Inventory;
    },
  ) {}

  process(events: SimEvent[]): void {
    const d = this.deps;
    for (const ev of events) {
      if (ev.type !== "npcChat" || ev.instanceId !== CURATOR_NPC_ID) continue;
      const carried = Object.keys(RELIC_XP).reduce((n, id) => n + d.inventory.count(id), 0);
      if (carried === 0) {
        this.offerArmed = false;
        continue;
      }
      if (!this.offerArmed) {
        this.offerArmed = true;
        d.events.emit({ type: "relicOffer", count: carried });
        continue;
      }
      this.offerArmed = false;
      const alreadyComplete = COLLECTION.every((id) => this.donated.has(id));
      for (const itemId of Object.keys(RELIC_XP)) {
        const qty = d.inventory.count(itemId);
        if (qty <= 0) continue;
        d.inventory.removeItemById(itemId, qty);
        const firstOfKind = !this.donated.has(itemId) && COLLECTION.includes(itemId);
        this.donated.add(itemId);
        const xp = RELIC_XP[itemId] * qty + (firstOfKind ? 50 : 0);
        d.skills.grantXp("skill.archaeology", xp);
        d.events.emit({ type: "relicDonated", itemId, qty, xp, firstOfKind });
        d.events.emit({ type: "inventoryChanged" });
      }
      // Completing the roster pays out once.
      if (!alreadyComplete && COLLECTION.every((id) => this.donated.has(id))) {
        d.skills.grantXp("skill.archaeology", COLLECTION_REWARD_XP);
        if (d.inventory.canAdd("item.coin", COLLECTION_REWARD_COINS)) {
          d.inventory.add("item.coin", COLLECTION_REWARD_COINS);
          d.events.emit({ type: "itemGained", itemId: "item.coin", qty: COLLECTION_REWARD_COINS });
        }
        d.events.emit({ type: "relicCollectionComplete", coins: COLLECTION_REWARD_COINS });
      }
    }
  }
}

// Item names are handy for HUD toasts built off these events.
export { ITEMS };
