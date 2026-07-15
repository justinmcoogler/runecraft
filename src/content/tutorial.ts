// Tutorial lesson script — the required core, one lesson per act, in logical
// order (locked in docs/QUEST_PLAN.md). Each lesson reuses an activity that
// already exists in the sim; the tutorial only places the target, grants any
// reagent, drives a guided objective, and rewards a small item + XP on
// completion. Finishing the last lesson opens the graduation gateway.

export type LessonTrigger =
  | { kind: "reachGuide" }        // walk adjacent to the guide
  | { kind: "logGained" }         // a woodcutting log enters the pack
  | { kind: "logBurned" }         // firemaking: a log is lit
  | { kind: "bonesBuried" }       // prayer: bones buried
  | { kind: "enemyDefeated" };    // combat: the sparring foe falls

export interface TutorialLesson {
  id: string;
  /** Act it represents (Basics/Gathering/Processing/Spiritual/Combat). */
  act: string;
  /** Skill trained, for the objective icon (undefined for pure movement). */
  skillId?: string;
  title: string;
  blurb: string;
  /** Which placed marker the objective points at, if any. */
  marker?: "guide" | "tree" | "foe";
  /** Reagents dropped into the pack when this lesson begins. */
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

/** Instance ids of the props the tutorial region places for these lessons. */
export const TUTORIAL_GUIDE_ID = "tutorial.guide";
export const TUTORIAL_TREE_ID = "tutorial.tree";
export const TUTORIAL_FOE_ID = "tutorial.foe";
