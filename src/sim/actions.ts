// Generic action pipeline + state machine. One live pipeline per actor; a new
// world-intent command always supersedes the current one. Rewards are decided
// here (in the simulation), never by animation callbacks.

import { ENEMIES, ITEMS, MINING_GEM_CHANCE, MINING_GEMS, NODES, OBJECTS, PLAYER_COMBAT, RECIPES, type RecipeDef } from "../content/content";
import type { EnemySystem } from "./enemies";
import type { GroundItemSystem } from "./ground-items";
import type { ActionAnim, Cell, RejectReason, SimEventBus, SimRng } from "./types";
import { chebyshev, secondsToTicks } from "./types";
import { findPath } from "./pathfinding";
import { getStructure } from "../content/structures";
import { houseInteriorId, houseInteriorArrival } from "./world";
import type { Inventory } from "./inventory";
import type { MovementController } from "./movement";
import type { ResourceNodeSystem } from "./nodes";
import type { NpcSystem } from "./npc";
import type { SkillService } from "./skills";
import type { WorldState } from "./world";

export type ActionPhase =
  | "idle"
  | "movingToTarget"
  | "starting"
  | "active"
  | "waitingForNextCycle";

export type TargetKind =
  | "node" | "container" | "npc" | "workstation" | "craft" | "enemy"
  | "portal" | "shop" | "build" | "plant" | "shortcut" | "sleep" | "door" | "stairs"
  | "enter";

interface Pipeline {
  targetId: string;
  kind: TargetKind;
  targetCell: Cell;
  rangeCells: number;
  cycleTicksLeft: number;
  recipeId?: string;
  /** For "enter": the interior region to travel to on arrival, and the cell to
   *  land on inside. The yard we walk to becomes the return cell. */
  enterRegionId?: string;
  enterArrival?: Cell;
}

/** Map a skill to the rig animation that best reads for its gathering/crafting. */
const SKILL_ANIM: Record<string, ActionAnim> = {
  "skill.woodcutting": "chop",
  "skill.mining": "mine",
  "skill.fishing": "fish",
  "skill.foraging": "gather",
  "skill.herblore": "gather",
  "skill.farming": "gather",
  "skill.hunting": "gather",
  "skill.archaeology": "dig",
  "skill.smithing": "hammer",
  "skill.smelting": "hammer",
  "skill.crafting": "hammer",
  "skill.fletching": "gather",
  "skill.construction": "hammer",
  "skill.cooking": "stir",
  "skill.firemaking": "gather",
  "skill.magic": "cast",
  "skill.prayer": "cast",
  "skill.runecrafting": "cast",
  "skill.summoning": "cast",
  "skill.necromancy": "cast",
  "skill.enchanting": "cast",
};
function animForSkill(skillId: string): ActionAnim {
  return SKILL_ANIM[skillId] ?? "gather";
}

export interface ActionDeps {
  world: WorldState;
  nodes: ResourceNodeSystem;
  npcs: NpcSystem;
  movement: MovementController;
  inventory: Inventory;
  skills: SkillService;
  events: SimEventBus;
  rng: SimRng;
  hasTool(tags: string[]): boolean;
  /** Best success-chance bonus among carried/equipped tools matching the tags. */
  toolBonus(tags: string[]): number;
  enemies: EnemySystem;
  groundItems: GroundItemSystem;
  /** Drop a stack on the ground (loot that won't fit a full pack). */
  spawnGroundItem(cell: Cell, itemId: string, qty: number): void;
  attackLevel(): number;
  /** Damage bonus of the equipped weapon (0 when unarmed). */
  weaponBonus(): number;
  /** Aggregated enchant + socket effects on the equipped weapon. */
  weaponModEffects(): { dmg: number; acc: number; lifesteal: number };
  /** Restore HP (vampiric enchants), clamped to max. */
  healPlayer(amount: number): void;
  /** Attack reach in cells: 1 in melee, farther with a bow equipped. */
  weaponRange(): number;
  /** Which combat skill the equipped weapon trains (attack vs archery). */
  combatSkillId(): string;
  /** Hand out a lump of combat XP, routed by the current attack style. */
  awardCombatXp(amount: number): void;
  /** Complete a construction: sets the persistent world flag. */
  setWorldFlag(flag: string): void;
  /** Active-buff bonus for a mechanic ("gathering" success, "focus" accuracy). */
  buffBonus(kind: string): number;
  /** Botched thievery stings: route damage through the player's defenses. */
  damagePlayer(amount: number): void;
  /** Lie down in a bed: set the respawn point here and sleep through to dawn. */
  sleepAt(cell: Cell): void;
  /** Whether the player is carrying a boat they can handle (water pathing). */
  canBoat(): boolean;
  /** Open a click-to-open door (unblocks it so the player can walk through). */
  openDoor(instanceId: string): void;
}

export class ActionController {
  phase: ActionPhase = "idle";
  private pipeline: Pipeline | null = null;
  private repathTried = false;
  openContainerId: string | null = null;
  openWorkstationId: string | null = null;
  openShopId: string | null = null;
  private deps: ActionDeps;

  constructor(deps: ActionDeps) {
    this.deps = deps;
  }

  currentTargetId(): string | null {
    return this.pipeline?.targetId ?? null;
  }

  /** The recipe being crafted right now, if the live pipeline is a craft. Lets
   *  the HUD label the progress bar with what's being made. */
  currentRecipeId(): string | null {
    return this.pipeline && this.pipeline.kind === "craft" ? this.pipeline.recipeId ?? null : null;
  }

  /** The animation the player rig should play for the live action, or null when
   *  idle/moving. Derived from the pipeline kind and (for gather/craft) skill. */
  currentActionAnim(): ActionAnim | null {
    const p = this.pipeline;
    if (!p || (this.phase !== "active" && this.phase !== "waitingForNextCycle")) return null;
    switch (p.kind) {
      case "enemy": return this.deps.weaponRange() > 1 ? "shoot" : "attack";
      case "build": return "hammer";
      case "plant": return "gather";
      case "craft": return p.recipeId ? animForSkill(RECIPES[p.recipeId].skillId) : "hammer";
      case "node": {
        const node = this.deps.nodes.get(p.targetId);
        return node ? animForSkill(NODES[node.defId]?.skillId ?? "") : "gather";
      }
      default: return null; // portals, doors, npcs, sleep, shortcuts: no work loop
    }
  }

  /** Progress of the current gather cycle in [0,1], for presentation. */
  cycleProgress(): number {
    if (!this.pipeline || (this.phase !== "active" && this.phase !== "waitingForNextCycle")) return 0;
    const total = this.cycleTicksTotal();
    return total > 0 ? 1 - this.pipeline.cycleTicksLeft / total : 0;
  }

  private cycleTicksTotal(): number {
    if (!this.pipeline) return 0;
    if (this.pipeline.kind === "craft" && this.pipeline.recipeId) {
      return secondsToTicks(RECIPES[this.pipeline.recipeId].cycleTimeS);
    }
    if (this.pipeline.kind === "enemy") {
      return secondsToTicks(PLAYER_COMBAT.attack.cadenceS);
    }
    if (this.pipeline.kind !== "node") return 0;
    const node = this.deps.nodes.get(this.pipeline.targetId);
    if (!node) return 0;
    return secondsToTicks(NODES[node.defId].cycleTimeS);
  }

  /** Entry point for InteractWithTarget commands. Supersedes any live pipeline. */
  request(targetId: string): void {
    this.supersede();
    this.closeContainer();
    this.closeWorkstation();
    const d = this.deps;

    // A ground item: just walk onto it — the sim auto-picks it up on arrival.
    const ground = d.groundItems.get(targetId);
    if (ground) return this.moveTo(ground.cell);

    const node = d.nodes.get(targetId);
    const npc = d.npcs.get(targetId);
    const enemy = d.enemies.get(targetId);
    const objectPlacement = d.world.region.objects.find((o) => o.instanceId === targetId);
    const structure = d.world.region.structures?.find((s) => s.instanceId === targetId);

    let kind: TargetKind;
    let targetCell: Cell;
    let rangeCells: number;
    let enterRegionId: string | undefined;
    let enterArrival: Cell | undefined;

    if (enemy) {
      if (enemy.phase !== "alive") return this.reject("no_target", targetId);
      kind = "enemy";
      targetCell = enemy.movement.currentCell();
      rangeCells = d.weaponRange();
    } else if (npc) {
      kind = "npc";
      targetCell = npc.movement.currentCell();
      rangeCells = 1;
      d.npcs.hold(targetId, 8); // stand still while being approached
    } else if (node) {
      targetCell = node.cell;
      const def = NODES[node.defId];
      rangeCells = def.interaction.rangeCells;
      if (d.skills.levelOf(def.skillId) < def.requiredLevel) {
        return this.reject("level_too_low", targetId);
      }
      if (node.phase === "active") {
        kind = "node";
        if (def.toolTagsAny.length > 0 && !d.hasTool(def.toolTagsAny)) {
          return this.reject("missing_tool", targetId);
        }
      } else if (def.plantable && node.respawnRemainingS < 0) {
        // An empty farm plot: walk over and plant a seed.
        kind = "plant";
        if (d.inventory.count(def.plantable.seedItemId) < 1) {
          return this.reject("missing_inputs", targetId);
        }
      } else {
        // Depleted, or a plot already growing.
        return this.reject("node_unavailable", targetId);
      }
    } else if (objectPlacement) {
      const objectDef = OBJECTS[objectPlacement.defId];
      // A door or fence gate with no portal is a click-to-open door (swing it
      // open, walk through, no travel).
      const isDoor = (objectPlacement.defId.startsWith("object.door.") ||
        objectPlacement.defId.startsWith("object.gate.")) && !objectPlacement.portal;
      if (!isDoor && !objectDef.interiorId && (objectDef.scenery || (!objectPlacement.portal && !objectDef.shopId &&
          !objectDef.workstationRecipeIds && !objectDef.containerSlots && !objectDef.buildRequires &&
          !objectDef.sleepable))) {
        return; // furniture and decor: a click does nothing
      }
      if (objectDef.buildRequires) {
        // Check the materials up front so the player doesn't walk for nothing.
        const missing = objectDef.buildRequires.some(
          (req) => d.inventory.count(req.itemId) < req.qty,
        );
        if (missing) return this.reject("missing_inputs", targetId);
      }
      if (objectDef.shortcut && d.skills.levelOf("skill.agility") < objectDef.shortcut.level) {
        return this.reject("level_too_low", targetId);
      }
      const isStairs = objectPlacement.defId.startsWith("object.stairs.");
      // An enterable code-drawn building (cottage/inn): clicking it walks to
      // the yard just outside and steps into its procedural interior — the
      // same flow imported structures use, keyed by the def's interiorId.
      // Only in the endless world: the interior's exit door leads back there.
      if (!isDoor && objectDef.interiorId && d.world.region.id === "region.endless") {
        const cells = [objectPlacement.cell, ...(objectPlacement.footprint ?? [])];
        const centre = {
          x: Math.round(cells.reduce((n, c) => n + c.x, 0) / cells.length),
          z: Math.round(cells.reduce((n, c) => n + c.z, 0) / cells.length),
        };
        const span = 2 + Math.max(1, ...cells.map((c) => Math.max(Math.abs(c.x - centre.x), Math.abs(c.z - centre.z))));
        const yard = d.world.nearestWalkable(centre, span) ?? d.movement.currentCell();
        kind = "enter";
        targetCell = yard;
        rangeCells = 0;
        enterRegionId = houseInteriorId(objectDef.interiorId, yard);
        enterArrival = houseInteriorArrival(objectDef.interiorId);
      } else {
        kind = isDoor
          ? "door"
          : isStairs
          ? "stairs"
          : objectDef.shortcut
          ? "shortcut"
          : objectDef.sleepable
            ? "sleep"
            : objectPlacement.portal
              ? "portal"
              : objectDef.shopId
                ? "shop"
                : objectDef.workstationRecipeIds
                  ? "workstation"
                  : objectDef.buildRequires
                    ? "build"
                    : "container";
        targetCell = objectPlacement.cell;
        rangeCells = objectDef.interaction.rangeCells;
      }
    } else if (structure && !structure.structureId.startsWith("lobby.")) {
      // A building you enter by clicking it: walk to the yard just outside, then
      // step into its reconstructed interior — no door object needed.
      const asset = getStructure(structure.structureId);
      if (!asset) return this.reject("no_target", targetId);
      const centre = { x: structure.cell.x + (asset.sx >> 1), z: structure.cell.z + (asset.sz >> 1) };
      const yard = d.world.nearestWalkable(centre, Math.max(asset.sx, asset.sz)) ?? d.movement.currentCell();
      kind = "enter";
      targetCell = yard;
      rangeCells = 0;
      enterRegionId = houseInteriorId(structure.structureId, yard);
      enterArrival = houseInteriorArrival(structure.structureId);
    } else {
      return this.reject("no_target", targetId);
    }

    d.events.emit({ type: "targetSelected", targetId, cell: targetCell });

    const playerCell = d.movement.currentCell();
    this.pipeline = { targetId, kind, targetCell, rangeCells, cycleTicksLeft: 0, enterRegionId, enterArrival };
    this.repathTried = false;

    // An instant portal (a building you click to step straight inside) travels
    // on the click — no walking to a doorway buried in the wall.
    if (kind === "portal" && objectPlacement?.portal?.instant) {
      this.beginAtTarget();
      return;
    }

    if (chebyshev(playerCell, targetCell) <= rangeCells) {
      this.beginAtTarget();
      return;
    }

    // Ranged weapons stop early on the way in; pathing aims for the melee ring
    // first so a clear shot is never required to start walking — but when the
    // melee ring is fenced off (a penned target), a ranged attacker instead
    // walks to any reachable cell WITHIN range and shoots over the fence.
    const pathRange = kind === "enemy" ? 1 : rangeCells;
    let path = this.pathToInteractionCell(playerCell, targetCell, pathRange);
    if (!path && kind === "enemy" && rangeCells > 1) {
      path = this.pathToInteractionCell(playerCell, targetCell, rangeCells);
    }
    if (!path) {
      // A solid building's door is walled into its mass, so no cell around it is
      // walkable — clicking the building still takes you inside. Any portal (or
      // click-to-enter building) you can't path to is entered on the spot.
      if (kind === "portal" || kind === "enter") {
        this.beginAtTarget();
        return;
      }
      this.pipeline = null;
      return this.reject("unreachable", targetId);
    }
    d.movement.setPath(path);
    d.events.emit({ type: "destinationSet", cell: path[path.length - 1] ?? playerCell });
    this.phase = "movingToTarget";
  }

  /**
   * Choose the nearest reachable interaction cell around the target (adjacent_4/8
   * both reduce to Chebyshev range on this grid) and return the path to it.
   */
  private pathToInteractionCell(from: Cell, target: Cell, range: number): Cell[] | null {
    const d = this.deps;
    // Thread the boat flag so a rower can approach targets across water (and
    // so interaction cells over water are considered), matching moveTo.
    const boat = d.canBoat();
    const candidates: Cell[] = [];
    // Range 0 means "walk onto the target cell itself" (a click-to-enter
    // building's yard cell) — path straight there rather than to a ring around
    // it, so the player actually walks over before entering.
    if (range === 0) {
      return d.world.walkable(target, boat) ? findPath(d.world, from, target, undefined, boat) : null;
    }
    for (let dx = -range; dx <= range; dx++) {
      for (let dz = -range; dz <= range; dz++) {
        if (dx === 0 && dz === 0) continue;
        const c = { x: target.x + dx, z: target.z + dz };
        if (d.world.walkable(c, boat)) candidates.push(c);
      }
    }
    let best: Cell[] | null = null;
    for (const c of candidates) {
      const path = findPath(d.world, from, c, undefined, boat);
      if (path && (best === null || path.length < best.length)) best = path;
    }
    return best;
  }

  /**
   * Start a crafting pipeline at an open workstation. The player must already
   * be in range (they just opened the station's recipe sheet).
   */
  craft(stationId: string, recipeId: string): void {
    const d = this.deps;
    const placement = d.world.region.objects.find((o) => o.instanceId === stationId);
    const def = placement ? OBJECTS[placement.defId] : undefined;
    if (!placement || !def?.workstationRecipeIds?.includes(recipeId)) {
      return this.reject("no_target", stationId);
    }
    const recipe = RECIPES[recipeId];
    if (chebyshev(d.movement.currentCell(), placement.cell) > def.interaction.rangeCells) {
      return this.reject("unreachable", stationId);
    }
    if (d.skills.levelOf(recipe.skillId) < recipe.requiredLevel) {
      return this.reject("level_too_low", stationId);
    }
    if (recipe.toolTagsAny && !d.hasTool(recipe.toolTagsAny)) {
      return this.reject("missing_tool", stationId);
    }
    if (!this.hasInputs(recipe)) {
      return this.reject("missing_inputs", stationId);
    }
    this.supersede();
    d.movement.faceToward(placement.cell);
    this.pipeline = {
      targetId: stationId,
      kind: "craft",
      targetCell: placement.cell,
      rangeCells: def.interaction.rangeCells,
      cycleTicksLeft: 0,
      recipeId,
    };
    d.events.emit({ type: "targetSelected", targetId: stationId, cell: placement.cell });
    d.events.emit({ type: "actionStarted", targetId: stationId });
    this.phase = "starting";
  }

  private hasInputs(recipe: RecipeDef): boolean {
    return recipe.inputs.every((i) => this.deps.inventory.count(i.itemId) >= i.qty);
  }

  /** Plain movement command: supersedes the pipeline and walks to the cell. */
  moveTo(cell: Cell): void {
    this.supersede();
    this.closeContainer();
    this.closeWorkstation();
    const d = this.deps;
    const boat = d.canBoat();
    if (!d.world.walkable(cell, boat)) return;
    const path = findPath(d.world, d.movement.currentCell(), cell, undefined, boat);
    if (!path) return;
    d.movement.setPath(path);
    d.events.emit({ type: "destinationSet", cell });
  }

  cancel(): void {
    if (this.pipeline || this.deps.movement.isMoving()) {
      this.end("cancelled", "user");
    }
    this.deps.movement.stop();
    this.closeContainer();
    this.closeWorkstation();
  }

  closeContainer(): void {
    if (this.openContainerId !== null) {
      this.openContainerId = null;
      this.deps.events.emit({ type: "containerClosed" });
    }
  }

  closeShop(): void {
    if (this.openShopId !== null) {
      this.openShopId = null;
      this.deps.events.emit({ type: "shopClosed" });
    }
  }

  closeWorkstation(): void {
    if (this.openWorkstationId !== null) {
      this.openWorkstationId = null;
      this.deps.events.emit({ type: "workstationClosed" });
    }
  }

  tick(): void {
    if (!this.pipeline) return;
    const d = this.deps;

    if (this.phase === "movingToTarget") {
      // Enemies move: track the live cell and repath continuously.
      if (this.pipeline.kind === "enemy") {
        const enemy = d.enemies.get(this.pipeline.targetId);
        if (!enemy || enemy.phase !== "alive") return this.end("interrupted", "target_invalid");
        this.pipeline.targetCell = enemy.movement.currentCell();
        const myCell = d.movement.currentCell();
        if (chebyshev(myCell, this.pipeline.targetCell) <= this.pipeline.rangeCells) {
          this.beginAtTarget();
          return;
        }
        if (!d.movement.isMoving()) {
          const path = this.pathToInteractionCell(myCell, this.pipeline.targetCell, 1);
          if (!path) return this.end("interrupted", "path_lost");
          d.movement.setPath(path);
        }
        return;
      }
      const playerCell = d.movement.currentCell();
      if (chebyshev(playerCell, this.pipeline.targetCell) <= this.pipeline.rangeCells && !d.movement.isMoving()) {
        this.beginAtTarget();
        return;
      }
      if (!d.movement.isMoving()) {
        // Path ended without reaching range: retry once, then give up.
        if (this.repathTried) return this.end("interrupted", "path_lost");
        this.repathTried = true;
        const path = this.pathToInteractionCell(playerCell, this.pipeline.targetCell, this.pipeline.rangeCells);
        if (!path) return this.end("interrupted", "path_lost");
        d.movement.setPath(path);
      }
      return;
    }

    if (this.phase === "starting") {
      this.phase = "active";
      this.pipeline.cycleTicksLeft = this.cycleTicksTotal();
      return;
    }

    if (this.phase === "active" || this.phase === "waitingForNextCycle") {
      this.pipeline.cycleTicksLeft -= 1;
      if (this.pipeline.cycleTicksLeft > 0) {
        this.phase = "waitingForNextCycle";
        return;
      }
      if (this.pipeline.kind === "craft") this.resolveCraftCycle();
      else if (this.pipeline.kind === "enemy") this.resolveAttackCycle();
      else this.resolveCycle();
    }
  }

  private beginAtTarget(): void {
    const d = this.deps;
    if (!this.pipeline) return;
    d.movement.stop();
    d.movement.faceToward(this.pipeline.targetCell);

    if (this.pipeline.kind === "container") {
      this.openContainerId = this.pipeline.targetId;
      d.events.emit({ type: "containerOpened", instanceId: this.pipeline.targetId });
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "workstation") {
      this.openWorkstationId = this.pipeline.targetId;
      d.events.emit({ type: "workstationOpened", instanceId: this.pipeline.targetId });
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "shop") {
      const placement = d.world.region.objects.find((o) => o.instanceId === this.pipeline!.targetId);
      const shopId = placement ? OBJECTS[placement.defId].shopId : undefined;
      if (shopId) {
        this.openShopId = this.pipeline.targetId;
        d.events.emit({ type: "shopOpened", instanceId: this.pipeline.targetId, shopId });
      }
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "portal") {
      const placement = d.world.region.objects.find((o) => o.instanceId === this.pipeline!.targetId);
      if (placement?.portal) {
        d.events.emit({
          type: "portalEntered",
          targetRegionId: placement.portal.targetRegionId,
          targetCell: placement.portal.targetCell,
        });
      }
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "enter") {
      // Reached the yard: step inside the building's reconstructed interior.
      if (this.pipeline.enterRegionId && this.pipeline.enterArrival) {
        d.events.emit({
          type: "portalEntered",
          targetRegionId: this.pipeline.enterRegionId,
          targetCell: this.pipeline.enterArrival,
        });
      }
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "enemy") {
      d.enemies.engage(this.pipeline.targetId);
      d.events.emit({ type: "actionStarted", targetId: this.pipeline.targetId });
      this.phase = "starting";
      return;
    }
    if (this.pipeline.kind === "build") {
      const placement = d.world.region.objects.find((o) => o.instanceId === this.pipeline!.targetId);
      const def = placement ? OBJECTS[placement.defId] : undefined;
      if (placement && def?.buildRequires) {
        const missing = def.buildRequires.some((req) => d.inventory.count(req.itemId) < req.qty);
        if (missing) {
          this.reject("missing_inputs", placement.instanceId);
        } else {
          for (const req of def.buildRequires) d.inventory.removeItemById(req.itemId, req.qty);
          d.events.emit({ type: "inventoryChanged" });
          if (def.buildSkillId && def.buildXp) d.skills.grantXp(def.buildSkillId, def.buildXp);
          if (def.completionFlag) d.setWorldFlag(def.completionFlag);
        }
      }
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "npc") {
      const npc = d.npcs.get(this.pipeline.targetId);
      if (npc) {
        npc.movement.faceToward(d.movement.currentCell());
        d.npcs.hold(npc.instanceId, 4); // stay put through the conversation
        d.events.emit({ type: "npcChat", instanceId: npc.instanceId, name: npc.name });
      }
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "plant") {
      const node = d.nodes.get(this.pipeline.targetId);
      const grow = node ? NODES[node.defId].plantable : undefined;
      if (node && grow && d.inventory.count(grow.seedItemId) >= 1 && d.nodes.plant(node.instanceId)) {
        d.inventory.removeItemById(grow.seedItemId, 1);
        d.skills.grantXp(NODES[node.defId].skillId, grow.plantXp);
        d.events.emit({ type: "planted", instanceId: node.instanceId, seedItemId: grow.seedItemId });
        d.events.emit({ type: "inventoryChanged" });
      }
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "sleep") {
      d.sleepAt(this.pipeline.targetCell);
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "door") {
      d.openDoor(this.pipeline.targetId);
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "stairs") {
      // Offer the directions this staircase serves (up and/or down) rather
      // than travelling on the first click — the app shell prompts, then
      // fires the chosen portal.
      const cell = this.pipeline.targetCell;
      const seen = new Set<string>();
      const options: Array<{ dir: "up" | "down"; targetRegionId: string; targetCell: Cell }> = [];
      for (const o of d.world.region.objects) {
        if (!o.defId.startsWith("object.stairs.") || !o.portal) continue;
        if (chebyshev(o.cell, cell) > 1) continue;
        const dir = o.defId.endsWith(".up") ? "up" : "down";
        if (seen.has(dir)) continue;
        seen.add(dir);
        options.push({ dir, targetRegionId: o.portal.targetRegionId, targetCell: o.portal.targetCell });
      }
      if (options.length > 0) d.events.emit({ type: "stairsChoice", cell, options });
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    if (this.pipeline.kind === "shortcut") {
      const placement = d.world.region.objects.find((o) => o.instanceId === this.pipeline!.targetId);
      const def = placement ? OBJECTS[placement.defId].shortcut : undefined;
      if (placement?.portal && def && d.world.walkable(placement.portal.targetCell)) {
        d.movement.setCellPosition(placement.portal.targetCell);
        d.skills.grantXp("skill.agility", def.xp);
        d.events.emit({ type: "shortcutUsed", instanceId: placement.instanceId });
      }
      this.pipeline = null;
      this.phase = "idle";
      return;
    }
    d.events.emit({ type: "actionStarted", targetId: this.pipeline.targetId });
    this.phase = "starting";
  }

  /** Runs one gather cycle: revalidate -> roll -> produce -> XP -> consume node. */
  private resolveCycle(): void {
    const d = this.deps;
    const pipeline = this.pipeline;
    if (!pipeline) return;
    const node = d.nodes.get(pipeline.targetId);
    if (!node || node.phase !== "active") return this.end("interrupted", "target_invalid");
    const def = NODES[node.defId];

    // Per-cycle revalidation: tool could have been unequipped/dropped, player moved.
    if (def.toolTagsAny.length > 0 && !d.hasTool(def.toolTagsAny)) {
      return this.end("interrupted", "missing_tool");
    }
    if (chebyshev(d.movement.currentCell(), node.cell) > pipeline.rangeCells) {
      return this.end("interrupted", "out_of_range");
    }

    const level = d.skills.levelOf(def.skillId);
    const bonus = def.toolTagsAny.length > 0 ? d.toolBonus(def.toolTagsAny) : 0;
    const chance = Math.min(
      def.successMax,
      def.successBase + def.successPerLevel * (level - def.requiredLevel) + bonus,
    ) + d.buffBonus("gathering"); // a Forager's Brew can push past the cap
    const success = d.rng.next() < chance;

    if (success) {
      const drop = pickDrop(def.drops, d.rng);
      const qty = d.rng.intBetween(drop.min, drop.max);
      if (!d.inventory.canAdd(drop.itemId, qty)) {
        d.events.emit({ type: "inventoryFull" });
        return this.end("failed", "inventory_full");
      }
      d.inventory.add(drop.itemId, qty);
      d.events.emit({ type: "itemGained", itemId: drop.itemId, qty });
      d.events.emit({ type: "inventoryChanged" });
      // Harvesting a sown crop always returns seed for the next planting, so
      // farming sustains itself (overflow falls at your feet).
      if (def.plantable && drop.itemId !== def.plantable.seedItemId) {
        const seeds = d.rng.intBetween(1, 2);
        if (d.inventory.canAdd(def.plantable.seedItemId, seeds)) {
          d.inventory.add(def.plantable.seedItemId, seeds);
          d.events.emit({ type: "itemGained", itemId: def.plantable.seedItemId, qty: seeds });
        } else {
          d.spawnGroundItem(d.movement.currentCell(), def.plantable.seedItemId, seeds);
        }
      }
      d.skills.grantXp(def.skillId, def.xpPerCycle);
      // Mining also has a rare chance to strike a gem — the finer the stone,
      // the rarer the find. Slips silently if the pack is full.
      if (def.skillId === "skill.mining" && d.rng.next() < MINING_GEM_CHANCE) {
        const gemId = pickGem(d.rng);
        if (d.inventory.canAdd(gemId, 1)) {
          d.inventory.add(gemId, 1);
          d.events.emit({ type: "gemFound", itemId: gemId });
          d.events.emit({ type: "inventoryChanged" });
        }
      }
      d.nodes.consumeOne(pipeline.targetId);
      d.events.emit({ type: "actionCycle", targetId: pipeline.targetId, success: true });
      const after = d.nodes.get(pipeline.targetId);
      if (!after || after.phase !== "active") {
        return this.end("completed", "target_depleted");
      }
    } else {
      d.events.emit({ type: "actionCycle", targetId: pipeline.targetId, success: false });
      // Thievery caught red-handed: take the hit, and the attempt ends.
      if (def.failDamage) {
        d.events.emit({ type: "thieveryCaught", targetId: pipeline.targetId, damage: def.failDamage });
        d.damagePlayer(def.failDamage);
        return this.end("failed", "caught");
      }
    }
    pipeline.cycleTicksLeft = this.cycleTicksTotal();
    this.phase = "waitingForNextCycle";
  }

  /**
   * One crafting cycle: revalidate -> consume inputs -> roll -> produce -> XP.
   * Inputs and outputs commit together at cycle end, so cancelling mid-cycle
   * never loses ingredients.
   */
  private resolveCraftCycle(): void {
    const d = this.deps;
    const pipeline = this.pipeline;
    if (!pipeline?.recipeId) return;
    const recipe = RECIPES[pipeline.recipeId];

    if (chebyshev(d.movement.currentCell(), pipeline.targetCell) > pipeline.rangeCells) {
      return this.end("interrupted", "out_of_range");
    }
    if (recipe.toolTagsAny && !d.hasTool(recipe.toolTagsAny)) {
      return this.end("interrupted", "missing_tool");
    }
    if (!this.hasInputs(recipe)) {
      return this.end("completed", "out_of_inputs");
    }

    const snapshot = d.inventory.snapshot();
    for (const input of recipe.inputs) d.inventory.removeItemById(input.itemId, input.qty);

    const level = d.skills.levelOf(recipe.skillId);
    const chance = Math.min(
      recipe.successMax,
      recipe.successBase + recipe.successPerLevel * (level - recipe.requiredLevel),
    );
    const success = d.rng.next() < chance;
    const outputs = success ? recipe.outputs : recipe.failOutputs ?? [];

    // Commit the whole output set atomically: add each output only if it all
    // fits, and emit itemGained *after* the set is confirmed. Emitting per-add
    // and then rolling back a later failure would leak itemGained events that
    // quest/collection progress already consumed (double-counting).
    let committed = true;
    for (const out of outputs) {
      if (!d.inventory.canAdd(out.itemId, out.qty)) { committed = false; break; }
      d.inventory.add(out.itemId, out.qty);
    }
    if (!committed) {
      d.inventory.restore(snapshot); // whole cycle rolls back (inputs refunded)
      d.events.emit({ type: "inventoryFull" });
      return this.end("failed", "inventory_full");
    }
    for (const out of outputs) d.events.emit({ type: "itemGained", itemId: out.itemId, qty: out.qty });
    d.events.emit({ type: "inventoryChanged" });
    if (success) d.skills.grantXp(recipe.skillId, recipe.xp);
    d.events.emit({ type: "actionCycle", targetId: pipeline.targetId, success });

    if (!this.hasInputs(recipe)) {
      return this.end("completed", "out_of_inputs");
    }
    pipeline.cycleTicksLeft = this.cycleTicksTotal();
    this.phase = "waitingForNextCycle";
  }

  /**
   * One attack cycle: accuracy roll -> damage (+ equipped weapon bonus) ->
   * loot and Combat XP on the kill. If the target slipped out of range,
   * fall back to chasing instead of ending the fight.
   */
  private resolveAttackCycle(): void {
    const d = this.deps;
    const pipeline = this.pipeline;
    if (!pipeline) return;
    const enemy = d.enemies.get(pipeline.targetId);
    if (!enemy || enemy.phase !== "alive") return this.end("interrupted", "target_invalid");

    pipeline.targetCell = enemy.movement.currentCell();
    if (chebyshev(d.movement.currentCell(), pipeline.targetCell) > pipeline.rangeCells) {
      this.phase = "movingToTarget";
      return;
    }
    d.movement.faceToward(pipeline.targetCell);

    // Bows loose a real arrow per shot: no arrows, no shooting. A missed
    // arrow lands by the target and can be picked back up; a hit breaks it
    // half the time (the rest are recoverable too).
    const usingBow = d.combatSkillId() === "skill.archery";
    let arrowId: string | null = null;
    let arrowBonus = 0;
    if (usingBow) {
      // Nock the deadliest arrow held: scan every arrow tier (not the fletching
      // shaft) and take the one with the highest damageBonus you actually have.
      let best = -1;
      for (const id of Object.keys(ITEMS)) {
        if (!id.startsWith("item.arrow.") || id === "item.arrow.shaft") continue;
        if (d.inventory.count(id) <= 0) continue;
        const bonus = ITEMS[id].damageBonus ?? 0;
        if (bonus > best) { best = bonus; arrowId = id; }
      }
      if (!arrowId) {
        this.reject("missing_inputs", pipeline.targetId);
        return this.end("failed", "out_of_arrows");
      }
      arrowBonus = best;
      d.inventory.removeItemById(arrowId, 1);
      d.events.emit({ type: "inventoryChanged" });
    }

    const attack = PLAYER_COMBAT.attack;
    const level = d.attackLevel();
    const weaponMods = d.weaponModEffects();
    const accuracy = Math.min(
      attack.accuracyMax,
      attack.accuracyBase + attack.accuracyPerLevel * (level - 1),
    ) + d.buffBonus("focus") + weaponMods.acc; // buffs and enchants pass the cap

    if (d.rng.next() < accuracy) {
      const levelDamageBonus = Math.floor((level - 1) / attack.dmgPerLevels);
      // Strength raises the melee max hit (RS-style): +1 damage per 8 levels.
      const melee = d.combatSkillId() === "skill.attack";
      const strengthBonus = melee ? Math.floor(d.skills.levelOf("skill.strength") / 8) : 0;
      const damage =
        d.rng.intBetween(attack.dmgMin, attack.dmgMax + levelDamageBonus) + d.weaponBonus() + strengthBonus + arrowBonus;
      const killed = d.enemies.damage(pipeline.targetId, damage);
      if (weaponMods.lifesteal > 0) d.healPlayer(weaponMods.lifesteal);
      d.events.emit({ type: "playerAttack", instanceId: pipeline.targetId, damage, killed });
      // A landed arrow survives half the time, stuck in the target's cell.
      if (arrowId && d.rng.next() < 0.5) d.spawnGroundItem(pipeline.targetCell, arrowId, 1);
      // Combat XP is routed by attack style (Attack / Strength / Defense, or
      // Archery for bows) with Constitution always taking a share.
      d.awardCombatXp(damage * attack.xpPerDamage);
      if (killed) {
        const def = ENEMIES[enemy.defId];
        // Felling a dungeon boss or its elite guard trains Dungeoneering.
        if (pipeline.targetId.endsWith(".boss") || pipeline.targetId.endsWith(".elite")) {
          d.skills.grantXp("skill.dungeoneering", Math.round(def.xpOnDefeat * 0.5));
        }
        // Putting down the undead channels Necromancy.
        if (def.view === "skeleton" || def.view === "zombie" || def.view === "husk") {
          d.skills.grantXp("skill.necromancy", Math.round(def.xpOnDefeat * 0.5));
        }
        for (const loot of def.loot) {
          if (d.rng.next() >= loot.chance) continue;
          const qty = d.rng.intBetween(loot.min, loot.max);
          if (d.inventory.canAdd(loot.itemId, qty)) {
            d.inventory.add(loot.itemId, qty);
            d.events.emit({ type: "itemGained", itemId: loot.itemId, qty });
            d.events.emit({ type: "inventoryChanged" });
          } else {
            // Pack is full: the drop falls where the enemy stood so it isn't lost.
            d.spawnGroundItem(enemy.movement.currentCell(), loot.itemId, qty);
          }
        }
        d.awardCombatXp(def.xpOnDefeat);
        return this.end("completed", "target_slain");
      }
    } else {
      d.events.emit({ type: "playerAttack", instanceId: pipeline.targetId, damage: null, killed: false });
      // A missed arrow sails past and lands by the target — walk over to
      // collect it once the fight is done.
      if (arrowId) d.spawnGroundItem(pipeline.targetCell, arrowId, 1);
    }
    pipeline.cycleTicksLeft = this.cycleTicksTotal();
    this.phase = "waitingForNextCycle";
  }

  private supersede(): void {
    if (this.pipeline) this.end("cancelled", "superseded");
  }

  private end(state: "completed" | "failed" | "cancelled" | "interrupted", reason: string): void {
    this.pipeline = null;
    this.phase = "idle";
    this.deps.movement.stop();
    this.deps.events.emit({ type: "actionEnded", state, reason });
  }

  private reject(reason: RejectReason, targetId: string): void {
    this.deps.events.emit({ type: "actionRejected", reason, targetId });
  }
}

function pickDrop(drops: Array<{ itemId: string; min: number; max: number; weight: number }>, rng: SimRng) {
  const total = drops.reduce((sum, d) => sum + d.weight, 0);
  let roll = rng.next() * total;
  for (const d of drops) {
    roll -= d.weight;
    if (roll <= 0) return d;
  }
  return drops[drops.length - 1];
}

/** Rarity-weighted pick from the mining gem table. */
function pickGem(rng: SimRng): string {
  const total = MINING_GEMS.reduce((sum, g) => sum + g.weight, 0);
  let roll = rng.next() * total;
  for (const g of MINING_GEMS) {
    roll -= g.weight;
    if (roll <= 0) return g.itemId;
  }
  return MINING_GEMS[MINING_GEMS.length - 1].itemId;
}

// Re-export for consumers that only need the item table for icons.
export { ITEMS };
