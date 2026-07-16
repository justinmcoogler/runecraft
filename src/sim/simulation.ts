// GameSimulation: owns all authoritative state, consumes Commands once per fixed
// tick, emits SimEvents. No engine or DOM imports — fully testable headless.

import { ALCHEMY, ALCH_VALUES, ITEMS, OBJECTS, PLAYER_COMBAT, QUESTS, SHOPS, TUTORIAL_ORDER, ZONES, type ShopDef } from "../content/content";
import { getStructure } from "../content/structures";
import { effectiveSink, walkableSurfaces, solidColumns } from "../structures/types";
import { lobbyWalk, LOBBY_W, LOBBY_D, LOBBY_SINK, LOBBY_TILE } from "../content/structures/lobby";
import { ActionController } from "./actions";
import { EnemySystem } from "./enemies";
import { GroundItemSystem } from "./ground-items";
import { Inventory, transferSlot } from "./inventory";
import { MovementController } from "./movement";
import { findPath } from "./pathfinding";
import { TutorialDriver } from "./tutorial";
import { ResourceNodeSystem } from "./nodes";
import { NpcSystem } from "./npc";
import { QuestService } from "./quests";
import { SkillService } from "./skills";
import { ChunkManager } from "./chunk-manager";
import { DANGER_MOBS, dangerTier, EndlessTerrain, inStarterTown, remoteness01, setValeActive, starterTownRegion, terrainAt, tutorialRegion } from "./worldgen/endless";
import { biomeName } from "./worldgen/biomes";
import { DUNGEON_ID_RE, type DungeonStyle, dungeonSpecFor } from "./worldgen/dungeons";
import { CuratorService, SlayerService } from "./taskmasters";
import type { ArmorSlot, AttackStyle, Cell, Command, SimEvent } from "./types";
import { chebyshev, SimEventBus, SimRng, TICK_DT } from "./types";
import { applyWorldFlags, WorldState, type RegionSpec } from "./world";

export const PLAYER_INVENTORY_SLOTS = 20;

/** One full in-game day in real seconds (20 minutes, Minecraft's pace). */
export const DAY_LENGTH_S = 1200;
/** Weather holds for spells of this many seconds, then rerolls. */
export const WEATHER_SPELL_S = 240;
/** How long a door stays open after it's clicked before swinging shut. */
const DOOR_OPEN_S = 12;

// Stamina/run tuning. Full stamina buys ~8s of sprinting; a rest refills it in
// ~13s. After bottoming out you must recover to STAMINA_RECOVER before running.
const STAMINA_MAX = 100;
const STAMINA_DRAIN = 12; // per second while running
const STAMINA_REGEN = 8; // per second while walking/idle
const STAMINA_RECOVER = 25; // must climb back to this after exhaustion
const WALK_SPEED = 3.5;
const RUN_SPEED = 5.6;

export type WeatherKind = "clear" | "overcast" | "rain" | "storm";

/** In-game days per season; four seasons make a twelve-day year. */
export const DAYS_PER_SEASON = 3;
export type Season = "spring" | "summer" | "autumn" | "winter";
const SEASON_ORDER: Season[] = ["spring", "summer", "autumn", "winter"];
export interface SeasonInfo {
  season: Season;
  label: string;
  /** 0..1 through this season. */
  progress: number;
  /** A foliage/sky tint the renderer leans the outdoors toward. */
  tint: string;
  /** True in the cold season: precipitation falls as snow anywhere. */
  cold: boolean;
  /** Fraction of clear skies this season leans toward (weather bias). */
  clearBias: number;
}
const SEASON_DATA: Record<Season, { label: string; tint: string; cold: boolean; clearBias: number }> = {
  spring: { label: "Spring", tint: "#bfe08a", cold: false, clearBias: 0.70 },
  summer: { label: "Summer", tint: "#ffe9a8", cold: false, clearBias: 0.80 },
  autumn: { label: "Autumn", tint: "#e0a45a", cold: false, clearBias: 0.60 },
  winter: { label: "Winter", tint: "#cfe0ec", cold: true, clearBias: 0.52 },
};

/** The great factions of the wild. Deeds build renown with each — conquering
 *  crypts pleases the Wardens, treasure the Free Companies, quiet old places the
 *  Grove — and reaching a new rank pays a standing reward. */
export interface Faction { id: string; name: string; blurb: string; }
export const FACTIONS: Record<string, Faction> = {
  order: { id: "order", name: "Wardens of the Reach", blurb: "Knights who hold the deep places at bay." },
  guild: { id: "guild", name: "Free Companies", blurb: "Traders, caravans and treasure-seekers." },
  grove: { id: "grove", name: "Keepers of the Grove", blurb: "Wardens of ruins, stones and old ways." },
};
/** Renown thresholds and their titles (shared across factions). */
export const REP_RANKS = [
  { at: 0, name: "Unknown" },
  { at: 40, name: "Recognised" },
  { at: 120, name: "Friendly" },
  { at: 260, name: "Trusted" },
  { at: 500, name: "Honoured" },
  { at: 900, name: "Exalted" },
];
function rankOf(standing: number): number {
  let r = 0;
  for (let i = 0; i < REP_RANKS.length; i++) if (standing >= REP_RANKS[i].at) r = i;
  return r;
}

export class GameSimulation {
  readonly world: WorldState;
  readonly events = new SimEventBus();
  readonly rng: SimRng;
  readonly skills: SkillService;
  readonly inventory: Inventory;
  readonly containers = new Map<string, Inventory>();
  readonly movement = new MovementController();
  readonly nodes: ResourceNodeSystem;
  readonly npcs: NpcSystem;
  readonly quests: QuestService;
  readonly enemies: EnemySystem;
  readonly groundItems: GroundItemSystem;
  readonly actions: ActionController;
  readonly slayer: SlayerService;
  readonly curator: CuratorService;
  equippedTool: string | null = null;
  equippedArmor: Record<ArmorSlot, string | null> = { head: null, body: null, legs: null, feet: null };
  /** Persistent world-state flags (repaired bridges, stabilized anchors…). */
  readonly worldFlags = new Set<string>();
  /** Discovered endless-world landmarks the player can fast-travel between. */
  readonly waypoints: Array<{ id: string; name: string; x: number; z: number }> = [];
  /** The buried cache the player's current treasure map points to, if any. */
  treasureHunt: { x: number; z: number } | null = null;
  /** Renown with each great faction (see FACTIONS). Persisted. */
  readonly reputation: Record<string, number> = { order: 0, guild: 0, grove: 0 };
  /** Named biomes the player has ever set foot in (persisted catalogue). */
  readonly discoveredBiomes = new Set<string>();
  /** The named biome the player currently stands in (transient). */
  private currentBiomeName = "";
  /** Which quest the player has pinned to track (guidance line + map marker).
   *  Null falls back to the first active quest. Persisted. */
  trackedQuestId: string | null = null;
  /** RuneScape-style melee attack style: routes combat XP to Attack / Strength
   *  / Defense (Controlled splits three ways). Persisted. */
  attackStyle: AttackStyle = "accurate";
  /** Run/walk toggle (persisted). When running and stamina remains, the player
   *  moves faster and stamina drains; otherwise it regenerates. */
  running = true;
  /** Current stamina 0..maxStamina (transient — refills on load). */
  stamina = STAMINA_MAX;
  readonly maxStamina = STAMINA_MAX;
  /** True once stamina bottoms out, until it recovers past a threshold (a short
   *  "catch your breath" before you can sprint again). */
  private exhausted = false;
  /** Tutorial lesson driver (present only in the tutorial region). */
  tutorial: TutorialDriver | null = null;
  /** Timed potion effects: kind -> seconds remaining. */
  buffs: Record<string, number> = {};
  /** Seconds of wild travel left before the next roaming world event may fire. */
  private worldEventCdS = 90;
  hp: number;
  readonly seed: number;
  tickCount = 0;
  /** World clock in seconds; starts mid-morning of day one. */
  timeS = DAY_LENGTH_S * 0.35;
  private queue: Command[] = [];
  private sinceDamageS = 999;
  private regenAccumS = 0;
  /** The named zone the player last stood in (world zones only). */
  private currentZoneId: string | null = null;

  /**
   * Respawn point set by sleeping in a bed: the region it lives in and the
   * bed's cell. Death returns the player here — travelling back across
   * regions if they died in a dungeon far from home.
   */
  homePoint: { regionId: string; cell: Cell } | null = null;

  /** Doors the player has opened: instanceId -> {cell, seconds until it swings
   *  shut}. An open door's nav blocker is lifted so the player walks through. */
  private openDoors = new Map<string, { cell: Cell; footprint: Cell[]; remainS: number }>();

  /** Present only in endless worlds: streams chunk entities as you move. */
  chunks: ChunkManager | null = null;
  /** Optional client veto on streamed enemy spawns (model preferences). */
  spawnFilter: ((defId: string) => boolean) | null = null;

  constructor(region: RegionSpec, seed = 1, terrain?: import("./world").TerrainSource, inventorySlots = PLAYER_INVENTORY_SLOTS) {
    this.seed = seed;
    this.rng = new SimRng(seed);
    this.inventory = new Inventory(inventorySlots);
    this.world = new WorldState(region, terrain);
    this.skills = new SkillService(this.events);
    this.nodes = new ResourceNodeSystem(this.world, this.events, this.rng);
    for (const obj of region.objects) {
      const def = OBJECTS[obj.defId];
      if (def.containerSlots) {
        const container = new Inventory(def.containerSlots);
        for (const seed of obj.initialItems ?? []) container.add(seed.itemId, seed.qty);
        this.seedRandomLoot(container, def);
        this.containers.set(obj.instanceId, container);
      }
      if (def.blocksNav) {
        this.world.registerBlocker(obj.instanceId, obj.cell);
        for (const cell of obj.footprint ?? []) this.world.registerBlocker(obj.instanceId, cell);
      }
    }
    for (const placement of region.structures ?? []) this.registerStructureBlockers(placement);
    this.applyLobbyWalkMap();
    // The hub centre can be a pool or planter; drop the player on the nearest
    // walkable plaza cell so they never wake stuck in a wall or water.
    if (!this.world.walkable(region.spawn)) {
      const safe = this.world.nearestWalkable(region.spawn, 40);
      if (safe) region.spawn = safe;
    }
    this.movement.setCellPosition(region.spawn);
    this.npcs = new NpcSystem(this.world, this.rng);
    this.enemies = new EnemySystem(
      {
        world: this.world,
        events: this.events,
        getPlayerCell: () => this.movement.currentCell(),
        isPlayerAlive: () => this.hp > 0,
        getDefenseLevel: () => this.skills.levelOf("skill.defense"),
        damagePlayer: (amount) => this.damagePlayer(amount),
        spawnGroundItem: (cell, itemId, qty) => this.spawnGroundItem(cell, itemId, qty),
      },
      this.rng,
    );
    this.groundItems = new GroundItemSystem({
      getPlayerCell: () => this.movement.currentCell(),
      isPlayerAlive: () => this.hp > 0,
      tryPickup: (itemId, qty) => this.tryPickupGround(itemId, qty),
    });
    this.actions = new ActionController({
      world: this.world,
      nodes: this.nodes,
      npcs: this.npcs,
      movement: this.movement,
      inventory: this.inventory,
      skills: this.skills,
      events: this.events,
      rng: this.rng,
      hasTool: (tags) => this.hasTool(tags),
      toolBonus: (tags) => this.toolBonus(tags),
      enemies: this.enemies,
      groundItems: this.groundItems,
      spawnGroundItem: (cell, itemId, qty) => this.spawnGroundItem(cell, itemId, qty),
      attackLevel: () => this.skills.levelOf(this.combatSkillId()),
      weaponBonus: () =>
        (this.equippedTool ? ITEMS[this.equippedTool].damageBonus ?? 0 : 0) +
        (this.buffs["strength"] > 0 ? 2 : 0),
      weaponRange: () => (this.hasBowEquipped() ? 5 : 1),
      combatSkillId: () => this.combatSkillId(),
      awardCombatXp: (amount) => this.awardCombatXp(amount),
      setWorldFlag: (flag) => this.setWorldFlag(flag),
      buffBonus: (kind) => (this.buffs[kind] > 0 ? 0.08 : 0),
      damagePlayer: (amount) => this.damagePlayer(amount),
      sleepAt: (cell) => this.sleepAt(cell),
      canBoat: () => this.bestBoat() !== null,
      openDoor: (id) => this.openDoor(id),
    });
    this.slayer = new SlayerService({
      events: this.events,
      skills: this.skills,
      inventory: this.inventory,
      enemies: this.enemies,
    });
    this.curator = new CuratorService({
      events: this.events,
      skills: this.skills,
      inventory: this.inventory,
    });
    this.hp = this.maxHp();
    // Starter kit: the basic axe, equipped.
    this.equippedTool = "tool.axe.basic";
    this.quests = new QuestService({
      inventory: this.inventory,
      skills: this.skills,
      events: this.events,
      hasEquippedTag: (tag) =>
        this.equippedTool !== null && (ITEMS[this.equippedTool].toolTags ?? []).includes(tag),
      enemyDefOf: (instanceId) => this.enemies.get(instanceId)?.defId,
    });
  }

  /** Drop a stack on the ground at a cell (overflow loot, laid eggs). */
  spawnGroundItem(cell: Cell, itemId: string, qty: number): void {
    if (qty <= 0 || !ITEMS[itemId]) return;
    this.groundItems.spawn(itemId, qty, cell);
  }

  /** Auto-pickup callback for the ground-item system: takes the stack if it
   *  fits, mirroring a normal itemGained so the HUD toast + sfx fire. */
  private tryPickupGround(itemId: string, qty: number): boolean {
    if (!this.inventory.canAdd(itemId, qty)) return false;
    this.inventory.add(itemId, qty);
    this.events.emit({ type: "itemGained", itemId, qty });
    this.events.emit({ type: "inventoryChanged" });
    return true;
  }

  hasBowEquipped(): boolean {
    return this.equippedTool !== null && (ITEMS[this.equippedTool].toolTags ?? []).includes("bow");
  }

  /** Bow work trains Archery; everything else trains Attack. */
  combatSkillId(): string {
    return this.hasBowEquipped() ? "skill.archery" : "skill.attack";
  }

  /** Route a lump of combat XP by the current attack style (RuneScape-style).
   *  A bow always trains Archery; melee feeds Attack / Strength / Defense per
   *  the chosen style (Controlled splits three ways). Constitution always takes
   *  a share, as Hitpoints does in RuneScape. This is the ONLY place combat XP
   *  is handed out — melee no longer double-dips Attack + Strength. */
  awardCombatXp(amount: number): void {
    if (amount <= 0) return;
    if (this.hasBowEquipped()) {
      this.skills.grantXp("skill.archery", amount);
    } else {
      switch (this.attackStyle) {
        case "aggressive": this.skills.grantXp("skill.strength", amount); break;
        case "defensive": this.skills.grantXp("skill.defense", amount); break;
        case "controlled":
          this.skills.grantXp("skill.attack", amount / 3);
          this.skills.grantXp("skill.strength", amount / 3);
          this.skills.grantXp("skill.defense", amount / 3);
          break;
        default: this.skills.grantXp("skill.attack", amount); break;
      }
    }
    // Hitpoints (Constitution) always trains from damage dealt.
    this.skills.grantXp("skill.constitution", Math.max(1, Math.round(amount * 0.5)));
  }

  /** Cycle to the next attack style and return the new one. */
  cycleAttackStyle(): AttackStyle {
    const order: AttackStyle[] = ["accurate", "aggressive", "defensive", "controlled"];
    this.attackStyle = order[(order.indexOf(this.attackStyle) + 1) % order.length];
    return this.attackStyle;
  }

  private regenStamina(): void {
    this.stamina = Math.min(this.maxStamina, this.stamina + STAMINA_REGEN * TICK_DT);
  }

  /** Fraction of stamina remaining (0..1) for the HUD bar. */
  staminaFrac(): number {
    return this.maxStamina > 0 ? this.stamina / this.maxStamina : 0;
  }

  /** Flip the run/walk toggle; returns the new running state. */
  toggleRun(): boolean {
    this.running = !this.running;
    return this.running;
  }

  /** The best boat the player can currently handle (carried or equipped),
   *  by hull speed and Boating level — or null if they have none usable. */
  bestBoat(): { itemId: string; speed: number } | null {
    const level = this.skills.levelOf("skill.boating");
    let best: { itemId: string; speed: number } | null = null;
    const consider = (itemId: string | null) => {
      if (!itemId) return;
      const boat = ITEMS[itemId]?.boat;
      if (!boat || boat.level > level) return;
      if (!best || boat.speed > best.speed) best = { itemId, speed: boat.speed };
    };
    consider(this.equippedTool);
    for (const s of this.inventory.slots) if (s) consider(s.itemId);
    return best;
  }

  /** Open a door: lift its nav blocker so the player can walk through, and
   *  arm a timer to swing it shut again once they're clear. */
  openDoor(instanceId: string): void {
    const already = this.openDoors.get(instanceId);
    if (already) {
      // Re-click toggles it shut — unless you're standing in the doorway, in
      // which case hold it open so you're never trapped in a closing frame.
      const here = this.movement.currentCell();
      const cells = [already.cell, ...already.footprint];
      if (cells.some((c) => cellsMatch(c, here))) { already.remainS = DOOR_OPEN_S; return; }
      for (const cell of cells) this.world.registerBlocker(instanceId, cell);
      this.openDoors.delete(instanceId);
      this.events.emit({ type: "doorClosed", instanceId, cell: already.cell });
      return;
    }
    const obj = this.world.region.objects.find((o) => o.instanceId === instanceId);
    if (!obj) return;
    const cells = [obj.cell, ...(obj.footprint ?? [])];
    for (const cell of cells) {
      if (this.world.blockerAt(cell) === instanceId) this.world.unregisterBlocker(cell);
    }
    this.openDoors.set(instanceId, { cell: obj.cell, footprint: obj.footprint ?? [], remainS: DOOR_OPEN_S });
    this.events.emit({ type: "doorOpened", instanceId, cell: obj.cell });
  }

  /** Tick open doors; swing shut once the timer lapses and no one blocks the
   *  doorway (never trap the player inside a re-closing frame). */
  private tickDoors(): void {
    if (this.openDoors.size === 0) return;
    const here = this.movement.currentCell();
    for (const [id, door] of [...this.openDoors]) {
      door.remainS -= TICK_DT;
      if (door.remainS > 0) continue;
      const cells = [door.cell, ...door.footprint];
      if (cells.some((c) => cellsMatch(c, here))) continue; // stand clear first
      for (const cell of cells) this.world.registerBlocker(id, cell);
      this.openDoors.delete(id);
      this.events.emit({ type: "doorClosed", instanceId: id, cell: door.cell });
    }
  }

  /** True while the player is floating on a water cell in a boat. */
  isBoating(): boolean {
    return this.bestBoat() !== null && this.world.blockAt(this.movement.currentCell()) === "water";
  }

  /** Tool check policy (MVP): equipped slot OR anywhere in the inventory. */
  hasTool(tags: string[]): boolean {
    if (this.equippedTool && ITEMS[this.equippedTool].toolTags?.some((t) => tags.includes(t))) {
      return true;
    }
    return tags.some((tag) => this.inventory.firstSlotWithTag(tag) >= 0);
  }

  maxHp(): number {
    return (
      PLAYER_COMBAT.baseHealth +
      PLAYER_COMBAT.healthPerDefenseLevel * (this.skills.levelOf("skill.defense") - 1) +
      PLAYER_COMBAT.healthPerConstLevel * (this.skills.levelOf("skill.constitution") - 1)
    );
  }

  /** Total incoming-damage reduction from worn armor (capped: never immune). */
  protection(): number {
    let total = this.buffs["stoneskin"] > 0 ? 0.15 : 0;
    for (const itemId of Object.values(this.equippedArmor)) {
      if (itemId) total += ITEMS[itemId].protection ?? 0;
    }
    // Cap leaves headroom above a full bronze set (0.60) so the iron tier (and
    // its boots slot) is a real upgrade, while never granting immunity.
    return Math.min(0.75, total);
  }

  damagePlayer(amount: number): void {
    if (this.hp <= 0) return;
    // Armor soaks a fraction, but a landed hit always stings for at least 1.
    amount = Math.max(1, Math.round(amount * (1 - this.protection())));
    this.hp = Math.max(0, this.hp - amount);
    this.sinceDamageS = 0;
    // Taking punishment is how Defense is learned.
    this.skills.grantXp("skill.defense", amount * PLAYER_COMBAT.defense.xpPerDamageTaken);
    this.events.emit({ type: "healthChanged", hp: this.hp, maxHp: this.maxHp() });
    if (this.hp === 0) {
      // Black out: wake at full health, inventory intact — at your bed if you
      // set one, otherwise the region spawn.
      this.events.emit({ type: "playerDied" });
      this.actions.cancel();
      this.enemies.disengageAll();
      this.hp = this.maxHp();
      const home = this.homePoint;
      if (home && home.regionId !== this.world.region.id) {
        // Died far from home (a dungeon): the app shell walks us back to the
        // bed's region; position there is set on arrival.
        this.events.emit({ type: "respawnTravel", targetRegionId: home.regionId, targetCell: home.cell });
      } else {
        const dest =
          home && this.world.walkable(home.cell) && this.world.heightAt(home.cell) >= 0
            ? home.cell
            : this.world.region.spawn;
        this.movement.setCellPosition(dest);
      }
      this.events.emit({ type: "healthChanged", hp: this.hp, maxHp: this.maxHp() });
    }
  }

  /**
   * Sleep in a bed: remember this spot as the respawn point. The bed cell
   * itself blocks nav, so we land on the walkable cell the player is standing
   * on beside it. At night we sleep through to dawn; by day it's just a rest
   * that sets the spawn without skipping the clock.
   */
  sleepAt(cell: Cell): void {
    const landing = this.movement.currentCell();
    this.homePoint = { regionId: this.world.region.id, cell: { ...landing } };
    this.movement.faceToward(cell);
    const DAWN = 6 / 24; // 06:00
    const DUSK = 20.5 / 24; // 20:30 — matches daylight()'s dusk shoulder
    const frac = this.dayFrac();
    const night = frac < DAWN || frac >= DUSK;
    if (night) {
      const dayStart = this.timeS - frac * DAY_LENGTH_S;
      // Next dawn: today's if night has just fallen after midnight, else tomorrow's.
      const target = frac < DAWN ? dayStart + DAWN * DAY_LENGTH_S : dayStart + (1 + DAWN) * DAY_LENGTH_S;
      this.timeS = target;
    }
    this.events.emit({ type: "playerSlept", cell: { ...cell }, restedTillDawn: night });
  }

  /** Best success bonus among matching tools (equipped or carried). */
  toolBonus(tags: string[]): number {
    let best = 0;
    const consider = (itemId: string | null) => {
      if (!itemId) return;
      const def = ITEMS[itemId];
      if (def.toolTags?.some((t) => tags.includes(t))) {
        best = Math.max(best, def.successBonus ?? 0);
      }
    };
    consider(this.equippedTool);
    for (const s of this.inventory.slots) if (s) consider(s.itemId);
    return best;
  }

  enqueue(command: Command): void {
    this.queue.push(command);
  }

  /** Advance exactly one fixed tick; returns the events it produced. */
  /** The lobby hub is streamed as render-only tiles; its walkability comes from
   *  one baked global walk-map (per-tile flood-fill can't seed on a carved tile),
   *  applied once here at the tiles' shared min corner. */
  private applyLobbyWalkMap(): void {
    const tiles = (this.world.region.structures ?? []).filter((s) => s.structureId.startsWith("lobby."));
    if (tiles.length === 0) return;
    // Anchor at the true hub origin (bbox corner), not the first non-empty tile:
    // a circular hub leaves the corner tiles empty, so derive the origin from a
    // tile's encoded grid coords (cell = origin + gridIndex * LOBBY_TILE).
    let minX = Infinity, minZ = Infinity;
    for (const t of tiles) {
      const m = /^lobby\.t_(\d+)_(\d+)$/.exec(t.structureId);
      if (!m) continue;
      minX = Math.min(minX, t.cell.x - +m[1] * LOBBY_TILE);
      minZ = Math.min(minZ, t.cell.z - +m[2] * LOBBY_TILE);
    }
    if (!Number.isFinite(minX)) return;
    const base = this.world.heightAt({ x: minX, z: minZ }) - LOBBY_SINK;
    const codes = lobbyWalk();
    for (let z = 0; z < LOBBY_D; z++) {
      for (let x = 0; x < LOBBY_W; x++) {
        const code = codes[z * LOBBY_W + x];
        if (code === 0) continue; // natural ground — leave it walkable terrain
        const cell = { x: minX + x, z: minZ + z };
        if (code === 255) { this.world.registerBlocker("town.lobby", cell); continue; }
        const surf = base + code;
        if (surf !== this.world.heightAt(cell)) this.world.setSurface(cell, surf);
      }
    }
  }

  private registerStructureBlockers(placement: { instanceId: string; structureId: string; cell: { x: number; z: number }; solid?: boolean }): void {
    // Lobby tiles carry no per-tile collision — their walkability is the global
    // walk-map applied in applyLobbyWalkMap(); here they're render-only.
    if (placement.structureId.startsWith("lobby.")) return;
    const asset = getStructure(placement.structureId);
    if (!asset) return;
    // A solid landmark blocks its whole built mass — you walk around it and
    // enter through its door-portal, never over the flattened shell.
    if (placement.solid) {
      for (const col of solidColumns(asset)) {
        this.world.registerBlocker(placement.instanceId, {
          x: placement.cell.x + col.x,
          z: placement.cell.z + col.z,
        });
      }
      return;
    }
    // Give the build a walkable surface profile (floors/steps climb like
    // Minecraft blocks); solid cells the fill can't reach become wall blockers.
    const { surfaces, blocked } = walkableSurfaces(asset);
    const base = this.world.heightAt(placement.cell) - effectiveSink(asset);
    for (const s of surfaces) {
      this.world.setSurface({ x: placement.cell.x + s.x, z: placement.cell.z + s.z }, base + s.top);
    }
    for (const col of blocked) {
      this.world.registerBlocker(placement.instanceId, {
        x: placement.cell.x + col.x,
        z: placement.cell.z + col.z,
      });
    }
  }

  // ---------- world editor (live placement of imported structures) ----------

  /** Place a scenery structure (building) live. Every placed building is a
   *  solid landmark you click to enter (walk to the yard, step inside) — never
   *  a walkable shell — so all houses behave the same. */
  addEditorStructure(placement: { instanceId: string; structureId: string; cell: { x: number; z: number }; solid?: boolean }): void {
    const solid = { ...placement, solid: true };
    (this.world.region.structures ??= []).push(solid);
    this.registerStructureBlockers(solid);
  }

  /** Remove a placed structure and free its blocked cells. */
  removeEditorStructure(instanceId: string): boolean {
    const list = this.world.region.structures ?? [];
    const index = list.findIndex((s) => s.instanceId === instanceId);
    if (index < 0) return false;
    const placement = list[index];
    const asset = getStructure(placement.structureId);
    if (asset) {
      if (placement.solid) {
        // Solid landmark: its whole mass was blocked (solidColumns) — free it.
        for (const col of solidColumns(asset)) {
          const cell = { x: placement.cell.x + col.x, z: placement.cell.z + col.z };
          if (this.world.blockerAt(cell) === instanceId) this.world.unregisterBlocker(cell);
        }
      } else {
        const { surfaces, blocked } = walkableSurfaces(asset);
        for (const col of blocked) {
          const cell = { x: placement.cell.x + col.x, z: placement.cell.z + col.z };
          if (this.world.blockerAt(cell) === instanceId) this.world.unregisterBlocker(cell);
        }
        for (const s of surfaces) {
          this.world.clearSurface({ x: placement.cell.x + s.x, z: placement.cell.z + s.z });
        }
      }
    }
    list.splice(index, 1);
    return true;
  }

  /** Place a choppable structure-tree node live. */
  addEditorTree(placement: { instanceId: string; defId: string; cell: { x: number; z: number }; structureId: string }): void {
    this.world.region.nodes.push(placement);
    this.nodes.addInstance(placement, this.rng);
  }

  /** Remove a node (editor trees, or any node) and free its cells. */
  removeEditorNode(instanceId: string): boolean {
    if (!this.nodes.removeInstance(instanceId)) return false;
    const index = this.world.region.nodes.findIndex((n) => n.instanceId === instanceId);
    if (index >= 0) this.world.region.nodes.splice(index, 1);
    return true;
  }

  /** Place any resource node live (full world editor). */
  addEditorNodePlain(placement: { instanceId: string; defId: string; cell: { x: number; z: number } }): void {
    this.world.region.nodes.push(placement);
    this.nodes.addInstance(placement, this.rng);
  }

  /** Place a world object live: nav blocking and containers included. */
  addEditorObject(placement: { instanceId: string; defId: string; cell: { x: number; z: number } }): void {
    this.world.region.objects.push(placement);
    const def = OBJECTS[placement.defId];
    if (def?.blocksNav) this.world.registerBlocker(placement.instanceId, placement.cell);
    if (def?.containerSlots && !this.containers.has(placement.instanceId)) {
      const inv = new Inventory(def.containerSlots);
      this.seedRandomLoot(inv, def);
      this.containers.set(placement.instanceId, inv);
    }
  }

  /** Roll a container's random-loot table (barrels/crates) into it, once. */
  seedRandomLoot(container: Inventory, def: { randomLoot?: Array<{ itemId: string; min: number; max: number; chance: number }> }): void {
    if (!def.randomLoot) return;
    for (const entry of def.randomLoot) {
      if (this.rng.next() >= entry.chance) continue;
      container.add(entry.itemId, this.rng.intBetween(entry.min, entry.max));
    }
  }

  removeEditorObject(instanceId: string): boolean {
    const list = this.world.region.objects;
    const index = list.findIndex((o) => o.instanceId === instanceId);
    if (index < 0) return false;
    const placement = list[index];
    // Drop any open-door timer for this object, or tickDoors would re-register
    // a blocker for a door that no longer exists.
    this.openDoors.delete(instanceId);
    if (this.world.blockerAt(placement.cell) === instanceId) this.world.unregisterBlocker(placement.cell);
    for (const cell of placement.footprint ?? []) {
      if (this.world.blockerAt(cell) === instanceId) this.world.unregisterBlocker(cell);
    }
    list.splice(index, 1);
    return true;
  }

  /** Place a creature spawn live (full world editor). */
  addEditorEnemy(placement: { instanceId: string; defId: string; cell: { x: number; z: number } }): void {
    (this.world.region.enemies ??= []).push(placement);
    this.enemies.addPlacement(placement, this.rng);
  }

  removeEditorEnemy(instanceId: string): boolean {
    const list = this.world.region.enemies ?? [];
    const index = list.findIndex((e) => e.instanceId === instanceId);
    if (index < 0) return false;
    this.enemies.removePlacement(instanceId);
    list.splice(index, 1);
    return true;
  }

  /** An endless, seeded world: terrain forever, entities streamed in. */
  static createEndless(seed: number): GameSimulation {
    setValeActive(false); // the random world is fully natural from spawn
    const terrain = new EndlessTerrain(seed);
    const spawn = terrain.findSpawn();
    const sim = new GameSimulation(starterTownRegion(seed, spawn), seed, terrain);
    sim.chunks = new ChunkManager(sim, terrain);
    sim.chunks.update(spawn);
    return sim;
  }

  /** The tutorial world: the walled vale with a graduation gateway. Finishing
   *  the lessons and stepping through it carries the player into a fresh random
   *  world. */
  static createTutorial(seed: number): GameSimulation {
    // The tutorial is a hand-built FINITE region (Tutor's Trail island): its own
    // heightfield with no endless terrain source and no chunk streaming, so no
    // random POIs, villages, dungeons, mobs or minimap markers can leak in. A
    // roomy pack (40 slots) carries the gear + products from the full tour.
    setValeActive(false);
    const region = tutorialRegion(seed, { x: 0, z: 0 });
    const sim = new GameSimulation(region, seed, undefined, 40);
    // A bright midday start so the newcomer's first impression is a sunlit trail.
    sim.timeS = DAY_LENGTH_S * 0.5;
    // The tutorial is delivered as quests given by the trail's masters (QUESTS
    // "quest.tut_*"); the gateway opens once "quest.tut_graduation" sets the
    // tutorial.graduated world flag. No separate lesson driver.
    return sim;
  }

  /** Fraction of the current day, 0 = midnight. */
  dayFrac(): number {
    return (this.timeS / DAY_LENGTH_S) % 1;
  }

  dayCount(): number {
    return Math.floor(this.timeS / DAY_LENGTH_S) + 1;
  }

  /** The current season, cycling spring→summer→autumn→winter over the year. */
  season(): Season {
    const day0 = this.timeS / DAY_LENGTH_S; // 0-based fractional days
    return SEASON_ORDER[Math.floor(day0 / DAYS_PER_SEASON) % 4];
  }

  /** Season with its label, 0..1 progress, tint and precipitation lean. */
  seasonInfo(): SeasonInfo {
    const day0 = this.timeS / DAY_LENGTH_S;
    const season = SEASON_ORDER[Math.floor(day0 / DAYS_PER_SEASON) % 4];
    const d = SEASON_DATA[season];
    return {
      season,
      label: d.label,
      progress: (day0 % DAYS_PER_SEASON) / DAYS_PER_SEASON,
      tint: d.tint,
      cold: d.cold,
      clearBias: d.clearBias,
    };
  }

  /**
   * Daylight strength 0..1: night is 0, full noon is 1, with smooth dawn
   * (~05:30) and dusk (~20:30) shoulders.
   */
  daylight(): number {
    const h = this.dayFrac() * 24;
    const t = (h - 5.5) / 15;
    if (t <= 0 || t >= 1) return 0;
    return Math.sin(Math.PI * t);
  }

  /** Debug: force a specific weather from the debug menu; null = deterministic. */
  weatherOverride: WeatherKind | null = null;

  /** Deterministic weather: the same seed always gets the same skies. */
  weather(): WeatherKind {
    if (this.weatherOverride) return this.weatherOverride;
    const epoch = Math.floor(this.timeS / WEATHER_SPELL_S);
    // Cheap integer hash of (seed, epoch) -> [0,1).
    let hsh = (this.seed * 374761393 + epoch * 668265263) >>> 0;
    hsh = Math.imul(hsh ^ (hsh >>> 16), 2246822507) >>> 0;
    const r = ((hsh ^ (hsh >>> 13)) >>> 0) / 4294967296;
    // Seasons lean the skies: summer runs clear, autumn and winter grey and
    // foul (winter's precipitation falls as snow via seasonInfo().cold).
    const clearCut = this.seasonInfo().clearBias;
    if (r < clearCut) return "clear";
    const rest = (r - clearCut) / (1 - clearCut); // 0..1 across the foul band
    if (rest < 0.5) return "overcast";
    if (rest < 0.85) return "rain";
    return "storm";
  }

  /** Re-check the mover's queued path against live nav blockers. Blockers only
   *  appear as chunks stream in, so a path set earlier may now cross a tree or
   *  rock. If it does, re-path to the same goal; if the goal is now unreachable
   *  or blocked, stop the player short rather than let them clip through. */
  private revalidatePath(): void {
    const remaining = this.movement.remainingPath();
    if (remaining.length === 0) return;
    const boat = this.bestBoat() !== null;
    let clear = true;
    for (const c of remaining) {
      if (!this.world.walkable(c, boat)) {
        clear = false;
        break;
      }
    }
    if (clear) return;
    const goal = remaining[remaining.length - 1];
    const from = this.movement.currentCell();
    const path = this.world.walkable(goal, boat)
      ? findPath(this.world, from, goal, undefined, boat)
      : null;
    if (path && path.length > 0) this.movement.setPath(path);
    else this.movement.stop();
  }

  tick(): SimEvent[] {
    this.tickCount++;
    this.timeS += TICK_DT;
    this.chunks?.update(this.movement.currentCell());
    // Endless streaming registers tree/rock blockers only for chunks near the
    // player. A path clicked toward a distant goal is A*'d through cells that
    // were still off-stream (unblocked) at click time; as those chunks stream
    // in, trees pop onto the queued path. Re-validate the remaining path each
    // tick and reroute (or halt before the obstacle) so the player can never
    // walk straight through a newly-streamed tree or rock.
    this.revalidatePath();
    const commands = this.queue;
    this.queue = [];
    for (const c of commands) this.route(c);

    // Potion effects tick down; swiftness adjusts stride while it lasts.
    for (const kind of Object.keys(this.buffs)) {
      this.buffs[kind] -= TICK_DT;
      if (this.buffs[kind] <= 0) delete this.buffs[kind];
    }
    // Stride: swiftness on land; on water the boat's hull speed rules.
    const boat = this.bestBoat();
    const onWater = this.world.blockAt(this.movement.currentCell()) === "water";
    if (boat && onWater) {
      this.movement.speedCellsPerS = boat.speed;
      // Rowing rests the legs — stamina recovers on the water.
      this.regenStamina();
    } else {
      const base = this.buffs["speed"] > 0 ? 4.55 : WALK_SPEED;
      // Sprint only while the toggle is on, there's breath left, and you're
      // actually travelling; drain then, recover otherwise.
      if (this.stamina <= 0) this.exhausted = true;
      if (this.stamina >= STAMINA_RECOVER) this.exhausted = false;
      const sprinting = this.running && !this.exhausted && this.stamina > 0 && this.movement.isMoving();
      this.movement.speedCellsPerS = sprinting ? Math.max(base, RUN_SPEED) : base;
      if (sprinting) this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN * TICK_DT);
      else this.regenStamina();
    }

    const beforeMove = this.movement.currentCell();
    this.movement.tick(TICK_DT);
    const movedCell = this.movement.currentCell();
    // Rowing trains Boating: award XP each time you glide into a new water cell.
    if (boat && !cellsMatch(beforeMove, movedCell) && this.world.blockAt(movedCell) === "water") {
      this.skills.grantXp("skill.boating", 4);
    }
    // Walking away from an open container/workstation closes it.
    if (!cellsMatch(beforeMove, movedCell)) {
      this.actions.closeContainer();
      this.actions.closeWorkstation();
      this.actions.closeShop();
    }
    this.actions.tick();
    this.tickDoors();
    this.nodes.tick(TICK_DT, this.rng);
    this.npcs.tick(TICK_DT, this.rng);
    this.enemies.tick(TICK_DT, this.rng);
    this.groundItems.tick(TICK_DT, this.rng);

    // Stumbling onto a landmark or dungeon in the endless wild logs it as a
    // discovery (persisted via world flags) and pays a small explorer's bounty
    // that grows the farther out you find it.
    if (this.world.region.id === "region.endless") {
      this.discoverScan();
      // The road throws up encounters: ambushes, lone beasts, lost caches —
      // more, and deadlier, the farther from home you roam. Only counts down
      // while actually travelling, so it reads as a wayfaring event.
      if (this.hp > 0 && !cellsMatch(beforeMove, movedCell)) {
        this.worldEventCdS -= TICK_DT;
        if (this.worldEventCdS <= 0) {
          this.worldEventCdS = 80 + this.rng.next() * 90;
          this.rollWorldEvent(movedCell);
        }
      }
      // A treasure map in the pack sets a buried-cache hunt; reaching the marked
      // spot unearths the prize (and sometimes the next map — a chain).
      if (!this.treasureHunt && this.inventory.count("item.treasure_map") > 0) this.beginTreasureHunt();
      if (this.treasureHunt && chebyshev(movedCell, this.treasureHunt) <= 1) this.unearthTreasure();
      // Crossing into a new named biome announces it; the first time you set
      // foot in one pays a small explorer's bounty and adds it to your codex.
      if (!cellsMatch(beforeMove, movedCell)) this.noteBiome(movedCell);
    }

    // Crossing into a named zone announces it (world map only).
    if (this.world.region.id === "region.vale_clearing") {
      const cell = this.movement.currentCell();
      const zone = ZONES.find(
        (z) => cell.x >= z.x0 && cell.x <= z.x1 && cell.z >= z.z0 && cell.z <= z.z1,
      );
      if (zone && zone.id !== this.currentZoneId) {
        this.currentZoneId = zone.id;
        this.events.emit({ type: "zoneEntered", zoneId: zone.id, name: zone.name, blurb: zone.blurb });
      }
    }

    // Out-of-combat health regeneration; an Oakblood Tonic keeps blood
    // knitting even in the thick of a fight, and much faster.
    this.sinceDamageS += TICK_DT;
    const maxHp = this.maxHp();
    const regenBuff = this.buffs["regen"] > 0;
    const regenReady = regenBuff || this.sinceDamageS >= PLAYER_COMBAT.regenDelayS;
    const regenInterval = regenBuff ? 2 : PLAYER_COMBAT.regenIntervalS;
    if (this.hp > 0 && this.hp < maxHp && regenReady) {
      this.regenAccumS += TICK_DT;
      if (this.regenAccumS >= regenInterval) {
        this.regenAccumS = 0;
        this.hp = Math.min(maxHp, this.hp + 1);
        this.events.emit({ type: "healthChanged", hp: this.hp, maxHp });
      }
    }

    // Quests and taskmasters react to this tick's events and may emit their
    // own (rewards, progress, new assignments).
    const events = this.events.drain();
    this.quests.process(events);
    this.slayer.process(events);
    this.curator.process(events);
    this.tutorial?.process(events);
    // Felling a dungeon's finale boss conquers it for good.
    this.noteBossKills(events);
    const questEvents = this.events.drain();
    // Completed quests may set world flags that visibly repair the world.
    for (const ev of questEvents) {
      if (ev.type !== "questCompleted") continue;
      const flag = QUESTS[ev.questId]?.completionFlag;
      if (flag && !this.worldFlags.has(flag)) this.setWorldFlag(flag);
      // On the tutorial trail, finishing one lesson auto-tracks the next so the
      // guidance line/marker leads straight on to the following master.
      this.trackNextTutorialQuest(ev.questId);
    }
    return [...events, ...questEvents, ...this.events.drain()];
  }

  /** After a tutorial lesson completes, pin the next quest in the trail chain
   *  (welcome → each lesson → graduation) so the guidance beacon and map marker
   *  lead straight on to the following master. */
  private trackNextTutorialQuest(completedId: string): void {
    const chain = [
      "quest.tut_welcome",
      ...TUTORIAL_ORDER.map((s) => `quest.tut_${s.slice("skill.".length)}`),
      "quest.tut_graduation",
    ];
    const idx = chain.indexOf(completedId);
    if (idx < 0) return; // not a tutorial-chain quest
    const next = chain[idx + 1];
    this.trackedQuestId = next && this.quests.states[next]?.status !== "completed" ? next : null;
  }

  /** Set a persistent world flag and apply its terrain repair immediately. */
  setWorldFlag(flag: string): void {
    if (this.worldFlags.has(flag)) return;
    this.worldFlags.add(flag);
    applyWorldFlags(this.world.region, [flag]);
    // Completed construction sites vanish (their scaffolding is done with).
    const region = this.world.region;
    for (const obj of [...region.objects]) {
      if (OBJECTS[obj.defId].completionFlag !== flag) continue;
      this.world.unregisterBlocker(obj.cell);
      for (const cell of obj.footprint ?? []) this.world.unregisterBlocker(cell);
      region.objects.splice(region.objects.indexOf(obj), 1);
    }
    this.events.emit({ type: "worldFlagSet", flag });
  }

  /** How many endless-world POIs the player has ever discovered (persisted). */
  discoveryCount(): number {
    let n = 0;
    for (const f of this.worldFlags) if (f.startsWith("found.")) n++;
    return n;
  }

  private poiName(o: { defId?: string; structureId?: string }): string | null {
    if (o.defId?.includes("portal.cave")) return "a dungeon";
    const s = o.structureId ?? "";
    if (!s) return null;
    if (s.startsWith("portal")) return "a dungeon gate";
    if (s.startsWith("ihouse") || s.startsWith("house") || s.startsWith("home")) return "a homestead";
    if (s.startsWith("ruin")) return "an old ruin";
    if (s.includes("tower")) return "a watchtower";
    if (s.includes("stone") || s.includes("circle") || s.includes("henge")) return "a standing-stone circle";
    return "a landmark";
  }

  /** Log any nearby, not-yet-found landmark or dungeon as a discovery, pay a
   *  distance-scaled explorer's bounty, and persist it as a world flag. */
  private discoverScan(): void {
    const p = this.movement.currentCell();
    const near = (cell: Cell, r: number) =>
      Math.abs(cell.x - p.x) <= r && Math.abs(cell.z - p.z) <= r;
    const found = (id: string, name: string, cell: Cell): void => {
      const flag = `found.${id}`;
      if (this.worldFlags.has(flag)) return;
      this.worldFlags.add(flag);
      // Record a fast-travel waypoint at the landmark's own cell.
      if (!this.waypoints.some((w) => w.id === id)) {
        this.waypoints.push({ id, name, x: cell.x, z: cell.z });
      }
      const reward = 5 + Math.floor(remoteness01(p.x, p.z) * 45);
      this.inventory.add("item.coin", reward);
      this.events.emit({ type: "itemGained", itemId: "item.coin", qty: reward });
      // Finding a place earns a little standing with whoever cares for its kind.
      if (name === "a homestead") this.adjustRep("guild", 5);
      else if (name === "a dungeon" || name === "a dungeon gate") this.adjustRep("order", 4);
      else this.adjustRep("grove", 5); // ruins, stones, towers and old landmarks
      this.events.emit({ type: "poiDiscovered", id, name, reward, total: this.discoveryCount() });
    };
    for (const o of this.world.region.objects) {
      if (!near(o.cell, 9)) continue;
      const name = this.poiName(o);
      if (name === "a dungeon") found(o.instanceId, name, o.cell);
    }
    for (const s of this.world.region.structures ?? []) {
      if (!near(s.cell, 12)) continue;
      const name = this.poiName(s);
      if (name) found(s.instanceId, name, s.cell);
    }
  }

  /** Replace the fast-travel waypoint list from a save (deduped by id). */
  restoreWaypoints(list: Array<{ id: string; name: string; x: number; z: number }>): void {
    this.waypoints.length = 0;
    const seen = new Set<string>();
    for (const w of list) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      this.waypoints.push({ id: w.id, name: w.name, x: w.x, z: w.z });
    }
  }

  /** Fast-travel to a discovered waypoint. Only from the open endless world,
   *  never mid-combat or from a dungeon/interior. Returns false if it can't. */
  fastTravelTo(id: string): boolean {
    if (this.world.region.id !== "region.endless" || this.hp <= 0) return false;
    const w = this.waypoints.find((v) => v.id === id);
    if (!w) return false;
    this.actions.cancel();
    // Stream the destination in first, then land on solid ground beside it (the
    // landmark cell itself is often a blocker — a gate, a wall, a house).
    this.chunks?.update({ x: w.x, z: w.z });
    const land = this.landingNear({ x: w.x, z: w.z }) ?? { x: w.x, z: w.z };
    this.movement.setCellPosition(land);
    this.chunks?.update(land);
    this.events.emit({ type: "fastTraveled", id, name: w.name, cell: { ...land } });
    return true;
  }

  /** Nearest walkable, dry cell to a target (searched outward), or null. */
  private landingNear(c: Cell): Cell | null {
    for (let r = 0; r <= 6; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cell = { x: c.x + dx, z: c.z + dz };
          if (this.world.walkable(cell) && this.world.blockAt(cell) !== "water") return cell;
        }
      }
    }
    return null;
  }

  // ── Treasure-map hunts ───────────────────────────────────────────────────
  private static readonly COMPASS = ["east", "north-east", "north", "north-west", "west", "south-west", "south", "south-east"];

  /** Consume one treasure map and mark a buried cache a good walk away, on dry
   *  land. Emits a directional hint. */
  private beginTreasureHunt(): void {
    if (this.inventory.removeItemById("item.treasure_map", 1) === 0) return;
    const here = this.movement.currentCell();
    // A random bearing, 300–900 paces out; nudge off any water to dry land.
    const ang = this.rng.next() * Math.PI * 2;
    const dist = 300 + Math.floor(this.rng.next() * 600);
    let tx = Math.round(here.x + Math.cos(ang) * dist);
    let tz = Math.round(here.z + Math.sin(ang) * dist);
    // Nudge the mark off open water onto dry land (terrain reads are per-cell).
    for (let i = 0; i < 24 && this.world.blockAt({ x: tx, z: tz }) === "water"; i++) {
      tx += Math.round((this.rng.next() - 0.5) * 30);
      tz += Math.round((this.rng.next() - 0.5) * 30);
    }
    this.treasureHunt = { x: tx, z: tz };
    // Eight-wind bearing from the player toward the mark.
    const oct = Math.round((Math.atan2(tz - here.z, tx - here.x) / (Math.PI * 2)) * 8 + 8) % 8;
    const hint = `The map marks a cache to the ${GameSimulation.COMPASS[oct]}, about ${dist} paces off.`;
    this.events.emit({ type: "treasureHuntBegan", hint, x: tx, z: tz });
  }

  /** Reaching the mark: unearth the cache. Deep finds pay more, and roughly a
   *  third of the time turn up the next map — a treasure chain. */
  private unearthTreasure(): void {
    const spot = this.treasureHunt!;
    this.treasureHunt = null;
    const r = remoteness01(spot.x, spot.z);
    const reward = 80 + Math.floor(r * 320);
    this.inventory.add("item.coin", reward);
    this.events.emit({ type: "itemGained", itemId: "item.coin", qty: reward });
    if (this.inventory.canAdd("item.gem.emerald", 1)) {
      this.inventory.add("item.gem.emerald", 1);
      this.events.emit({ type: "itemGained", itemId: "item.gem.emerald", qty: 1 });
    }
    // The chain: sometimes the cache holds the next map. Grant it now; the tick
    // loop begins the next hunt automatically.
    const chain = this.rng.next() < 0.34 && this.inventory.canAdd("item.treasure_map", 1);
    if (chain) {
      this.inventory.add("item.treasure_map", 1);
      this.events.emit({ type: "itemGained", itemId: "item.treasure_map", qty: 1 });
    }
    this.skills.grantXp("skill.archaeology", 40 + Math.floor(r * 120));
    this.adjustRep("guild", 12); // treasure delights the Free Companies
    this.events.emit({ type: "treasureFound", reward, chain });
  }

  /** When the open dungeon chest is emptied, remember it as looted so it never
   *  refills on a later re-entry (dyn dungeons regenerate from scratch). */
  private noteChestLooted(): void {
    const region = this.world.region.id;
    if (!region.startsWith("dyn_")) return; // only the regenerating dungeons
    const id = this.actions.openContainerId;
    if (!id) return;
    const chest = this.containers.get(id);
    if (!chest || !chest.slots.every((s) => s === null)) return; // only when fully emptied
    this.worldFlags.add(`looted.${id}`);
  }

  // ── Factions & renown ────────────────────────────────────────────────────
  /** The player's rank (0..) with a faction. */
  factionRank(id: string): number {
    return rankOf(this.reputation[id] ?? 0);
  }

  /** Build renown with a faction; crossing a rank pays a standing reward. */
  adjustRep(id: string, delta: number): void {
    if (!(id in this.reputation) || delta === 0) return;
    const before = this.reputation[id];
    const after = Math.max(0, before + delta);
    this.reputation[id] = after;
    const beforeRank = rankOf(before);
    const afterRank = rankOf(after);
    if (afterRank > beforeRank) {
      const reward = 30 + afterRank * 40;
      this.inventory.add("item.coin", reward);
      this.events.emit({ type: "itemGained", itemId: "item.coin", qty: reward });
      this.events.emit({
        type: "factionRankUp",
        faction: id,
        name: FACTIONS[id].name,
        rank: afterRank,
        rankName: REP_RANKS[afterRank].name,
        reward,
      });
    }
  }

  /** Announce the named biome at a cell; the first visit adds it to the codex
   *  and pays a small bounty. Cheap: only called when the player changes cell. */
  private noteBiome(cell: Cell): void {
    // The walled tutorial vale is one place — no biome-discovery chatter there.
    if (inStarterTown(this.seed, cell.x, cell.z)) return;
    const base = terrainAt(this.seed, cell.x, cell.z).biome;
    const name = biomeName(this.seed, cell.x, cell.z, base);
    if (name === this.currentBiomeName) return;
    this.currentBiomeName = name;
    const firstTime = !this.discoveredBiomes.has(name);
    if (firstTime) {
      this.discoveredBiomes.add(name);
      this.inventory.add("item.coin", 20);
      this.events.emit({ type: "itemGained", itemId: "item.coin", qty: 20 });
    }
    this.events.emit({ type: "biomeEntered", name, firstTime, total: this.discoveredBiomes.size });
  }

  /** How many endless-world dungeons the player has ever conquered (persisted). */
  clearedCount(): number {
    let n = 0;
    for (const f of this.worldFlags) if (f.startsWith("cleared.dungeon.")) n++;
    return n;
  }

  /** Watch for the finale boss going down and conquer the dungeon for good. */
  private noteBossKills(events: SimEvent[]): void {
    for (const ev of events) {
      if (ev.type !== "enemyDied" || !ev.instanceId.endsWith(".boss")) continue;
      this.markDungeonCleared(this.world.region.id);
    }
  }

  /** Mark a finite endless dungeon conquered: set a persistent flag, pay a
   *  one-time distance-scaled bounty, and announce it. Only the finale floor
   *  counts — intermediate boss floors and the endless descent never "clear". */
  private markDungeonCleared(regionId: string): void {
    const m = regionId.match(DUNGEON_ID_RE);
    if (!m) return;
    const style = m[1] as DungeonStyle;
    const seed = Number(m[2]);
    const depth = Number(m[3]);
    const maxDepth = Number(m[4]);
    const exit = { x: Number(m[5]), z: Number(m[6]) };
    if (maxDepth <= 0 || depth < maxDepth) return; // only the finale conquers it
    const flag = `cleared.dungeon.${style}.${seed}`;
    if (this.worldFlags.has(flag)) return;
    this.worldFlags.add(flag);
    // A conquest bounty, several times an ordinary discovery, growing with the
    // dungeon's remoteness from home.
    const reward = 60 + Math.floor(remoteness01(exit.x, exit.z) * 240);
    this.inventory.add("item.coin", reward);
    this.events.emit({ type: "itemGained", itemId: "item.coin", qty: reward });
    const name = dungeonSpecFor(style, seed, depth, maxDepth, exit).name.split(" — ")[0];
    this.adjustRep("order", 25); // conquering the deep places honours the Wardens
    this.events.emit({ type: "dungeonCleared", id: flag, name, reward, total: this.clearedCount() });
  }

  // ── Roaming world events ─────────────────────────────────────────────────
  private eventSeq = 0;

  /** Roll one travel encounter near the player and make it happen. */
  private rollWorldEvent(at: Cell): void {
    const r = remoteness01(at.x, at.z);
    if (r < 0.05) return; // the home vale stays quiet and safe
    const roll = this.rng.next();
    // Ambushes and beasts grow likelier (and deadlier) with distance; caches
    // can turn up anywhere, and are the fallback when a spawn can't be placed.
    if (roll < 0.3 + r * 0.35 && this.spawnEventFoes(at, r, false)) return;
    if (r > 0.28 && roll < 0.62 && this.spawnEventFoes(at, r, true)) return;
    this.wandererCache(at, r);
  }

  /** Spawn an ambush pack (or a lone rare beast) in a ring around the player.
   *  Returns false if no walkable spot was free (caller falls back to a cache). */
  private spawnEventFoes(at: Cell, r: number, beast: boolean): boolean {
    this.pruneEventFoes(at);
    const tier = dangerTier(at.x, at.z);
    const pool = DANGER_MOBS[Math.min(5, tier + (beast ? 1 : 0))];
    const count = beast ? 1 : 2 + Math.floor(r * 2.5); // 2–4 ambushers
    const ring = this.spawnRing(at, count, 3, 6);
    if (ring.length === 0) return false;
    const region = (this.world.region.enemies ??= []);
    for (let k = 0; k < ring.length; k++) {
      const defId = pool[Math.floor(this.rng.next() * pool.length)];
      const placement = { instanceId: `event.foe.${this.eventSeq++}`, defId, cell: ring[k] };
      region.push(placement);
      this.enemies.addPlacement(placement, this.rng);
    }
    const title = beast ? "A rare beast!" : "Ambush!";
    const blurb = beast
      ? "A dangerous creature stalks out of the wild — put it down for a fine prize."
      : `You are set upon on the road — ${ring.length} foes close in!`;
    this.events.emit({ type: "worldEvent", kind: beast ? "beast" : "ambush", title, blurb });
    return true;
  }

  /** A lost stash by the wayside: coin, and out in the deep wilds a gem too. */
  private wandererCache(at: Cell, r: number): void {
    const coins = 15 + Math.floor(r * 130);
    this.inventory.add("item.coin", coins);
    this.events.emit({ type: "itemGained", itemId: "item.coin", qty: coins });
    let blurb = `You find a traveller's lost cache — ${coins} coins.`;
    if (r > 0.4 && this.rng.next() < 0.5 && this.inventory.canAdd("item.gem.emerald", 1)) {
      this.inventory.add("item.gem.emerald", 1);
      this.events.emit({ type: "itemGained", itemId: "item.gem.emerald", qty: 1 });
      blurb += " A gem glints among the coins.";
    }
    // Deep out, a cache may hold a treasure map — the start of a hunt (and, if
    // no hunt is running, the tick loop picks it straight up).
    if (r > 0.3 && !this.treasureHunt && this.rng.next() < 0.2 && this.inventory.canAdd("item.treasure_map", 1)) {
      this.inventory.add("item.treasure_map", 1);
      this.events.emit({ type: "itemGained", itemId: "item.treasure_map", qty: 1 });
      blurb += " A rolled treasure map is tucked inside!";
    }
    this.events.emit({ type: "worldEvent", kind: "cache", title: "A lucky find", blurb });
  }

  /** Walkable cells around a centre, for dropping event foes. */
  private spawnRing(center: Cell, want: number, minR: number, maxR: number): Cell[] {
    const out: Cell[] = [];
    for (let i = 0; i < 32 && out.length < want; i++) {
      const a = this.rng.next() * Math.PI * 2;
      const rad = minR + Math.floor(this.rng.next() * (maxR - minR + 1));
      const cell = { x: Math.round(center.x + Math.cos(a) * rad), z: Math.round(center.z + Math.sin(a) * rad) };
      if (this.world.walkable(cell) && this.world.blockAt(cell) !== "water") out.push(cell);
    }
    return out;
  }

  /** Retire spent event foes the player has left far behind, so they don't
   *  pile up in the region over a long journey. */
  private pruneEventFoes(near: Cell): void {
    const region = this.world.region.enemies;
    if (!region) return;
    for (let i = region.length - 1; i >= 0; i--) {
      const foe = region[i];
      if (!foe.instanceId.startsWith("event.foe.")) continue;
      if (chebyshev(foe.cell, near) <= 70) continue;
      this.enemies.removePlacement(foe.instanceId);
      region.splice(i, 1);
    }
  }

  private route(c: Command): void {
    switch (c.type) {
      case "moveTo":
        this.actions.moveTo(c.cell);
        break;
      case "interact":
        this.actions.request(c.targetId);
        break;
      case "cancel":
        this.actions.cancel();
        break;
      case "equipSlot": {
        const s = this.inventory.slots[c.slot];
        if (!s) break;
        const def = ITEMS[s.itemId];
        if (def.armorSlot) {
          const previous = this.equippedArmor[def.armorSlot];
          this.equippedArmor[def.armorSlot] = s.itemId;
          this.inventory.removeFromSlot(c.slot, 1);
          if (previous) this.inventory.add(previous, 1);
        } else if (def.toolTags) {
          const previous = this.equippedTool;
          this.equippedTool = s.itemId;
          this.inventory.removeFromSlot(c.slot, 1);
          if (previous) this.inventory.add(previous, 1);
        } else {
          break;
        }
        this.events.emit({ type: "equipmentChanged" });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "shopBuy": {
        const shop = this.openShop();
        if (!shop) break;
        const offer = shop.sells.find((o) => o.itemId === c.itemId);
        if (!offer) break;
        if (this.inventory.count("item.coin") < offer.price) {
          this.events.emit({ type: "actionRejected", reason: "missing_inputs" });
          break;
        }
        if (!this.inventory.canAdd(offer.itemId, 1)) {
          this.events.emit({ type: "inventoryFull" });
          break;
        }
        this.inventory.removeItemById("item.coin", offer.price);
        this.inventory.add(offer.itemId, 1);
        this.events.emit({ type: "itemGained", itemId: offer.itemId, qty: 1 });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "shopSell": {
        const shop = this.openShop();
        if (!shop) break;
        const s = this.inventory.slots[c.slot];
        if (!s) break;
        const price = shop.buys[s.itemId];
        if (!price) {
          this.events.emit({ type: "actionRejected", reason: "no_target", targetId: s.itemId });
          break;
        }
        this.inventory.removeFromSlot(c.slot, 1);
        this.inventory.add("item.coin", price);
        this.events.emit({ type: "itemGained", itemId: "item.coin", qty: price });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "unequipArmor": {
        const worn = this.equippedArmor[c.slot];
        if (!worn) break;
        if (!this.inventory.canAdd(worn, 1)) {
          this.events.emit({ type: "inventoryFull" });
          break;
        }
        this.inventory.add(worn, 1);
        this.equippedArmor[c.slot] = null;
        this.events.emit({ type: "equipmentChanged" });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "unequip": {
        if (!this.equippedTool) break;
        if (!this.inventory.canAdd(this.equippedTool, 1)) {
          this.events.emit({ type: "inventoryFull" });
          break;
        }
        this.inventory.add(this.equippedTool, 1);
        this.equippedTool = null;
        this.events.emit({ type: "equipmentChanged" });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "deposit": {
        const chest = this.openContainer();
        if (!chest) break;
        if (transferSlot(this.inventory, c.slot, chest) > 0) {
          this.events.emit({ type: "inventoryChanged" });
        }
        break;
      }
      case "depositAll": {
        const chest = this.openContainer();
        if (!chest) break;
        let moved = 0;
        for (let i = 0; i < this.inventory.slots.length; i++) {
          const s = this.inventory.slots[i];
          if (s && ITEMS[s.itemId].stackable) moved += transferSlot(this.inventory, i, chest);
        }
        if (moved > 0) this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "withdraw": {
        const chest = this.openContainer();
        if (!chest) break;
        if (transferSlot(chest, c.slot, this.inventory) > 0) {
          this.events.emit({ type: "inventoryChanged" });
          this.noteChestLooted();
        } else {
          this.events.emit({ type: "inventoryFull" });
        }
        break;
      }
      case "closeContainer":
        this.actions.closeContainer();
        this.actions.closeWorkstation();
        this.actions.closeShop();
        break;
      case "craft":
        this.actions.craft(c.stationId, c.recipeId);
        break;
      case "eatSlot": {
        const s = this.inventory.slots[c.slot];
        if (!s) break;
        const def = ITEMS[s.itemId];
        if (def.buff) {
          // Drink: the effect refreshes rather than stacking.
          this.inventory.removeFromSlot(c.slot, 1);
          this.buffs[def.buff.kind] = def.buff.durationS;
          this.events.emit({ type: "buffApplied", itemId: s.itemId, kind: def.buff.kind });
          this.events.emit({ type: "inventoryChanged" });
          break;
        }
        const heal = def.healAmount;
        if (!heal) break;
        if (this.hp >= this.maxHp() || this.hp <= 0) break; // nothing to restore
        this.inventory.removeFromSlot(c.slot, 1);
        const healed = Math.min(heal, this.maxHp() - this.hp);
        this.hp += healed;
        this.events.emit({ type: "ateFood", itemId: s.itemId, healed });
        this.events.emit({ type: "healthChanged", hp: this.hp, maxHp: this.maxHp() });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "burnSlot": {
        const s = this.inventory.slots[c.slot];
        if (!s) break;
        const fm = ITEMS[s.itemId].firemaking;
        if (!fm) break;
        if (this.skills.levelOf("skill.firemaking") < fm.level) break;
        this.inventory.removeFromSlot(c.slot, 1);
        this.skills.grantXp("skill.firemaking", fm.xp);
        this.events.emit({ type: "logBurned", itemId: s.itemId });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "burySlot": {
        const s = this.inventory.slots[c.slot];
        if (!s) break;
        const pr = ITEMS[s.itemId].prayer;
        if (!pr) break;
        if (this.skills.levelOf("skill.prayer") < pr.level) break;
        this.inventory.removeFromSlot(c.slot, 1);
        this.skills.grantXp("skill.prayer", pr.xp);
        this.events.emit({ type: "bonesBuried", itemId: s.itemId });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
      case "alchSlot": {
        const s = this.inventory.slots[c.slot];
        if (!s) break;
        const value = ALCH_VALUES[s.itemId];
        if (value === undefined) break; // nothing worth transmuting
        const spell = c.high ? ALCHEMY.high : ALCHEMY.low;
        if (this.skills.levelOf("skill.magic") < spell.level) break;
        if (this.inventory.count(spell.rune) < 1) break; // no rune to cast it
        // Burn one rune and the target item; coins in, Magic XP earned.
        this.inventory.removeItemById(spell.rune, 1);
        this.inventory.removeFromSlot(c.slot, 1);
        const coins = Math.max(1, Math.round(value * spell.factor));
        this.inventory.add("item.coin", coins);
        this.skills.grantXp("skill.magic", spell.xp);
        this.events.emit({ type: "spellCast", spell: c.high ? "high_alch" : "low_alch", coins });
        this.events.emit({ type: "inventoryChanged" });
        break;
      }
    }
  }

  openContainer(): Inventory | null {
    const id = this.actions.openContainerId;
    return id ? this.containers.get(id) ?? null : null;
  }

  /** The shop definition behind the currently open store, if any. */
  openShop(): ShopDef | null {
    const id = this.actions.openShopId;
    if (!id) return null;
    const placement = this.world.region.objects.find((o) => o.instanceId === id);
    const shopId = placement ? OBJECTS[placement.defId].shopId : undefined;
    return shopId ? SHOPS[shopId] ?? null : null;
  }
}

function cellsMatch(a: { x: number; z: number }, b: { x: number; z: number }): boolean {
  return a.x === b.x && a.z === b.z;
}
