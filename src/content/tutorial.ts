// Tutorial lesson script — the required core, one lesson per act, in logical
// order (locked in docs/QUEST_PLAN.md). Each lesson reuses an activity that
// already exists in the sim; the tutorial only places the target, grants any
// reagent, drives a guided objective, and rewards a small item + XP on
// completion. Finishing the last lesson opens the graduation gateway.

export type LessonTrigger =
  | { kind: "reachGuide" }                       // walk adjacent to the guide
  | { kind: "logGained" }                        // a woodcutting log enters the pack
  | { kind: "logBurned" }                        // firemaking: a log is lit
  | { kind: "bonesBuried" }                      // prayer: bones buried
  | { kind: "enemyDefeated" }                    // combat: the sparring foe falls
  | { kind: "itemPrefix"; prefix: string }       // any item with this id prefix is gained
  | { kind: "skillXp"; skillId: string };        // XP is earned in this skill

export interface TutorialLesson {
  id: string;
  /** Act it represents (Basics/Gathering/Processing/Spiritual/Combat). */
  act: string;
  /** Skill trained, for the objective icon (undefined for pure movement). */
  skillId?: string;
  title: string;
  blurb: string;
  /** Optional lessons are bonus: done opportunistically, never gate graduation. */
  optional?: boolean;
  /** Which placed marker the objective points at, if any. */
  marker?: "guide" | "tree" | "foe";
  /** Reagents dropped into the pack when this lesson begins (required lessons). */
  grant?: Array<{ itemId: string; qty: number }>;
  /** How the sim detects completion. */
  trigger: LessonTrigger;
  /** Granted on completion — a small item and some XP (locked reward shape). */
  reward: { items?: Array<{ itemId: string; qty: number }>; xp?: { skillId: string; amount: number } };
}

export const TUTORIAL_LESSONS: TutorialLesson[] = [
  {
    id: "tut.move",
    act: "Basics",
    title: "Meet your guide",
    blurb: "Left-click the ground to walk. Go over to the guide waiting nearby.",
    marker: "guide",
    trigger: { kind: "reachGuide" },
    reward: { items: [{ itemId: "item.coin", qty: 15 }], xp: { skillId: "skill.agility", amount: 20 } },
  },
  {
    id: "tut.chop",
    act: "Gathering",
    skillId: "skill.woodcutting",
    title: "Chop a tree",
    blurb: "Click the marked tree to fell a log with your axe. Keep the log — you'll need it.",
    marker: "tree",
    trigger: { kind: "logGained" },
    reward: { items: [{ itemId: "item.coin", qty: 10 }], xp: { skillId: "skill.woodcutting", amount: 40 } },
  },
  {
    id: "tut.fire",
    act: "Processing",
    skillId: "skill.firemaking",
    title: "Light a fire",
    blurb: "Open your pack (I) and use the log to set a campfire ablaze.",
    trigger: { kind: "logBurned" },
    reward: { items: [{ itemId: "item.coin", qty: 10 }], xp: { skillId: "skill.firemaking", amount: 40 } },
  },
  {
    id: "tut.pray",
    act: "Spiritual",
    skillId: "skill.prayer",
    title: "Honour the fallen",
    blurb: "Bury the bones in your pack to earn Prayer.",
    grant: [{ itemId: "item.bone.old", qty: 1 }],
    trigger: { kind: "bonesBuried" },
    reward: { items: [{ itemId: "item.coin", qty: 10 }], xp: { skillId: "skill.prayer", amount: 30 } },
  },
  {
    id: "tut.fight",
    act: "Combat",
    skillId: "skill.attack",
    title: "Stand your ground",
    blurb: "Click the sparring foe to attack. Trade blows until it falls.",
    marker: "foe",
    trigger: { kind: "enemyDefeated" },
    reward: { items: [{ itemId: "item.coin", qty: 25 }], xp: { skillId: "skill.attack", amount: 40 } },
  },
];

// Optional bonus lessons — one more skill per act, completed opportunistically
// whenever the player tries the activity at the station the vale provides. They
// never gate graduation; finishing one just pays a small item + XP. The reagents
// they need are in the silent starter kit below, so a station is usable anytime.
export const TUTORIAL_OPTIONAL: TutorialLesson[] = [
  {
    id: "tut.mine",
    act: "Gathering",
    skillId: "skill.mining",
    optional: true,
    title: "Mine some ore",
    blurb: "Swing your pickaxe at the copper rock.",
    trigger: { kind: "itemPrefix", prefix: "item.ore." },
    reward: { items: [{ itemId: "item.coin", qty: 10 }], xp: { skillId: "skill.mining", amount: 40 } },
  },
  {
    id: "tut.forage",
    act: "Gathering",
    skillId: "skill.foraging",
    optional: true,
    title: "Forage a berry",
    blurb: "Pick the berry bush by hand — no tool needed.",
    trigger: { kind: "itemPrefix", prefix: "item.berry." },
    reward: { items: [{ itemId: "item.coin", qty: 10 }], xp: { skillId: "skill.foraging", amount: 30 } },
  },
  {
    id: "tut.smelt",
    act: "Processing",
    skillId: "skill.smelting",
    optional: true,
    title: "Smelt a bronze bar",
    blurb: "At the furnace, smelt copper + tin into a bronze bar.",
    trigger: { kind: "itemPrefix", prefix: "item.bar." },
    reward: { items: [{ itemId: "item.coin", qty: 10 }], xp: { skillId: "skill.smelting", amount: 40 } },
  },
  {
    id: "tut.smith",
    act: "Processing",
    skillId: "skill.smithing",
    optional: true,
    title: "Forge at the anvil",
    blurb: "Hammer a bronze bar into a blade at the anvil.",
    trigger: { kind: "skillXp", skillId: "skill.smithing" },
    reward: { items: [{ itemId: "item.coin", qty: 10 }], xp: { skillId: "skill.smithing", amount: 30 } },
  },
  {
    id: "tut.rune",
    act: "Spiritual",
    skillId: "skill.runecrafting",
    optional: true,
    title: "Bind a rune",
    blurb: "At the rune altar, bind essence into a rune.",
    trigger: { kind: "skillXp", skillId: "skill.runecrafting" },
    reward: { items: [{ itemId: "item.coin", qty: 10 }], xp: { skillId: "skill.runecrafting", amount: 40 } },
  },
];

// Granted silently at the start of the tutorial (no itemGained event, so it
// never trips an optional lesson) — the tools + raw materials the optional
// stations need. The player still earns the XP by doing the activity.
export const TUTORIAL_STARTER_KIT: Array<{ itemId: string; qty: number }> = [
  { itemId: "tool.pickaxe.basic", qty: 1 },
  { itemId: "tool.hammer.basic", qty: 1 },
  { itemId: "item.ore.copper", qty: 3 },
  { itemId: "item.ore.tin", qty: 3 },
  { itemId: "item.bar.bronze", qty: 1 },
  { itemId: "item.essence.rune", qty: 5 },
];

/** Instance ids of the props the tutorial region places for these lessons. */
export const TUTORIAL_GUIDE_ID = "tutorial.guide";
export const TUTORIAL_TREE_ID = "tutorial.tree";
export const TUTORIAL_FOE_ID = "tutorial.foe";
