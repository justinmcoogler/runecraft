import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import { CANID_ENEMY_IDS, CANID_STYLES, canidStyleFor } from "../canid-model";

describe("native RuneCraft combat-canid rigs", () => {
  it("covers every live wolf-view definition and confirms there is no base wolf ID", () => {
    const liveIds = Object.values(ENEMIES)
      // The magma hound deliberately rides the classic wolf rig with a
      // painted magma skin rather than a canid native.
      .filter((def) => def.view === "wolf" && def.id !== "enemy.magma_hound")
      .map((def) => def.id)
      .sort();

    expect(liveIds).toEqual([...CANID_ENEMY_IDS].sort());
    expect(Object.keys(CANID_STYLES).sort()).toEqual([...CANID_ENEMY_IDS].sort());
    expect(ENEMIES["enemy.wolf"]).toBeUndefined();
    for (const id of CANID_ENEMY_IDS) expect(canidStyleFor(id)).toBe(CANID_STYLES[id]);
  });

  it("assigns distinct feature geometry and proportions instead of tint-only variants", () => {
    const features = new Set<string>();
    const silhouettes = new Set<string>();

    for (const id of CANID_ENEMY_IDS) {
      const style = CANID_STYLES[id];
      features.add(style.feature);
      silhouettes.add([
        style.bodyWidth,
        style.bodyHeight,
        style.bodyLength,
        style.limbWidth,
        style.headWidth,
      ].join(":"));

      for (const color of [style.fur, style.dark, style.ruff, style.accent, style.eye]) {
        expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(style.bodyLength, id).toBeGreaterThan(style.bodyWidth);
      expect(style.headWidth, id).toBeGreaterThan(style.limbWidth);
    }

    expect(features.size).toBe(CANID_ENEMY_IDS.length);
    expect(silhouettes.size).toBe(CANID_ENEMY_IDS.length);
  });
});
