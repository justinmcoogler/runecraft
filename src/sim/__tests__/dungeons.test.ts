// Endless-world dungeons: generated on demand from a region id, bigger than
// the old crawls, scaling with depth. Most are finite (a fixed number of
// floors ending at a finale); a rare few descend endlessly.

import { describe, expect, it } from "vitest";
import { buildRegion } from "../world";
import {
  buildDynamicDungeon,
  dungeonSpecFor,
  dynDungeonId,
  DUNGEON_SPAWN,
  makeDungeon,
} from "../worldgen/dungeons";

// maxDepth 0 == endless; a positive maxDepth is a finite run of that many floors.
const region = (
  style: "crypt" | "mine",
  depth: number,
  maxDepth = 0,
  exit = { x: 500, z: 600 },
) => makeDungeon(dungeonSpecFor(style, 4242, depth, maxDepth, exit))();

describe("endless-descent dungeons", () => {
  it("resolves a dyn_ region id through buildRegion", () => {
    const id = dynDungeonId("crypt", 4242, 1, 0, { x: 500, z: 600 });
    expect(id).toBe("dyn_crypt_4242_1_0_500_600");
    const r = buildRegion(id);
    expect(r.width).toBeGreaterThan(60);
    expect(r.spawn).toEqual(DUNGEON_SPAWN);
    // A non-dyn id still falls through to the province default, not an error.
    expect(buildDynamicDungeon("region.vale_clearing")).toBeNull();
  });

  it("spawns at a fixed cell so descent portals can target it blind", () => {
    for (const depth of [1, 3, 7]) {
      expect(region("crypt", depth).spawn).toEqual(DUNGEON_SPAWN);
      expect(region("mine", depth).spawn).toEqual(DUNGEON_SPAWN);
    }
  });

  it("floor 1 exits to the overworld; a stair down leads to the next floor", () => {
    const r = region("crypt", 1, 0, { x: 512, z: 640 });
    const exit = r.objects.find((o) => o.instanceId.endsWith(".exit"));
    expect(exit?.portal?.targetRegionId).toBe("region.endless");
    expect(exit?.portal?.targetCell).toEqual({ x: 512, z: 640 });
    const descend = r.objects.find((o) => o.instanceId.endsWith(".descend"));
    expect(descend?.portal?.targetRegionId).toBe("dyn_crypt_4242_2_0_512_640");
    expect(descend?.portal?.targetCell).toEqual(DUNGEON_SPAWN);
  });

  it("a deeper floor's stair up climbs exactly one floor, not to the surface", () => {
    const r = region("crypt", 3, 0, { x: 512, z: 640 });
    const exit = r.objects.find((o) => o.instanceId.endsWith(".exit"));
    // Floor 3 ascends to floor 2 (landing at its spawn), never straight up.
    expect(exit?.portal?.targetRegionId).toBe("dyn_crypt_4242_2_0_512_640");
    expect(exit?.portal?.targetCell).toEqual(DUNGEON_SPAWN);
  });

  it("grows deeper floors bigger than shallow ones", () => {
    const shallow = region("crypt", 1);
    const deep = region("crypt", 8);
    expect(deep.width * deep.depth).toBeGreaterThan(shallow.width * shallow.depth);
    // And every floor is bigger than the old 4x22 crawl footprint.
    expect(shallow.width).toBeGreaterThan(50);
  });

  it("mines differ from crypts: gravel floors, ore nodes, a way down", () => {
    const mine = region("mine", 4);
    expect(mine.blocks).toContain("gravel");
    expect((mine.nodes ?? []).some((n) => n.defId.startsWith("resource.rock."))).toBe(true);
    expect(mine.objects.some((o) => o.instanceId.endsWith(".descend"))).toBe(true);
  });

  it("puts a boss on every third floor, with richer loot deeper", () => {
    expect(dungeonSpecFor("crypt", 1, 3, 0, { x: 0, z: 0 }).boss).toBeTruthy();
    expect(dungeonSpecFor("crypt", 1, 2, 0, { x: 0, z: 0 }).boss).toBeUndefined();
    const shallowLoot = dungeonSpecFor("crypt", 1, 1, 0, { x: 0, z: 0 }).lootItems[0].qty;
    const deepLoot = dungeonSpecFor("crypt", 1, 9, 0, { x: 0, z: 0 }).lootItems[0].qty;
    expect(deepLoot).toBeGreaterThan(shallowLoot);
  });

  it("endless dungeons (maxDepth 0) always descend, forever", () => {
    for (const depth of [1, 5, 20, 99]) {
      const r = region("crypt", depth, 0);
      expect(r.objects.some((o) => o.instanceId.endsWith(".descend"))).toBe(true);
    }
  });

  it("finite dungeons stop at their finale floor with no way further down", () => {
    // A 3-floor run: floors 1 and 2 descend, floor 3 (the finale) does not.
    expect(region("crypt", 1, 3).objects.some((o) => o.instanceId.endsWith(".descend"))).toBe(true);
    expect(region("crypt", 2, 3).objects.some((o) => o.instanceId.endsWith(".descend"))).toBe(true);
    const finale = region("crypt", 3, 3);
    expect(finale.objects.some((o) => o.instanceId.endsWith(".descend"))).toBe(false);
    // The exit home is still there so the player isn't stranded.
    expect(finale.objects.some((o) => o.instanceId.endsWith(".exit"))).toBe(true);
  });

  it("guarantees a boss and bonus loot on the finite finale", () => {
    // Floor 2 of a 2-floor run is the finale: boss even though 2 % 3 != 0.
    const finaleSpec = dungeonSpecFor("crypt", 1, 2, 2, { x: 0, z: 0 });
    expect(finaleSpec.boss).toBeTruthy();
    const finaleLoot = finaleSpec.lootItems[0].qty;
    const endlessLoot = dungeonSpecFor("crypt", 1, 2, 0, { x: 0, z: 0 }).lootItems[0].qty;
    expect(finaleLoot).toBeGreaterThan(endlessLoot);
  });
});
