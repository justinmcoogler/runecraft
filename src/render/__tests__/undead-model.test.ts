import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import {
  BASE_UNDEAD_ENEMY_IDS,
  HUSK_UNDEAD_ENEMY_IDS,
  NATIVE_UNDEAD_ENEMY_IDS,
  NATIVE_UNDEAD_STYLES,
} from "../undead-model";

describe("native layered undead rigs", () => {
  it("covers every live base undead, husk and the Barrow Lord skeleton boss", () => {
    const liveHusks = Object.values(ENEMIES)
      .filter((def) => def.view === "husk")
      .map((def) => def.id)
      .sort();

    expect(liveHusks).toEqual([...HUSK_UNDEAD_ENEMY_IDS].sort());
    expect(BASE_UNDEAD_ENEMY_IDS).toEqual([
      "enemy.zombie",
      "enemy.skeleton",
      "enemy.drowned",
      "enemy.stray",
    ]);
    expect(ENEMIES["enemy.zombie"].view).toBe("zombie");
    expect(ENEMIES["enemy.skeleton"].view).toBe("skeleton");
    expect(ENEMIES["enemy.drowned"].view).toBe("drowned");
    expect(ENEMIES["enemy.stray"].view).toBe("stray");
    expect(ENEMIES["enemy.barrow_lord"].view).toBe("skeleton");
    expect(NATIVE_UNDEAD_ENEMY_IDS).toContain("enemy.barrow_lord");
    expect(Object.keys(NATIVE_UNDEAD_STYLES).sort()).toEqual([...NATIVE_UNDEAD_ENEMY_IDS].sort());
  });

  it("assigns authored geometry features instead of tint-only variants", () => {
    const features = new Set<string>();
    const silhouettes = new Set<string>();

    for (const id of NATIVE_UNDEAD_ENEMY_IDS) {
      const style = NATIVE_UNDEAD_STYLES[id];
      features.add(style.feature);
      silhouettes.add([
        style.torsoWidth,
        style.shoulderWidth,
        style.armWidth,
        style.legWidth,
        style.hunch,
      ].join(":"));

      for (const color of [
        style.bone,
        style.flesh,
        style.cloth,
        style.shadow,
        style.accent,
        style.eye,
      ]) expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.shoulderWidth, id).toBeGreaterThan(style.torsoWidth);
      expect(style.armWidth, id).toBeGreaterThan(0);
      expect(style.legWidth, id).toBeGreaterThan(0);
    }

    expect(features.size).toBe(NATIVE_UNDEAD_ENEMY_IDS.length);
    expect(silhouettes.size).toBe(NATIVE_UNDEAD_ENEMY_IDS.length);
  });
});
