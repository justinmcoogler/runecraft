// Data-driven quests. Objectives advance purely off simulation events —
// no polling, no UI involvement. State is plain data for saves.

import { QUESTS, type QuestDef } from "../content/content";
import type { Inventory } from "./inventory";
import type { SkillService } from "./skills";
import type { SimEvent, SimEventBus } from "./types";

export type QuestStatus = "available" | "active" | "completed";

export interface QuestState {
  status: QuestStatus;
  objectiveIndex: number;
  progress: number; // gather-objective counter
}

export interface QuestDeps {
  inventory: Inventory;
  skills: SkillService;
  events: SimEventBus;
  hasEquippedTag(tag: string): boolean;
  /** Definition id of a live enemy instance (for slay objectives). */
  enemyDefOf(instanceId: string): string | undefined;
}

export class QuestService {
  states: Record<string, QuestState> = {};
  private defs: Record<string, QuestDef>;
  private deps: QuestDeps;

  constructor(deps: QuestDeps, defs: Record<string, QuestDef> = QUESTS) {
    this.deps = deps;
    this.defs = defs;
    for (const id of Object.keys(defs)) {
      this.states[id] = { status: "available", objectiveIndex: 0, progress: 0 };
    }
  }

  state(questId: string): QuestState {
    return this.states[questId];
  }

  /** The single active quest's current objective (prototype: quests are few). */
  activeObjective(questId: string) {
    const state = this.states[questId];
    if (state.status !== "active") return null;
    return this.defs[questId].objectives[state.objectiveIndex] ?? null;
  }

  /** A quest is offered only once its prerequisites are completed. */
  isAvailable(questId: string): boolean {
    const def = this.defs[questId];
    return (
      this.states[questId].status === "available" &&
      (def.prereqQuestIds ?? []).every((p) => this.states[p]?.status === "completed")
    );
  }

  /** For HUD/renderer: does this NPC have a quest to give ("!") or accept a delivery ("?")? */
  markFor(npcId: string): "give" | "ready" | null {
    for (const [id, def] of Object.entries(this.defs)) {
      if (def.giverNpcId !== npcId) continue;
      if (this.isAvailable(id)) return "give";
      const objective = this.activeObjective(id);
      if (
        objective?.type === "deliver" &&
        objective.npcId === npcId &&
        this.deps.inventory.count(objective.itemId!) >= (objective.qty ?? 0)
      ) {
        return "ready";
      }
    }
    return null;
  }

  /** Reminder line for talking to a quest giver with nothing to advance. */
  reminderFor(npcId: string): string | null {
    for (const [id, def] of Object.entries(this.defs)) {
      if (def.giverNpcId === npcId && this.states[id].status === "active") return def.reminder;
    }
    return null;
  }

  /** Consume this tick's events and advance quest state. May emit quest events. */
  process(events: SimEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case "npcChat":
          this.onTalk(ev.instanceId);
          break;
        case "itemGained":
          this.onItemGained(ev.itemId, ev.qty);
          break;
        case "equipmentChanged":
          for (const id of Object.keys(this.defs)) this.autoAdvance(id);
          break;
        case "enemyDied": {
          const defId = this.deps.enemyDefOf(ev.instanceId);
          if (defId) this.onSlain(defId);
          break;
        }
        default:
          break;
      }
    }
  }

  private onTalk(npcId: string): void {
    for (const [id, def] of Object.entries(this.defs)) {
      const state = this.states[id];
      if (def.giverNpcId === npcId && this.isAvailable(id)) {
        state.status = "active";
        this.deps.events.emit({ type: "questStarted", questId: id, name: def.name });
        // A tutor hands over the tool the lesson needs the moment you accept.
        for (const grant of def.startItems ?? []) {
          this.deps.inventory.add(grant.itemId, grant.qty);
          this.deps.events.emit({ type: "itemGained", itemId: grant.itemId, qty: grant.qty });
        }
        if (def.startItems?.length) this.deps.events.emit({ type: "inventoryChanged" });
        // A leading talk-objective is satisfied by this very conversation.
        const first = def.objectives[0];
        if (first.type === "talk" && first.npcId === npcId) this.advance(id);
        this.autoAdvance(id);
        continue;
      }
      const objective = this.activeObjective(id);
      if (!objective) continue;
      if (objective.type === "talk" && objective.npcId === npcId) {
        this.advance(id);
        this.autoAdvance(id);
      } else if (
        objective.type === "deliver" &&
        objective.npcId === npcId &&
        this.deps.inventory.count(objective.itemId!) >= (objective.qty ?? 0)
      ) {
        this.deps.inventory.removeItemById(objective.itemId!, objective.qty ?? 0);
        this.deps.events.emit({ type: "inventoryChanged" });
        this.advance(id);
      }
    }
  }

  private onItemGained(itemId: string, qty: number): void {
    for (const id of Object.keys(this.defs)) {
      const objective = this.activeObjective(id);
      if (objective?.type !== "gather" || objective.itemId !== itemId) continue;
      const state = this.states[id];
      state.progress += qty;
      if (state.progress >= (objective.qty ?? 0)) {
        this.advance(id);
        this.autoAdvance(id);
      } else {
        this.deps.events.emit({
          type: "questAdvanced",
          questId: id,
          label: objective.label,
        });
      }
    }
  }

  private onSlain(enemyDefId: string): void {
    for (const id of Object.keys(this.defs)) {
      const objective = this.activeObjective(id);
      if (objective?.type !== "slay" || objective.enemyDefId !== enemyDefId) continue;
      const state = this.states[id];
      state.progress += 1;
      if (state.progress >= (objective.qty ?? 1)) {
        this.advance(id);
        this.autoAdvance(id);
      } else {
        this.deps.events.emit({ type: "questAdvanced", questId: id, label: objective.label });
      }
    }
  }

  /** Skip objectives that are already satisfied (e.g. an axe is equipped). */
  private autoAdvance(questId: string): void {
    let objective = this.activeObjective(questId);
    while (objective?.type === "equipTag" && this.deps.hasEquippedTag(objective.toolTag!)) {
      this.advance(questId);
      objective = this.activeObjective(questId);
    }
  }

  private advance(questId: string): void {
    const def = this.defs[questId];
    const state = this.states[questId];
    state.objectiveIndex += 1;
    state.progress = 0;
    if (state.objectiveIndex >= def.objectives.length) {
      state.status = "completed";
      for (const reward of def.rewards.xp) this.deps.skills.grantXp(reward.skillId, reward.amount);
      for (const reward of def.rewards.items) {
        this.deps.inventory.add(reward.itemId, reward.qty);
        this.deps.events.emit({ type: "itemGained", itemId: reward.itemId, qty: reward.qty });
      }
      this.deps.events.emit({ type: "inventoryChanged" });
      this.deps.events.emit({ type: "questCompleted", questId, name: def.name });
    } else {
      this.deps.events.emit({
        type: "questAdvanced",
        questId,
        label: def.objectives[state.objectiveIndex].label,
      });
    }
  }
}
