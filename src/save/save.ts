// Versioned save/load. Plain data with stable IDs only — never engine objects.
// Respawn timers persist as remaining seconds (world time pauses while offline).

import { SKILLS } from "../content/content";
import type { GameSimulation } from "../sim/simulation";
import type { Slots } from "../sim/inventory";

const SAVE_KEY = "stoneleaf.save.slot0";
const BACKUP_KEY = "stoneleaf.save.slot0.bak";
// v2: the 2500x2500 starter province replaced the old 512 vale — v1 saves
// reference coordinates that no longer exist and are retired on load.
export const SAVE_FORMAT_VERSION = 2;

interface SaveDataV1 {
  save_format_version: number;
  updated_utc: string;
  player: { cell: { x: number; z: number }; facing: number };
  skills: Record<string, number>; // xp only; levels are derived
  inventory: Slots;
  equippedTool: string | null;
  equippedArmor?: Record<string, string | null>;
  equippedToolMods?: import("../content/content").ItemMods | null;
  equippedArmorMods?: Record<string, import("../content/content").ItemMods | null>;
  containers: Record<string, Slots>;
  nodes: Array<{ id: string; phase: "active" | "depleted"; remaining: number; respawnRemainingS: number }>;
  quests?: Record<string, { status: "available" | "active" | "completed"; objectiveIndex: number; progress: number }>;
  hp?: number;
  enemies?: Array<{ id: string; hp: number; phase: "alive" | "dead"; respawnRemainingS: number }>;
  currentRegionId?: string;
  otherRegions?: Record<string, RegionSnapshot>;
  /** Persistent world-state flags (repaired bridges, stabilized anchors…). */
  worldFlags?: string[];
  /** Warden Brusk's current slaying assignment. */
  slayer?: { taskDefId: string | null; taskIndex?: number; remaining: number; tasksDone: number };
  /** Relic types donated to Curator Fenwick's collection. */
  donatedRelics?: string[];
  /** World clock, seconds since day one 00:00. */
  timeS?: number;
  /** Bed respawn point, if one has been set. */
  homePoint?: { regionId: string; cell: { x: number; z: number } } | null;
  /** Discovered endless-world landmarks the player can fast-travel between. */
  waypoints?: Waypoint[];
  /** The buried cache the player's current treasure map points to, if any. */
  treasureHunt?: { x: number; z: number } | null;
  /** Renown with each great faction. */
  reputation?: Record<string, number>;
  /** Named biomes the player has ever entered. */
  discoveredBiomes?: string[];
  /** Quest the player has pinned to track (guidance line + map marker). */
  trackedQuestId?: string | null;
  trackingMuted?: boolean;
  /** Chosen melee attack style (accurate/aggressive/defensive/controlled). */
  attackStyle?: string;
  /** Run/walk preference. */
  running?: boolean;
}

/** A discovered endless-world landmark, saved so it can be revisited. */
export interface Waypoint {
  id: string;
  name: string;
  x: number;
  z: number;
}

/** Per-region world state, kept while the player is in another region. */
export interface RegionSnapshot {
  containers: Record<string, Slots>;
  nodes: Array<{ id: string; phase: "active" | "depleted"; remaining: number; respawnRemainingS: number }>;
  enemies: Array<{ id: string; hp: number; phase: "alive" | "dead"; respawnRemainingS: number }>;
}

/** Player-owned state that travels between regions. */
export interface SharedState {
  skills: Record<string, number>;
  inventory: Slots;
  equippedTool: string | null;
  equippedArmor: Record<"head" | "body" | "legs", string | null>;
  equippedToolMods?: import("../content/content").ItemMods | null;
  equippedArmorMods?: Record<string, import("../content/content").ItemMods | null>;
  hp: number;
  quests: Record<string, { status: "available" | "active" | "completed"; objectiveIndex: number; progress: number }>;
  worldFlags: string[];
  slayer: { taskDefId: string | null; taskIndex?: number; remaining: number; tasksDone: number };
  donatedRelics: string[];
  /** Bed respawn point, if one has been set. */
  homePoint?: { regionId: string; cell: { x: number; z: number } } | null;
  /** Discovered endless-world landmarks the player can fast-travel between. */
  waypoints?: Waypoint[];
  /** The buried cache the player's current treasure map points to, if any. */
  treasureHunt?: { x: number; z: number } | null;
  /** Renown with each great faction. */
  reputation?: Record<string, number>;
  /** Named biomes the player has ever entered. */
  discoveredBiomes?: string[];
  /** Quest the player has pinned to track. */
  trackedQuestId?: string | null;
  trackingMuted?: boolean;
  /** Chosen melee attack style. */
  attackStyle?: string;
  /** Run/walk preference. */
  running?: boolean;
}

// Items renamed by content updates: keep old saves' stacks meaningful.
const LEGACY_ITEM_IDS: Record<string, string> = {
  "item.meat.raw": "item.pork.raw",
  "item.meat.cooked": "item.pork.cooked",
  "item.meat.burnt": "item.pork.burnt",
  "item.hide.boar": "item.hide.cow",
};

function migrateSlots(slots: Slots): Slots {
  return slots.map((s) => (s ? { ...s, itemId: LEGACY_ITEM_IDS[s.itemId] ?? s.itemId } : null));
}

export function captureRegionState(sim: GameSimulation): RegionSnapshot {
  const containers: Record<string, Slots> = {};
  for (const [id, inv] of sim.containers) containers[id] = inv.snapshot();
  return {
    containers,
    nodes: [...sim.nodes.instances.values()].map((n) => ({
      id: n.instanceId,
      phase: n.phase,
      remaining: n.remaining,
      respawnRemainingS: n.respawnRemainingS,
    })),
    enemies: [...sim.enemies.enemies.values()].map((e) => ({
      id: e.instanceId,
      hp: e.hp,
      phase: e.phase,
      respawnRemainingS: e.respawnRemainingS,
    })),
  };
}

export function applyRegionState(sim: GameSimulation, snapshot: RegionSnapshot): void {
  for (const [id, slots] of Object.entries(snapshot.containers)) {
    const inv = sim.containers.get(id);
    if (inv) inv.slots = slots.map((s) => (s ? { ...s } : null));
  }
  for (const saved of snapshot.nodes) {
    const node = sim.nodes.instances.get(saved.id);
    if (!node) continue;
    node.phase = saved.phase;
    node.remaining = saved.remaining;
    node.respawnRemainingS = saved.respawnRemainingS;
  }
  for (const saved of snapshot.enemies) {
    const enemy = sim.enemies.get(saved.id);
    if (!enemy) continue;
    enemy.hp = saved.hp;
    enemy.phase = saved.phase;
    enemy.respawnRemainingS = saved.respawnRemainingS;
  }
}

export function captureSharedState(sim: GameSimulation): SharedState {
  return {
    skills: { ...sim.skills.xp },
    inventory: sim.inventory.snapshot(),
    equippedTool: sim.equippedTool,
    equippedArmor: { ...sim.equippedArmor },
    equippedToolMods: sim.equippedToolMods,
    equippedArmorMods: { ...sim.equippedArmorMods },
    hp: sim.hp,
    quests: Object.fromEntries(Object.entries(sim.quests.states).map(([id, st]) => [id, { ...st }])),
    worldFlags: [...sim.worldFlags],
    slayer: { ...sim.slayer.state },
    donatedRelics: [...sim.curator.donated],
    homePoint: sim.homePoint ? { regionId: sim.homePoint.regionId, cell: { ...sim.homePoint.cell } } : null,
    waypoints: sim.waypoints.map((w) => ({ ...w })),
    treasureHunt: sim.treasureHunt ? { ...sim.treasureHunt } : null,
    reputation: { ...sim.reputation },
    discoveredBiomes: [...sim.discoveredBiomes],
    trackedQuestId: sim.trackedQuestId,
    trackingMuted: sim.trackingMuted,
    attackStyle: sim.attackStyle,
    running: sim.running,
  };
}

export function applySharedState(sim: GameSimulation, shared: SharedState): void {
  for (const [skillId, xp] of Object.entries(shared.skills)) {
    {
      // XP saved under a since-merged skill folds into its new home.
      const home = SKILLS[skillId]?.mergedInto;
      if (home) sim.skills.xp[home] = (sim.skills.xp[home] ?? 0) + xp;
      else if (skillId in sim.skills.xp) sim.skills.xp[skillId] = xp;
    }
  }
  sim.inventory.slots = migrateSlots(shared.inventory);
  sim.equippedTool = shared.equippedTool;
  sim.equippedArmor = Object.assign({ head: null, body: null, legs: null, feet: null }, shared.equippedArmor);
  sim.equippedToolMods = shared.equippedToolMods ?? null;
  sim.equippedArmorMods = Object.assign(
    { head: null, body: null, legs: null, feet: null },
    shared.equippedArmorMods,
  );
  sim.hp = Math.max(1, Math.min(sim.maxHp(), shared.hp));
  for (const [id, st] of Object.entries(shared.quests)) {
    // Villager errands (vq.*) restore unconditionally: their defs register
    // lazily when the giver's chunk streams in, possibly after this load.
    if (sim.quests.states[id] || id.startsWith("vq.")) sim.quests.states[id] = { ...st };
  }
  for (const flag of shared.worldFlags ?? []) sim.setWorldFlag(flag);
  if (shared.slayer) sim.slayer.state = { ...shared.slayer };
  sim.curator.donated = new Set(shared.donatedRelics ?? []);
  if (shared.waypoints) sim.restoreWaypoints(shared.waypoints);
  if (shared.treasureHunt !== undefined) sim.treasureHunt = shared.treasureHunt ? { ...shared.treasureHunt } : null;
  if (shared.reputation) for (const [k, v] of Object.entries(shared.reputation)) if (k in sim.reputation) sim.reputation[k] = v;
  if (shared.discoveredBiomes) for (const b of shared.discoveredBiomes) sim.discoveredBiomes.add(b);
  if (shared.trackedQuestId !== undefined) sim.trackedQuestId = shared.trackedQuestId;
  if (typeof shared.trackingMuted === "boolean") sim.trackingMuted = shared.trackingMuted;
  if (isAttackStyle(shared.attackStyle)) sim.attackStyle = shared.attackStyle;
  if (typeof shared.running === "boolean") sim.running = shared.running;
  if (shared.homePoint !== undefined) {
    sim.homePoint = shared.homePoint
      ? { regionId: shared.homePoint.regionId, cell: { ...shared.homePoint.cell } }
      : null;
  }
}

/** Region the last save was made in, without constructing a simulation. */
export function peekRegionId(): string | null {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return null;
    const data = JSON.parse(json) as SaveDataV1;
    return data.currentRegionId ?? null;
  } catch {
    return null;
  }
}

export function serialize(
  sim: GameSimulation,
  otherRegions: Record<string, RegionSnapshot> = {},
): SaveDataV1 {
  const containers: Record<string, Slots> = {};
  for (const [id, inv] of sim.containers) containers[id] = inv.slots;
  return {
    save_format_version: SAVE_FORMAT_VERSION,
    updated_utc: new Date().toISOString(),
    player: { cell: sim.movement.currentCell(), facing: sim.movement.facing },
    timeS: sim.timeS,
    skills: { ...sim.skills.xp },
    inventory: sim.inventory.slots,
    equippedTool: sim.equippedTool,
    equippedArmor: { ...sim.equippedArmor },
    equippedToolMods: sim.equippedToolMods,
    equippedArmorMods: { ...sim.equippedArmorMods },
    containers,
    // Only non-default node state is meaningful, but persisting all is tiny at this scale.
    nodes: [...sim.nodes.instances.values()].map((n) => ({
      id: n.instanceId,
      phase: n.phase,
      remaining: n.remaining,
      respawnRemainingS: n.respawnRemainingS,
    })),
    quests: Object.fromEntries(
      Object.entries(sim.quests.states).map(([id, s]) => [id, { ...s }]),
    ),
    hp: sim.hp,
    enemies: [...sim.enemies.enemies.values()].map((e) => ({
      id: e.instanceId,
      hp: e.hp,
      phase: e.phase,
      respawnRemainingS: e.respawnRemainingS,
    })),
    currentRegionId: sim.world.region.id,
    otherRegions,
    worldFlags: [...sim.worldFlags],
    slayer: { ...sim.slayer.state },
    donatedRelics: [...sim.curator.donated],
    homePoint: sim.homePoint ? { regionId: sim.homePoint.regionId, cell: { ...sim.homePoint.cell } } : null,
    waypoints: sim.waypoints.map((w) => ({ ...w })),
    treasureHunt: sim.treasureHunt ? { ...sim.treasureHunt } : null,
    reputation: { ...sim.reputation },
    discoveredBiomes: [...sim.discoveredBiomes],
    trackedQuestId: sim.trackedQuestId,
    trackingMuted: sim.trackingMuted,
    attackStyle: sim.attackStyle,
    running: sim.running,
  };
}

/** Narrow an untrusted saved string to a valid AttackStyle. */
function isAttackStyle(v: unknown): v is import("../sim/types").AttackStyle {
  return v === "accurate" || v === "aggressive" || v === "defensive" || v === "controlled";
}

/**
 * Put the player back on a saved cell, or the region spawn if that cell is no
 * longer valid. Boat-aware: a cell on water is legitimate when the (already
 * restored) inventory yields a boat — otherwise a rower who saves mid-lake
 * would be dumped at spawn. Call AFTER inventory is restored.
 */
function restorePlayerPosition(sim: GameSimulation, cell: { x: number; z: number }, facing: number): void {
  const canBoat = sim.bestBoat() !== null;
  const ok = sim.world.walkable(cell, canBoat) && (canBoat || sim.world.heightAt(cell) >= 0);
  sim.movement.setCellPosition(ok ? cell : sim.world.region.spawn);
  sim.movement.facing = facing ?? 0;
}

export function applySave(sim: GameSimulation, data: SaveDataV1): void {
  // World flags first: they can repair terrain the player was standing on.
  for (const flag of data.worldFlags ?? []) sim.setWorldFlag(flag);
  if (data.waypoints) sim.restoreWaypoints(data.waypoints);
  if (data.treasureHunt !== undefined) sim.treasureHunt = data.treasureHunt ? { ...data.treasureHunt } : null;
  if (data.reputation) for (const [k, v] of Object.entries(data.reputation)) if (k in sim.reputation) sim.reputation[k] = v;
  if (data.discoveredBiomes) for (const b of data.discoveredBiomes) sim.discoveredBiomes.add(b);
  if (data.trackedQuestId !== undefined) sim.trackedQuestId = data.trackedQuestId;
  if (isAttackStyle(data.attackStyle)) sim.attackStyle = data.attackStyle;
  if (typeof data.running === "boolean") sim.running = data.running;
  for (const [skillId, xp] of Object.entries(data.skills)) {
    {
      // XP saved under a since-merged skill folds into its new home.
      const home = SKILLS[skillId]?.mergedInto;
      if (home) sim.skills.xp[home] = (sim.skills.xp[home] ?? 0) + xp;
      else if (skillId in sim.skills.xp) sim.skills.xp[skillId] = xp;
    }
  }
  // Saves from before the Attack/Defense split carry skill.combat: honor that
  // progress in both new skills (max HP previously came from Combat level).
  const legacyCombat = data.skills["skill.combat"];
  if (typeof legacyCombat === "number" && legacyCombat > 0) {
    sim.skills.xp["skill.attack"] = Math.max(sim.skills.xp["skill.attack"], legacyCombat);
    sim.skills.xp["skill.defense"] = Math.max(sim.skills.xp["skill.defense"], legacyCombat);
  }
  sim.inventory.slots = migrateSlots(data.inventory);
  sim.equippedTool = data.equippedTool;
  sim.equippedArmor = { head: null, body: null, legs: null, feet: null, ...(data.equippedArmor ?? {}) };
  sim.equippedToolMods = data.equippedToolMods ?? null;
  sim.equippedArmorMods = { head: null, body: null, legs: null, feet: null, ...(data.equippedArmorMods ?? {}) };
  // Position after inventory: a saved water cell is valid iff the restored
  // kit yields a boat. Map updates (a new river) still fall back to spawn.
  restorePlayerPosition(sim, data.player.cell, data.player.facing ?? 0);
  for (const [id, slots] of Object.entries(data.containers)) {
    const inv = sim.containers.get(id);
    if (inv) inv.slots = migrateSlots(slots);
  }
  for (const saved of data.nodes) {
    const node = sim.nodes.instances.get(saved.id);
    if (!node) continue; // node removed from region in an update: skip safely
    node.phase = saved.phase;
    node.remaining = saved.remaining;
    node.respawnRemainingS = saved.respawnRemainingS;
  }
  // Older saves have no quest block: quests stay at their fresh defaults.
  for (const [id, saved] of Object.entries(data.quests ?? {})) {
    // Villager errands (vq.*) restore unconditionally: their defs register
    // lazily when the giver's chunk streams in, possibly after this load.
    if (sim.quests.states[id] || id.startsWith("vq.")) sim.quests.states[id] = { ...saved };
  }
  if (typeof data.hp === "number") {
    sim.hp = Math.max(1, Math.min(sim.maxHp(), data.hp));
  }
  if (typeof data.timeS === "number" && Number.isFinite(data.timeS)) {
    sim.timeS = Math.max(0, data.timeS);
  }
  for (const saved of data.enemies ?? []) {
    const enemy = sim.enemies.get(saved.id);
    if (!enemy) continue;
    enemy.hp = saved.hp;
    enemy.phase = saved.phase;
    enemy.respawnRemainingS = saved.respawnRemainingS;
  }
  if (data.slayer) sim.slayer.state = { ...data.slayer };
  sim.curator.donated = new Set(data.donatedRelics ?? []);
  if (data.homePoint) {
    sim.homePoint = { regionId: data.homePoint.regionId, cell: { ...data.homePoint.cell } };
  }
  ensureSeedItems(sim);
}

/**
 * Container seed items (starter tools) added to the region after a save was
 * created would otherwise be lost — the save restores the old (empty) chest.
 * Re-grant any seed item that exists nowhere in the world state.
 */
function ensureSeedItems(sim: GameSimulation): void {
  for (const obj of sim.world.region.objects) {
    const container = sim.containers.get(obj.instanceId);
    if (!container || !obj.initialItems) continue;
    for (const seed of obj.initialItems) {
      let count = sim.inventory.count(seed.itemId) + (sim.equippedTool === seed.itemId ? 1 : 0);
      for (const other of sim.containers.values()) count += other.count(seed.itemId);
      if (count === 0) container.add(seed.itemId, seed.qty);
    }
  }
}

function migrate(raw: Record<string, unknown>): SaveDataV1 | null {
  const version = raw["save_format_version"];
  if (version === SAVE_FORMAT_VERSION) return raw as unknown as SaveDataV1;
  // Future: chain migrate_1_to_2 etc. Unknown newer versions are refused.
  return null;
}

export function saveToStorage(
  sim: GameSimulation,
  otherRegions: Record<string, RegionSnapshot> = {},
): boolean {
  try {
    const json = JSON.stringify(serialize(sim, otherRegions));
    const previous = localStorage.getItem(SAVE_KEY);
    if (previous) localStorage.setItem(BACKUP_KEY, previous);
    localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(
  sim: GameSimulation,
  otherRegionsOut?: Record<string, RegionSnapshot>,
): boolean {
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    try {
      const json = localStorage.getItem(key);
      if (!json) continue;
      const data = migrate(JSON.parse(json));
      if (!data) continue;
      applySave(sim, data);
      if (otherRegionsOut) Object.assign(otherRegionsOut, data.otherRegions ?? {});
      return true;
    } catch {
      // Corrupt entry: fall through to the backup, never crash the boot.
    }
  }
  return false;
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(BACKUP_KEY);
}

// ---------------------------------------------------------------------------
// Endless-world saves. The world itself is a pure function of the seed, so we
// only persist the seed plus the player's own state (skills, inventory, time,
// bed) and any container they've touched. Felled trees and slain beasts in
// streamed chunks regrow on reload — a Phase-1 limitation until per-chunk
// diffs land.
// ---------------------------------------------------------------------------

// The "last played" pointer (kept for back-compat and peekEndlessSeed), plus a
// per-seed key so several worlds can be saved and picked from the start screen.
const ENDLESS_KEY = "stoneleaf.endless.slot0";
const ENDLESS_WORLD_PREFIX = "stoneleaf.endless.world.";
const endlessWorldKey = (seed: number): string => `${ENDLESS_WORLD_PREFIX}${seed}`;

interface EndlessSaveData {
  save_format_version: number;
  endless: true;
  seed: number;
  updated_utc: string;
  player: { cell: { x: number; z: number }; facing: number };
  timeS: number;
  shared: SharedState;
  containers: Record<string, Slots>;
  /** Region the save was made in. Absent/endless = the boundless overworld;
   *  "region.tutorial" = mid-tutorial (Continue re-enters the island with all
   *  quest/skill/pack progress intact instead of losing the run). */
  region?: string;
  /** Explored 16-cell tiles (packed keys) — the map's fog of war. */
  explored?: number[];
}

/** A lightweight summary of a saved world, for the "continue" list. */
export interface EndlessWorldInfo {
  seed: number;
  updatedUtc: string;
  day: number;
}

/** The seed of the last-played endless world, or null if there is none. */
export function peekEndlessSeed(): number | null {
  try {
    const json = localStorage.getItem(ENDLESS_KEY);
    if (!json) return null;
    const data = JSON.parse(json) as EndlessSaveData;
    return data.endless && Number.isFinite(data.seed) ? data.seed : null;
  } catch {
    return null;
  }
}

/** Every saved endless world, newest first — for the start screen's world list. */
export function listEndlessWorlds(): EndlessWorldInfo[] {
  const bySeed = new Map<number, EndlessWorldInfo>();
  const consider = (json: string | null) => {
    if (!json) return;
    try {
      const d = JSON.parse(json) as EndlessSaveData;
      if (!d.endless || !Number.isFinite(d.seed)) return;
      const info: EndlessWorldInfo = {
        seed: d.seed,
        updatedUtc: d.updated_utc ?? "",
        day: Math.floor((d.timeS ?? 0) / 1200) + 1,
      };
      const prev = bySeed.get(d.seed);
      if (!prev || info.updatedUtc > prev.updatedUtc) bySeed.set(d.seed, info);
    } catch {
      // skip an unreadable slot
    }
  };
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(ENDLESS_WORLD_PREFIX)) consider(localStorage.getItem(key));
    }
    consider(localStorage.getItem(ENDLESS_KEY)); // migrate the legacy single slot into the list
  } catch {
    // storage unavailable — return whatever we gathered
  }
  return [...bySeed.values()].sort((a, b) => (a.updatedUtc < b.updatedUtc ? 1 : -1));
}

/** Delete one saved world (and clear the last-played pointer if it matches). */
export function deleteEndlessWorld(seed: number): void {
  try {
    localStorage.removeItem(endlessWorldKey(seed));
    if (peekEndlessSeed() === seed) localStorage.removeItem(ENDLESS_KEY);
  } catch {
    // ignore
  }
}

export function saveEndlessToStorage(
  sim: GameSimulation,
  slotSeed?: number,
  regionId?: string,
  cellOverride?: { x: number; z: number },
): boolean {
  try {
    const containers: Record<string, Slots> = {};
    for (const [id, inv] of sim.containers) containers[id] = inv.slots;
    // Mid-tutorial the sim's own seed is the fixed tutorial seed; the slot is
    // keyed by the WORLD's seed (the one the player will graduate into), so
    // the save lands in — and resumes from — their world's slot.
    // cellOverride: mid-dungeon saves anchor at the surface entrance (dungeon
    // floors are transient), so a refresh resumes at the dungeon door with
    // everything earned so far instead of losing the run.
    const worldSeed = slotSeed ?? sim.seed;
    const data: EndlessSaveData = {
      save_format_version: SAVE_FORMAT_VERSION,
      endless: true,
      seed: worldSeed,
      updated_utc: new Date().toISOString(),
      player: { cell: cellOverride ?? sim.movement.currentCell(), facing: sim.movement.facing },
      timeS: sim.timeS,
      shared: captureSharedState(sim),
      containers,
      region: regionId ?? "region.endless",
      explored: [...sim.explored],
    };
    const json = JSON.stringify(data);
    localStorage.setItem(endlessWorldKey(worldSeed), json); // this world's own slot
    localStorage.setItem(ENDLESS_KEY, json);                // last-played pointer
    return true;
  } catch {
    return false;
  }
}

/** Region a saved world was last played in ("region.tutorial" mid-tutorial). */
export function peekEndlessRegion(seed: number): string | null {
  try {
    const json = localStorage.getItem(endlessWorldKey(seed)) ?? localStorage.getItem(ENDLESS_KEY);
    if (!json) return null;
    const data = JSON.parse(json) as EndlessSaveData;
    if (!data.endless || data.seed !== seed) return null;
    return data.region ?? "region.endless";
  } catch {
    return null;
  }
}

/** Restore player state onto a freshly created endless (or tutorial) sim.
 *  `slotSeed` overrides which world slot to read — required when resuming the
 *  tutorial, whose sim seed is the fixed tutorial seed, not the world's. */
export function loadEndlessFromStorage(sim: GameSimulation, slotSeed?: number): boolean {
  try {
    const worldSeed = slotSeed ?? sim.seed;
    const json =
      localStorage.getItem(endlessWorldKey(worldSeed)) ??
      localStorage.getItem(ENDLESS_KEY); // fall back to the legacy single slot
    if (!json) return false;
    const data = JSON.parse(json) as EndlessSaveData;
    if (!data.endless || data.seed !== worldSeed) return false;
    applySharedState(sim, data.shared);
    for (const [id, slots] of Object.entries(data.containers ?? {})) {
      const inv = sim.containers.get(id);
      if (inv) inv.slots = migrateSlots(slots);
    }
    if (typeof data.timeS === "number" && Number.isFinite(data.timeS)) {
      sim.timeS = Math.max(0, data.timeS);
    }
    if (Array.isArray(data.explored)) sim.explored = new Set(data.explored);
    // Shared state (incl. inventory) is already applied above, so a boat in
    // the kit legitimises a saved position out on the water.
    restorePlayerPosition(sim, data.player.cell, data.player.facing ?? 0);
    ensureSeedItems(sim);
    return true;
  } catch {
    return false;
  }
}

export function clearEndlessSave(): void {
  localStorage.removeItem(ENDLESS_KEY);
}
