import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ITEMS } from "../../content/content";
import { itemIconUrl, setPackIconProvider } from "../../ui/icons";

const ROUTES = [
  ["item.hide.polar", "icon.original.hide-polar"],
  ["item.hide.sabre", "icon.original.hide-sabre"],
  ["item.hide.thick", "icon.original.hide-thick"],
  ["item.game.antelope", "icon.original.game-antelope"],
  ["item.game.boar", "icon.original.game-boar"],
  ["item.game.fowl", "icon.original.game-fowl"],
  ["item.game.grenwall", "icon.original.game-grenwall"],
  ["item.antelope.cooked", "icon.original.antelope-cooked"],
  ["item.boar.cooked", "icon.original.boar-cooked"],
  ["item.fowl.cooked", "icon.original.fowl-cooked"],
  ["item.grenwall.cooked", "icon.original.grenwall-cooked"],
  ["item.fish.crab", "icon.original.fish-crab"],
  ["item.fish.gloom", "icon.original.fish-gloom"],
  ["item.fish.lobster", "icon.original.fish-lobster"],
  ["item.fish.marlin", "icon.original.fish-marlin"],
  ["item.fish.shrimp", "icon.original.fish-shrimp"],
  ["item.fish.stormscale", "icon.original.fish-stormscale"],
  ["item.crab.cooked", "icon.original.crab-cooked"],
  ["item.gloom.cooked", "icon.original.gloom-cooked"],
  ["item.lobster.cooked", "icon.original.lobster-cooked"],
  ["item.marlin.cooked", "icon.original.marlin-cooked"],
  ["item.shrimp.cooked", "icon.original.shrimp-cooked"],
  ["item.stormscale.cooked", "icon.original.stormscale-cooked"],
  ["item.pouch.drake", "icon.original.pouch-drake"],
  ["item.pouch.lynx", "icon.original.pouch-lynx"],
  ["item.rite.barrow", "icon.original.rite-barrow"],
  ["item.rite.drowned", "icon.original.rite-drowned"],
  ["item.rite.shambler", "icon.original.rite-shambler"],
  ["item.rite.skeleton", "icon.original.rite-skeleton"],
  ["item.rite.stray", "icon.original.rite-stray"],
  ["item.rite.wight", "icon.original.rite-wight"],
] as const;

describe("hunting, fish, cooked food, pouch, and rite icon routes", () => {
  it("uses 31 exact live IDs with installed 64px source files", () => {
    expect(ROUTES).toHaveLength(31);
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
