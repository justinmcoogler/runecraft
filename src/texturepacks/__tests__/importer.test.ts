// Importer safety + alias planning. The DOM-dependent decode/normalize path is
// covered by the browser smoke test; everything here is the pure pipeline that
// must hold the line against hostile or malformed archives.

import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ALIASES, extractCandidates, IMPORT_LIMITS, planAliases } from "../importer";

const PNG_STUB = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

function packZip(paths: string[], data: Uint8Array = PNG_STUB): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  for (const p of paths) files[p] = data;
  return zipSync(files);
}

const BLOCKS = "assets/minecraft/textures/block";

describe("planAliases", () => {
  it("maps modern filenames onto logical material IDs (with tints where needed)", () => {
    const { planned } = planAliases(["grass_block_top.png", "dirt.png", "oak_leaves.png"]);
    const byId = new Map(planned.map((p) => [p.materialId, p]));
    expect(byId.get("terrain.grass.top")?.file).toBe("grass_block_top.png");
    expect(byId.get("terrain.grass.top")?.tint).toBeTruthy();
    expect(byId.get("terrain.dirt")?.tint).toBeUndefined();
    expect(byId.get("resource.tree.leaves")?.tint).toBeTruthy();
  });

  it("falls back to legacy filenames when modern ones are absent", () => {
    // Real 1.7-era packs (e.g. ProgrammerArt) use these names.
    const { planned } = planAliases([
      "log_oak.png",
      "log_oak_top.png",
      "grass_top.png",
      "fishing_rod_uncast.png",
    ]);
    const ids = planned.map((p) => p.materialId);
    expect(ids).toContain("resource.tree.log.side");
    expect(ids).toContain("resource.tree.log.top");
    expect(ids).toContain("terrain.grass.top");
    expect(ids).toContain("sprite.item.rod");
  });

  it("prefers the first listed filename when several candidates exist", () => {
    const { planned } = planAliases(["stone_axe.png", "iron_axe.png"]);
    expect(planned.find((p) => p.materialId === "sprite.item.axe")?.file).toBe("iron_axe.png");
  });

  it("reports unmatched materials as missing (built-in art keeps covering them)", () => {
    const { planned, missing } = planAliases(["dirt.png"]);
    expect(planned).toHaveLength(1);
    expect(missing).toContain("terrain.stone");
    expect(missing).toContain("sprite.item.sword");
    // The hammer has no standard pack filename, so it is always built-in.
    expect(missing).toContain("sprite.item.hammer");
    expect(planned.length + missing.length).toBe(ALIASES.length);
  });

  it("handles an empty pack", () => {
    const { planned, missing, notes } = planAliases([]);
    expect(planned).toHaveLength(0);
    expect(missing).toHaveLength(ALIASES.length);
    expect(notes).toHaveLength(0);
  });
});

describe("extractCandidates", () => {
  it("keeps only texture-directory PNGs, keyed by basename", () => {
    const zip = packZip([
      `${BLOCKS}/dirt.png`,
      `${BLOCKS}/stone.png`,
      "assets/minecraft/textures/item/iron_axe.png",
      "pack.mcmeta",
      "assets/minecraft/models/block/dirt.json",
      "assets/minecraft/textures/entity/creeper.png",
      "assets/othermod/textures/block/dirt.png",
    ]);
    const result = extractCandidates(zip);
    expect(result.error).toBeUndefined();
    expect(Object.keys(result.entries).sort()).toEqual(["dirt.png", "iron_axe.png", "stone.png"]);
    expect(result.ignoredCount).toBe(4);
  });

  it("accepts legacy blocks/ and items/ directory names", () => {
    const zip = packZip([
      "assets/minecraft/textures/blocks/dirt.png",
      "assets/minecraft/textures/items/iron_axe.png",
    ]);
    const result = extractCandidates(zip);
    expect(Object.keys(result.entries).sort()).toEqual(["dirt.png", "iron_axe.png"]);
  });

  it("on a basename clash, block/ art wins regardless of archive order", () => {
    const a = new Uint8Array([1, 1, 1]);
    const b = new Uint8Array([2, 2, 2]);
    const zip = zipSync({
      [`${BLOCKS}/dirt.png`]: a,
      "assets/minecraft/textures/item/dirt.png": b,
    });
    expect([...extractCandidates(zip).entries["dirt.png"]]).toEqual([1, 1, 1]);
    const reversed = zipSync({
      "assets/minecraft/textures/item/lantern.png": b,
      [`${BLOCKS}/lantern.png`]: a,
    });
    expect([...extractCandidates(reversed).entries["lantern.png"]]).toEqual([1, 1, 1]);
  });

  it("rejects archives over the size limit", () => {
    const huge = new Uint8Array(IMPORT_LIMITS.maxArchiveBytes + 1);
    expect(extractCandidates(huge).error).toMatch(/larger/i);
  });

  it("rejects archives with too many entries", () => {
    const paths: string[] = [];
    for (let i = 0; i < IMPORT_LIMITS.maxEntries + 1; i++) paths.push(`junk/file_${i}.txt`);
    const result = extractCandidates(packZip(paths, new Uint8Array(1)));
    expect(result.error).toMatch(/too many entries/i);
    expect(Object.keys(result.entries)).toHaveLength(0);
  });

  it("ignores path-traversal and absolute entry names", () => {
    const zip = packZip([
      `../../evil/${"dirt"}.png`,
      `${BLOCKS}/../../../etc/passwd.png`,
      `${BLOCKS}/stone.png`,
    ]);
    const result = extractCandidates(zip);
    expect(result.error).toBeUndefined();
    expect(Object.keys(result.entries)).toEqual(["stone.png"]);
  });

  it("ignores entries whose uncompressed size exceeds the per-entry limit", () => {
    const zip = zipSync({
      [`${BLOCKS}/dirt.png`]: new Uint8Array(IMPORT_LIMITS.maxEntryBytes + 1), // zip bomb-ish
      [`${BLOCKS}/stone.png`]: PNG_STUB,
    });
    const result = extractCandidates(zip);
    expect(result.error).toBeUndefined();
    expect(Object.keys(result.entries)).toEqual(["stone.png"]);
  });

  it("reports garbage bytes as not-a-zip", () => {
    const result = extractCandidates(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(result.error).toMatch(/not a readable zip/i);
  });
});
