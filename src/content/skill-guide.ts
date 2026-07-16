// Skill guide: for any skill, the full list of things that train it and the
// level each unlocks at. Joins the scattered content tables (resource nodes,
// recipes, build sites, agility shortcuts, slayer assignments, combat) into
// one player-facing ladder. Pure data — the HUD renders it when a skill row
// is clicked.

import { ASSIGNMENTS } from "../sim/taskmasters";
import { ALCHEMY, ENEMIES, ITEMS, NODES, OBJECTS, RECIPES, SKILLS, SUPERHEAT } from "./content";

export interface SkillActivity {
  /** What you do it to (tree name, recipe name, obstacle, monster tier). */
  name: string;
  /** Level required to attempt it. */
  level: number;
  /** XP per success (0 when the XP is variable, e.g. per point of damage). */
  xp: number;
  /** Short verb/category, e.g. "Chop", "Smith", "Climb". */
  verb: string;
  /** Where in the world to find it. */
  where: string;
}

// Verb per gathering skill, keyed by the node's skillId.
const NODE_VERB: Record<string, string> = {
  "skill.woodcutting": "Chop",
  "skill.mining": "Mine",
  "skill.fishing": "Fish",
  "skill.foraging": "Forage",
  "skill.herblore": "Gather",
  "skill.farming": "Harvest",
  "skill.archaeology": "Excavate",
  "skill.hunting": "Trap",
  "skill.thieving": "Steal",
};

// Where each gathering skill's nodes are found.
const NODE_WHERE: Record<string, string> = {
  "skill.woodcutting": "Forests, groves & wilds",
  "skill.mining": "Rocky ground, cliffs & mineshafts",
  "skill.fishing": "Rivers, lakes, coasts & ice",
  "skill.foraging": "Bushes across the meadows",
  "skill.herblore": "Herb patches across the biomes",
  "skill.farming": "Farm plots & wild fields",
  "skill.archaeology": "Dig sites & old foundations",
  "skill.hunting": "Game trails in grassland & moor",
  "skill.thieving": "Market stalls & locked strongboxes",
};

// Workstation each crafting skill is worked at.
const STATION_WHERE: Record<string, string> = {
  "skill.cooking": "Campfire",
  "skill.smelting": "Furnace",
  "skill.smithing": "Anvil",
  "skill.crafting": "Workbench",
  "skill.brewing": "Cauldron",
  "skill.enchanting": "Enchanter's table",
  "skill.herblore": "Campfire",
  "skill.boating": "Workbench",
  "skill.fletching": "Workbench",
  "skill.runecrafting": "Arcane Altar",
  "skill.summoning": "Summoning Obelisk",
  "skill.invention": "Workbench",
  "skill.construction": "Carpenter's Bench",
};

const STATION_VERB: Record<string, string> = {
  "skill.cooking": "Cook",
  "skill.smelting": "Smelt",
  "skill.smithing": "Smith",
  "skill.crafting": "Craft",
  "skill.brewing": "Brew",
  "skill.enchanting": "Enchant",
  "skill.herblore": "Brew",
  "skill.boating": "Build",
  "skill.fletching": "Fletch",
  "skill.runecrafting": "Bind",
  "skill.summoning": "Summon",
  "skill.invention": "Invent",
  "skill.construction": "Build",
};

/** Every activity that trains a skill, sorted by unlock level then name. */
export function skillActivities(skillId: string): SkillActivity[] {
  const acts: SkillActivity[] = [];

  // Resource nodes (gathering, fishing, farming, herb/dig/trail/thieving).
  for (const node of Object.values(NODES)) {
    if (node.skillId !== skillId) continue;
    const plant = node.plantable;
    acts.push({
      name: node.name,
      level: node.requiredLevel,
      xp: node.xpPerCycle,
      verb: NODE_VERB[skillId] ?? "Gather",
      where: plant
        ? `Plant & harvest — ${NODE_WHERE[skillId] ?? "in the world"}`
        : NODE_WHERE[skillId] ?? "In the world",
    });
  }

  // Recipes at workstations (cooking, smelting, smithing, crafting, brewing,
  // enchanting, herblore, boating).
  for (const recipe of Object.values(RECIPES)) {
    if (recipe.skillId !== skillId) continue;
    acts.push({
      name: recipe.name,
      level: recipe.requiredLevel,
      xp: recipe.xp,
      verb: STATION_VERB[skillId] ?? "Make",
      where: STATION_WHERE[skillId] ?? "At a workstation",
    });
  }

  // Firemaking: lighting logs from the pack (no node or workstation).
  if (skillId === "skill.firemaking") {
    for (const item of Object.values(ITEMS)) {
      if (!item.firemaking) continue;
      acts.push({
        name: item.name,
        level: item.firemaking.level,
        xp: item.firemaking.xp,
        verb: "Light",
        where: "Anywhere — light a log from your pack",
      });
    }
  }

  // Prayer: burying bones dropped by beasts and the undead.
  if (skillId === "skill.prayer") {
    for (const item of Object.values(ITEMS)) {
      if (!item.prayer) continue;
      acts.push({
        name: item.name,
        level: item.prayer.level,
        xp: item.prayer.xp,
        verb: "Bury",
        where: "Anywhere — bury bones from your pack",
      });
    }
  }

  // Magic: alchemy spells that turn goods into gold, burning a rune.
  if (skillId === "skill.magic") {
    acts.push({
      name: "Low Alchemy", level: ALCHEMY.low.level, xp: ALCHEMY.low.xp,
      verb: "Cast", where: "On a pack item — burns a Blaze Rune",
    });
    acts.push({
      name: "High Alchemy", level: ALCHEMY.high.level, xp: ALCHEMY.high.xp,
      verb: "Cast", where: "On a pack item — burns a Wart Rune, more coin",
    });
    acts.push({
      name: "Superheat", level: SUPERHEAT.level, xp: SUPERHEAT.magicXp,
      verb: "Cast", where: "On an ore — smelts it to a bar, burns a Blaze Rune",
    });
    acts.push({
      name: "Grand Alchemy", level: ALCHEMY.grand.level, xp: ALCHEMY.grand.xp,
      verb: "Cast", where: "On a pack item — burns an Ender Rune, richest coin",
    });
  }

  // Strength: melee damage trains it (no level gate).
  if (skillId === "skill.strength") {
    acts.push({
      name: "Hit hard in melee", level: 1, xp: 0,
      verb: "Fight", where: "Any melee fight — trains off damage dealt",
    });
  }

  // Constitution: dealing damage tempers it, and raises max HP.
  if (skillId === "skill.constitution") {
    acts.push({
      name: "Deal damage in combat", level: 1, xp: 0,
      verb: "Fight", where: "Any fight — every point of damage raises max HP",
    });
  }

  // Dungeoneering: felling dungeon bosses and their elite guards.
  if (skillId === "skill.dungeoneering") {
    acts.push({
      name: "Clear dungeon bosses & elites", level: 1, xp: 0,
      verb: "Delve", where: "Dungeon boss chambers — deeper floors pay more",
    });
  }

  // Necromancy: putting down the undead.
  if (skillId === "skill.necromancy") {
    acts.push({
      name: "Slay the undead", level: 1, xp: 0,
      verb: "Channel", where: "Skeletons, zombies, husks & wights",
    });
  }

  // World objects: build sites (construction) and agility shortcuts.
  for (const obj of Object.values(OBJECTS)) {
    if (skillId === "skill.construction" && obj.buildSkillId === skillId && obj.buildXp) {
      acts.push({
        name: obj.name,
        level: 1,
        xp: obj.buildXp,
        verb: "Build",
        where: "Construction sites in the world",
      });
    }
    if (skillId === "skill.agility" && obj.shortcut) {
      acts.push({
        name: obj.name,
        level: obj.shortcut.level,
        xp: obj.shortcut.xp,
        verb: "Cross",
        where: "Shortcut obstacles across the terrain",
      });
    }
  }

  // Slayer assignments (slaying).
  if (skillId === "skill.slaying") {
    for (const a of ASSIGNMENTS) {
      const foe = ENEMIES[a.defId];
      acts.push({
        name: `${foe?.name ?? a.defId} contract`,
        level: a.minLevel,
        xp: a.xp,
        verb: "Slay",
        where: "Warden Brusk (Greenvale taskmaster)",
      });
    }
  }

  // Combat skills have no per-activity level gate: XP scales with damage.
  if (skillId === "skill.attack" || skillId === "skill.archery") {
    acts.push({
      name: skillId === "skill.archery" ? "Shoot monsters (bow equipped)" : "Strike monsters in melee",
      level: 1,
      xp: 0,
      verb: "Fight",
      where: "Wilds, dark biomes & dungeons — 4 XP per point of damage",
    });
  }
  if (skillId === "skill.defense") {
    acts.push({
      name: "Survive blows in combat",
      level: 1,
      xp: 0,
      verb: "Block",
      where: "Any fight — 4 XP per point of damage taken",
    });
  }

  acts.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  return acts;
}

/** The highest unlock level among a skill's activities (its content ceiling). */
export function skillCeiling(skillId: string): number {
  const acts = skillActivities(skillId);
  return acts.reduce((m, a) => Math.max(m, a.level), 0);
}

/** All skill ids, in their defined order. */
export function skillIds(): string[] {
  return Object.keys(SKILLS);
}
