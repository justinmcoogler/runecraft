// Skill XP and levels. Levels are always derived from XP (never stored separately),
// so save data cannot desync. Multi-level gains emit one event per level crossed.

import { CURVES, SKILLS, levelForXp } from "../content/content";
import type { SimEventBus } from "./types";

export class SkillService {
  xp: Record<string, number> = {};
  private events: SimEventBus;

  constructor(events: SimEventBus) {
    this.events = events;
    for (const id of Object.keys(SKILLS)) this.xp[id] = 0;
  }

  levelOf(skillId: string): number {
    const skill = SKILLS[skillId];
    return levelForXp(CURVES[skill.curveId], this.xp[skillId] ?? 0, skill.maxLevel);
  }

  grantXp(skillId: string, amount: number): void {
    if (amount <= 0) return;
    const before = this.levelOf(skillId);
    this.xp[skillId] = (this.xp[skillId] ?? 0) + amount;
    const after = this.levelOf(skillId);
    this.events.emit({ type: "xpGained", skillId, amount });
    for (let level = before + 1; level <= after; level++) {
      this.events.emit({ type: "levelUp", skillId, level });
    }
  }
}
