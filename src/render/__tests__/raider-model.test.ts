import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import { RAIDER_ENEMY_IDS, RAIDER_STYLES, raiderStyleFor } from "../raider-model";

const RAIDER_VIEWS = ["pillager", "vindicator", "evoker", "illusioner", "witch", "dummy"] as const;

// Tinted reskins that deliberately ride the pillager raider rig.
const RAIDER_RESKINS = new Set(["enemy.bandit", "enemy.poacher"]);

describe("native RuneCraft raider and caster rigs", () => {
  it("covers every exact live definition in the six replaced view buckets", () => {
    const liveIds = Object.values(ENEMIES)
      .filter((def) => RAIDER_VIEWS.some((view) => def.view === view) && !RAIDER_RESKINS.has(def.id))
      .map((def) => def.id)
      .sort();

    expect(liveIds).toEqual([...RAIDER_ENEMY_IDS].sort());
    expect(Object.keys(RAIDER_STYLES).sort()).toEqual([...RAIDER_ENEMY_IDS].sort());
    for (const id of RAIDER_ENEMY_IDS) expect(raiderStyleFor(id)).toBe(RAIDER_STYLES[id]);
    expect(raiderStyleFor("enemy.ravager")).toBeUndefined();
  });

  it("keeps each requested view tied to its exact gameplay definition", () => {
    const expected = {
      pillager: "enemy.pillager",
      vindicator: "enemy.vindicator",
      evoker: "enemy.evoker",
      illusioner: "enemy.illusioner",
      witch: "enemy.witch",
      dummy: "enemy.target_dummy",
    } as const;

    for (const view of RAIDER_VIEWS) {
      const ids = Object.values(ENEMIES)
        .filter((def) => def.view === view && !RAIDER_RESKINS.has(def.id))
        .map((def) => def.id);
      expect(ids, view).toEqual([expected[view]]);
    }
  });

  it("assigns distinct roles, feature geometry, palettes and humanoid proportions", () => {
    const roles = new Set<string>();
    const features = new Set<string>();
    const silhouettes = new Set<string>();

    for (const id of RAIDER_ENEMY_IDS) {
      const style = RAIDER_STYLES[id];
      roles.add(style.role);
      features.add(style.feature);
      silhouettes.add([
        style.torsoWidth,
        style.torsoHeight,
        style.shoulderWidth,
        style.headWidth,
        style.legWidth,
      ].join(":"));

      for (const color of [style.skin, style.dark, style.cloth, style.accent, style.metal, style.glow]) {
        expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(style.shoulderWidth, id).toBeGreaterThan(style.torsoWidth);
      expect(style.torsoHeight, id).toBeGreaterThan(style.headWidth);
      expect(style.headWidth, id).toBeGreaterThan(style.legWidth);
    }

    expect(roles.size).toBe(RAIDER_ENEMY_IDS.length);
    expect(features.size).toBe(RAIDER_ENEMY_IDS.length);
    expect(silhouettes.size).toBe(RAIDER_ENEMY_IDS.length);
  });
});
