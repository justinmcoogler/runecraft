// Tutorial lesson driver. Watches each tick's drained events (and the player's
// position) to advance two tracks:
//   • the required core — one lesson per act, linear, gates graduation;
//   • the optional bonus lessons — done opportunistically at the stations the
//     vale provides, never gating, each paying a small item + XP once.
// When the last required lesson finishes it flags completion so the graduation
// gateway opens.

import {
  TUTORIAL_LESSONS,
  TUTORIAL_OPTIONAL,
  TUTORIAL_GUIDE_ID,
  TUTORIAL_TREE_ID,
  TUTORIAL_FOE_ID,
  type LessonTrigger,
  type TutorialLesson,
} from "../content/tutorial";
import type { GameSimulation } from "./simulation";
import type { Cell, SimEvent } from "./types";
import { chebyshev } from "./types";

export class TutorialDriver {
  index = 0;
  complete = false;
  readonly optionalDone = new Set<string>();
  private started = false;

  constructor(private sim: GameSimulation) {}

  /** The active required lesson, or null once the core track is done. */
  get current(): TutorialLesson | null {
    return this.complete ? null : TUTORIAL_LESSONS[this.index] ?? null;
  }

  private markerCell(marker: TutorialLesson["marker"]): Cell | null {
    const r = this.sim.world.region;
    if (marker === "guide") return r.npcs.find((n) => n.instanceId === TUTORIAL_GUIDE_ID)?.cell ?? null;
    if (marker === "tree") return r.nodes.find((n) => n.instanceId === TUTORIAL_TREE_ID)?.cell ?? null;
    if (marker === "foe") return (r.enemies ?? []).find((e) => e.instanceId === TUTORIAL_FOE_ID)?.cell ?? null;
    return null;
  }

  /** Add to the pack. `silent` skips itemGained so a granted reagent never
   *  trips an optional lesson that watches for that item. */
  private grant(itemId: string, qty: number, silent = false): void {
    const added = this.sim.inventory.add(itemId, qty);
    if (added > 0) {
      if (!silent) this.sim.events.emit({ type: "itemGained", itemId, qty: added });
      this.sim.events.emit({ type: "inventoryChanged" });
    }
  }

  /** Announce the first objective. The optional-lesson gear lives in the
   *  supply crate at camp (see tutorialRegion), not force-fed into the 20-slot
   *  pack, so nothing overflows and opening the crate itself teaches containers. */
  begin(): void {
    if (this.started) return;
    this.started = true;
    this.enter(0);
  }

  private enter(i: number): void {
    const lesson = TUTORIAL_LESSONS[i];
    for (const g of lesson.grant ?? []) this.grant(g.itemId, g.qty, true);
    this.sim.events.emit({
      type: "tutorialObjective",
      index: i,
      total: TUTORIAL_LESSONS.length,
      title: lesson.title,
      blurb: lesson.blurb,
    });
  }

  /** Whether this trigger fired given the tick's events + player position. */
  private fired(trigger: LessonTrigger, events: SimEvent[]): boolean {
    switch (trigger.kind) {
      case "reachGuide": {
        const g = this.markerCell("guide");
        return !!g && chebyshev(this.sim.movement.currentCell(), g) <= 1;
      }
      case "logGained":
        return events.some((e) => e.type === "itemGained" && e.itemId.startsWith("item.log."));
      case "logBurned":
        return events.some((e) => e.type === "logBurned");
      case "bonesBuried":
        return events.some((e) => e.type === "bonesBuried");
      case "enemyDefeated":
        return events.some((e) => e.type === "enemyDied");
      case "itemPrefix":
        return events.some((e) => e.type === "itemGained" && e.itemId.startsWith(trigger.prefix));
      case "skillXp":
        return events.some((e) => e.type === "xpGained" && e.skillId === trigger.skillId);
      case "eventType":
        return events.some((e) => e.type === trigger.eventType);
    }
  }

  /** React to a tick's events + player position; advance both tracks. */
  process(events: SimEvent[]): void {
    if (!this.started) return;
    // Optional bonus lessons: award any whose activity just happened.
    for (const lesson of TUTORIAL_OPTIONAL) {
      if (this.optionalDone.has(lesson.id)) continue;
      if (!this.fired(lesson.trigger, events)) continue;
      this.optionalDone.add(lesson.id);
      this.payReward(lesson);
      this.sim.events.emit({
        type: "tutorialLessonDone",
        index: -1,
        title: lesson.title,
        optional: true,
        skillId: lesson.skillId,
      });
    }
    // Required core: linear, gates graduation.
    if (this.complete) return;
    const lesson = TUTORIAL_LESSONS[this.index];
    if (!this.fired(lesson.trigger, events)) return;
    this.payReward(lesson);
    this.sim.events.emit({ type: "tutorialLessonDone", index: this.index, title: lesson.title });
    this.index++;
    if (this.index >= TUTORIAL_LESSONS.length) {
      this.complete = true;
      this.sim.events.emit({ type: "tutorialComplete" });
    } else {
      this.enter(this.index);
    }
  }

  private payReward(lesson: TutorialLesson): void {
    for (const it of lesson.reward.items ?? []) this.grant(it.itemId, it.qty);
    if (lesson.reward.xp) this.sim.skills.grantXp(lesson.reward.xp.skillId, lesson.reward.xp.amount);
  }
}
