// GameSimulation: owns all authoritative state, consumes Commands once per fixed
// tick, emits SimEvents. No engine or DOM imports — fully testable headless.

import { ALCHEMY, ALCH_VALUES, ITEMS, OBJECTS, PLAYER_COMBAT, QUESTS, SHOPS, ZONES, type ShopDef } from "../content/content";
import { getStructure } from "../content/structures";
import { effectiveSink, walkableSurfaces, solidColumns } from "../structures/types";
import { lobbyWalk, LOBBY_W, LOBBY_D, LOBBY_SINK, LOBBY_TILE } from "../content/structures/lobby";
import { ActionController } from "./actions";
import { EnemySystem } from "./enemies";
import { Inventory, transferSlot } from "./inventory";
import { MovementController } from "./movement";
import { findPath } from "./pathfinding";
import { ResourceNodeSystem } from "./nodes";
import { NpcSystem } from "./npc";
import { QuestService } from "./quests";
import { SkillService } from "./skills";
import { ChunkManager } from "./chunk-manager";
import { EndlessTerrain, setValeActive, starterTownRegion, tutorialRegion } from "./worldgen/endless";
import { CuratorService, SlayerService } from "./taskmasters";
import type { ArmorSlot, Cell, Command, SimEvent } from "./types";
import { SimEventBus, SimRng, TICK_DT } from "./types";
import { applyWorldFlags, WorldState, type RegionSpec } from "./world";

export const PLAYER_INVENTORY_SLOTS = 20;

/** One full in-game day in real seconds (20 minutes, Minecraft's pace). */
export const DAY_LENGTH_S = 1200;
/** Weather holds for spells of this many seconds, then rerolls. */
export const WEATHER_SPELL_S = 240;
/** How long a door stays open after it's clicked before swinging shut. */
const DOOR_OPEN_S = 12;

export type WeatherKind = "clear" | "overcast" | "rain" | "storm";

export class GameSimulation {
  readonly world: WorldState;
  readonly events = new SimEventBus();
  readonly rng: SimRng;
  readonly skills: SkillService;
  readonly inventory = new Inventory(PLAYER_INVENTORY_SLOTS);
  readonly containers = new Map<string, Inventory>();
  readonly movement = new MovementController();
  readonly nodes: ResourceNodeSystem;
  readonly npcs: NpcSystem;
  readonly quests: QuestService;
  readonly enemies: EnemySystem;
  readonly actions: ActionController;
  readonly slayer: SlayerService;
  readonly curator: CuratorService;
  equippedTool: string | null = null;
  equippedArmor: Record<ArmorSlot, string | null> = { head: null, body: null, legs: null, feet: null };
  /** Persistent world-state flags (repaired bridges, stabilized anchors…). */
  readonly worldFlags = new Set<string>();
  /** Timed potion effects: kind -> seconds remaining. */
  buffs: Record<string, number> = {};
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

  constructor(region: RegionSpec, seed = 1, terrain?: import("./world").TerrainSource) {
    this.seed = seed;
    this.rng = new SimRng(seed);
    this.world = new WorldState(region, terrain);
    this.skills = new SkillService(this.events);
    this.nodes = new ResourceNodeSystem(this.world, this.events, this.rng);
    for (const obj of region.objects) {
      const def = OBJECTS[obj.defId];
      if (def.containerSlots) {
        const container = new Inventory(def.containerSlots);
        for (const seed of obj.initialItems ?? []) container.add(seed.itemId, seed.qty);
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
      },
      this.rng,
    );
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
      attackLevel: () => this.skills.levelOf(this.combatSkillId()),
      weaponBonus: () =>
        (this.equippedTool ? ITEMS[this.equippedTool].damageBonus ?? 0 : 0) +
        (this.buffs["strength"] > 0 ? 2 : 0),
      weaponRange: () => (this.hasBowEquipped() ? 5 : 1),
      combatSkillId: () => this.combatSkillId(),
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

  hasBowEquipped(): boolean {
    return this.equippedTool !== null && (ITEMS[this.equippedTool].toolTags ?? []).includes("bow");
  }

  /** Bow work trains Archery; everything else trains Attack. */
  combatSkillId(): string {
    return this.hasBowEquipped() ? "skill.archery" : "skill.attack";
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
    if (this.openDoors.has(instanceId)) {
      this.openDoors.get(instanceId)!.remainS = DOOR_OPEN_S; // re-clicking holds it open
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
      this.containers.set(placement.instanceId, new Inventory(def.containerSlots));
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
    setValeActive(true);
    const terrain = new EndlessTerrain(seed);
    const spawn = terrain.findSpawn();
    const sim = new GameSimulation(tutorialRegion(seed, spawn), seed, terrain);
    sim.chunks = new ChunkManager(sim, terrain);
    sim.chunks.update(spawn);
    return sim;
  }

  /** Fraction of the current day, 0 = midnight. */
  dayFrac(): number {
    return (this.timeS / DAY_LENGTH_S) % 1;
  }

  dayCount(): number {
    return Math.floor(this.timeS / DAY_LENGTH_S) + 1;
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
    if (r < 0.68) return "clear";
    if (r < 0.85) return "overcast";
    if (r < 0.965) return "rain";
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
    this.movement.speedCellsPerS =
      boat && onWater ? boat.speed : this.buffs["speed"] > 0 ? 4.55 : 3.5;

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
    const questEvents = this.events.drain();
    // Completed quests may set world flags that visibly repair the world.
    for (const ev of questEvents) {
      if (ev.type !== "questCompleted") continue;
      const flag = QUESTS[ev.questId]?.completionFlag;
      if (flag && !this.worldFlags.has(flag)) this.setWorldFlag(flag);
    }
    return [...events, ...questEvents, ...this.events.drain()];
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
