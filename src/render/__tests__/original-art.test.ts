import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodePngBase64 } from "../../texturepacks/png";
import { itemIconUrl, setPackIconProvider } from "../../ui/icons";
import { DEFAULT_TEXTURES } from "../default-textures";
import { ORIGINAL_ENTITY_TEXTURES, ORIGINAL_TEXTURES } from "../original-art";
import { TERRAIN_ATLAS_ORDER } from "../textures";

const TERRAIN_MATERIALS = [
  "terrain.cobble",
  "terrain.dirt",
  "terrain.grass.top",
  "terrain.moss",
  "terrain.mud",
  "terrain.stone",
] as const;

const EXPECTED_ICON_MATERIALS = ["items", "runes"]
  .flatMap((folder) => readdirSync(join(process.cwd(), "src", "render", "art", folder)))
  .filter((name) => name.endsWith(".png"))
  .map((name) => `icon.original.${name.replace(/\.png$/, "").replace(/-64$/, "")}`)
  .sort();

const ARMOR_ICON_ROUTES = [
  ["armor.cap.steel", "icon.original.steel-helmet"],
  ["armor.tunic.steel", "icon.original.steel-chestplate"],
  ["armor.leggings.steel", "icon.original.steel-leggings"],
  ["armor.boots.steel", "icon.original.steel-boots"],
  ["armor.cap.mithril", "icon.original.mithril-helmet"],
  ["armor.tunic.mithril", "icon.original.mithril-chestplate"],
  ["armor.leggings.mithril", "icon.original.mithril-leggings"],
  ["armor.boots.mithril", "icon.original.mithril-boots"],
  ["armor.cap.adamant", "icon.original.adamant-helmet"],
  ["armor.tunic.adamant", "icon.original.adamant-chestplate"],
  ["armor.leggings.adamant", "icon.original.adamant-leggings"],
  ["armor.boots.adamant", "icon.original.adamant-boots"],
  ["armor.cap.rune", "icon.original.rune-helmet"],
  ["armor.tunic.rune", "icon.original.rune-chestplate"],
  ["armor.leggings.rune", "icon.original.rune-leggings"],
  ["armor.boots.rune", "icon.original.rune-boots"],
  ["armor.cap.diamond", "icon.original.diamond-helmet"],
  ["armor.tunic.diamond", "icon.original.diamond-chestplate"],
  ["armor.leggings.diamond", "icon.original.diamond-leggings"],
  ["armor.boots.diamond", "icon.original.diamond-boots"],
  ["armor.cap.netherite", "icon.original.netherite-helmet"],
  ["armor.tunic.netherite", "icon.original.netherite-chestplate"],
  ["armor.leggings.netherite", "icon.original.netherite-leggings"],
  ["armor.boots.netherite", "icon.original.netherite-boots"],
  ["armor.boots.runed", "icon.original.runed-boots"],
] as const;

const RUNE_RELIC_ICON_ROUTES = [
  ["item.rune.body", "icon.original.body-rune"],
  ["item.rune.chaos", "icon.original.chaos-rune"],
  ["item.rune.cosmic", "icon.original.cosmic-rune"],
  ["item.relic.astrolabe", "icon.original.relic-astrolabe"],
  ["item.relic.censer", "icon.original.relic-censer"],
  ["item.relic.chalice", "icon.original.relic-chalice"],
  ["item.relic.crown", "icon.original.relic-crown"],
  ["item.relic.sceptre", "icon.original.relic-sceptre"],
  ["item.relic.torque", "icon.original.relic-torque"],
] as const;

describe("original art bundle", () => {
  it("contains every generated inventory icon and terrain tile", () => {
    const entries = Object.entries(ORIGINAL_TEXTURES);
    const icons = entries.filter(([key]) => key.startsWith("icon.original."));
    const terrain = entries.filter(([key]) => key.startsWith("terrain."));
    expect(EXPECTED_ICON_MATERIALS).toHaveLength(253);
    expect(icons.map(([key]) => key).sort()).toEqual(EXPECTED_ICON_MATERIALS);
    expect(terrain).toHaveLength(6);
    expect(terrain.map(([key]) => key).sort()).toEqual([...TERRAIN_MATERIALS].sort());
    for (const [key, b64] of entries) {
      const png = decodePngBase64(b64);
      expect(png, key).not.toBeNull();
      expect([png!.width, png!.height], key).toEqual([64, 64]);
    }
    for (const [materialId, b64] of icons) {
      const png = decodePngBase64(b64)!;
      const cornerAlpha = [
        png.rgba[3],
        png.rgba[(png.width - 1) * 4 + 3],
        png.rgba[(png.height - 1) * png.width * 4 + 3],
        png.rgba[(png.width * png.height - 1) * 4 + 3],
      ];
      expect(cornerAlpha, materialId).toEqual([0, 0, 0, 0]);
      let hasTransparentPixel = false;
      let hasOpaquePixel = false;
      for (let i = 3; i < png.rgba.length; i += 4) {
        hasTransparentPixel ||= png.rgba[i] === 0;
        hasOpaquePixel ||= png.rgba[i] === 255;
      }
      expect(hasTransparentPixel, materialId).toBe(true);
      expect(hasOpaquePixel, materialId).toBe(true);
    }
    for (const materialId of TERRAIN_MATERIALS) {
      expect(ORIGINAL_TEXTURES).toHaveProperty(materialId);
      expect(DEFAULT_TEXTURES).toHaveProperty(materialId);
      expect(ORIGINAL_TEXTURES[materialId]).not.toBe(DEFAULT_TEXTURES[materialId]);
      expect(TERRAIN_ATLAS_ORDER).toContain(materialId);
    }
  });

  it("routes each high-tier armor item to its baked original icon", () => {
    const requested: string[] = [];
    setPackIconProvider((materialId) => {
      requested.push(materialId);
      return `pack:${materialId}`;
    });

    try {
      for (const [itemId, materialId] of ARMOR_ICON_ROUTES) {
        expect(itemIconUrl(itemId)).toBe(`pack:${materialId}`);
      }
      expect(requested).toEqual(ARMOR_ICON_ROUTES.map(([, materialId]) => materialId));
    } finally {
      setPackIconProvider(() => null);
    }
  });

  it("routes the new rune and relic items to their baked original icons", () => {
    const requested: string[] = [];
    setPackIconProvider((materialId) => {
      requested.push(materialId);
      return `pack:${materialId}`;
    });

    try {
      for (const [itemId, materialId] of RUNE_RELIC_ICON_ROUTES) {
        expect(itemIconUrl(itemId)).toBe(`pack:${materialId}`);
      }
      expect(requested).toEqual(RUNE_RELIC_ICON_ROUTES.map(([, materialId]) => materialId));
    } finally {
      setPackIconProvider(() => null);
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
