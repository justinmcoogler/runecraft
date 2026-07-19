import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import {
  UNGULATE_ENEMY_IDS,
  UNGULATE_STYLES,
  ungulateStyleFor,
} from "../ungulate-model";

describe("native RuneCraft livestock and ungulate rigs", () => {
  it("covers every live cow, pig, sheep and mooshroom view with exact native styles", () => {
    const liveIds = Object.values(ENEMIES)
      .filter((def) => def.view === "cow" || def.view === "pig" || def.view === "sheep" || def.view === "mooshroom")
      .map((def) => def.id)
      .sort();

    // Base cow/pig/sheep render via the baked vanilla-proportion models;
    // the family registry keeps only the styled variants.
    const BAKED_MODEL_IDS = ["enemy.cow", "enemy.pig", "enemy.sheep"];
    expect(liveIds).toEqual([...UNGULATE_ENEMY_IDS, ...BAKED_MODEL_IDS].sort());
    expect(Object.keys(UNGULATE_STYLES).sort()).toEqual([...UNGULATE_ENEMY_IDS].sort());
    for (const id of UNGULATE_ENEMY_IDS) expect(ungulateStyleFor(id)).toBe(UNGULATE_STYLES[id]);
    expect(ungulateStyleFor("enemy.chicken")).toBeUndefined();
  });

  it("keeps regional boar and bull in their gameplay views without sharing silhouettes", () => {
    const idsForView = (view: "cow" | "pig" | "sheep" | "mooshroom") => Object.values(ENEMIES)
      .filter((def) => def.view === view)
      .map((def) => def.id)
      .sort();

    expect(idsForView("cow")).toEqual(["enemy.cow", "enemy.prairie_bull"]);
    expect(idsForView("pig")).toEqual(["enemy.boar", "enemy.pig"]);
    expect(idsForView("sheep")).toEqual(["enemy.sheep"]);
    // The base three fall through to the baked models, not the family rig.
    expect(ungulateStyleFor("enemy.cow")).toBeUndefined();
    expect(ungulateStyleFor("enemy.pig")).toBeUndefined();
    expect(ungulateStyleFor("enemy.sheep")).toBeUndefined();
    expect(idsForView("mooshroom")).toEqual(["enemy.mooshroom"]);
    expect(UNGULATE_STYLES["enemy.boar"].feature).toBe("boar");
    expect(UNGULATE_STYLES["enemy.prairie_bull"].feature).toBe("bull");
  });

  it("assigns original material palettes and distinct layered proportions", () => {
    const features = new Set<string>();
    const silhouettes = new Set<string>();

    for (const id of UNGULATE_ENEMY_IDS) {
      const style = UNGULATE_STYLES[id];
      features.add(style.feature);
      silhouettes.add([
        style.bodyWidth,
        style.bodyHeight,
        style.bodyLength,
        style.limbWidth,
        style.headWidth,
      ].join(":"));

      for (const color of [style.hide, style.dark, style.coat, style.accent, style.eye]) {
        expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(style.bodyLength, id).toBeGreaterThan(style.bodyWidth);
      expect(style.bodyHeight, id).toBeGreaterThan(style.limbWidth);
      expect(style.headWidth, id).toBeGreaterThan(style.limbWidth);
    }

    expect(features.size).toBe(UNGULATE_ENEMY_IDS.length);
    expect(silhouettes.size).toBe(UNGULATE_ENEMY_IDS.length);
  });
});
