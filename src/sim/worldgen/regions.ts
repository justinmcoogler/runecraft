// The nine regions of the starter province: anchors, extents and tiers.
// Pure data — geography, towns, roads, zones, tests and the atlas all read
// from this one table so names and coordinates never drift apart.

export interface RegionDef {
  id: string;
  name: string;
  /** Settlement or region heart in world cells. */
  center: { x: number; z: number };
  /** Loose bounding box (organic borders are drawn by the geography). */
  rect: { x0: number; z0: number; x1: number; z1: number };
  /** Danger tier: 1 starter .. 5 endgame. Roads stay one tier safer. */
  tier: 1 | 2 | 3 | 4 | 5;
  tagline: string;
}

export const WORLD = 2500;

/** Sea level and the practical height range (sim units; Y ≈ 63 + 3h). */
export const SEA_LEVEL_Y = 62;

export const REGIONS: Record<string, RegionDef> = {
  greenvale: {
    id: "zone.greenvale",
    name: "Greenvale",
    center: { x: 1250, z: 1375 },
    rect: { x0: 950, z0: 975, x1: 1625, z1: 1775 },
    tier: 1,
    tagline: "The starter kingdom: meadows, farms and the king's peace.",
  },
  whisperwood: {
    id: "zone.whisperwood",
    name: "The Whisperwood",
    center: { x: 550, z: 1300 },
    rect: { x0: 110, z0: 925, x1: 950, z1: 1850 },
    tier: 2,
    tagline: "Old timber, mist, and things that watch from the ferns.",
  },
  willowmere: {
    id: "zone.willowmere",
    name: "Willowmere",
    center: { x: 665, z: 1415 },
    rect: { x0: 540, z0: 1300, x1: 800, z1: 1540 },
    tier: 1,
    tagline: "A lantern-lit forest village on the mere.",
  },
  highforge: {
    id: "zone.highforge",
    name: "Highforge",
    center: { x: 650, z: 625 },
    rect: { x0: 90, z0: 90, x1: 1065, z1: 975 },
    tier: 2,
    tagline: "White stone, deep mines, and smoke over the highlands.",
  },
  frostspine: {
    id: "zone.frostspine",
    name: "The Frostspine",
    center: { x: 1315, z: 265 },
    rect: { x0: 1025, z0: 0, x1: 1650, z1: 650 },
    tier: 4,
    tagline: "The frozen wall of the north. The pass is safe. Nothing else is.",
  },
  stonegate: {
    id: "zone.stonegate",
    name: "Stonegate",
    center: { x: 1800, z: 750 },
    rect: { x0: 1515, z0: 390, x1: 2250, z1: 1115 },
    tier: 2,
    tagline: "Where every caravan road in the province meets a toll.",
  },
  sunscar: {
    id: "zone.sunscar",
    name: "The Sunscar Drylands",
    center: { x: 2125, z: 1340 },
    rect: { x0: 1865, z0: 975, x1: 2499, z1: 1800 },
    tier: 3,
    tagline: "Red rock, buried ruins, and one cold well between them.",
  },
  murkfen: {
    id: "zone.murkfen",
    name: "The Murkfen",
    center: { x: 1175, z: 2050 },
    rect: { x0: 750, z0: 1750, x1: 1640, z1: 2499 },
    tier: 3,
    tagline: "The ground drinks, and sometimes it swallows.",
  },
  tidewatch: {
    id: "zone.tidewatch",
    name: "Tidewatch Coast",
    center: { x: 2000, z: 2050 },
    rect: { x0: 1625, z0: 1750, x1: 2499, z1: 2499 },
    tier: 2,
    tagline: "Salt wind, white cliffs, and a harbor waiting for sails.",
  },
  ironroot: {
    id: "zone.ironroot",
    name: "Ironroot Camp",
    center: { x: 1190, z: 800 },
    rect: { x0: 1065, z0: 650, x1: 1440, z1: 975 },
    tier: 2,
    tagline: "The fortified crossroads where recruits become veterans.",
  },
};

/** Player spawn: Greenvale's plaza, per the province charter. */
export const SPAWN = { x: 1250, z: 1418 };
