// Entity-texture pipeline: pack path planning, archive extraction of the
// whitelisted entity files, and the synchronous PNG codec that decodes the
// baked defaults at boot.

import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { DEFAULT_ENTITY_TEXTURES, DEFAULT_TEXTURES } from "../../render/default-textures";
import { ENTITY_TEXTURES, planEntityTextures } from "../entities";
import { extractCandidates } from "../importer";
import { decodePngBase64 } from "../png";

const PNG_STUB = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

describe("planEntityTextures", () => {
  it("maps available entity paths onto skin keys, first candidate winning", () => {
    const planned = planEntityTextures([
      "pig/pig.png",
      "pig/temperate_pig.png",
      "zombie/husk.png",
      "sheep/sheep.png",
    ]);
    const byKey = new Map(planned.map((p) => [p.key, p.path]));
    expect(byKey.get("entity.pig")).toBe("pig/temperate_pig.png");
    expect(byKey.get("entity.husk")).toBe("zombie/husk.png");
    expect(byKey.get("entity.sheep.skin")).toBe("sheep/sheep.png");
    expect(byKey.has("entity.cow")).toBe(false);
  });

  it("covers every mob the renderer can skin", () => {
    const keys = ENTITY_TEXTURES.map((d) => d.key);
    for (const key of [
      "entity.cow", "entity.pig", "entity.sheep.skin", "entity.sheep.wool",
      "entity.chicken", "entity.wolf", "entity.spider", "entity.cave_spider",
      "entity.slime", "entity.zombie", "entity.husk", "entity.chest",
    ]) {
      expect(keys, `${key} missing from ENTITY_TEXTURES`).toContain(key);
    }
  });
});

describe("extractCandidates (entity textures)", () => {
  it("keeps whitelisted entity textures under their entity-relative paths", () => {
    const zip = zipSync({
      "assets/minecraft/textures/entity/pig/temperate_pig.png": PNG_STUB,
      "assets/minecraft/textures/entity/zombie/husk.png": PNG_STUB,
      "assets/minecraft/textures/entity/banner/creeper.png": PNG_STUB, // not whitelisted
      "assets/minecraft/textures/block/dirt.png": PNG_STUB,
    });
    const result = extractCandidates(zip);
    expect(result.error).toBeUndefined();
    expect(Object.keys(result.entityEntries).sort()).toEqual([
      "pig/temperate_pig.png",
      "zombie/husk.png",
    ]);
    expect(Object.keys(result.entries)).toEqual(["dirt.png"]);
  });
});

describe("baked default textures (PNG codec)", () => {
  it("decodes baked block art at its native square size", () => {
    const grass = DEFAULT_TEXTURES["terrain.grass.top"];
    expect(grass).toBeTruthy();
    const png = decodePngBase64(grass);
    expect(png).not.toBeNull();
    expect(png!.width).toBe(png!.height);
    expect(png!.width).toBeGreaterThanOrEqual(16);
    expect(png!.rgba.length).toBe(png!.width * png!.height * 4);
  });

  it("keeps held-item sprites at 16x16 for hand voxelization", () => {
    for (const [id, b64] of Object.entries(DEFAULT_TEXTURES)) {
      if (!id.startsWith("sprite.item.")) continue;
      const png = decodePngBase64(b64);
      expect(png?.width, `${id} must be 16px`).toBe(16);
      expect(png?.height, `${id} must be 16px`).toBe(16);
    }
  });

  it("decodes every baked entity texture at a classic 64-based width", () => {
    const keys = Object.keys(DEFAULT_ENTITY_TEXTURES);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const png = decodePngBase64(DEFAULT_ENTITY_TEXTURES[key]);
      expect(png, `${key} failed to decode`).not.toBeNull();
      expect(png!.width % 64, `${key} width ${png!.width} not 64-based`).toBe(0);
    }
  });

  it("rejects garbage base64 without throwing", () => {
    expect(decodePngBase64("not base64 at all!!")).toBeNull();
    expect(decodePngBase64(btoa("plain text"))).toBeNull();
  });
});
