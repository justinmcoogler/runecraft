// Skill XP and levels. Levels are always derived from XP (never stored separately),
// so save data cannot desync. Multi-level gains emit one event per level crossed.

import { CURVES, SKILLS, levelForXp } from "../content/content";
import type { SimEventBus } from "./types";

export class SkillService {
  xp: Record<string, number> = {};
  private events: SimEventBus;

  constructor(events: SimEventBus) {
    this.events = events;
    for (const id of Object.keys(SKILLS)) {
      if (!SKILLS[id].mergedInto) this.xp[id] = 0;
    }
  }

  /** Merged skills (Smelting→Smithing, Brewing→Herblore) route to their home. */
  private resolve(skillId: string): string {
    return SKILLS[skillId]?.mergedInto ?? skillId;
  }

  /** Fold XP saved under since-merged skill ids into their new home (old saves). */
  migrateMerged(): void {
    for (const [id, def] of Object.entries(SKILLS)) {
      if (!def.mergedInto || !this.xp[id]) continue;
      this.xp[def.mergedInto] = (this.xp[def.mergedInto] ?? 0) + this.xp[id];
      delete this.xp[id];
    }
  }

  levelOf(skillId: string): number {
    const id = this.resolve(skillId);
    const skill = SKILLS[id];
    return levelForXp(CURVES[skill.curveId], this.xp[id] ?? 0, skill.maxLevel);
  }

  grantXp(skillId: string, amount: number): void {
    if (amount <= 0) return;
    const id = this.resolve(skillId);
    const before = this.levelOf(id);
    this.xp[id] = (this.xp[id] ?? 0) + amount;
    const after = this.levelOf(id);
    this.events.emit({ type: "xpGained", skillId: id, amount });
    for (let level = before + 1; level <= after; level++) {
      this.events.emit({ type: "levelUp", skillId: id, level });
    }
  }
}
