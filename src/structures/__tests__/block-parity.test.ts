// Minecraft block-behavior parity — a hard acceptance criterion for every
// parsed/imported asset (see game/CLAUDE.md). Imported blocks must behave the
// way they do in vanilla Minecraft, never as inert scenery:
//   - stairs and bottom slabs are walkable (step onto/up, not a wall)
//   - doors and fence gates are doorways you pass through / open
//   - glass, glass panes, and stained glass are translucent
//   - fences and walls block movement
// When a new block kind is added to structures/mapping.ts, add a case here.

import { describe, expect, it } from "vitest";
import { OBJECTS } from "../../content/content";
import { specFor } from "../mapping";
import { blockedColumns, type StructureAsset, type StructureBlock } from "../types";

/** A 3×N×3 asset whose bottom layer is NOT a solid deck, so effectiveSink is 0
 *  and the blocks we place at y=0 sit at foot level (feetY === 0). */
function asset(blocks: StructureBlock[]): StructureAsset {
  return {
    name: "parity-fixture",
    format: "vanilla-nbt",
    sx: 3,
    sy: 3,
    sz: 3,
    sink: 0,
    blocks,
    unmapped: [],
  };
}

const at = (kind: StructureBlock["kind"], extra: Partial<StructureBlock> = {}): StructureBlock => ({
  x: 1,
  z: 1,
  y: 0,
  kind,
  ...extra,
});

const blocks = (b: StructureBlock) => blockedColumns(asset([b])).some((c) => c.x === 1 && c.z === 1);

describe("Minecraft block-behavior parity", () => {
  describe("stairs are walkable", () => {
    it("a floor-level bottom stair is a step, not a wall", () => {
      expect(blocks(at("stairs"))).toBe(false);
    });
    it("but a head-height (top) stair still blocks — it's part of a wall/roof", () => {
      expect(blocks(at("stairs", { top: true }))).toBe(true);
    });
    it("every *_stairs block maps to the oriented stair shape", () => {
      for (const wood of ["oak", "stone_brick", "cobblestone", "cherry"]) {
        expect(specFor(`${wood}_stairs`, {}).kind).toBe("stairs");
      }
    });
  });

  describe("half-steps (slabs) are walkable", () => {
    it("a floor-level bottom slab is a stand-on surface", () => {
      expect(blocks(at("slab"))).toBe(false);
    });
    it("a top slab at foot height blocks (it sits where the head goes)", () => {
      expect(blocks(at("slab", { top: true }))).toBe(true);
    });
    it("every *_slab block maps to the half-block shape", () => {
      for (const m of ["oak", "smooth_stone", "quartz", "mangrove"]) {
        expect(specFor(`${m}_slab`, {}).kind).toBe("slab");
      }
    });
  });

  describe("doors are openable, not walls", () => {
    it("door/fence-gate columns are doorways — never block navigation", () => {
      expect(blocks(at("panel"))).toBe(false);
    });
    it("every *_door and *_fence_gate maps to a passable panel (doorway)", () => {
      for (const wood of ["oak", "spruce", "iron", "warped"]) {
        expect(specFor(`${wood}_door`, {}).kind).toBe("panel");
      }
      expect(specFor("oak_fence_gate", {}).kind).toBe("panel");
    });
    it("the world door object is interactive (open/close, not scenery)", () => {
      const door = OBJECTS["object.door.wood"];
      expect(door).toBeTruthy();
      expect(door.interaction).toBeTruthy();
      // Not flagged pure scenery — actions.ts routes it to openDoor().
      expect(door.scenery).toBeFalsy();
    });
  });

  describe("windows are translucent", () => {
    it("plain glass is see-through", () => {
      expect(specFor("glass", {}).translucent).toBe(true);
      expect(specFor("tinted_glass", {}).translucent).toBe(true);
    });
    it("glass panes are translucent panes; iron bars are opaque bars", () => {
      const pane = specFor("glass_pane", {});
      expect(pane.kind).toBe("pane");
      expect(pane.translucent).toBe(true);
      expect(specFor("iron_bars", {}).kind).toBe("pane");
      expect(specFor("iron_bars", {}).translucent).toBeFalsy();
    });
    it("every stained-glass color is translucent", () => {
      for (const c of ["white", "red", "blue", "lime", "black"]) {
        expect(specFor(`${c}_stained_glass`, {}).translucent).toBe(true);
        expect(specFor(`${c}_stained_glass_pane`, {}).translucent).toBe(true);
      }
    });
  });

  describe("solid blocks (fences, walls, full cubes) block movement", () => {
    it("fences and walls are posts that block the column", () => {
      expect(blocks(at("post"))).toBe(true);
      expect(specFor("oak_fence", {}).kind).toBe("post");
      const wall = specFor("cobblestone_wall", {});
      expect(wall.kind).toBe("post");
      expect(wall.wide).toBe(true);
    });
    it("a full cube blocks the column", () => {
      expect(blocks(at("cube"))).toBe(true);
    });
  });
});
