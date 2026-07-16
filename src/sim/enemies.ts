// Enemy simulation: wandering, aggro, chase, attack cadence, leashing,
// death and respawn. Runs on the same fixed tick as everything else.

import { ENEMIES, PLAYER_COMBAT } from "../content/content";
import { MovementController } from "./movement";
import { findPath } from "./pathfinding";
import type { Cell, SimEventBus, SimRng } from "./types";
import { chebyshev } from "./types";
import type { WorldState } from "./world";

export type EnemyPhase = "alive" | "dead";

export interface EnemyState {
  instanceId: string;
  defId: string;
  home: Cell;
  movement: MovementController;
  hp: number;
  phase: EnemyPhase;
  respawnRemainingS: number;
  engaged: boolean;
  returningHome: boolean;
  attackCooldownS: number;
  repathCooldownS: number;
  wanderCooldownS: number;
  /** Chickens only: seconds until they lay the next egg on the ground. */
  eggTimerS: number;
}

export interface EnemyDeps {
  world: WorldState;
  events: SimEventBus;
  getPlayerCell(): Cell;
  isPlayerAlive(): boolean;
  getDefenseLevel(): number;
  damagePlayer(amount: number): void;
  /** Drop a stack on the ground (chickens laying eggs). */
  spawnGroundItem(cell: Cell, itemId: string, qty: number): void;
}

export class EnemySystem {
  enemies = new Map<string, EnemyState>();
  private deps: EnemyDeps;

  constructor(deps: EnemyDeps, rng: SimRng) {
    this.deps = deps;
    for (const placement of deps.world.region.enemies ?? []) this.addPlacement(placement, rng);
  }

  /** Spawn one enemy at runtime (chunk streaming uses this too). */
  addPlacement(placement: { instanceId: string; defId: string; cell: Cell }, rng: SimRng): void {
    const def = ENEMIES[placement.defId];
    const movement = new MovementController();
    movement.speedCellsPerS = 2.6;
    movement.setCellPosition(placement.cell);
    this.enemies.set(placement.instanceId, {
      instanceId: placement.instanceId,
      defId: placement.defId,
      home: placement.cell,
      movement,
      hp: def.maxHealth,
      phase: "alive",
      respawnRemainingS: 0,
      engaged: false,
      returningHome: false,
      attackCooldownS: def.attack.cadenceS,
      repathCooldownS: 0,
      wanderCooldownS: 2 + rng.next() * 4,
      eggTimerS: 20 + rng.next() * 25,
    });
  }

  /** Retire an enemy whose chunk unloaded. */
  removePlacement(instanceId: string): void {
    this.enemies.delete(instanceId);
  }

  get(instanceId: string): EnemyState | undefined {
    return this.enemies.get(instanceId);
  }

  engage(instanceId: string): void {
    const enemy = this.enemies.get(instanceId);
    if (enemy && enemy.phase === "alive" && !ENEMIES[enemy.defId].stationary) {
      enemy.engaged = true;
      enemy.returningHome = false;
    }
  }

  disengageAll(): void {
    for (const enemy of this.enemies.values()) {
      if (enemy.engaged) this.leashReset(enemy);
    }
  }

  /** Apply player damage. Returns whether this killed the enemy. */
  damage(instanceId: string, amount: number): boolean {
    const enemy = this.enemies.get(instanceId);
    if (!enemy || enemy.phase !== "alive") return false;
    // Stationary targets never retaliate/chase — engaging one would trip its
    // leash and heal it to full, making it unkillable.
    if (!ENEMIES[enemy.defId].stationary) enemy.engaged = true;
    enemy.hp -= amount;
    if (enemy.hp > 0) return false;
    const def = ENEMIES[enemy.defId];
    enemy.phase = "dead";
    enemy.hp = 0;
    enemy.engaged = false;
    enemy.respawnRemainingS = def.respawnS;
    this.deps.events.emit({ type: "enemyDied", instanceId });
    return true;
  }

  private leashReset(enemy: EnemyState): void {
    // Classic leash: give up, walk home, recover fully.
    enemy.engaged = false;
    enemy.returningHome = true;
    enemy.hp = ENEMIES[enemy.defId].maxHealth;
    const path = findPath(this.deps.world, enemy.movement.currentCell(), enemy.home);
    if (path) enemy.movement.setPath(path);
  }

  tick(dtSeconds: number, rng: SimRng): void {
    const playerCell = this.deps.getPlayerCell();
    const playerAlive = this.deps.isPlayerAlive();

    for (const enemy of this.enemies.values()) {
      const def = ENEMIES[enemy.defId];

      if (enemy.phase === "dead") {
        enemy.respawnRemainingS -= dtSeconds;
        if (enemy.respawnRemainingS <= 0) {
          enemy.phase = "alive";
          enemy.hp = def.maxHealth;
          enemy.movement.setCellPosition(enemy.home);
          enemy.returningHome = false;
          this.deps.events.emit({ type: "enemyRespawned", instanceId: enemy.instanceId });
        }
        continue;
      }

      // A stationary target just stands there: no wander, chase or leash.
      if (def.stationary) continue;

      enemy.movement.tick(dtSeconds);

      // Chickens periodically lay an egg on the ground for the player to grab.
      if (enemy.defId === "enemy.chicken") {
        enemy.eggTimerS -= dtSeconds;
        if (enemy.eggTimerS <= 0) {
          enemy.eggTimerS = 25 + rng.next() * 30;
          this.deps.spawnGroundItem(enemy.movement.currentCell(), "item.egg", 1);
        }
      }

      if (enemy.engaged && playerAlive) {
        const myCell = enemy.movement.currentCell();
        if (chebyshev(myCell, enemy.home) > def.leashRadiusCells) {
          this.leashReset(enemy);
          continue;
        }
        if (chebyshev(myCell, playerCell) <= 1) {
          enemy.movement.stop();
          enemy.movement.faceToward(playerCell);
          enemy.attackCooldownS -= dtSeconds;
          if (enemy.attackCooldownS <= 0) {
            enemy.attackCooldownS = def.attack.cadenceS;
            // Defense shaves the attacker's chance to land a hit.
            const hitChance = Math.max(
              PLAYER_COMBAT.defense.enemyHitChanceMin,
              def.attack.accuracy -
                PLAYER_COMBAT.defense.enemyHitReductionPerLevel * (this.deps.getDefenseLevel() - 1),
            );
            if (rng.next() < hitChance) {
              const dmg = rng.intBetween(def.attack.dmgMin, def.attack.dmgMax);
              this.deps.events.emit({ type: "enemyAttack", instanceId: enemy.instanceId, damage: dmg });
              this.deps.damagePlayer(dmg);
            } else {
              this.deps.events.emit({ type: "enemyAttack", instanceId: enemy.instanceId, damage: null });
            }
          }
        } else {
          // Chase: repath toward a cell adjacent to the player.
          enemy.repathCooldownS -= dtSeconds;
          if (enemy.repathCooldownS <= 0) {
            enemy.repathCooldownS = 0.8;
            const path = this.pathToward(myCell, playerCell);
            if (path) enemy.movement.setPath(path);
          }
        }
        continue;
      }
      if (enemy.engaged && !playerAlive) {
        this.leashReset(enemy);
        continue;
      }

      // Idle: aggro check, then wander.
      if (
        def.aggroRadiusCells > 0 &&
        playerAlive &&
        chebyshev(enemy.movement.currentCell(), playerCell) <= def.aggroRadiusCells
      ) {
        enemy.engaged = true;
        continue;
      }
      if (enemy.returningHome && !enemy.movement.isMoving()) enemy.returningHome = false;
      if (enemy.movement.isMoving()) continue;
      enemy.wanderCooldownS -= dtSeconds;
      if (enemy.wanderCooldownS > 0) continue;
      enemy.wanderCooldownS = 3 + rng.next() * 5;
      for (let attempt = 0; attempt < 6; attempt++) {
        const target: Cell = {
          x: enemy.home.x + rng.intBetween(-def.wanderRadiusCells, def.wanderRadiusCells),
          z: enemy.home.z + rng.intBetween(-def.wanderRadiusCells, def.wanderRadiusCells),
        };
        if (!this.deps.world.walkable(target)) continue;
        const path = findPath(this.deps.world, enemy.movement.currentCell(), target);
        if (path && path.length > 0) {
          enemy.movement.setPath(path);
          break;
        }
      }
    }
  }

  private pathToward(from: Cell, target: Cell): Cell[] | null {
    let best: Cell[] | null = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        const c = { x: target.x + dx, z: target.z + dz };
        if (!this.deps.world.walkable(c)) continue;
        const path = findPath(this.deps.world, from, c);
        if (path && (best === null || path.length < best.length)) best = path;
      }
    }
    return best;
  }
}
