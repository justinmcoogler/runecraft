import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import { FLIER_ENEMY_IDS, FLIER_STYLES, flierStyleFor } from "../flier-model";

const FLIER_VIEWS = ["bat", "allay", "bee", "ghast", "squid"] as const;

describe("native RuneCraft flier and aquatic rigs", () => {
  it("covers every exact live definition in the five replaced view buckets", () => {
    const liveIds = Object.values(ENEMIES)
      .filter((def) => FLIER_VIEWS.some((view) => def.view === view))
      .map((def) => def.id)
      .sort();

    expect(liveIds).toEqual([...FLIER_ENEMY_IDS].sort());
    expect(Object.keys(FLIER_STYLES).sort()).toEqual([...FLIER_ENEMY_IDS].sort());
    for (const id of FLIER_ENEMY_IDS) expect(flierStyleFor(id)).toBe(FLIER_STYLES[id]);
    expect(flierStyleFor("enemy.dragon.fire")).toBeUndefined();
  });

  it("keeps each requested view tied to its exact gameplay definition", () => {
    const expected = {
      bat: "enemy.bat",
      allay: "enemy.allay",
      bee: "enemy.bee",
      ghast: "enemy.ghast",
      squid: "enemy.squid",
    } as const;

    for (const view of FLIER_VIEWS) {
      const ids = Object.values(ENEMIES).filter((def) => def.view === view).map((def) => def.id);
      expect(ids, view).toEqual([expected[view]]);
    }
  });

  it("declares the articulated wing, fin and appendage structure for each silhouette", () => {
    expect(FLIER_STYLES["enemy.bat"]).toMatchObject({ motion: "fly", wingPairs: 1, appendageCount: 2 });
    expect(FLIER_STYLES["enemy.allay"]).toMatchObject({ motion: "hover", wingPairs: 2, appendageCount: 2 });
    expect(FLIER_STYLES["enemy.bee"]).toMatchObject({ motion: "hover", wingPairs: 2, appendageCount: 6 });
    expect(FLIER_STYLES["enemy.ghast"]).toMatchObject({ motion: "drift", wingPairs: 0, appendageCount: 9 });
    expect(FLIER_STYLES["enemy.squid"]).toMatchObject({ motion: "swim", wingPairs: 0, appendageCount: 8 });

    const features = new Set<string>();
    const silhouettes = new Set<string>();
    for (const id of FLIER_ENEMY_IDS) {
      const style = FLIER_STYLES[id];
      features.add(style.feature);
      silhouettes.add([
        style.bodyWidth,
        style.bodyHeight,
        style.bodyLength,
        style.wingPairs,
        style.appendageCount,
      ].join(":"));

      for (const color of [style.body, style.dark, style.membrane, style.accent, style.glow]) {
        expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(style.bodyWidth, id).toBeGreaterThan(0);
      expect(style.bodyHeight, id).toBeGreaterThan(0);
      expect(style.bodyLength, id).toBeGreaterThan(0);
      expect(style.appendageCount, id).toBeGreaterThan(0);
    }
    expect(features.size).toBe(FLIER_ENEMY_IDS.length);
    expect(silhouettes.size).toBe(FLIER_ENEMY_IDS.length);
  });
});
