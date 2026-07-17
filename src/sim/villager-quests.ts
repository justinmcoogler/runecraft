// Procedural errands from village and homestead folk. Every skill-home
// resident (the `end.<cx>.<cz>[.prK].res` NPCs the endless world streams in)
// offers one small quest, generated deterministically from the world seed and
// their instance id — so the same villager always wants the same thing, across
// sessions and saves. Errands ride the ordinary QuestService machinery:
// deliver/slay/talk objectives, xp + coin rewards, quest-log + helper for free.

import type { QuestDef } from "../content/content";
import type { NpcPlacement } from "./types";
import { remoteness01 } from "./worldgen/endless";

export const VILLAGER_QUEST_PREFIX = "vq.";
/** At most this many villager errands may be active at once. */
export const MAX_ACTIVE_VILLAGER_QUESTS = 3;

export function villagerQuestId(npcInstanceId: string): string {
  return `${VILLAGER_QUEST_PREFIX}${npcInstanceId}`;
}

/** Endless-world skill-home residents are the errand givers. */
export function isErrandGiver(npcInstanceId: string): boolean {
  return /^end\.-?\d+\.-?\d+\.(?:pr\d+\.)?res$/.test(npcInstanceId);
}

function hash01(s: string, saltN: number): number {
  let h = 2166136261 ^ saltN;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

interface GatherSpec { itemId: string; qty: [number, number]; skillId: string; noun: string }
interface SlaySpec { defId: string; qty: [number, number]; noun: string }

// Wanted goods climb with distance from home, tracking what actually grows,
// swims and lurks at that remoteness (the gathering ladders gate the same way).
const GATHER_TIERS: GatherSpec[][] = [
  [
    { itemId: "item.log.basic", qty: [6, 10], skillId: "skill.woodcutting", noun: "oak logs" },
    { itemId: "item.fish.raw", qty: [4, 7], skillId: "skill.fishing", noun: "fresh fish" },
    { itemId: "item.ore.copper", qty: [5, 8], skillId: "skill.mining", noun: "copper ore" },
  ],
  [
    { itemId: "item.log.spruce", qty: [6, 9], skillId: "skill.woodcutting", noun: "spruce logs" },
    { itemId: "item.ore.tin", qty: [5, 8], skillId: "skill.mining", noun: "tin ore" },
    { itemId: "item.herb.sage", qty: [3, 5], skillId: "skill.herblore", noun: "sprigs of sage" },
  ],
  [
    { itemId: "item.log.birch", qty: [6, 9], skillId: "skill.woodcutting", noun: "birch logs" },
    { itemId: "item.ore.iron", qty: [4, 7], skillId: "skill.mining", noun: "iron ore" },
    { itemId: "item.herb.mint", qty: [3, 5], skillId: "skill.herblore", noun: "bundles of mint" },
  ],
  [
    { itemId: "item.ore.coal", qty: [4, 7], skillId: "skill.mining", noun: "lumps of coal" },
    { itemId: "item.hide.wolf", qty: [2, 4], skillId: "skill.hunting", noun: "wolf hides" },
    { itemId: "item.herb.duskcap", qty: [3, 5], skillId: "skill.herblore", noun: "duskcap mushrooms" },
  ],
];

const CRAFT_SPECS: GatherSpec[] = [
  { itemId: "item.bread.basic", qty: [2, 4], skillId: "skill.cooking", noun: "loaves of bread" },
  { itemId: "item.stew.carrot", qty: [1, 2], skillId: "skill.cooking", noun: "bowls of carrot stew" },
];

const SLAY_TIERS: SlaySpec[][] = [
  [{ defId: "enemy.spider", qty: [3, 5], noun: "spiders" }],
  [{ defId: "enemy.timber_wolf", qty: [3, 5], noun: "timber wolves" },
    { defId: "enemy.boar", qty: [3, 4], noun: "wild boars" }],
  [{ defId: "enemy.bog_slime", qty: [3, 5], noun: "bog slimes" },
    { defId: "enemy.cave_spider", qty: [3, 5], noun: "cave spiders" }],
  [{ defId: "enemy.dire_wolf", qty: [2, 4], noun: "dire wolves" },
    { defId: "enemy.mire_husk", qty: [3, 4], noun: "mire husks" }],
];

const span = (r: number, [lo, hi]: [number, number]): number => lo + Math.floor(r * (hi - lo + 1));

/** The one errand this resident offers, or null for non-givers. */
export function villagerQuestFor(seed: number, npc: NpcPlacement): QuestDef | null {
  if (!isErrandGiver(npc.instanceId)) return null;
  const key = `${seed}:${npc.instanceId}`;
  const tier = Math.min(GATHER_TIERS.length - 1, Math.floor(remoteness01(npc.cell.x, npc.cell.z) * 6));
  const id = villagerQuestId(npc.instanceId);
  const family = hash01(key, 1);
  const coins = 25 + tier * 45 + Math.floor(hash01(key, 2) * 30);

  if (family < 0.3) {
    // Slay: cull the local menace, then come back for thanks.
    const pool = SLAY_TIERS[Math.min(tier, SLAY_TIERS.length - 1)];
    const spec = pool[Math.floor(hash01(key, 3) * pool.length)];
    const qty = span(hash01(key, 4), spec.qty);
    return {
      id,
      name: `${npc.name}'s Trouble`,
      giverNpcId: npc.instanceId,
      giverCell: { ...npc.cell },
      giverName: npc.name,
      intro: `${spec.noun[0].toUpperCase()}${spec.noun.slice(1)} have been prowling too close. Cull ${qty} of them and I'll make it worth your while.`,
      reminder: `Those ${spec.noun} won't cull themselves — ${qty} of them, then come back to me.`,
      outro: `That's the countryside breathing easier. Take this.`,
      objectives: [
        { type: "slay", enemyDefId: spec.defId, qty, label: `Slay ${qty} ${spec.noun}` },
        { type: "talk", npcId: npc.instanceId, label: `Return to ${npc.name}` },
      ],
      rewards: {
        xp: [{ skillId: "skill.strength", amount: 35 + tier * 55 }],
        items: [{ itemId: "item.coin", qty: coins }],
      },
    };
  }

  // Gather or craft: bring the goods back to their door.
  const spec = family < 0.85
    ? (() => { const pool = GATHER_TIERS[tier]; return pool[Math.floor(hash01(key, 5) * pool.length)]; })()
    : CRAFT_SPECS[Math.floor(hash01(key, 6) * CRAFT_SPECS.length)];
  const qty = span(hash01(key, 7), spec.qty);
  return {
    id,
    name: `${npc.name}'s Errand`,
    giverNpcId: npc.instanceId,
    giverCell: { ...npc.cell },
    giverName: npc.name,
    intro: `Could you bring me ${qty} ${spec.noun}? There's coin in it for you.`,
    reminder: `Still after those ${spec.noun} — ${qty} should do it.`,
    outro: `Just what I needed. Here, as promised.`,
    objectives: [
      { type: "deliver", npcId: npc.instanceId, itemId: spec.itemId, qty, label: `Bring ${qty} ${spec.noun} to ${npc.name}` },
    ],
    rewards: {
      xp: [{ skillId: spec.skillId, amount: 30 + tier * 50 }],
      items: [{ itemId: "item.coin", qty: coins }],
    },
  };
}
