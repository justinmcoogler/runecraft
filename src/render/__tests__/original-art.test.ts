import { describe, expect, it } from "vitest";
import { decodePngBase64 } from "../../texturepacks/png";
import { ORIGINAL_ENTITY_TEXTURES, ORIGINAL_TEXTURES } from "../original-art";

describe("original art bundle", () => {
  it("contains every enumerated 64x64 inventory icon", () => {
    const entries = Object.entries(ORIGINAL_TEXTURES);
    expect(entries).toHaveLength(91);
    for (const [key, b64] of entries) {
      const png = decodePngBase64(b64);
      expect(png, key).not.toBeNull();
      expect([png!.width, png!.height], key).toEqual([64, 64]);
    }
  });

  it("keeps each canonical entity atlas at its model UV size", () => {
    const sizes: Record<string, [number, number]> = {
      "entity.cow": [64, 64],
      "entity.sheep": [64, 32],
      "entity.wolf": [64, 32],
      "entity.spider": [64, 32],
      "entity.slime": [64, 32],
      "entity.creeper": [64, 32],
      "entity.skeleton": [64, 32],
      "entity.squid": [64, 32],
      "entity.ghast": [64, 32],
      "entity.construct": [64, 64],
      "entity.gnasher": [64, 32],
      "entity.dummy": [32, 32],
    };
    for (const [key, expected] of Object.entries(sizes)) {
      const png = decodePngBase64(ORIGINAL_ENTITY_TEXTURES[key]);
      expect(png, key).not.toBeNull();
      expect([png!.width, png!.height], key).toEqual(expected);
    }
  });
});
