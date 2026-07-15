// Block types learned from uploaded structures. When a bake encounters a
// block the built-in mapping doesn't know, import-structure.mjs appends an
// entry here (with a guessed color) so the game gains the block type
// permanently. Entries are plain data and safe to hand-tune afterwards.
//
// Keys are block names without the "minecraft:" prefix. An entry overrides
// the built-in mapping for that exact name.

export interface CustomBlockSpec {
  kind: "cube" | "slab" | "stairs" | "post" | "panel" | "pane" | "thin" | "glow" | "skip";
  material?: string;
  color?: string;
  translucent?: boolean;
  wide?: boolean;
}

export const CUSTOM_BLOCKS: Record<string, CustomBlockSpec> = {
  "spruce_shelf": { kind: "cube", material: "roof.shingle" },
  "iron_chain": { kind: "post", color: "#5a5e66" },
  // -- auto-added entries below this line --
  "legacy id 70": { kind: "cube", color: "#6aafa3" }, // guessed (texture lookup failed)
  "legacy id 34": { kind: "cube", color: "#6aa8af" }, // guessed (texture lookup failed)
  "legacy id 33": { kind: "cube", color: "#af766a" }, // guessed (texture lookup failed)
  "legacy id 26": { kind: "cube", color: "#af996a" }, // guessed (texture lookup failed)
  "stone_brick_planks": { kind: "cube", color: "#8a8a8a" }, // guessed (texture lookup failed)
  "smooth_stone_planks": { kind: "cube", color: "#8a8a8a" }, // guessed (texture lookup failed)
  "legacy id 77": { kind: "cube", color: "#af6a70" }, // guessed (texture lookup failed)
  "legacy id 68": { kind: "cube", color: "#af896a" }, // guessed (texture lookup failed)
  "resin_bricks": { kind: "cube", color: "#ce5918" }, // resin_bricks.png
  "pale_moss_block": { kind: "cube", color: "#6b7069" }, // pale_moss_block.png
};
