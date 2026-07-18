import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ITEMS } from "../../content/content";
import { itemIconUrl, setPackIconProvider } from "../../ui/icons";

type IconRoute = readonly [itemId: string, materialId: string];

const MATERIAL_CROP_FORAGE_ARCH_ROUTES = [
  ["item.bone.ancient", "icon.original.bone-ancient"],
  ["item.bone.warden", "icon.original.bone-warden"],
  ["item.hide.antelope", "icon.original.hide-antelope"],
  ["item.hide.kebbit", "icon.original.hide-kebbit"],
  ["item.forage.redberry", "icon.original.forage-redberry"],
  ["item.forage.cadava", "icon.original.forage-cadava"],
  ["item.forage.dwellberry", "icon.original.forage-dwellberry"],
  ["item.forage.cloudberry", "icon.original.forage-cloudberry"],
  ["item.forage.jangerberry", "icon.original.forage-jangerberry"],
  ["item.forage.pricklypear", "icon.original.forage-pricklypear"],
  ["item.forage.whiteberry", "icon.original.forage-whiteberry"],
  ["item.forage.poisonivy", "icon.original.forage-poisonivy"],
  ["item.forage.everlight", "icon.original.forage-everlight"],
  ["item.arch.samples", "icon.original.arch-samples"],
  ["item.plank.oak", "icon.original.plank-oak"],
  ["item.plank.teak", "icon.original.plank-teak"],
  ["item.plank.mahogany", "icon.original.plank-mahogany"],
  ["item.bar.steel", "icon.original.bar-steel"],
  ["item.bar.mithril", "icon.original.bar-mithril"],
  ["item.bar.adamant", "icon.original.bar-adamant"],
  ["item.bar.runite", "icon.original.bar-runite"],
  ["item.ore.mithril", "icon.original.ore-mithril"],
  ["item.ore.adamant", "icon.original.ore-adamant"],
  ["item.ore.runite", "icon.original.ore-runite"],
  ["item.seed.corn", "icon.original.seed-corn"],
  ["item.crop.corn", "icon.original.crop-corn"],
  ["item.seed.sunfruit", "icon.original.seed-sunfruit"],
  ["item.crop.sunfruit", "icon.original.crop-sunfruit"],
] as const satisfies readonly IconRoute[];

const FLATPACK_TREASURE_ROUTES = [
  ["item.flatpack.stool", "icon.original.flatpack-stool"],
  ["item.flatpack.crate", "icon.original.flatpack-crate"],
  ["item.flatpack.chair", "icon.original.flatpack-chair"],
  ["item.flatpack.table", "icon.original.flatpack-table"],
  ["item.flatpack.bench", "icon.original.flatpack-bench"],
  ["item.flatpack.bookshelf", "icon.original.flatpack-bookshelf"],
  ["item.flatpack.bed", "icon.original.flatpack-bed"],
  ["item.flatpack.dresser", "icon.original.flatpack-dresser"],
  ["item.flatpack.wardrobe", "icon.original.flatpack-wardrobe"],
  ["item.flatpack.hearth", "icon.original.flatpack-hearth"],
  ["item.flatpack.fireplace", "icon.original.flatpack-fireplace"],
  ["item.flatpack.cabinet", "icon.original.flatpack-cabinet"],
  ["item.flatpack.shelf", "icon.original.flatpack-shelf"],
  ["item.flatpack.fourposter", "icon.original.flatpack-fourposter"],
  ["item.flatpack.throne", "icon.original.flatpack-throne"],
  ["item.flatpack.altar", "icon.original.flatpack-altar"],
  ["item.treasure_map", "icon.original.treasure-map"],
] as const satisfies readonly IconRoute[];

const POTION_TONIC_SALVE_ROUTES = [
  ["item.potion.swift", "icon.original.swiftness-potion"],
  ["item.potion.strength", "icon.original.strength-potion"],
  ["item.potion.stoneskin", "icon.original.stoneskin-potion"],
  ["item.potion.gathering", "icon.original.foragers-brew"],
  ["item.potion.focus", "icon.original.hunters-focus-potion"],
  ["item.potion.gathering_keen", "icon.original.potion-gathering-keen"],
  ["item.tonic.warden", "icon.original.tonic-warden"],
  ["item.potion.swift_greater", "icon.original.potion-swift-greater"],
  ["item.potion.gathering_greater", "icon.original.potion-gathering-greater"],
  ["item.potion.strength_greater", "icon.original.potion-strength-greater"],
  ["item.potion.stoneskin_greater", "icon.original.potion-stoneskin-greater"],
  ["item.potion.focus_greater", "icon.original.potion-focus-greater"],
  ["item.tonic.warden_greater", "icon.original.tonic-warden-greater"],
  ["item.potion.swift_super", "icon.original.potion-swift-super"],
  ["item.potion.gathering_super", "icon.original.potion-gathering-super"],
  ["item.potion.strength_super", "icon.original.potion-strength-super"],
  ["item.potion.stoneskin_super", "icon.original.potion-stoneskin-super"],
  ["item.potion.focus_super", "icon.original.potion-focus-super"],
  ["item.tonic.warden_super", "icon.original.tonic-warden-super"],
  ["item.potion.swift_grand", "icon.original.potion-swift-grand"],
  ["item.potion.gathering_grand", "icon.original.potion-gathering-grand"],
  ["item.potion.strength_grand", "icon.original.potion-strength-grand"],
  ["item.potion.stoneskin_grand", "icon.original.potion-stoneskin-grand"],
  ["item.potion.focus_grand", "icon.original.potion-focus-grand"],
  ["item.tonic.warden_grand", "icon.original.tonic-warden-grand"],
  ["item.salve.dusk", "icon.original.salve-dusk"],
  ["item.salve.ember", "icon.original.salve-ember"],
  ["item.salve.frost", "icon.original.salve-frost"],
  ["item.salve.kings", "icon.original.salve-kings"],
] as const satisfies readonly IconRoute[];

const RUNE_RELIC_ROUTES = [
  ["item.rune.astral", "icon.original.astral-rune"],
  ["item.rune.body", "icon.original.body-rune"],
  ["item.rune.chaos", "icon.original.chaos-rune"],
  ["item.rune.cosmic", "icon.original.cosmic-rune"],
  ["item.relic.astrolabe", "icon.original.relic-astrolabe"],
  ["item.relic.censer", "icon.original.relic-censer"],
  ["item.relic.chalice", "icon.original.relic-chalice"],
  ["item.relic.crown", "icon.original.relic-crown"],
  ["item.relic.sceptre", "icon.original.relic-sceptre"],
  ["item.relic.torque", "icon.original.relic-torque"],
] as const satisfies readonly IconRoute[];

const ALL_ROUTES: readonly IconRoute[] = [
  ...MATERIAL_CROP_FORAGE_ARCH_ROUTES,
  ...FLATPACK_TREASURE_ROUTES,
  ...POTION_TONIC_SALVE_ROUTES,
  ...RUNE_RELIC_ROUTES,
];

const sortedItemIds = (routes: readonly IconRoute[]): string[] =>
  routes.map(([itemId]) => itemId).sort();

describe("expanded original item icon routes", () => {
  it("uses exact item IDs from the live content catalog", () => {
    expect(MATERIAL_CROP_FORAGE_ARCH_ROUTES).toHaveLength(28);
    expect(FLATPACK_TREASURE_ROUTES).toHaveLength(17);
    expect(POTION_TONIC_SALVE_ROUTES).toHaveLength(29);
    expect(RUNE_RELIC_ROUTES).toHaveLength(10);

    for (const [itemId] of ALL_ROUTES) expect(ITEMS, itemId).toHaveProperty(itemId);

    const liveFlatpacks = Object.keys(ITEMS).filter((itemId) => itemId.startsWith("item.flatpack."));
    expect(liveFlatpacks.sort()).toEqual(
      sortedItemIds(FLATPACK_TREASURE_ROUTES.filter(([itemId]) => itemId.startsWith("item.flatpack."))),
    );

    const livePotionFamily = Object.keys(ITEMS).filter((itemId) =>
      /^item\.potion\.(?:swift|strength|stoneskin|gathering|focus)(?:_(?:keen|greater|super|grand))?$/.test(itemId)
      || /^item\.tonic\.warden(?:_(?:greater|super|grand))?$/.test(itemId)
      || /^item\.salve\.(?:dusk|ember|frost|kings)$/.test(itemId),
    );
    expect(livePotionFamily.sort()).toEqual(sortedItemIds(POTION_TONIC_SALVE_ROUTES));
  });

  it("has a generated 64px PNG for every mapped material", () => {
    for (const [, materialId] of ALL_ROUTES) {
      const stem = materialId.replace("icon.original.", "");
      const folder = stem.endsWith("-rune") ? "runes" : "items";
      const path = join(process.cwd(), "src", "render", "art", folder, `${stem}-64.png`);
      expect(existsSync(path), `${materialId} -> ${path}`).toBe(true);
    }
  });

  it("routes every live item to its generated original material", () => {
    const requested: string[] = [];
    setPackIconProvider((materialId) => {
      requested.push(materialId);
      return `pack:${materialId}`;
    });

    try {
      for (const [itemId, materialId] of ALL_ROUTES) {
        expect(itemIconUrl(itemId), itemId).toBe(`pack:${materialId}`);
      }
      expect(requested).toEqual(ALL_ROUTES.map(([, materialId]) => materialId));
    } finally {
      setPackIconProvider(() => null);
    }
  });
});
