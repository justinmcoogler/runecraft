// Tutorial lesson script — ONE ordered, all-required track. The newcomer tours
// the vale doing a lesson for every skill in a logical progression (Basics →
// Gathering → Processing → Spiritual → Combat); the graduation gateway opens
// only when the last lesson is done. Each lesson reuses an activity that already
// exists in the sim: the tutorial places the target (spread across the vale),
// grants any reagent when the lesson begins, drives a guided objective, and
// rewards a small item + XP on completion.

export type LessonTrigger =
  | { kind: "reachGuide" }                       // walk adjacent to the guide
  | { kind: "logGained" }                        // a woodcutting log enters the pack
  | { kind: "logBurned" }                        // firemaking: a log is lit
  | { kind: "bonesBuried" }                      // prayer: bones buried
  | { kind: "enemyDefeated" }                    // combat: a foe falls
  | { kind: "itemPrefix"; prefix: string }       // any item with this id prefix is gained
  | { kind: "skillXp"; skillId: string }         // XP is earned in this skill
  | { kind: "eventType"; eventType: string };    // any event of this type fires

export interface TutorialLesson {
  id: string;
  /** Act it belongs to (Basics/Gathering/Processing/Spiritual/Combat). */
  act: string;
  /** Skill trained, for the objective icon (undefined for pure movement). */
  skillId?: string;
  title: string;
  blurb: string;
  /** Instance id of the placed prop the objective points at (waypoint beacon). */
  markerId?: string;
  /** Reagents dropped into the pack (silently) when this lesson begins. */
  grant?: Array<{ itemId: string; qty: number }>;
  /** How the sim detects completion. */
  trigger: LessonTrigger;
  /** Granted on completion — a small item + XP. */
  reward: { items?: Array<{ itemId: string; qty: number }>; xp?: { skillId: string; amount: number } };
}

const coin = (n: number) => [{ itemId: "item.coin", qty: n }];

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  // ── Act 1 · Basics ──────────────────────────────────────────────────────
  {
    id: "tut.move", act: "Basics",
    title: "Meet your guide",
    blurb: "Left-click the ground to walk. Go to the guide by the camp.",
    markerId: "tutorial.guide",
    trigger: { kind: "reachGuide" },
    reward: { items: coin(15), xp: { skillId: "skill.agility", amount: 20 } },
  },

  // ── Act 2 · Gathering ───────────────────────────────────────────────────
  {
    id: "tut.chop", act: "Gathering", skillId: "skill.woodcutting",
    title: "Chop a tree",
    blurb: "Click the marked tree to fell a log with your axe.",
    markerId: "tutorial.tree",
    trigger: { kind: "logGained" },
    reward: { items: coin(10), xp: { skillId: "skill.woodcutting", amount: 40 } },
  },
  {
    id: "tut.mine", act: "Gathering", skillId: "skill.mining",
    title: "Mine some ore",
    blurb: "Swing the pickaxe at the copper rock on the crag.",
    markerId: "tutorial.rock",
    grant: [{ itemId: "tool.pickaxe.basic", qty: 1 }],
    trigger: { kind: "itemPrefix", prefix: "item.ore." },
    reward: { items: coin(10), xp: { skillId: "skill.mining", amount: 40 } },
  },
  {
    id: "tut.forage", act: "Gathering", skillId: "skill.foraging",
    title: "Forage a berry",
    blurb: "Pick the berry bush by hand — no tool needed.",
    markerId: "tutorial.bush",
    trigger: { kind: "itemPrefix", prefix: "item.berry." },
    reward: { items: coin(10), xp: { skillId: "skill.foraging", amount: 30 } },
  },
  {
    id: "tut.herb", act: "Gathering", skillId: "skill.herblore",
    title: "Gather a herb",
    blurb: "Pick the wild sage growing by the path.",
    markerId: "tutorial.herb",
    trigger: { kind: "skillXp", skillId: "skill.herblore" },
    reward: { items: coin(10), xp: { skillId: "skill.herblore", amount: 30 } },
  },
  {
    id: "tut.hunt", act: "Gathering", skillId: "skill.hunting",
    title: "Set a trap",
    blurb: "Lay your box trap on the game trail to catch prey.",
    markerId: "tutorial.trail",
    grant: [{ itemId: "tool.trap.basic", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.hunting" },
    reward: { items: coin(10), xp: { skillId: "skill.hunting", amount: 30 } },
  },
  {
    id: "tut.fish", act: "Gathering", skillId: "skill.fishing",
    title: "Catch a fish",
    blurb: "Fish the pond from the bank with your rod.",
    markerId: "tutorial.fishing",
    grant: [{ itemId: "tool.fishingrod.basic", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.fishing" },
    reward: { items: coin(10), xp: { skillId: "skill.fishing", amount: 30 } },
  },
  {
    id: "tut.farm", act: "Gathering", skillId: "skill.farming",
    title: "Sow a seed",
    blurb: "Plant a wheat seed in the plot — it grows in time.",
    markerId: "tutorial.plot",
    grant: [{ itemId: "item.seed.wheat", qty: 2 }],
    trigger: { kind: "eventType", eventType: "planted" },
    reward: { items: coin(10), xp: { skillId: "skill.farming", amount: 30 } },
  },
  {
    id: "tut.thieve", act: "Gathering", skillId: "skill.thieving",
    title: "Pick a pocket",
    blurb: "Pilfer from the market stall — mind you don't get caught.",
    markerId: "tutorial.stall",
    trigger: { kind: "skillXp", skillId: "skill.thieving" },
    reward: { items: coin(10), xp: { skillId: "skill.thieving", amount: 30 } },
  },
  {
    id: "tut.dig", act: "Gathering", skillId: "skill.archaeology",
    title: "Excavate a relic",
    blurb: "Dig at the excavation site to unearth something old.",
    markerId: "tutorial.digsite",
    trigger: { kind: "skillXp", skillId: "skill.archaeology" },
    reward: { items: coin(10), xp: { skillId: "skill.archaeology", amount: 30 } },
  },

  // ── Act 3 · Processing ──────────────────────────────────────────────────
  {
    id: "tut.fire", act: "Processing", skillId: "skill.firemaking",
    title: "Light a fire",
    blurb: "Open your pack (I) and use a log to set a campfire ablaze.",
    grant: [{ itemId: "item.log.basic", qty: 1 }],
    trigger: { kind: "logBurned" },
    reward: { items: coin(10), xp: { skillId: "skill.firemaking", amount: 40 } },
  },
  {
    id: "tut.cook", act: "Processing", skillId: "skill.cooking",
    title: "Cook a meal",
    blurb: "Cook the raw fish on the campfire.",
    markerId: "tutorial.campfire",
    grant: [{ itemId: "item.fish.raw", qty: 2 }],
    trigger: { kind: "skillXp", skillId: "skill.cooking" },
    reward: { items: coin(10), xp: { skillId: "skill.cooking", amount: 30 } },
  },
  {
    id: "tut.smelt", act: "Processing", skillId: "skill.smelting",
    title: "Smelt a bronze bar",
    blurb: "At the furnace, smelt copper + tin into a bronze bar.",
    markerId: "tutorial.furnace",
    grant: [{ itemId: "item.ore.copper", qty: 2 }, { itemId: "item.ore.tin", qty: 2 }],
    trigger: { kind: "itemPrefix", prefix: "item.bar." },
    reward: { items: coin(10), xp: { skillId: "skill.smelting", amount: 40 } },
  },
  {
    id: "tut.smith", act: "Processing", skillId: "skill.smithing",
    title: "Forge at the anvil",
    blurb: "Hammer a bronze bar into a blade at the anvil.",
    markerId: "tutorial.anvil",
    grant: [{ itemId: "item.bar.bronze", qty: 1 }, { itemId: "tool.hammer.basic", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.smithing" },
    reward: { items: coin(10), xp: { skillId: "skill.smithing", amount: 30 } },
  },
  {
    id: "tut.craft", act: "Processing", skillId: "skill.crafting",
    title: "Craft at the bench",
    blurb: "At the workbench, cut a log into planks.",
    markerId: "tutorial.workbench",
    grant: [{ itemId: "item.log.basic", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.crafting" },
    reward: { items: coin(10), xp: { skillId: "skill.crafting", amount: 30 } },
  },
  {
    id: "tut.fletch", act: "Processing", skillId: "skill.fletching",
    title: "Fletch arrow shafts",
    blurb: "At the workbench, carve a log into arrow shafts.",
    markerId: "tutorial.workbench",
    grant: [{ itemId: "item.log.basic", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.fletching" },
    reward: { items: coin(10), xp: { skillId: "skill.fletching", amount: 30 } },
  },
  {
    id: "tut.invent", act: "Processing", skillId: "skill.invention",
    title: "Salvage for parts",
    blurb: "At the workbench, salvage the iron bar into components.",
    markerId: "tutorial.workbench",
    grant: [{ itemId: "item.bar.iron", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.invention" },
    reward: { items: coin(10), xp: { skillId: "skill.invention", amount: 30 } },
  },
  {
    id: "tut.construct", act: "Processing", skillId: "skill.construction",
    title: "Raise the ramp",
    blurb: "Build the marked ramp from your bricks and planks.",
    markerId: "tutorial.buildsite",
    grant: [{ itemId: "item.brick.stone", qty: 6 }, { itemId: "item.plank.cut", qty: 4 }],
    trigger: { kind: "skillXp", skillId: "skill.construction" },
    reward: { items: coin(10), xp: { skillId: "skill.construction", amount: 30 } },
  },

  // ── Act 4 · Spiritual ───────────────────────────────────────────────────
  {
    id: "tut.pray", act: "Spiritual", skillId: "skill.prayer",
    title: "Honour the fallen",
    blurb: "Bury the bones in your pack to earn Prayer.",
    grant: [{ itemId: "item.bone.old", qty: 1 }],
    trigger: { kind: "bonesBuried" },
    reward: { items: coin(10), xp: { skillId: "skill.prayer", amount: 30 } },
  },
  {
    id: "tut.rune", act: "Spiritual", skillId: "skill.runecrafting",
    title: "Bind a rune",
    blurb: "At the rune altar, bind essence into a rune.",
    markerId: "tutorial.altar",
    grant: [{ itemId: "item.essence.rune", qty: 5 }],
    trigger: { kind: "skillXp", skillId: "skill.runecrafting" },
    reward: { items: coin(10), xp: { skillId: "skill.runecrafting", amount: 40 } },
  },
  {
    id: "tut.magic", act: "Spiritual", skillId: "skill.magic",
    title: "Cast a spell",
    blurb: "Open your pack and low-alch a log with your fire rune for coins.",
    grant: [{ itemId: "item.rune.fire", qty: 5 }, { itemId: "item.log.basic", qty: 1 }],
    trigger: { kind: "eventType", eventType: "spellCast" },
    reward: { items: coin(10), xp: { skillId: "skill.magic", amount: 40 } },
  },
  {
    id: "tut.brew", act: "Spiritual", skillId: "skill.brewing",
    title: "Brew a potion",
    blurb: "At the cauldron, brew the sage and feather into a tonic.",
    markerId: "tutorial.cauldron",
    grant: [{ itemId: "item.herb.sage", qty: 1 }, { itemId: "item.feather", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.brewing" },
    reward: { items: coin(10), xp: { skillId: "skill.brewing", amount: 30 } },
  },
  {
    id: "tut.enchant", act: "Spiritual", skillId: "skill.enchanting",
    title: "Enchant a tool",
    blurb: "At the enchanter, rune your iron axe with the idol's power.",
    markerId: "tutorial.enchanter",
    grant: [{ itemId: "tool.axe.iron", qty: 1 }, { itemId: "item.relic.idol", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.enchanting" },
    reward: { items: coin(10), xp: { skillId: "skill.enchanting", amount: 30 } },
  },
  {
    id: "tut.summon", act: "Spiritual", skillId: "skill.summoning",
    title: "Bind a familiar",
    blurb: "At the summoning obelisk, bind a charm and essence into a spirit pouch.",
    markerId: "tutorial.obelisk",
    grant: [{ itemId: "item.charm.bone", qty: 1 }, { itemId: "item.essence.rune", qty: 3 }],
    trigger: { kind: "skillXp", skillId: "skill.summoning" },
    reward: { items: coin(10), xp: { skillId: "skill.summoning", amount: 30 } },
  },

  // ── Act 5 · Combat & movement ───────────────────────────────────────────
  {
    id: "tut.fight", act: "Combat", skillId: "skill.attack",
    title: "Stand your ground",
    blurb: "Click the sparring foe to attack. Trade blows until it falls.",
    markerId: "tutorial.foe",
    trigger: { kind: "enemyDefeated" },
    reward: { items: coin(20), xp: { skillId: "skill.attack", amount: 40 } },
  },
  {
    id: "tut.archery", act: "Combat", skillId: "skill.archery",
    title: "Loose an arrow",
    blurb: "Equip the shortbow and shoot the second foe from range.",
    markerId: "tutorial.foe2",
    grant: [{ itemId: "tool.bow.wood", qty: 1 }, { itemId: "item.arrow.bronze", qty: 15 }],
    trigger: { kind: "skillXp", skillId: "skill.archery" },
    reward: { items: coin(10), xp: { skillId: "skill.archery", amount: 30 } },
  },
  {
    id: "tut.necro", act: "Combat", skillId: "skill.necromancy",
    title: "Down the undead",
    blurb: "Defeat the risen skeleton to channel Necromancy.",
    markerId: "tutorial.undead",
    trigger: { kind: "skillXp", skillId: "skill.necromancy" },
    reward: { items: coin(10), xp: { skillId: "skill.necromancy", amount: 30 } },
  },
  {
    id: "tut.dungeon", act: "Combat", skillId: "skill.dungeoneering",
    title: "Best the champion",
    blurb: "Fell the training champion to learn Dungeoneering.",
    markerId: "tutorial.boss",
    trigger: { kind: "skillXp", skillId: "skill.dungeoneering" },
    reward: { items: coin(10), xp: { skillId: "skill.dungeoneering", amount: 30 } },
  },
  {
    id: "tut.slay", act: "Combat", skillId: "skill.slaying",
    title: "Take a bounty",
    blurb: "Speak to Warden Brusk to take a slayer assignment.",
    markerId: "village.npc.brusk",
    trigger: { kind: "eventType", eventType: "slayerTaskAssigned" },
    reward: { items: coin(10), xp: { skillId: "skill.slaying", amount: 30 } },
  },
  {
    id: "tut.agility", act: "Combat", skillId: "skill.agility",
    title: "Take the shortcut",
    blurb: "Cross the fallen log to train Agility.",
    markerId: "tutorial.shortcut",
    trigger: { kind: "eventType", eventType: "shortcutUsed" },
    reward: { items: coin(10), xp: { skillId: "skill.agility", amount: 30 } },
  },
  {
    id: "tut.boat", act: "Combat", skillId: "skill.boating",
    title: "Paddle a raft",
    blurb: "Launch your raft and paddle out onto the pond.",
    markerId: "tutorial.fishing",
    grant: [{ itemId: "tool.boat.raft", qty: 1 }],
    trigger: { kind: "skillXp", skillId: "skill.boating" },
    reward: { items: coin(20), xp: { skillId: "skill.boating", amount: 30 } },
  },
];

/** Instance ids the tutorial region places for the movement lesson + markers. */
export const TUTORIAL_GUIDE_ID = "tutorial.guide";
