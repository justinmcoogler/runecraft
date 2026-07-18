import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import { OOZE_ENEMY_IDS, OOZE_STYLES, oozeStyleFor } from "../ooze-model";

describe("native RuneCraft ooze rigs", () => {
  it("covers every live slime-view definition", () => {
    const liveIds = Object.values(ENEMIES)
      .filter((def) => def.view === "slime")
      .map((def) => def.id)
      .sort();

    expect(liveIds).toEqual([...OOZE_ENEMY_IDS].sort());
    expect(Object.keys(OOZE_STYLES).sort()).toEqual([...OOZE_ENEMY_IDS].sort());
    for (const id of OOZE_ENEMY_IDS) expect(oozeStyleFor(id)).toBe(OOZE_STYLES[id]);
  });

  it("assigns distinct materials and layered silhouettes", () => {
    const features = new Set<string>();
    const silhouettes = new Set<string>();

    for (const id of OOZE_ENEMY_IDS) {
      const style = OOZE_STYLES[id];
      features.add(style.feature);
      silhouettes.add([style.width, style.height, style.depth, style.opacity].join(":"));

      for (const color of [style.outer, style.inner, style.crust, style.accent, style.eye]) {
        expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(style.width, id).toBeGreaterThan(0);
      expect(style.height, id).toBeGreaterThan(0);
      expect(style.depth, id).toBeGreaterThan(0);
      expect(style.opacity, id).toBeGreaterThan(0.5);
      expect(style.opacity, id).toBeLessThan(1);
    }

    expect(features.size).toBe(OOZE_ENEMY_IDS.length);
    expect(silhouettes.size).toBe(OOZE_ENEMY_IDS.length);
  });
});
