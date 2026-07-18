import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import { SIGNATURE_ENEMY_IDS, SIGNATURE_STYLES, signatureStyleFor } from "../signature-model";

const SIGNATURE_VIEWS = ["chicken", "creeper", "armadillo", "ravager", "sniffer"] as const;

describe("native RuneCraft signature-fauna rigs", () => {
  it("covers every exact live definition in the five replaced view buckets", () => {
    const liveIds = Object.values(ENEMIES)
      // The duck deliberately rides the chicken rig as a mallard tint.
      .filter((def) => SIGNATURE_VIEWS.some((view) => def.view === view) && def.id !== "enemy.duck")
      .map((def) => def.id)
      .sort();

    expect(liveIds).toEqual([...SIGNATURE_ENEMY_IDS].sort());
    expect(Object.keys(SIGNATURE_STYLES).sort()).toEqual([...SIGNATURE_ENEMY_IDS].sort());
    for (const id of SIGNATURE_ENEMY_IDS) expect(signatureStyleFor(id)).toBe(SIGNATURE_STYLES[id]);
  });

  it("declares the expected articulated legs and wings for every anatomy", () => {
    expect(SIGNATURE_STYLES["enemy.chicken"]).toMatchObject({ motion: "bird", legCount: 2, wingCount: 2 });
    expect(SIGNATURE_STYLES["enemy.creeper"]).toMatchObject({ motion: "stalker", legCount: 4, wingCount: 0 });
    expect(SIGNATURE_STYLES["enemy.armadillo"]).toMatchObject({ motion: "scuttle", legCount: 4, wingCount: 0 });
    expect(SIGNATURE_STYLES["enemy.ravager"]).toMatchObject({ motion: "brute", legCount: 4, wingCount: 0 });
    expect(SIGNATURE_STYLES["enemy.sniffer"]).toMatchObject({ motion: "sniff", legCount: 4, wingCount: 0 });
  });

  it("assigns distinct features, materials and readable proportions", () => {
    const features = new Set<string>();
    const silhouettes = new Set<string>();
    for (const id of SIGNATURE_ENEMY_IDS) {
      const style = SIGNATURE_STYLES[id];
      features.add(style.feature);
      silhouettes.add([
        style.bodyWidth,
        style.bodyHeight,
        style.bodyLength,
        style.limbWidth,
        style.legCount,
        style.wingCount,
      ].join(":"));
      for (const color of [style.body, style.dark, style.plate, style.accent, style.glow]) {
        expect(color, id).toMatch(/^#[0-9a-f]{6}$/i);
      }
      expect(style.bodyWidth, id).toBeGreaterThan(style.limbWidth);
      expect(style.bodyHeight, id).toBeGreaterThan(style.limbWidth);
      expect(style.bodyLength, id).toBeGreaterThan(style.limbWidth);
    }
    expect(features.size).toBe(SIGNATURE_ENEMY_IDS.length);
    expect(silhouettes.size).toBe(SIGNATURE_ENEMY_IDS.length);
  });
});
