// Quest-helper lookups shared by the quest log, world-map markers and the
// on-screen objective pointer. Pure reads — no sim mutation.

import { NODES, QUESTS, ZONES, type QuestDef } from "../content/content";
import { buildOverworld } from "../sim/worldgen/overworld";
import type { GameSimulation } from "../sim/simulation";
import type { Cell } from "../sim/types";

export function zoneNameAt(x: number, z: number): string {
  const zone = ZONES.find((zn) => x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1);
  return zone?.name ?? "the wilds";
}

/** Overworld home cell of a quest giver (static placement). */
export function giverCell(questId: string): Cell | null {
  const def = QUESTS[questId];
  if (!def) return null;
  const npc = buildOverworld().region.npcs.find((n) => n.instanceId === def.giverNpcId);
  return npc ? npc.cell : null;
}

export interface QuestTarget {
  cell: Cell;
  questName: string;
  label: string;
  /** True when the target lives in the overworld (map can mark it). */
  overworld: boolean;
}

/** The first active quest's current objective, resolved to a world cell. */
export function activeQuestTarget(sim: GameSimulation): QuestTarget | null {
  for (const [questId, def] of Object.entries(QUESTS) as Array<[string, QuestDef]>) {
    const state = sim.quests.states[questId];
    if (state?.status !== "active") continue;
    const objective = def.objectives[state.objectiveIndex];
    if (!objective) continue;
    const fallback = giverCell(questId);
    const inOverworld = sim.world.region.id === "region.vale_clearing";

    let cell: Cell | null = null;
    let overworld = true;
    if (objective.type === "talk" || objective.type === "deliver") {
      cell = giverCell(questId);
      if (objective.npcId && objective.npcId !== def.giverNpcId) {
        const npc = buildOverworld().region.npcs.find((n) => n.instanceId === objective.npcId);
        if (npc) cell = npc.cell;
      }
    } else if (objective.type === "slay" && objective.enemyDefId) {
      // Nearest live enemy in the current region, else its overworld den.
      const p = sim.movement.pos;
      let best: Cell | null = null;
      let bestD = Infinity;
      for (const enemy of sim.enemies.enemies.values()) {
        if (enemy.defId !== objective.enemyDefId || enemy.hp <= 0) continue;
        const ep = enemy.movement.pos;
        const d = Math.hypot(ep.x - p.x, ep.z - p.z);
        if (d < bestD) {
          bestD = d;
          best = { x: Math.floor(ep.x), z: Math.floor(ep.z) };
        }
      }
      if (best) {
        cell = best;
        overworld = inOverworld;
      } else {
        const spawn = buildOverworld().region.enemies?.find((e) => e.defId === objective.enemyDefId);
        if (spawn) cell = spawn.cell;
      }
    } else if (objective.type === "gather" && objective.itemId) {
      // Nearest node in the current region that drops the wanted item.
      const p = sim.movement.pos;
      let best: Cell | null = null;
      let bestD = Infinity;
      for (const node of sim.world.region.nodes) {
        const nodeDef = NODES[node.defId];
        if (!nodeDef?.drops?.some((drop) => drop.itemId === objective.itemId)) continue;
        const d = Math.hypot(node.cell.x - p.x, node.cell.z - p.z);
        if (d < bestD) {
          bestD = d;
          best = node.cell;
        }
      }
      if (best) {
        cell = best;
        overworld = inOverworld;
      }
    }

    cell = cell ?? fallback;
    if (!cell) return null;
    return { cell, questName: def.name, label: objective.label, overworld };
  }
  return null;
}

export type QuestLogStatus = "active" | "ready" | "available" | "completed" | "locked";

export interface QuestLogEntry {
  questId: string;
  name: string;
  status: QuestLogStatus;
  giverName: string;
  /** "Prior Ashwin — Highforge Highlands" style location line. */
  where: string;
  /** Current objective label (active quests only). */
  objective?: string;
  progress?: string;
}

export function questLog(sim: GameSimulation): QuestLogEntry[] {
  const entries: QuestLogEntry[] = [];
  const npcs = buildOverworld().region.npcs;
  for (const [questId, def] of Object.entries(QUESTS) as Array<[string, QuestDef]>) {
    const state = sim.quests.states[questId];
    const npc = npcs.find((n) => n.instanceId === def.giverNpcId);
    const giverName = npc?.name ?? "someone";
    const where = npc ? `${giverName} — ${zoneNameAt(npc.cell.x, npc.cell.z)}` : giverName;
    let status: QuestLogStatus;
    let objective: string | undefined;
    let progress: string | undefined;
    if (state?.status === "completed") status = "completed";
    else if (state?.status === "active") {
      status = "active";
      const obj = def.objectives[state.objectiveIndex];
      if (obj) {
        objective = obj.label;
        const countable = obj.type === "gather" || obj.type === "slay";
        if (countable && (obj.qty ?? 0) > 1) {
          progress = `${Math.min(state.progress, obj.qty!)}/${obj.qty}`;
        }
        if (
          obj.type === "deliver" &&
          obj.itemId &&
          sim.inventory.count(obj.itemId) >= (obj.qty ?? 0)
        ) {
          status = "ready";
        }
      }
    } else if (sim.quests.isAvailable(questId)) status = "available";
    else status = "locked";
    entries.push({ questId, name: def.name, status, giverName, where, objective, progress });
  }
  const order: QuestLogStatus[] = ["ready", "active", "available", "locked", "completed"];
  entries.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return entries;
}
