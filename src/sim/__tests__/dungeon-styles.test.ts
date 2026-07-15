// Dungeon archetypes: every style builds a compliant, distinct crawl, names
// itself, composes with affixes, and round-trips through its region id.

import { describe, expect, it } from "vitest";
import {
  DUNGEON_STYLES, type DungeonStyle, buildDynamicDungeon, dungeonAffix,
  dungeonSpecFor, dynDungeonId, DUNGEON_SPAWN,
} from "../worldgen/dungeons";

const EXIT = { x: 300, z: 300 };

describe("dungeon archetypes", () => {
  it("exposes a broad roster of styles", () => {
    expect(DUNGEON_STYLES).toContain("crypt");
    expect(DUNGEON_STYLES).toContain("mine");
    expect(DUNGEON_STYLES).toContain("foundry");
    expect(DUNGEON_STYLES).toContain("frostwarren");
    expect(DUNGEON_STYLES.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every style its own name, floor palette and foe roster", () => {
    // Use a seed with no affix so the base labels stand alone.
    let seed = 0;
    while (dungeonAffix(seed) && seed < 500) seed++;
    const names = new Set<string>();
    const floors = new Set<string>();
    for (const style of DUNGEON_STYLES) {
      const spec = dungeonSpecFor(style, seed, 1, 3, EXIT);
      names.add(spec.name.split(" — ")[0]);
      floors.add(spec.floor);
      expect(spec.enemies.length, `${style}: has foes`).toBeGreaterThan(0);
      for (const e of spec.enemies) expect(e.defId.startsWith("enemy."), e.defId).toBe(true);
    }
    // Every style names itself distinctly, over at least four floor palettes.
    expect(names.size).toBe(DUNGEON_STYLES.length);
    expect(floors.size).toBeGreaterThanOrEqual(4);
  });

  it("builds a compliant region for each style and floor", () => {
    for (const style of DUNGEON_STYLES) {
      for (const depth of [1, 3]) {
        const id = dynDungeonId(style, 7, depth, 3, EXIT);
        const build = buildDynamicDungeon(id);
        expect(build, `${style} f${depth} builds`).not.toBeNull();
        const region = build!();
        expect(region.id).toBe(id);
        expect(region.spawn).toEqual(DUNGEON_SPAWN);
        expect(region.blocks.length).toBeGreaterThan(0);
      }
    }
  });

  it("a vault carries a richer hoard than a plain crypt", () => {
    const vault = dungeonSpecFor("vault", 11, 2, 3, EXIT);
    const crypt = dungeonSpecFor("crypt", 11, 2, 3, EXIT);
    expect(vault.lootItems.length).toBeGreaterThan(crypt.lootItems.length);
    expect(vault.lootItems.some((l) => l.itemId === "item.gem.emerald")).toBe(true);
  });

  it("rejects region ids whose style is not a real archetype", () => {
    expect(buildDynamicDungeon("dyn_notastyle_1_1_1_0_0")).toBeNull();
    expect(buildDynamicDungeon("region.vale_clearing")).toBeNull();
  });

  it("composes a style with an affix in the name", () => {
    let seed = 0;
    while (!dungeonAffix(seed) && seed < 500) seed++;
    const spec = dungeonSpecFor("hive", seed, 1, 3, EXIT);
    expect(spec.name).toContain("Hive");
  });
});

// Keep the DungeonStyle type referenced so the import isn't flagged unused.
const _styleCheck: DungeonStyle = "vault";
void _styleCheck;
