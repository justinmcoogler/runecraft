// Tutorial lesson driver. A single ordered, all-required track: it watches each
// tick's drained events (and the player's position), advances one lesson at a
// time, grants that lesson's reagents on entry and its reward on completion,
// and emits the tutorial UI events. Finishing the last lesson flags completion
// so the graduation gateway opens.

import { TUTORIAL_LESSONS, TUTORIAL_GUIDE_ID, type LessonTrigger, type TutorialLesson } from "../content/tutorial";
import type { GameSimulation } from "./simulation";
import type { Cell, SimEvent } from "./types";
import { chebyshev } from "./types";

export class TutorialDriver {
  index = 0;
  complete = false;
  private started = false;

  constructor(private sim: GameSimulation) {}

  /** The active lesson, or null once every lesson is done. */
  get current(): TutorialLesson | null {
    return this.complete ? null : TUTORIAL_LESSONS[this.index] ?? null;
  }

  /** Resolve a placed prop's cell by instance id across every region list. */
  private cellOf(instanceId: string): Cell | null {
    const r = this.sim.world.region;
    return (
      r.npcs.find((n) => n.instanceId === instanceId)?.cell ??
      r.nodes.find((n) => n.instanceId === instanceId)?.cell ??
      r.objects.find((o) => o.instanceId === instanceId)?.cell ??
      (r.enemies ?? []).find((e) => e.instanceId === instanceId)?.cell ??
      null
    );
  }

  /** The waypoint cell for the current objective (for the renderer beacon). */
  markerCell(): Cell | null {
    const lesson = this.current;
    return lesson?.markerId ? this.cellOf(lesson.markerId) : null;
  }

  /** Add to the pack silently (no itemGained, so a granted reagent never trips
   *  the lesson that watches for that item). */
  private grant(itemId: string, qty: number, silent = false): void {
    const added = this.sim.inventory.add(itemId, qty);
    if (added > 0) {
      if (!silent) this.sim.events.emit({ type: "itemGained", itemId, qty: added });
      this.sim.events.emit({ type: "inventoryChanged" });
    }
  }

  /** Announce the first objective. Call once, right after the sim is built. */
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

  private fired(trigger: LessonTrigger, events: SimEvent[]): boolean {
    switch (trigger.kind) {
      case "reachGuide": {
        const g = this.cellOf(TUTORIAL_GUIDE_ID);
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

  /** React to a tick's events + player position; advance the required track. */
  process(events: SimEvent[]): void {
    if (this.complete || !this.started) return;
    const lesson = TUTORIAL_LESSONS[this.index];
    if (!this.fired(lesson.trigger, events)) return;
    for (const it of lesson.reward.items ?? []) this.grant(it.itemId, it.qty);
    if (lesson.reward.xp) this.sim.skills.grantXp(lesson.reward.xp.skillId, lesson.reward.xp.amount);
    this.sim.events.emit({ type: "tutorialLessonDone", index: this.index, title: lesson.title });
    this.index++;
    if (this.index >= TUTORIAL_LESSONS.length) {
      this.complete = true;
      this.sim.events.emit({ type: "tutorialComplete" });
    } else {
      this.enter(this.index);
    }
  }
}
