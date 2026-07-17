// Static content definitions — immutable, stable string IDs, no engine types.
// Gameplay code must reference these IDs, never display names or texture paths.

export interface XpCurveDef {
  id: string;
  base: number;
  exponent: number;
  linear: number;
}

export interface SkillDef {
  id: string;
  name: string;
  maxLevel: number;
  curveId: string;
  /** This skill was folded into another: XP routes there, UI hides it, and
   *  the def survives only so old content/lesson names keep resolving. */
  mergedInto?: string;
}

/**
 * Timed potion effects: speed (stride), strength (+melee damage),
 * stoneskin (damage soak), gathering (+gather success), focus
 * (+combat accuracy), regen (steady out-of-combat-style healing).
 */
export type BuffKind = "speed" | "strength" | "stoneskin" | "gathering" | "focus" | "regen";

export interface ItemDef {
  id: string;
  name: string;
  icon: string; // HUD glyph (placeholder art)
  stackable: boolean;
  maxStack: number;
  toolTags?: string[];
  /** Added to gather success chance when this tool satisfies the requirement. */
  successBonus?: number;
  /** Added to attack damage while equipped (weapons). */
  damageBonus?: number;
  /** Edible: tap in the inventory to restore this much HP. */
  healAmount?: number;
  /** Drinking applies a timed effect (see BuffKind for what each does). */
  buff?: { kind: BuffKind; durationS: number };
  /** Wearable: which armor slot this piece occupies. */
  armorSlot?: "head" | "body" | "legs" | "feet";
  /** Fraction of incoming damage prevented while worn (summed across pieces). */
  protection?: number;
  /** A boat: carrying it lets the player cross water. Faster hulls need a
   *  higher Mariner level to handle; the best usable one is auto-boarded. */
  boat?: { speed: number; level: number };
  /** A burnable log: lighting it in the pack trains Firemaking. */
  firemaking?: { level: number; xp: number };
  /** Bones: burying them in the pack trains Prayer. */
  prayer?: { level: number; xp: number };
  /** Spirit-mount reins (Summoning): tap to ride — stride multiplies by speed. */
  mount?: { speed: number };
  /** Necromancy rite: consuming it raises a minion that fights beside you. */
  minion?: { defId: string; durationS: number; dmg: number };
}

export interface DropEntry {
  itemId: string;
  min: number;
  max: number;
  weight: number;
}

export interface InteractionSpec {
  mode: "adjacent_4" | "adjacent_8";
  rangeCells: number;
}

export type NodeViewKind =
  | "tree"
  | "tree.grand"
  | "tree.darkoak"
  | "tree.spruce"
  | "tree.birch"
  | "tree.acacia"
  | "tree.jungle"
  | "rock"
  | "bush"
  | "pond"
  | "crop.wheat"
  | "crop.pumpkin"
  | "herb"
  | "digsite"
  | "trail"
  | "stall"
  | "strongbox"
  /** Imported structure visual (grand trees); placement carries structureId. */
  | "structure";

export interface ResourceNodeDef {
  id: string;
  name: string;
  skillId: string;
  requiredLevel: number;
  toolTagsAny: string[]; // empty = no tool required
  interaction: InteractionSpec;
  cycleTimeS: number;
  successBase: number;
  successPerLevel: number;
  successMax: number;
  xpPerCycle: number;
  drops: DropEntry[];
  /** false = inexhaustible (e.g. fishing spots): gathering runs until interrupted. */
  depletes: boolean;
  resourceMin: number;
  resourceMax: number;
  respawnS: number;
  blocksNav: boolean;
  view: NodeViewKind;
  /** Material override for rock-view nodes (e.g. tin vs copper flecks). */
  viewMaterial?: string;
  /**
   * Farm plot: starts empty (dormant); interacting with a seed in the
   * inventory plants it, and the node "respawns" into a harvestable crop
   * after growS. Harvesting empties the plot again.
   */
  plantable?: { seedItemId: string; growS: number; plantXp: number };
  /** Thieving: a failed cycle stings — the stallkeeper (or the trap) hits back. */
  failDamage?: number;
}

export interface WorldObjectDef {
  id: string;
  name: string;
  interaction: InteractionSpec;
  containerSlots?: number;
  /** Roll these into this container the first time it's created, instead of a
   *  fixed initialItems list — a lootable barrel/crate. */
  randomLoot?: Array<{ itemId: string; min: number; max: number; chance: number }>;
  /** Recipes offered when the player interacts with this object. */
  workstationRecipeIds?: string[];
  /** Interacting opens this shop's buy/sell sheet. */
  shopId?: string;
  /** Pure scenery: not clickable, just occupies its footprint. */
  scenery?: boolean;
  /** Construction site: materials consumed on interact to build it. */
  buildRequires?: Array<{ itemId: string; qty: number }>;
  buildSkillId?: string;
  buildXp?: number;
  /** World flag set when the build completes (site object is removed). */
  completionFlag?: string;
  /**
   * Agility shortcut: interacting hops the player to the placement's
   * portal targetCell (same region) when their Agility level suffices.
   */
  shortcut?: { level: number; xp: number };
  /**
   * A bed: interacting lies down, sets the player's respawn point to this
   * cell, and skips the night through to dawn.
   */
  sleepable?: boolean;
  /**
   * An enterable building: clicking it walks to the yard and steps into a
   * procedural interior room keyed by this id (see buildHouseInterior).
   */
  interiorId?: string;
  blocksNav: boolean;
}

export interface ShopDef {
  id: string;
  name: string;
  /** What the shop pays the player, per item. */
  buys: Record<string, number>;
  /** What the shop offers the player. */
  sells: Array<{ itemId: string; price: number }>;
}

export const CURVES: Record<string, XpCurveDef> = {
  "curve.standard": { id: "curve.standard", base: 90, exponent: 1.9, linear: 60 },
};

/**
 * Named world zones (world coordinates on the 512x512 map). The sim emits
 * zoneEntered when the player crosses into a different named zone; the
 * first matching rectangle wins, so list specific zones before broad ones.
 */
export interface ZoneDef {
  id: string;
  name: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** One-line flavor shown under the zone name on entry. */
  blurb: string;
}

// Zone rectangles mirror the province regions in sim/worldgen/regions.ts
// (specific zones listed before broad ones so nested hearts win).
export const ZONES: ZoneDef[] = [
  { id: "zone.greenvale.town", name: "Greenvale", x0: 1196, z0: 1321, x1: 1304, z1: 1429, blurb: "Every road in the province leads home." },
  { id: "zone.willowmere", name: "Willowmere", x0: 629, z0: 1379, x1: 701, z1: 1451, blurb: "A lantern-lit village on the mere." },
  { id: "zone.ironroot", name: "Ironroot Camp", x0: 1158, z0: 774, x1: 1222, z1: 826, blurb: "Where recruits become veterans." },
  { id: "zone.greenvale", name: "The Greenvale", x0: 950, z0: 975, x1: 1625, z1: 1775, blurb: "Meadows, farms and the king's peace." },
  { id: "zone.whisperwood", name: "The Whisperwood", x0: 110, z0: 925, x1: 950, z1: 1850, blurb: "Old timber, mist, and things that watch." },
  { id: "zone.highforge", name: "The Highforge Highlands", x0: 90, z0: 90, x1: 1065, z1: 975, blurb: "White stone and smoke over the hills." },
  { id: "zone.frostspine", name: "The Frostspine", x0: 1025, z0: 0, x1: 1650, z1: 650, blurb: "The frozen wall of the north." },
  { id: "zone.stonegate", name: "The Stonegate Reach", x0: 1515, z0: 390, x1: 2250, z1: 1115, blurb: "Caravans, tolls and river trade." },
  { id: "zone.sunscar", name: "The Sunscar Drylands", x0: 1865, z0: 975, x1: 2499, z1: 1800, blurb: "Red rock and one cold well." },
  { id: "zone.murkfen", name: "The Murkfen", x0: 750, z0: 1750, x1: 1640, z1: 2499, blurb: "The ground drinks, and sometimes it swallows." },
  { id: "zone.tidewatch", name: "Tidewatch Coast", x0: 1625, z0: 1750, x1: 2499, z1: 2499, blurb: "Salt wind and a harbor waiting for sails." },
];

export const SKILLS: Record<string, SkillDef> = {
  "skill.woodcutting": {
    id: "skill.woodcutting",
    name: "Woodcutting",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.mining": {
    id: "skill.mining",
    name: "Mining",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.foraging": {
    id: "skill.foraging",
    name: "Foraging",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.fishing": {
    id: "skill.fishing",
    name: "Fishing",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.cooking": {
    id: "skill.cooking",
    name: "Cooking",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.smelting": {
    id: "skill.smelting",
    name: "Smelting",
    maxLevel: 99,
    curveId: "curve.standard",
    mergedInto: "skill.smithing",
  },
  "skill.smithing": {
    id: "skill.smithing",
    name: "Smithing",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.attack": {
    id: "skill.attack",
    name: "Attack",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.defense": {
    id: "skill.defense",
    name: "Defense",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.farming": {
    id: "skill.farming",
    name: "Farming",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.herblore": {
    id: "skill.herblore",
    name: "Herblore",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.crafting": {
    id: "skill.crafting",
    name: "Crafting",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.archaeology": {
    id: "skill.archaeology",
    name: "Archaeology",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.archery": {
    id: "skill.archery",
    name: "Archery",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.construction": {
    id: "skill.construction",
    name: "Construction",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.brewing": {
    id: "skill.brewing",
    name: "Brewing",
    maxLevel: 99,
    curveId: "curve.standard",
    mergedInto: "skill.herblore",
  },
  "skill.enchanting": {
    id: "skill.enchanting",
    name: "Enchanting",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.hunting": {
    id: "skill.hunting",
    name: "Hunting",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.thieving": {
    id: "skill.thieving",
    name: "Thieving",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.agility": {
    id: "skill.agility",
    name: "Agility",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.slaying": {
    id: "skill.slaying",
    name: "Slaying",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.boating": {
    id: "skill.boating",
    // Renamed to Mariner; the id stays stable so saves keep their XP.
    name: "Mariner",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.firemaking": {
    id: "skill.firemaking",
    name: "Firemaking",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.strength": {
    id: "skill.strength",
    name: "Strength",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.prayer": {
    id: "skill.prayer",
    name: "Prayer",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.fletching": {
    id: "skill.fletching",
    name: "Fletching",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.runecrafting": {
    id: "skill.runecrafting",
    name: "Runecrafting",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.magic": {
    id: "skill.magic",
    name: "Magic",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.constitution": {
    id: "skill.constitution",
    name: "Constitution",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.dungeoneering": {
    id: "skill.dungeoneering",
    name: "Dungeoneering",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.summoning": {
    id: "skill.summoning",
    name: "Summoning",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.necromancy": {
    id: "skill.necromancy",
    name: "Necromancy",
    maxLevel: 99,
    curveId: "curve.standard",
  },
  "skill.invention": {
    id: "skill.invention",
    name: "Invention",
    maxLevel: 99,
    curveId: "curve.standard",
  },
};

export const ITEMS: Record<string, ItemDef> = {
  "item.log.basic": {
    id: "item.log.basic",
    name: "Oak Log",
    icon: "🪵",
    stackable: true,
    maxStack: 50,
  },
  "item.log.spruce": {
    id: "item.log.spruce",
    name: "Spruce Log",
    icon: "🪵",
    stackable: true,
    maxStack: 50,
  },
  "item.log.birch": {
    id: "item.log.birch",
    name: "Birch Log",
    icon: "🪵",
    stackable: true,
    maxStack: 50,
  },
  "item.log.jungle": {
    id: "item.log.jungle",
    name: "Jungle Log",
    icon: "🪵",
    stackable: true,
    maxStack: 50,
  },
  "item.log.acacia": {
    id: "item.log.acacia",
    name: "Acacia Log",
    icon: "🪵",
    stackable: true,
    maxStack: 50,
  },
  "item.log.darkoak": {
    id: "item.log.darkoak",
    name: "Dark Oak Log",
    icon: "🪵",
    stackable: true,
    maxStack: 50,
  },
  "item.log.blossom": {
    id: "item.log.blossom",
    name: "Blossomwood Log",
    icon: "🌸",
    stackable: true,
    maxStack: 50,
  },
  "item.log.ember": {
    id: "item.log.ember",
    name: "Emberwood Log",
    icon: "🍂",
    stackable: true,
    maxStack: 50,
  },
  "item.log.glow": {
    id: "item.log.glow",
    name: "Lanternwood Log",
    icon: "💡",
    stackable: true,
    maxStack: 50,
  },
  "item.log.dusk": {
    id: "item.log.dusk",
    name: "Duskglass Bough",
    icon: "🔮",
    stackable: true,
    maxStack: 50,
  },
  "tool.axe.basic": {
    id: "tool.axe.basic",
    name: "Worn Axe",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    toolTags: ["axe"],
  },
  // Boats: carry one to cross water. Faster hulls demand a higher Boating
  // level; the best you can handle is boarded automatically at the shore.
  "tool.boat.raft": {
    id: "tool.boat.raft",
    name: "Log Raft",
    icon: "🪵",
    stackable: false,
    maxStack: 1,
    toolTags: ["boat"],
    boat: { speed: 3.2, level: 1 },
  },
  "tool.boat.rowboat": {
    id: "tool.boat.rowboat",
    name: "Rowboat",
    icon: "🚣",
    stackable: false,
    maxStack: 1,
    toolTags: ["boat"],
    boat: { speed: 4.6, level: 8 },
  },
  "tool.boat.skiff": {
    id: "tool.boat.skiff",
    name: "Swift Skiff",
    icon: "⛵",
    stackable: false,
    maxStack: 1,
    toolTags: ["boat"],
    boat: { speed: 6.2, level: 20 },
  },
  "tool.axe.copper": {
    id: "tool.axe.copper",
    name: "Copper Axe",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    toolTags: ["axe"],
    successBonus: 0.08,
  },
  "tool.sword.copper": {
    id: "tool.sword.copper",
    name: "Copper Sword",
    icon: "🗡️",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon"],
    damageBonus: 2,
  },
  "tool.pickaxe.basic": {
    id: "tool.pickaxe.basic",
    name: "Worn Pickaxe",
    icon: "⛏️",
    stackable: false,
    maxStack: 1,
    toolTags: ["pickaxe"],
  },
  "tool.fishingrod.basic": {
    id: "tool.fishingrod.basic",
    name: "Bent Fishing Rod",
    icon: "🎣",
    stackable: false,
    maxStack: 1,
    toolTags: ["fishing_tool"],
  },
  "item.ore.copper": {
    id: "item.ore.copper",
    name: "Copper Ore",
    icon: "🟠",
    stackable: true,
    maxStack: 50,
  },
  "item.stone.rough": {
    id: "item.stone.rough",
    name: "Rough Stone",
    icon: "🪨",
    stackable: true,
    maxStack: 50,
  },
  "item.berry.basic": {
    id: "item.berry.basic",
    name: "Thicket Berries",
    icon: "🫐",
    stackable: true,
    maxStack: 50,
    healAmount: 2,
  },
  "item.fish.raw": {
    id: "item.fish.raw",
    name: "Raw Fish",
    icon: "🐟",
    stackable: true,
    maxStack: 50,
  },
  "item.fish.cooked": {
    id: "item.fish.cooked",
    name: "Cooked Fish",
    icon: "🍤",
    stackable: true,
    maxStack: 50,
    healAmount: 7,
  },
  "item.fish.burnt": {
    id: "item.fish.burnt",
    name: "Burnt Fish",
    icon: "🍂",
    stackable: true,
    maxStack: 50,
  },
  "item.bar.copper": {
    id: "item.bar.copper",
    name: "Copper Bar",
    icon: "🟧",
    stackable: true,
    maxStack: 50,
  },
  "item.wheat": {
    id: "item.wheat",
    name: "Wheat Sheaf",
    icon: "🌾",
    stackable: true,
    maxStack: 50,
  },
  "item.pumpkin": {
    id: "item.pumpkin",
    name: "Pumpkin",
    icon: "🎃",
    stackable: true,
    maxStack: 50,
  },
  "item.bread.basic": {
    id: "item.bread.basic",
    name: "Fresh Bread",
    icon: "🍞",
    stackable: true,
    maxStack: 50,
    healAmount: 6,
  },
  "item.pumpkin.roast": {
    id: "item.pumpkin.roast",
    name: "Roast Pumpkin",
    icon: "🎃",
    stackable: true,
    maxStack: 50,
    healAmount: 10,
  },
  "item.herb.sage": {
    id: "item.herb.sage",
    name: "Wild Sage",
    icon: "🌿",
    stackable: true,
    maxStack: 50,
  },
  "item.salve.healing": {
    id: "item.salve.healing",
    name: "Healing Salve",
    icon: "🧴",
    stackable: true,
    maxStack: 50,
    healAmount: 12,
  },
  "item.potion.swift": {
    id: "item.potion.swift",
    name: "Swiftness Draught",
    icon: "🧪",
    stackable: true,
    maxStack: 50,
    buff: { kind: "speed", durationS: 60 },
  },
  "item.potion.strength": {
    id: "item.potion.strength",
    name: "Strength Tonic",
    icon: "🧪",
    stackable: true,
    maxStack: 50,
    buff: { kind: "strength", durationS: 60 },
  },
  "item.potion.stoneskin": {
    id: "item.potion.stoneskin",
    name: "Stoneskin Brew",
    icon: "🧪",
    stackable: true,
    maxStack: 50,
    buff: { kind: "stoneskin", durationS: 60 },
  },
  "item.chicken.raw": {
    id: "item.chicken.raw",
    name: "Raw Chicken",
    icon: "🍗",
    stackable: true,
    maxStack: 50,
    healAmount: 1,
  },
  "item.egg": {
    id: "item.egg",
    name: "Egg",
    icon: "🥚",
    stackable: true,
    maxStack: 50,
    healAmount: 1,
  },
  "item.chicken.cooked": {
    id: "item.chicken.cooked",
    name: "Roast Chicken",
    icon: "🍗",
    stackable: true,
    maxStack: 50,
    healAmount: 7,
  },
  "item.chicken.burnt": {
    id: "item.chicken.burnt",
    name: "Burnt Chicken",
    icon: "🍗",
    stackable: true,
    maxStack: 50,
  },
  "item.mutton.raw": {
    id: "item.mutton.raw",
    name: "Raw Mutton",
    icon: "🍖",
    stackable: true,
    maxStack: 50,
    healAmount: 1,
  },
  "item.mutton.cooked": {
    id: "item.mutton.cooked",
    name: "Roast Mutton",
    icon: "🍖",
    stackable: true,
    maxStack: 50,
    healAmount: 9,
  },
  "item.mutton.burnt": {
    id: "item.mutton.burnt",
    name: "Burnt Mutton",
    icon: "🍖",
    stackable: true,
    maxStack: 50,
  },
  "item.feather": {
    id: "item.feather",
    name: "Feather",
    icon: "🪶",
    stackable: true,
    maxStack: 50,
  },
  "item.wool": {
    id: "item.wool",
    name: "Wool",
    icon: "🧶",
    stackable: true,
    maxStack: 50,
  },
  "tool.bow.wood": {
    id: "tool.bow.wood",
    name: "Shortbow",
    icon: "🏹",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon", "bow"],
    damageBonus: 2,
  },
  "tool.bow.yew": {
    id: "tool.bow.yew",
    name: "Yew Longbow",
    icon: "🏹",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon", "bow"],
    damageBonus: 5,
  },
  "tool.sword.runed": {
    id: "tool.sword.runed",
    name: "Runed Sword",
    icon: "🗡️",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon"],
    // A parallel high-tier path (Enchanting, not Smithing): on par with the
    // diamond sword, below the netherite apex (12).
    damageBonus: 8,
  },
  "tool.axe.runed": {
    id: "tool.axe.runed",
    name: "Runed Axe",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    toolTags: ["axe"],
    successBonus: 0.24,
  },
  "tool.pickaxe.runed": {
    id: "tool.pickaxe.runed",
    name: "Runed Pickaxe",
    icon: "⛏️",
    stackable: false,
    maxStack: 1,
    toolTags: ["pickaxe"],
    successBonus: 0.24,
  },
  "tool.bow.runed": {
    id: "tool.bow.runed",
    name: "Runed Longbow",
    icon: "🏹",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon", "bow"],
    damageBonus: 8,
  },
  "item.plank.cut": {
    id: "item.plank.cut",
    name: "Cut Planks",
    icon: "🪵",
    stackable: true,
    maxStack: 50,
  },
  "item.rope": {
    id: "item.rope",
    name: "Coiled Rope",
    icon: "🪢",
    stackable: true,
    maxStack: 50,
  },
  "item.charm.bone": {
    id: "item.charm.bone",
    name: "Bone Charm",
    icon: "🦴",
    stackable: true,
    maxStack: 50,
  },
  "item.relic.shard": {
    id: "item.relic.shard",
    name: "Pottery Shard",
    icon: "🏺",
    stackable: true,
    maxStack: 50,
  },
  "item.relic.idol": {
    id: "item.relic.idol",
    name: "Sunburst Idol",
    icon: "🏺",
    stackable: true,
    maxStack: 50,
  },
  "item.hide.wolf": {
    id: "item.hide.wolf",
    name: "Wolf Pelt",
    icon: "🐺",
    stackable: true,
    maxStack: 50,
  },
  "item.bone.old": {
    id: "item.bone.old",
    name: "Weathered Bone",
    icon: "🦴",
    stackable: true,
    maxStack: 50,
  },
  "item.glob.slime": {
    id: "item.glob.slime",
    name: "Slime Glob",
    icon: "🟢",
    stackable: true,
    maxStack: 50,
  },
  "item.venom.sac": {
    id: "item.venom.sac",
    name: "Venom Sac",
    icon: "🧪",
    stackable: true,
    maxStack: 50,
  },
  "item.spore.pale": {
    id: "item.spore.pale",
    name: "Pale Spores",
    icon: "🍄",
    stackable: true,
    maxStack: 50,
  },
  "item.core.construct": {
    id: "item.core.construct",
    name: "Construct Core",
    icon: "🔩",
    stackable: true,
    maxStack: 50,
  },
  "item.anchor.root": {
    id: "item.anchor.root",
    name: "Rootheart Coil",
    icon: "🌀",
    stackable: false,
    maxStack: 1,
  },
  "item.anchor.pump": {
    id: "item.anchor.pump",
    name: "Tidegate Coil",
    icon: "🌀",
    stackable: false,
    maxStack: 1,
  },
  "item.anchor.lift": {
    id: "item.anchor.lift",
    name: "Liftworks Coil",
    icon: "🌀",
    stackable: false,
    maxStack: 1,
  },
  "item.brick.stone": {
    id: "item.brick.stone",
    name: "Stone Brick",
    icon: "🧱",
    stackable: true,
    maxStack: 50,
  },
  "item.ore.tin": {
    id: "item.ore.tin",
    name: "Tin Ore",
    icon: "⚪",
    stackable: true,
    maxStack: 50,
  },
  "item.bar.tin": {
    id: "item.bar.tin",
    name: "Tin Bar",
    icon: "⬜",
    stackable: true,
    maxStack: 50,
  },
  "item.bar.bronze": {
    id: "item.bar.bronze",
    name: "Bronze Bar",
    icon: "🟫",
    stackable: true,
    maxStack: 50,
  },
  "tool.hammer.basic": {
    id: "tool.hammer.basic",
    name: "Smithing Hammer",
    icon: "🔨",
    stackable: false,
    maxStack: 1,
    toolTags: ["hammer"],
  },
  "tool.hoe.basic": {
    id: "tool.hoe.basic",
    name: "Garden Hoe",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    toolTags: ["hoe"],
  },
  "tool.pickaxe.copper": {
    id: "tool.pickaxe.copper",
    name: "Copper Pickaxe",
    icon: "⛏️",
    stackable: false,
    maxStack: 1,
    toolTags: ["pickaxe"],
    successBonus: 0.08,
  },
  "tool.sword.bronze": {
    id: "tool.sword.bronze",
    name: "Bronze Sword",
    icon: "🗡️",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon"],
    damageBonus: 4,
  },
  "item.ore.iron": {
    id: "item.ore.iron",
    name: "Iron Ore",
    icon: "🟤",
    stackable: true,
    maxStack: 50,
  },
  "item.ore.coal": {
    id: "item.ore.coal",
    name: "Coal",
    icon: "⚫",
    stackable: true,
    maxStack: 50,
  },
  "item.ore.gold": {
    id: "item.ore.gold",
    name: "Gold Ore",
    icon: "🟡",
    stackable: true,
    maxStack: 50,
  },
  "item.gem.diamond": {
    id: "item.gem.diamond",
    name: "Diamond",
    icon: "💎",
    stackable: true,
    maxStack: 50,
  },
  "item.bar.gold": {
    id: "item.bar.gold",
    name: "Gold Bar",
    icon: "🟨",
    stackable: true,
    maxStack: 50,
  },
  "item.bar.iron": {
    id: "item.bar.iron",
    name: "Iron Bar",
    icon: "⬜",
    stackable: true,
    maxStack: 50,
  },
  // ---- Minecraft ore ladder above diamond ----
  "item.ore.redstone": {
    id: "item.ore.redstone",
    name: "Redstone Dust",
    icon: "🔴",
    stackable: true,
    maxStack: 99,
  },
  "item.gem.lapis": {
    id: "item.gem.lapis",
    name: "Lapis Lazuli",
    icon: "🔷",
    stackable: true,
    maxStack: 99,
  },
  "item.gem.emerald": {
    id: "item.gem.emerald",
    name: "Emerald",
    icon: "💚",
    stackable: true,
    maxStack: 50,
  },
  "item.gem.quartz": {
    id: "item.gem.quartz",
    name: "Nether Quartz",
    icon: "⬜",
    stackable: true,
    maxStack: 99,
  },
  "item.debris.ancient": {
    id: "item.debris.ancient",
    name: "Ancient Debris",
    icon: "🟫",
    stackable: true,
    maxStack: 50,
  },
  "item.scrap.netherite": {
    id: "item.scrap.netherite",
    name: "Netherite Scrap",
    icon: "🟤",
    stackable: true,
    maxStack: 50,
  },
  "item.ingot.netherite": {
    id: "item.ingot.netherite",
    name: "Netherite Ingot",
    icon: "⬛",
    stackable: true,
    maxStack: 50,
  },
  "tool.pickaxe.netherite": {
    id: "tool.pickaxe.netherite",
    name: "Netherite Pickaxe",
    icon: "⛏️",
    stackable: false,
    maxStack: 1,
    toolTags: ["pickaxe"],
    successBonus: 0.3,
  },
  "tool.axe.netherite": {
    id: "tool.axe.netherite",
    name: "Netherite Axe",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    toolTags: ["axe"],
    successBonus: 0.3,
  },
  "tool.sword.netherite": {
    id: "tool.sword.netherite",
    name: "Netherite Sword",
    icon: "🗡️",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon"],
    damageBonus: 12,
  },
  "tool.axe.bronze": {
    id: "tool.axe.bronze",
    name: "Bronze Axe",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    toolTags: ["axe"],
    successBonus: 0.12,
  },
  "tool.pickaxe.bronze": {
    id: "tool.pickaxe.bronze",
    name: "Bronze Pickaxe",
    icon: "⛏️",
    stackable: false,
    maxStack: 1,
    toolTags: ["pickaxe"],
    successBonus: 0.12,
  },
  "tool.axe.iron": {
    id: "tool.axe.iron",
    name: "Iron Axe",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    toolTags: ["axe"],
    successBonus: 0.16,
  },
  "tool.pickaxe.iron": {
    id: "tool.pickaxe.iron",
    name: "Iron Pickaxe",
    icon: "⛏️",
    stackable: false,
    maxStack: 1,
    toolTags: ["pickaxe"],
    successBonus: 0.16,
  },
  "tool.sword.iron": {
    id: "tool.sword.iron",
    name: "Iron Sword",
    icon: "🗡️",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon"],
    damageBonus: 6,
  },
  "tool.sword.diamond": {
    id: "tool.sword.diamond",
    name: "Diamond-edged Sword",
    icon: "🗡️",
    stackable: false,
    maxStack: 1,
    toolTags: ["weapon"],
    damageBonus: 8,
  },
  "tool.axe.diamond": {
    id: "tool.axe.diamond",
    name: "Diamond-edged Axe",
    icon: "🪓",
    stackable: false,
    maxStack: 1,
    toolTags: ["axe"],
    successBonus: 0.22,
  },
  "tool.pickaxe.diamond": {
    id: "tool.pickaxe.diamond",
    name: "Diamond-tipped Pickaxe",
    icon: "⛏️",
    stackable: false,
    maxStack: 1,
    toolTags: ["pickaxe"],
    successBonus: 0.22,
  },
  "item.ring.gold": {
    id: "item.ring.gold",
    name: "Gold Ring",
    icon: "💍",
    stackable: true,
    maxStack: 10,
  },
  "item.amulet.gold": {
    id: "item.amulet.gold",
    name: "Gold Amulet",
    icon: "📿",
    stackable: true,
    maxStack: 10,
  },
  "armor.cap.iron": {
    id: "armor.cap.iron",
    name: "Iron Helm",
    icon: "🪖",
    stackable: false,
    maxStack: 1,
    armorSlot: "head",
    protection: 0.2,
  },
  "armor.tunic.iron": {
    id: "armor.tunic.iron",
    name: "Iron Chestplate",
    icon: "👕",
    stackable: false,
    maxStack: 1,
    armorSlot: "body",
    protection: 0.2,
  },
  "armor.leggings.iron": {
    id: "armor.leggings.iron",
    name: "Iron Greaves",
    icon: "👖",
    stackable: false,
    maxStack: 1,
    armorSlot: "legs",
    protection: 0.2,
  },
  "armor.boots.leather": {
    id: "armor.boots.leather",
    name: "Leather Boots",
    icon: "🥾",
    stackable: false,
    maxStack: 1,
    armorSlot: "feet",
    protection: 0.05,
  },
  "armor.boots.copper": {
    id: "armor.boots.copper",
    name: "Copper Boots",
    icon: "🥾",
    stackable: false,
    maxStack: 1,
    armorSlot: "feet",
    protection: 0.08,
  },
  "armor.boots.bronze": {
    id: "armor.boots.bronze",
    name: "Bronze Boots",
    icon: "🥾",
    stackable: false,
    maxStack: 1,
    armorSlot: "feet",
    protection: 0.12,
  },
  "armor.boots.iron": {
    id: "armor.boots.iron",
    name: "Iron Sabatons",
    icon: "🥾",
    stackable: false,
    maxStack: 1,
    armorSlot: "feet",
    protection: 0.16,
  },
  "item.coin": {
    id: "item.coin",
    name: "Coin",
    icon: "🪙",
    stackable: true,
    maxStack: 999,
  },
  "item.gem.emberstone": {
    id: "item.gem.emberstone",
    name: "Emberstone",
    icon: "🔶",
    stackable: true,
    maxStack: 50,
  },
  "item.beef.raw": {
    id: "item.beef.raw",
    name: "Raw Beef",
    icon: "🥩",
    stackable: true,
    maxStack: 50,
  },
  "item.beef.cooked": {
    id: "item.beef.cooked",
    name: "Cooked Beef",
    icon: "🍖",
    stackable: true,
    maxStack: 50,
    healAmount: 10,
  },
  "item.beef.burnt": {
    id: "item.beef.burnt",
    name: "Charred Beef",
    icon: "🍂",
    stackable: true,
    maxStack: 50,
  },
  "item.pork.raw": {
    id: "item.pork.raw",
    name: "Raw Pork",
    icon: "🥩",
    stackable: true,
    maxStack: 50,
  },
  "item.pork.cooked": {
    id: "item.pork.cooked",
    name: "Cooked Pork",
    icon: "🍖",
    stackable: true,
    maxStack: 50,
    healAmount: 8,
  },
  "item.pork.burnt": {
    id: "item.pork.burnt",
    name: "Charred Pork",
    icon: "🍂",
    stackable: true,
    maxStack: 50,
  },
  "item.hide.cow": {
    id: "item.hide.cow",
    name: "Cowhide",
    icon: "🟫",
    stackable: true,
    maxStack: 50,
  },
  "armor.cap.leather": {
    id: "armor.cap.leather",
    name: "Leather Cap",
    icon: "🪖",
    stackable: false,
    maxStack: 1,
    armorSlot: "head",
    protection: 0.08,
  },
  "armor.tunic.leather": {
    id: "armor.tunic.leather",
    name: "Leather Tunic",
    icon: "👕",
    stackable: false,
    maxStack: 1,
    armorSlot: "body",
    protection: 0.08,
  },
  "armor.leggings.leather": {
    id: "armor.leggings.leather",
    name: "Leather Leggings",
    icon: "👖",
    stackable: false,
    maxStack: 1,
    armorSlot: "legs",
    protection: 0.08,
  },
  "armor.cap.copper": {
    id: "armor.cap.copper",
    name: "Copper Helm",
    icon: "🪖",
    stackable: false,
    maxStack: 1,
    armorSlot: "head",
    protection: 0.12,
  },
  "armor.tunic.copper": {
    id: "armor.tunic.copper",
    name: "Copper Chestplate",
    icon: "👕",
    stackable: false,
    maxStack: 1,
    armorSlot: "body",
    protection: 0.12,
  },
  "armor.leggings.copper": {
    id: "armor.leggings.copper",
    name: "Copper Greaves",
    icon: "👖",
    stackable: false,
    maxStack: 1,
    armorSlot: "legs",
    protection: 0.12,
  },
  "armor.cap.bronze": {
    id: "armor.cap.bronze",
    name: "Bronze Helm",
    icon: "🪖",
    stackable: false,
    maxStack: 1,
    armorSlot: "head",
    protection: 0.16,
  },
  "armor.tunic.bronze": {
    id: "armor.tunic.bronze",
    name: "Bronze Chestplate",
    icon: "👕",
    stackable: false,
    maxStack: 1,
    armorSlot: "body",
    protection: 0.16,
  },
  "armor.leggings.bronze": {
    id: "armor.leggings.bronze",
    name: "Bronze Greaves",
    icon: "👖",
    stackable: false,
    maxStack: 1,
    armorSlot: "legs",
    protection: 0.16,
  },

  // ---------- farming: seeds and harvests ----------
  "item.seed.wheat": {
    id: "item.seed.wheat",
    name: "Wheat Seed",
    icon: "🌾",
    stackable: true,
    maxStack: 50,
  },
  "item.seed.carrot": {
    id: "item.seed.carrot",
    name: "Carrot Seed",
    icon: "🥕",
    stackable: true,
    maxStack: 50,
  },
  "item.seed.pumpkin": {
    id: "item.seed.pumpkin",
    name: "Pumpkin Seed",
    icon: "🎃",
    stackable: true,
    maxStack: 50,
  },
  "item.seed.potato": {
    id: "item.seed.potato",
    name: "Seed Potato",
    icon: "🥔",
    stackable: true,
    maxStack: 50,
  },
  "item.seed.melon": {
    id: "item.seed.melon",
    name: "Melon Seed",
    icon: "🍈",
    stackable: true,
    maxStack: 50,
  },
  "item.carrot": {
    id: "item.carrot",
    name: "Carrot",
    icon: "🥕",
    stackable: true,
    maxStack: 20,
    healAmount: 3,
  },
  "item.crop.potato": {
    id: "item.crop.potato",
    name: "Potato",
    icon: "🥔",
    stackable: true,
    maxStack: 20,
    healAmount: 2,
  },
  "item.potato.baked": {
    id: "item.potato.baked",
    name: "Baked Potato",
    icon: "🍠",
    stackable: true,
    maxStack: 20,
    healAmount: 9,
  },
  "item.melon.slice": {
    id: "item.melon.slice",
    name: "Melon Slice",
    icon: "🍉",
    stackable: true,
    maxStack: 20,
    healAmount: 5,
  },
  "item.herb.frostbloom": {
    id: "item.herb.frostbloom",
    name: "Frostbloom",
    icon: "❄️",
    stackable: true,
    maxStack: 20,
  },
  "item.herb.duskcap": {
    id: "item.herb.duskcap",
    name: "Duskcap",
    icon: "🍄",
    stackable: true,
    maxStack: 20,
  },
  "item.stew.carrot": {
    id: "item.stew.carrot",
    name: "Carrot Stew",
    icon: "🍲",
    stackable: true,
    maxStack: 10,
    healAmount: 9,
  },

  // ---------- herblore: herbs, tonics, focused brews ----------
  "item.herb.mint": {
    id: "item.herb.mint",
    name: "River Mint",
    icon: "🌿",
    stackable: true,
    maxStack: 20,
  },
  "item.herb.emberleaf": {
    id: "item.herb.emberleaf",
    name: "Emberleaf",
    icon: "🍂",
    stackable: true,
    maxStack: 20,
  },
  "item.potion.gathering": {
    id: "item.potion.gathering",
    name: "Forager's Brew",
    icon: "🧪",
    stackable: true,
    maxStack: 10,
    buff: { kind: "gathering", durationS: 90 },
  },
  "item.potion.focus": {
    id: "item.potion.focus",
    name: "Hunter's Focus",
    icon: "🧪",
    stackable: true,
    maxStack: 10,
    buff: { kind: "focus", durationS: 90 },
  },
  "item.tonic.oakblood": {
    id: "item.tonic.oakblood",
    name: "Oakblood Tonic",
    icon: "🧪",
    stackable: true,
    maxStack: 10,
    buff: { kind: "regen", durationS: 45 },
  },

  // ---------- hunting: traps and game ----------
  "tool.trap.basic": {
    id: "tool.trap.basic",
    name: "Rope Snare",
    icon: "🪢",
    stackable: false,
    maxStack: 1,
    toolTags: ["trap"],
    successBonus: 0,
  },
  "tool.trap.fine": {
    id: "tool.trap.fine",
    name: "Fine Box Trap",
    icon: "🪤",
    stackable: false,
    maxStack: 1,
    toolTags: ["trap"],
    successBonus: 0.08,
  },
  "item.game.rabbit": {
    id: "item.game.rabbit",
    name: "Raw Rabbit",
    icon: "🐇",
    stackable: true,
    maxStack: 20,
  },
  "item.rabbit.cooked": {
    id: "item.rabbit.cooked",
    name: "Roast Rabbit",
    icon: "🍗",
    stackable: true,
    maxStack: 20,
    healAmount: 5,
  },
  "item.fur": {
    id: "item.fur",
    name: "Soft Fur",
    icon: "🦫",
    stackable: true,
    maxStack: 20,
  },

  // ---------- thieving: loot ----------
  "item.trinket.jade": {
    id: "item.trinket.jade",
    name: "Jade Trinket",
    icon: "💍",
    stackable: true,
    maxStack: 10,
  },

  // ---------- archaeology: the relic collection ----------
  "item.relic.urn": {
    id: "item.relic.urn",
    name: "Clay Urn",
    icon: "🏺",
    stackable: true,
    maxStack: 10,
  },
  "item.relic.coin": {
    id: "item.relic.coin",
    name: "Ancient Coin",
    icon: "🪙",
    stackable: true,
    maxStack: 10,
  },
  "item.treasure_map": {
    id: "item.treasure_map",
    name: "Treasure Map",
    icon: "🗺️",
    stackable: true,
    maxStack: 10,
  },
  "item.relic.tablet": {
    id: "item.relic.tablet",
    name: "Carved Tablet",
    icon: "📜",
    stackable: true,
    maxStack: 10,
  },
  "item.relic.mask": {
    id: "item.relic.mask",
    name: "Gilded Mask",
    icon: "🎭",
    stackable: true,
    maxStack: 10,
  },

  // ---------- far-zone fishing ----------
  "item.fish.eel": {
    id: "item.fish.eel",
    name: "Marsh Eel",
    icon: "🐍",
    stackable: true,
    maxStack: 20,
  },
  "item.eel.cooked": {
    id: "item.eel.cooked",
    name: "Smoked Eel",
    icon: "🍢",
    stackable: true,
    maxStack: 20,
    healAmount: 8,
  },
  "item.fish.icefin": {
    id: "item.fish.icefin",
    name: "Icefin",
    icon: "🐟",
    stackable: true,
    maxStack: 20,
  },
  "item.icefin.cooked": {
    id: "item.icefin.cooked",
    name: "Seared Icefin",
    icon: "🍣",
    stackable: true,
    maxStack: 20,
    healAmount: 12,
  },
  "item.fish.trout": {
    id: "item.fish.trout",
    name: "River Trout",
    icon: "🐟",
    stackable: true,
    maxStack: 20,
  },
  "item.trout.cooked": {
    id: "item.trout.cooked",
    name: "Pan-fried Trout",
    icon: "🍤",
    stackable: true,
    maxStack: 20,
    healAmount: 6,
  },
  "item.fish.seabass": {
    id: "item.fish.seabass",
    name: "Sea Bass",
    icon: "🐠",
    stackable: true,
    maxStack: 20,
  },
  "item.seabass.cooked": {
    id: "item.seabass.cooked",
    name: "Roast Sea Bass",
    icon: "🍱",
    stackable: true,
    maxStack: 20,
    healAmount: 16,
  },
  "item.fish.sunscale": {
    id: "item.fish.sunscale",
    name: "Sunscale",
    icon: "🎏",
    stackable: true,
    maxStack: 20,
  },
  "item.sunscale.cooked": {
    id: "item.sunscale.cooked",
    name: "Glazed Sunscale",
    icon: "🍥",
    stackable: true,
    maxStack: 20,
    healAmount: 24,
  },
  // ---- the deep-water ladder: shellfish close in, monsters far out ----
  "item.fish.shrimp": { id: "item.fish.shrimp", name: "Shore Shrimp", icon: "🦐", stackable: true, maxStack: 20 },
  "item.shrimp.cooked": { id: "item.shrimp.cooked", name: "Buttered Shrimp", icon: "🍤", stackable: true, maxStack: 20, healAmount: 4 },
  "item.fish.crab": { id: "item.fish.crab", name: "Rock Crab", icon: "🦀", stackable: true, maxStack: 20 },
  "item.crab.cooked": { id: "item.crab.cooked", name: "Boiled Crab", icon: "🦀", stackable: true, maxStack: 20, healAmount: 10 },
  "item.fish.lobster": { id: "item.fish.lobster", name: "Reef Lobster", icon: "🦞", stackable: true, maxStack: 20 },
  "item.lobster.cooked": { id: "item.lobster.cooked", name: "Steamed Lobster", icon: "🦞", stackable: true, maxStack: 20, healAmount: 20 },
  "item.fish.marlin": { id: "item.fish.marlin", name: "Sailfin Marlin", icon: "🦈", stackable: true, maxStack: 20 },
  "item.marlin.cooked": { id: "item.marlin.cooked", name: "Grilled Marlin", icon: "🍢", stackable: true, maxStack: 20, healAmount: 26 },
  "item.fish.gloom": { id: "item.fish.gloom", name: "Abyssal Gloomfish", icon: "🐡", stackable: true, maxStack: 20 },
  "item.gloom.cooked": { id: "item.gloom.cooked", name: "Abyssal Delicacy", icon: "🍛", stackable: true, maxStack: 20, healAmount: 32 },
  "item.fish.stormscale": { id: "item.fish.stormscale", name: "Stormscale", icon: "⚡", stackable: true, maxStack: 20 },
  "item.stormscale.cooked": { id: "item.stormscale.cooked", name: "Storm-seared Fillet", icon: "🍱", stackable: true, maxStack: 20, healAmount: 40 },
  // ---- gems struck while mining (rarer the deeper the sparkle) ----
  "item.gem.opal": { id: "item.gem.opal", name: "Opal", icon: "⚪", stackable: true, maxStack: 50 },
  "item.gem.jade": { id: "item.gem.jade", name: "Jade", icon: "🟢", stackable: true, maxStack: 50 },
  "item.gem.topaz": { id: "item.gem.topaz", name: "Topaz", icon: "🟠", stackable: true, maxStack: 50 },
  "item.gem.sapphire": { id: "item.gem.sapphire", name: "Sapphire", icon: "🔹", stackable: true, maxStack: 50 },
  "item.gem.ruby": { id: "item.gem.ruby", name: "Ruby", icon: "🔴", stackable: true, maxStack: 50 },
  "item.gem.dragonstone": { id: "item.gem.dragonstone", name: "Dragonstone", icon: "🟣", stackable: true, maxStack: 50 },
  // ---- jewellery crafted from struck gems (Crafting) ----
  "item.ring.opal": { id: "item.ring.opal", name: "Opal Ring", icon: "💍", stackable: true, maxStack: 20 },
  "item.ring.sapphire": { id: "item.ring.sapphire", name: "Sapphire Ring", icon: "💍", stackable: true, maxStack: 20 },
  "item.amulet.emerald": { id: "item.amulet.emerald", name: "Emerald Amulet", icon: "📿", stackable: true, maxStack: 20 },
  "item.amulet.ruby": { id: "item.amulet.ruby", name: "Ruby Amulet", icon: "📿", stackable: true, maxStack: 20 },
  "item.amulet.dragonstone": { id: "item.amulet.dragonstone", name: "Dragonstone Amulet", icon: "📿", stackable: true, maxStack: 20 },
  // ---- bones for Prayer (bury them) ----
  "item.rite.skeleton": { id: "item.rite.skeleton", name: "Rite of the Risen Skeleton", icon: "💀", stackable: true, maxStack: 20, minion: { defId: "enemy.skeleton", durationS: 60, dmg: 2 } },
  "item.rite.stray": { id: "item.rite.stray", name: "Rite of the Restless Stray", icon: "🩻", stackable: true, maxStack: 20, minion: { defId: "enemy.stray", durationS: 60, dmg: 3 } },
  "item.rite.wight": { id: "item.rite.wight", name: "Rite of the Hollow Wight", icon: "👻", stackable: true, maxStack: 20, minion: { defId: "enemy.hollow_wight", durationS: 60, dmg: 5 } },
  "item.rite.drowned": { id: "item.rite.drowned", name: "Rite of the Drowned Servant", icon: "🧜", stackable: true, maxStack: 20, minion: { defId: "enemy.drowned", durationS: 70, dmg: 7 } },
  "item.rite.shambler": { id: "item.rite.shambler", name: "Rite of the Grave Shambler", icon: "🧟", stackable: true, maxStack: 20, minion: { defId: "enemy.grave_shambler", durationS: 75, dmg: 9 } },
  "item.rite.barrow": { id: "item.rite.barrow", name: "Rite of the Barrow Lord", icon: "👑", stackable: true, maxStack: 20, minion: { defId: "enemy.barrow_lord", durationS: 85, dmg: 13 } },
  "item.bone.big": { id: "item.bone.big", name: "Big Bones", icon: "🦴", stackable: true, maxStack: 50 },
  "item.bone.dragon": { id: "item.bone.dragon", name: "Dragon Bones", icon: "🐉", stackable: true, maxStack: 50 },
  "item.bone.ancient": { id: "item.bone.ancient", name: "Ancient Bones", icon: "💀", stackable: true, maxStack: 50 },
  "item.bone.warden": { id: "item.bone.warden", name: "Warden Remains", icon: "🌑", stackable: true, maxStack: 50 },
  // ---- Runecrafting: arcane essence bound into Minecraft magic reagents ----
  "item.essence.rune": { id: "item.essence.rune", name: "Arcane Essence", icon: "🪨", stackable: true, maxStack: 99 },
  "item.rune.air": { id: "item.rune.air", name: "Wind Rune", icon: "🌬️", stackable: true, maxStack: 99 },
  "item.rune.water": { id: "item.rune.water", name: "Prismarine Rune", icon: "🔷", stackable: true, maxStack: 99 },
  "item.rune.earth": { id: "item.rune.earth", name: "Amethyst Rune", icon: "🟪", stackable: true, maxStack: 99 },
  "item.rune.fire": { id: "item.rune.fire", name: "Blaze Rune", icon: "🔥", stackable: true, maxStack: 99 },
  "item.rune.nature": { id: "item.rune.nature", name: "Wart Rune", icon: "🍄", stackable: true, maxStack: 99 },
  "item.rune.law": { id: "item.rune.law", name: "Ender Rune", icon: "🟢", stackable: true, maxStack: 99 },
  "item.rune.death": { id: "item.rune.death", name: "Wither Rune", icon: "🥀", stackable: true, maxStack: 99 },
  "item.rune.blood": { id: "item.rune.blood", name: "Magma Rune", icon: "🔴", stackable: true, maxStack: 99 },
  "item.rune.soul": { id: "item.rune.soul", name: "Echo Rune", icon: "🖤", stackable: true, maxStack: 99 },
  // ---- Fletching: arrows and a ladder of bows ----
  "item.arrow.shaft": { id: "item.arrow.shaft", name: "Arrow Shafts", icon: "➖", stackable: true, maxStack: 99 },
  "item.arrow.bronze": { id: "item.arrow.bronze", name: "Bronze Arrows", icon: "🏹", stackable: true, maxStack: 99, damageBonus: 0 },
  "item.arrow.iron": { id: "item.arrow.iron", name: "Iron Arrows", icon: "🏹", stackable: true, maxStack: 99, damageBonus: 1 },
  "tool.bow.oak": { id: "tool.bow.oak", name: "Oak Longbow", icon: "🏹", stackable: false, maxStack: 1, toolTags: ["bow", "weapon"], damageBonus: 5 },
  "tool.bow.spruce": { id: "tool.bow.spruce", name: "Spruce Longbow", icon: "🏹", stackable: false, maxStack: 1, toolTags: ["bow", "weapon"], damageBonus: 7 },
  "tool.bow.jungle": { id: "tool.bow.jungle", name: "Jungle Warbow", icon: "🏹", stackable: false, maxStack: 1, toolTags: ["bow", "weapon"], damageBonus: 9 },
  "tool.bow.dark": { id: "tool.bow.dark", name: "Duskbark Bow", icon: "🏹", stackable: false, maxStack: 1, toolTags: ["bow", "weapon"], damageBonus: 12 },
  // ---- Summoning: familiar pouches (drink to call the familiar's aid) ----
  "item.pouch.wolf": { id: "item.pouch.wolf", name: "Spirit Wolf Reins", icon: "🐺", stackable: true, maxStack: 20, mount: { speed: 1.25 } },
  "item.pouch.ox": { id: "item.pouch.ox", name: "Pack Ox Reins", icon: "🐂", stackable: true, maxStack: 20, mount: { speed: 1.35 } },
  "item.pouch.tortoise": { id: "item.pouch.tortoise", name: "War Tortoise Reins", icon: "🐢", stackable: true, maxStack: 20, mount: { speed: 1.45 } },
  // ---- Invention: salvaged parts and the gizmos built from them ----
  "item.component.parts": { id: "item.component.parts", name: "Salvaged Parts", icon: "⚙️", stackable: true, maxStack: 99 },
  "item.gizmo.swift": { id: "item.gizmo.swift", name: "Swift Gizmo", icon: "🧭", stackable: true, maxStack: 20, buff: { kind: "speed", durationS: 90 } },
  "item.gizmo.precise": { id: "item.gizmo.precise", name: "Precise Gizmo", icon: "🎯", stackable: true, maxStack: 20, buff: { kind: "focus", durationS: 90 } },
  "item.gizmo.bulwark": { id: "item.gizmo.bulwark", name: "Bulwark Gizmo", icon: "🛡️", stackable: true, maxStack: 20, buff: { kind: "stoneskin", durationS: 90 } },
  "item.gizmo.titan": { id: "item.gizmo.titan", name: "Titan Gizmo", icon: "🤜", stackable: true, maxStack: 20, buff: { kind: "strength", durationS: 90 } },

  // ============================================================================
  // SKILL-LADDER EXPANSION (see SKILL_PLANS.md) — gathering, crafting, combat.
  // ============================================================================
  // ---- Foraging: a RuneScape berry-bush ladder + the secateurs tool line ----
  "item.forage.redberry": { id: "item.forage.redberry", name: "Redberries", icon: "🔴", stackable: true, maxStack: 50, healAmount: 3 },
  "item.forage.cadava": { id: "item.forage.cadava", name: "Cadava Berries", icon: "🫐", stackable: true, maxStack: 50, healAmount: 4 },
  "item.forage.dwellberry": { id: "item.forage.dwellberry", name: "Dwellberries", icon: "🟣", stackable: true, maxStack: 50, healAmount: 5 },
  "item.forage.cloudberry": { id: "item.forage.cloudberry", name: "Cloudberries", icon: "🟠", stackable: true, maxStack: 50, healAmount: 6 },
  "item.forage.jangerberry": { id: "item.forage.jangerberry", name: "Jangerberries", icon: "🍇", stackable: true, maxStack: 50, healAmount: 7 },
  "item.forage.pricklypear": { id: "item.forage.pricklypear", name: "Prickly Pear", icon: "🌵", stackable: true, maxStack: 50, healAmount: 8 },
  "item.forage.whiteberry": { id: "item.forage.whiteberry", name: "Whiteberries", icon: "⚪", stackable: true, maxStack: 50, healAmount: 9 },
  "item.forage.poisonivy": { id: "item.forage.poisonivy", name: "Poison Ivy Berries", icon: "🟢", stackable: true, maxStack: 50 },
  "item.forage.everlight": { id: "item.forage.everlight", name: "Everlight Berries", icon: "🩵", stackable: true, maxStack: 50, healAmount: 12 },
  "tool.secateurs.basic": { id: "tool.secateurs.basic", name: "Secateurs", icon: "✂️", stackable: false, maxStack: 1, toolTags: ["secateurs"], successBonus: 0 },
  "tool.secateurs.magic": { id: "tool.secateurs.magic", name: "Magic Secateurs", icon: "✂️", stackable: false, maxStack: 1, toolTags: ["secateurs"], successBonus: 0.12 },
  // ---- Hunting: game meats, hides, tusks + two more trap tiers ----
  "item.game.fowl": { id: "item.game.fowl", name: "Raw Pheasant", icon: "🐦", stackable: true, maxStack: 20, healAmount: 1 },
  "item.fowl.cooked": { id: "item.fowl.cooked", name: "Roast Pheasant", icon: "🍗", stackable: true, maxStack: 20, healAmount: 6 },
  "item.hide.kebbit": { id: "item.hide.kebbit", name: "Kebbit Fur", icon: "🦫", stackable: true, maxStack: 20 },
  "item.game.boar": { id: "item.game.boar", name: "Raw Boar", icon: "🥩", stackable: true, maxStack: 20, healAmount: 1 },
  "item.boar.cooked": { id: "item.boar.cooked", name: "Roast Boar", icon: "🍖", stackable: true, maxStack: 20, healAmount: 10 },
  "item.hide.thick": { id: "item.hide.thick", name: "Thick Hide", icon: "🟫", stackable: true, maxStack: 20 },
  "item.tusk": { id: "item.tusk", name: "Ivory Tusk", icon: "🦷", stackable: true, maxStack: 20 },
  "item.chinchompa": { id: "item.chinchompa", name: "Chinchompa", icon: "🐿️", stackable: true, maxStack: 50 },
  "item.hide.polar": { id: "item.hide.polar", name: "Polar Kebbit Fur", icon: "❄️", stackable: true, maxStack: 20 },
  "item.hide.sabre": { id: "item.hide.sabre", name: "Sabre-tooth Pelt", icon: "🐯", stackable: true, maxStack: 20 },
  "item.game.grenwall": { id: "item.game.grenwall", name: "Raw Grenwall", icon: "🍖", stackable: true, maxStack: 20, healAmount: 1 },
  "item.grenwall.cooked": { id: "item.grenwall.cooked", name: "Roast Grenwall", icon: "🍖", stackable: true, maxStack: 20, healAmount: 16 },
  "item.spike.grenwall": { id: "item.spike.grenwall", name: "Grenwall Spike", icon: "📌", stackable: true, maxStack: 99 },
  "item.hide.antelope": { id: "item.hide.antelope", name: "Moonlight Hide", icon: "🌙", stackable: true, maxStack: 20 },
  "item.game.antelope": { id: "item.game.antelope", name: "Raw Antelope", icon: "🥩", stackable: true, maxStack: 20, healAmount: 1 },
  "item.antelope.cooked": { id: "item.antelope.cooked", name: "Roast Antelope", icon: "🍖", stackable: true, maxStack: 20, healAmount: 20 },
  "item.antler": { id: "item.antler", name: "Antler", icon: "🦌", stackable: true, maxStack: 20 },
  "tool.trap.box": { id: "tool.trap.box", name: "Steel Box Trap", icon: "🪤", stackable: false, maxStack: 1, toolTags: ["trap"], successBonus: 0.14 },
  "tool.trap.magic": { id: "tool.trap.magic", name: "Magic Box Trap", icon: "🪤", stackable: false, maxStack: 1, toolTags: ["trap"], successBonus: 0.2 },
  // ---- Archaeology: excavated samples, an artefact collection, mattock tools ----
  "item.arch.samples": { id: "item.arch.samples", name: "Excavated Samples", icon: "🧫", stackable: true, maxStack: 99 },
  "item.relic.torque": { id: "item.relic.torque", name: "Bronze Torc", icon: "🔗", stackable: true, maxStack: 10 },
  "item.relic.chalice": { id: "item.relic.chalice", name: "Silver Chalice", icon: "🏆", stackable: true, maxStack: 10 },
  "item.relic.censer": { id: "item.relic.censer", name: "Bronze Censer", icon: "🪔", stackable: true, maxStack: 10 },
  "item.relic.astrolabe": { id: "item.relic.astrolabe", name: "Star Astrolabe", icon: "🧭", stackable: true, maxStack: 10 },
  "item.relic.sceptre": { id: "item.relic.sceptre", name: "War Sceptre", icon: "🔱", stackable: true, maxStack: 10 },
  "item.relic.crown": { id: "item.relic.crown", name: "Old King's Crown", icon: "👑", stackable: true, maxStack: 10 },
  "tool.mattock.basic": { id: "tool.mattock.basic", name: "Trowel", icon: "🥄", stackable: false, maxStack: 1, toolTags: ["mattock"], successBonus: 0 },
  "tool.mattock.iron": { id: "tool.mattock.iron", name: "Iron Mattock", icon: "⛏️", stackable: false, maxStack: 1, toolTags: ["mattock"], successBonus: 0.1 },
  "tool.mattock.dragon": { id: "tool.mattock.dragon", name: "Dragon Mattock", icon: "⛏️", stackable: false, maxStack: 1, toolTags: ["mattock"], successBonus: 0.18 },
  "tool.mattock.crystal": { id: "tool.mattock.crystal", name: "Crystal Mattock", icon: "⛏️", stackable: false, maxStack: 1, toolTags: ["mattock"], successBonus: 0.26 },
  // ---- Brewing: Keen/Emberward bridge + Greater/Super/Grand draughts ----
  "item.potion.gathering_keen": { id: "item.potion.gathering_keen", name: "Keen Forager's Brew", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "gathering", durationS: 150 } },
  "item.tonic.warden": { id: "item.tonic.warden", name: "Emberward Tonic", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "regen", durationS: 90 } },
  "item.potion.swift_greater": { id: "item.potion.swift_greater", name: "Greater Swiftness Draught", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "speed", durationS: 150 } },
  "item.potion.gathering_greater": { id: "item.potion.gathering_greater", name: "Greater Forager's Brew", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "gathering", durationS: 300 } },
  "item.potion.strength_greater": { id: "item.potion.strength_greater", name: "Greater Strength Tonic", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "strength", durationS: 150 } },
  "item.potion.stoneskin_greater": { id: "item.potion.stoneskin_greater", name: "Greater Stoneskin Brew", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "stoneskin", durationS: 150 } },
  "item.potion.focus_greater": { id: "item.potion.focus_greater", name: "Greater Hunter's Focus", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "focus", durationS: 300 } },
  "item.tonic.warden_greater": { id: "item.tonic.warden_greater", name: "Greater Warden's Tonic", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "regen", durationS: 180 } },
  "item.potion.swift_super": { id: "item.potion.swift_super", name: "Super Swiftness Draught", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "speed", durationS: 330 } },
  "item.potion.gathering_super": { id: "item.potion.gathering_super", name: "Super Forager's Brew", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "gathering", durationS: 600 } },
  "item.potion.strength_super": { id: "item.potion.strength_super", name: "Super Strength Tonic", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "strength", durationS: 330 } },
  "item.potion.stoneskin_super": { id: "item.potion.stoneskin_super", name: "Super Stoneskin Brew", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "stoneskin", durationS: 330 } },
  "item.potion.focus_super": { id: "item.potion.focus_super", name: "Super Hunter's Focus", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "focus", durationS: 600 } },
  "item.tonic.warden_super": { id: "item.tonic.warden_super", name: "Super Warden's Tonic", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "regen", durationS: 300 } },
  "item.potion.swift_grand": { id: "item.potion.swift_grand", name: "Grand Swiftness Elixir", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "speed", durationS: 600 } },
  "item.potion.gathering_grand": { id: "item.potion.gathering_grand", name: "Grand Forager's Elixir", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "gathering", durationS: 1200 } },
  "item.potion.strength_grand": { id: "item.potion.strength_grand", name: "Grand Strength Elixir", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "strength", durationS: 600 } },
  "item.potion.stoneskin_grand": { id: "item.potion.stoneskin_grand", name: "Grand Stoneskin Elixir", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "stoneskin", durationS: 600 } },
  "item.potion.focus_grand": { id: "item.potion.focus_grand", name: "Grand Hunter's Elixir", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "focus", durationS: 1200 } },
  "item.tonic.warden_grand": { id: "item.tonic.warden_grand", name: "Grand Warden's Draught", icon: "🧪", stackable: true, maxStack: 50, buff: { kind: "regen", durationS: 480 } },
  // ---- Herblore: two campfire salves that consume the orphan herbs ----
  "item.salve.frost": { id: "item.salve.frost", name: "Frostbloom Salve", icon: "🧊", stackable: true, maxStack: 50, healAmount: 24 },
  "item.salve.dusk": { id: "item.salve.dusk", name: "Duskcap Poultice", icon: "🍯", stackable: true, maxStack: 50, healAmount: 40 },
  "item.salve.ember": { id: "item.salve.ember", name: "Emberleaf Liniment", icon: "🫙", stackable: true, maxStack: 50, healAmount: 55 },
  "item.salve.kings": { id: "item.salve.kings", name: "King's Tincture", icon: "🏺", stackable: true, maxStack: 50, healAmount: 75 },
  // ---- Runecrafting: four mid-tier runes filling the Fire->Nature dead zone ----
  "item.rune.body": { id: "item.rune.body", name: "Copper Rune", icon: "🟫", stackable: true, maxStack: 99 },
  "item.rune.cosmic": { id: "item.rune.cosmic", name: "Star Rune", icon: "✨", stackable: true, maxStack: 99 },
  "item.rune.chaos": { id: "item.rune.chaos", name: "Crimson Rune", icon: "💥", stackable: true, maxStack: 99 },
  "item.rune.astral": { id: "item.rune.astral", name: "Glowstone Rune", icon: "💫", stackable: true, maxStack: 99 },
  // ---- Construction: three plank tiers + a flatpack furniture set ----
  "item.plank.oak": { id: "item.plank.oak", name: "Oak Plank", icon: "🪵", stackable: true, maxStack: 50 },
  "item.plank.teak": { id: "item.plank.teak", name: "Teak Plank", icon: "🪵", stackable: true, maxStack: 50 },
  "item.plank.mahogany": { id: "item.plank.mahogany", name: "Mahogany Plank", icon: "🪵", stackable: true, maxStack: 50 },
  "item.flatpack.stool": { id: "item.flatpack.stool", name: "Stool (flatpack)", icon: "🪑", stackable: true, maxStack: 50 },
  "item.flatpack.crate": { id: "item.flatpack.crate", name: "Crate (flatpack)", icon: "📦", stackable: true, maxStack: 50 },
  "item.flatpack.chair": { id: "item.flatpack.chair", name: "Chair (flatpack)", icon: "🪑", stackable: true, maxStack: 50 },
  "item.flatpack.table": { id: "item.flatpack.table", name: "Table (flatpack)", icon: "🛋️", stackable: true, maxStack: 50 },
  "item.flatpack.bench": { id: "item.flatpack.bench", name: "Bench (flatpack)", icon: "🛋️", stackable: true, maxStack: 50 },
  "item.flatpack.bookshelf": { id: "item.flatpack.bookshelf", name: "Bookshelf (flatpack)", icon: "📚", stackable: true, maxStack: 50 },
  "item.flatpack.bed": { id: "item.flatpack.bed", name: "Bed (flatpack)", icon: "🛏️", stackable: true, maxStack: 50 },
  "item.flatpack.dresser": { id: "item.flatpack.dresser", name: "Oak Dresser (flatpack)", icon: "🗄️", stackable: true, maxStack: 50 },
  "item.flatpack.wardrobe": { id: "item.flatpack.wardrobe", name: "Oak Wardrobe (flatpack)", icon: "🚪", stackable: true, maxStack: 50 },
  "item.flatpack.hearth": { id: "item.flatpack.hearth", name: "Stone Hearth (flatpack)", icon: "🔥", stackable: true, maxStack: 50 },
  "item.flatpack.fireplace": { id: "item.flatpack.fireplace", name: "Teak Fireplace (flatpack)", icon: "🔥", stackable: true, maxStack: 50 },
  "item.flatpack.cabinet": { id: "item.flatpack.cabinet", name: "Teak Cabinet (flatpack)", icon: "🗄️", stackable: true, maxStack: 50 },
  "item.flatpack.shelf": { id: "item.flatpack.shelf", name: "Mahogany Wall Shelf (flatpack)", icon: "📚", stackable: true, maxStack: 50 },
  "item.flatpack.fourposter": { id: "item.flatpack.fourposter", name: "Four-Poster Bed (flatpack)", icon: "🛏️", stackable: true, maxStack: 50 },
  "item.flatpack.throne": { id: "item.flatpack.throne", name: "Gilded Throne (flatpack)", icon: "👑", stackable: true, maxStack: 50 },
  "item.flatpack.altar": { id: "item.flatpack.altar", name: "Marble Altar (flatpack)", icon: "⛩️", stackable: true, maxStack: 50 },
  // ---- Smelting: the steel/mithril/adamant/runite bar ladder ----
  "item.bar.steel": { id: "item.bar.steel", name: "Steel Bar", icon: "⬜", stackable: true, maxStack: 50 },
  "item.bar.mithril": { id: "item.bar.mithril", name: "Mithril Bar", icon: "🟦", stackable: true, maxStack: 50 },
  "item.bar.adamant": { id: "item.bar.adamant", name: "Adamant Bar", icon: "🟩", stackable: true, maxStack: 50 },
  "item.bar.runite": { id: "item.bar.runite", name: "Runite Bar", icon: "🟦", stackable: true, maxStack: 50 },
  // ---- Mining: three high-tier metal ores feeding the bar ladder ----
  "item.ore.mithril": { id: "item.ore.mithril", name: "Mithril Ore", icon: "🔵", stackable: true, maxStack: 50 },
  "item.ore.adamant": { id: "item.ore.adamant", name: "Adamantite Ore", icon: "🟢", stackable: true, maxStack: 50 },
  "item.ore.runite": { id: "item.ore.runite", name: "Runite Ore", icon: "🩵", stackable: true, maxStack: 50 },
  // ---- Smithing: steel/mithril/adamant/rune/diamond/netherite armor sets ----
  "armor.cap.steel": { id: "armor.cap.steel", name: "Steel Helm", icon: "🪖", stackable: false, maxStack: 1, armorSlot: "head", protection: 0.21 },
  "armor.tunic.steel": { id: "armor.tunic.steel", name: "Steel Chestplate", icon: "👕", stackable: false, maxStack: 1, armorSlot: "body", protection: 0.21 },
  "armor.leggings.steel": { id: "armor.leggings.steel", name: "Steel Greaves", icon: "👖", stackable: false, maxStack: 1, armorSlot: "legs", protection: 0.21 },
  "armor.boots.steel": { id: "armor.boots.steel", name: "Steel Sabatons", icon: "🥾", stackable: false, maxStack: 1, armorSlot: "feet", protection: 0.17 },
  "armor.cap.mithril": { id: "armor.cap.mithril", name: "Mithril Helm", icon: "🪖", stackable: false, maxStack: 1, armorSlot: "head", protection: 0.22 },
  "armor.tunic.mithril": { id: "armor.tunic.mithril", name: "Mithril Chestplate", icon: "👕", stackable: false, maxStack: 1, armorSlot: "body", protection: 0.22 },
  "armor.leggings.mithril": { id: "armor.leggings.mithril", name: "Mithril Greaves", icon: "👖", stackable: false, maxStack: 1, armorSlot: "legs", protection: 0.22 },
  "armor.boots.mithril": { id: "armor.boots.mithril", name: "Mithril Sabatons", icon: "🥾", stackable: false, maxStack: 1, armorSlot: "feet", protection: 0.18 },
  "armor.cap.adamant": { id: "armor.cap.adamant", name: "Adamant Helm", icon: "🪖", stackable: false, maxStack: 1, armorSlot: "head", protection: 0.23 },
  "armor.tunic.adamant": { id: "armor.tunic.adamant", name: "Adamant Chestplate", icon: "👕", stackable: false, maxStack: 1, armorSlot: "body", protection: 0.23 },
  "armor.leggings.adamant": { id: "armor.leggings.adamant", name: "Adamant Greaves", icon: "👖", stackable: false, maxStack: 1, armorSlot: "legs", protection: 0.23 },
  "armor.boots.adamant": { id: "armor.boots.adamant", name: "Adamant Sabatons", icon: "🥾", stackable: false, maxStack: 1, armorSlot: "feet", protection: 0.19 },
  "armor.cap.rune": { id: "armor.cap.rune", name: "Rune Helm", icon: "🪖", stackable: false, maxStack: 1, armorSlot: "head", protection: 0.24 },
  "armor.tunic.rune": { id: "armor.tunic.rune", name: "Rune Chestplate", icon: "👕", stackable: false, maxStack: 1, armorSlot: "body", protection: 0.24 },
  "armor.leggings.rune": { id: "armor.leggings.rune", name: "Rune Greaves", icon: "👖", stackable: false, maxStack: 1, armorSlot: "legs", protection: 0.24 },
  "armor.boots.rune": { id: "armor.boots.rune", name: "Rune Sabatons", icon: "🥾", stackable: false, maxStack: 1, armorSlot: "feet", protection: 0.2 },
  "armor.cap.diamond": { id: "armor.cap.diamond", name: "Diamond Helm", icon: "🪖", stackable: false, maxStack: 1, armorSlot: "head", protection: 0.25 },
  "armor.tunic.diamond": { id: "armor.tunic.diamond", name: "Diamond Chestplate", icon: "👕", stackable: false, maxStack: 1, armorSlot: "body", protection: 0.25 },
  "armor.leggings.diamond": { id: "armor.leggings.diamond", name: "Diamond Greaves", icon: "👖", stackable: false, maxStack: 1, armorSlot: "legs", protection: 0.25 },
  "armor.boots.diamond": { id: "armor.boots.diamond", name: "Diamond Sabatons", icon: "🥾", stackable: false, maxStack: 1, armorSlot: "feet", protection: 0.21 },
  "armor.cap.netherite": { id: "armor.cap.netherite", name: "Netherite Helm", icon: "🪖", stackable: false, maxStack: 1, armorSlot: "head", protection: 0.26 },
  "armor.tunic.netherite": { id: "armor.tunic.netherite", name: "Netherite Chestplate", icon: "👕", stackable: false, maxStack: 1, armorSlot: "body", protection: 0.26 },
  "armor.leggings.netherite": { id: "armor.leggings.netherite", name: "Netherite Greaves", icon: "👖", stackable: false, maxStack: 1, armorSlot: "legs", protection: 0.26 },
  "armor.boots.netherite": { id: "armor.boots.netherite", name: "Netherite Sabatons", icon: "🥾", stackable: false, maxStack: 1, armorSlot: "feet", protection: 0.22 },
  // ---- Enchanting: gap-filler + ceiling-extension items ----
  "armor.boots.runed": { id: "armor.boots.runed", name: "Runed Sabatons", icon: "🥾", stackable: false, maxStack: 1, armorSlot: "feet", protection: 0.22 },
  "tool.sword.astral": { id: "tool.sword.astral", name: "Astral Blade", icon: "🗡️", stackable: false, maxStack: 1, toolTags: ["weapon"], damageBonus: 11 },
  // ---- Fishing: a rod ladder with success bonuses ----
  "tool.fishingrod.fly": { id: "tool.fishingrod.fly", name: "Feathered Fly Rod", icon: "🎣", stackable: false, maxStack: 1, toolTags: ["fishing_tool"], successBonus: 0.1 },
  "tool.fishingrod.barbed": { id: "tool.fishingrod.barbed", name: "Barbed Rod", icon: "🎣", stackable: false, maxStack: 1, toolTags: ["fishing_tool"], successBonus: 0.16 },
  "tool.fishingrod.pearl": { id: "tool.fishingrod.pearl", name: "Pearlshell Rod", icon: "🎣", stackable: false, maxStack: 1, toolTags: ["fishing_tool"], successBonus: 0.22 },
  "tool.fishingrod.enchanted": { id: "tool.fishingrod.enchanted", name: "Enchanted Rod", icon: "🎣", stackable: false, maxStack: 1, toolTags: ["fishing_tool"], successBonus: 0.28 },
  // ---- Fletching: metal-tipped arrows carrying per-shot damage ----
  "item.arrow.steel": { id: "item.arrow.steel", name: "Steel Arrows", icon: "🏹", stackable: true, maxStack: 99, damageBonus: 3 },
  "item.arrow.mithril": { id: "item.arrow.mithril", name: "Mithril Arrows", icon: "🏹", stackable: true, maxStack: 99, damageBonus: 5 },
  "item.arrow.adamant": { id: "item.arrow.adamant", name: "Adamant Arrows", icon: "🏹", stackable: true, maxStack: 99, damageBonus: 7 },
  "item.arrow.rune": { id: "item.arrow.rune", name: "Rune Arrows", icon: "🏹", stackable: true, maxStack: 99, damageBonus: 10 },
  // ---- Boating: two faster hulls extending the Mariner ladder ----
  "tool.boat.cutter": { id: "tool.boat.cutter", name: "River Cutter", icon: "⛵", stackable: false, maxStack: 1, toolTags: ["boat"], boat: { speed: 7.6, level: 34 } },
  "tool.boat.longship": { id: "tool.boat.longship", name: "Coastal Longship", icon: "⛵", stackable: false, maxStack: 1, toolTags: ["boat"], boat: { speed: 9.2, level: 55 } },
  // ---- Summoning: two higher familiar pouches ----
  "item.pouch.lynx": { id: "item.pouch.lynx", name: "Blood Lynx Reins", icon: "🐈", stackable: true, maxStack: 20, mount: { speed: 1.55 } },
  "item.pouch.drake": { id: "item.pouch.drake", name: "Storm Drake Reins", icon: "🐲", stackable: true, maxStack: 20, mount: { speed: 1.7 } },
  // ---- Farming: two higher crops (seed + produce) ----
  "item.seed.corn": { id: "item.seed.corn", name: "Sweetcorn Seed", icon: "🌱", stackable: true, maxStack: 50 },
  "item.crop.corn": { id: "item.crop.corn", name: "Sweetcorn", icon: "🌽", stackable: true, maxStack: 50, healAmount: 7 },
  "item.seed.sunfruit": { id: "item.seed.sunfruit", name: "Sunfruit Seed", icon: "🌱", stackable: true, maxStack: 50 },
  "item.crop.sunfruit": { id: "item.crop.sunfruit", name: "Sunfruit", icon: "🟠", stackable: true, maxStack: 50, healAmount: 12 },
};

// Firemaking: lighting a log in the pack trains it, on a ladder that mirrors
// the woodcutting tiers — so the wood you cut is the wood you burn.
const LOG_FIRE: Record<string, { level: number; xp: number }> = {
  "item.log.basic": { level: 1, xp: 25 },
  "item.log.birch": { level: 10, xp: 45 },
  "item.log.spruce": { level: 20, xp: 68 },
  "item.log.jungle": { level: 35, xp: 96 },
  "item.log.acacia": { level: 50, xp: 128 },
  "item.log.darkoak": { level: 65, xp: 168 },
  "item.log.blossom": { level: 80, xp: 230 },
  "item.log.ember": { level: 86, xp: 290 },
  "item.log.glow": { level: 92, xp: 360 },
  "item.log.dusk": { level: 96, xp: 450 },
};
for (const [id, fm] of Object.entries(LOG_FIRE)) ITEMS[id].firemaking = fm;

// Prayer: burying bones. Coarser bones need a little standing to handle, and
// pay far more — a ladder from the commonest bones to dragon bones.
const BONE_PRAYER: Record<string, { level: number; xp: number }> = {
  "item.bone.old": { level: 1, xp: 15 },
  "item.bone.big": { level: 20, xp: 45 },
  "item.bone.dragon": { level: 40, xp: 180 },
  "item.bone.ancient": { level: 60, xp: 340 },
  "item.bone.warden": { level: 80, xp: 620 },
};
for (const [id, p] of Object.entries(BONE_PRAYER)) ITEMS[id].prayer = p;

/** High/Low Alchemy (Magic) coin values per item — turning goods to gold. */
export const ALCH_VALUES: Record<string, number> = {
  "item.bar.copper": 12, "item.bar.tin": 12, "item.bar.bronze": 20, "item.bar.iron": 36,
  "item.bar.gold": 60, "item.ingot.netherite": 900,
  "item.bar.steel": 55, "item.bar.mithril": 100, "item.bar.adamant": 170, "item.bar.runite": 270,
  "tool.sword.astral": 320,
  // Smithed gear below diamond: every tier alchs, so training Smithing has a
  // coin sink instead of a pack full of unsellable swords and helms.
  "tool.sword.copper": 18, "tool.sword.bronze": 34, "tool.sword.iron": 60, "tool.sword.runed": 90,
  "armor.cap.copper": 16, "armor.tunic.copper": 24, "armor.leggings.copper": 20, "armor.boots.copper": 12,
  "armor.cap.bronze": 28, "armor.tunic.bronze": 42, "armor.leggings.bronze": 34, "armor.boots.bronze": 20,
  "armor.cap.iron": 50, "armor.tunic.iron": 75, "armor.leggings.iron": 62, "armor.boots.iron": 36,
  "armor.cap.steel": 80, "armor.tunic.steel": 120, "armor.leggings.steel": 100, "armor.boots.steel": 58,
  "armor.cap.mithril": 140, "armor.tunic.mithril": 210, "armor.leggings.mithril": 175, "armor.boots.mithril": 100,
  "armor.cap.leather": 10, "armor.tunic.leather": 15, "armor.leggings.leather": 12, "armor.boots.leather": 8,
  "item.gem.opal": 15, "item.gem.jade": 26, "item.gem.topaz": 40, "item.gem.sapphire": 66,
  "item.gem.emerald": 120, "item.gem.ruby": 120, "item.gem.diamond": 180, "item.gem.dragonstone": 380,
  "item.ring.opal": 60, "item.ring.sapphire": 170, "item.amulet.emerald": 320,
  "item.amulet.ruby": 520, "item.amulet.dragonstone": 1300,
  "tool.bow.oak": 40, "tool.bow.spruce": 70, "tool.bow.jungle": 110, "tool.bow.dark": 200,
  "tool.sword.diamond": 260, "tool.pickaxe.diamond": 220, "tool.axe.diamond": 220,
};
/** Magic level to cast each alchemy spell, XP earned, and the rune it burns.
 *  Coin-alchemy tiers: the higher the tier, the richer the return and the rarer
 *  the rune it demands. */
export const ALCHEMY = {
  low: { level: 1, xp: 31, rune: "item.rune.fire", factor: 0.55 },
  high: { level: 21, xp: 65, rune: "item.rune.nature", factor: 1.0 },
  grand: { level: 44, xp: 90, rune: "item.rune.law", factor: 1.5 },
  master: { level: 68, xp: 140, rune: "item.rune.death", factor: 2.1 },
};
/** Ordered best-first, so the HUD/handler can pick the strongest tier the
 *  caster can afford. */
export const ALCHEMY_TIERS = ["master", "grand", "high", "low"] as const;
export type AlchemyTier = (typeof ALCHEMY_TIERS)[number];

/** Superheat (Magic L35): smelt an ore straight to its bar without a furnace,
 *  burning one Blaze (Fire) Rune. A Magic productivity spell that fills the old
 *  L21->44 dead zone; awards both Magic and Smithing XP. */
export const SUPERHEAT = {
  level: 35,
  magicXp: 55,
  rune: "item.rune.fire",
  bars: {
    "item.ore.copper": { bar: "item.bar.copper", xp: 30 },
    "item.ore.tin": { bar: "item.bar.tin", xp: 30 },
    "item.ore.iron": { bar: "item.bar.iron", xp: 40 },
    "item.ore.gold": { bar: "item.bar.gold", xp: 60 },
    "item.ore.mithril": { bar: "item.bar.mithril", xp: 80 },
    "item.ore.adamant": { bar: "item.bar.adamant", xp: 120 },
    "item.ore.runite": { bar: "item.bar.runite", xp: 160 },
  } as Record<string, { bar: string; xp: number }>,
};

/** Runecrafting: essence bound into runes at an altar. RS-authentic levels. */
export const RUNE_CRAFT: Array<{ runeId: string; level: number; xp: number; per: number }> = [
  { runeId: "item.rune.air", level: 1, xp: 5, per: 1 },
  { runeId: "item.rune.water", level: 5, xp: 6, per: 1 },
  { runeId: "item.rune.earth", level: 9, xp: 6.5, per: 1 },
  { runeId: "item.rune.fire", level: 14, xp: 7, per: 1 },
  { runeId: "item.rune.body", level: 20, xp: 7.5, per: 1 },
  { runeId: "item.rune.cosmic", level: 27, xp: 7.9, per: 1 },
  { runeId: "item.rune.chaos", level: 35, xp: 8.4, per: 1 },
  { runeId: "item.rune.astral", level: 40, xp: 8.8, per: 1 },
  { runeId: "item.rune.nature", level: 44, xp: 9, per: 1 },
  { runeId: "item.rune.law", level: 54, xp: 9.5, per: 1 },
  { runeId: "item.rune.death", level: 65, xp: 10, per: 1 },
  { runeId: "item.rune.blood", level: 77, xp: 10.5, per: 1 },
  { runeId: "item.rune.soul", level: 90, xp: 11, per: 1 },
];

/** Rarity-weighted gem table for mining strikes: the finer the stone, the
 *  rarer the find. Rolled on a successful mining cycle. */
export const MINING_GEMS: Array<{ itemId: string; weight: number }> = [
  { itemId: "item.gem.opal", weight: 100 },
  { itemId: "item.gem.jade", weight: 60 },
  { itemId: "item.gem.topaz", weight: 38 },
  { itemId: "item.gem.sapphire", weight: 22 },
  { itemId: "item.gem.ruby", weight: 11 },
  { itemId: "item.gem.emerald", weight: 6 },
  { itemId: "item.gem.diamond", weight: 3 },
  { itemId: "item.gem.dragonstone", weight: 1 },
];
/** Chance per successful mining cycle to strike a gem. */
export const MINING_GEM_CHANCE = 0.014;

export interface RecipeItem {
  itemId: string;
  qty: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  skillId: string;
  requiredLevel: number;
  cycleTimeS: number;
  inputs: RecipeItem[];
  outputs: RecipeItem[];
  /** Produced instead of outputs on a failed roll (e.g. burnt food). */
  failOutputs?: RecipeItem[];
  successBase: number;
  successPerLevel: number;
  successMax: number;
  xp: number; // awarded on success only
  /** Tool needed to work the recipe (equipped or carried), e.g. a hammer. */
  toolTagsAny?: string[];
}

export const RECIPES: Record<string, RecipeDef> = {
  "recipe.cooked_fish": {
    id: "recipe.cooked_fish",
    name: "Cooked Fish",
    skillId: "skill.cooking",
    requiredLevel: 1,
    cycleTimeS: 2.5,
    inputs: [{ itemId: "item.fish.raw", qty: 1 }],
    outputs: [{ itemId: "item.fish.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.7,
    successPerLevel: 0.015,
    successMax: 0.99,
    xp: 22,
  },
  "recipe.copper_bar": {
    id: "recipe.copper_bar",
    name: "Copper Bar",
    skillId: "skill.smithing",
    requiredLevel: 1,
    cycleTimeS: 3.0,
    inputs: [{ itemId: "item.ore.copper", qty: 2 }],
    outputs: [{ itemId: "item.bar.copper", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 30,
  },
  "recipe.gold_bar": {
    id: "recipe.gold_bar",
    name: "Gold Bar",
    skillId: "skill.smithing",
    requiredLevel: 35,
    cycleTimeS: 3.4,
    inputs: [{ itemId: "item.ore.gold", qty: 2 }, { itemId: "item.ore.coal", qty: 1 }],
    outputs: [{ itemId: "item.bar.gold", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 120,
  },
  "recipe.tin_bar": {
    id: "recipe.tin_bar",
    name: "Tin Bar",
    skillId: "skill.smithing",
    requiredLevel: 2,
    cycleTimeS: 3.0,
    inputs: [{ itemId: "item.ore.tin", qty: 2 }],
    outputs: [{ itemId: "item.bar.tin", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 34,
  },
  "recipe.bronze_bar": {
    id: "recipe.bronze_bar",
    name: "Bronze Bar",
    skillId: "skill.smithing",
    requiredLevel: 3,
    cycleTimeS: 3.5,
    inputs: [
      { itemId: "item.bar.copper", qty: 1 },
      { itemId: "item.bar.tin", qty: 1 },
    ],
    outputs: [{ itemId: "item.bar.bronze", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 55,
  },
  "recipe.copper_sword": {
    id: "recipe.copper_sword",
    name: "Copper Sword",
    skillId: "skill.smithing",
    requiredLevel: 1,
    cycleTimeS: 3.5,
    inputs: [{ itemId: "item.bar.copper", qty: 2 }],
    outputs: [{ itemId: "tool.sword.copper", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 40,
    toolTagsAny: ["hammer"],
  },
  "recipe.copper_axe": {
    id: "recipe.copper_axe",
    name: "Copper Axe",
    skillId: "skill.smithing",
    requiredLevel: 2,
    cycleTimeS: 3.5,
    inputs: [{ itemId: "item.bar.copper", qty: 2 }],
    outputs: [{ itemId: "tool.axe.copper", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 45,
    toolTagsAny: ["hammer"],
  },
  "recipe.copper_pickaxe": {
    id: "recipe.copper_pickaxe",
    name: "Copper Pickaxe",
    skillId: "skill.smithing",
    requiredLevel: 2,
    cycleTimeS: 3.5,
    inputs: [{ itemId: "item.bar.copper", qty: 2 }],
    outputs: [{ itemId: "tool.pickaxe.copper", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 45,
    toolTagsAny: ["hammer"],
  },
  "recipe.bronze_sword": {
    id: "recipe.bronze_sword",
    name: "Bronze Sword",
    skillId: "skill.smithing",
    requiredLevel: 4,
    cycleTimeS: 4.0,
    inputs: [{ itemId: "item.bar.bronze", qty: 2 }],
    outputs: [{ itemId: "tool.sword.bronze", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 70,
    toolTagsAny: ["hammer"],
  },
  "recipe.stone_brick": {
    id: "recipe.stone_brick",
    name: "Stone Brick",
    skillId: "skill.smithing",
    requiredLevel: 1,
    cycleTimeS: 2.0,
    inputs: [{ itemId: "item.stone.rough", qty: 2 }],
    outputs: [{ itemId: "item.brick.stone", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 12,
  },
  "recipe.iron_bar": {
    id: "recipe.iron_bar",
    name: "Iron Bar",
    skillId: "skill.smithing",
    requiredLevel: 4,
    cycleTimeS: 4.0,
    inputs: [{ itemId: "item.ore.iron", qty: 2 }],
    outputs: [{ itemId: "item.bar.iron", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 62,
  },
  "recipe.bronze_axe": {
    id: "recipe.bronze_axe",
    name: "Bronze Axe",
    skillId: "skill.smithing",
    requiredLevel: 4,
    cycleTimeS: 3.5,
    inputs: [{ itemId: "item.bar.bronze", qty: 2 }],
    outputs: [{ itemId: "tool.axe.bronze", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 66,
    toolTagsAny: ["hammer"],
  },
  "recipe.bronze_pickaxe": {
    id: "recipe.bronze_pickaxe",
    name: "Bronze Pickaxe",
    skillId: "skill.smithing",
    requiredLevel: 4,
    cycleTimeS: 3.5,
    inputs: [{ itemId: "item.bar.bronze", qty: 2 }],
    outputs: [{ itemId: "tool.pickaxe.bronze", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 66,
    toolTagsAny: ["hammer"],
  },
  "recipe.iron_sword": {
    id: "recipe.iron_sword",
    name: "Iron Sword",
    skillId: "skill.smithing",
    requiredLevel: 6,
    cycleTimeS: 4.5,
    inputs: [{ itemId: "item.bar.iron", qty: 2 }],
    outputs: [{ itemId: "tool.sword.iron", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 110,
    toolTagsAny: ["hammer"],
  },
  "recipe.iron_axe": {
    id: "recipe.iron_axe",
    name: "Iron Axe",
    skillId: "skill.smithing",
    requiredLevel: 5,
    cycleTimeS: 4.0,
    inputs: [{ itemId: "item.bar.iron", qty: 2 }],
    outputs: [{ itemId: "tool.axe.iron", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 95,
    toolTagsAny: ["hammer"],
  },
  "recipe.iron_pickaxe": {
    id: "recipe.iron_pickaxe",
    name: "Iron Pickaxe",
    skillId: "skill.smithing",
    requiredLevel: 5,
    cycleTimeS: 4.0,
    inputs: [{ itemId: "item.bar.iron", qty: 2 }],
    outputs: [{ itemId: "tool.pickaxe.iron", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 95,
    toolTagsAny: ["hammer"],
  },
  "recipe.gold_ring": {
    id: "recipe.gold_ring",
    name: "Gold Ring",
    skillId: "skill.smithing",
    requiredLevel: 35,
    cycleTimeS: 3.2,
    inputs: [{ itemId: "item.bar.gold", qty: 1 }],
    outputs: [{ itemId: "item.ring.gold", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 95,
    toolTagsAny: ["hammer"],
  },
  "recipe.gold_amulet": {
    id: "recipe.gold_amulet",
    name: "Gold Amulet",
    skillId: "skill.smithing",
    requiredLevel: 40,
    cycleTimeS: 3.6,
    inputs: [{ itemId: "item.bar.gold", qty: 2 }],
    outputs: [{ itemId: "item.amulet.gold", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 150,
    toolTagsAny: ["hammer"],
  },
  "recipe.diamond_sword": {
    id: "recipe.diamond_sword",
    name: "Diamond-edged Sword",
    skillId: "skill.smithing",
    requiredLevel: 50,
    cycleTimeS: 4.6,
    inputs: [
      { itemId: "item.bar.iron", qty: 2 },
      { itemId: "item.gem.diamond", qty: 2 },
    ],
    outputs: [{ itemId: "tool.sword.diamond", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 260,
    toolTagsAny: ["hammer"],
  },
  "recipe.diamond_axe": {
    id: "recipe.diamond_axe",
    name: "Diamond-edged Axe",
    skillId: "skill.smithing",
    requiredLevel: 52,
    cycleTimeS: 4.4,
    inputs: [
      { itemId: "item.bar.iron", qty: 1 },
      { itemId: "item.gem.diamond", qty: 2 },
    ],
    outputs: [{ itemId: "tool.axe.diamond", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 230,
    toolTagsAny: ["hammer"],
  },
  "recipe.diamond_pickaxe": {
    id: "recipe.diamond_pickaxe",
    name: "Diamond-tipped Pickaxe",
    skillId: "skill.smithing",
    requiredLevel: 54,
    cycleTimeS: 4.4,
    inputs: [
      { itemId: "item.bar.iron", qty: 1 },
      { itemId: "item.gem.diamond", qty: 2 },
    ],
    outputs: [{ itemId: "tool.pickaxe.diamond", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 230,
    toolTagsAny: ["hammer"],
  },
  // ---- Netherite: smelt ancient debris to scrap, alloy with gold, then
  // upgrade diamond gear at the anvil (the Minecraft way). ----
  "recipe.netherite_scrap": {
    id: "recipe.netherite_scrap",
    name: "Netherite Scrap",
    skillId: "skill.smithing",
    requiredLevel: 60,
    cycleTimeS: 5.0,
    inputs: [
      { itemId: "item.debris.ancient", qty: 1 },
      { itemId: "item.ore.coal", qty: 2 },
    ],
    outputs: [{ itemId: "item.scrap.netherite", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 220,
  },
  "recipe.netherite_ingot": {
    id: "recipe.netherite_ingot",
    name: "Netherite Ingot",
    skillId: "skill.smithing",
    requiredLevel: 72,
    cycleTimeS: 6.0,
    inputs: [
      { itemId: "item.scrap.netherite", qty: 4 },
      { itemId: "item.bar.gold", qty: 4 },
    ],
    outputs: [{ itemId: "item.ingot.netherite", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 360,
  },
  "recipe.netherite_axe": {
    id: "recipe.netherite_axe",
    name: "Netherite Axe",
    skillId: "skill.smithing",
    requiredLevel: 68,
    cycleTimeS: 5.0,
    inputs: [
      { itemId: "tool.axe.diamond", qty: 1 },
      { itemId: "item.ingot.netherite", qty: 1 },
    ],
    outputs: [{ itemId: "tool.axe.netherite", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 420,
    toolTagsAny: ["hammer"],
  },
  "recipe.netherite_pickaxe": {
    id: "recipe.netherite_pickaxe",
    name: "Netherite Pickaxe",
    skillId: "skill.smithing",
    requiredLevel: 70,
    cycleTimeS: 5.0,
    inputs: [
      { itemId: "tool.pickaxe.diamond", qty: 1 },
      { itemId: "item.ingot.netherite", qty: 1 },
    ],
    outputs: [{ itemId: "tool.pickaxe.netherite", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 420,
    toolTagsAny: ["hammer"],
  },
  "recipe.netherite_sword": {
    id: "recipe.netherite_sword",
    name: "Netherite Sword",
    skillId: "skill.smithing",
    requiredLevel: 72,
    cycleTimeS: 5.2,
    inputs: [
      { itemId: "tool.sword.diamond", qty: 1 },
      { itemId: "item.ingot.netherite", qty: 1 },
    ],
    outputs: [{ itemId: "tool.sword.netherite", qty: 1 }],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 460,
    toolTagsAny: ["hammer"],
  },
  "recipe.cooked_pork": {
    id: "recipe.cooked_pork",
    name: "Cooked Pork",
    skillId: "skill.cooking",
    requiredLevel: 2,
    cycleTimeS: 3.0,
    inputs: [{ itemId: "item.pork.raw", qty: 1 }],
    outputs: [{ itemId: "item.pork.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.pork.burnt", qty: 1 }],
    successBase: 0.68,
    successPerLevel: 0.015,
    successMax: 0.99,
    xp: 30,
  },
  "recipe.cooked_beef": {
    id: "recipe.cooked_beef",
    name: "Cooked Beef",
    skillId: "skill.cooking",
    requiredLevel: 3,
    cycleTimeS: 3.2,
    inputs: [{ itemId: "item.beef.raw", qty: 1 }],
    outputs: [{ itemId: "item.beef.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.beef.burnt", qty: 1 }],
    successBase: 0.65,
    successPerLevel: 0.015,
    successMax: 0.99,
    xp: 38,
  },
  "recipe.cooked_chicken": {
    id: "recipe.cooked_chicken",
    name: "Roast Chicken",
    skillId: "skill.cooking",
    requiredLevel: 1,
    cycleTimeS: 3.0,
    inputs: [{ itemId: "item.chicken.raw", qty: 1 }],
    outputs: [{ itemId: "item.chicken.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.chicken.burnt", qty: 1 }],
    successBase: 0.7,
    successPerLevel: 0.015,
    successMax: 0.99,
    xp: 26,
  },
  "recipe.cooked_mutton": {
    id: "recipe.cooked_mutton",
    name: "Roast Mutton",
    skillId: "skill.cooking",
    requiredLevel: 2,
    cycleTimeS: 3.2,
    inputs: [{ itemId: "item.mutton.raw", qty: 1 }],
    outputs: [{ itemId: "item.mutton.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.mutton.burnt", qty: 1 }],
    successBase: 0.68,
    successPerLevel: 0.015,
    successMax: 0.99,
    xp: 34,
  },
  "recipe.bread": {
    id: "recipe.bread",
    name: "Fresh Bread",
    skillId: "skill.cooking",
    requiredLevel: 2,
    cycleTimeS: 3.4,
    inputs: [{ itemId: "item.wheat", qty: 2 }],
    outputs: [{ itemId: "item.bread.basic", qty: 1 }],
    failOutputs: [],
    successBase: 0.75,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 30,
  },
  "recipe.roast_pumpkin": {
    id: "recipe.roast_pumpkin",
    name: "Roast Pumpkin",
    skillId: "skill.cooking",
    requiredLevel: 4,
    cycleTimeS: 3.6,
    inputs: [{ itemId: "item.pumpkin", qty: 1 }],
    outputs: [{ itemId: "item.pumpkin.roast", qty: 1 }],
    failOutputs: [],
    successBase: 0.7,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 44,
  },
  "recipe.cut_planks": {
    id: "recipe.cut_planks",
    name: "Cut Planks",
    skillId: "skill.crafting",
    requiredLevel: 1,
    cycleTimeS: 2.4,
    inputs: [{ itemId: "item.log.basic", qty: 1 }],
    outputs: [{ itemId: "item.plank.cut", qty: 2 }],
    failOutputs: [],
    successBase: 0.85,
    successPerLevel: 0.01,
    successMax: 0.99,
    xp: 22,
  },
  "recipe.rope": {
    id: "recipe.rope",
    name: "Coiled Rope",
    skillId: "skill.crafting",
    requiredLevel: 2,
    cycleTimeS: 2.6,
    inputs: [{ itemId: "item.wool", qty: 2 }],
    outputs: [{ itemId: "item.rope", qty: 1 }],
    failOutputs: [],
    successBase: 0.8,
    successPerLevel: 0.01,
    successMax: 0.99,
    xp: 30,
  },
  "recipe.boat_raft": {
    id: "recipe.boat_raft",
    name: "Log Raft",
    skillId: "skill.boating",
    requiredLevel: 1,
    cycleTimeS: 3.5,
    inputs: [{ itemId: "item.plank.cut", qty: 4 }],
    outputs: [{ itemId: "tool.boat.raft", qty: 1 }],
    failOutputs: [],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 30,
  },
  "recipe.boat_rowboat": {
    id: "recipe.boat_rowboat",
    name: "Rowboat",
    skillId: "skill.boating",
    requiredLevel: 8,
    cycleTimeS: 4.5,
    inputs: [{ itemId: "item.plank.cut", qty: 6 }, { itemId: "item.rope", qty: 1 }],
    outputs: [{ itemId: "tool.boat.rowboat", qty: 1 }],
    failOutputs: [],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 70,
  },
  "recipe.boat_skiff": {
    id: "recipe.boat_skiff",
    name: "Swift Skiff",
    skillId: "skill.boating",
    requiredLevel: 20,
    cycleTimeS: 6.0,
    inputs: [{ itemId: "item.plank.cut", qty: 8 }, { itemId: "item.rope", qty: 2 }],
    outputs: [{ itemId: "tool.boat.skiff", qty: 1 }],
    failOutputs: [],
    successBase: 1,
    successPerLevel: 0,
    successMax: 1,
    xp: 140,
  },
  "recipe.bone_charm": {
    id: "recipe.bone_charm",
    name: "Bone Charm",
    skillId: "skill.crafting",
    requiredLevel: 3,
    cycleTimeS: 3.0,
    inputs: [
      { itemId: "item.bone.old", qty: 2 },
      { itemId: "item.rope", qty: 1 },
    ],
    outputs: [{ itemId: "item.charm.bone", qty: 1 }],
    failOutputs: [],
    successBase: 0.75,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 44,
  },
  // ---- gem jewellery: set a struck gem into a gold band or chain ----
  "recipe.ring_opal": {
    id: "recipe.ring_opal",
    name: "Opal Ring",
    skillId: "skill.crafting",
    requiredLevel: 8,
    cycleTimeS: 3.0,
    inputs: [{ itemId: "item.bar.gold", qty: 1 }, { itemId: "item.gem.opal", qty: 1 }],
    outputs: [{ itemId: "item.ring.opal", qty: 1 }],
    failOutputs: [],
    successBase: 0.85,
    successPerLevel: 0.01,
    successMax: 0.99,
    xp: 55,
  },
  "recipe.ring_sapphire": {
    id: "recipe.ring_sapphire",
    name: "Sapphire Ring",
    skillId: "skill.crafting",
    requiredLevel: 20,
    cycleTimeS: 3.2,
    inputs: [{ itemId: "item.bar.gold", qty: 1 }, { itemId: "item.gem.sapphire", qty: 1 }],
    outputs: [{ itemId: "item.ring.sapphire", qty: 1 }],
    failOutputs: [],
    successBase: 0.82,
    successPerLevel: 0.01,
    successMax: 0.99,
    xp: 90,
  },
  "recipe.amulet_emerald": {
    id: "recipe.amulet_emerald",
    name: "Emerald Amulet",
    skillId: "skill.crafting",
    requiredLevel: 34,
    cycleTimeS: 3.6,
    inputs: [{ itemId: "item.bar.gold", qty: 1 }, { itemId: "item.gem.emerald", qty: 1 }],
    outputs: [{ itemId: "item.amulet.emerald", qty: 1 }],
    failOutputs: [],
    successBase: 0.78,
    successPerLevel: 0.01,
    successMax: 0.98,
    xp: 150,
  },
  "recipe.amulet_ruby": {
    id: "recipe.amulet_ruby",
    name: "Ruby Amulet",
    skillId: "skill.crafting",
    requiredLevel: 46,
    cycleTimeS: 4.0,
    inputs: [{ itemId: "item.bar.gold", qty: 1 }, { itemId: "item.gem.ruby", qty: 1 }],
    outputs: [{ itemId: "item.amulet.ruby", qty: 1 }],
    failOutputs: [],
    successBase: 0.74,
    successPerLevel: 0.01,
    successMax: 0.98,
    xp: 210,
  },
  "recipe.amulet_dragonstone": {
    id: "recipe.amulet_dragonstone",
    name: "Dragonstone Amulet",
    skillId: "skill.crafting",
    requiredLevel: 68,
    cycleTimeS: 4.6,
    inputs: [{ itemId: "item.bar.gold", qty: 1 }, { itemId: "item.gem.dragonstone", qty: 1 }],
    outputs: [{ itemId: "item.amulet.dragonstone", qty: 1 }],
    failOutputs: [],
    successBase: 0.7,
    successPerLevel: 0.01,
    successMax: 0.98,
    xp: 340,
  },
  "recipe.runed_axe": {
    id: "recipe.runed_axe",
    name: "Runed Axe",
    skillId: "skill.enchanting",
    requiredLevel: 1,
    cycleTimeS: 4.0,
    inputs: [
      { itemId: "tool.axe.iron", qty: 1 },
      { itemId: "item.relic.idol", qty: 1 },
    ],
    outputs: [{ itemId: "tool.axe.runed", qty: 1 }],
    failOutputs: [],
    successBase: 0.9,
    successPerLevel: 0.01,
    successMax: 0.99,
    xp: 90,
  },
  "recipe.runed_pickaxe": {
    id: "recipe.runed_pickaxe",
    name: "Runed Pickaxe",
    skillId: "skill.enchanting",
    requiredLevel: 3,
    cycleTimeS: 4.0,
    inputs: [
      { itemId: "tool.pickaxe.iron", qty: 1 },
      { itemId: "item.relic.idol", qty: 1 },
    ],
    outputs: [{ itemId: "tool.pickaxe.runed", qty: 1 }],
    failOutputs: [],
    successBase: 0.9,
    successPerLevel: 0.01,
    successMax: 0.99,
    xp: 100,
  },
  "recipe.runed_sword": {
    id: "recipe.runed_sword",
    name: "Runed Sword",
    skillId: "skill.enchanting",
    // Gated to sit alongside the diamond weapon tier (Smithing 50) rather than
    // leapfrogging it a few Enchanting levels in.
    requiredLevel: 38,
    cycleTimeS: 4.5,
    inputs: [
      { itemId: "tool.sword.iron", qty: 1 },
      { itemId: "item.relic.idol", qty: 2 },
      { itemId: "item.charm.bone", qty: 1 },
    ],
    outputs: [{ itemId: "tool.sword.runed", qty: 1 }],
    failOutputs: [],
    successBase: 0.85,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 140,
  },
  "recipe.runed_bow": {
    id: "recipe.runed_bow",
    name: "Runed Longbow",
    skillId: "skill.enchanting",
    requiredLevel: 35,
    cycleTimeS: 4.5,
    inputs: [
      { itemId: "tool.bow.yew", qty: 1 },
      { itemId: "item.relic.idol", qty: 1 },
      { itemId: "item.charm.bone", qty: 1 },
    ],
    outputs: [{ itemId: "tool.bow.runed", qty: 1 }],
    failOutputs: [],
    successBase: 0.85,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 150,
  },
  "recipe.potion_swift": {
    id: "recipe.potion_swift",
    name: "Swiftness Draught",
    skillId: "skill.herblore",
    requiredLevel: 1,
    cycleTimeS: 3.0,
    inputs: [
      { itemId: "item.herb.sage", qty: 1 },
      { itemId: "item.feather", qty: 1 },
    ],
    outputs: [{ itemId: "item.potion.swift", qty: 1 }],
    failOutputs: [],
    successBase: 0.8,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 34,
  },
  "recipe.potion_strength": {
    id: "recipe.potion_strength",
    name: "Strength Tonic",
    skillId: "skill.herblore",
    requiredLevel: 3,
    cycleTimeS: 3.4,
    inputs: [
      { itemId: "item.herb.sage", qty: 1 },
      { itemId: "item.bone.old", qty: 1 },
    ],
    outputs: [{ itemId: "item.potion.strength", qty: 1 }],
    failOutputs: [],
    successBase: 0.75,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 48,
  },
  "recipe.potion_stoneskin": {
    id: "recipe.potion_stoneskin",
    name: "Stoneskin Brew",
    skillId: "skill.herblore",
    requiredLevel: 5,
    cycleTimeS: 3.8,
    inputs: [
      { itemId: "item.herb.sage", qty: 1 },
      { itemId: "item.stone.rough", qty: 1 },
    ],
    outputs: [{ itemId: "item.potion.stoneskin", qty: 1 }],
    failOutputs: [],
    successBase: 0.7,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 64,
  },
  "recipe.bow_wood": {
    id: "recipe.bow_wood",
    name: "Shortbow",
    skillId: "skill.fletching",
    requiredLevel: 2,
    cycleTimeS: 3.2,
    inputs: [
      { itemId: "item.plank.cut", qty: 2 },
      { itemId: "item.rope", qty: 1 },
    ],
    outputs: [{ itemId: "tool.bow.wood", qty: 1 }],
    failOutputs: [],
    successBase: 0.8,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 46,
  },
  "recipe.bow_yew": {
    id: "recipe.bow_yew",
    name: "Yew Longbow",
    skillId: "skill.fletching",
    requiredLevel: 30,
    cycleTimeS: 3.8,
    inputs: [
      { itemId: "item.plank.cut", qty: 3 },
      { itemId: "item.rope", qty: 2 },
      { itemId: "item.charm.bone", qty: 1 },
    ],
    outputs: [{ itemId: "tool.bow.yew", qty: 1 }],
    failOutputs: [],
    successBase: 0.72,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 80,
  },
  "recipe.healing_salve": {
    id: "recipe.healing_salve",
    name: "Healing Salve",
    skillId: "skill.herblore",
    requiredLevel: 1,
    cycleTimeS: 3.0,
    inputs: [{ itemId: "item.herb.sage", qty: 2 }],
    outputs: [{ itemId: "item.salve.healing", qty: 1 }],
    failOutputs: [],
    successBase: 0.8,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 32,
  },
  "recipe.oakblood_tonic": {
    id: "recipe.oakblood_tonic",
    name: "Oakblood Tonic",
    skillId: "skill.herblore",
    requiredLevel: 5,
    cycleTimeS: 3.4,
    inputs: [
      { itemId: "item.herb.emberleaf", qty: 1 },
      { itemId: "item.berry.basic", qty: 2 },
    ],
    outputs: [{ itemId: "item.tonic.oakblood", qty: 1 }],
    failOutputs: [],
    successBase: 0.72,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 55,
  },
  "recipe.potion_gathering": {
    id: "recipe.potion_gathering",
    name: "Forager's Brew",
    skillId: "skill.herblore",
    requiredLevel: 2,
    cycleTimeS: 3.2,
    inputs: [
      { itemId: "item.herb.mint", qty: 1 },
      { itemId: "item.herb.sage", qty: 1 },
    ],
    outputs: [{ itemId: "item.potion.gathering", qty: 1 }],
    failOutputs: [],
    successBase: 0.78,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 40,
  },
  "recipe.potion_focus": {
    id: "recipe.potion_focus",
    name: "Hunter's Focus",
    skillId: "skill.herblore",
    requiredLevel: 7,
    cycleTimeS: 3.6,
    inputs: [
      { itemId: "item.herb.emberleaf", qty: 1 },
      { itemId: "item.feather", qty: 2 },
    ],
    outputs: [{ itemId: "item.potion.focus", qty: 1 }],
    failOutputs: [],
    successBase: 0.7,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 70,
  },
  "recipe.trap_basic": {
    id: "recipe.trap_basic",
    name: "Rope Snare",
    skillId: "skill.crafting",
    requiredLevel: 1,
    cycleTimeS: 2.8,
    inputs: [
      { itemId: "item.log.basic", qty: 2 },
      { itemId: "item.rope", qty: 1 },
    ],
    outputs: [{ itemId: "tool.trap.basic", qty: 1 }],
    failOutputs: [],
    successBase: 0.85,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 30,
  },
  "recipe.trap_fine": {
    id: "recipe.trap_fine",
    name: "Fine Box Trap",
    skillId: "skill.crafting",
    requiredLevel: 6,
    cycleTimeS: 3.4,
    inputs: [
      { itemId: "item.plank.cut", qty: 2 },
      { itemId: "item.rope", qty: 2 },
      { itemId: "item.fur", qty: 1 },
    ],
    outputs: [{ itemId: "tool.trap.fine", qty: 1 }],
    failOutputs: [],
    successBase: 0.75,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 72,
  },
  "recipe.cooked_rabbit": {
    id: "recipe.cooked_rabbit",
    name: "Roast Rabbit",
    skillId: "skill.cooking",
    requiredLevel: 2,
    cycleTimeS: 2.6,
    inputs: [{ itemId: "item.game.rabbit", qty: 1 }],
    outputs: [{ itemId: "item.rabbit.cooked", qty: 1 }],
    failOutputs: [],
    successBase: 0.8,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 30,
  },
  "recipe.smoked_eel": {
    id: "recipe.smoked_eel",
    name: "Smoked Eel",
    skillId: "skill.cooking",
    requiredLevel: 10,
    cycleTimeS: 3.0,
    inputs: [{ itemId: "item.fish.eel", qty: 1 }],
    outputs: [{ itemId: "item.eel.cooked", qty: 1 }],
    failOutputs: [],
    successBase: 0.7,
    successPerLevel: 0.012,
    successMax: 0.98,
    xp: 60,
  },
  "recipe.seared_icefin": {
    id: "recipe.seared_icefin",
    name: "Seared Icefin",
    skillId: "skill.cooking",
    requiredLevel: 18,
    cycleTimeS: 3.4,
    inputs: [{ itemId: "item.fish.icefin", qty: 1 }],
    outputs: [{ itemId: "item.icefin.cooked", qty: 1 }],
    failOutputs: [],
    successBase: 0.62,
    successPerLevel: 0.012,
    successMax: 0.96,
    xp: 105,
  },
  "recipe.baked_potato": {
    id: "recipe.baked_potato",
    name: "Baked Potato",
    skillId: "skill.cooking",
    requiredLevel: 12,
    cycleTimeS: 2.6,
    inputs: [{ itemId: "item.crop.potato", qty: 1 }],
    outputs: [{ itemId: "item.potato.baked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.7,
    successPerLevel: 0.012,
    successMax: 0.98,
    xp: 66,
  },
  "recipe.panfried_trout": {
    id: "recipe.panfried_trout",
    name: "Pan-fried Trout",
    skillId: "skill.cooking",
    requiredLevel: 5,
    cycleTimeS: 2.8,
    inputs: [{ itemId: "item.fish.trout", qty: 1 }],
    outputs: [{ itemId: "item.trout.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.72,
    successPerLevel: 0.012,
    successMax: 0.98,
    xp: 44,
  },
  "recipe.roast_seabass": {
    id: "recipe.roast_seabass",
    name: "Roast Sea Bass",
    skillId: "skill.cooking",
    requiredLevel: 30,
    cycleTimeS: 3.6,
    inputs: [{ itemId: "item.fish.seabass", qty: 1 }],
    outputs: [{ itemId: "item.seabass.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.58,
    successPerLevel: 0.012,
    successMax: 0.96,
    xp: 160,
  },
  "recipe.glazed_sunscale": {
    id: "recipe.glazed_sunscale",
    name: "Glazed Sunscale",
    skillId: "skill.cooking",
    requiredLevel: 45,
    cycleTimeS: 4.0,
    inputs: [{ itemId: "item.fish.sunscale", qty: 1 }],
    outputs: [{ itemId: "item.sunscale.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.52,
    successPerLevel: 0.012,
    successMax: 0.95,
    xp: 240,
  },
  "recipe.buttered_shrimp": {
    id: "recipe.buttered_shrimp",
    name: "Buttered Shrimp",
    skillId: "skill.cooking",
    requiredLevel: 1,
    cycleTimeS: 2.4,
    inputs: [{ itemId: "item.fish.shrimp", qty: 1 }],
    outputs: [{ itemId: "item.shrimp.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.8,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 20,
  },
  "recipe.boiled_crab": {
    id: "recipe.boiled_crab",
    name: "Boiled Crab",
    skillId: "skill.cooking",
    requiredLevel: 18,
    cycleTimeS: 3.2,
    inputs: [{ itemId: "item.fish.crab", qty: 1 }],
    outputs: [{ itemId: "item.crab.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.64,
    successPerLevel: 0.012,
    successMax: 0.97,
    xp: 95,
  },
  "recipe.steamed_lobster": {
    id: "recipe.steamed_lobster",
    name: "Steamed Lobster",
    skillId: "skill.cooking",
    requiredLevel: 40,
    cycleTimeS: 3.8,
    inputs: [{ itemId: "item.fish.lobster", qty: 1 }],
    outputs: [{ itemId: "item.lobster.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.54,
    successPerLevel: 0.012,
    successMax: 0.96,
    xp: 210,
  },
  "recipe.grilled_marlin": {
    id: "recipe.grilled_marlin",
    name: "Grilled Marlin",
    skillId: "skill.cooking",
    requiredLevel: 55,
    cycleTimeS: 4.0,
    inputs: [{ itemId: "item.fish.marlin", qty: 1 }],
    outputs: [{ itemId: "item.marlin.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.5,
    successPerLevel: 0.012,
    successMax: 0.95,
    xp: 290,
  },
  "recipe.abyssal_delicacy": {
    id: "recipe.abyssal_delicacy",
    name: "Abyssal Delicacy",
    skillId: "skill.cooking",
    requiredLevel: 70,
    cycleTimeS: 4.2,
    inputs: [{ itemId: "item.fish.gloom", qty: 1 }],
    outputs: [{ itemId: "item.gloom.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.46,
    successPerLevel: 0.012,
    successMax: 0.94,
    xp: 380,
  },
  "recipe.storm_fillet": {
    id: "recipe.storm_fillet",
    name: "Storm-seared Fillet",
    skillId: "skill.cooking",
    requiredLevel: 85,
    cycleTimeS: 4.4,
    inputs: [{ itemId: "item.fish.stormscale", qty: 1 }],
    outputs: [{ itemId: "item.stormscale.cooked", qty: 1 }],
    failOutputs: [{ itemId: "item.fish.burnt", qty: 1 }],
    successBase: 0.42,
    successPerLevel: 0.012,
    successMax: 0.93,
    xp: 480,
  },
  "recipe.carrot_stew": {
    id: "recipe.carrot_stew",
    name: "Carrot Stew",
    skillId: "skill.cooking",
    requiredLevel: 4,
    cycleTimeS: 3.2,
    inputs: [
      { itemId: "item.carrot", qty: 2 },
      { itemId: "item.wheat", qty: 1 },
    ],
    outputs: [{ itemId: "item.stew.carrot", qty: 1 }],
    failOutputs: [],
    successBase: 0.75,
    successPerLevel: 0.012,
    successMax: 0.99,
    xp: 44,
  },
  ...armorRecipes(),
  ...runeRecipes(),
  // ---- Fletching: carve logs into bows, fletch arrows ----
  "recipe.fletch_shafts": {
    id: "recipe.fletch_shafts", name: "Arrow Shafts", skillId: "skill.fletching", requiredLevel: 1,
    cycleTimeS: 2.0, inputs: [{ itemId: "item.log.basic", qty: 1 }], outputs: [{ itemId: "item.arrow.shaft", qty: 5 }],
    successBase: 1, successPerLevel: 0, successMax: 1, xp: 10,
  },
  "recipe.fletch_bronze_arrows": {
    id: "recipe.fletch_bronze_arrows", name: "Bronze Arrows", skillId: "skill.fletching", requiredLevel: 5,
    cycleTimeS: 2.2, inputs: [{ itemId: "item.arrow.shaft", qty: 5 }, { itemId: "item.feather", qty: 5 }, { itemId: "item.bar.bronze", qty: 1 }],
    outputs: [{ itemId: "item.arrow.bronze", qty: 5 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 26,
  },
  "recipe.fletch_iron_arrows": {
    id: "recipe.fletch_iron_arrows", name: "Iron Arrows", skillId: "skill.fletching", requiredLevel: 20,
    cycleTimeS: 2.4, inputs: [{ itemId: "item.arrow.shaft", qty: 5 }, { itemId: "item.feather", qty: 5 }, { itemId: "item.bar.iron", qty: 1 }],
    outputs: [{ itemId: "item.arrow.iron", qty: 5 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 50,
  },
  "recipe.fletch_oak_bow": {
    id: "recipe.fletch_oak_bow", name: "Oak Longbow", skillId: "skill.fletching", requiredLevel: 10,
    cycleTimeS: 3.0, inputs: [{ itemId: "item.log.birch", qty: 1 }, { itemId: "item.rope", qty: 1 }],
    outputs: [{ itemId: "tool.bow.oak", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 60,
  },
  "recipe.fletch_spruce_bow": {
    id: "recipe.fletch_spruce_bow", name: "Spruce Longbow", skillId: "skill.fletching", requiredLevel: 25,
    cycleTimeS: 3.2, inputs: [{ itemId: "item.log.spruce", qty: 1 }, { itemId: "item.rope", qty: 1 }],
    outputs: [{ itemId: "tool.bow.spruce", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 100,
  },
  "recipe.fletch_jungle_bow": {
    id: "recipe.fletch_jungle_bow", name: "Jungle Warbow", skillId: "skill.fletching", requiredLevel: 40,
    cycleTimeS: 3.6, inputs: [{ itemId: "item.log.jungle", qty: 1 }, { itemId: "item.rope", qty: 1 }],
    outputs: [{ itemId: "tool.bow.jungle", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 160,
  },
  "recipe.fletch_dark_bow": {
    id: "recipe.fletch_dark_bow", name: "Duskbark Bow", skillId: "skill.fletching", requiredLevel: 55,
    cycleTimeS: 4.0, inputs: [{ itemId: "item.log.darkoak", qty: 1 }, { itemId: "item.rope", qty: 1 }],
    outputs: [{ itemId: "tool.bow.dark", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 240,
  },
  // ---- Summoning: bind a charm and essence into a familiar pouch ----
  "recipe.rite_skeleton": {
    id: "recipe.rite_skeleton", name: "Rite of the Risen Skeleton", skillId: "skill.necromancy", requiredLevel: 1,
    cycleTimeS: 2.6, inputs: [{ itemId: "item.bone.old", qty: 2 }, { itemId: "item.charm.bone", qty: 1 }],
    outputs: [{ itemId: "item.rite.skeleton", qty: 2 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 40,
  },
  "recipe.rite_stray": {
    id: "recipe.rite_stray", name: "Rite of the Restless Stray", skillId: "skill.necromancy", requiredLevel: 15,
    cycleTimeS: 2.8, inputs: [{ itemId: "item.bone.old", qty: 3 }, { itemId: "item.charm.bone", qty: 1 }],
    outputs: [{ itemId: "item.rite.stray", qty: 2 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 95,
  },
  "recipe.rite_wight": {
    id: "recipe.rite_wight", name: "Rite of the Hollow Wight", skillId: "skill.necromancy", requiredLevel: 30,
    cycleTimeS: 3.0, inputs: [{ itemId: "item.bone.big", qty: 3 }, { itemId: "item.essence.rune", qty: 4 }],
    outputs: [{ itemId: "item.rite.wight", qty: 2 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 170,
  },
  "recipe.rite_drowned": {
    id: "recipe.rite_drowned", name: "Rite of the Drowned Servant", skillId: "skill.necromancy", requiredLevel: 42,
    cycleTimeS: 3.2, inputs: [{ itemId: "item.bone.big", qty: 4 }, { itemId: "item.essence.rune", qty: 6 }],
    outputs: [{ itemId: "item.rite.drowned", qty: 2 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 240,
  },
  "recipe.rite_shambler": {
    id: "recipe.rite_shambler", name: "Rite of the Grave Shambler", skillId: "skill.necromancy", requiredLevel: 55,
    cycleTimeS: 3.4, inputs: [{ itemId: "item.bone.ancient", qty: 2 }, { itemId: "item.essence.rune", qty: 8 }],
    outputs: [{ itemId: "item.rite.shambler", qty: 2 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 340,
  },
  "recipe.rite_barrow": {
    id: "recipe.rite_barrow", name: "Rite of the Barrow Lord", skillId: "skill.necromancy", requiredLevel: 70,
    cycleTimeS: 3.8, inputs: [{ itemId: "item.bone.dragon", qty: 2 }, { itemId: "item.essence.rune", qty: 12 }],
    outputs: [{ itemId: "item.rite.barrow", qty: 2 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 520,
  },
  "recipe.pouch_wolf": {
    id: "recipe.pouch_wolf", name: "Spirit Wolf Reins", skillId: "skill.summoning", requiredLevel: 1,
    cycleTimeS: 2.4, inputs: [{ itemId: "item.charm.bone", qty: 1 }, { itemId: "item.essence.rune", qty: 3 }],
    outputs: [{ itemId: "item.pouch.wolf", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 40,
  },
  "recipe.pouch_ox": {
    id: "recipe.pouch_ox", name: "Pack Ox Reins", skillId: "skill.summoning", requiredLevel: 22,
    cycleTimeS: 2.8, inputs: [{ itemId: "item.charm.bone", qty: 2 }, { itemId: "item.essence.rune", qty: 6 }, { itemId: "item.hide.cow", qty: 1 }],
    outputs: [{ itemId: "item.pouch.ox", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 110,
  },
  "recipe.pouch_tortoise": {
    id: "recipe.pouch_tortoise", name: "War Tortoise Reins", skillId: "skill.summoning", requiredLevel: 44,
    cycleTimeS: 3.2, inputs: [{ itemId: "item.charm.bone", qty: 3 }, { itemId: "item.essence.rune", qty: 10 }, { itemId: "item.bar.iron", qty: 1 }],
    outputs: [{ itemId: "item.pouch.tortoise", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 230,
  },
  // ---- Invention: salvage goods into parts, then build gizmos ----
  "recipe.salvage_bar": {
    id: "recipe.salvage_bar", name: "Salvage Bar", skillId: "skill.invention", requiredLevel: 1,
    cycleTimeS: 2.0, inputs: [{ itemId: "item.bar.iron", qty: 1 }], outputs: [{ itemId: "item.component.parts", qty: 3 }],
    successBase: 1, successPerLevel: 0, successMax: 1, xp: 18,
  },
  "recipe.salvage_gem": {
    id: "recipe.salvage_gem", name: "Salvage Gem", skillId: "skill.invention", requiredLevel: 15,
    cycleTimeS: 2.4, inputs: [{ itemId: "item.gem.sapphire", qty: 1 }], outputs: [{ itemId: "item.component.parts", qty: 5 }],
    successBase: 1, successPerLevel: 0, successMax: 1, xp: 46,
  },
  "recipe.gizmo_swift": {
    id: "recipe.gizmo_swift", name: "Swift Gizmo", skillId: "skill.invention", requiredLevel: 25,
    cycleTimeS: 3.0, inputs: [{ itemId: "item.component.parts", qty: 6 }, { itemId: "item.bar.gold", qty: 1 }],
    outputs: [{ itemId: "item.gizmo.swift", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 120,
  },
  "recipe.gizmo_precise": {
    id: "recipe.gizmo_precise", name: "Precise Gizmo", skillId: "skill.invention", requiredLevel: 40,
    cycleTimeS: 3.4, inputs: [{ itemId: "item.component.parts", qty: 10 }, { itemId: "item.gem.ruby", qty: 1 }],
    outputs: [{ itemId: "item.gizmo.precise", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 210,
  },
  ...ladderRecipes(),
};

// ============================================================================
// SKILL-LADDER EXPANSION recipes (see SKILL_PLANS.md). Grouped by skill; all
// craft at existing or new workstations wired via workstationRecipeIds.
// ============================================================================
function ladderRecipes(): Record<string, RecipeDef> {
  const out: Record<string, RecipeDef> = {};
  const R = (r: RecipeDef) => { out[r.id] = r; };
  const brew = (id: string, name: string, level: number, cycleTimeS: number, inputs: RecipeItem[], out2: string, xp: number, successBase: number) =>
    R({ id, name, skillId: "skill.herblore", requiredLevel: level, cycleTimeS, inputs, outputs: [{ itemId: out2, qty: 1 }], successBase, successPerLevel: 0.012, successMax: 0.99, xp });
  const inp = (a: string, q = 1, b?: string, qb = 1, c?: string, qc = 1): RecipeItem[] => {
    const arr: RecipeItem[] = [{ itemId: a, qty: q }];
    if (b) arr.push({ itemId: b, qty: qb });
    if (c) arr.push({ itemId: c, qty: qc });
    return arr;
  };
  // ---- Brewing: bridge, then Greater / Super / Grand tiers ----
  brew("recipe.potion_gathering_keen", "Keen Forager's Brew", 10, 3.2, inp("item.herb.emberleaf", 1, "item.herb.mint", 2), "item.potion.gathering_keen", 58, 0.78);
  brew("recipe.tonic_warden", "Emberward Tonic", 13, 3.4, inp("item.herb.emberleaf", 1, "item.berry.basic", 3), "item.tonic.warden", 70, 0.74);
  brew("recipe.potion_swift_greater", "Greater Swiftness Draught", 16, 3.4, inp("item.herb.frostbloom", 1, "item.feather", 2), "item.potion.swift_greater", 90, 0.72);
  brew("recipe.potion_gathering_greater", "Greater Forager's Brew", 20, 3.6, inp("item.herb.frostbloom", 1, "item.herb.mint", 2), "item.potion.gathering_greater", 104, 0.72);
  brew("recipe.potion_strength_greater", "Greater Strength Tonic", 24, 3.6, inp("item.herb.frostbloom", 1, "item.bone.big", 1), "item.potion.strength_greater", 118, 0.7);
  brew("recipe.potion_stoneskin_greater", "Greater Stoneskin Brew", 28, 3.8, inp("item.herb.frostbloom", 2, "item.stone.rough", 2), "item.potion.stoneskin_greater", 132, 0.7);
  brew("recipe.potion_focus_greater", "Greater Hunter's Focus", 34, 3.8, inp("item.herb.frostbloom", 1, "item.feather", 3), "item.potion.focus_greater", 150, 0.68);
  brew("recipe.tonic_warden_greater", "Greater Warden's Tonic", 40, 4.0, inp("item.herb.frostbloom", 1, "item.berry.basic", 3, "item.spore.pale", 1), "item.tonic.warden_greater", 168, 0.68);
  brew("recipe.potion_swift_super", "Super Swiftness Draught", 44, 4.0, inp("item.herb.duskcap", 1, "item.herb.frostbloom", 1, "item.venom.sac", 1), "item.potion.swift_super", 210, 0.66);
  brew("recipe.potion_gathering_super", "Super Forager's Brew", 48, 4.1, inp("item.herb.duskcap", 1, "item.herb.mint", 3, "item.spore.pale", 1), "item.potion.gathering_super", 228, 0.66);
  brew("recipe.potion_strength_super", "Super Strength Tonic", 52, 4.2, inp("item.herb.duskcap", 1, "item.bone.dragon", 1, "item.gem.emberstone", 1), "item.potion.strength_super", 248, 0.64);
  brew("recipe.potion_stoneskin_super", "Super Stoneskin Brew", 56, 4.3, inp("item.herb.duskcap", 1, "item.core.construct", 1), "item.potion.stoneskin_super", 268, 0.64);
  brew("recipe.potion_focus_super", "Super Hunter's Focus", 60, 4.3, inp("item.herb.duskcap", 1, "item.gem.emberstone", 1, "item.feather", 3), "item.potion.focus_super", 290, 0.62);
  brew("recipe.tonic_warden_super", "Super Warden's Tonic", 64, 4.4, inp("item.herb.duskcap", 1, "item.spore.pale", 2, "item.berry.basic", 3), "item.tonic.warden_super", 312, 0.62);
  brew("recipe.potion_swift_grand", "Grand Swiftness Elixir", 70, 4.5, inp("item.herb.duskcap", 2, "item.herb.frostbloom", 2, "item.gem.diamond", 1), "item.potion.swift_grand", 420, 0.6);
  brew("recipe.potion_gathering_grand", "Grand Forager's Elixir", 74, 4.6, inp("item.herb.duskcap", 2, "item.spore.pale", 2, "item.gem.emerald", 1), "item.potion.gathering_grand", 452, 0.6);
  brew("recipe.potion_strength_grand", "Grand Strength Elixir", 78, 4.7, inp("item.herb.duskcap", 2, "item.bone.dragon", 2, "item.gem.emberstone", 2), "item.potion.strength_grand", 488, 0.58);
  brew("recipe.potion_stoneskin_grand", "Grand Stoneskin Elixir", 82, 4.8, inp("item.herb.duskcap", 2, "item.core.construct", 2), "item.potion.stoneskin_grand", 524, 0.58);
  brew("recipe.potion_focus_grand", "Grand Hunter's Elixir", 86, 4.9, inp("item.herb.duskcap", 3, "item.gem.emberstone", 2, "item.feather", 4), "item.potion.focus_grand", 556, 0.56);
  brew("recipe.tonic_warden_grand", "Grand Warden's Draught", 90, 5.0, inp("item.herb.duskcap", 3, "item.core.construct", 2, "item.gem.dragonstone", 1), "item.tonic.warden_grand", 600, 0.56);
  // ---- Herblore: two salves at the campfire ----
  R({ id: "recipe.frost_salve", name: "Frostbloom Salve", skillId: "skill.herblore", requiredLevel: 20, cycleTimeS: 3.4, inputs: inp("item.herb.frostbloom", 1, "item.herb.sage", 2), outputs: [{ itemId: "item.salve.frost", qty: 1 }], successBase: 0.74, successPerLevel: 0.012, successMax: 0.99, xp: 72 });
  R({ id: "recipe.dusk_poultice", name: "Duskcap Poultice", skillId: "skill.herblore", requiredLevel: 34, cycleTimeS: 3.6, inputs: inp("item.herb.duskcap", 1, "item.spore.pale", 1), outputs: [{ itemId: "item.salve.dusk", qty: 1 }], successBase: 0.7, successPerLevel: 0.012, successMax: 0.99, xp: 132 });
  R({ id: "recipe.ember_liniment", name: "Emberleaf Liniment", skillId: "skill.herblore", requiredLevel: 48, cycleTimeS: 3.8, inputs: inp("item.herb.emberleaf", 1, "item.herb.mint", 2), outputs: [{ itemId: "item.salve.ember", qty: 1 }], successBase: 0.66, successPerLevel: 0.012, successMax: 0.99, xp: 210 });
  R({ id: "recipe.kings_tincture", name: "King's Tincture", skillId: "skill.herblore", requiredLevel: 62, cycleTimeS: 4.0, inputs: inp("item.herb.emberleaf", 1, "item.herb.frostbloom", 1, "item.herb.duskcap", 1), outputs: [{ itemId: "item.salve.kings", qty: 1 }], successBase: 0.6, successPerLevel: 0.012, successMax: 0.99, xp: 330 });
  // ---- Smelting: the steel/mithril/adamant/runite bar ladder ----
  const smelt = (id: string, name: string, level: number, cycleTimeS: number, inputs: RecipeItem[], out2: string, xp: number) =>
    R({ id, name, skillId: "skill.smithing", requiredLevel: level, cycleTimeS, inputs, outputs: [{ itemId: out2, qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp });
  smelt("recipe.steel_bar", "Steel Bar", 16, 4.2, inp("item.bar.iron", 1, "item.ore.coal", 2), "item.bar.steel", 90);
  smelt("recipe.mithril_bar", "Mithril Bar", 30, 4.6, inp("item.ore.mithril", 1, "item.ore.coal", 2), "item.bar.mithril", 150);
  smelt("recipe.adamant_bar", "Adamant Bar", 45, 5.0, inp("item.ore.adamant", 1, "item.ore.coal", 3), "item.bar.adamant", 220);
  smelt("recipe.runite_bar", "Runite Bar", 58, 5.4, inp("item.ore.runite", 1, "item.ore.coal", 4), "item.bar.runite", 300);
  // ---- Fletching: metal arrow tiers (5 per craft) ----
  const fletchArrow = (id: string, name: string, level: number, cycleTimeS: number, bar: string, out2: string, xp: number) =>
    R({ id, name, skillId: "skill.fletching", requiredLevel: level, cycleTimeS, inputs: [{ itemId: "item.arrow.shaft", qty: 5 }, { itemId: "item.feather", qty: 5 }, { itemId: bar, qty: 1 }], outputs: [{ itemId: out2, qty: 5 }], successBase: 1, successPerLevel: 0, successMax: 1, xp });
  fletchArrow("recipe.fletch_steel_arrows", "Steel Arrows", 32, 2.4, "item.bar.steel", "item.arrow.steel", 75);
  fletchArrow("recipe.fletch_mithril_arrows", "Mithril Arrows", 45, 2.6, "item.bar.mithril", "item.arrow.mithril", 105);
  fletchArrow("recipe.fletch_adamant_arrows", "Adamant Arrows", 58, 2.8, "item.bar.adamant", "item.arrow.adamant", 140);
  fletchArrow("recipe.fletch_rune_arrows", "Rune Arrows", 70, 3.0, "item.bar.runite", "item.arrow.rune", 190);
  // ---- Crafting: three plank tiers sawn from logs ----
  const saw = (id: string, name: string, level: number, cycleTimeS: number, log: string, out2: string, xp: number) =>
    R({ id, name, skillId: "skill.crafting", requiredLevel: level, cycleTimeS, inputs: [{ itemId: log, qty: 1 }], outputs: [{ itemId: out2, qty: 2 }], successBase: 1, successPerLevel: 0, successMax: 1, xp });
  saw("recipe.cut_planks_oak", "Oak Planks", 20, 2.6, "item.log.spruce", "item.plank.oak", 32);
  saw("recipe.cut_planks_teak", "Teak Planks", 35, 2.8, "item.log.jungle", "item.plank.teak", 45);
  saw("recipe.cut_planks_mahogany", "Mahogany Planks", 50, 3.0, "item.log.darkoak", "item.plank.mahogany", 62);
  // ---- Fishing: rod ladder crafted at the workbench ----
  R({ id: "recipe.rod_fly", name: "Feathered Fly Rod", skillId: "skill.crafting", requiredLevel: 15, cycleTimeS: 3.0, inputs: inp("item.plank.cut", 2, "item.rope", 1, "item.feather", 3), outputs: [{ itemId: "tool.fishingrod.fly", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 70 });
  R({ id: "recipe.rod_barbed", name: "Barbed Rod", skillId: "skill.crafting", requiredLevel: 30, cycleTimeS: 3.4, inputs: inp("item.plank.cut", 2, "item.bar.iron", 1, "item.rope", 1), outputs: [{ itemId: "tool.fishingrod.barbed", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 130 });
  R({ id: "recipe.rod_pearl", name: "Pearlshell Rod", skillId: "skill.crafting", requiredLevel: 45, cycleTimeS: 3.8, inputs: inp("item.plank.cut", 3, "item.gem.sapphire", 1, "item.rope", 2), outputs: [{ itemId: "tool.fishingrod.pearl", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 220 });
  // ---- Boating: two faster hulls ----
  R({ id: "recipe.boat_cutter", name: "River Cutter", skillId: "skill.boating", requiredLevel: 34, cycleTimeS: 7.0, inputs: inp("item.plank.cut", 10, "item.rope", 3, "item.bar.iron", 1), outputs: [{ itemId: "tool.boat.cutter", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 240 });
  R({ id: "recipe.boat_longship", name: "Coastal Longship", skillId: "skill.boating", requiredLevel: 55, cycleTimeS: 8.5, inputs: inp("item.plank.cut", 14, "item.rope", 4, "item.bar.steel", 2), outputs: [{ itemId: "tool.boat.longship", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 460 });
  // ---- Enchanting: gap-fillers + apex ----
  R({ id: "recipe.runed_boots", name: "Runed Sabatons", skillId: "skill.enchanting", requiredLevel: 14, cycleTimeS: 4.0, inputs: inp("armor.boots.iron", 1, "item.relic.idol", 1), outputs: [{ itemId: "armor.boots.runed", qty: 1 }], successBase: 0.9, successPerLevel: 0.01, successMax: 0.99, xp: 130 });
  R({ id: "recipe.runed_rod", name: "Enchanted Rod", skillId: "skill.enchanting", requiredLevel: 22, cycleTimeS: 4.5, inputs: inp("tool.fishingrod.pearl", 1, "item.relic.idol", 1), outputs: [{ itemId: "tool.fishingrod.enchanted", qty: 1 }], successBase: 0.9, successPerLevel: 0.01, successMax: 0.99, xp: 150 });
  R({ id: "recipe.astral_sword", name: "Astral Blade", skillId: "skill.enchanting", requiredLevel: 58, cycleTimeS: 5.0, inputs: inp("tool.sword.diamond", 1, "item.relic.idol", 3, "item.charm.bone", 1), outputs: [{ itemId: "tool.sword.astral", qty: 1 }], successBase: 0.85, successPerLevel: 0.012, successMax: 0.99, xp: 420 });
  // ---- Summoning: two higher pouches ----
  R({ id: "recipe.pouch_lynx", name: "Blood Lynx Reins", skillId: "skill.summoning", requiredLevel: 58, cycleTimeS: 3.4, inputs: inp("item.charm.bone", 4, "item.essence.rune", 14, "item.bar.steel", 1), outputs: [{ itemId: "item.pouch.lynx", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 320 });
  R({ id: "recipe.pouch_drake", name: "Storm Drake Reins", skillId: "skill.summoning", requiredLevel: 72, cycleTimeS: 3.8, inputs: inp("item.charm.bone", 5, "item.essence.rune", 20, "item.bar.mithril", 1), outputs: [{ itemId: "item.pouch.drake", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 460 });
  // ---- Invention: high salvage source + two apex gizmos ----
  R({ id: "recipe.salvage_plate", name: "Salvage Plate", skillId: "skill.invention", requiredLevel: 50, cycleTimeS: 2.6, inputs: [{ itemId: "item.bar.runite", qty: 1 }], outputs: [{ itemId: "item.component.parts", qty: 8 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 90 });
  R({ id: "recipe.gizmo_bulwark", name: "Bulwark Gizmo", skillId: "skill.invention", requiredLevel: 55, cycleTimeS: 3.6, inputs: inp("item.component.parts", 14, "item.gem.emerald", 1), outputs: [{ itemId: "item.gizmo.bulwark", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 320 });
  R({ id: "recipe.gizmo_titan", name: "Titan Gizmo", skillId: "skill.invention", requiredLevel: 70, cycleTimeS: 4.0, inputs: inp("item.component.parts", 20, "item.gem.diamond", 1), outputs: [{ itemId: "item.gizmo.titan", qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp: 480 });
  // ---- Smithing: diamond + netherite armor (manual, gem/upgrade costs) ----
  const smith = (id: string, name: string, level: number, cycleTimeS: number, inputs: RecipeItem[], out2: string, xp: number) =>
    R({ id, name, skillId: "skill.smithing", requiredLevel: level, cycleTimeS, inputs, outputs: [{ itemId: out2, qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp, toolTagsAny: ["hammer"] });
  smith("recipe.cap_diamond", "Diamond Helm", 60, 5.0, inp("item.bar.runite", 1, "item.gem.diamond", 2), "armor.cap.diamond", 620);
  smith("recipe.tunic_diamond", "Diamond Chestplate", 61, 5.4, inp("item.bar.runite", 2, "item.gem.diamond", 3), "armor.tunic.diamond", 900);
  smith("recipe.leggings_diamond", "Diamond Greaves", 60, 5.2, inp("item.bar.runite", 1, "item.gem.diamond", 3), "armor.leggings.diamond", 720);
  smith("recipe.boots_diamond", "Diamond Sabatons", 60, 4.8, inp("item.bar.runite", 1, "item.gem.diamond", 1), "armor.boots.diamond", 360);
  smith("recipe.cap_netherite", "Netherite Helm", 74, 5.4, inp("armor.cap.diamond", 1, "item.ingot.netherite", 1), "armor.cap.netherite", 820);
  smith("recipe.tunic_netherite", "Netherite Chestplate", 76, 5.8, inp("armor.tunic.diamond", 1, "item.ingot.netherite", 1), "armor.tunic.netherite", 1000);
  smith("recipe.leggings_netherite", "Netherite Greaves", 75, 5.6, inp("armor.leggings.diamond", 1, "item.ingot.netherite", 1), "armor.leggings.netherite", 900);
  smith("recipe.boots_netherite", "Netherite Sabatons", 74, 5.2, inp("armor.boots.diamond", 1, "item.ingot.netherite", 1), "armor.boots.netherite", 640);
  // ---- Construction: the Carpenter's Bench furniture ladder ----
  const build = (id: string, name: string, level: number, cycleTimeS: number, inputs: RecipeItem[], out2: string, xp: number) =>
    R({ id, name, skillId: "skill.construction", requiredLevel: level, cycleTimeS, inputs, outputs: [{ itemId: out2, qty: 1 }], successBase: 1, successPerLevel: 0, successMax: 1, xp, toolTagsAny: ["hammer"] });
  build("recipe.build_stool", "Wooden Stool", 1, 2.4, inp("item.plank.cut", 2), "item.flatpack.stool", 40);
  build("recipe.build_crate", "Storage Crate", 5, 2.5, inp("item.plank.cut", 3), "item.flatpack.crate", 58);
  build("recipe.build_chair", "Wooden Chair", 9, 2.6, inp("item.plank.cut", 3, "item.rope", 1), "item.flatpack.chair", 72);
  build("recipe.build_table", "Kitchen Table", 14, 2.8, inp("item.plank.cut", 4), "item.flatpack.table", 96);
  build("recipe.build_bench", "Long Bench", 19, 2.8, inp("item.plank.cut", 5, "item.rope", 1), "item.flatpack.bench", 128);
  build("recipe.build_bookshelf", "Bookshelf", 24, 3.0, inp("item.plank.cut", 6), "item.flatpack.bookshelf", 165);
  build("recipe.build_bed", "Wooden Bed", 29, 3.0, inp("item.plank.cut", 6, "item.rope", 2), "item.flatpack.bed", 205);
  build("recipe.build_dresser", "Oak Dresser", 34, 3.2, inp("item.plank.oak", 4), "item.flatpack.dresser", 250);
  build("recipe.build_wardrobe", "Oak Wardrobe", 40, 3.4, inp("item.plank.oak", 6, "item.rope", 1), "item.flatpack.wardrobe", 300);
  build("recipe.build_hearth", "Stone Hearth", 46, 3.6, inp("item.brick.stone", 6, "item.plank.oak", 2), "item.flatpack.hearth", 360);
  build("recipe.build_fireplace", "Teak Fireplace", 52, 3.8, inp("item.plank.teak", 6, "item.brick.stone", 4), "item.flatpack.fireplace", 420);
  build("recipe.build_cabinet", "Teak Cabinet", 58, 4.0, inp("item.plank.teak", 8, "item.rope", 1), "item.flatpack.cabinet", 500);
  build("recipe.build_wall_shelf", "Mahogany Wall Shelf", 66, 4.2, inp("item.plank.mahogany", 8), "item.flatpack.shelf", 585);
  build("recipe.build_fourposter", "Mahogany Four-Poster Bed", 74, 4.4, inp("item.plank.mahogany", 10, "item.rope", 4), "item.flatpack.fourposter", 680);
  build("recipe.build_throne", "Gilded Throne", 82, 4.8, inp("item.plank.mahogany", 12, "item.bar.gold", 2), "item.flatpack.throne", 800);
  build("recipe.build_altar", "Marble Altar", 90, 5.0, inp("item.plank.mahogany", 14, "item.brick.stone", 8, "item.bar.gold", 2), "item.flatpack.altar", 950);
  // ---- Cooking: roast the new hunted game at a campfire ----
  const cook = (id: string, name: string, level: number, cycleTimeS: number, raw: string, cooked: string, xp: number) =>
    R({ id, name, skillId: "skill.cooking", requiredLevel: level, cycleTimeS, inputs: [{ itemId: raw, qty: 1 }], outputs: [{ itemId: cooked, qty: 1 }], failOutputs: [], successBase: 0.78, successPerLevel: 0.012, successMax: 0.99, xp });
  cook("recipe.cooked_fowl", "Roast Pheasant", 15, 2.8, "item.game.fowl", "item.fowl.cooked", 70);
  cook("recipe.cooked_boar", "Roast Boar", 30, 3.0, "item.game.boar", "item.boar.cooked", 130);
  cook("recipe.cooked_grenwall", "Roast Grenwall", 55, 3.4, "item.game.grenwall", "item.grenwall.cooked", 240);
  cook("recipe.cooked_antelope", "Roast Antelope", 70, 3.6, "item.game.antelope", "item.antelope.cooked", 320);
  return out;
}

/** Runecrafting: bind rune essence into runes at an altar. */
function runeRecipes(): Record<string, RecipeDef> {
  const out: Record<string, RecipeDef> = {};
  for (const r of RUNE_CRAFT) {
    const key = r.runeId.split(".").pop();
    out[`recipe.rune_${key}`] = {
      id: `recipe.rune_${key}`,
      name: ITEMS[r.runeId].name,
      skillId: "skill.runecrafting",
      requiredLevel: r.level,
      cycleTimeS: 1.6,
      inputs: [{ itemId: "item.essence.rune", qty: 1 }],
      outputs: [{ itemId: r.runeId, qty: r.per }],
      successBase: 1,
      successPerLevel: 0,
      successMax: 1,
      xp: Math.round(r.xp * 10) / 10,
    };
  }
  return out;
}

/** The armor ladder: leather from hides, then copper and bronze from bars. */
function armorRecipes(): Record<string, RecipeDef> {
  const specs: Array<{
    tier: string;
    level: number;
    input: string;
    xp: number;
    cycleTimeS: number;
  }> = [
    { tier: "leather", level: 1, input: "item.hide.cow", xp: 26, cycleTimeS: 3.0 },
    { tier: "copper", level: 3, input: "item.bar.copper", xp: 48, cycleTimeS: 3.5 },
    { tier: "bronze", level: 5, input: "item.bar.bronze", xp: 80, cycleTimeS: 4.0 },
    { tier: "iron", level: 7, input: "item.bar.iron", xp: 130, cycleTimeS: 4.5 },
    { tier: "steel", level: 16, input: "item.bar.steel", xp: 200, cycleTimeS: 5.0 },
    { tier: "mithril", level: 30, input: "item.bar.mithril", xp: 300, cycleTimeS: 5.4 },
    { tier: "adamant", level: 44, input: "item.bar.adamant", xp: 420, cycleTimeS: 5.8 },
    { tier: "rune", level: 55, input: "item.bar.runite", xp: 560, cycleTimeS: 6.2 },
  ];
  const pieces: Array<{ piece: string; qty: number }> = [
    { piece: "cap", qty: 2 },
    { piece: "tunic", qty: 3 },
    { piece: "leggings", qty: 2 },
    { piece: "boots", qty: 1 },
  ];
  const out: Record<string, RecipeDef> = {};
  for (const spec of specs) {
    for (const p of pieces) {
      const itemId = `armor.${p.piece}.${spec.tier}`;
      const id = `recipe.${p.piece}_${spec.tier}`;
      out[id] = {
        id,
        name: ITEMS[itemId].name,
        skillId: "skill.smithing",
        // The tunic is the centerpiece of each tier: one level above the rest.
        requiredLevel: p.piece === "tunic" ? spec.level + 1 : spec.level,
        cycleTimeS: spec.cycleTimeS,
        inputs: [{ itemId: spec.input, qty: p.qty }],
        outputs: [{ itemId, qty: 1 }],
        successBase: 1,
        successPerLevel: 0,
        successMax: 1,
        xp: Math.round(spec.xp * (p.qty / 2)),
        toolTagsAny: ["hammer"],
      };
    }
  }
  return out;
}

export const NODES: Record<string, ResourceNodeDef> = {
  "resource.tree.basic": {
    id: "resource.tree.basic",
    name: "Broadleaf Tree",
    skillId: "skill.woodcutting",
    requiredLevel: 1,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.8,
    successBase: 0.75,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 14,
    drops: [{ itemId: "item.log.basic", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 4,
    resourceMax: 6,
    respawnS: 20,
    blocksNav: true,
    view: "tree",
  },
  "resource.tree.spruce": {
    id: "resource.tree.spruce",
    name: "Needlewood Spruce",
    skillId: "skill.woodcutting",
    requiredLevel: 20,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.0,
    successBase: 0.72,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 42,
    drops: [{ itemId: "item.log.spruce", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 4,
    resourceMax: 7,
    respawnS: 24,
    blocksNav: true,
    view: "tree.spruce",
  },
  "resource.tree.birch": {
    id: "resource.tree.birch",
    name: "Paperbark Birch",
    skillId: "skill.woodcutting",
    requiredLevel: 10,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.9,
    successBase: 0.72,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 26,
    drops: [{ itemId: "item.log.birch", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 4,
    resourceMax: 6,
    respawnS: 26,
    blocksNav: true,
    view: "tree.birch",
  },
  "resource.tree.acacia": {
    id: "resource.tree.acacia",
    name: "Sunwarped Acacia",
    skillId: "skill.woodcutting",
    requiredLevel: 50,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.1,
    successBase: 0.68,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 95,
    drops: [{ itemId: "item.log.acacia", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 4,
    resourceMax: 6,
    respawnS: 30,
    blocksNav: true,
    view: "tree.acacia",
  },
  "resource.tree.jungle": {
    id: "resource.tree.jungle",
    name: "Canopy Giant",
    skillId: "skill.woodcutting",
    requiredLevel: 35,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.3,
    successBase: 0.64,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 65,
    drops: [{ itemId: "item.log.jungle", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 6,
    resourceMax: 9,
    respawnS: 40,
    blocksNav: true,
    view: "tree.jungle",
  },
  "resource.tree.darkoak": {
    id: "resource.tree.darkoak",
    name: "Duskbark Oak",
    skillId: "skill.woodcutting",
    requiredLevel: 65,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.5,
    successBase: 0.6,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 140,
    drops: [{ itemId: "item.log.darkoak", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 6,
    resourceMax: 10,
    respawnS: 45,
    blocksNav: true,
    view: "tree.darkoak",
  },
  "resource.tree.pine": {
    id: "resource.tree.pine",
    name: "Tall Pine",
    skillId: "skill.woodcutting",
    requiredLevel: 25,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.1,
    successBase: 0.7,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 48,
    drops: [{ itemId: "item.log.spruce", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 4,
    resourceMax: 7,
    respawnS: 26,
    blocksNav: true,
    view: "tree.pine",
  },
  "resource.tree.willow": {
    id: "resource.tree.willow",
    name: "Weeping Willow",
    skillId: "skill.woodcutting",
    requiredLevel: 30,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.2,
    successBase: 0.68,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 58,
    drops: [{ itemId: "item.log.basic", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 5,
    resourceMax: 8,
    respawnS: 32,
    blocksNav: true,
    view: "tree.willow",
  },
  "resource.tree.maple": {
    id: "resource.tree.maple",
    name: "Amber Maple",
    skillId: "skill.woodcutting",
    requiredLevel: 45,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.3,
    successBase: 0.64,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 80,
    drops: [{ itemId: "item.log.basic", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 5,
    resourceMax: 8,
    respawnS: 38,
    blocksNav: true,
    view: "tree.maple",
  },
  "resource.tree.palm": {
    id: "resource.tree.palm",
    name: "Coast Palm",
    skillId: "skill.woodcutting",
    requiredLevel: 40,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.2,
    successBase: 0.66,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 70,
    drops: [{ itemId: "item.log.jungle", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 4,
    resourceMax: 7,
    respawnS: 34,
    blocksNav: true,
    view: "tree.palm",
  },
  "resource.tree.dead": {
    id: "resource.tree.dead",
    name: "Dead Snag",
    skillId: "skill.woodcutting",
    requiredLevel: 15,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.9,
    successBase: 0.74,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 30,
    drops: [{ itemId: "item.log.basic", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 6,
    respawnS: 22,
    blocksNav: true,
    view: "tree.dead",
  },
  "resource.tree.grand.oak": {
    id: "resource.tree.grand.oak",
    name: "Grand Oak",
    skillId: "skill.woodcutting",
    requiredLevel: 12,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 1.8,
    successBase: 0.75,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 30,
    drops: [{ itemId: "item.log.basic", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 8,
    resourceMax: 12,
    respawnS: 30,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "oak",
  },
  "resource.tree.grand.spruce": {
    id: "resource.tree.grand.spruce",
    name: "Grand Spruce",
    skillId: "skill.woodcutting",
    requiredLevel: 32,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 2.0,
    successBase: 0.7,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 60,
    drops: [{ itemId: "item.log.spruce", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 8,
    resourceMax: 12,
    respawnS: 40,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "spruce",
  },
  "resource.tree.grand.birch": {
    id: "resource.tree.grand.birch",
    name: "Grand Birch",
    skillId: "skill.woodcutting",
    requiredLevel: 22,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 2.0,
    successBase: 0.68,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 40,
    drops: [{ itemId: "item.log.birch", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 8,
    resourceMax: 12,
    respawnS: 50,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "birch",
  },
  "resource.tree.grand.jungle": {
    id: "resource.tree.grand.jungle",
    name: "Grand Jungle Tree",
    skillId: "skill.woodcutting",
    requiredLevel: 45,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 2.2,
    successBase: 0.66,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 90,
    drops: [{ itemId: "item.log.jungle", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 10,
    resourceMax: 14,
    respawnS: 60,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "jungle",
  },
  "resource.tree.grand.acacia": {
    id: "resource.tree.grand.acacia",
    name: "Grand Acacia",
    skillId: "skill.woodcutting",
    requiredLevel: 60,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 2.3,
    successBase: 0.64,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 130,
    drops: [{ itemId: "item.log.acacia", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 8,
    resourceMax: 12,
    respawnS: 70,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "acacia",
  },
  "resource.tree.grand.darkoak": {
    id: "resource.tree.grand.darkoak",
    name: "Grand Dark Oak",
    skillId: "skill.woodcutting",
    requiredLevel: 75,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 2.5,
    successBase: 0.6,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 190,
    drops: [{ itemId: "item.log.darkoak", min: 1, max: 3, weight: 1 }],
    depletes: true,
    resourceMin: 10,
    resourceMax: 16,
    respawnS: 90,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "darkoak",
  },
  "resource.tree.grand.blossom": {
    id: "resource.tree.grand.blossom",
    name: "Blossom Tree",
    skillId: "skill.woodcutting",
    requiredLevel: 80,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 2.6,
    successBase: 0.58,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 240,
    drops: [{ itemId: "item.log.blossom", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 10,
    resourceMax: 14,
    respawnS: 110,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "blossom",
  },
  "resource.tree.grand.ember": {
    id: "resource.tree.grand.ember",
    name: "Ember Tree",
    skillId: "skill.woodcutting",
    requiredLevel: 86,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 2.7,
    successBase: 0.56,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 300,
    drops: [{ itemId: "item.log.ember", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 10,
    resourceMax: 16,
    respawnS: 130,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "ember",
  },
  "resource.tree.grand.glow": {
    id: "resource.tree.grand.glow",
    name: "Lanternwood Tree",
    skillId: "skill.woodcutting",
    requiredLevel: 92,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 2.8,
    successBase: 0.54,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 380,
    drops: [{ itemId: "item.log.glow", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 12,
    resourceMax: 16,
    respawnS: 150,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "glow",
  },
  "resource.tree.grand.dusk": {
    id: "resource.tree.grand.dusk",
    name: "Duskglass Tree",
    skillId: "skill.woodcutting",
    requiredLevel: 96,
    toolTagsAny: ["axe"],
    interaction: { mode: "adjacent_8", rangeCells: 2 },
    cycleTimeS: 3.0,
    successBase: 0.52,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 470,
    drops: [{ itemId: "item.log.dusk", min: 1, max: 3, weight: 1 }],
    depletes: true,
    resourceMin: 12,
    resourceMax: 18,
    respawnS: 180,
    blocksNav: true,
    view: "tree.grand",
    viewMaterial: "dusk",
  },
  "resource.rock.copper": {
    id: "resource.rock.copper",
    name: "Copper-veined Rock",
    skillId: "skill.mining",
    requiredLevel: 1,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 2.2,
    successBase: 0.7,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 17,
    drops: [
      { itemId: "item.ore.copper", min: 1, max: 1, weight: 8 },
      { itemId: "item.stone.rough", min: 1, max: 2, weight: 2 },
    ],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 35,
    blocksNav: true,
    view: "rock",
  },
  "resource.rock.tin": {
    id: "resource.rock.tin",
    name: "Tin-veined Rock",
    skillId: "skill.mining",
    requiredLevel: 1,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 2.4,
    successBase: 0.65,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 22,
    drops: [{ itemId: "item.ore.tin", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 40,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.tin",
  },
  "resource.rock.iron": {
    id: "resource.rock.iron",
    name: "Iron-veined Rock",
    skillId: "skill.mining",
    requiredLevel: 20,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 2.8,
    successBase: 0.6,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 42,
    drops: [{ itemId: "item.ore.iron", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 55,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.iron",
  },
  "resource.rock.coal": {
    id: "resource.rock.coal",
    name: "Coal Seam",
    skillId: "skill.mining",
    requiredLevel: 10,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 2.4,
    successBase: 0.66,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 26,
    drops: [{ itemId: "item.ore.coal", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 4,
    resourceMax: 6,
    respawnS: 45,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.coal",
  },
  "resource.rock.gold": {
    id: "resource.rock.gold",
    name: "Gold-veined Rock",
    skillId: "skill.mining",
    requiredLevel: 35,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 3.0,
    successBase: 0.58,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 65,
    drops: [{ itemId: "item.ore.gold", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 70,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.gold",
  },
  "resource.rock.diamond": {
    id: "resource.rock.diamond",
    name: "Diamond-studded Rock",
    skillId: "skill.mining",
    requiredLevel: 50,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 3.4,
    successBase: 0.52,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 95,
    drops: [{ itemId: "item.gem.diamond", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 4,
    respawnS: 90,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.diamond",
  },
  // ---- Minecraft ore ladder above diamond, mined toward 99 ----
  "resource.rock.redstone": {
    id: "resource.rock.redstone",
    name: "Redstone Ore",
    skillId: "skill.mining",
    requiredLevel: 44,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 3.2,
    successBase: 0.54,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 82,
    drops: [{ itemId: "item.ore.redstone", min: 1, max: 3, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 80,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.redstone",
  },
  "resource.rock.lapis": {
    id: "resource.rock.lapis",
    name: "Lapis Ore",
    skillId: "skill.mining",
    requiredLevel: 56,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 3.4,
    successBase: 0.5,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 108,
    drops: [{ itemId: "item.gem.lapis", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 95,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.lapis",
  },
  "resource.rock.emerald": {
    id: "resource.rock.emerald",
    name: "Emerald Ore",
    skillId: "skill.mining",
    requiredLevel: 64,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 3.6,
    successBase: 0.46,
    successPerLevel: 0.01,
    successMax: 0.94,
    xpPerCycle: 140,
    drops: [{ itemId: "item.gem.emerald", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 4,
    respawnS: 110,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.emerald",
  },
  "resource.rock.quartz": {
    id: "resource.rock.quartz",
    name: "Nether Quartz Ore",
    skillId: "skill.mining",
    requiredLevel: 72,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 3.8,
    successBase: 0.44,
    successPerLevel: 0.01,
    successMax: 0.94,
    xpPerCycle: 178,
    drops: [{ itemId: "item.gem.quartz", min: 1, max: 3, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 120,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.quartz",
  },
  "resource.rock.netherite": {
    id: "resource.rock.netherite",
    name: "Ancient Debris",
    skillId: "skill.mining",
    requiredLevel: 90,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 4.4,
    successBase: 0.4,
    successPerLevel: 0.008,
    successMax: 0.92,
    xpPerCycle: 260,
    drops: [{ itemId: "item.debris.ancient", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 160,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.netherite",
  },
  "resource.rock.essence": {
    id: "resource.rock.essence",
    name: "Arcane Stone",
    skillId: "skill.mining",
    requiredLevel: 1,
    toolTagsAny: ["pickaxe"],
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    cycleTimeS: 2.0,
    successBase: 0.72,
    successPerLevel: 0.01,
    successMax: 0.95,
    xpPerCycle: 15,
    drops: [{ itemId: "item.essence.rune", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 5,
    resourceMax: 8,
    respawnS: 40,
    blocksNav: true,
    view: "rock",
    viewMaterial: "resource.rock.essence",
  },
  "resource.bush.berry": {
    id: "resource.bush.berry",
    name: "Berry Thicket",
    skillId: "skill.foraging",
    requiredLevel: 1,
    toolTagsAny: [], // hands only
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.2,
    successBase: 0.9,
    successPerLevel: 0.005,
    successMax: 0.98,
    xpPerCycle: 8,
    drops: [{ itemId: "item.berry.basic", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 4,
    respawnS: 45,
    blocksNav: false,
    view: "bush",
  },
  "resource.crop.wheat": {
    id: "resource.crop.wheat",
    name: "Wheat Plot",
    skillId: "skill.farming",
    requiredLevel: 1,
    toolTagsAny: [], // hands only
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.6,
    successBase: 0.85,
    successPerLevel: 0.008,
    successMax: 0.98,
    xpPerCycle: 12,
    drops: [{ itemId: "item.wheat", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 40,
    blocksNav: false,
    view: "crop.wheat",
  },
  "resource.crop.pumpkin": {
    id: "resource.crop.pumpkin",
    name: "Pumpkin Patch",
    skillId: "skill.farming",
    requiredLevel: 3,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.0,
    successBase: 0.8,
    successPerLevel: 0.008,
    successMax: 0.98,
    xpPerCycle: 24,
    drops: [{ itemId: "item.pumpkin", min: 1, max: 1, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 60,
    blocksNav: false,
    view: "crop.pumpkin",
  },
  "resource.digsite.basic": {
    id: "resource.digsite.basic",
    name: "Overgrown Dig Site",
    skillId: "skill.archaeology",
    requiredLevel: 1,
    toolTagsAny: [], // careful hands
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.4,
    successBase: 0.7,
    successPerLevel: 0.012,
    successMax: 0.95,
    xpPerCycle: 22,
    drops: [
      { itemId: "item.relic.shard", min: 1, max: 2, weight: 7 },
      { itemId: "item.bone.old", min: 1, max: 1, weight: 2 },
      { itemId: "item.relic.idol", min: 1, max: 1, weight: 1 },
      { itemId: "item.relic.urn", min: 1, max: 1, weight: 1 },
      { itemId: "item.relic.coin", min: 1, max: 1, weight: 1 },
    ],
    depletes: true,
    resourceMin: 3,
    resourceMax: 5,
    respawnS: 60,
    blocksNav: true,
    view: "digsite",
  },
  "resource.digsite.old": {
    id: "resource.digsite.old",
    name: "Ancient Foundation",
    skillId: "skill.archaeology",
    requiredLevel: 4,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.8,
    successBase: 0.62,
    successPerLevel: 0.012,
    successMax: 0.95,
    xpPerCycle: 40,
    drops: [
      { itemId: "item.relic.shard", min: 1, max: 2, weight: 5 },
      { itemId: "item.relic.idol", min: 1, max: 1, weight: 3 },
      { itemId: "item.coin", min: 2, max: 6, weight: 2 },
      { itemId: "item.relic.tablet", min: 1, max: 1, weight: 1 },
      { itemId: "item.relic.mask", min: 1, max: 1, weight: 1 },
    ],
    depletes: true,
    resourceMin: 3,
    resourceMax: 4,
    respawnS: 90,
    blocksNav: true,
    view: "digsite",
  },
  "resource.herb.sage": {
    id: "resource.herb.sage",
    name: "Wild Sage",
    skillId: "skill.herblore",
    requiredLevel: 1,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.5,
    successBase: 0.85,
    successPerLevel: 0.008,
    successMax: 0.98,
    xpPerCycle: 14,
    drops: [{ itemId: "item.herb.sage", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 4,
    respawnS: 50,
    blocksNav: false,
    view: "herb",
  },
  "resource.fishing.pond": {
    id: "resource.fishing.pond",
    name: "Rippling Shallows",
    skillId: "skill.fishing",
    requiredLevel: 1,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.0,
    successBase: 0.55,
    successPerLevel: 0.012,
    successMax: 0.9,
    xpPerCycle: 20,
    drops: [{ itemId: "item.fish.raw", min: 1, max: 1, weight: 1 }],
    depletes: false, // fish until interrupted
    resourceMin: 0,
    resourceMax: 0,
    respawnS: 0,
    blocksNav: false, // it sits in water, which already blocks movement
    view: "pond",
  },

  // ---------- farming plots: plant a seed, wait, harvest ----------
  "resource.plot.wheat": {
    id: "resource.plot.wheat",
    name: "Wheat Plot",
    skillId: "skill.farming",
    requiredLevel: 1,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.6,
    successBase: 0.9,
    successPerLevel: 0.006,
    successMax: 0.99,
    xpPerCycle: 18,
    drops: [
      { itemId: "item.wheat", min: 2, max: 4, weight: 5 },
      { itemId: "item.seed.wheat", min: 1, max: 2, weight: 2 },
    ],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 60,
    blocksNav: false,
    view: "crop.wheat",
    plantable: { seedItemId: "item.seed.wheat", growS: 60, plantXp: 10 },
  },
  "resource.plot.carrot": {
    id: "resource.plot.carrot",
    name: "Carrot Plot",
    skillId: "skill.farming",
    requiredLevel: 3,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.8,
    successBase: 0.88,
    successPerLevel: 0.006,
    successMax: 0.99,
    xpPerCycle: 26,
    drops: [
      { itemId: "item.carrot", min: 2, max: 4, weight: 5 },
      { itemId: "item.seed.carrot", min: 1, max: 2, weight: 2 },
    ],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 90,
    blocksNav: false,
    view: "crop.wheat",
    plantable: { seedItemId: "item.seed.carrot", growS: 90, plantXp: 14 },
  },
  "resource.plot.pumpkin": {
    id: "resource.plot.pumpkin",
    name: "Pumpkin Mound",
    skillId: "skill.farming",
    requiredLevel: 6,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.2,
    successBase: 0.85,
    successPerLevel: 0.006,
    successMax: 0.99,
    xpPerCycle: 42,
    drops: [
      { itemId: "item.pumpkin", min: 1, max: 2, weight: 5 },
      { itemId: "item.seed.pumpkin", min: 1, max: 1, weight: 2 },
    ],
    depletes: true,
    resourceMin: 1,
    resourceMax: 2,
    respawnS: 120,
    blocksNav: false,
    view: "crop.pumpkin",
    plantable: { seedItemId: "item.seed.pumpkin", growS: 120, plantXp: 20 },
  },
  "resource.plot.potato": {
    id: "resource.plot.potato",
    name: "Potato Row",
    skillId: "skill.farming",
    requiredLevel: 12,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.0,
    successBase: 0.84,
    successPerLevel: 0.006,
    successMax: 0.99,
    xpPerCycle: 60,
    drops: [
      { itemId: "item.crop.potato", min: 2, max: 4, weight: 5 },
      { itemId: "item.seed.potato", min: 1, max: 2, weight: 2 },
    ],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 150,
    blocksNav: false,
    view: "crop.wheat",
    plantable: { seedItemId: "item.seed.potato", growS: 150, plantXp: 30 },
  },
  "resource.plot.melon": {
    id: "resource.plot.melon",
    name: "Melon Patch",
    skillId: "skill.farming",
    requiredLevel: 25,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.4,
    successBase: 0.8,
    successPerLevel: 0.006,
    successMax: 0.99,
    xpPerCycle: 115,
    drops: [
      { itemId: "item.melon.slice", min: 3, max: 6, weight: 5 },
      { itemId: "item.seed.melon", min: 1, max: 1, weight: 2 },
    ],
    depletes: true,
    resourceMin: 1,
    resourceMax: 2,
    respawnS: 200,
    blocksNav: false,
    view: "crop.pumpkin",
    viewMaterial: "melon",
    plantable: { seedItemId: "item.seed.melon", growS: 200, plantXp: 55 },
  },

  // ---------- hunting: game trails worked with a trap ----------
  "resource.trail.rabbit": {
    id: "resource.trail.rabbit",
    name: "Rabbit Run",
    skillId: "skill.hunting",
    requiredLevel: 1,
    toolTagsAny: ["trap"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.5,
    successBase: 0.62,
    successPerLevel: 0.012,
    successMax: 0.95,
    xpPerCycle: 20,
    drops: [
      { itemId: "item.game.rabbit", min: 1, max: 1, weight: 5 },
      { itemId: "item.feather", min: 1, max: 2, weight: 3 },
      { itemId: "item.fur", min: 1, max: 1, weight: 2 },
    ],
    depletes: true,
    resourceMin: 2,
    resourceMax: 4,
    respawnS: 50,
    blocksNav: false,
    view: "trail",
  },
  "resource.trail.moor": {
    id: "resource.trail.moor",
    name: "Moorland Trail",
    skillId: "skill.hunting",
    requiredLevel: 8,
    toolTagsAny: ["trap"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.0,
    successBase: 0.52,
    successPerLevel: 0.012,
    successMax: 0.92,
    xpPerCycle: 44,
    drops: [
      { itemId: "item.fur", min: 1, max: 2, weight: 5 },
      { itemId: "item.game.rabbit", min: 1, max: 1, weight: 3 },
      { itemId: "item.feather", min: 2, max: 3, weight: 2 },
    ],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 75,
    blocksNav: false,
    view: "trail",
  },

  // ---------- thieving: light fingers, real consequences ----------
  "resource.stall.market": {
    id: "resource.stall.market",
    name: "Market Stall",
    skillId: "skill.thieving",
    requiredLevel: 1,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.2,
    successBase: 0.6,
    successPerLevel: 0.012,
    successMax: 0.95,
    xpPerCycle: 16,
    drops: [
      { itemId: "item.coin", min: 1, max: 3, weight: 6 },
      { itemId: "item.berry.basic", min: 1, max: 2, weight: 2 },
      { itemId: "item.bread.basic", min: 1, max: 1, weight: 1 },
    ],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 30,
    blocksNav: true,
    view: "stall",
    failDamage: 2,
  },
  "resource.strongbox.old": {
    id: "resource.strongbox.old",
    name: "Locked Strongbox",
    skillId: "skill.thieving",
    requiredLevel: 5,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.0,
    successBase: 0.5,
    successPerLevel: 0.012,
    successMax: 0.9,
    xpPerCycle: 55,
    drops: [
      { itemId: "item.coin", min: 5, max: 12, weight: 5 },
      { itemId: "item.trinket.jade", min: 1, max: 1, weight: 2 },
      { itemId: "item.relic.shard", min: 1, max: 2, weight: 2 },
    ],
    depletes: true,
    resourceMin: 1,
    resourceMax: 1,
    respawnS: 180,
    blocksNav: true,
    view: "strongbox",
    failDamage: 4,
  },

  // ---------- far-zone fishing: deeper waters, better fish ----------
  "resource.fishing.marsh": {
    id: "resource.fishing.marsh",
    name: "Black-water Pool",
    skillId: "skill.fishing",
    requiredLevel: 12,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.4,
    successBase: 0.48,
    successPerLevel: 0.012,
    successMax: 0.9,
    xpPerCycle: 44,
    drops: [{ itemId: "item.fish.eel", min: 1, max: 1, weight: 1 }],
    depletes: false,
    resourceMin: 0,
    resourceMax: 0,
    respawnS: 0,
    blocksNav: false,
    view: "pond",
  },
  "resource.fishing.ice": {
    id: "resource.fishing.ice",
    name: "Ice Hole",
    skillId: "skill.fishing",
    requiredLevel: 20,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.8,
    successBase: 0.42,
    successPerLevel: 0.012,
    successMax: 0.88,
    xpPerCycle: 70,
    drops: [{ itemId: "item.fish.icefin", min: 1, max: 1, weight: 1 }],
    depletes: false,
    resourceMin: 0,
    resourceMax: 0,
    respawnS: 0,
    blocksNav: false,
    view: "pond",
  },
  "resource.fishing.river": {
    id: "resource.fishing.river",
    name: "Riffle Run",
    skillId: "skill.fishing",
    requiredLevel: 5,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.0,
    successBase: 0.55,
    successPerLevel: 0.012,
    successMax: 0.92,
    xpPerCycle: 30,
    drops: [{ itemId: "item.fish.trout", min: 1, max: 1, weight: 1 }],
    depletes: false,
    resourceMin: 0,
    resourceMax: 0,
    respawnS: 0,
    blocksNav: false,
    view: "pond",
  },
  "resource.fishing.sea": {
    id: "resource.fishing.sea",
    name: "Tidal Run",
    skillId: "skill.fishing",
    requiredLevel: 30,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.4,
    successBase: 0.5,
    successPerLevel: 0.012,
    successMax: 0.92,
    xpPerCycle: 68,
    drops: [{ itemId: "item.fish.seabass", min: 1, max: 1, weight: 1 }],
    depletes: false,
    resourceMin: 0,
    resourceMax: 0,
    respawnS: 0,
    blocksNav: false,
    view: "pond",
  },
  "resource.fishing.deep": {
    id: "resource.fishing.deep",
    name: "Deepwater Rise",
    skillId: "skill.fishing",
    requiredLevel: 45,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.8,
    successBase: 0.46,
    successPerLevel: 0.012,
    successMax: 0.9,
    xpPerCycle: 110,
    drops: [{ itemId: "item.fish.sunscale", min: 1, max: 1, weight: 1 }],
    depletes: false,
    resourceMin: 0,
    resourceMax: 0,
    respawnS: 0,
    blocksNav: false,
    view: "pond",
  },
  // ---- the coastal/deep-water ladder: each tier only spawns farther from
  //      home, so pushing your Fishing means sailing or trekking out ----
  "resource.fishing.shrimp": {
    id: "resource.fishing.shrimp",
    name: "Shrimp Shoal",
    skillId: "skill.fishing",
    requiredLevel: 1,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.6,
    successBase: 0.62,
    successPerLevel: 0.012,
    successMax: 0.95,
    xpPerCycle: 14,
    drops: [{ itemId: "item.fish.shrimp", min: 1, max: 1, weight: 1 }],
    depletes: false, resourceMin: 0, resourceMax: 0, respawnS: 0, blocksNav: false,
    view: "pond",
  },
  "resource.fishing.crab": {
    id: "resource.fishing.crab",
    name: "Crab Pool",
    skillId: "skill.fishing",
    requiredLevel: 18,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.2,
    successBase: 0.5,
    successPerLevel: 0.012,
    successMax: 0.9,
    xpPerCycle: 58,
    drops: [{ itemId: "item.fish.crab", min: 1, max: 1, weight: 1 }],
    depletes: false, resourceMin: 0, resourceMax: 0, respawnS: 0, blocksNav: false,
    view: "pond",
  },
  "resource.fishing.lobster": {
    id: "resource.fishing.lobster",
    name: "Lobster Ground",
    skillId: "skill.fishing",
    requiredLevel: 40,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.6,
    successBase: 0.48,
    successPerLevel: 0.012,
    successMax: 0.9,
    xpPerCycle: 95,
    drops: [{ itemId: "item.fish.lobster", min: 1, max: 1, weight: 1 }],
    depletes: false, resourceMin: 0, resourceMax: 0, respawnS: 0, blocksNav: false,
    view: "pond",
  },
  "resource.fishing.marlin": {
    id: "resource.fishing.marlin",
    name: "Marlin Run",
    skillId: "skill.fishing",
    requiredLevel: 55,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 3.8,
    successBase: 0.46,
    successPerLevel: 0.012,
    successMax: 0.88,
    xpPerCycle: 145,
    drops: [{ itemId: "item.fish.marlin", min: 1, max: 1, weight: 1 }],
    depletes: false, resourceMin: 0, resourceMax: 0, respawnS: 0, blocksNav: false,
    view: "pond",
  },
  "resource.fishing.abyss": {
    id: "resource.fishing.abyss",
    name: "Abyssal Upwelling",
    skillId: "skill.fishing",
    requiredLevel: 70,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 4.0,
    successBase: 0.44,
    successPerLevel: 0.012,
    successMax: 0.88,
    xpPerCycle: 200,
    drops: [{ itemId: "item.fish.gloom", min: 1, max: 1, weight: 1 }],
    depletes: false, resourceMin: 0, resourceMax: 0, respawnS: 0, blocksNav: false,
    view: "pond",
  },
  "resource.fishing.storm": {
    id: "resource.fishing.storm",
    name: "Storm Rise",
    skillId: "skill.fishing",
    requiredLevel: 85,
    toolTagsAny: ["fishing_tool"],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 4.2,
    successBase: 0.42,
    successPerLevel: 0.012,
    successMax: 0.86,
    xpPerCycle: 270,
    drops: [{ itemId: "item.fish.stormscale", min: 1, max: 1, weight: 1 }],
    depletes: false, resourceMin: 0, resourceMax: 0, respawnS: 0, blocksNav: false,
    view: "pond",
  },

  // ---------- herblore: rarer herbs beyond wild sage ----------
  "resource.herb.mint": {
    id: "resource.herb.mint",
    name: "River Mint",
    skillId: "skill.herblore",
    requiredLevel: 4,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 1.7,
    successBase: 0.8,
    successPerLevel: 0.008,
    successMax: 0.98,
    xpPerCycle: 26,
    drops: [{ itemId: "item.herb.mint", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 60,
    blocksNav: false,
    view: "herb",
  },
  "resource.herb.ember": {
    id: "resource.herb.ember",
    name: "Emberleaf",
    skillId: "skill.herblore",
    requiredLevel: 8,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.0,
    successBase: 0.72,
    successPerLevel: 0.008,
    successMax: 0.96,
    xpPerCycle: 46,
    drops: [{ itemId: "item.herb.emberleaf", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 80,
    blocksNav: false,
    view: "herb",
  },
  "resource.herb.frostbloom": {
    id: "resource.herb.frostbloom",
    name: "Frostbloom",
    skillId: "skill.herblore",
    requiredLevel: 16,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.2,
    successBase: 0.66,
    successPerLevel: 0.008,
    successMax: 0.96,
    xpPerCycle: 74,
    drops: [{ itemId: "item.herb.frostbloom", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 95,
    blocksNav: false,
    view: "herb",
  },
  "resource.herb.duskcap": {
    id: "resource.herb.duskcap",
    name: "Duskcap Ring",
    skillId: "skill.herblore",
    requiredLevel: 30,
    toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    cycleTimeS: 2.5,
    successBase: 0.6,
    successPerLevel: 0.008,
    successMax: 0.95,
    xpPerCycle: 130,
    drops: [{ itemId: "item.herb.duskcap", min: 1, max: 2, weight: 1 }],
    depletes: true,
    resourceMin: 2,
    resourceMax: 3,
    respawnS: 120,
    blocksNav: false,
    view: "herb",
  },
  ...ladderNodes(),
};

// ============================================================================
// SKILL-LADDER EXPANSION nodes (see SKILL_PLANS.md): Foraging berry bushes,
// Hunting game trails, Archaeology dig sites, high-tier Mining veins, and two
// higher Farming crops. Views reuse the existing bush/trail/digsite/rock/crop
// renderers; per-tier viewMaterial drives the (deferred) art variants and, for
// rocks, the tinted ore tile. Placement lives in worldgen (endless ladder
// scatter + settlement homes).
// ============================================================================
function ladderNodes(): Record<string, ResourceNodeDef> {
  const out: Record<string, ResourceNodeDef> = {};
  const drop = (itemId: string, min: number, max: number, weight: number): DropEntry => ({ itemId, min, max, weight });
  // ---- Foraging: 9-tier berry-bush ladder (view 'bush') ----
  const bush = (
    id: string, name: string, level: number, xp: number, cycleTimeS: number,
    sBase: number, sPer: number, sMax: number, drops: DropEntry[], respawnS: number,
    resMin: number, resMax: number, tools: string[], viewMaterial: string, failDamage?: number,
  ) => {
    out[id] = {
      id, name, skillId: "skill.foraging", requiredLevel: level, toolTagsAny: tools,
      interaction: { mode: "adjacent_4", rangeCells: 1 }, cycleTimeS,
      successBase: sBase, successPerLevel: sPer, successMax: sMax, xpPerCycle: xp,
      drops, depletes: true, resourceMin: resMin, resourceMax: resMax, respawnS,
      blocksNav: false, view: "bush", viewMaterial, ...(failDamage ? { failDamage } : {}),
    };
  };
  bush("resource.bush.redberry", "Redberry Bush", 8, 30, 1.5, 0.82, 0.008, 0.98, [drop("item.forage.redberry", 1, 2, 1)], 55, 3, 4, [], "redberry");
  bush("resource.bush.cadava", "Cadava Bush", 15, 55, 1.7, 0.78, 0.008, 0.97, [drop("item.forage.cadava", 1, 2, 1)], 65, 3, 4, [], "cadava");
  bush("resource.bush.dwellberry", "Dwellberry Bramble", 22, 85, 1.9, 0.74, 0.008, 0.97, [drop("item.forage.dwellberry", 1, 2, 1)], 80, 3, 4, [], "dwellberry");
  bush("resource.bush.cloudberry", "Cloudberry Bush", 30, 130, 2.1, 0.70, 0.008, 0.96, [drop("item.forage.cloudberry", 1, 2, 1)], 95, 2, 4, ["secateurs"], "cloudberry");
  bush("resource.bush.jangerberry", "Jangerberry Vine", 40, 200, 2.2, 0.66, 0.008, 0.96, [drop("item.forage.jangerberry", 1, 2, 1)], 110, 2, 3, ["secateurs"], "jangerberry");
  bush("resource.bush.prickly", "Prickly Pear Cactus", 52, 300, 2.3, 0.62, 0.008, 0.95, [drop("item.forage.pricklypear", 1, 2, 1)], 120, 2, 3, ["secateurs"], "prickly");
  bush("resource.bush.whiteberry", "Whiteberry Bush", 65, 440, 2.4, 0.58, 0.009, 0.95, [drop("item.forage.whiteberry", 1, 2, 1)], 130, 2, 3, ["secateurs"], "whiteberry");
  bush("resource.bush.poisonivy", "Poison Ivy Bush", 78, 620, 2.5, 0.54, 0.009, 0.95, [drop("item.forage.poisonivy", 1, 3, 1)], 140, 2, 3, ["secateurs"], "poisonivy", 3);
  bush("resource.bush.everlight", "Everlight Bramble", 90, 850, 2.6, 0.50, 0.010, 0.95, [drop("item.forage.everlight", 1, 2, 5), drop("item.forage.jangerberry", 1, 1, 1)], 150, 2, 3, ["secateurs"], "everlight");
  // ---- Hunting: 8-tier game-trail ladder (view 'trail', trap-gated) ----
  const trail = (
    id: string, name: string, level: number, xp: number, cycleTimeS: number,
    sBase: number, sMax: number, drops: DropEntry[], respawnS: number,
    resMin: number, resMax: number, viewMaterial: string,
  ) => {
    out[id] = {
      id, name, skillId: "skill.hunting", requiredLevel: level, toolTagsAny: ["trap"],
      interaction: { mode: "adjacent_4", rangeCells: 1 }, cycleTimeS,
      successBase: sBase, successPerLevel: 0.012, successMax: sMax, xpPerCycle: xp,
      drops, depletes: true, resourceMin: resMin, resourceMax: resMax, respawnS,
      blocksNav: false, view: "trail", viewMaterial,
    };
  };
  trail("resource.trail.fowl", "Fowl Snare", 15, 70, 3.0, 0.50, 0.92, [drop("item.game.fowl", 1, 1, 4), drop("item.feather", 2, 4, 4), drop("item.fur", 1, 1, 2)], 65, 2, 4, "net");
  trail("resource.trail.kebbit", "Kebbit Burrow", 22, 105, 3.2, 0.48, 0.92, [drop("item.hide.kebbit", 1, 1, 5), drop("item.fur", 1, 2, 3)], 80, 2, 3, "box");
  trail("resource.trail.boar", "Boar Wallow", 30, 155, 3.3, 0.46, 0.90, [drop("item.game.boar", 1, 1, 5), drop("item.hide.thick", 1, 1, 3), drop("item.tusk", 1, 1, 1)], 90, 2, 3, "pit");
  trail("resource.trail.chinchompa", "Chinchompa Nest", 40, 230, 3.4, 0.44, 0.90, [drop("item.chinchompa", 1, 1, 5), drop("item.fur", 1, 2, 2)], 110, 1, 3, "box");
  trail("resource.trail.polar", "Polar Kebbit Track", 52, 340, 3.5, 0.42, 0.90, [drop("item.hide.polar", 1, 1, 5), drop("item.tusk", 1, 1, 2)], 120, 1, 3, "deadfall");
  trail("resource.trail.sabre", "Sabre-tooth Track", 65, 480, 3.7, 0.40, 0.88, [drop("item.hide.sabre", 1, 1, 5), drop("item.tusk", 1, 2, 3), drop("item.bone.big", 1, 1, 2)], 130, 1, 2, "pit");
  trail("resource.trail.grenwall", "Grenwall Thicket", 78, 660, 3.8, 0.38, 0.88, [drop("item.game.grenwall", 1, 1, 4), drop("item.spike.grenwall", 1, 3, 4)], 135, 1, 2, "box");
  trail("resource.trail.antelope", "Moonlight Antelope Track", 90, 900, 4.0, 0.36, 0.88, [drop("item.hide.antelope", 1, 1, 5), drop("item.game.antelope", 1, 1, 4), drop("item.antler", 1, 1, 2)], 145, 1, 2, "net");
  // ---- Archaeology: 8-tier dig-site ladder (view 'digsite', mattock-gated) ----
  const dig = (
    id: string, name: string, level: number, xp: number, cycleTimeS: number,
    sBase: number, sMax: number, drops: DropEntry[], respawnS: number, viewMaterial: string,
  ) => {
    out[id] = {
      id, name, skillId: "skill.archaeology", requiredLevel: level, toolTagsAny: ["mattock"],
      interaction: { mode: "adjacent_4", rangeCells: 1 }, cycleTimeS,
      successBase: sBase, successPerLevel: 0.012, successMax: sMax, xpPerCycle: xp,
      drops, depletes: true, resourceMin: 2, resourceMax: 3, respawnS,
      blocksNav: true, view: "digsite", viewMaterial,
    };
  };
  dig("resource.digsite.barrow", "Barrow Mound", 15, 80, 2.9, 0.58, 0.95, [drop("item.arch.samples", 1, 3, 6), drop("item.bone.old", 1, 2, 3), drop("item.relic.torque", 1, 1, 2), drop("item.coin", 2, 8, 2)], 90, "barrow");
  dig("resource.digsite.ruin", "Sunken Ruin", 25, 120, 3.0, 0.54, 0.95, [drop("item.arch.samples", 1, 3, 6), drop("item.relic.tablet", 1, 1, 2), drop("item.relic.chalice", 1, 1, 2), drop("item.coin", 4, 10, 2)], 100, "ruin");
  dig("resource.digsite.kiln", "Ashen Kiln", 35, 175, 3.2, 0.50, 0.94, [drop("item.arch.samples", 1, 3, 6), drop("item.relic.censer", 1, 1, 2), drop("item.gem.emberstone", 1, 1, 2), drop("item.coin", 6, 14, 2)], 110, "kiln");
  dig("resource.digsite.temple", "Buried Temple", 45, 250, 3.3, 0.48, 0.94, [drop("item.arch.samples", 2, 4, 6), drop("item.relic.mask", 1, 1, 2), drop("item.relic.idol", 1, 1, 2), drop("item.gem.jade", 1, 1, 1)], 120, "temple");
  dig("resource.digsite.citadel", "Frozen Citadel", 55, 350, 3.5, 0.46, 0.93, [drop("item.arch.samples", 2, 4, 6), drop("item.relic.astrolabe", 1, 1, 2), drop("item.gem.sapphire", 1, 1, 1), drop("item.coin", 10, 20, 2)], 130, "citadel");
  dig("resource.digsite.warforge", "Warforge Trench", 65, 480, 3.6, 0.44, 0.93, [drop("item.arch.samples", 2, 4, 6), drop("item.relic.sceptre", 1, 1, 2), drop("item.bar.iron", 1, 2, 2), drop("item.gem.ruby", 1, 1, 1)], 135, "warforge");
  dig("resource.digsite.everlight", "Everlight Excavation", 78, 650, 3.8, 0.42, 0.92, [drop("item.arch.samples", 3, 5, 6), drop("item.relic.crown", 1, 1, 1), drop("item.gem.diamond", 1, 1, 1), drop("item.coin", 15, 30, 2)], 145, "everlight");
  dig("resource.digsite.senntisten", "Senntisten Dig", 90, 900, 4.0, 0.40, 0.92, [drop("item.arch.samples", 3, 5, 6), drop("item.relic.crown", 1, 1, 2), drop("item.relic.astrolabe", 1, 1, 2), drop("item.coin", 20, 40, 2)], 150, "senntisten");
  // ---- Mining: three high-tier metal veins (view 'rock') ----
  const vein = (id: string, name: string, level: number, xp: number, cycleTimeS: number, sBase: number, sMax: number, oreId: string, respawnS: number, viewMaterial: string) => {
    out[id] = {
      id, name, skillId: "skill.mining", requiredLevel: level, toolTagsAny: ["pickaxe"],
      interaction: { mode: "adjacent_4", rangeCells: 1 }, cycleTimeS,
      successBase: sBase, successPerLevel: 0.01, successMax: sMax, xpPerCycle: xp,
      drops: [drop(oreId, 1, 1, 1)], depletes: true, resourceMin: 3, resourceMax: 5, respawnS,
      blocksNav: true, view: "rock", viewMaterial,
    };
  };
  vein("resource.rock.mithril", "Mithril-veined Rock", 30, 58, 3.0, 0.56, 0.95, "item.ore.mithril", 75, "resource.rock.mithril");
  vein("resource.rock.adamant", "Adamantite Rock", 45, 100, 3.4, 0.50, 0.94, "item.ore.adamant", 110, "resource.rock.adamant");
  vein("resource.rock.runite", "Runite Vein", 58, 160, 3.8, 0.46, 0.92, "item.ore.runite", 150, "resource.rock.runite");
  // ---- Thieving: town stalls (fast respawn) + guarded strongboxes ----
  const stall = (id: string, name: string, level: number, xp: number, cycleTimeS: number, sBase: number, sMax: number, failDamage: number, resMin: number, resMax: number, respawnS: number, drops: DropEntry[]) => {
    out[id] = {
      id, name, skillId: "skill.thieving", requiredLevel: level, toolTagsAny: [],
      interaction: { mode: "adjacent_4", rangeCells: 1 }, cycleTimeS,
      successBase: sBase, successPerLevel: 0.012, successMax: sMax, xpPerCycle: xp,
      drops, depletes: true, resourceMin: resMin, resourceMax: resMax, respawnS,
      blocksNav: true, view: "stall", failDamage,
    };
  };
  stall("resource.stall.fruit", "Produce Stall", 10, 32, 2.4, 0.58, 0.93, 3, 2, 3, 36, [drop("item.coin", 2, 5, 6), drop("item.pumpkin", 1, 1, 2), drop("item.seed.carrot", 1, 2, 2), drop("item.berry.basic", 1, 2, 1)]);
  stall("resource.stall.silk", "Silk & Cloth Stall", 25, 64, 2.6, 0.52, 0.92, 5, 2, 3, 45, [drop("item.coin", 4, 9, 6), drop("item.wool", 1, 3, 3), drop("item.trinket.jade", 1, 1, 1)]);
  stall("resource.stall.spice", "Spice Stall", 40, 108, 2.8, 0.48, 0.90, 7, 2, 2, 60, [drop("item.coin", 8, 16, 6), drop("item.herb.sage", 1, 2, 3), drop("item.herb.mint", 1, 2, 2), drop("item.gem.opal", 1, 1, 1)]);
  stall("resource.stall.gem", "Gem Stall", 55, 165, 3.0, 0.44, 0.90, 9, 1, 2, 90, [drop("item.coin", 12, 24, 6), drop("item.gem.opal", 1, 1, 3), drop("item.gem.jade", 1, 1, 2), drop("item.gem.topaz", 1, 1, 2), drop("item.gem.sapphire", 1, 1, 1)]);
  stall("resource.stall.scholar", "Scholar's Stall", 70, 235, 3.2, 0.40, 0.88, 12, 1, 2, 120, [drop("item.coin", 20, 40, 6), drop("item.relic.coin", 1, 1, 2), drop("item.relic.tablet", 1, 1, 2), drop("item.gem.ruby", 1, 1, 1), drop("item.treasure_map", 1, 1, 1)]);
  const box = (id: string, name: string, level: number, xp: number, cycleTimeS: number, sBase: number, sMax: number, failDamage: number, respawnS: number, drops: DropEntry[]) => {
    out[id] = {
      id, name, skillId: "skill.thieving", requiredLevel: level, toolTagsAny: [],
      interaction: { mode: "adjacent_4", rangeCells: 1 }, cycleTimeS,
      successBase: sBase, successPerLevel: 0.012, successMax: sMax, xpPerCycle: xp,
      drops, depletes: true, resourceMin: 1, resourceMax: 1, respawnS,
      blocksNav: true, view: "strongbox", failDamage,
    };
  };
  box("resource.strongbox.iron", "Iron-Banded Strongbox", 20, 120, 3.4, 0.46, 0.88, 8, 210, [drop("item.coin", 10, 24, 5), drop("item.ring.gold", 1, 1, 2), drop("item.gem.sapphire", 1, 1, 2), drop("item.relic.urn", 1, 1, 1)]);
  box("resource.strongbox.merchant", "Merchant's Strongbox", 35, 200, 3.8, 0.42, 0.87, 11, 260, [drop("item.coin", 20, 45, 5), drop("item.amulet.gold", 1, 1, 2), drop("item.gem.ruby", 1, 1, 2), drop("item.relic.tablet", 1, 1, 1), drop("item.treasure_map", 1, 1, 1)]);
  box("resource.strongbox.vault", "Vault Strongbox", 50, 300, 4.2, 0.38, 0.86, 14, 320, [drop("item.coin", 40, 90, 5), drop("item.bar.gold", 1, 1, 2), drop("item.gem.dragonstone", 1, 1, 1), drop("item.relic.mask", 1, 1, 1)]);
  box("resource.strongbox.royal", "Royal Coffer", 65, 430, 4.6, 0.34, 0.85, 17, 400, [drop("item.coin", 80, 160, 5), drop("item.amulet.ruby", 1, 1, 2), drop("item.gem.dragonstone", 1, 1, 2), drop("item.relic.idol", 1, 1, 1)]);
  box("resource.strongbox.warded", "Warded Reliquary", 80, 600, 5.0, 0.30, 0.84, 21, 480, [drop("item.coin", 150, 300, 5), drop("item.amulet.dragonstone", 1, 1, 2), drop("item.gem.diamond", 1, 1, 1), drop("item.relic.mask", 1, 1, 1)]);
  // ---- Farming: two higher crops (plantable plots) ----
  out["resource.plot.corn"] = {
    id: "resource.plot.corn", name: "Cornfield", skillId: "skill.farming", requiredLevel: 38, toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 }, cycleTimeS: 2.4, successBase: 0.78, successPerLevel: 0.006, successMax: 0.99, xpPerCycle: 175,
    drops: [drop("item.crop.corn", 3, 5, 5), drop("item.seed.corn", 1, 2, 2)], depletes: true, resourceMin: 1, resourceMax: 2, respawnS: 240,
    blocksNav: false, view: "crop.wheat", plantable: { seedItemId: "item.seed.corn", growS: 240, plantXp: 80 },
  };
  out["resource.plot.sunfruit"] = {
    id: "resource.plot.sunfruit", name: "Sunfruit Grove", skillId: "skill.farming", requiredLevel: 52, toolTagsAny: [],
    interaction: { mode: "adjacent_4", rangeCells: 1 }, cycleTimeS: 2.8, successBase: 0.74, successPerLevel: 0.006, successMax: 0.99, xpPerCycle: 260,
    drops: [drop("item.crop.sunfruit", 2, 4, 5), drop("item.seed.sunfruit", 1, 1, 2)], depletes: true, resourceMin: 1, resourceMax: 2, respawnS: 300,
    blocksNav: false, view: "crop.pumpkin", viewMaterial: "sunfruit", plantable: { seedItemId: "item.seed.sunfruit", growS: 300, plantXp: 120 },
  };
  return out;
}

export const OBJECTS: Record<string, WorldObjectDef> = {
  "object.storage_chest.basic": {
    id: "object.storage_chest.basic",
    name: "Storage Chest",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    containerSlots: 40,
    blocksNav: true,
  },
  "object.campfire.basic": {
    id: "object.campfire.basic",
    name: "Campfire",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: [
      "recipe.cooked_fish", "recipe.cooked_pork", "recipe.cooked_beef",
      "recipe.cooked_chicken", "recipe.cooked_mutton", "recipe.bread",
      "recipe.baked_potato",
      "recipe.roast_pumpkin", "recipe.healing_salve", "recipe.cooked_rabbit",
      "recipe.carrot_stew", "recipe.oakblood_tonic", "recipe.smoked_eel",
      "recipe.seared_icefin", "recipe.panfried_trout", "recipe.roast_seabass",
      "recipe.glazed_sunscale", "recipe.buttered_shrimp", "recipe.boiled_crab",
      "recipe.steamed_lobster", "recipe.grilled_marlin", "recipe.abyssal_delicacy",
      "recipe.storm_fillet",
      "recipe.frost_salve", "recipe.dusk_poultice", "recipe.ember_liniment",
      "recipe.kings_tincture",
      "recipe.cooked_fowl", "recipe.cooked_boar", "recipe.cooked_grenwall", "recipe.cooked_antelope",
    ],
    blocksNav: true,
  },
  "object.furnace.basic": {
    id: "object.furnace.basic",
    name: "Stone Furnace",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: ["recipe.copper_bar", "recipe.tin_bar", "recipe.bronze_bar", "recipe.iron_bar", "recipe.steel_bar", "recipe.mithril_bar", "recipe.gold_bar", "recipe.adamant_bar", "recipe.runite_bar", "recipe.stone_brick", "recipe.netherite_scrap", "recipe.netherite_ingot"],
    blocksNav: true,
  },
  "object.buildsite.jetty": {
    id: "object.buildsite.jetty",
    name: "Broken Jetty (needs 8 planks, 2 rope)",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    buildRequires: [
      { itemId: "item.plank.cut", qty: 8 },
      { itemId: "item.rope", qty: 2 },
    ],
    buildSkillId: "skill.construction",
    buildXp: 220,
    completionFlag: "worldstate.jetty_built",
    blocksNav: true,
  },
  "object.buildsite.footbridge": {
    id: "object.buildsite.footbridge",
    name: "Fallen Footbridge (needs 10 planks, 4 stone bricks)",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    buildRequires: [
      { itemId: "item.plank.cut", qty: 10 },
      { itemId: "item.brick.stone", qty: 4 },
    ],
    buildSkillId: "skill.construction",
    buildXp: 300,
    completionFlag: "worldstate.footbridge_built",
    blocksNav: true,
  },
  "object.buildsite.ford": {
    id: "object.buildsite.ford",
    name: "Washed-out Ford (needs 8 rough stone, 4 planks)",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    buildRequires: [
      { itemId: "item.stone.rough", qty: 8 },
      { itemId: "item.plank.cut", qty: 4 },
    ],
    buildSkillId: "skill.construction",
    buildXp: 260,
    completionFlag: "worldstate.ford_built",
    blocksNav: true,
  },
  "object.buildsite.ramp": {
    id: "object.buildsite.ramp",
    name: "Collapsed Terrace Ramp (needs 6 stone bricks, 4 planks)",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    buildRequires: [
      { itemId: "item.brick.stone", qty: 6 },
      { itemId: "item.plank.cut", qty: 4 },
    ],
    buildSkillId: "skill.construction",
    buildXp: 340,
    completionFlag: "worldstate.ramp_built",
    blocksNav: true,
  },
  "object.buildbench.basic": {
    id: "object.buildbench.basic",
    name: "Carpenter's Bench",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: [
      "recipe.build_stool", "recipe.build_crate", "recipe.build_chair", "recipe.build_table",
      "recipe.build_bench", "recipe.build_bookshelf", "recipe.build_bed", "recipe.build_dresser",
      "recipe.build_wardrobe", "recipe.build_hearth", "recipe.build_fireplace", "recipe.build_cabinet",
      "recipe.build_wall_shelf", "recipe.build_fourposter", "recipe.build_throne", "recipe.build_altar",
    ],
    blocksNav: true,
  },
  "object.shortcut.log": {
    id: "object.shortcut.log",
    name: "Fallen Log",
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    shortcut: { level: 1, xp: 12 },
    blocksNav: false,
  },
  "object.shortcut.scramble": {
    id: "object.shortcut.scramble",
    name: "Rocky Scramble",
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    shortcut: { level: 4, xp: 20 },
    blocksNav: false,
  },
  "object.shortcut.wallrope": {
    id: "object.shortcut.wallrope",
    name: "Knotted Wall Rope",
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    shortcut: { level: 7, xp: 30 },
    blocksNav: false,
  },
  "object.shortcut.cliffrope": {
    id: "object.shortcut.cliffrope",
    name: "Frayed Cliff Rope",
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    shortcut: { level: 10, xp: 45 },
    blocksNav: false,
  },
  "object.shortcut.mesaledge": {
    id: "object.shortcut.mesaledge",
    name: "Broken Mesa Ledges",
    interaction: { mode: "adjacent_8", rangeCells: 1 },
    shortcut: { level: 12, xp: 60 },
    blocksNav: false,
  },
  // ---- Agility: the mid/high shortcut ladder (SKILL_PLANS.md) ----
  "object.shortcut.steppingstones": {
    id: "object.shortcut.steppingstones", name: "Stepping Stones",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 18, xp: 82 }, blocksNav: false,
  },
  "object.shortcut.ropeswing": {
    id: "object.shortcut.ropeswing", name: "Rope Swing",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 24, xp: 108 }, blocksNav: false,
  },
  "object.shortcut.balancebeam": {
    id: "object.shortcut.balancebeam", name: "Balance Beam",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 31, xp: 138 }, blocksNav: false,
  },
  "object.shortcut.crumbledwall": {
    id: "object.shortcut.crumbledwall", name: "Crumbled Wall",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 38, xp: 172 }, blocksNav: false,
  },
  "object.shortcut.handholds": {
    id: "object.shortcut.handholds", name: "Cliff Handholds",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 45, xp: 212 }, blocksNav: false,
  },
  "object.shortcut.culvert": {
    id: "object.shortcut.culvert", name: "Culvert Squeeze",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 52, xp: 258 }, blocksNav: false,
  },
  "object.shortcut.cliffclimb": {
    id: "object.shortcut.cliffclimb", name: "Sheer Cliff Climb",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 60, xp: 312 }, blocksNav: false,
  },
  "object.shortcut.chasmleap": {
    id: "object.shortcut.chasmleap", name: "Chasm Leap",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 68, xp: 372 }, blocksNav: false,
  },
  "object.shortcut.zipline": {
    id: "object.shortcut.zipline", name: "Rope Zip-line",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 74, xp: 432 }, blocksNav: false,
  },
  "object.shortcut.spiretraverse": {
    id: "object.shortcut.spiretraverse", name: "Spire Traverse",
    interaction: { mode: "adjacent_8", rangeCells: 1 }, shortcut: { level: 80, xp: 500 }, blocksNav: false,
  },
  "object.enchanter.basic": {
    id: "object.enchanter.basic",
    name: "Enchanting Table",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: ["recipe.runed_axe", "recipe.runed_pickaxe", "recipe.runed_boots", "recipe.runed_rod", "recipe.runed_sword", "recipe.runed_bow", "recipe.astral_sword"],
    blocksNav: true,
  },
  "object.cauldron.basic": {
    id: "object.cauldron.basic",
    name: "Brewing Cauldron",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: [
      "recipe.potion_swift", "recipe.potion_strength", "recipe.potion_stoneskin",
      "recipe.potion_gathering", "recipe.potion_focus",
      "recipe.potion_gathering_keen", "recipe.tonic_warden",
      "recipe.potion_swift_greater", "recipe.potion_gathering_greater", "recipe.potion_strength_greater",
      "recipe.potion_stoneskin_greater", "recipe.potion_focus_greater", "recipe.tonic_warden_greater",
      "recipe.potion_swift_super", "recipe.potion_gathering_super", "recipe.potion_strength_super",
      "recipe.potion_stoneskin_super", "recipe.potion_focus_super", "recipe.tonic_warden_super",
      "recipe.potion_swift_grand", "recipe.potion_gathering_grand", "recipe.potion_strength_grand",
      "recipe.potion_stoneskin_grand", "recipe.potion_focus_grand", "recipe.tonic_warden_grand",
    ],
    blocksNav: true,
  },
  "object.workbench.basic": {
    id: "object.workbench.basic",
    name: "Workbench",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: [
      "recipe.cut_planks", "recipe.rope", "recipe.bone_charm", "recipe.bow_wood",
      "recipe.bow_yew", "recipe.trap_basic", "recipe.trap_fine",
      "recipe.fletch_shafts", "recipe.fletch_bronze_arrows", "recipe.fletch_iron_arrows",
      "recipe.fletch_oak_bow", "recipe.fletch_spruce_bow", "recipe.fletch_jungle_bow", "recipe.fletch_dark_bow",
      "recipe.ring_opal", "recipe.ring_sapphire", "recipe.amulet_emerald",
      "recipe.amulet_ruby", "recipe.amulet_dragonstone",
      "recipe.salvage_bar", "recipe.salvage_gem", "recipe.gizmo_swift", "recipe.gizmo_precise",
      "recipe.salvage_plate", "recipe.gizmo_bulwark", "recipe.gizmo_titan",
      "recipe.boat_raft", "recipe.boat_rowboat", "recipe.boat_skiff", "recipe.boat_cutter", "recipe.boat_longship",
      "recipe.cut_planks_oak", "recipe.cut_planks_teak", "recipe.cut_planks_mahogany",
      "recipe.fletch_steel_arrows", "recipe.fletch_mithril_arrows", "recipe.fletch_adamant_arrows", "recipe.fletch_rune_arrows",
      "recipe.rod_fly", "recipe.rod_barbed", "recipe.rod_pearl",
    ],
    blocksNav: true,
  },
  "object.altar.rune": {
    id: "object.altar.rune",
    name: "Arcane Altar",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: [
      "recipe.rune_air", "recipe.rune_water", "recipe.rune_earth", "recipe.rune_fire",
      "recipe.rune_body", "recipe.rune_cosmic", "recipe.rune_chaos", "recipe.rune_astral",
      "recipe.rune_nature", "recipe.rune_law", "recipe.rune_death", "recipe.rune_blood", "recipe.rune_soul",
    ],
    blocksNav: true,
  },
  "object.obelisk.summon": {
    id: "object.obelisk.summon",
    name: "Summoning Obelisk",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: [
      "recipe.pouch_wolf", "recipe.pouch_ox", "recipe.pouch_tortoise", "recipe.pouch_lynx", "recipe.pouch_drake",
      "recipe.rite_skeleton", "recipe.rite_stray", "recipe.rite_wight",
      "recipe.rite_drowned", "recipe.rite_shambler", "recipe.rite_barrow",
    ],
    blocksNav: true,
  },
  "object.anvil.basic": {
    id: "object.anvil.basic",
    name: "Anvil",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    workstationRecipeIds: [
      "recipe.copper_sword",
      "recipe.copper_axe",
      "recipe.copper_pickaxe",
      "recipe.bronze_sword",
      "recipe.bronze_axe",
      "recipe.bronze_pickaxe",
      "recipe.iron_sword",
      "recipe.iron_axe",
      "recipe.iron_pickaxe",
      "recipe.gold_ring",
      "recipe.gold_amulet",
      "recipe.diamond_sword",
      "recipe.diamond_axe",
      "recipe.diamond_pickaxe",
      "recipe.netherite_axe",
      "recipe.netherite_pickaxe",
      "recipe.netherite_sword",
      "recipe.cap_leather",
      "recipe.tunic_leather",
      "recipe.leggings_leather",
      "recipe.cap_copper",
      "recipe.tunic_copper",
      "recipe.leggings_copper",
      "recipe.cap_bronze",
      "recipe.tunic_bronze",
      "recipe.leggings_bronze",
      "recipe.cap_iron",
      "recipe.tunic_iron",
      "recipe.leggings_iron",
      "recipe.boots_leather",
      "recipe.boots_copper",
      "recipe.boots_bronze",
      "recipe.boots_iron",
      "recipe.cap_steel", "recipe.tunic_steel", "recipe.leggings_steel", "recipe.boots_steel",
      "recipe.cap_mithril", "recipe.tunic_mithril", "recipe.leggings_mithril", "recipe.boots_mithril",
      "recipe.cap_adamant", "recipe.tunic_adamant", "recipe.leggings_adamant", "recipe.boots_adamant",
      "recipe.cap_rune", "recipe.tunic_rune", "recipe.leggings_rune", "recipe.boots_rune",
      "recipe.cap_diamond", "recipe.tunic_diamond", "recipe.leggings_diamond", "recipe.boots_diamond",
      "recipe.cap_netherite", "recipe.tunic_netherite", "recipe.leggings_netherite", "recipe.boots_netherite",
    ],
    blocksNav: true,
  },
  "object.store.basic": {
    id: "object.store.basic",
    name: "General Store",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.counter.shop": {
    id: "object.counter.shop",
    name: "Store Counter",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    shopId: "shop.general",
    blocksNav: true,
  },
  "object.counter.tanglewood": {
    id: "object.counter.tanglewood",
    name: "Trading Post Counter",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    shopId: "shop.tanglewood",
    blocksNav: true,
  },
  "object.counter.mirefen": {
    id: "object.counter.mirefen",
    name: "Fishmonger's Counter",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    shopId: "shop.mirefen",
    blocksNav: true,
  },
  "object.counter.sunward": {
    id: "object.counter.sunward",
    name: "Exchange Counter",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    shopId: "shop.sunward",
    blocksNav: true,
  },
  "object.door.wood": {
    id: "object.door.wood",
    name: "Door",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    blocksNav: true,
  },
  "object.gate.oak": {
    id: "object.gate.oak",
    name: "Gate",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    blocksNav: true,
  },
  "object.stairs.up": {
    id: "object.stairs.up",
    name: "Stairs Up",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    blocksNav: true,
  },
  "object.stairs.down": {
    id: "object.stairs.down",
    name: "Stairs Down",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    blocksNav: true,
  },
  "object.house.big": {
    id: "object.house.big",
    name: "Inn",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    interiorId: "inn",
    blocksNav: true,
  },
  "object.spire.large": {
    id: "object.spire.large",
    name: "Tower Spire",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
  "object.spire.small": {
    id: "object.spire.small",
    name: "Tower Spire",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
  "object.keep.grand": {
    id: "object.keep.grand",
    name: "The Keep",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.banner.red": {
    id: "object.banner.red",
    name: "Banner",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.bed.basic": {
    id: "object.bed.basic",
    name: "Bed",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    sleepable: true,
    blocksNav: true,
  },
  "object.table.basic": {
    id: "object.table.basic",
    name: "Table",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.house.small": {
    id: "object.house.small",
    name: "Cottage",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    interiorId: "cottage",
    blocksNav: true,
  },
  "object.shrine.stone": {
    id: "object.shrine.stone",
    name: "Wayshrine",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.well.basic": {
    id: "object.well.basic",
    name: "Town Well",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.signpost": {
    id: "object.signpost",
    name: "Signpost",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
  "object.bench.wood": {
    id: "object.bench.wood",
    name: "Bench",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.boulder.stone": {
    id: "object.boulder.stone",
    name: "Boulder",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.rock.outcrop": {
    id: "object.rock.outcrop",
    name: "Rock Outcrop",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.rock.mesa": {
    id: "object.rock.mesa",
    name: "Mesa Rock",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.rock.tidal": {
    id: "object.rock.tidal",
    name: "Tidal Rock",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.mushroom.giant": {
    id: "object.mushroom.giant",
    name: "Giant Mushroom",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.flowers.showy": {
    id: "object.flowers.showy",
    name: "Wildflower Stand",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
  "object.plant.tropic": {
    id: "object.plant.tropic",
    name: "Lush Plant",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
  "object.flora.wild": {
    id: "object.flora.wild",
    name: "Undergrowth",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
  "object.log.fallen": {
    id: "object.log.fallen",
    name: "Fallen Log",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.reeds.water": {
    id: "object.reeds.water",
    name: "Reeds",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
  "object.grass.tuft": {
    id: "object.grass.tuft",
    name: "Wild Grass",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
  "object.portal.cave": {
    id: "object.portal.cave",
    name: "Cave Mouth",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    blocksNav: true,
  },
  "object.portal.exit": {
    id: "object.portal.exit",
    name: "Ladder Up",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    blocksNav: true,
  },
  "object.portal.graduate": {
    id: "object.portal.graduate",
    name: "Gateway to the Wild",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    blocksNav: true,
  },
  // ---- scenery detail (not clickable; some block movement) ----
  "object.fence.wood": {
    id: "object.fence.wood",
    name: "Wooden Fence",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.lamp.post": {
    id: "object.lamp.post",
    name: "Street Lamp",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.torch.wall": {
    id: "object.torch.wall",
    name: "Torch",
    scenery: true,
  },
  "object.stall.market": {
    id: "object.stall.market",
    name: "Market Stall",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.crate.wood": {
    id: "object.crate.wood",
    name: "Packing Crate",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: true,
  },
  "object.barrel.wood": {
    id: "object.barrel.wood",
    name: "Barrel",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    containerSlots: 6,
    // Opens like a chest; stocked with a little random common loot on first open.
    randomLoot: [
      { itemId: "item.coin", min: 3, max: 18, chance: 0.7 },
      { itemId: "item.log.basic", min: 1, max: 4, chance: 0.4 },
      { itemId: "item.ore.copper", min: 1, max: 3, chance: 0.35 },
      { itemId: "item.stone.rough", min: 1, max: 4, chance: 0.35 },
      { itemId: "item.pork.cooked", min: 1, max: 2, chance: 0.3 },
    ],
    blocksNav: true,
  },
  "object.flowers.wild": {
    id: "object.flowers.wild",
    name: "Wildflowers",
    interaction: { mode: "adjacent_4", rangeCells: 1 },
    scenery: true,
    blocksNav: false,
  },
};

export const SHOPS: Record<string, ShopDef> = {
  "shop.general": {
    id: "shop.general",
    name: "Mara's General Store",
    buys: {
      "item.log.basic": 2,
      "item.log.spruce": 4,
      "item.log.birch": 7,
      "item.log.jungle": 11,
      "item.log.acacia": 16,
      "item.log.darkoak": 24,
      "item.log.blossom": 34,
      "item.log.ember": 46,
      "item.log.glow": 60,
      "item.log.dusk": 80,
      "item.stone.rough": 1,
      "item.berry.basic": 1,
      "item.fish.raw": 2,
      "item.fish.cooked": 5,
      "item.pork.raw": 3,
      "item.pork.cooked": 6,
      "item.beef.raw": 4,
      "item.beef.cooked": 8,
      "item.hide.cow": 5,
      "item.plank.cut": 2,
      "item.rope": 5,
      "item.charm.bone": 16,
      "item.relic.shard": 4,
      "item.relic.idol": 30,
      "item.wheat": 2,
      "item.bread.basic": 5,
      "item.pumpkin": 3,
      "item.pumpkin.roast": 8,
      "item.herb.sage": 2,
      "item.herb.mint": 3,
      "item.herb.emberleaf": 5,
      "item.carrot": 2,
      "item.stew.carrot": 10,
      "item.game.rabbit": 3,
      "item.rabbit.cooked": 6,
      "item.fur": 6,
      "item.trinket.jade": 25,
      "item.relic.urn": 20,
      "item.relic.coin": 15,
      "item.relic.tablet": 35,
      "item.relic.mask": 50,
      "item.potion.gathering": 14,
      "item.potion.focus": 20,
      "item.tonic.oakblood": 16,
      "item.fish.eel": 6,
      "item.eel.cooked": 14,
      "item.fish.icefin": 12,
      "item.fish.trout": 8,
      "item.trout.cooked": 18,
      "item.fish.seabass": 20,
      "item.seabass.cooked": 44,
      "item.fish.sunscale": 34,
      "item.ring.gold": 45,
      "item.amulet.gold": 90,
      "item.bar.gold": 30,
      "item.gem.diamond": 60,
      "item.ore.redstone": 8,
      "item.gem.lapis": 14,
      "item.gem.emerald": 85,
      "item.gem.quartz": 12,
      "item.debris.ancient": 140,
      "item.scrap.netherite": 180,
      "item.ingot.netherite": 800,
      "item.gem.opal": 10,
      "item.gem.jade": 18,
      "item.gem.topaz": 28,
      "item.gem.sapphire": 45,
      "item.gem.ruby": 80,
      "item.gem.dragonstone": 260,
      "item.ring.opal": 40,
      "item.ring.sapphire": 120,
      "item.amulet.emerald": 220,
      "item.amulet.ruby": 360,
      "item.amulet.dragonstone": 900,
      "item.crop.potato": 3,
      "item.potato.baked": 10,
      "item.melon.slice": 6,
      "item.herb.frostbloom": 14,
      "item.herb.duskcap": 24,
      "item.sunscale.cooked": 75,
      "item.icefin.cooked": 26,
      "item.glob.slime": 6,
      "item.venom.sac": 12,
      "item.spore.pale": 8,
      "item.core.construct": 30,
      "item.salve.healing": 10,
      "item.potion.swift": 12,
      "item.potion.strength": 15,
      "item.potion.stoneskin": 18,
      "item.chicken.raw": 3,
      "item.chicken.cooked": 6,
      "item.mutton.raw": 4,
      "item.mutton.cooked": 8,
      "item.feather": 1,
      "item.wool": 3,
      "item.hide.wolf": 7,
      "item.bone.old": 2,
      "item.ore.copper": 3,
      "item.ore.tin": 4,
      "item.ore.iron": 8,
      "item.bar.copper": 8,
      "item.bar.tin": 10,
      "item.bar.bronze": 22,
      "item.bar.iron": 32,
      "item.brick.stone": 3,
      // ---- skill-ladder sinks (SKILL_PLANS.md): every new product sells ----
      "item.bar.steel": 40, "item.bar.mithril": 72, "item.bar.adamant": 120, "item.bar.runite": 190,
      "item.ore.mithril": 20, "item.ore.adamant": 30, "item.ore.runite": 45,
      "item.arrow.bronze": 1, "item.arrow.iron": 2, "item.arrow.steel": 3,
      "item.arrow.mithril": 5, "item.arrow.adamant": 8, "item.arrow.rune": 12,
      // Foraging berries
      "item.forage.redberry": 2, "item.forage.cadava": 3, "item.forage.dwellberry": 4,
      "item.forage.cloudberry": 6, "item.forage.jangerberry": 9, "item.forage.pricklypear": 12,
      "item.forage.whiteberry": 16, "item.forage.poisonivy": 10, "item.forage.everlight": 30,
      // Hunting meats, hides, tusks, spikes
      "item.game.fowl": 3, "item.fowl.cooked": 8, "item.game.boar": 6, "item.boar.cooked": 14,
      "item.game.grenwall": 10, "item.grenwall.cooked": 22, "item.game.antelope": 12, "item.antelope.cooked": 30,
      "item.hide.kebbit": 8, "item.hide.thick": 14, "item.hide.polar": 20, "item.hide.sabre": 30, "item.hide.antelope": 45,
      "item.tusk": 18, "item.antler": 16, "item.chinchompa": 20, "item.spike.grenwall": 12,
      // Archaeology samples + relic collection
      "item.arch.samples": 6, "item.relic.torque": 18, "item.relic.chalice": 30, "item.relic.censer": 45,
      "item.relic.astrolabe": 70, "item.relic.sceptre": 110, "item.relic.crown": 200,
      // A trickle of coin for early flatpacks
      "item.flatpack.stool": 8, "item.flatpack.crate": 12, "item.flatpack.chair": 16,
    },
    sells: [
      { itemId: "tool.axe.basic", price: 25 },
      { itemId: "tool.pickaxe.basic", price: 25 },
      { itemId: "tool.fishingrod.basic", price: 25 },
      { itemId: "tool.hammer.basic", price: 25 },
      { itemId: "tool.hoe.basic", price: 20 },
      { itemId: "tool.bow.wood", price: 45 },
      { itemId: "tool.trap.basic", price: 30 },
      { itemId: "item.seed.wheat", price: 3 },
      { itemId: "item.seed.carrot", price: 5 },
      { itemId: "item.seed.pumpkin", price: 8 },
      { itemId: "item.berry.basic", price: 3 },
      { itemId: "item.fish.cooked", price: 10 },
      { itemId: "item.beef.cooked", price: 16 },
      { itemId: "item.mutton.cooked", price: 14 },
      // A coin sink past the first hour: convenience materials for building
      // and fletching, so gold you earn from mobs and quests has somewhere to
      // go without short-cutting the core crafting ladders.
      { itemId: "item.rope", price: 14 },
      { itemId: "item.plank.cut", price: 6 },
      { itemId: "item.brick.stone", price: 8 },
      { itemId: "item.arrow.bronze", price: 2 },
      // Skill-ladder tool gates: the secateurs / mattock / box-trap gate tools
      // and the two new farm seeds, so every gathering ladder is buyable.
      { itemId: "tool.secateurs.basic", price: 40 },
      { itemId: "tool.mattock.basic", price: 40 },
      { itemId: "tool.trap.box", price: 60 },
      { itemId: "item.seed.corn", price: 12 },
      { itemId: "item.seed.sunfruit", price: 20 },
      // Potato/melon plots and the baked-potato recipe were dead-locked:
      // these two seeds existed but nothing in the world dispensed them.
      { itemId: "item.seed.potato", price: 4 },
      { itemId: "item.seed.melon", price: 9 },
      // Blaze Runes so Magic (Low Alch at L1 burns one per cast) is playable
      // from day one — without these, the first fire rune sits behind
      // Runecrafting 14 and hours of essence grinding.
      { itemId: "item.rune.fire", price: 10 },
    ],
  },
  "shop.tanglewood": {
    id: "shop.tanglewood",
    name: "Tanglewood Post",
    buys: {
      "item.log.basic": 3,
      "item.hide.wolf": 7,
      "item.bone.old": 2,
      "item.berry.basic": 1,
      "item.hide.cow": 5,
    },
    sells: [
      { itemId: "tool.axe.basic", price: 25 },
      { itemId: "item.fish.cooked", price: 9 },
      { itemId: "item.beef.cooked", price: 15 },
    ],
  },
  "shop.mirefen": {
    id: "shop.mirefen",
    name: "Mirefen Fishmonger",
    buys: {
      "item.fish.raw": 3,
      "item.fish.cooked": 6,
      "item.glob.slime": 4,
      "item.bone.old": 2,
      "item.venom.sac": 8,
    },
    sells: [
      { itemId: "tool.fishingrod.basic", price: 25 },
      { itemId: "item.fish.cooked", price: 8 },
      { itemId: "item.berry.basic", price: 2 },
    ],
  },
  "shop.sunward": {
    id: "shop.sunward",
    name: "Sunward Exchange",
    buys: {
      "item.ore.copper": 4,
      "item.ore.tin": 5,
      "item.ore.iron": 9,
      "item.bar.bronze": 24,
      "item.bar.iron": 34,
      "item.venom.sac": 9,
      "item.core.construct": 20,
      "item.spore.pale": 10,
      "item.hide.wolf": 8,
      "item.brick.stone": 4,
    },
    sells: [
      { itemId: "tool.pickaxe.basic", price: 25 },
      { itemId: "tool.hammer.basic", price: 25 },
      { itemId: "item.beef.cooked", price: 16 },
      { itemId: "item.fish.cooked", price: 10 },
    ],
  },
};

/** Cumulative XP required to *reach* level `level` (level 1 = 0 XP). Original curve. */
export function xpToReachLevel(curve: XpCurveDef, level: number): number {
  if (level <= 1) return 0;
  const n = level - 1;
  return Math.round(curve.base * Math.pow(n, curve.exponent) + curve.linear * n);
}

export function levelForXp(curve: XpCurveDef, xp: number, maxLevel: number): number {
  let level = 1;
  while (level < maxLevel && xp >= xpToReachLevel(curve, level + 1)) level++;
  return level;
}

// ---------- quests ----------

export type QuestObjectiveType = "talk" | "equipTag" | "gather" | "deliver" | "slay" | "train";

export interface QuestObjectiveDef {
  id: string;
  label: string; // shown in the quest tracker
  type: QuestObjectiveType;
  npcId?: string;
  toolTag?: string;
  itemId?: string;
  enemyDefId?: string;
  /** For a "train" objective: the skill whose XP gain satisfies it (do the
   *  craft once at the master's station and it ticks). */
  skillId?: string;
  qty?: number;
  /** World instance the guidance should lead to for this objective — the
   *  resource node / crafting station to go and use (resolved to a cell by the
   *  quest helper). Lets a lesson point at the tree or furnace, not just the
   *  master. For a deliver, guidance follows this until you're carrying enough,
   *  then swaps to the giver to hand in. */
  atId?: string;
}

export interface QuestDef {
  id: string;
  name: string;
  giverNpcId: string;
  /** Where the giver lives (endless-world errands): guidance can point home
   *  even when the giver's chunk isn't streamed in. */
  giverCell?: { x: number; z: number };
  /** Giver's display name for guidance labels when the NPC isn't streamed. */
  giverName?: string;
  /** Offered only once these quests are completed. */
  prereqQuestIds?: string[];
  /** Spoken when the quest is accepted / while active / on completion. */
  intro: string;
  reminder: string;
  outro: string;
  objectives: QuestObjectiveDef[]; // ordered
  /** Items handed over the moment the quest is accepted — a tutor giving you the
   *  tool the lesson needs, so an equip-then-use objective is actually doable. */
  startItems?: Array<{ itemId: string; qty: number }>;
  rewards: {
    xp: Array<{ skillId: string; amount: number }>;
    items: Array<{ itemId: string; qty: number }>;
  };
  /** World-state flag set on completion (persists; may repair terrain). */
  completionFlag?: string;
}

export const QUESTS: Record<string, QuestDef> = {
  // Tutor's Trail: the guide sends the newcomer down the trail, each master
  // teaches their craft (the per-skill lesson quests generated below), and the
  // gatekeeper at the far end opens the gateway to the wild. These plus the 33
  // lesson quests are the only quests: the world beyond is a sandbox.
  "quest.tut_welcome": {
    id: "quest.tut_welcome",
    name: "Tutor's Trail",
    giverNpcId: "tutorial.guide",
    intro:
      "Welcome to Runecraft, traveller. This is Tutor's Trail — one path, and a master of every craft along it. Follow it from here, learn what each will teach, and the gate at the end opens onto your own world. Start with Finn the Woodcutter, just up the trail.",
    reminder: "Follow the trail and speak with Finn the Woodcutter to begin.",
    outro: "That's the spirit. Take the trail and don't be shy — every master here is glad to teach.",
    objectives: [
      { id: "talk", label: "Speak with the Guide", type: "talk", npcId: "tutorial.guide" },
      { id: "find_first", label: "Meet the Woodcutter up the trail", type: "talk", npcId: "tutorial.master.woodcutting" },
    ],
    rewards: { xp: [], items: [{ itemId: "item.coin", qty: 25 }] },
  },
  "quest.tut_graduation": {
    id: "quest.tut_graduation",
    name: "Into the Wild",
    giverNpcId: "tutorial.gatekeeper",
    prereqQuestIds: ["quest.tut_welcome"],
    intro:
      "You've walked the whole trail and met every master — I've watched you come. There's nothing more the island can teach. Speak the word and I'll open the gate; the whole world waits beyond it.",
    reminder: "Speak with the Gatekeeper, then step through the gateway to leave the island.",
    outro: "Go well, traveller. The wilds are yours.",
    objectives: [
      { id: "talk", label: "Speak with the Gatekeeper", type: "talk", npcId: "tutorial.gatekeeper" },
    ],
    rewards: { xp: [], items: [{ itemId: "item.coin", qty: 60 }] },
    completionFlag: "tutorial.graduated",
  },
};

// ---------- tutorial island: one master per skill (33) ----------
// Every skill has a master NPC on the tutorial island who teaches it and gives
// a short lesson-quest; a training station stands beside those whose craft
// needs one. The masters + stations are placed by tutorialRegion (endless.ts)
// from this same table, so the two never drift.
export interface SkillMaster {
  skill: string;
  title: string;
  name: string;
  /** A node/object defId placed beside the master, when the skill trains at one. */
  station?: string;
}

export const SKILL_MASTERS: SkillMaster[] = [
  { skill: "skill.woodcutting", title: "Woodcutter", name: "Finn", station: "resource.tree.basic" },
  { skill: "skill.mining", title: "Miner", name: "Dara", station: "resource.rock.copper" },
  { skill: "skill.fishing", title: "Angler", name: "Pike", station: "resource.fishing.pond" },
  { skill: "skill.foraging", title: "Forager", name: "Bramble", station: "resource.bush.berry" },
  { skill: "skill.herblore", title: "Herbalist", name: "Sage", station: "resource.herb.sage" },
  { skill: "skill.hunting", title: "Hunter", name: "Roe", station: "resource.trail.rabbit" },
  { skill: "skill.farming", title: "Farmer", name: "Bessie", station: "resource.plot.wheat" },
  { skill: "skill.archaeology", title: "Curator", name: "Fenwick", station: "resource.digsite.basic" },
  { skill: "skill.thieving", title: "Rogue", name: "Sly", station: "resource.stall.market" },
  { skill: "skill.cooking", title: "Cook", name: "Marjoram", station: "object.campfire.basic" },
  { skill: "skill.smithing", title: "Smith", name: "Bran", station: "object.anvil.basic" },
  { skill: "skill.crafting", title: "Crafter", name: "Tilda", station: "object.workbench.basic" },
  { skill: "skill.construction", title: "Builder", name: "Mortar", station: "object.buildsite.ramp" },
  { skill: "skill.runecrafting", title: "Runemaster", name: "Ansel", station: "object.altar.rune" },
  { skill: "skill.fletching", title: "Fletcher", name: "Ash" },
  { skill: "skill.firemaking", title: "Firewarden", name: "Ember" },
  { skill: "skill.attack", title: "Swordmaster", name: "Gareth" },
  { skill: "skill.strength", title: "Strongarm", name: "Bruno" },
  { skill: "skill.defense", title: "Shieldbearer", name: "Isolde" },
  { skill: "skill.archery", title: "Bowyer", name: "Robin" },
  { skill: "skill.magic", title: "Mage", name: "Merla" },
  { skill: "skill.prayer", title: "Priest", name: "Alban" },
  { skill: "skill.summoning", title: "Summoner", name: "Vex" },
  { skill: "skill.necromancy", title: "Necromancer", name: "Mort" },
  { skill: "skill.enchanting", title: "Enchanter", name: "Lumen" },
  { skill: "skill.agility", title: "Freerunner", name: "Sprint" },
  { skill: "skill.boating", title: "Mariner", name: "Nautica" },
  { skill: "skill.dungeoneering", title: "Delver", name: "Grit" },
  { skill: "skill.invention", title: "Inventor", name: "Cogsworth" },
  { skill: "skill.slaying", title: "Slayer", name: "Kull" },
  { skill: "skill.constitution", title: "Healer", name: "Vita" },
];

/** The NPC instance id of a skill's master (matches the region-placed NPC). */
export function masterNpcId(skill: string): string {
  return `tutorial.master.${skill.slice("skill.".length)}`;
}

// Each lesson makes the newcomer actually DO the craft at the master's station
// or pen — not just chat — so a talk alone never ticks the quest complete. The
// gatherers gather, the fighters fight; crafts whose product needs a multi-step
// chain teach by demonstration (talk) with the station right there to try.
// Every lesson makes the newcomer DO the craft, never just chat: gatherers
// gather, fighters fight, and every workshop skill trains once at its station
// (a "train" objective ticks the moment you earn that skill's first XP). The
// master hands over whatever the action needs, so a chained lesson can always
// be finished. `note` is folded into the master's greeting.
const train = (skill: string, label: string): QuestObjectiveDef => ({ id: "do", label, type: "train", skillId: skill });
interface Lesson {
  /** Slay/train doing-objectives performed before reporting back. */
  action?: QuestObjectiveDef[];
  /** Gatherer lessons: gather this and hand it in. The hand-in checks the pack
   *  directly (no fragile intermediate gather step that can desync from what the
   *  player actually did), so it completes the moment you return with the goods. */
  deliver?: { itemId: string; qty: number };
  gift?: Array<{ itemId: string; qty: number }>;
  note?: string;
}
const LESSONS: Record<string, Lesson> = {
  "skill.woodcutting": { deliver: { itemId: "item.log.basic", qty: 2 }, gift: [{ itemId: "tool.axe.copper", qty: 1 }], note: "Here's a copper axe — fell a couple of logs and bring them back to me." },
  "skill.mining": { deliver: { itemId: "item.ore.copper", qty: 2 }, gift: [{ itemId: "tool.pickaxe.copper", qty: 1 }], note: "Take this pickaxe — mine a couple of copper ore and bring them to me." },
  "skill.foraging": { deliver: { itemId: "item.berry.basic", qty: 2 }, note: "Pick a couple of berries from the bush and bring them to me." },
  "skill.fishing": { deliver: { itemId: "item.fish.raw", qty: 2 }, gift: [{ itemId: "tool.fishingrod.basic", qty: 1 }], note: "Here's a rod — catch a couple of fish and bring them back." },
  "skill.cooking": { action: [train("skill.cooking", "Cook a fish on the campfire")], gift: [{ itemId: "item.fish.raw", qty: 2 }], note: "Here's a raw fish — cook it on the campfire." },
  "skill.smithing": { action: [train("skill.smithing", "Smelt copper bars at the furnace"), train("skill.smithing", "Hammer a blade on the anvil")], gift: [{ itemId: "tool.hammer.basic", qty: 1 }, { itemId: "item.ore.copper", qty: 4 }], note: "Smithing starts at the fire. Here's a hammer and copper ore — smelt bars in my furnace, then hammer them into a blade on the anvil." },
  "skill.attack": { action: [train("skill.attack", "Strike a pig on Accurate style — trains Attack"), train("skill.strength", "Tap the attack-style button to Aggressive, then strike — trains Strength")], gift: [{ itemId: "tool.sword.copper", qty: 1 }] },
  "skill.farming": { deliver: { itemId: "item.wheat", qty: 2 }, gift: [{ itemId: "tool.hoe.basic", qty: 1 }, { itemId: "item.seed.wheat", qty: 3 }], note: "Here's a hoe and wheat seeds. First PLOW a plot: click my field plot (or till fresh grass with the hoe) and your hoe will break the soil into furrows. Only plowed furrows take seed — sow one, wait for it to grow, then harvest the wheat and bring me two. Harvests give seed back, so keep replanting." },
  "skill.herblore": { action: [train("skill.herblore", "Brew a draught in the cauldron")], deliver: { itemId: "item.herb.sage", qty: 2 }, gift: [{ itemId: "item.herb.sage", qty: 1 }, { itemId: "item.feather", qty: 1 }], note: "Herblore is picking AND brewing. Take this sage and feather — brew a draught in my cauldron, then pick two fresh sage from my patch and bring them to me." },
  "skill.crafting": { action: [train("skill.crafting", "Cut planks at the workbench")], gift: [{ itemId: "item.log.basic", qty: 2 }], note: "Here's some timber — cut it into planks at the workbench." },
  "skill.archaeology": { action: [train("skill.archaeology", "Dig at the excavation")], note: "Take a trowel to the dig site and see what you turn up." },
  "skill.archery": { action: [{ id: "do", label: "Fell a target dummy", type: "slay", enemyDefId: "enemy.target_dummy", qty: 1 }], gift: [{ itemId: "tool.bow.oak", qty: 1 }, { itemId: "item.arrow.bronze", qty: 30 }], note: "Here's a bow and arrows — equip the bow and loose at the dummy." },
  "skill.construction": { action: [train("skill.construction", "Repair the collapsed ramp")], gift: [{ itemId: "item.brick.stone", qty: 6 }, { itemId: "item.plank.cut", qty: 4 }], note: "See that scaffolded wreck beside me? The ramp collapsed in the last storm. Take these bricks and planks, click the broken ramp, and build it back up" },
  "skill.enchanting": { action: [train("skill.enchanting", "Rune the axe at the table")], gift: [{ itemId: "tool.axe.iron", qty: 1 }, { itemId: "item.relic.idol", qty: 1 }], note: "An iron axe and a relic idol — rune the axe at the table." },
  "skill.hunting": { action: [{ id: "do", label: "Catch a chicken", type: "slay", enemyDefId: "enemy.chicken", qty: 1 }] },
  "skill.thieving": { action: [train("skill.thieving", "Filch from the market stall")], note: "See that stall? Lift something from it when the keeper looks away." },
  "skill.agility": { action: [train("skill.agility", "Vault the log shortcut")], note: "Limber up — vault the fallen log to feel the Agility of it." },
  "skill.slaying": { action: [{ id: "do", label: "Slay a penned beast", type: "slay", enemyDefId: "enemy.sheep", qty: 1 }] },
  "skill.boating": { action: [train("skill.boating", "Lash a raft together at the bench")], gift: [{ itemId: "item.plank.cut", qty: 4 }], note: "Four planks — lash a raft together at the boatwright's bench." },
  "skill.firemaking": { action: [train("skill.firemaking", "Light a log from your pack")], gift: [{ itemId: "item.log.basic", qty: 2 }], note: "Two logs — set light to one straight from your pack." },
  "skill.prayer": { action: [train("skill.prayer", "Bury the old bones")], gift: [{ itemId: "item.bone.old", qty: 2 }], note: "Old bones — bury them from your pack to honour the fallen." },
  "skill.runecrafting": { action: [train("skill.runecrafting", "Bind a rune at the altar")], gift: [{ itemId: "item.essence.rune", qty: 1 }], note: "Rune essence — bind it into a rune at the altar." },
  "skill.fletching": { action: [train("skill.fletching", "Cut arrow shafts at the workbench")], gift: [{ itemId: "item.log.basic", qty: 2 }], note: "Timber — cut arrow shafts at the workbench." },
  "skill.magic": { action: [train("skill.magic", "Cast Low Alchemy on the bar")], gift: [{ itemId: "item.bar.copper", qty: 1 }, { itemId: "item.rune.fire", qty: 1 }], note: "A copper bar and a fire rune — cast Low Alchemy on the bar from your pack." },
  "skill.dungeoneering": { action: [train("skill.dungeoneering", "Fell the pit-beast")], note: "Every delver bloods themselves — put down the beast in the pit." },
  "skill.summoning": { action: [train("skill.summoning", "Bind spirit reins at the obelisk")], gift: [{ itemId: "item.charm.bone", qty: 1 }, { itemId: "item.essence.rune", qty: 3 }], note: "A bone charm and rune essence — bind Spirit Wolf Reins at the obelisk, then tap them in your pack to RIDE. A mount carries you faster than any boot leather." },
  "skill.necromancy": { action: [{ id: "do", label: "Fell a skeleton", type: "slay", enemyDefId: "enemy.skeleton", qty: 1 }], gift: [{ itemId: "item.rite.skeleton", qty: 1 }], note: "Take this rite — use it from your pack and a risen skeleton will fight at your side. Prove yourselves: fell the skeleton in my pen together." },
  "skill.invention": { action: [train("skill.invention", "Salvage parts at the workbench")], gift: [{ itemId: "item.bar.iron", qty: 1 }], note: "An iron bar — salvage it into components at the workbench." },
};

// The teaching order down the trail (Attack folds in Strength/Defence/
// Constitution as the Combat Instructor). Lessons unlock one at a time: each is
// gated behind the previous, so only the next master up the trail offers a quest.
export const TUTORIAL_ORDER = [
  "skill.woodcutting", "skill.mining", "skill.foraging", "skill.fishing", "skill.cooking",
  "skill.smithing", "skill.attack", "skill.farming", "skill.herblore",
  "skill.crafting", "skill.archaeology", "skill.archery", "skill.construction",
  "skill.enchanting", "skill.hunting", "skill.thieving", "skill.agility", "skill.slaying",
  "skill.boating", "skill.firemaking", "skill.prayer", "skill.runecrafting", "skill.fletching",
  "skill.magic", "skill.dungeoneering", "skill.summoning", "skill.necromancy", "skill.invention",
] as const;

TUTORIAL_ORDER.forEach((skill, i) => {
  const m = SKILL_MASTERS.find((s) => s.skill === skill)!;
  const short = skill.slice("skill.".length);
  const npc = masterNpcId(skill);
  const skillName = SKILLS[skill]?.name ?? short;
  const lesson = LESSONS[skill] ?? {};
  // Point "train" objectives at the master's station so the guidance leads you
  // to the furnace / anvil / dig site, not just back to the tutor.
  const station = `tut.station.${short}`;
  const action = (lesson.action ?? []).map((o) => (o.type === "train" ? { ...o, atId: station } : o));
  const gift = lesson.gift ? { items: lesson.gift, note: lesson.note ?? "" } : undefined;
  const combat = skill === "skill.attack";
  // Sequential unlock: the first lesson follows the welcome; the rest each
  // follow the previous master down the trail.
  const prereq = i === 0 ? "quest.tut_welcome" : `quest.tut_${TUTORIAL_ORDER[i - 1].slice("skill.".length)}`;
  const giverName = combat ? "Sergeant Gareth" : m.name;
  // Every lesson ends back at the master. Gatherers just hand the goods in — the
  // deliver checks the pack directly, so it completes the moment you return with
  // what you gathered (no fragile intermediate step to desync). The rest do
  // their action, then report in.
  const closer: QuestObjectiveDef = lesson.deliver
    ? { id: "hand", label: `Bring the ${ITEMS[lesson.deliver.itemId]?.name ?? "goods"} to ${giverName}`, type: "deliver", npcId: npc, itemId: lesson.deliver.itemId, qty: lesson.deliver.qty, atId: station }
    : { id: "report", label: `Report back to ${giverName}`, type: "talk", npcId: npc };
  QUESTS[`quest.tut_${short}`] = {
    id: `quest.tut_${short}`,
    name: combat ? "The Combat Instructor" : `The ${m.title}`,
    giverNpcId: npc,
    prereqQuestIds: [prereq],
    startItems: gift?.items,
    intro: combat
      ? `Sergeant Gareth: "One instructor, all of melee. Here's a bronze sword — equip it. See the attack-style button on your bar? It picks which skill your blows train: Accurate for Attack, Aggressive for Strength, Defensive for Defence — and Constitution grows no matter what. Strike a pig on Accurate, then tap the button to Aggressive and strike again, so you feel the difference. Then report back to me."`
      : lesson.note
        ? `${m.name}: "Well met. ${lesson.note} Then come back to me and I'll sign your ${skillName} lesson off."`
        : `${m.name}: "Well met. Words won't teach you ${skillName} — give it a try right here, then come back to me."`,
    reminder: combat
      ? `Strike a pig on Accurate (Attack), then switch to Aggressive (Strength) with the attack-style button, then report back to Sergeant Gareth.`
      : lesson.deliver
        ? `Gather ${lesson.deliver.qty} ${ITEMS[lesson.deliver.itemId]?.name ?? "goods"} and bring them to ${m.name}.`
        : action.length
          ? `Train ${skillName} at the station, then report back to ${m.name}.`
          : `Speak with ${m.name} the ${m.title} to learn ${skillName}.`,
    outro: combat
      ? `"Good. Accurate for Attack, Aggressive for Strength, Defensive for Defence, Controlled to split them — and every blow feeds Constitution. Now on down the trail."`
      : `"There — that's the first of it. The next master's waiting further down the trail."`,
    objectives: [
      { id: "talk", label: combat ? "Meet the Combat Instructor" : `Learn ${skillName} from ${m.name}`, type: "talk", npcId: npc },
      ...action,
      closer,
    ],
    rewards: { xp: [{ skillId: skill, amount: 40 }], items: [] },
  };
});

// Graduation opens only once the last master's lesson is done — the whole trail
// must be walked before the gateway will open.
QUESTS["quest.tut_graduation"].prereqQuestIds = [
  `quest.tut_${TUTORIAL_ORDER[TUTORIAL_ORDER.length - 1].slice("skill.".length)}`,
];

// ---------- combat ----------

/** Player combat parameters (original formulas; all values are data). */
// ---------------------------------------------------------------------------
// Item mods: stacking enchantments + Diablo-style gem sockets. A weapon or
// armor piece carries up to MAX_ENCHANTS different enchant types and
// MAX_SOCKETS gems at once; every mod contributes to the same aggregate
// effect pool (damage, accuracy, lifesteal, ward, max HP) and is listed on
// the item when clicked.
// ---------------------------------------------------------------------------

export interface ItemMods {
  /** Enchant ids (ENCHANTS keys) — all different types, they stack. */
  ench: string[];
  /** Socketed gem item ids (SOCKET_GEMS keys). */
  gems: string[];
}

export interface ModEffect {
  /** Flat damage added to every landed hit (weapons). */
  dmg?: number;
  /** Added hit chance, 0..1 (weapons). */
  acc?: number;
  /** HP healed on every landed hit (weapons). */
  lifesteal?: number;
  /** Shaved off enemy hit chance, 0..1 (armor). */
  ward?: number;
  /** Extra max HP (armor). */
  hp?: number;
  /** Burn damage dealt over the seconds after a landed hit — never finishes
   *  a target off (it chips down to 1 HP), so the kill and loot stay yours. */
  burn?: number;
  /** Cells the target is shoved back on a landed hit (weapons). */
  knock?: number;
  /** Chance (0..1) that a kill drops its loot twice (weapons). */
  loot?: number;
  /** Damage reflected onto an attacker each time it lands a hit (armor);
   *  chips to 1 HP, never kills. */
  thorns?: number;
}

export interface EnchantDef {
  id: string;
  name: string;
  appliesTo: "weapon" | "armor";
  effect: ModEffect;
  cost: Array<{ itemId: string; qty: number }>;
  requiredLevel: number; // Enchanting level
  xp: number;
  blurb: string;
}

export const MAX_ENCHANTS = 3;
export const MAX_SOCKETS = 2;

export const ENCHANTS: Record<string, EnchantDef> = {
  "ench.sharpness": {
    id: "ench.sharpness", name: "Sharpness", appliesTo: "weapon",
    effect: { dmg: 2 }, requiredLevel: 1, xp: 30,
    cost: [{ itemId: "item.relic.idol", qty: 1 }],
    blurb: "+2 damage on every hit",
  },
  "ench.precision": {
    id: "ench.precision", name: "Precision", appliesTo: "weapon",
    effect: { acc: 0.06 }, requiredLevel: 8, xp: 45,
    cost: [{ itemId: "item.relic.idol", qty: 1 }, { itemId: "item.feather", qty: 3 }],
    blurb: "+6% chance to hit",
  },
  "ench.vampirism": {
    id: "ench.vampirism", name: "Vampirism", appliesTo: "weapon",
    effect: { lifesteal: 1 }, requiredLevel: 20, xp: 70,
    cost: [{ itemId: "item.relic.idol", qty: 1 }, { itemId: "item.bone.old", qty: 2 }],
    blurb: "heal 1 HP on every landed hit",
  },
  "ench.smite": {
    id: "ench.smite", name: "Smite", appliesTo: "weapon",
    effect: { dmg: 3, acc: 0.02 }, requiredLevel: 35, xp: 110,
    cost: [{ itemId: "item.relic.idol", qty: 2 }, { itemId: "item.essence.rune", qty: 2 }],
    blurb: "+3 damage, +2% chance to hit",
  },
  "ench.knockback": {
    id: "ench.knockback", name: "Knockback", appliesTo: "weapon",
    effect: { knock: 2 }, requiredLevel: 4, xp: 35,
    cost: [{ itemId: "item.relic.idol", qty: 1 }, { itemId: "item.feather", qty: 2 }],
    blurb: "hits shove the target back 2 cells",
  },
  "ench.fireaspect": {
    id: "ench.fireaspect", name: "Fire Aspect", appliesTo: "weapon",
    effect: { burn: 2 }, requiredLevel: 10, xp: 55,
    cost: [{ itemId: "item.relic.idol", qty: 1 }, { itemId: "item.ore.coal", qty: 3 }],
    blurb: "hits set the target burning for 2 extra damage",
  },
  "ench.looting": {
    id: "ench.looting", name: "Looting", appliesTo: "weapon",
    effect: { loot: 0.3 }, requiredLevel: 26, xp: 90,
    cost: [{ itemId: "item.relic.idol", qty: 1 }, { itemId: "item.gem.topaz", qty: 2 }],
    blurb: "30% chance a kill drops its loot twice",
  },
  "ench.warding": {
    id: "ench.warding", name: "Warding", appliesTo: "armor",
    effect: { ward: 0.04 }, requiredLevel: 5, xp: 40,
    cost: [{ itemId: "item.relic.idol", qty: 1 }],
    blurb: "enemies hit you 4% less often",
  },
  "ench.vigor": {
    id: "ench.vigor", name: "Vigor", appliesTo: "armor",
    effect: { hp: 6 }, requiredLevel: 14, xp: 60,
    cost: [{ itemId: "item.relic.idol", qty: 1 }, { itemId: "item.herb.sage", qty: 2 }],
    blurb: "+6 max HP",
  },
  "ench.bulwark": {
    id: "ench.bulwark", name: "Bulwark", appliesTo: "armor",
    effect: { ward: 0.07, hp: 2 }, requiredLevel: 30, xp: 100,
    cost: [{ itemId: "item.relic.idol", qty: 2 }, { itemId: "item.bar.iron", qty: 1 }],
    blurb: "enemies hit you 7% less often, +2 max HP",
  },
  "ench.thorns": {
    id: "ench.thorns", name: "Thorns", appliesTo: "armor",
    effect: { thorns: 1 }, requiredLevel: 22, xp: 80,
    cost: [{ itemId: "item.relic.idol", qty: 1 }, { itemId: "item.spike.grenwall", qty: 4 }],
    blurb: "attackers take 1 damage every time they hit you",
  },
};

/** What each gem does when socketed — one column for weapons, one for armor. */
export const SOCKET_GEMS: Record<string, { name: string; weapon: ModEffect; armor: ModEffect; blurb: string }> = {
  "item.gem.quartz": { name: "Quartz", weapon: { dmg: 1 }, armor: { hp: 2 }, blurb: "weapon +1 dmg · armor +2 HP" },
  "item.gem.opal": { name: "Opal", weapon: { acc: 0.02 }, armor: { hp: 3 }, blurb: "weapon +2% hit · armor +3 HP" },
  "item.gem.jade": { name: "Jade", weapon: { acc: 0.03 }, armor: { ward: 0.02 }, blurb: "weapon +3% hit · armor 2% ward" },
  "item.gem.topaz": { name: "Topaz", weapon: { dmg: 1, acc: 0.02 }, armor: { hp: 4 }, blurb: "weapon +1 dmg +2% hit · armor +4 HP" },
  "item.gem.sapphire": { name: "Sapphire", weapon: { acc: 0.04 }, armor: { ward: 0.03 }, blurb: "weapon +4% hit · armor 3% ward" },
  "item.gem.emerald": { name: "Emerald", weapon: { dmg: 2 }, armor: { hp: 5 }, blurb: "weapon +2 dmg · armor +5 HP" },
  "item.gem.ruby": { name: "Ruby", weapon: { dmg: 3 }, armor: { hp: 7 }, blurb: "weapon +3 dmg · armor +7 HP" },
  "item.gem.lapis": { name: "Lapis", weapon: { acc: 0.05 }, armor: { ward: 0.04 }, blurb: "weapon +5% hit · armor 4% ward" },
  "item.gem.emberstone": { name: "Emberstone", weapon: { dmg: 3, acc: 0.02 }, armor: { ward: 0.03, hp: 3 }, blurb: "weapon +3 dmg +2% hit · armor 3% ward +3 HP" },
  "item.gem.diamond": { name: "Diamond", weapon: { dmg: 4 }, armor: { ward: 0.05 }, blurb: "weapon +4 dmg · armor 5% ward" },
  "item.gem.dragonstone": { name: "Dragonstone", weapon: { dmg: 4, lifesteal: 1 }, armor: { ward: 0.04, hp: 8 }, blurb: "weapon +4 dmg + lifesteal · armor 4% ward +8 HP" },
};

/** Which mod family an item belongs to, or null when it takes no mods. */
export function itemModCategory(itemId: string): "weapon" | "armor" | null {
  const def = ITEMS[itemId];
  if (!def) return null;
  if (def.armorSlot) return "armor";
  if (def.toolTags?.includes("weapon") || def.toolTags?.includes("bow")) return "weapon";
  return null;
}

/** Sum every effect a modded item contributes (enchants + socketed gems). */
export function aggregateMods(mods: ItemMods | null | undefined, category: "weapon" | "armor"): Required<ModEffect> {
  const out = { dmg: 0, acc: 0, lifesteal: 0, ward: 0, hp: 0, burn: 0, knock: 0, loot: 0, thorns: 0 };
  if (!mods) return out;
  const fold = (e: ModEffect | undefined) => {
    if (!e) return;
    out.dmg += e.dmg ?? 0;
    out.acc += e.acc ?? 0;
    out.lifesteal += e.lifesteal ?? 0;
    out.ward += e.ward ?? 0;
    out.hp += e.hp ?? 0;
    out.burn += e.burn ?? 0;
    out.knock += e.knock ?? 0;
    out.loot += e.loot ?? 0;
    out.thorns += e.thorns ?? 0;
  };
  for (const id of mods.ench) {
    const ench = ENCHANTS[id];
    if (ench && ench.appliesTo === category) fold(ench.effect);
  }
  for (const gem of mods.gems) fold(SOCKET_GEMS[gem]?.[category]);
  return out;
}

export const PLAYER_COMBAT = {
  baseHealth: 20,
  healthPerDefenseLevel: 2, // extra max HP per Defense level
  healthPerConstLevel: 3, // extra max HP per Constitution level
  attack: {
    cadenceS: 2.0,
    accuracyBase: 0.7,
    accuracyPerLevel: 0.012, // per Attack level
    accuracyMax: 0.95,
    dmgMin: 1,
    dmgMax: 3,
    dmgPerLevels: 5, // +1 max damage per this many Attack levels
    xpPerDamage: 4, // Attack XP per point of damage dealt
  },
  defense: {
    enemyHitReductionPerLevel: 0.012, // shaved off enemy accuracy per Defense level
    enemyHitChanceMin: 0.25,
    xpPerDamageTaken: 4, // Defense XP per point of damage suffered
  },
  regenDelayS: 5, // seconds after last damage before regen starts
  regenIntervalS: 3, // seconds per point regenerated
};

export interface EnemyLootEntry {
  itemId: string;
  min: number;
  max: number;
  chance: number; // 0..1
}

export type EnemyViewKind =
  | "dragon"
  | "cow"
  | "pig"
  | "spider"
  | "gnasher"
  | "wolf"
  | "slime"
  | "husk"
  | "construct"
  | "chicken"
  | "sheep"
  | "creeper"
  | "zombie"
  | "skeleton"
  | "squid"
  | "ghast"
  | "dummy"
  // BetaSharp/oafs/CornCraft vanilla mob models (rendered via buildBBModel).
  | "pillager"
  | "vindicator"
  | "evoker"
  | "illusioner"
  | "witch"
  | "ravager"
  | "drowned"
  | "stray"
  | "armadillo"
  | "bat"
  | "allay"
  | "sniffer"
  | "bee"
  | "mooshroom"
  | "warden";

export interface EnemyDef {
  id: string;
  name: string;
  level: number;
  maxHealth: number;
  attack: { cadenceS: number; accuracy: number; dmgMin: number; dmgMax: number };
  /** 0 = only retaliates; > 0 = attacks players who come this close. */
  aggroRadiusCells: number;
  leashRadiusCells: number;
  wanderRadiusCells: number;
  respawnS: number;
  xpOnDefeat: number;
  loot: EnemyLootEntry[];
  view: EnemyViewKind;
  /** Model id for baked Blockbench views (dragons). */
  viewMaterial?: string;
  /** Visual scale multiplier (boss-sized creatures). */
  scale?: number;
  /** Regional recolor of the view rig's main body material. */
  tint?: string;
  /** Never engages, chases, leashes or wanders — a fixed training target.
   *  Being hit can't heal it (no leash reset), so it can actually be felled. */
  stationary?: boolean;
}

export const ENEMIES: Record<string, EnemyDef> = {
  "enemy.cow": {
    id: "enemy.cow",
    name: "Cow",
    level: 2,
    maxHealth: 14,
    attack: { cadenceS: 2.4, accuracy: 0.6, dmgMin: 1, dmgMax: 2 },
    aggroRadiusCells: 0, // placid: only defends itself
    leashRadiusCells: 7,
    wanderRadiusCells: 2,
    respawnS: 30,
    xpOnDefeat: 30,
    loot: [
      { itemId: "item.beef.raw", min: 1, max: 2, chance: 0.9 },
      { itemId: "item.hide.cow", min: 1, max: 1, chance: 0.8 },
    ],
    view: "cow",
  },
  "enemy.pig": {
    id: "enemy.pig",
    name: "Pig",
    level: 3,
    maxHealth: 20,
    attack: { cadenceS: 2.2, accuracy: 0.65, dmgMin: 1, dmgMax: 3 },
    aggroRadiusCells: 0, // placid: only defends itself
    leashRadiusCells: 8,
    wanderRadiusCells: 3,
    respawnS: 40,
    xpOnDefeat: 42,
    loot: [
      { itemId: "item.pork.raw", min: 1, max: 2, chance: 0.9 },
      { itemId: "item.berry.basic", min: 1, max: 2, chance: 0.3 },
    ],
    view: "pig",
  },
  "enemy.chicken": {
    id: "enemy.chicken",
    name: "Chicken",
    level: 1,
    maxHealth: 4,
    attack: { cadenceS: 3.0, accuracy: 0.3, dmgMin: 0, dmgMax: 1 },
    aggroRadiusCells: 0, // placid
    leashRadiusCells: 5,
    wanderRadiusCells: 3,
    respawnS: 25,
    xpOnDefeat: 8,
    loot: [
      { itemId: "item.chicken.raw", min: 1, max: 1, chance: 0.95 },
      { itemId: "item.feather", min: 1, max: 2, chance: 0.8 },
    ],
    view: "chicken",
  },
  "enemy.sheep": {
    id: "enemy.sheep",
    name: "Sheep",
    level: 1,
    maxHealth: 8,
    attack: { cadenceS: 2.8, accuracy: 0.4, dmgMin: 0, dmgMax: 1 },
    aggroRadiusCells: 0, // placid
    leashRadiusCells: 6,
    wanderRadiusCells: 3,
    respawnS: 35,
    xpOnDefeat: 16,
    loot: [
      { itemId: "item.wool", min: 1, max: 2, chance: 0.9 },
      { itemId: "item.mutton.raw", min: 1, max: 1, chance: 0.9 },
    ],
    view: "sheep",
  },
  "enemy.target_dummy": {
    id: "enemy.target_dummy",
    name: "Straw Target",
    level: 1,
    maxHealth: 30,
    attack: { cadenceS: 99, accuracy: 0, dmgMin: 0, dmgMax: 0 },
    aggroRadiusCells: 0, // it is straw
    leashRadiusCells: 1,
    wanderRadiusCells: 0,
    respawnS: 6,
    xpOnDefeat: 6,
    loot: [],
    view: "dummy",
    stationary: true, // never shuffles or leash-heals — it can actually be felled
  },
  "enemy.spider": {
    id: "enemy.spider",
    name: "Spider",
    level: 4,
    maxHealth: 26,
    attack: { cadenceS: 2.6, accuracy: 0.7, dmgMin: 2, dmgMax: 4 },
    aggroRadiusCells: 2, // skitters at anyone poking around its web
    leashRadiusCells: 6,
    wanderRadiusCells: 2,
    respawnS: 50,
    xpOnDefeat: 58,
    loot: [{ itemId: "item.ore.copper", min: 1, max: 2, chance: 0.7 }],
    view: "spider",
  },
  "enemy.creeper": {
    id: "enemy.creeper",
    name: "Creeper",
    level: 6,
    maxHealth: 30,
    attack: { cadenceS: 3.2, accuracy: 0.85, dmgMin: 5, dmgMax: 9 }, // a nasty lunge
    aggroRadiusCells: 4,
    leashRadiusCells: 8,
    wanderRadiusCells: 2,
    respawnS: 70,
    xpOnDefeat: 100,
    loot: [{ itemId: "item.coin", min: 2, max: 6, chance: 0.9 }],
    view: "creeper",
  },
  "enemy.zombie": {
    id: "enemy.zombie",
    name: "Zombie",
    level: 5,
    maxHealth: 34,
    attack: { cadenceS: 2.4, accuracy: 0.7, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 4,
    leashRadiusCells: 8,
    wanderRadiusCells: 2,
    respawnS: 60,
    xpOnDefeat: 82,
    loot: [{ itemId: "item.coin", min: 1, max: 4, chance: 0.8 }],
    view: "zombie",
  },
  "enemy.skeleton": {
    id: "enemy.skeleton",
    name: "Skeleton",
    level: 6,
    maxHealth: 28,
    attack: { cadenceS: 2.0, accuracy: 0.78, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 5,
    leashRadiusCells: 9,
    wanderRadiusCells: 2,
    respawnS: 60,
    xpOnDefeat: 95,
    loot: [{ itemId: "item.coin", min: 1, max: 4, chance: 0.8 }],
    view: "skeleton",
  },
  "enemy.squid": {
    id: "enemy.squid",
    name: "Squid",
    level: 3,
    maxHealth: 18,
    attack: { cadenceS: 3.0, accuracy: 0.4, dmgMin: 0, dmgMax: 1 }, // harmless drifter
    aggroRadiusCells: 0, // passive
    leashRadiusCells: 6,
    wanderRadiusCells: 3,
    respawnS: 60,
    xpOnDefeat: 40,
    loot: [{ itemId: "item.coin", min: 1, max: 3, chance: 0.7 }],
    view: "squid",
  },
  "enemy.ghast": {
    id: "enemy.ghast",
    name: "Ghast",
    level: 10,
    maxHealth: 26,
    attack: { cadenceS: 3.4, accuracy: 0.6, dmgMin: 6, dmgMax: 11 },
    aggroRadiusCells: 6,
    leashRadiusCells: 12,
    wanderRadiusCells: 3,
    respawnS: 90,
    xpOnDefeat: 160,
    loot: [{ itemId: "item.coin", min: 4, max: 10, chance: 0.9 }],
    view: "ghast",
  },
  "enemy.cave_spider": {
    id: "enemy.cave_spider",
    name: "Cave Spider",
    level: 6,
    maxHealth: 34,
    attack: { cadenceS: 2.0, accuracy: 0.72, dmgMin: 3, dmgMax: 5 },
    aggroRadiusCells: 3,
    leashRadiusCells: 7,
    wanderRadiusCells: 2,
    respawnS: 55,
    xpOnDefeat: 90,
    loot: [{ itemId: "item.ore.iron", min: 1, max: 1, chance: 0.5 }],
    view: "spider",
    scale: 0.75,
  },
  "enemy.old_gnasher": {
    id: "enemy.old_gnasher",
    name: "Old Gnasher",
    level: 8,
    maxHealth: 60,
    attack: { cadenceS: 2.8, accuracy: 0.75, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 3,
    leashRadiusCells: 9,
    wanderRadiusCells: 2,
    respawnS: 90,
    xpOnDefeat: 200,
    loot: [
      { itemId: "item.gem.emberstone", min: 1, max: 1, chance: 1 },
      { itemId: "item.ore.copper", min: 2, max: 4, chance: 1 },
    ],
    view: "gnasher",
    scale: 1.5,
  },
  // ---- the wider Reach (see docs/BESTIARY.md) ----
  "enemy.timber_wolf": {
    id: "enemy.timber_wolf",
    name: "Timber Wolf",
    level: 5,
    maxHealth: 30,
    attack: { cadenceS: 1.8, accuracy: 0.7, dmgMin: 2, dmgMax: 4 },
    aggroRadiusCells: 3,
    leashRadiusCells: 8,
    wanderRadiusCells: 3,
    respawnS: 60,
    xpOnDefeat: 70,
    loot: [
      { itemId: "item.hide.wolf", min: 1, max: 1, chance: 0.85 },
      { itemId: "item.bone.old", min: 1, max: 2, chance: 0.6 },
    ],
    view: "wolf",
    tint: "#8a8078",
  },
  "enemy.frost_wolf": {
    id: "enemy.frost_wolf",
    name: "Frost Wolf",
    level: 9,
    maxHealth: 46,
    attack: { cadenceS: 1.7, accuracy: 0.74, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 3,
    leashRadiusCells: 8,
    wanderRadiusCells: 3,
    respawnS: 70,
    xpOnDefeat: 130,
    loot: [
      { itemId: "item.hide.wolf", min: 1, max: 2, chance: 0.9 },
      { itemId: "item.bone.old", min: 1, max: 2, chance: 0.6 },
    ],
    view: "wolf",
    tint: "#dfe6ea",
  },
  "enemy.bog_slime": {
    id: "enemy.bog_slime",
    name: "Bog Slime",
    level: 5,
    maxHealth: 36,
    attack: { cadenceS: 2.8, accuracy: 0.62, dmgMin: 2, dmgMax: 4 },
    aggroRadiusCells: 2,
    leashRadiusCells: 6,
    wanderRadiusCells: 2,
    respawnS: 45,
    xpOnDefeat: 66,
    loot: [{ itemId: "item.glob.slime", min: 1, max: 2, chance: 0.9 }],
    view: "slime",
    tint: "#5d8c3a",
  },
  "enemy.grave_shambler": {
    id: "enemy.grave_shambler",
    name: "Grave Shambler",
    level: 12,
    maxHealth: 62,
    attack: { cadenceS: 2.3, accuracy: 0.72, dmgMin: 4, dmgMax: 8 },
    aggroRadiusCells: 4,
    leashRadiusCells: 8,
    wanderRadiusCells: 2,
    respawnS: 70,
    xpOnDefeat: 200,
    loot: [
      { itemId: "item.bone.old", min: 1, max: 3, chance: 0.8 },
      { itemId: "item.charm.bone", min: 1, max: 1, chance: 0.2 },
      { itemId: "item.coin", min: 4, max: 12, chance: 0.6 },
    ],
    view: "husk",
    tint: "#4a5548",
  },
  "enemy.hollow_wight": {
    id: "enemy.hollow_wight",
    name: "Hollow Wight",
    level: 16,
    maxHealth: 92,
    attack: { cadenceS: 2.1, accuracy: 0.78, dmgMin: 6, dmgMax: 11 },
    aggroRadiusCells: 4,
    leashRadiusCells: 9,
    wanderRadiusCells: 2,
    respawnS: 110,
    xpOnDefeat: 340,
    loot: [
      { itemId: "item.bone.old", min: 2, max: 4, chance: 0.9 },
      { itemId: "item.ring.gold", min: 1, max: 1, chance: 0.12 },
      { itemId: "item.gem.diamond", min: 1, max: 1, chance: 0.04 },
      { itemId: "item.coin", min: 10, max: 24, chance: 0.7 },
    ],
    view: "husk",
    tint: "#9fb8c9",
  },
  // A capstone undead for the deep crypts: the first high-tier skeleton, so
  // Necromancy has a scaling kill worth far more than the Hollow Wight's 340
  // (→ 410 Necromancy XP) instead of plateauing mid-game.
  "enemy.barrow_lord": {
    id: "enemy.barrow_lord",
    name: "Barrow Lord",
    level: 28,
    maxHealth: 240,
    attack: { cadenceS: 2.3, accuracy: 0.82, dmgMin: 10, dmgMax: 18 },
    aggroRadiusCells: 4,
    leashRadiusCells: 10,
    wanderRadiusCells: 2,
    respawnS: 150,
    xpOnDefeat: 820,
    loot: [
      { itemId: "item.bone.big", min: 2, max: 4, chance: 0.95 },
      { itemId: "item.bone.dragon", min: 1, max: 1, chance: 0.15 },
      { itemId: "item.gem.diamond", min: 1, max: 2, chance: 0.2 },
      { itemId: "item.coin", min: 30, max: 70, chance: 0.9 },
    ],
    view: "skeleton",
    tint: "#c8ccd6",
  },

  // --- Vanilla mobs on real BetaSharp/oafs/CornCraft models (Faithful-skinned).
  "enemy.drowned": {
    id: "enemy.drowned", name: "Drowned", level: 5, maxHealth: 30,
    attack: { cadenceS: 2.6, accuracy: 0.8, dmgMin: 4, dmgMax: 8 },
    aggroRadiusCells: 4, leashRadiusCells: 8, wanderRadiusCells: 2, respawnS: 70, xpOnDefeat: 95,
    loot: [{ itemId: "item.coin", min: 2, max: 6, chance: 0.9 }], view: "drowned",
  },
  "enemy.stray": {
    id: "enemy.stray", name: "Stray", level: 6, maxHealth: 28,
    attack: { cadenceS: 2.4, accuracy: 0.84, dmgMin: 4, dmgMax: 9 },
    aggroRadiusCells: 5, leashRadiusCells: 9, wanderRadiusCells: 2, respawnS: 75, xpOnDefeat: 110,
    loot: [{ itemId: "item.bone.big", min: 1, max: 2, chance: 0.5 }, { itemId: "item.coin", min: 2, max: 6, chance: 0.9 }], view: "stray",
  },
  "enemy.pillager": {
    id: "enemy.pillager", name: "Pillager", level: 7, maxHealth: 32,
    attack: { cadenceS: 2.5, accuracy: 0.86, dmgMin: 5, dmgMax: 9 },
    aggroRadiusCells: 6, leashRadiusCells: 10, wanderRadiusCells: 2, respawnS: 80, xpOnDefeat: 130,
    loot: [{ itemId: "item.coin", min: 4, max: 10, chance: 0.95 }], view: "pillager",
  },
  "enemy.witch": {
    id: "enemy.witch", name: "Witch", level: 8, maxHealth: 40,
    attack: { cadenceS: 2.8, accuracy: 0.82, dmgMin: 6, dmgMax: 11 },
    aggroRadiusCells: 5, leashRadiusCells: 9, wanderRadiusCells: 2, respawnS: 90, xpOnDefeat: 160,
    loot: [{ itemId: "item.herb.mint", min: 1, max: 3, chance: 0.6 }, { itemId: "item.coin", min: 4, max: 10, chance: 0.9 }], view: "witch",
  },
  "enemy.vindicator": {
    id: "enemy.vindicator", name: "Vindicator", level: 9, maxHealth: 44,
    attack: { cadenceS: 2.2, accuracy: 0.88, dmgMin: 7, dmgMax: 13 },
    aggroRadiusCells: 6, leashRadiusCells: 10, wanderRadiusCells: 2, respawnS: 95, xpOnDefeat: 190,
    loot: [{ itemId: "item.coin", min: 5, max: 12, chance: 0.95 }], view: "vindicator",
  },
  "enemy.evoker": {
    id: "enemy.evoker", name: "Evoker", level: 11, maxHealth: 48,
    attack: { cadenceS: 2.9, accuracy: 0.84, dmgMin: 8, dmgMax: 14 },
    aggroRadiusCells: 6, leashRadiusCells: 11, wanderRadiusCells: 2, respawnS: 110, xpOnDefeat: 240,
    loot: [{ itemId: "item.gem.diamond", min: 1, max: 1, chance: 0.12 }, { itemId: "item.coin", min: 8, max: 16, chance: 0.95 }], view: "evoker",
  },
  "enemy.illusioner": {
    id: "enemy.illusioner", name: "Illusioner", level: 11, maxHealth: 40,
    attack: { cadenceS: 2.6, accuracy: 0.87, dmgMin: 7, dmgMax: 13 },
    aggroRadiusCells: 7, leashRadiusCells: 11, wanderRadiusCells: 2, respawnS: 110, xpOnDefeat: 230,
    loot: [{ itemId: "item.coin", min: 8, max: 16, chance: 0.95 }], view: "illusioner",
  },
  "enemy.ravager": {
    id: "enemy.ravager", name: "Ravager", level: 14, maxHealth: 130,
    attack: { cadenceS: 2.6, accuracy: 0.85, dmgMin: 12, dmgMax: 20 },
    aggroRadiusCells: 5, leashRadiusCells: 10, wanderRadiusCells: 2, respawnS: 150, xpOnDefeat: 480,
    loot: [{ itemId: "item.gem.diamond", min: 1, max: 2, chance: 0.25 }, { itemId: "item.coin", min: 15, max: 35, chance: 0.95 }], view: "ravager",
  },
  // Passive / ambient creatures — low threat, huntable.
  "enemy.armadillo": {
    id: "enemy.armadillo", name: "Armadillo", level: 2, maxHealth: 14,
    attack: { cadenceS: 3.5, accuracy: 0.6, dmgMin: 1, dmgMax: 2 },
    aggroRadiusCells: 0, leashRadiusCells: 4, wanderRadiusCells: 3, respawnS: 60, xpOnDefeat: 40,
    loot: [{ itemId: "item.coin", min: 1, max: 3, chance: 0.7 }], view: "armadillo",
  },
  "enemy.sniffer": {
    id: "enemy.sniffer", name: "Sniffer", level: 3, maxHealth: 30,
    attack: { cadenceS: 3.5, accuracy: 0.5, dmgMin: 1, dmgMax: 2 },
    aggroRadiusCells: 0, leashRadiusCells: 4, wanderRadiusCells: 3, respawnS: 90, xpOnDefeat: 60,
    loot: [{ itemId: "item.seed.wheat", min: 1, max: 2, chance: 0.6 }, { itemId: "item.coin", min: 1, max: 3, chance: 0.6 }], view: "sniffer",
  },
  "enemy.bat": {
    id: "enemy.bat", name: "Bat", level: 1, maxHealth: 6,
    attack: { cadenceS: 3.5, accuracy: 0.5, dmgMin: 1, dmgMax: 1 },
    aggroRadiusCells: 0, leashRadiusCells: 4, wanderRadiusCells: 4, respawnS: 45, xpOnDefeat: 15,
    loot: [], view: "bat",
  },
  "enemy.allay": {
    id: "enemy.allay", name: "Allay", level: 1, maxHealth: 8,
    attack: { cadenceS: 3.5, accuracy: 0.5, dmgMin: 1, dmgMax: 1 },
    aggroRadiusCells: 0, leashRadiusCells: 4, wanderRadiusCells: 4, respawnS: 60, xpOnDefeat: 20,
    loot: [], view: "allay",
  },
  "enemy.bee": {
    id: "enemy.bee", name: "Bee", level: 2, maxHealth: 10,
    attack: { cadenceS: 2.8, accuracy: 0.7, dmgMin: 2, dmgMax: 3 }, // stings if provoked
    aggroRadiusCells: 0, leashRadiusCells: 5, wanderRadiusCells: 4, respawnS: 55, xpOnDefeat: 30,
    loot: [{ itemId: "item.coin", min: 1, max: 3, chance: 0.6 }], view: "bee",
  },
  "enemy.mooshroom": {
    id: "enemy.mooshroom", name: "Mooshroom", level: 2, maxHealth: 18,
    attack: { cadenceS: 3.5, accuracy: 0.5, dmgMin: 1, dmgMax: 2 },
    aggroRadiusCells: 0, leashRadiusCells: 4, wanderRadiusCells: 3, respawnS: 70, xpOnDefeat: 45,
    loot: [{ itemId: "item.coin", min: 1, max: 4, chance: 0.7 }], view: "mooshroom",
  },
  // Bosses on real models (divine-world-core geometry, Faithful skins).
  "enemy.warden": {
    id: "enemy.warden", name: "Warden", level: 32, maxHealth: 560,
    attack: { cadenceS: 2.4, accuracy: 0.9, dmgMin: 24, dmgMax: 40 },
    aggroRadiusCells: 6, leashRadiusCells: 12, wanderRadiusCells: 2, respawnS: 260, xpOnDefeat: 1600,
    loot: [{ itemId: "item.gem.diamond", min: 2, max: 4, chance: 0.6 }, { itemId: "item.coin", min: 60, max: 120, chance: 0.95 }],
    view: "warden", scale: 1.5,
  },
  "enemy.dire_wolf": {
    id: "enemy.dire_wolf",
    name: "Dire Wolf",
    level: 14,
    maxHealth: 74,
    attack: { cadenceS: 1.6, accuracy: 0.78, dmgMin: 5, dmgMax: 9 },
    aggroRadiusCells: 4,
    leashRadiusCells: 9,
    wanderRadiusCells: 3,
    respawnS: 90,
    xpOnDefeat: 260,
    loot: [
      { itemId: "item.hide.wolf", min: 1, max: 2, chance: 0.9 },
      { itemId: "item.charm.bone", min: 1, max: 1, chance: 0.25 },
    ],
    view: "wolf",
    tint: "#3a3f47",
  },
  "enemy.gloom_spinner": {
    id: "enemy.gloom_spinner",
    name: "Gloom Spinner",
    level: 13,
    maxHealth: 66,
    attack: { cadenceS: 1.8, accuracy: 0.76, dmgMin: 4, dmgMax: 8 },
    aggroRadiusCells: 4,
    leashRadiusCells: 7,
    wanderRadiusCells: 3,
    respawnS: 75,
    xpOnDefeat: 230,
    loot: [
      { itemId: "item.venom.sac", min: 1, max: 2, chance: 0.8 },
      { itemId: "item.gem.emberstone", min: 1, max: 1, chance: 0.1 },
    ],
    view: "spider",
    tint: "#7a4f9b",
  },
  "enemy.blight_slime": {
    id: "enemy.blight_slime",
    name: "Blight Slime",
    level: 10,
    maxHealth: 58,
    attack: { cadenceS: 2.6, accuracy: 0.66, dmgMin: 3, dmgMax: 7 },
    aggroRadiusCells: 3,
    leashRadiusCells: 6,
    wanderRadiusCells: 2,
    respawnS: 60,
    xpOnDefeat: 150,
    loot: [
      { itemId: "item.glob.slime", min: 2, max: 3, chance: 0.9 },
      { itemId: "item.coin", min: 3, max: 9, chance: 0.5 },
    ],
    view: "slime",
    tint: "#8a5fae",
  },
  "enemy.dragon.fire": {
    id: "enemy.dragon.fire",
    name: "Fire Dragon",
    level: 30,
    maxHealth: 320,
    attack: { cadenceS: 2.4, accuracy: 0.85, dmgMin: 9, dmgMax: 16 },
    aggroRadiusCells: 6,
    leashRadiusCells: 14,
    wanderRadiusCells: 4,
    respawnS: 600,
    xpOnDefeat: 2400,
    loot: [
      { itemId: "item.gem.diamond", min: 1, max: 2, chance: 0.5 },
      { itemId: "item.bar.gold", min: 2, max: 4, chance: 0.8 },
      { itemId: "item.coin", min: 60, max: 140, chance: 1 },
      { itemId: "item.gem.emberstone", min: 1, max: 1, chance: 0.6 },
    ],
    view: "dragon",
    viewMaterial: "fire_dragon",
  },
  "enemy.dragon.ice": {
    id: "enemy.dragon.ice",
    name: "Ice Dragon",
    level: 28,
    maxHealth: 290,
    attack: { cadenceS: 2.5, accuracy: 0.84, dmgMin: 8, dmgMax: 15 },
    aggroRadiusCells: 6,
    leashRadiusCells: 14,
    wanderRadiusCells: 4,
    respawnS: 600,
    xpOnDefeat: 2100,
    loot: [
      { itemId: "item.gem.diamond", min: 1, max: 2, chance: 0.45 },
      { itemId: "item.bar.gold", min: 2, max: 3, chance: 0.7 },
      { itemId: "item.coin", min: 50, max: 120, chance: 1 },
    ],
    view: "dragon",
    viewMaterial: "ice_dragon",
  },
  "enemy.dragon.hydra": {
    id: "enemy.dragon.hydra",
    name: "Hydra",
    level: 34,
    maxHealth: 420,
    attack: { cadenceS: 2.0, accuracy: 0.86, dmgMin: 10, dmgMax: 18 },
    aggroRadiusCells: 6,
    leashRadiusCells: 14,
    wanderRadiusCells: 3,
    respawnS: 900,
    xpOnDefeat: 3400,
    loot: [
      { itemId: "item.gem.diamond", min: 2, max: 3, chance: 0.6 },
      { itemId: "item.bar.gold", min: 3, max: 5, chance: 0.9 },
      { itemId: "item.coin", min: 90, max: 200, chance: 1 },
    ],
    view: "dragon",
    viewMaterial: "hydra_dragon",
  },
  "enemy.dragon.twoheaded": {
    id: "enemy.dragon.twoheaded",
    name: "Two-Headed Dragon",
    level: 32,
    maxHealth: 380,
    attack: { cadenceS: 2.1, accuracy: 0.85, dmgMin: 10, dmgMax: 17 },
    aggroRadiusCells: 6,
    leashRadiusCells: 14,
    wanderRadiusCells: 3,
    respawnS: 900,
    xpOnDefeat: 3000,
    loot: [
      { itemId: "item.gem.diamond", min: 1, max: 3, chance: 0.55 },
      { itemId: "item.bar.gold", min: 2, max: 5, chance: 0.85 },
      { itemId: "item.coin", min: 80, max: 180, chance: 1 },
      { itemId: "item.charm.bone", min: 1, max: 1, chance: 0.5 },
    ],
    view: "dragon",
    viewMaterial: "two_headed_dragon",
  },
  "enemy.mire_husk": {
    id: "enemy.mire_husk",
    name: "Mire Husk",
    level: 6,
    maxHealth: 34,
    attack: { cadenceS: 2.2, accuracy: 0.68, dmgMin: 2, dmgMax: 5 },
    aggroRadiusCells: 3,
    leashRadiusCells: 7,
    wanderRadiusCells: 2,
    respawnS: 55,
    xpOnDefeat: 88,
    loot: [
      { itemId: "item.bone.old", min: 1, max: 2, chance: 0.7 },
      { itemId: "item.glob.slime", min: 1, max: 1, chance: 0.4 },
    ],
    view: "husk",
    tint: "#5f7355",
  },
  "enemy.dune_husk": {
    id: "enemy.dune_husk",
    name: "Dune Husk",
    level: 8,
    maxHealth: 44,
    attack: { cadenceS: 2.1, accuracy: 0.72, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 3,
    leashRadiusCells: 7,
    wanderRadiusCells: 3,
    respawnS: 60,
    xpOnDefeat: 120,
    loot: [
      { itemId: "item.bone.old", min: 1, max: 2, chance: 0.7 },
      { itemId: "item.venom.sac", min: 1, max: 1, chance: 0.35 },
    ],
    view: "husk",
    tint: "#b9a065",
  },
  "enemy.dust_scuttler": {
    id: "enemy.dust_scuttler",
    name: "Dust Scuttler",
    level: 7,
    maxHealth: 38,
    attack: { cadenceS: 1.9, accuracy: 0.72, dmgMin: 3, dmgMax: 5 },
    aggroRadiusCells: 3,
    leashRadiusCells: 6,
    wanderRadiusCells: 3,
    respawnS: 55,
    xpOnDefeat: 104,
    loot: [{ itemId: "item.venom.sac", min: 1, max: 1, chance: 0.6 }],
    view: "spider",
    tint: "#a08153",
  },
  "enemy.vine_stalker": {
    id: "enemy.vine_stalker",
    name: "Vine Stalker",
    level: 8,
    maxHealth: 42,
    attack: { cadenceS: 2.0, accuracy: 0.73, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 3,
    leashRadiusCells: 7,
    wanderRadiusCells: 2,
    respawnS: 60,
    xpOnDefeat: 118,
    loot: [
      { itemId: "item.venom.sac", min: 1, max: 1, chance: 0.5 },
      { itemId: "item.berry.basic", min: 1, max: 3, chance: 0.5 },
    ],
    view: "spider",
    tint: "#3f6b2f",
  },
  "enemy.canyon_construct": {
    id: "enemy.canyon_construct",
    name: "Canyon Construct",
    level: 10,
    maxHealth: 70,
    attack: { cadenceS: 3.0, accuracy: 0.75, dmgMin: 4, dmgMax: 8 },
    aggroRadiusCells: 2,
    leashRadiusCells: 5,
    wanderRadiusCells: 1,
    respawnS: 90,
    xpOnDefeat: 190,
    loot: [{ itemId: "item.core.construct", min: 1, max: 1, chance: 0.8 }],
    view: "construct",
    tint: "#9c6b4a",
  },
  "enemy.spore_shambler": {
    id: "enemy.spore_shambler",
    name: "Spore Shambler",
    level: 9,
    maxHealth: 48,
    attack: { cadenceS: 2.3, accuracy: 0.7, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 3,
    leashRadiusCells: 6,
    wanderRadiusCells: 2,
    respawnS: 65,
    xpOnDefeat: 140,
    loot: [{ itemId: "item.spore.pale", min: 1, max: 2, chance: 0.85 }],
    view: "husk",
    tint: "#b9a6c4",
  },
  "enemy.rust_construct": {
    id: "enemy.rust_construct",
    name: "Rust-seized Construct",
    level: 8,
    maxHealth: 55,
    attack: { cadenceS: 2.8, accuracy: 0.72, dmgMin: 3, dmgMax: 7 },
    aggroRadiusCells: 2,
    leashRadiusCells: 5,
    wanderRadiusCells: 1,
    respawnS: 80,
    xpOnDefeat: 150,
    loot: [{ itemId: "item.core.construct", min: 1, max: 1, chance: 0.7 }],
    view: "construct",
    tint: "#7a6355",
  },
  // ---- act bosses (quest drops are guaranteed) ----
  "enemy.rootbound_warden": {
    id: "enemy.rootbound_warden",
    name: "Rootbound Warden",
    level: 9,
    maxHealth: 90,
    attack: { cadenceS: 3.0, accuracy: 0.76, dmgMin: 4, dmgMax: 7 },
    aggroRadiusCells: 3,
    leashRadiusCells: 9,
    wanderRadiusCells: 1,
    respawnS: 120,
    xpOnDefeat: 320,
    loot: [
      { itemId: "item.anchor.root", min: 1, max: 1, chance: 1 },
      { itemId: "item.core.construct", min: 1, max: 2, chance: 1 },
    ],
    view: "construct",
    tint: "#4f6b3a",
    scale: 1.5,
  },
  "enemy.silt_king": {
    id: "enemy.silt_king",
    name: "The Silt King",
    level: 10,
    maxHealth: 110,
    attack: { cadenceS: 3.2, accuracy: 0.78, dmgMin: 4, dmgMax: 8 },
    aggroRadiusCells: 3,
    leashRadiusCells: 9,
    wanderRadiusCells: 1,
    respawnS: 150,
    xpOnDefeat: 400,
    loot: [
      { itemId: "item.anchor.pump", min: 1, max: 1, chance: 1 },
      { itemId: "item.glob.slime", min: 3, max: 5, chance: 1 },
    ],
    view: "slime",
    tint: "#7a6f45",
    scale: 2,
  },
  "enemy.liftworks_overseer": {
    id: "enemy.liftworks_overseer",
    name: "The Liftworks Overseer",
    level: 12,
    maxHealth: 130,
    attack: { cadenceS: 3.2, accuracy: 0.8, dmgMin: 5, dmgMax: 9 },
    aggroRadiusCells: 3,
    leashRadiusCells: 9,
    wanderRadiusCells: 1,
    respawnS: 180,
    xpOnDefeat: 520,
    loot: [
      { itemId: "item.anchor.lift", min: 1, max: 1, chance: 1 },
      { itemId: "item.core.construct", min: 2, max: 3, chance: 1 },
      { itemId: "item.ore.iron", min: 2, max: 4, chance: 1 },
    ],
    view: "construct",
    tint: "#5a6a72",
    scale: 1.6,
  },
  // ---- wilds fauna: new creatures seeded across the biomes ----
  "enemy.boar": {
    id: "enemy.boar",
    name: "Wild Boar",
    level: 4,
    maxHealth: 26,
    attack: { cadenceS: 2.0, accuracy: 0.68, dmgMin: 2, dmgMax: 4 },
    aggroRadiusCells: 2, // charges anyone who wanders too near
    leashRadiusCells: 7,
    wanderRadiusCells: 3,
    respawnS: 45,
    xpOnDefeat: 48,
    loot: [
      { itemId: "item.pork.raw", min: 1, max: 3, chance: 0.9 },
      { itemId: "item.hide.cow", min: 1, max: 1, chance: 0.4 },
    ],
    view: "pig",
    tint: "#6b4a34",
  },
  "enemy.prairie_bull": {
    id: "enemy.prairie_bull",
    name: "Prairie Bull",
    level: 6,
    maxHealth: 38,
    attack: { cadenceS: 2.2, accuracy: 0.7, dmgMin: 2, dmgMax: 5 },
    aggroRadiusCells: 3, // territorial on the open range
    leashRadiusCells: 8,
    wanderRadiusCells: 3,
    respawnS: 55,
    xpOnDefeat: 82,
    loot: [
      { itemId: "item.beef.raw", min: 1, max: 3, chance: 0.9 },
      { itemId: "item.hide.cow", min: 1, max: 2, chance: 0.85 },
    ],
    view: "cow",
    tint: "#7a5a3a",
  },
  "enemy.bramble_slime": {
    id: "enemy.bramble_slime",
    name: "Bramble Slime",
    level: 3,
    maxHealth: 20,
    attack: { cadenceS: 2.6, accuracy: 0.6, dmgMin: 1, dmgMax: 3 },
    aggroRadiusCells: 2,
    leashRadiusCells: 6,
    wanderRadiusCells: 2,
    respawnS: 40,
    xpOnDefeat: 40,
    loot: [
      { itemId: "item.glob.slime", min: 1, max: 2, chance: 0.9 },
      { itemId: "item.berry.basic", min: 1, max: 2, chance: 0.4 },
    ],
    view: "slime",
    tint: "#6b8a3a",
  },
  "enemy.thornback": {
    id: "enemy.thornback",
    name: "Thornback Spider",
    level: 7,
    maxHealth: 40,
    attack: { cadenceS: 2.0, accuracy: 0.72, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 3,
    leashRadiusCells: 7,
    wanderRadiusCells: 2,
    respawnS: 55,
    xpOnDefeat: 110,
    loot: [
      { itemId: "item.venom.sac", min: 1, max: 2, chance: 0.7 },
      { itemId: "item.ore.iron", min: 1, max: 1, chance: 0.3 },
    ],
    view: "spider",
    tint: "#5a4a2f",
  },
  "enemy.moss_golem": {
    id: "enemy.moss_golem",
    name: "Moss Golem",
    level: 11,
    maxHealth: 82,
    attack: { cadenceS: 3.0, accuracy: 0.74, dmgMin: 4, dmgMax: 8 },
    aggroRadiusCells: 2, // slow to rouse, hard to fell
    leashRadiusCells: 6,
    wanderRadiusCells: 1,
    respawnS: 95,
    xpOnDefeat: 210,
    loot: [
      { itemId: "item.core.construct", min: 1, max: 1, chance: 0.7 },
      { itemId: "item.berry.basic", min: 1, max: 3, chance: 0.5 },
    ],
    view: "construct",
    tint: "#4f7a3a",
    scale: 1.3,
  },
  "enemy.stone_sentinel": {
    id: "enemy.stone_sentinel",
    name: "Stone Sentinel",
    level: 9,
    maxHealth: 68,
    attack: { cadenceS: 3.0, accuracy: 0.74, dmgMin: 4, dmgMax: 7 },
    aggroRadiusCells: 2,
    leashRadiusCells: 5,
    wanderRadiusCells: 1,
    respawnS: 85,
    xpOnDefeat: 168,
    loot: [
      { itemId: "item.core.construct", min: 1, max: 1, chance: 0.65 },
      { itemId: "item.ore.tin", min: 1, max: 2, chance: 0.5 },
    ],
    view: "construct",
    tint: "#7a7a7a",
    scale: 1.2,
  },
  "enemy.marsh_lurker": {
    id: "enemy.marsh_lurker",
    name: "Marsh Lurker",
    level: 7,
    maxHealth: 44,
    attack: { cadenceS: 2.4, accuracy: 0.68, dmgMin: 3, dmgMax: 6 },
    aggroRadiusCells: 3,
    leashRadiusCells: 6,
    wanderRadiusCells: 2,
    respawnS: 55,
    xpOnDefeat: 108,
    loot: [
      { itemId: "item.glob.slime", min: 2, max: 3, chance: 0.9 },
      { itemId: "item.herb.duskcap", min: 1, max: 1, chance: 0.25 },
    ],
    view: "slime",
    tint: "#4a5f3a",
  },
  "enemy.ash_hound": {
    id: "enemy.ash_hound",
    name: "Ash Hound",
    level: 12,
    maxHealth: 60,
    attack: { cadenceS: 1.6, accuracy: 0.78, dmgMin: 4, dmgMax: 8 },
    aggroRadiusCells: 4, // hunts the scorched flats in packs
    leashRadiusCells: 9,
    wanderRadiusCells: 3,
    respawnS: 75,
    xpOnDefeat: 220,
    loot: [
      { itemId: "item.hide.wolf", min: 1, max: 2, chance: 0.85 },
      { itemId: "item.gem.emberstone", min: 1, max: 1, chance: 0.15 },
    ],
    view: "wolf",
    tint: "#6a352a",
  },
  "enemy.ember_crawler": {
    id: "enemy.ember_crawler",
    name: "Ember Crawler",
    level: 10,
    maxHealth: 54,
    attack: { cadenceS: 1.9, accuracy: 0.76, dmgMin: 4, dmgMax: 7 },
    aggroRadiusCells: 3,
    leashRadiusCells: 7,
    wanderRadiusCells: 2,
    respawnS: 65,
    xpOnDefeat: 170,
    loot: [
      { itemId: "item.venom.sac", min: 1, max: 2, chance: 0.7 },
      { itemId: "item.gem.emberstone", min: 1, max: 1, chance: 0.12 },
    ],
    view: "spider",
    tint: "#8a3a2a",
  },
  "enemy.glacial_wight": {
    id: "enemy.glacial_wight",
    name: "Glacial Wight",
    level: 15,
    maxHealth: 88,
    attack: { cadenceS: 2.2, accuracy: 0.78, dmgMin: 5, dmgMax: 10 },
    aggroRadiusCells: 4,
    leashRadiusCells: 9,
    wanderRadiusCells: 2,
    respawnS: 100,
    xpOnDefeat: 320,
    loot: [
      { itemId: "item.bone.old", min: 2, max: 3, chance: 0.9 },
      { itemId: "item.gem.diamond", min: 1, max: 1, chance: 0.05 },
      { itemId: "item.coin", min: 8, max: 20, chance: 0.7 },
    ],
    view: "husk",
    tint: "#bcd6e6",
  },
};

// Bones for Prayer: every beast leaves bones behind, dragons yield dragon
// bones, and the big bruisers drop big bones.
for (const id of [
  "enemy.cow", "enemy.pig", "enemy.chicken", "enemy.sheep",
  "enemy.boar", "enemy.prairie_bull", "enemy.squid",
]) {
  ENEMIES[id].loot.push({ itemId: "item.bone.old", min: 1, max: 1, chance: 1 });
}
for (const id of ["enemy.dragon.fire", "enemy.dragon.ice", "enemy.dragon.hydra", "enemy.dragon.twoheaded"]) {
  ENEMIES[id].loot.push({ itemId: "item.bone.dragon", min: 1, max: 2, chance: 1 });
}
for (const id of [
  "enemy.old_gnasher", "enemy.grave_shambler", "enemy.hollow_wight", "enemy.dire_wolf",
  "enemy.moss_golem", "enemy.glacial_wight", "enemy.silt_king", "enemy.rootbound_warden",
]) {
  ENEMIES[id].loot.push({ itemId: "item.bone.big", min: 1, max: 2, chance: 0.85 });
}
// The deep-wild bruisers carry the high-Prayer bone tiers.
for (const id of ["enemy.barrow_lord", "enemy.silt_king", "enemy.glacial_wight", "enemy.canyon_construct"]) {
  ENEMIES[id].loot.push({ itemId: "item.bone.ancient", min: 1, max: 1, chance: 0.9 });
}
for (const id of ["enemy.warden", "enemy.ravager"]) {
  ENEMIES[id].loot.push({ itemId: "item.bone.warden", min: 1, max: 1, chance: 1 });
}
