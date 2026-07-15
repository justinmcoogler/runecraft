// Imported signs and banners now render instead of being skipped.

import { describe, expect, it } from "vitest";
import { specFor } from "../mapping";

describe("imported signs and banners", () => {
  it("maps every sign variant to a plank board keyed by wood species", () => {
    for (const name of ["oak_sign", "oak_wall_sign", "spruce_hanging_sign", "oak_wall_hanging_sign"]) {
      const spec = specFor(name, {});
      expect(spec.kind, name).toBe("sign");
      expect(spec.material, name).toBeTruthy();
    }
    expect(specFor("birch_sign", {}).material).toBe("terrain.plank.birch");
  });

  it("maps banners (standing and wall) to a dyed cloth", () => {
    expect(specFor("red_banner", {}).kind).toBe("banner");
    expect(specFor("red_banner", {}).color).toBe("#a12722");
    expect(specFor("blue_wall_banner", {}).kind).toBe("banner");
    expect(specFor("blue_wall_banner", {}).color).toBe("#35399d");
  });
});
