import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import {
  CONSTRUCT_ENEMY_IDS,
  CONSTRUCT_STYLES,
  RETAINED_LICENSED_RIG_IDS,
  constructStyleFor,
} from "../construct-model";

describe("native RuneCraft construct rigs", () => {
  it("covers every live construct definition", () => {
    const liveIds = Object.values(ENEMIES)
      .filter((def) => def.view === "construct")
      .map((def) => def.id)
      .sort();

    expect(liveIds).toEqual([...CONSTRUCT_ENEMY_IDS].sort());
    expect(Object.keys(CONSTRUCT_STYLES).sort()).toEqual([...CONSTRUCT_ENEMY_IDS].sort());
  });

  it("consciously retains the attributed Warden Blockbench rig", () => {
    expect(RETAINED_LICENSED_RIG_IDS).toEqual(["enemy.warden"]);
    expect(ENEMIES["enemy.warden"].view).toBe("warden");
    expect(CONSTRUCT_ENEMY_IDS).not.toContain("enemy.warden");
    expect(constructStyleFor("enemy.warden")).toBeUndefined();
  });

  it("assigns distinct feature geometry and silhouettes, not tint-only variants", () => {
    const features = new Set<string>();
    const silhouettes = new Set<string>();

    for (const id of CONSTRUCT_ENEMY_IDS) {
      const style = CONSTRUCT_STYLES[id];
      features.add(style.feature);
      silhouettes.add([
        style.torsoWidth,
        style.shoulderWidth,
        style.limbWidth,
        style.torsoHeight,
        style.headWidth,
      ].join(":"));

      for (const color of [
        style.body,
        style.slab,
        style.joint,
        style.metal,
        style.accent,
        style.core,
      ]) expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.shoulderWidth, id).toBeGreaterThan(style.torsoWidth);
      expect(style.limbWidth, id).toBeGreaterThan(0);
    }

    expect(features.size).toBe(CONSTRUCT_ENEMY_IDS.length);
    expect(silhouettes.size).toBe(CONSTRUCT_ENEMY_IDS.length);
  });
});
