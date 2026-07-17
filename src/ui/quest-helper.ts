// Quest-helper lookups shared by the quest log, world-map markers and the
// on-screen objective pointer. Pure reads — no sim mutation.

import { NODES, ZONES, type QuestDef } from "../content/content";
import { buildOverworld } from "../sim/worldgen/overworld";
import type { GameSimulation } from "../sim/simulation";
import type { Cell } from "../sim/types";

export function zoneNameAt(x: number, z: number): string {
  const zone = ZONES.find((zn) => x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1);
  return zone?.name ?? "the wilds";
}

/** The live cell of an NPC — the current region first (tutorial/endless quest
 *  givers live there), falling back to the authored overworld (province mode).
 *  NEVER falls back in the endless region: overworld cells live in a different
 *  coordinate space, and pointing guidance at one once sent the pathfinder on
 *  a 30,000-cell march that froze and crashed the game. */
export function npcCell(sim: GameSimulation, npcId: string): Cell | null {
  const here = sim.world.region.npcs.find((n) => n.instanceId === npcId);
  if (here) return here.cell;
  if (sim.world.region.id === "region.endless") return null;
  const over = buildOverworld().region.npcs.find((n) => n.instanceId === npcId);
  return over ? over.cell : null;
}

/** Home cell of a quest giver. */
export function giverCell(sim: GameSimulation, questId: string): Cell | null {
  const def = sim.quests.defOf(questId);
  return def ? npcCell(sim, def.giverNpcId) : null;
}

/** Cell of any world instance in the current region (node, station object,
 *  penned enemy or NPC) by its instanceId — used to lead a lesson to its
 *  resource / station rather than back to the tutor. */
function instanceCell(sim: GameSimulation, id: string): Cell | null {
  const region = sim.world.region;
  const node = region.nodes.find((n) => n.instanceId === id);
  if (node) return node.cell;
  const obj = region.objects.find((o) => o.instanceId === id);
  if (obj) return obj.cell;
  const enemy = (region.enemies ?? []).find((e) => e.instanceId === id);
  if (enemy) return enemy.cell;
  const npc = region.npcs.find((n) => n.instanceId === id);
  if (npc) return npc.cell;
  return null;
}

/** Nearest node in the current region that drops the wanted item. */
function nearestNodeDropping(sim: GameSimulation, itemId: string): Cell | null {
  const p = sim.movement.pos;
  let best: Cell | null = null;
  let bestD = Infinity;
  for (const node of sim.world.region.nodes) {
    const nodeDef = NODES[node.defId];
    if (!nodeDef?.drops?.some((drop) => drop.itemId === itemId)) continue;
    const d = Math.hypot(node.cell.x - p.x, node.cell.z - p.z);
    if (d < bestD) { bestD = d; best = node.cell; }
  }
  return best;
}

export interface QuestTarget {
  cell: Cell;
  questName: string;
  label: string;
  /** True when the target lives in the overworld (map can mark it). */
  overworld: boolean;
}

/** Display name of a quest's giver, current region first. */
function giverName(sim: GameSimulation, questId: string): string {
  const def = sim.quests.defOf(questId);
  if (!def) return "the quest giver";
  const here = sim.world.region.npcs.find((n) => n.instanceId === def.giverNpcId);
  const over = buildOverworld().region.npcs.find((n) => n.instanceId === def.giverNpcId);
  return here?.name ?? over?.name ?? "the quest giver";
}

/** Quest ids ordered so the player's pinned (tracked) quest is considered first. */
function trackedFirst(sim: GameSimulation): string[] {
  const ids = sim.quests.allIds();
  const tracked = sim.trackedQuestId;
  if (tracked && ids.includes(tracked)) return [tracked, ...ids.filter((id) => id !== tracked)];
  return ids;
}

/**
 * The tracked quest's objective (or, with nothing pinned, the first active
 * quest's), resolved to a world cell. A pinned-but-unstarted quest points at
 * its giver so the guidance line leads you there to begin it.
 */
export function activeQuestTarget(sim: GameSimulation): QuestTarget | null {
  const region = sim.world.region.id;
  const inOverworld = region === "region.vale_clearing" || region === "region.tutorial" || region === "region.endless";
  for (const questId of trackedFirst(sim)) {
    const def = sim.quests.defOf(questId) as QuestDef;
    if (!def) continue;
    const state = sim.quests.states[questId];
    // A pinned quest you haven't started yet: lead to the giver to begin it.
    if (state?.status !== "active") {
      if (questId === sim.trackedQuestId && sim.quests.isAvailable(questId)) {
        const cell = giverCell(sim, questId);
        if (cell) return { cell, questName: def.name, label: `Talk to ${giverName(sim, questId)} to begin`, overworld: inOverworld };
      }
      continue;
    }
    const objective = def.objectives[state.objectiveIndex];
    if (!objective) continue;
    const fallback = giverCell(sim, questId);
    // A target is "showable" (map marker + on-screen pointer) whenever it
    // resolves to a cell in the region the player is actually in.
    let cell: Cell | null = null;
    let overworld = inOverworld;
    if (objective.type === "talk") {
      cell = objective.npcId ? npcCell(sim, objective.npcId) : giverCell(sim, questId);
    } else if (objective.type === "deliver") {
      // Still gathering? Lead to the resource (explicit station, else nearest
      // node dropping it). Once you're carrying enough, lead to the giver to
      // hand it in.
      const have = objective.itemId ? sim.inventory.count(objective.itemId) : Infinity;
      if (objective.itemId && have < (objective.qty ?? 1)) {
        cell = (objective.atId ? instanceCell(sim, objective.atId) : null) ?? nearestNodeDropping(sim, objective.itemId);
      }
      cell = cell ?? (objective.npcId ? npcCell(sim, objective.npcId) : giverCell(sim, questId));
    } else if (objective.type === "train") {
      // Lead to the station where the craft is performed.
      cell = objective.atId ? instanceCell(sim, objective.atId) : null;
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
      } else if (sim.world.region.id !== "region.endless") {
        // Foreign-coordinate fallback is only valid in the authored provinces.
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
  const here = sim.world.region.npcs;
  const over = buildOverworld().region.npcs;
  const inTutorial = sim.world.region.id === "region.tutorial";
  for (const questId of sim.quests.allIds()) {
    const def = sim.quests.defOf(questId) as QuestDef;
    const state = sim.quests.states[questId];
    // Villager errands only join the log once accepted (talking to the
    // villager accepts them) — an endless world holds endless "available"
    // errands, and listing them all would drown the real to-do list.
    if (questId.startsWith("vq.") && state?.status !== "active" && state?.status !== "completed") continue;
    // Outside the tutorial, its ~35 island lessons can never be started —
    // only ones the player actually did (or skipped past) belong in the log.
    if (!inTutorial && questId.startsWith("quest.tut_") && state?.status !== "active" && state?.status !== "completed") continue;
    const npc = here.find((n) => n.instanceId === def.giverNpcId) ?? over.find((n) => n.instanceId === def.giverNpcId);
    const giverName = npc?.name ?? "someone";
    const where = npc ? giverName : "the vale";
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
