// Imported ground plants render as crossed sprites instead of being dropped
// (closing the biggest "missing family" gap in the block-coverage audit).

import { describe, expect, it } from "vitest";
import { specFor } from "../mapping";

describe("imported plants map to crossed sprites", () => {
  it("routes flowers, grasses, crops, canes, saplings, and mushrooms to cross", () => {
    const cases: Array<[string, string]> = [
      ["poppy", "sprite.flowers.wild"],
      ["dandelion", "sprite.flowers.wild"],
      ["orange_tulip", "sprite.flowers.wild"],
      ["short_grass", "sprite.grass.tuft"],
      ["fern", "sprite.grass.tuft"],
      ["oak_sapling", "sprite.grass.tuft"],
      ["wheat", "sprite.crop.wheat.full"],
      ["carrots", "sprite.crop.wheat.full"],
      ["sugar_cane", "sprite.reeds"],
      ["sweet_berry_bush", "sprite.bush.berry.full"],
      ["red_mushroom", "sprite.herb.full"],
    ];
    for (const [name, sprite] of cases) {
      const spec = specFor(name, {});
      expect(spec.kind, `${name} should be a cross`).toBe("cross");
      expect(spec.material, `${name} sprite`).toBe(sprite);
    }
  });

  it("still skips vines, lily pads, and other awkward foliage", () => {
    for (const name of ["vine", "lily_pad", "cave_vines", "glow_lichen", "cobweb"]) {
      expect(specFor(name, {}).kind, `${name} stays skipped`).toBe("skip");
    }
  });
});
