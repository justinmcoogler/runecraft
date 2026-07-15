// Tutorial lesson driver. Watches each tick's drained events (and the player's
// position), advances the required-core lesson script, grants reagents and
// rewards, and emits the tutorial UI events. When the last lesson finishes it
// flags completion so the graduation gateway opens.

import { TUTORIAL_LESSONS, TUTORIAL_GUIDE_ID, TUTORIAL_TREE_ID, TUTORIAL_FOE_ID, type TutorialLesson } from "../content/tutorial";
import type { GameSimulation } from "./simulation";
import type { Cell, SimEvent } from "./types";
import { chebyshev } from "./types";

export class TutorialDriver {
  index = 0;
  complete = false;
  private started = false;

  constructor(private sim: GameSimulation) {}

  /** The active lesson, or null once the tutorial is done. */
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

  private grant(itemId: string, qty: number): void {
    const added = this.sim.inventory.add(itemId, qty);
    if (added > 0) {
      this.sim.events.emit({ type: "itemGained", itemId, qty: added });
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
    for (const g of lesson.grant ?? []) this.grant(g.itemId, g.qty);
    this.sim.events.emit({
      type: "tutorialObjective",
      index: i,
      total: TUTORIAL_LESSONS.length,
      title: lesson.title,
      blurb: lesson.blurb,
    });
  }

  /** React to a tick's events + player position; advance when satisfied. */
  process(events: SimEvent[]): void {
    if (this.complete || !this.started) return;
    const lesson = TUTORIAL_LESSONS[this.index];
    let done = false;
    switch (lesson.trigger.kind) {
      case "reachGuide": {
        const g = this.markerCell("guide");
        if (g && chebyshev(this.sim.movement.currentCell(), g) <= 1) done = true;
        break;
      }
      case "logGained":
        done = events.some((e) => e.type === "itemGained" && e.itemId.startsWith("item.log."));
        break;
      case "logBurned":
        done = events.some((e) => e.type === "logBurned");
        break;
      case "bonesBuried":
        done = events.some((e) => e.type === "bonesBuried");
        break;
      case "enemyDefeated":
        done = events.some((e) => e.type === "enemyDied");
        break;
    }
    if (done) this.finish();
  }

  private finish(): void {
    const lesson = TUTORIAL_LESSONS[this.index];
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
