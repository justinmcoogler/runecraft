// The biome catalog: a large named roster built from base biomes × variants,
// picked deterministically per cell.

import { describe, expect, it } from "vitest";
import { BIOME_CATALOG, BIOME_DEFS, biomeName, biomeVariantIndex } from "../worldgen/biomes";
import { ENDLESS_CENTER, terrainAt } from "../worldgen/endless";

describe("biome catalog", () => {
  it("names every base biome the classifier can assign", () => {
    // The classifier assigns ids 0..35; each must have a registry entry.
    for (let base = 0; base <= 35; base++) {
      expect(BIOME_DEFS[base], `base ${base} named`).toBeTruthy();
      expect(BIOME_DEFS[base].variants.length).toBeGreaterThan(0);
    }
  });

  it("builds a 100+ named catalog with no duplicate names", () => {
    expect(BIOME_CATALOG.length).toBeGreaterThanOrEqual(100);
    expect(new Set(BIOME_CATALOG).size).toBe(BIOME_CATALOG.length); // all unique
  });

  it("picks a variant deterministically and within range", () => {
    for (const [x, z] of [[10, 20], [999, -400], [ENDLESS_CENTER + 3000, ENDLESS_CENTER - 1200]]) {
      for (let base = 0; base <= 35; base++) {
        const vi = biomeVariantIndex(7, x, z, base);
        expect(vi).toBeGreaterThanOrEqual(0);
        expect(vi).toBeLessThan(BIOME_DEFS[base].variants.length);
        expect(biomeVariantIndex(7, x, z, base)).toBe(vi); // deterministic
      }
    }
  });

  it("surfaces more than one variant across a real biome's footprint", () => {
    // Sweep a swathe of the world, group cells by base biome, and confirm at
    // least one well-represented biome shows multiple variants (patchiness).
    const perBase = new Map<number, Set<string>>();
    for (let i = 0; i < 4000; i++) {
      const x = ENDLESS_CENTER + (i % 200) * 6;
      const z = ENDLESS_CENTER + Math.floor(i / 200) * 6;
      const base = terrainAt(9, x, z).biome;
      const set = perBase.get(base) ?? new Set<string>();
      set.add(biomeName(9, x, z, base));
      perBase.set(base, set);
    }
    const multi = [...perBase.values()].some((s) => s.size >= 2);
    expect(multi).toBe(true);
  });

  it("returns a real name for a mapped base and a fallback otherwise", () => {
    expect(biomeName(1, 0, 0, 1)).toBe(BIOME_DEFS[1].variants[biomeVariantIndex(1, 0, 0, 1)]);
    expect(biomeName(1, 0, 0, 999)).toBe("Wildlands");
  });
});
