// The block registry is the single source of truth for world blocks: every
// type behaves like vanilla (only liquids are non-solid) and every face tile
// it names is a baked Faithful texture that has an atlas column to render in.

import { describe, expect, it } from "vitest";
import { DEFAULT_TEXTURES } from "../../render/default-textures";
import { TERRAIN_ATLAS_ORDER } from "../../render/textures";
import { BLOCKS, BLOCK_TYPES, blockShape, DYE_COLORS, isLiquid, isObstacle, isSolid, isTranslucent, sideTile, surfaceOffset, topTile } from "../blocks";

describe("block registry", () => {
  it("keys its entries by their own id", () => {
    for (const [key, def] of Object.entries(BLOCKS)) expect(def.id).toBe(key);
  });

  it("treats only liquids as non-solid, and water is the sole liquid", () => {
    const nonSolid = BLOCK_TYPES.filter((b) => !isSolid(b));
    const liquids = BLOCK_TYPES.filter((b) => isLiquid(b));
    expect(nonSolid).toEqual(["water"]);
    expect(liquids).toEqual(["water"]);
    expect(BLOCKS.water.translucent).toBe(true);
  });

  it("names a baked, atlas-mapped tile for every face it can show", () => {
    const atlas = new Set(TERRAIN_ATLAS_ORDER);
    for (const b of BLOCK_TYPES) {
      const tiles = new Set<string>([BLOCKS[b].top, ...(BLOCKS[b].strata?.map((s) => s.tile) ?? [])]);
      // sideTile can also fall through to stone at depth.
      tiles.add(sideTile(b, 99));
      for (const t of tiles) {
        expect(DEFAULT_TEXTURES[t], `${b} tile ${t} is not a baked texture`).toBeTruthy();
        expect(atlas.has(t), `${b} tile ${t} has no atlas column`).toBe(true);
      }
    }
  });

  it("preserves the original cliff-strata behavior (grass/sand/dirt/uniform)", () => {
    expect(topTile("grass")).toBe("terrain.grass.top");
    expect(sideTile("grass", 0)).toBe("terrain.grass.side");
    expect(sideTile("grass", 1)).toBe("terrain.dirt");
    expect(sideTile("grass", 3)).toBe("terrain.stone");
    expect(sideTile("sand", 3)).toBe("terrain.sand");
    expect(sideTile("sand", 4)).toBe("terrain.stone");
    expect(sideTile("dirt", 2)).toBe("terrain.dirt");
    expect(sideTile("dirt", 3)).toBe("terrain.stone");
    // Uniform blocks show their own face all the way down.
    expect(sideTile("stone", 0)).toBe("terrain.stone");
    expect(sideTile("stone", 9)).toBe("terrain.stone");
  });

  it("adds the new stone-family and dyed building blocks", () => {
    for (const id of ["basalt", "diorite", "granite", "endstone", "purpur", "quartz"] as const) {
      expect(BLOCKS[id], `${id} missing`).toBeTruthy();
      expect(isSolid(id)).toBe(true);
    }
    expect(DYE_COLORS.length).toBe(16);
    for (const c of DYE_COLORS) {
      expect(BLOCKS[`wool_${c}`].top).toBe(`block.wool.${c}`);
      expect(BLOCKS[`concrete_${c}`].top).toBe(`block.concrete.${c}`);
    }
  });

  it("gives slabs and stairs a raised half-block surface; cubes stay flush", () => {
    expect(surfaceOffset("stone")).toBe(0);
    expect(surfaceOffset("wool_red")).toBe(0);
    expect(blockShape("stone")).toBe("cube");
    for (const id of ["stone_slab", "plank_slab", "quartz_slab", "purpur_slab"] as const) {
      expect(blockShape(id)).toBe("slab");
      expect(surfaceOffset(id)).toBe(0.5);
      expect(isSolid(id)).toBe(true);
    }
    for (const id of ["stone_stairs", "plank_stairs", "purpur_stairs"] as const) {
      expect(blockShape(id)).toBe("stairs");
      expect(surfaceOffset(id)).toBe(0.5);
    }
  });

  it("marks fences/walls as obstacles and glass as translucent", () => {
    for (const id of ["oak_fence", "stone_wall", "cobble_wall"] as const) {
      expect(isObstacle(id)).toBe(true);
      expect(["fence", "wall"]).toContain(blockShape(id));
      expect(BLOCKS[id].base, `${id} needs a ground base`).toBeTruthy();
    }
    expect(isTranslucent("glass")).toBe(true);
    expect(isObstacle("glass")).toBe(false); // you can stand on glass
    expect(isObstacle("stone")).toBe(false);
    expect(isTranslucent("stone")).toBe(false);
  });
});
