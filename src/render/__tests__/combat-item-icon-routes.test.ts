import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ITEMS } from "../../content/content";
import { itemIconUrl, setPackIconProvider } from "../../ui/icons";

const ROUTES = [
  ["item.arrow.adamant", "icon.original.arrow-adamant"],
  ["item.arrow.mithril", "icon.original.arrow-mithril"],
  ["item.arrow.rune", "icon.original.arrow-rune"],
  ["item.arrow.shaft", "icon.original.arrow-shaft"],
  ["item.arrow.steel", "icon.original.arrow-steel"],
  ["tool.boat.cutter", "icon.original.boat-cutter"],
  ["tool.boat.longship", "icon.original.boat-longship"],
  ["tool.fishingrod.barbed", "icon.original.fishingrod-barbed"],
  ["tool.fishingrod.enchanted", "icon.original.fishingrod-enchanted"],
  ["tool.fishingrod.fly", "icon.original.fishingrod-fly"],
  ["tool.fishingrod.pearl", "icon.original.fishingrod-pearl"],
  ["tool.hoe.basic", "icon.original.hoe-basic"],
  ["tool.mattock.basic", "icon.original.mattock-basic"],
  ["tool.mattock.crystal", "icon.original.mattock-crystal"],
  ["tool.mattock.dragon", "icon.original.mattock-dragon"],
  ["tool.mattock.iron", "icon.original.mattock-iron"],
  ["tool.secateurs.basic", "icon.original.secateurs-basic"],
  ["tool.secateurs.magic", "icon.original.secateurs-magic"],
  ["tool.sword.astral", "icon.original.sword-astral"],
  ["tool.trap.box", "icon.original.trap-box"],
  ["tool.trap.magic", "icon.original.trap-magic"],
  ["item.antler", "icon.original.antler"],
  ["item.chinchompa", "icon.original.chinchompa"],
  ["item.spike.grenwall", "icon.original.spike-grenwall"],
  ["item.tusk", "icon.original.tusk"],
  ["item.gizmo.bulwark", "icon.original.gizmo-bulwark"],
  ["item.gizmo.titan", "icon.original.gizmo-titan"],
] as const;

describe("combat, tool, boat, and ammunition icon routes", () => {
  it("uses exact live item IDs with installed 64px source files", () => {
    expect(ROUTES).toHaveLength(27);
    for (const [itemId, materialId] of ROUTES) {
      expect(ITEMS, itemId).toHaveProperty(itemId);
      const stem = materialId.replace("icon.original.", "");
      expect(existsSync(join(process.cwd(), "src/render/art/items", `${stem}-64.png`)), materialId).toBe(true);
    }
  });

  it("routes every item through its generated original material", () => {
    const requested: string[] = [];
    setPackIconProvider((materialId) => {
      requested.push(materialId);
      return `pack:${materialId}`;
    });
    try {
      for (const [itemId, materialId] of ROUTES) {
        expect(itemIconUrl(itemId), itemId).toBe(`pack:${materialId}`);
      }
      expect(requested).toEqual(ROUTES.map(([, materialId]) => materialId));
    } finally {
      setPackIconProvider(() => null);
    }
  });
});
