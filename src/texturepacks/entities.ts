// Entity textures from Minecraft-Java-style resource packs: which pack
// files feed which logical entity-skin keys, and where each rig part sits
// in the classic 64px-based entity atlas layouts. Shared by the browser
// importer and the bake script; the renderer maps these regions onto its
// vanilla-proportioned box rigs. Packs that omit a file simply leave that
// mob on the built-in original art.

export interface EntityTextureDef {
  /** Logical skin key, e.g. "entity.pig". */
  key: string;
  /** Candidate paths under assets/minecraft/textures/entity/, first match wins. */
  paths: string[];
}

/**
 * Every entity texture the game can use. All classic layouts are 64 base
 * pixels wide; a pack's actual scale is its pixel width / 64 (a 64x pack
 * ships 256px-wide entity art). Heights vary (some packs re-export 64x32
 * layouts on square canvases), so regions are resolved against the real
 * pixel size at draw time.
 */
export const ENTITY_TEXTURES: EntityTextureDef[] = [
  { key: "entity.cow", paths: ["cow/temperate_cow.png", "cow/cow_temperate.png", "cow/cow.png"] },
  { key: "entity.pig", paths: ["pig/temperate_pig.png", "pig/pig_temperate.png", "pig/pig.png"] },
  { key: "entity.sheep.skin", paths: ["sheep/sheep.png"] },
  { key: "entity.sheep.wool", paths: ["sheep/sheep_wool.png", "sheep/sheep_fur.png"] },
  {
    key: "entity.chicken",
    paths: ["chicken/temperate_chicken.png", "chicken/chicken_temperate.png", "chicken/chicken.png"],
  },
  { key: "entity.wolf", paths: ["wolf/wolf.png"] },
  { key: "entity.spider", paths: ["spider/spider.png"] },
  { key: "entity.cave_spider", paths: ["spider/cave_spider.png"] },
  { key: "entity.slime", paths: ["slime/slime.png"] },
  { key: "entity.zombie", paths: ["zombie/zombie.png"] },
  { key: "entity.husk", paths: ["zombie/husk.png"] },
  // Not a mob: the chest prop's faces are composited from this atlas.
  { key: "entity.chest", paths: ["chest/normal.png"] },
  // ── Variant-mob skins (ASSETS_NEEDED.md §2b) ─────────────────────────────
  // Until these files are delivered, each variant renders as a tint-recolor
  // of its base mob. Drop the PNG at the exact path below (inside
  // assets/minecraft/textures/entity/) and the variant stops being a recolor.
  // Wolf-family (base layout: wolf/wolf.png, 64×32).
  { key: "entity.frost_wolf", paths: ["wolf/frost_wolf.png"] },
  { key: "entity.dire_wolf", paths: ["wolf/dire_wolf.png"] },
  { key: "entity.ash_hound", paths: ["wolf/ash_hound.png"] },
  // Spider-family (base layout: spider/spider.png, 64×32).
  { key: "entity.gloom_spinner", paths: ["spider/gloom_spinner.png"] },
  { key: "entity.dust_scuttler", paths: ["spider/dust_scuttler.png"] },
  { key: "entity.vine_stalker", paths: ["spider/vine_stalker.png"] },
  { key: "entity.thornback", paths: ["spider/thornback.png"] },
  { key: "entity.ember_crawler", paths: ["spider/ember_crawler.png"] },
  { key: "entity.old_gnasher", paths: ["spider/old_gnasher.png"] },
  // Slime-family (base layout: slime/slime.png, 64×32).
  { key: "entity.bog_slime", paths: ["slime/bog_slime.png"] },
  { key: "entity.blight_slime", paths: ["slime/blight_slime.png"] },
  { key: "entity.bramble_slime", paths: ["slime/bramble_slime.png"] },
  { key: "entity.marsh_lurker", paths: ["slime/marsh_lurker.png"] },
  { key: "entity.silt_king", paths: ["slime/silt_king.png"] },
  // Zombie/husk-family (base layout: zombie/zombie.png, 64×64).
  { key: "entity.mire_husk", paths: ["zombie/mire_husk.png"] },
  { key: "entity.dune_husk", paths: ["zombie/dune_husk.png"] },
  { key: "entity.glacial_wight", paths: ["zombie/glacial_wight.png"] },
  { key: "entity.grave_shambler", paths: ["zombie/grave_shambler.png"] },
  { key: "entity.hollow_wight", paths: ["zombie/hollow_wight.png"] },
  { key: "entity.spore_shambler", paths: ["zombie/spore_shambler.png"] },
  // Livestock variants (base layouts: cow/cow.png, pig/pig.png — 64×32).
  { key: "entity.prairie_bull", paths: ["cow/prairie_bull.png"] },
  { key: "entity.boar", paths: ["pig/boar.png"] },
  // Skeleton variant (base layout: skeleton/skeleton.png, 64×32).
  { key: "entity.barrow_lord", paths: ["skeleton/barrow_lord.png"] },
  // Construct/golem-family (iron-golem-ish layout, 64×64 — the construct rig
  // gains UV-mapping when this art lands; see ASSETS_NEEDED.md §2b).
  { key: "entity.canyon_construct", paths: ["golem/canyon_construct.png"] },
  { key: "entity.rust_construct", paths: ["golem/rust_construct.png"] },
  { key: "entity.rootbound_warden", paths: ["golem/rootbound_warden.png"] },
  { key: "entity.moss_golem", paths: ["golem/moss_golem.png"] },
  { key: "entity.stone_sentinel", paths: ["golem/stone_sentinel.png"] },
  { key: "entity.liftworks_overseer", paths: ["golem/liftworks_overseer.png"] },
];

/** Fast lookup: entity-relative path -> texture key (first-listed wins). */
export const ENTITY_PATH_KEYS: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const def of ENTITY_TEXTURES) {
    for (const path of def.paths) {
      if (!map.has(path)) map.set(path, def.key);
    }
  }
  return map;
})();

/** Pick each entity key's best available pack path. */
export function planEntityTextures(availableEntityPaths: string[]): Array<{ key: string; path: string }> {
  const available = new Set(availableEntityPaths);
  const planned: Array<{ key: string; path: string }> = [];
  for (const def of ENTITY_TEXTURES) {
    const path = def.paths.find((p) => available.has(p));
    if (path) planned.push({ key: def.key, path });
  }
  return planned;
}
