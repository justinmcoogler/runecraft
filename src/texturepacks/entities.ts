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
