// The nine regions' settlements, dungeons and countryside. Each build
// function stamps its ground (pads, walls, plazas) and populates services,
// NPCs, resource nodes, livestock, and dangers, registering everything a
// traveller can find in the POI list. Road gates are fixed constants here;
// the road network aims at them.

import { BIOME } from "./geo";
import { makeDungeon, type DungeonSpec } from "./dungeons";
import { cellHash } from "./noise";
import {
  type Draft,
  fenceRun,
  feather,
  foe,
  house,
  idx,
  isFree,
  houseFits,
  node,
  npc,
  obj,
  pad,
  pen,
  poi,
  reserve,
  stampDiscovery,
  wallRect,
} from "./props";
import { REGIONS, SPAWN } from "./regions";

/** Construction quest sites (applyWorldFlags lays the finished work here). */
export const BUILD_SITES = {
  jetty: { x: 1404, z: 1500 }, // Silverlake west shore (planks run east into the water)
  footbridge: { x: 1178, z: 1601 }, // over the Merewater, south meadows
  ford: { x: 1391, z: 1972 }, // stepping stones where the fen road meets the river
  ramp: { x: 1160, z: 1052 }, // up the old terraces on the Ironroot road
};

/** Where each dungeon's door returns you to (also its entrance cell). */
export const DUNGEON_DOORS: Record<string, { x: number; z: number }> = {
  "region.copper_hollow": { x: 1082, z: 1183 }, // old starter mine, NW Greenvale
  "region.restless_crypt": { x: 1345, z: 1310 }, // beneath the graveyard
  "region.blackbriar_manor": { x: 378, z: 1078 }, // the haunted manor
  "region.deepforge_mine": { x: 640, z: 570 }, // under Highforge
  "region.trial_city": { x: 1318, z: 300 }, // below Frostwatch
  "region.stonegate_sewers": { x: 1852, z: 792 }, // behind the river docks
  "region.sun_temple": { x: 2315, z: 1625 }, // the Sunken Sun Temple
  "region.glowfen_caves": { x: 952, z: 2248 }, // under the Murkfen
  "region.stronghold_trials": { x: 1196, z: 838 }, // Ironroot's proving ground
};

export const DUNGEON_SPECS: DungeonSpec[] = [
  {
    id: "region.restless_crypt",
    name: "The Restless Crypt",
    exitCell: DUNGEON_DOORS["region.restless_crypt"],
    rooms: 10,
    floor: "stonebrick",
    theme: { sky: "#141420", sun: 0.85, ambient: 0.72 },
    enemies: [
      { defId: "enemy.mire_husk", weight: 3 },
      { defId: "enemy.spider", weight: 2 },
    ],
    boss: "enemy.dune_husk",
    lootItems: [{ itemId: "item.coin", qty: 10 }],
    seed: 11,
  },
  {
    id: "region.blackbriar_manor",
    name: "Blackbriar Manor",
    exitCell: DUNGEON_DOORS["region.blackbriar_manor"],
    rooms: 12,
    floor: "plank",
    theme: { sky: "#181322", sun: 0.8, ambient: 0.7 },
    enemies: [
      { defId: "enemy.mire_husk", weight: 2 },
      { defId: "enemy.vine_stalker", weight: 2 },
      { defId: "enemy.spider", weight: 1 },
    ],
    boss: "enemy.rootbound_warden",
    lootItems: [{ itemId: "item.herb.mint", qty: 2 }, { itemId: "item.coin", qty: 18 }],
    seed: 23,
  },
  {
    id: "region.deepforge_mine",
    name: "The Deepforge",
    exitCell: DUNGEON_DOORS["region.deepforge_mine"],
    rooms: 14,
    floor: "dirt",
    theme: { sky: "#171a21", sun: 0.95, ambient: 0.78 },
    enemies: [
      { defId: "enemy.cave_spider", weight: 3 },
      { defId: "enemy.spider", weight: 2 },
    ],
    rocks: [
      { defId: "resource.rock.iron", weight: 3 },
      { defId: "resource.rock.copper", weight: 2 },
      { defId: "resource.rock.tin", weight: 2 },
    ],
    boss: "enemy.canyon_construct",
    lootItems: [{ itemId: "item.ore.iron", qty: 2 }],
    seed: 37,
  },
  {
    id: "region.trial_city",
    name: "The Ancient Trial City",
    exitCell: DUNGEON_DOORS["region.trial_city"],
    rooms: 16,
    floor: "stonebrick",
    theme: { sky: "#101623", sun: 0.9, ambient: 0.7 },
    enemies: [
      { defId: "enemy.rust_construct", weight: 3 },
      { defId: "enemy.canyon_construct", weight: 2 },
      { defId: "enemy.frost_wolf", weight: 1 },
    ],
    boss: "enemy.liftworks_overseer",
    lootItems: [{ itemId: "item.coin", qty: 40 }],
    seed: 41,
  },
  {
    id: "region.stonegate_sewers",
    name: "The Stonegate Sewers",
    exitCell: DUNGEON_DOORS["region.stonegate_sewers"],
    rooms: 18,
    floor: "stone",
    theme: { sky: "#12181a", sun: 0.85, ambient: 0.74 },
    enemies: [
      { defId: "enemy.bog_slime", weight: 3 },
      { defId: "enemy.spider", weight: 2 },
      { defId: "enemy.mire_husk", weight: 1 },
    ],
    boss: "enemy.silt_king",
    lootItems: [{ itemId: "item.coin", qty: 25 }],
    seed: 53,
  },
  {
    id: "region.sun_temple",
    name: "The Sunken Sun Temple",
    exitCell: DUNGEON_DOORS["region.sun_temple"],
    rooms: 12,
    floor: "sand",
    theme: { sky: "#1d1508", sun: 1.0, ambient: 0.72 },
    enemies: [
      { defId: "enemy.dune_husk", weight: 3 },
      { defId: "enemy.dust_scuttler", weight: 2 },
    ],
    boss: "enemy.canyon_construct",
    lootItems: [{ itemId: "item.relic.mask", qty: 1 }, { itemId: "item.coin", qty: 30 }],
    seed: 67,
  },
  {
    id: "region.glowfen_caves",
    name: "The Glowfen Caves",
    exitCell: DUNGEON_DOORS["region.glowfen_caves"],
    rooms: 11,
    floor: "mud",
    theme: { sky: "#0e1a16", sun: 0.8, ambient: 0.8 },
    enemies: [
      { defId: "enemy.bog_slime", weight: 3 },
      { defId: "enemy.mire_husk", weight: 2 },
    ],
    boss: "enemy.silt_king",
    lootItems: [{ itemId: "item.herb.emberleaf", qty: 2 }],
    seed: 71,
  },
  {
    id: "region.stronghold_trials",
    name: "The Stronghold of Trials",
    exitCell: DUNGEON_DOORS["region.stronghold_trials"],
    rooms: 12,
    floor: "stone",
    theme: { sky: "#161616", sun: 0.9, ambient: 0.75 },
    enemies: [
      { defId: "enemy.timber_wolf", weight: 2 },
      { defId: "enemy.cave_spider", weight: 2 },
      { defId: "enemy.dust_scuttler", weight: 1 },
    ],
    boss: "enemy.old_gnasher",
    lootItems: [{ itemId: "item.coin", qty: 20 }],
    seed: 83,
  },
];

export const MADE_DUNGEONS = Object.fromEntries(
  DUNGEON_SPECS.map((s) => [s.id, makeDungeon(s)]),
);

function dungeonEntrance(
  d: Draft,
  regionId: string,
  name: string,
  region: string,
  tier: number,
): void {
  const door = DUNGEON_DOORS[regionId];
  const h = d.geo.heights[idx(door.x, door.z)];
  // A stone knoll frames the cave mouth; the door cell itself stays level.
  pad(d, door.x - 3, door.x + 3, door.z - 3, door.z + 3, Math.max(0, h), "stone");
  pad(d, door.x - 1, door.x + 1, door.z - 1, door.z + 1, Math.max(0, h), "dirt");
  feather(d, door.x - 3, door.x + 3, door.z - 3, door.z + 3, Math.max(0, h));
  obj(d, `${regionId}.mouth`, "object.portal.cave", door.x, door.z, {
    // The {-1,-1} sentinel resolves to the dungeon's own spawn cell.
    portal: { targetRegionId: regionId, targetCell: { x: -1, z: -1 } },
  });
  poi(d, { name, kind: "dungeon", x: door.x, z: door.z, region, tier });
}

const signpost = (d: Draft, x: number, z: number) => {
  if (isFree(d, x, z)) obj(d, "sign", "object.signpost", x, z);
};

// ---------------------------------------------------------------------------
// A reusable market-town core. Everything a traveller needs, arranged
// around a paved plaza: bank chest, well, smithy trio, cookfire, stalls,
// lamps and a ring of houses. Specifics are layered on by each region.
// ---------------------------------------------------------------------------
interface TownOpts {
  key: string; // id prefix
  name: string;
  region: string;
  tier: number;
  cx: number;
  cz: number;
  half: number; // pad half-size
  padBlock?: "grass" | "dirt" | "sand" | "drygrass" | "snow";
  walled?: boolean;
  services: string[];
}

function townCore(d: Draft, o: TownOpts): { h: number } {
  const { cx, cz, half } = o;
  const h = Math.max(0, d.geo.heights[idx(cx, cz)]);
  pad(d, cx - half, cx + half, cz - half, cz + half, h, o.padBlock ?? "grass");
  feather(d, cx - half, cx + half, cz - half, cz + half, h);
  // Plaza.
  pad(d, cx - 7, cx + 7, cz - 7, cz + 7, h, "stonebrick");
  if (o.walled) {
    wallRect(d, cx - half, cx + half, cz - half, cz + half, h, [
      { x: cx, z: cz - half }, { x: cx, z: cz + half },
      { x: cx - half, z: cz }, { x: cx + half, z: cz },
    ]);
  }
  const p = o.key;
  obj(d, `${p}.bank`, "object.storage_chest.basic", cx - 5, cz - 5, {
    initialItems: [{ itemId: "item.coin", qty: 5 }],
  });
  obj(d, `${p}.well`, "object.well.basic", cx, cz);
  obj(d, `${p}.furnace`, "object.furnace.basic", cx + 5, cz - 5);
  obj(d, `${p}.anvil`, "object.anvil.basic", cx + 7, cz - 5);
  obj(d, `${p}.bench`, "object.workbench.basic", cx + 5, cz - 7);
  // Every town's Carpenter's Bench — the repeatable Construction ladder.
  obj(d, `${p}.buildbench`, "object.buildbench.basic", cx + 3, cz - 7);
  obj(d, `${p}.fire`, "object.campfire.basic", cx - 5, cz + 5);
  obj(d, `${p}.cauldron`, "object.cauldron.basic", cx - 7, cz + 5);
  obj(d, `${p}.stall`, "object.stall.market", cx + 4, cz + 5, {
    footprint: [{ x: cx + 5, z: cz + 5 }],
  });
  node(d, `${p}.stallnode`, "resource.stall.market", cx + 4, cz + 6);
  for (const [lx, lz] of [
    [cx - 8, cz - 8], [cx + 8, cz - 8], [cx - 8, cz + 8], [cx + 8, cz + 8],
  ] as const) {
    obj(d, `${p}.lamp`, "object.lamp.post", lx, lz);
  }
  obj(d, `${p}.banner`, "object.banner.red", cx - 1, cz - 7);
  // Plaza furniture: benches face the well, planters soften the corners,
  // and a second stall gives the market some bustle.
  obj(d, `${p}.bench`, "object.bench.wood", cx - 2, cz - 2);
  obj(d, `${p}.bench`, "object.bench.wood", cx + 2, cz - 2);
  obj(d, `${p}.bench`, "object.bench.wood", cx - 2, cz + 3);
  obj(d, `${p}.stall2`, "object.stall.market", cx - 5, cz + 7, {
    footprint: [{ x: cx - 4, z: cz + 7 }],
  });
  obj(d, `${p}.freight`, "object.crate.wood", cx + 7, cz + 4);
  obj(d, `${p}.freight`, "object.barrel.wood", cx + 7, cz + 3);
  for (const [fx, fz] of [
    [cx - 6, cz - 7], [cx + 6, cz - 7], [cx - 7, cz + 7], [cx + 7, cz + 6],
  ] as const) {
    if (isFree(d, fx, fz)) obj(d, `${p}.planter`, "object.flowers.wild", fx, fz);
  }
  // Houses around the plaza, each with a dressed yard: a barrel or crate
  // by the wall, a flower patch, and a worn dirt path to the door.
  const spots: Array<[number, number]> = [
    [cx - half + 4, cz - half + 4], [cx + half - 9, cz - half + 4],
    [cx - half + 4, cz + half - 9], [cx + half - 9, cz + half - 9],
    [cx - half + 4, cz - 3], [cx + half - 9, cz - 3],
  ];
  // Larger towns grow an outer cottage ring between plaza and edge.
  if (half >= 20) {
    spots.push(
      [cx - 12, cz - half + 6], [cx + 8, cz - half + 6],
      [cx - 12, cz + half - 11], [cx + 8, cz + half - 11],
    );
  }
  // The big house anchors the plaza now; the cottage ring is deferred to
  // buildCottages, which runs after every keep, hall and smithy is down —
  // placing them here first let later structures land on top of them.
  house(d, `${p}.house`, "object.house.big", spots[0][0], spots[0][1], 5, 4);
  for (let k = 1; k < spots.length; k++) {
    d.pendingCottages.push({ prefix: p, x: spots[k][0], z: spots[k][1] });
  }
  signpost(d, cx + 1, cz + 8);
  poi(d, {
    name: o.name, kind: "settlement", x: cx, z: cz,
    region: o.region, tier: o.tier, services: o.services,
  });
  return { h };
}

// ---------------------------------------------------------------------------
// 1. GREENVALE — the starter kingdom.
// ---------------------------------------------------------------------------
export function buildGreenvale(d: Draft): void {
  const R = REGIONS.greenvale;
  const cx = R.center.x;
  const cz = R.center.z;
  const { h } = townCore(d, {
    key: "gv", name: "Greenvale", region: R.name, tier: 1,
    cx, cz, half: 52, walled: true,
    services: ["bank", "store", "inn", "smithy", "kitchen", "training", "quests"],
  });

  // The Keep, north of the plaza, with its two interior halls.
  pad(d, cx - 14, cx + 14, cz - 46, cz - 24, h, "stonebrick");
  house(d, "gv.keep", "object.keep.grand", cx - 8, cz - 44, 17, 14);
  obj(d, "gv.keepdoor.barracks", "object.door.wood", cx - 10, cz - 36, {
    portal: { targetRegionId: "region.castle_barracks", targetCell: { x: -1, z: -1 } },
  });
  obj(d, "gv.keepdoor.store", "object.door.wood", cx + 10, cz - 36, {
    portal: { targetRegionId: "region.castle_storehouse", targetCell: { x: -1, z: -1 } },
  });
  obj(d, "gv.spire", "object.spire.small", cx - 16, cz - 44);
  npc(d, "castle.npc.corin", "Steward Corin", cx, cz - 30, 2, [
    "Welcome to Greenvale. The plaza well is sweet and the bank is honest.",
    "The keep stands, the crypt does not rest. Mind the graveyard after dark.",
    "Six roads leave this town. All of them come back, one way or another.",
  ]);

  // Store and inn (interior shops) on the plaza's east side.
  house(d, "gv.store", "object.store.basic", cx + 12, cz - 2, 6, 5);
  obj(d, "gv.storedoor", "object.door.wood", cx + 13, cz + 3, {
    portal: { targetRegionId: "region.town_store", targetCell: { x: -1, z: -1 } },
  });
  house(d, "gv.inn", "object.house.big", cx + 12, cz + 6, 6, 5);
  obj(d, "gv.inndoor", "object.door.wood", cx + 13, cz + 11, {
    portal: { targetRegionId: "region.town_inn", targetCell: { x: -1, z: -1 } },
  });

  // Bakery and kitchen; Bett keeps the ovens.
  house(d, "gv.bakery", "object.house.small", cx - 16, cz - 2, 5, 4);
  obj(d, "gv.oven", "object.furnace.basic", cx - 17, cz + 3);
  npc(d, "town.npc.bett", "Bett the Baker", cx - 14, cz + 3, 2, [
    "Fresh loaves at dawn. Wheat's from the south fields — you can pick some.",
    "The mill grinds slow but it grinds. Take flour, leave gossip.",
  ]);

  // Training yard, SE corner: dummies, targets, the taskmasters.
  pad(d, cx + 24, cx + 44, cz + 24, cz + 44, h, "dirt");
  for (let k = 0; k < 3; k++) foe(d, "gv.dummy", "enemy.target_dummy", cx + 28 + k * 5, cz + 30);
  foe(d, "gv.rat", "enemy.spider", cx + 36, cz + 40);
  npc(d, "village.npc.brusk", "Warden Brusk", cx + 26, cz + 26, 2, [
    "Slaying's a trade like any other. I hand out contracts; you fill them.",
    "Start on spiders. Everyone starts on spiders.",
  ]);
  npc(d, "village.npc.fenwick", "Curator Fenwick", cx - 26, cz - 26, 2, [
    "Relics! The province is littered with them. Bring me what the dirt gives up.",
    "The Sun Temple's masks are the prize of any collection.",
  ]);

  // Church + graveyard, east wall — the Restless Crypt is below.
  pad(d, cx + 84, cx + 104, cz - 74, cz - 54, h, "grass");
  house(d, "gv.church", "object.house.big", cx + 88, cz - 72, 6, 5);
  for (let k = 0; k < 6; k++) {
    obj(d, "gv.grave", "object.banner.red", cx + 86 + (k % 3) * 4, cz - 62 + Math.floor(k / 3) * 4);
  }
  dungeonEntrance(d, "region.restless_crypt", "The Restless Crypt", R.name, 1);

  // Farms south of the wall: plots, flax, herbs, orchard, livestock.
  const fz = cz + 64;
  pad(d, cx - 60, cx + 60, fz - 6, fz + 26, h, "dirt");
  for (let k = 0; k < 8; k++) {
    node(d, "gv.wheat", "resource.plot.wheat", cx - 50 + k * 6, fz);
    node(d, "gv.carrot", "resource.plot.carrot", cx - 50 + k * 6, fz + 6);
    if (k < 4) node(d, "gv.pumpkin", "resource.plot.pumpkin", cx - 50 + k * 6, fz + 12);
    if (k >= 4 && k < 8) node(d, "gv.potato", "resource.plot.potato", cx - 50 + k * 6, fz + 12);
  }
  node(d, "gv.herb", "resource.herb.mint", cx + 30, fz + 6);
  node(d, "gv.herb", "resource.herb.sage", cx + 36, fz + 6);
  obj(d, "gv.mill", "object.spire.small", cx + 46, fz + 2); // the windmill silhouette
  poi(d, { name: "Greenvale Windmill", kind: "landmark", x: cx + 46, z: fz + 2, region: R.name, tier: 1 });
  pen(d, "gv.cows", cx - 56, cx - 40, fz + 16, fz + 26, "enemy.cow", 4);
  pen(d, "gv.sheep", cx - 36, cx - 20, fz + 16, fz + 26, "enemy.sheep", 4);
  pen(d, "gv.pigs", cx - 16, cx, fz + 16, fz + 26, "enemy.pig", 3);
  pen(d, "gv.hens", cx + 4, cx + 20, fz + 16, fz + 26, "enemy.chicken", 4);

  // Woodcutting grove west; lumber camp with Old Alder.
  for (let k = 0; k < 14; k++) {
    const x = cx - 95 + Math.floor(cellHash(k, 1, 301) * 34);
    const z = cz - 20 + Math.floor(cellHash(1, k, 303) * 60);
    if (isFree(d, x, z)) node(d, "gv.oak", "resource.tree.basic", x, z);
  }
  obj(d, "gv.lumberfire", "object.campfire.basic", cx - 84, cz + 8);
  npc(d, "vale.npc.alder", "Old Alder", cx - 82, cz + 10, 3, [
    "Swing low, stack high. The grove regrows faster than you'd think.",
    "West road runs to Willowmere. Mind the wood past the mere — it whispers.",
  ]);
  poi(d, { name: "Alder's Lumber Camp", kind: "landmark", x: cx - 84, z: cz + 8, region: R.name, tier: 1 });

  // Fishing dock on the Silverlake shore + the jetty build site.
  node(d, "gv.fish", "resource.fishing.pond", 1413, 1500);
  node(d, "gv.fish", "resource.fishing.pond", 1416, 1522);
  obj(d, "gv.jetty", "object.buildsite.jetty", BUILD_SITES.jetty.x, BUILD_SITES.jetty.z);
  poi(d, { name: "Silverlake Docks", kind: "landmark", x: 1406, z: 1502, region: R.name, tier: 1, services: ["fishing"] });

  // Wizard tower on the west hill: the third spawn-visible landmark.
  pad(d, 1130, 1142, 1300, 1312, h + 2, "stonebrick");
  feather(d, 1130, 1142, 1300, 1312, h + 2);
  obj(d, "gv.wiztower", "object.spire.large", 1136, 1306);
  poi(d, { name: "The Wizard's Tower", kind: "landmark", x: 1136, z: 1306, region: R.name, tier: 1 });

  // Old starter mine NW: clay pit, carts and the Copper Hollow door.
  node(d, "gv.clay", "resource.digsite.basic", 1096, 1196);
  obj(d, "gv.cart", "object.crate.wood", 1088, 1188);
  dungeonEntrance(d, "region.copper_hollow", "The Old Starter Mine", R.name, 1);

  // The court enchanter's table, west of the keep.
  obj(d, "gv.enchanter", "object.enchanter.basic", cx - 20, cz - 30);

  // The roadside wayshrine south of town (an editor-managed heirloom).
  {
    const sh = Math.max(0, d.geo.heights[idx(1293, 1453)]);
    pad(d, 1289, 1297, 1449, 1457, sh, "grass");
    feather(d, 1289, 1297, 1449, 1457, sh);
    d.structures.push({
      instanceId: "vale.structure.wayshrine",
      structureId: "wayshrine",
      cell: { x: 1291, z: 1451 },
    });
    poi(d, { name: "The Wayshrine", kind: "landmark", x: 1293, z: 1453, region: R.name, tier: 1 });
  }

  // Quest hook: the broken south bridge (a build site repairs it).
  obj(d, "gv.brokenbridge", "object.buildsite.footbridge", BUILD_SITES.footbridge.x, BUILD_SITES.footbridge.z);
  poi(d, { name: "The Broken Footbridge", kind: "landmark", x: BUILD_SITES.footbridge.x, z: BUILD_SITES.footbridge.z, region: R.name, tier: 1 });

  // Two farming hamlets in the countryside.
  for (const [hx, hz, name] of [
    [1085, 1520, "Furrowfield"], [1420, 1180, "Eastholt"],
  ] as const) {
    const hh = Math.max(0, d.geo.heights[idx(hx, hz)]);
    pad(d, hx - 12, hx + 12, hz - 10, hz + 10, hh, "grass");
    feather(d, hx - 12, hx + 12, hz - 10, hz + 10, hh);
    house(d, "gv.hamlet", "object.house.small", hx - 8, hz - 6, 5, 4);
    house(d, "gv.hamlet", "object.house.small", hx + 3, hz - 6, 5, 4);
    obj(d, "gv.hamletwell", "object.well.basic", hx, hz + 2);
    for (let k = 0; k < 4; k++) node(d, "gv.hamletwheat", "resource.plot.wheat", hx - 6 + k * 4, hz + 6);
    poi(d, { name, kind: "settlement", x: hx, z: hz, region: R.name, tier: 1, services: ["farming"] });
  }

  // Goblin-scale trouble for first contracts: a scavenger camp NE.
  stampDiscovery(d, "bandit", 1470, 1240, "gv.scav", "enemy.spider");
  poi(d, { name: "Scavengers' Hollow", kind: "discovery", x: 1470, z: 1240, region: R.name, tier: 1 });
}

// ---------------------------------------------------------------------------
// 2. WILLOWMERE + WHISPERWOOD
// ---------------------------------------------------------------------------
export function buildWhisperwood(d: Draft): void {
  const R = REGIONS.willowmere;
  const W = REGIONS.whisperwood;
  townCore(d, {
    key: "wm", name: "Willowmere", region: W.name, tier: 1,
    cx: R.center.x, cz: R.center.z, half: 34,
    services: ["bank", "market", "sawmill", "herbalist", "fishing"],
  });
  const cx = R.center.x;
  const cz = R.center.z;
  // Herbalist, sawmill, seed stall, jail, beekeeper, shrine.
  house(d, "wm.herbalist", "object.house.small", cx - 24, cz - 20, 5, 4);
  node(d, "wm.herb", "resource.herb.sage", cx - 20, cz - 14);
  node(d, "wm.herb", "resource.herb.mint", cx - 17, cz - 14);
  obj(d, "wm.sawmill", "object.workbench.basic", cx + 22, cz - 18);
  obj(d, "wm.sawlogs", "object.crate.wood", cx + 24, cz - 16);
  house(d, "wm.jail", "object.house.small", cx + 20, cz + 18, 5, 4);
  obj(d, "wm.bee", "object.crate.wood", cx - 26, cz + 20);
  node(d, "wm.beeherb", "resource.bush.berry", cx - 24, cz + 22);
  stampDiscovery(d, "shrine", cx - 30, cz + 4, "wm.shrine");
  // Willow grove and the mere's fishing bank.
  for (let k = 0; k < 10; k++) {
    const x = 640 + Math.floor(cellHash(k, 3, 311) * 60);
    const z = 1460 + Math.floor(cellHash(3, k, 313) * 30);
    if (isFree(d, x, z)) node(d, "wm.willow", "resource.tree.basic", x, z);
  }
  node(d, "wm.fish", "resource.fishing.pond", 700, 1452);
  npc(d, "wm.npc.maple", "Wisewoman Maple", cx - 22, cz - 16, 2, [
    "The wood talks. Mostly it complains about the axe.",
    "Blackbriar Manor? Keep to the road, knock twice, and don't stay for supper.",
  ]);

  // Blackbriar Manor: the haunted landmark and dungeon.
  const bb = DUNGEON_DOORS["region.blackbriar_manor"];
  const bh = Math.max(0, d.geo.heights[idx(bb.x, bb.z)]);
  pad(d, bb.x - 20, bb.x + 20, bb.z - 16, bb.z + 16, bh, "drygrass");
  feather(d, bb.x - 20, bb.x + 20, bb.z - 16, bb.z + 16, bh);
  house(d, "ww.manor", "object.house.big", bb.x - 10, bb.z - 12, 9, 6);
  house(d, "ww.manorwing", "object.house.small", bb.x + 4, bb.z - 12, 6, 5);
  obj(d, "ww.manorlamp", "object.lamp.post", bb.x - 12, bb.z + 4);
  dungeonEntrance(d, "region.blackbriar_manor", "Blackbriar Manor", W.name, 2);

  // Whisperwood wilds: logging camp, druid stones, the Elder Bough,
  // spider hollow, a bandit roadblock and mossy ruins.
  stampDiscovery(d, "campsite", 480, 1180, "ww.logcamp");
  poi(d, { name: "Whisperwood Logging Camp", kind: "discovery", x: 480, z: 1180, region: W.name, tier: 2 });
  stampDiscovery(d, "stones", 300, 1420, "ww.druid");
  poi(d, { name: "The Druid Rings", kind: "landmark", x: 300, z: 1420, region: W.name, tier: 2 });
  node(d, "ww.elderbough", "resource.tree.grand.oak", 520, 1090);
  poi(d, { name: "The Elder Bough", kind: "landmark", x: 520, z: 1090, region: W.name, tier: 2 });
  for (let k = 0; k < 5; k++) foe(d, "ww.spider", "enemy.spider", 236 + k * 6, 1560 + (k % 2) * 8);
  poi(d, { name: "Spider Hollow", kind: "discovery", x: 250, z: 1565, region: W.name, tier: 2 });
  stampDiscovery(d, "ruin", 200, 1240, "ww.ruin");
  poi(d, { name: "Mosswall Ruin", kind: "landmark", x: 200, z: 1240, region: W.name, tier: 2 });
  stampDiscovery(d, "bandit", 830, 1290, "ww.roadblock", "enemy.timber_wolf");
  poi(d, { name: "The Toll Nobody Pays", kind: "discovery", x: 830, z: 1290, region: W.name, tier: 2 });
  for (let k = 0; k < 8; k++) {
    foe(d, "ww.wolf", "enemy.timber_wolf", 380 + Math.floor(cellHash(k, 9, 331) * 300), 1600 + Math.floor(cellHash(9, k, 333) * 140));
  }
  // Hunting trails through the deep wood.
  node(d, "ww.trail", "resource.trail.rabbit", 560, 1240);
  node(d, "ww.trail", "resource.trail.moor", 340, 1330);

  // Ferndown: a forester hamlet on the fen road, deep in the south wood.
  {
    const fx = 772;
    const fz = 1692;
    const fh = Math.max(0, d.geo.heights[idx(fx, fz)]);
    pad(d, fx - 14, fx + 14, fz - 10, fz + 10, fh, "grass");
    feather(d, fx - 14, fx + 14, fz - 10, fz + 10, fh);
    house(d, "ww.ferndown", "object.house.small", fx - 9, fz - 7, 5, 4);
    house(d, "ww.ferndown", "object.house.small", fx + 4, fz - 7, 5, 4);
    obj(d, "ww.ferndownfire", "object.campfire.basic", fx, fz + 2);
    obj(d, "ww.ferndownchest", "object.storage_chest.basic", fx - 6, fz + 4);
    for (let k = 0; k < 5; k++) {
      const tx = fx - 20 + Math.floor(cellHash(k, 41, 341) * 40);
      const tz = fz + 12 + Math.floor(cellHash(41, k, 343) * 12);
      if (isFree(d, tx, tz)) node(d, "ww.ferndownoak", "resource.tree.basic", tx, tz);
    }
    poi(d, {
      name: "Ferndown", kind: "settlement", x: fx, z: fz,
      region: W.name, tier: 2, services: ["forestry", "storage", "campfire"],
    });
  }
}

// ---------------------------------------------------------------------------
// 3. HIGHFORGE
// ---------------------------------------------------------------------------
export function buildHighforge(d: Draft): void {
  const R = REGIONS.highforge;
  const cx = R.center.x;
  const cz = R.center.z;
  townCore(d, {
    key: "hf", name: "Highforge", region: R.name, tier: 2,
    cx, cz, half: 46, walled: true, padBlock: "dirt",
    services: ["bank", "smithy", "mining guild", "quarry", "furnace"],
  });
  // Knight hall + park fountain.
  house(d, "hf.hall", "object.keep.grand", cx - 8, cz - 40, 14, 10);
  obj(d, "hf.fountain", "object.well.basic", cx, cz - 16);
  // Mining district: guild, cart station, ore yard, extra furnaces.
  pad(d, cx + 14, cx + 42, cz - 12, cz + 16, Math.max(0, d.geo.heights[idx(cx, cz)]), "stone");
  obj(d, "hf.guild", "object.store.basic", cx + 20, cz - 8, {
    footprint: [{ x: cx + 21, z: cz - 8 }, { x: cx + 20, z: cz - 7 }, { x: cx + 21, z: cz - 7 }],
  });
  obj(d, "hf.cart", "object.crate.wood", cx + 26, cz + 2);
  obj(d, "hf.cart2", "object.barrel.wood", cx + 28, cz + 2);
  obj(d, "hf.furnace2", "object.furnace.basic", cx + 32, cz - 4);
  npc(d, "hf.npc.master", "Forgemaster Edda", cx + 22, cz - 4, 2, [
    "Iron in the hills, coal in the valley, and the Deepforge under it all.",
    "The quarry pays by the block. The mine pays by the scar.",
  ]);
  // Quarry north-east of the wall, iron + stone faces.
  const qx = cx + 90;
  const qz = cz - 60;
  const qh = Math.max(0, d.geo.heights[idx(qx, qz)]);
  pad(d, qx - 14, qx + 14, qz - 12, qz + 12, qh, "stone");
  feather(d, qx - 14, qx + 14, qz - 12, qz + 12, qh);
  for (let k = 0; k < 5; k++) node(d, "hf.iron", "resource.rock.iron", qx - 10 + k * 5, qz - 8);
  for (let k = 0; k < 5; k++) node(d, "hf.stoneface", "resource.rock.copper", qx - 10 + k * 5, qz + 8);
  poi(d, { name: "Highforge Quarry", kind: "landmark", x: qx, z: qz, region: R.name, tier: 2, services: ["mining"] });
  // Farms outside the south wall.
  for (let k = 0; k < 5; k++) node(d, "hf.wheat", "resource.plot.wheat", cx - 20 + k * 5, cz + 56);
  pen(d, "hf.sheep", cx + 6, cx + 24, cz + 52, cz + 62, "enemy.sheep", 3);
  // The Deepforge, monastery, shepherds, trolls' tor, alpine lake.
  dungeonEntrance(d, "region.deepforge_mine", "The Deepforge", R.name, 2);
  stampDiscovery(d, "shrine", 470, 300, "hf.monastery");
  poi(d, { name: "Cloudrest Monastery", kind: "landmark", x: 470, z: 300, region: R.name, tier: 3 });
  stampDiscovery(d, "campsite", 820, 480, "hf.shepherd");
  poi(d, { name: "Shepherd's Rest", kind: "discovery", x: 820, z: 480, region: R.name, tier: 2 });
  for (let k = 0; k < 4; k++) foe(d, "hf.construct", "enemy.canyon_construct", 300 + k * 30, 180 + (k % 2) * 24);
  poi(d, { name: "The Sleeping Tor", kind: "landmark", x: 340, z: 200, region: R.name, tier: 4, notes: "Stone giants wake badly." });
  node(d, "hf.alpinefish", "resource.fishing.pond", 208, 505);
  poi(d, { name: "Mirrormere", kind: "landmark", x: 208, z: 505, region: R.name, tier: 3, services: ["fishing"] });
  stampDiscovery(d, "ruin", 900, 260, "hf.aqueduct");
  poi(d, { name: "The Broken Aqueduct", kind: "landmark", x: 900, z: 260, region: R.name, tier: 3 });
}

// ---------------------------------------------------------------------------
// 4. FROSTSPINE
// ---------------------------------------------------------------------------
export function buildFrostspine(d: Draft): void {
  const R = REGIONS.frostspine;
  const fx = R.center.x;
  const fz = R.center.z;
  // Frostwatch Fortress: an abandoned bailey on the pass.
  const fh = Math.max(0, d.geo.heights[idx(fx, fz)]);
  pad(d, fx - 26, fx + 26, fz - 20, fz + 20, fh, "snow");
  feather(d, fx - 26, fx + 26, fz - 20, fz + 20, fh);
  wallRect(d, fx - 26, fx + 26, fz - 20, fz + 20, fh, [
    { x: fx, z: fz + 20 }, { x: fx, z: fz - 20 },
  ]);
  house(d, "fs.hall", "object.keep.grand", fx - 7, fz - 12, 14, 9);
  obj(d, "fs.brazier", "object.campfire.basic", fx, fz + 6);
  obj(d, "fs.spire", "object.spire.small", fx - 22, fz - 16);
  obj(d, "fs.spire", "object.spire.small", fx + 22, fz - 16);
  poi(d, {
    name: "Frostwatch Fortress", kind: "settlement", x: fx, z: fz,
    region: R.name, tier: 4, services: ["shelter", "campfire"],
  });
  dungeonEntrance(d, "region.trial_city", "The Ancient Trial City", R.name, 5);

  // Snowbound village + lumber outpost on the lower pass.
  const vx = 1210;
  const vz = 520;
  const vh = Math.max(0, d.geo.heights[idx(vx, vz)]);
  pad(d, vx - 16, vx + 16, vz - 12, vz + 12, vh, "snow");
  feather(d, vx - 16, vx + 16, vz - 12, vz + 12, vh);
  house(d, "fs.village", "object.house.small", vx - 10, vz - 8, 5, 4);
  house(d, "fs.village", "object.house.small", vx + 4, vz - 8, 5, 4);
  obj(d, "fs.villagefire", "object.campfire.basic", vx, vz + 2);
  obj(d, "fs.villagechest", "object.storage_chest.basic", vx - 6, vz + 4);
  poi(d, { name: "Coldharbour", kind: "settlement", x: vx, z: vz, region: R.name, tier: 3, services: ["campfire", "storage"] });
  for (let k = 0; k < 6; k++) {
    const x = 1150 + Math.floor(cellHash(k, 11, 401) * 90);
    const z = 560 + Math.floor(cellHash(11, k, 403) * 40);
    if (isFree(d, x, z)) node(d, "fs.spruce", "resource.tree.spruce", x, z);
  }
  // Ranger camp, frozen lake fishing, watchtowers, ice cave, shrine.
  stampDiscovery(d, "campsite", 1120, 380, "fs.ranger");
  poi(d, { name: "Ranger's Watch", kind: "discovery", x: 1120, z: 380, region: R.name, tier: 3 });
  node(d, "fs.icefish", "resource.fishing.ice", 1454, 415);
  poi(d, { name: "The Frozen Shelf", kind: "landmark", x: 1454, z: 415, region: R.name, tier: 4, services: ["ice fishing"] });
  stampDiscovery(d, "watchpost", 1230, 180, "fs.tower");
  stampDiscovery(d, "watchpost", 1420, 250, "fs.tower");
  stampDiscovery(d, "shrine", 1530, 330, "fs.shrine");
  poi(d, { name: "The Mountain Shrine", kind: "landmark", x: 1530, z: 330, region: R.name, tier: 4 });
  for (let k = 0; k < 8; k++) {
    foe(d, "fs.frostwolf", "enemy.frost_wolf", 1100 + Math.floor(cellHash(k, 13, 411) * 420), 120 + Math.floor(cellHash(13, k, 413) * 300));
  }
  // The sealed northern gate: a future expansion exit.
  pad(d, 1330, 1346, 6, 12, fh + 4, "stonebrick");
  poi(d, {
    name: "The Sealed Gate", kind: "expansion", x: 1338, z: 10,
    region: R.name, tier: 5, notes: "A door for a later age.",
  });
}

// ---------------------------------------------------------------------------
// 5. STONEGATE
// ---------------------------------------------------------------------------
export function buildStonegate(d: Draft): void {
  const R = REGIONS.stonegate;
  const cx = R.center.x;
  const cz = R.center.z;
  townCore(d, {
    key: "sg", name: "Stonegate", region: R.name, tier: 2,
    cx, cz, half: 56, walled: true,
    services: ["bank", "exchange", "smith street", "mage quarter", "docks", "tavern"],
  });
  const h = Math.max(0, d.geo.heights[idx(cx, cz)]);
  // Civic keep + four districts marked by their trades.
  house(d, "sg.palace", "object.keep.grand", cx - 8, cz - 50, 16, 11);
  // Smith street (west).
  for (let k = 0; k < 3; k++) {
    house(d, "sg.smithy", "object.house.small", cx - 48 + k * 8, cz - 8, 5, 4);
    obj(d, "sg.anvilrow", "object.anvil.basic", cx - 46 + k * 8, cz - 2);
  }
  obj(d, "sg.bigfurnace", "object.furnace.basic", cx - 40, cz + 2);
  // Mage quarter (east): the rune workshop and enchanter.
  house(d, "sg.magehall", "object.store.basic", cx + 36, cz - 10, 6, 5);
  obj(d, "sg.enchanter", "object.enchanter.basic", cx + 38, cz - 3);
  npc(d, "sg.npc.runist", "Runist Vane", cx + 40, cz - 5, 2, [
    "Every rune is a promise. Most of them are lies with good handwriting.",
    "The sewers eat what the city forgets. Lately they've been eating patrols.",
  ]);
  // Tavern district (south) + residential (north handled by core houses).
  house(d, "sg.tavern", "object.house.big", cx - 12, cz + 36, 7, 5);
  house(d, "sg.tavern2", "object.house.small", cx - 2, cz + 36, 5, 4);
  obj(d, "sg.tavernlamp", "object.lamp.post", cx - 6, cz + 42);
  // River docks + warehouses outside the west gate.
  pad(d, cx - 96, cx - 66, cz + 18, cz + 44, h, "plank");
  obj(d, "sg.warehouse", "object.house.big", cx - 92, cz + 20, {
    footprint: [{ x: cx - 91, z: cz + 20 }, { x: cx - 92, z: cz + 21 }, { x: cx - 91, z: cz + 21 }],
  });
  node(d, "sg.dockfish", "resource.fishing.pond", cx - 98, cz + 30);
  poi(d, { name: "Stonegate Docks", kind: "landmark", x: cx - 90, z: cz + 30, region: R.name, tier: 2, services: ["fishing", "freight"] });
  dungeonEntrance(d, "region.stonegate_sewers", "The Stonegate Sewers", R.name, 2);
  // Countryside: farms, ranch, battlefield, mage tower, toll fort, quarry.
  for (let k = 0; k < 6; k++) node(d, "sg.wheat", "resource.plot.wheat", cx - 30 + k * 6, cz + 84);
  pen(d, "sg.ranch", cx + 20, cx + 44, cz + 78, cz + 92, "enemy.cow", 4);
  poi(d, { name: "The Southfields", kind: "discovery", x: cx, z: cz + 84, region: R.name, tier: 1, services: ["farming"] });
  stampDiscovery(d, "ruin", 1600, 520, "sg.battlefield");
  poi(d, { name: "The Old Battlefield", kind: "landmark", x: 1600, z: 520, region: R.name, tier: 3, notes: "Digs well." });
  node(d, "sg.dig", "resource.digsite.old", 1608, 526);
  obj(d, "sg.magetower", "object.spire.large", 2080, 560);
  poi(d, { name: "The Leaning Mage Tower", kind: "landmark", x: 2080, z: 560, region: R.name, tier: 3 });
  stampDiscovery(d, "watchpost", 2140, 900, "sg.tollfort");
  poi(d, { name: "The Abandoned Toll Fort", kind: "landmark", x: 2140, z: 900, region: R.name, tier: 2 });
  for (let k = 0; k < 4; k++) node(d, "sg.limestone", "resource.rock.tin", 2196 + k * 4, 640);
  poi(d, { name: "Limestone Quarry", kind: "discovery", x: 2200, z: 640, region: R.name, tier: 2, services: ["mining"] });
  stampDiscovery(d, "bandit", 1700, 1040, "sg.smuggler", "enemy.dust_scuttler");
  poi(d, { name: "Smuggler's Culvert", kind: "discovery", x: 1700, z: 1040, region: R.name, tier: 2 });
}

// ---------------------------------------------------------------------------
// 6. SUNSCAR
// ---------------------------------------------------------------------------
export function buildSunscar(d: Draft): void {
  const R = REGIONS.sunscar;
  const cx = R.center.x;
  const cz = R.center.z;
  townCore(d, {
    key: "ss", name: "Suncall Oasis", region: R.name, tier: 3,
    cx, cz, half: 40, walled: true, padBlock: "sand",
    services: ["bank", "bazaar", "gem trader", "pottery", "caravans"],
  });
  const h = Math.max(0, d.geo.heights[idx(cx, cz)]);
  // The oasis pool and date palms inside the walls.
  for (let z = cz + 10; z <= cz + 22; z++) {
    for (let x = cx - 16; x <= cx - 2; x++) {
      if (Math.hypot(x - (cx - 9), z - (cz + 16)) < 6) {
        const i = idx(x, z);
        d.geo.heights[i] = -1;
        d.geo.blocks[i] = "water";
        d.geo.locked[i] = 1;
      }
    }
  }
  node(d, "ss.oasisfish", "resource.fishing.pond", cx - 9, cz + 9);
  for (let k = 0; k < 4; k++) node(d, "ss.palm", "resource.tree.acacia", cx + 4 + k * 4, cz + 14);
  // Bazaar: extra stalls, gem trader, pottery kiln, pack yard.
  obj(d, "ss.stall2", "object.stall.market", cx - 4, cz - 10, { footprint: [{ x: cx - 3, z: cz - 10 }] });
  node(d, "ss.stallnode2", "resource.stall.market", cx - 4, cz - 9);
  obj(d, "ss.kiln", "object.furnace.basic", cx + 10, cz + 4);
  npc(d, "ss.npc.gem", "Sefra the Lapidary", cx - 2, cz - 12, 2, [
    "Sun-glass, fire opal, canyon jade. The desert pays those who dig politely.",
    "The temple in the canyon? Everyone who loots it puts it back eventually.",
  ]);
  // Irrigated farms and quarry outside the walls.
  for (let k = 0; k < 5; k++) node(d, "ss.crops", "resource.plot.carrot", cx - 34 + k * 5, cz + 34);
  for (let k = 0; k < 4; k++) node(d, "ss.melon", "resource.plot.melon", cx - 30 + k * 6, cz + 40);
  for (let k = 0; k < 4; k++) node(d, "ss.quarryrock", "resource.rock.copper", cx + 44 + k * 5, cz - 26);
  poi(d, { name: "Suncall Quarry", kind: "discovery", x: cx + 48, z: cz - 26, region: R.name, tier: 3, services: ["mining"] });
  stampDiscovery(d, "watchpost", cx + 30, cz - 44, "ss.watch");
  // The Sunken Sun Temple in the canyon south-east.
  dungeonEntrance(d, "region.sun_temple", "The Sunken Sun Temple", R.name, 4);
  // Desert wilds: nomads, wrecks, bandit canyon, fossils, salt flat,
  // scorpion territory, remote oasis, shelter caves.
  stampDiscovery(d, "campsite", 1980, 1180, "ss.nomad");
  poi(d, { name: "Nomad Rest", kind: "discovery", x: 1980, z: 1180, region: R.name, tier: 3 });
  stampDiscovery(d, "cart", 2260, 1210, "ss.wreck");
  poi(d, { name: "Caravan Wreck", kind: "discovery", x: 2260, z: 1210, region: R.name, tier: 3 });
  stampDiscovery(d, "bandit", 2380, 1440, "ss.canyon", "enemy.dune_husk");
  poi(d, { name: "Redwind Bandit Canyon", kind: "landmark", x: 2380, z: 1440, region: R.name, tier: 4 });
  node(d, "ss.fossil", "resource.digsite.old", 2050, 1560);
  poi(d, { name: "The Fossil Beds", kind: "landmark", x: 2050, z: 1560, region: R.name, tier: 3, services: ["archaeology"] });
  for (let k = 0; k < 7; k++) {
    foe(d, "ss.scuttler", "enemy.dust_scuttler", 2150 + Math.floor(cellHash(k, 17, 501) * 260), 1440 + Math.floor(cellHash(17, k, 503) * 220));
  }
  for (let k = 0; k < 4; k++) {
    foe(d, "ss.husk", "enemy.dune_husk", 2290 + Math.floor(cellHash(k, 19, 505) * 160), 1520 + Math.floor(cellHash(19, k, 507) * 160));
  }
  stampDiscovery(d, "shrine", 2440, 1330, "ss.shrine");
  poi(d, { name: "The Last Well", kind: "landmark", x: 2440, z: 1330, region: R.name, tier: 4, notes: "A remote oasis shrine." });
  // Eastern caravan road disappearing into the cliffs: expansion exit.
  poi(d, {
    name: "The East Caravan Cut", kind: "expansion", x: 2492, z: 1258,
    region: R.name, tier: 4, notes: "The road goes on where the map does not.",
  });
}

// ---------------------------------------------------------------------------
// 7. MURKFEN
// ---------------------------------------------------------------------------
export function buildMurkfen(d: Draft): void {
  const R = REGIONS.murkfen;
  const cx = R.center.x;
  const cz = R.center.z;
  // Boardwalk hamlet: planks over the wet ground.
  const h = 1;
  pad(d, cx - 30, cx + 30, cz - 22, cz + 22, h, "plank");
  feather(d, cx - 30, cx + 30, cz - 22, cz + 22, h);
  house(d, "mf.stilthouse", "object.house.small", cx - 20, cz - 16, 5, 4);
  house(d, "mf.stilthouse", "object.house.small", cx - 6, cz - 16, 5, 4);
  house(d, "mf.stilthouse", "object.house.small", cx + 8, cz - 16, 5, 4);
  house(d, "mf.stilthouse", "object.house.small", cx - 16, cz + 8, 5, 4);
  house(d, "mf.stilthouse", "object.house.small", cx + 14, cz + 6, 5, 4);
  // Railings ring the boardwalk, broken where the causeways arrive.
  fenceRun(d, "mf.rail", cx - 30, cx + 30, cz - 22, cz + 22, { x: cx, z: cz - 22 });
  obj(d, "mf.bank", "object.storage_chest.basic", cx - 24, cz + 10);
  obj(d, "mf.fire", "object.campfire.basic", cx, cz + 6);
  obj(d, "mf.cauldron", "object.cauldron.basic", cx + 3, cz + 6);
  obj(d, "mf.stall", "object.stall.market", cx - 4, cz - 2, { footprint: [{ x: cx - 3, z: cz - 2 }] });
  node(d, "mf.stallnode", "resource.stall.market", cx - 4, cz - 1);
  obj(d, "mf.bench", "object.bench.wood", cx + 4, cz - 2);
  obj(d, "mf.bench", "object.bench.wood", cx - 8, cz + 3);
  obj(d, "mf.freight", "object.crate.wood", cx + 20, cz - 4);
  obj(d, "mf.freight", "object.barrel.wood", cx + 21, cz - 3);
  obj(d, "mf.lamp", "object.lamp.post", cx - 12, cz + 14);
  obj(d, "mf.lamp", "object.lamp.post", cx + 12, cz + 14);
  obj(d, "mf.lamp", "object.lamp.post", cx - 12, cz - 10);
  obj(d, "mf.lamp", "object.lamp.post", cx + 12, cz - 10);
  obj(d, "mf.reeds", "object.reeds.water", cx - 29, cz + 16);
  obj(d, "mf.reeds", "object.reeds.water", cx + 28, cz - 12);
  obj(d, "mf.reeds", "object.reeds.water", cx + 26, cz + 20);
  node(d, "mf.fishplat", "resource.fishing.marsh", cx + 24, cz + 18);
  node(d, "mf.fishplat", "resource.fishing.marsh", cx - 27, cz + 20);
  node(d, "mf.herb1", "resource.herb.ember", cx - 28, cz - 6);
  node(d, "mf.herb2", "resource.herb.mint", cx - 26, cz - 2);
  npc(d, "mf.npc.tansy", "Tansy the Bogwise", cx + 2, cz + 8, 2, [
    "Ember-leaf wants wet feet. So do leeches. Wear boots.",
    "The lights in the fen? Follow the boardwalk, not the lights.",
  ]);
  poi(d, {
    name: "Peatlight Hamlet", kind: "settlement", x: cx, z: cz,
    region: R.name, tier: 3, services: ["storage", "herbalist", "fishing"],
  });
  // Witch hut, standing stones, sunken chapel, flooded tower, peat camp.
  house(d, "mf.witch", "object.house.small", 940, 1950, 5, 4);
  poi(d, { name: "The Witch's Stilts", kind: "landmark", x: 942, z: 1952, region: R.name, tier: 3 });
  stampDiscovery(d, "stones", 1350, 2200, "mf.stones");
  poi(d, { name: "The Drowned Ring", kind: "landmark", x: 1350, z: 2200, region: R.name, tier: 3 });
  stampDiscovery(d, "ruin", 1080, 2260, "mf.chapel");
  poi(d, { name: "The Sunken Chapel", kind: "landmark", x: 1080, z: 2260, region: R.name, tier: 3 });
  stampDiscovery(d, "watchpost", 1500, 1900, "mf.floodtower");
  poi(d, { name: "The Flooded Watchtower", kind: "landmark", x: 1500, z: 1900, region: R.name, tier: 3 });
  stampDiscovery(d, "campsite", 900, 2100, "mf.peat");
  poi(d, { name: "Peat-Cutters' Camp", kind: "discovery", x: 900, z: 2100, region: R.name, tier: 3 });
  // Fen fauna.
  for (let k = 0; k < 8; k++) {
    foe(d, "mf.slime", "enemy.bog_slime", 900 + Math.floor(cellHash(k, 23, 601) * 500), 1950 + Math.floor(cellHash(23, k, 603) * 350));
  }
  for (let k = 0; k < 5; k++) {
    foe(d, "mf.husk", "enemy.mire_husk", 1000 + Math.floor(cellHash(k, 29, 605) * 400), 2100 + Math.floor(cellHash(29, k, 607) * 250));
  }
  foe(d, "mf.shambler", "enemy.spore_shambler", 1240, 2280);
  dungeonEntrance(d, "region.glowfen_caves", "The Glowfen Caves", R.name, 3);
  // The old ford site: stones laid here bridge the lower Silverrun.
  obj(d, "mf.fordsite", "object.buildsite.ford", 1402, 1972);
  poi(d, { name: "The Lost Ford", kind: "landmark", x: 1402, z: 1972, region: R.name, tier: 3 });
}

// ---------------------------------------------------------------------------
// 8. TIDEWATCH
// ---------------------------------------------------------------------------
export function buildTidewatch(d: Draft): void {
  const R = REGIONS.tidewatch;
  const cx = R.center.x;
  const cz = R.center.z;
  townCore(d, {
    key: "tw", name: "Tidewatch Port", region: R.name, tier: 2,
    cx, cz, half: 38, padBlock: "grass",
    services: ["bank", "fish market", "shipwright", "inn", "customs"],
  });
  const h = Math.max(0, d.geo.heights[idx(cx, cz)]);
  // Harbor boardwalk running south-east toward the water.
  pad(d, cx + 30, cx + 66, cz + 20, cz + 34, Math.max(0, h - 1), "plank");
  node(d, "tw.harborfish", "resource.fishing.pond", cx + 60, cz + 30);
  node(d, "tw.harborfish", "resource.fishing.pond", cx + 64, cz + 24);
  obj(d, "tw.shipwright", "object.workbench.basic", cx + 38, cz + 24);
  obj(d, "tw.crates", "object.crate.wood", cx + 44, cz + 22);
  obj(d, "tw.customs", "object.store.basic", cx + 32, cz + 30, {
    footprint: [{ x: cx + 33, z: cz + 30 }],
  });
  poi(d, { name: "Tidewatch Harbor", kind: "landmark", x: cx + 52, z: cz + 28, region: R.name, tier: 2, services: ["fishing", "future sailing"] });
  poi(d, {
    name: "The Waiting Berth", kind: "expansion", x: cx + 66, z: cz + 30,
    region: R.name, tier: 2, notes: "Boats tied for islands not yet drawn.",
  });
  npc(d, "tw.npc.harbormaster", "Harbormaster Quill", cx + 36, cz + 28, 2, [
    "No sails today. The charts end where the map does — for now.",
    "Lighthouse path is safe. Smuggler's cove is not. Both are lovely.",
  ]);
  // The lighthouse on the headland.
  const lx = 2110;
  const lz = 2072;
  const lh = Math.max(0, d.geo.heights[idx(lx, lz)]);
  pad(d, lx - 6, lx + 6, lz - 6, lz + 6, lh, "stonebrick");
  feather(d, lx - 6, lx + 6, lz - 6, lz + 6, lh);
  obj(d, "tw.lighthouse", "object.spire.large", lx, lz);
  obj(d, "tw.lightlamp", "object.lamp.post", lx + 3, lz + 3);
  poi(d, { name: "The Tidewatch Light", kind: "landmark", x: lx, z: lz, region: R.name, tier: 2 });
  // Shipwreck beach, sea cave, salt works, monastery, fort, smuggler cove.
  stampDiscovery(d, "cart", 1840, 2320, "tw.wreck");
  poi(d, { name: "The Wreck of the Gull", kind: "landmark", x: 1840, z: 2320, region: R.name, tier: 2 });
  stampDiscovery(d, "ruin", 2250, 1950, "tw.seacave");
  poi(d, { name: "Brinehollow Cave", kind: "landmark", x: 2250, z: 1950, region: R.name, tier: 3 });
  pad(d, 1930, 1950, 2240, 2252, 0, "sand");
  poi(d, { name: "The Salt Pans", kind: "discovery", x: 1940, z: 2246, region: R.name, tier: 2, services: ["salt"] });
  stampDiscovery(d, "shrine", 2380, 1900, "tw.monastery");
  poi(d, { name: "Cliffside Monastery", kind: "landmark", x: 2380, z: 1900, region: R.name, tier: 3 });
  stampDiscovery(d, "watchpost", 1750, 2150, "tw.fort");
  poi(d, { name: "Fort Ebb", kind: "landmark", x: 1750, z: 2150, region: R.name, tier: 2 });
  stampDiscovery(d, "bandit", 1860, 2340, "tw.smuggler", "enemy.dust_scuttler");
  poi(d, { name: "Smuggler's Cove", kind: "discovery", x: 1860, z: 2340, region: R.name, tier: 3 });
  // Coastal farms + fishing hamlet.
  for (let k = 0; k < 4; k++) node(d, "tw.crops", "resource.plot.wheat", cx - 40 + k * 5, cz - 30);
  house(d, "tw.hamlet", "object.house.small", 1700, 1950, 5, 4);
  node(d, "tw.hamletfish", "resource.fishing.pond", 1694, 1958);
  poi(d, { name: "Netter's Rest", kind: "settlement", x: 1700, z: 1952, region: R.name, tier: 2, services: ["fishing"] });
}

// ---------------------------------------------------------------------------
// 9. IRONROOT CAMP
// ---------------------------------------------------------------------------
export function buildIronroot(d: Draft): void {
  const R = REGIONS.ironroot;
  const cx = R.center.x;
  const cz = R.center.z;
  const h = Math.max(0, d.geo.heights[idx(cx, cz)]);
  pad(d, cx - 30, cx + 30, cz - 24, cz + 24, h, "dirt");
  feather(d, cx - 30, cx + 30, cz - 24, cz + 24, h);
  wallRect(d, cx - 30, cx + 30, cz - 24, cz + 24, h, [
    { x: cx, z: cz - 24 }, { x: cx, z: cz + 24 }, { x: cx - 30, z: cz }, { x: cx + 30, z: cz },
  ]);
  house(d, "ir.longhouse", "object.house.big", cx - 8, cz - 18, 9, 6);
  obj(d, "ir.smith", "object.anvil.basic", cx + 10, cz - 12);
  obj(d, "ir.forge", "object.furnace.basic", cx + 13, cz - 12);
  obj(d, "ir.fire", "object.campfire.basic", cx, cz);
  obj(d, "ir.chest", "object.storage_chest.basic", cx - 12, cz - 10);
  // Arena + archery: training creatures and targets.
  pad(d, cx - 20, cx - 4, cz + 6, cz + 18, h, "sand");
  for (let k = 0; k < 3; k++) foe(d, "ir.dummy", "enemy.target_dummy", cx - 17 + k * 5, cz + 10);
  foe(d, "ir.sparspider", "enemy.spider", cx - 10, cz + 15);
  foe(d, "ir.sparwolf", "enemy.timber_wolf", cx - 16, cz + 15);
  // Fishing bridge over the Forgebeck (the road crosses just north).
  node(d, "ir.fish", "resource.fishing.pond", 1188, 748);
  obj(d, "ir.tradepost", "object.stall.market", cx + 12, cz + 10, { footprint: [{ x: cx + 13, z: cz + 10 }] });
  node(d, "ir.tradenode", "resource.stall.market", cx + 12, cz + 11);
  stampDiscovery(d, "shrine", cx + 24, cz - 20, "ir.shrine");
  npc(d, "ir.npc.marshal", "Marshal Redoak", cx, cz - 8, 3, [
    "Greenvale south, Highforge west, Stonegate east, and the Frostspine north — pick a door.",
    "The Stronghold below is a proving ground. Come back with the bell rung.",
  ]);
  poi(d, {
    name: "Ironroot Camp", kind: "settlement", x: cx, z: cz,
    region: R.name, tier: 2, services: ["training", "storage", "trade", "smithy"],
  });
  dungeonEntrance(d, "region.stronghold_trials", "The Stronghold of Trials", R.name, 3);
  stampDiscovery(d, "ruin", 1290, 900, "ir.battlefield");
  poi(d, { name: "The Shield-Break Fields", kind: "landmark", x: 1290, z: 900, region: R.name, tier: 2 });
  node(d, "ir.dig", "resource.digsite.basic", 1296, 906);
  // The build-site ramp up the terraces on the Greenvale road.
  obj(d, "ir.rampsite", "object.buildsite.ramp", BUILD_SITES.ramp.x, BUILD_SITES.ramp.z);
}

/** Optional agility shortcuts: same-region hops that skip the long way. */
export function buildShortcuts(d: Draft): void {
  const hop = (prefix: string, defId: string, from: [number, number], to: [number, number]) => {
    obj(d, prefix, defId, from[0], from[1], {
      portal: { targetRegionId: "region.vale_clearing", targetCell: { x: to[0], z: to[1] } },
    });
  };
  // A fallen log over the Merewater beside the broken footbridge.
  hop("gv.shortcut", "object.shortcut.log", [1158, 1596], [1158, 1610]);
  // A rocky scramble up the Highforge quarry face.
  hop("hf.shortcut", "object.shortcut.scramble", [746, 560], [738, 552]);
  // A knotted rope down Frostwatch's outer wall.
  hop("fs.shortcut", "object.shortcut.wallrope", [1290, 290], [1284, 284]);
  // A mesa ledge across the Sunscar canyon road.
  hop("ss.shortcut", "object.shortcut.mesaledge", [2110, 1120], [2118, 1112]);
}

/**
 * Named grand trees: one landmark specimen per species, placed where its
 * wood grows, so every rung of the woodcutting ladder has a destination.
 */
export function buildGroves(d: Draft): void {
  const specimen = (
    id: string, defId: string, name: string, x: number, z: number, region: string, tier: number,
  ) => {
    if (!isFree(d, x, z)) return;
    pad(d, x - 2, x + 2, z - 2, z + 2, d.geo.heights[idx(x, z)], "grass");
    node(d, id, defId, x, z);
    poi(d, { name, kind: "landmark", x, z, region, tier, services: ["woodcutting"] });
  };
  specimen("ww.grandbirch", "resource.tree.grand.birch", "The Silver Lady", 700, 1204, "The Whisperwood", 2);
  specimen("hf.grandspruce", "resource.tree.grand.spruce", "The Old Sentinel", 762, 542, "Highforge", 2);
  specimen("mf.grandjungle", "resource.tree.grand.jungle", "The Fen Mother", 1052, 2148, "The Murkfen", 3);
  specimen("ss.grandacacia", "resource.tree.grand.acacia", "The Thirsty Crown", 2202, 1452, "The Sunscar Drylands", 3);
  specimen("ww.granddark", "resource.tree.grand.darkoak", "The Duskbark Elder", 332, 1182, "The Whisperwood", 4);
  specimen("ww.blossom", "resource.tree.grand.blossom", "The Blossom Tree", 882, 1132, "The Whisperwood", 4);
  specimen("ss.ember", "resource.tree.grand.ember", "The Ember Tree", 2338, 1202, "The Sunscar Drylands", 5);
  specimen("mf.glow", "resource.tree.grand.glow", "The Lanternwood", 982, 2272, "The Murkfen", 5);
  specimen("fs.dusk", "resource.tree.grand.dusk", "The Duskglass Tree", 1292, 242, "The Frostspine", 5);
}

/** Level-45 deepwater fishing: a water cell beside standable shore. */
function deepRun(d: Draft, id: string, cx: number, cz: number, region: string, tier: number): void {
  const { blocks } = d.geo;
  for (let r = 0; r <= 60; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = cx + dx;
        const z = cz + dz;
        if (blocks[idx(x, z)] !== "water") continue;
        const shore = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          .some(([ox, oz]) => blocks[idx(x + ox, z + oz)] !== "water" && isFree(d, x + ox, z + oz));
        if (!shore) continue;
        node(d, id, "resource.fishing.deep", x, z);
        poi(d, { name: "Deepwater Rise", kind: "landmark", x, z, region, tier, services: ["fishing"] });
        return;
      }
    }
  }
}

export function buildFishingRuns(d: Draft): void {
  deepRun(d, "tw.deeprun", 2110, 2120, "Tidewatch Coast", 3);
  deepRun(d, "tw.deltarun", 1430, 2380, "Tidewatch Coast", 3);
  deepRun(d, "sg.riverdeep", 1700, 780, "Stonegate", 2);
  deepRun(d, "gv.lakedeep", 1600, 1505, "Greenvale", 2);
}

/**
 * Round-1 expansion: the North-West Reaches above Highforge — a mountain
 * monastery, a mirror-still tarn, a hermit, and a wind-scoured altar.
 */
export function buildNorthwestReaches(d: Draft): void {
  const region = "Highforge";
  // Cloudrest Monastery: a walled courtyard at the head of the pilgrim trail.
  const mx = 471;
  const mz = 296;
  const mh = Math.max(0, d.geo.heights[idx(mx, mz)]);
  pad(d, mx - 16, mx + 16, mz - 12, mz + 12, mh, "stonebrick");
  feather(d, mx - 16, mx + 16, mz - 12, mz + 12, mh);
  wallRect(d, mx - 16, mx + 16, mz - 12, mz + 12, mh, [{ x: mx, z: mz + 12 }]);
  house(d, "nw.monastery", "object.house.big", mx - 3, mz - 9, 7, 5);
  obj(d, "nw.shrine", "object.banner.red", mx, mz - 2);
  obj(d, "nw.brazier", "object.campfire.basic", mx, mz);
  obj(d, "nw.bench", "object.bench.wood", mx - 3, mz + 1);
  obj(d, "nw.bench", "object.bench.wood", mx + 3, mz + 1);
  obj(d, "nw.lamp", "object.lamp.post", mx - 10, mz + 8);
  obj(d, "nw.lamp", "object.lamp.post", mx + 10, mz + 8);
  obj(d, "nw.stores", "object.storage_chest.basic", mx + 11, mz - 8, {
    initialItems: [{ itemId: "item.herb.frostbloom", qty: 2 }],
  });
  node(d, "nw.garden", "resource.herb.frostbloom", mx - 11, mz - 7);
  node(d, "nw.garden", "resource.herb.frostbloom", mx - 9, mz - 7);
  node(d, "nw.garden", "resource.herb.sage", mx - 11, mz - 5);
  npc(d, "nw.npc.prior", "Prior Ashwin", mx + 2, mz - 3, 3, [
    "The mountain teaches patience. So does the walk up.",
    "Frostbloom grows where nothing else dares. Take only what you need.",
    "The altar on the ridge is older than the monastery. Older than names.",
  ]);
  poi(d, {
    name: "Cloudrest Monastery", kind: "settlement", x: mx, z: mz,
    region, tier: 3, services: ["shrine", "herbalist", "storage"],
  });

  // The Mirror Tarn: a still mountain pool with cold, clear fishing.
  const tx = 362;
  const tz = 398;
  const th = Math.max(1, d.geo.heights[idx(tx, tz)]);
  pad(d, tx - 11, tx + 11, tz - 11, tz + 11, th, "grass");
  feather(d, tx - 11, tx + 11, tz - 11, tz + 11, th);
  // Frozen year-round: an ice sheet at meadow height (open water cannot
  // sit this high — the renderer keeps one water table for the province).
  for (let z = tz - 7; z <= tz + 7; z++) {
    for (let x = tx - 7; x <= tx + 7; x++) {
      if (Math.hypot(x - tx, z - tz) > 7) continue;
      const i = idx(x, z);
      d.geo.heights[i] = th;
      d.geo.blocks[i] = "ice";
      d.geo.locked[i] = 1;
    }
  }
  node(d, "nw.tarnfish", "resource.fishing.ice", tx - 3, tz - 1);
  node(d, "nw.tarnfish2", "resource.fishing.ice", tx + 3, tz + 2);
  obj(d, "nw.tarnreeds", "object.reeds.water", tx - 9, tz + 3);
  obj(d, "nw.tarnreeds", "object.reeds.water", tx + 8, tz - 5);
  poi(d, { name: "The Mirror Tarn", kind: "landmark", x: tx, z: tz - 9, region, tier: 3, services: ["fishing"] });

  // The hermit who chose the far slope.
  const hx = 252;
  const hz = 380;
  const hh = Math.max(0, d.geo.heights[idx(hx, hz)]);
  pad(d, hx - 6, hx + 6, hz - 5, hz + 6, hh, "grass");
  feather(d, hx - 6, hx + 6, hz - 5, hz + 6, hh);
  house(d, "nw.hermit", "object.house.small", hx - 2, hz - 3, 5, 4);
  obj(d, "nw.hermitfire", "object.campfire.basic", hx + 3, hz + 2);
  obj(d, "nw.hermitcrate", "object.crate.wood", hx - 4, hz + 2);
  npc(d, "nw.npc.hermit", "Old Wenna", hx + 1, hz + 2, 2, [
    "Nobody walks this far by accident. Sit, the fire's honest.",
    "I traded the vale's noise for the wind's. Fair bargain.",
    "Wolves keep to the ridge at dusk. So should you not.",
  ]);
  poi(d, { name: "The Hermit's Slope", kind: "landmark", x: hx, z: hz, region, tier: 3 });

  // The Sky Altar: the oldest stones in the province, wolf-watched.
  const ax = 553;
  const az = 212;
  const ah = Math.max(0, d.geo.heights[idx(ax, az)]);
  pad(d, ax - 5, ax + 5, az - 5, az + 5, ah, "stonebrick");
  feather(d, ax - 5, ax + 5, az - 5, az + 5, ah);
  stampDiscovery(d, "stones", ax, az, "nw.altar");
  obj(d, "nw.altarbanner", "object.banner.red", ax, az - 3);
  foe(d, "nw.altarwolf", "enemy.frost_wolf", ax + 8, az + 4);
  foe(d, "nw.altarwolf", "enemy.frost_wolf", ax - 7, az + 7);
  poi(d, { name: "The Sky Altar", kind: "landmark", x: ax, z: az, region, tier: 4 });
}

/**
 * Round-2 expansion: the West Marches — a palisade border post at the end
 * of the west road, and the Sundered Court, an ancient ruin for diggers.
 */
export function buildWestMarches(d: Draft): void {
  const region = "The Whisperwood";
  // Westmarch Post: last friendly fire before the border wilds.
  const px = 168;
  const pz = 1512;
  const ph = Math.max(0, d.geo.heights[idx(px, pz)]);
  pad(d, px - 13, px + 13, pz - 10, pz + 10, ph, "grass");
  feather(d, px - 13, px + 13, pz - 10, pz + 10, ph);
  fenceRun(d, "wp.palisade", px - 13, px + 13, pz - 10, pz + 10, { x: px + 13, z: pz });
  house(d, "wp.barracks", "object.house.small", px - 8, pz - 7, 5, 4);
  obj(d, "wp.fire", "object.campfire.basic", px, pz);
  obj(d, "wp.banner", "object.banner.red", px, pz - 4);
  obj(d, "wp.stores", "object.storage_chest.basic", px + 7, pz - 6, {
    initialItems: [{ itemId: "item.fish.cooked", qty: 2 }],
  });
  obj(d, "wp.bench", "object.bench.wood", px - 2, pz + 3);
  obj(d, "wp.lamp", "object.lamp.post", px - 10, pz + 7);
  obj(d, "wp.lamp", "object.lamp.post", px + 10, pz + 7);
  foe(d, "wp.dummy", "enemy.target_dummy", px + 6, pz + 4);
  npc(d, "wp.npc.reeve", "Marshal Reeve", px + 2, pz - 2, 3, [
    "This is the last lamplight going west. Past the fence it's your own luck.",
    "The old court south of here? Diggers' business. Bring a shovel and a sword.",
    "Wolves test the palisade some nights. The dummy's for practice. Mostly.",
  ]);
  poi(d, {
    name: "Westmarch Post", kind: "settlement", x: px, z: pz,
    region, tier: 2, services: ["watch", "campfire", "storage", "training"],
  });

  // The Sundered Court: a broken ring of old walls over rich digging.
  const sx = 232;
  const sz = 1622;
  const sh = Math.max(0, d.geo.heights[idx(sx, sz)]);
  pad(d, sx - 10, sx + 10, sz - 8, sz + 8, sh, "stonebrick");
  feather(d, sx - 10, sx + 10, sz - 8, sz + 8, sh);
  // Wall fragments: three sides survive in pieces, the fourth is rubble.
  for (const [x0, x1, z0, z1] of [
    [sx - 10, sx - 4, sz - 8, sz - 8], [sx + 2, sx + 10, sz - 8, sz - 8],
    [sx - 10, sx - 10, sz - 8, sz - 2], [sx + 10, sx + 10, sz + 1, sz + 8],
  ] as const) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const i = idx(x, z);
        d.geo.heights[i] = sh + 2;
        d.geo.blocks[i] = "stonebrick";
        d.geo.locked[i] = 1;
      }
    }
  }
  node(d, "wm.courtdig", "resource.digsite.basic", sx - 4, sz - 2);
  node(d, "wm.courtdig", "resource.digsite.basic", sx + 3, sz + 1);
  node(d, "wm.courtdig", "resource.digsite.basic", sx - 1, sz + 4);
  obj(d, "wm.courtstones", "object.boulder.stone", sx + 6, sz - 4);
  obj(d, "wm.courtbanner", "object.banner.red", sx, sz - 6);
  foe(d, "wm.courtspider", "enemy.cave_spider", sx - 6, sz + 5);
  foe(d, "wm.courtspider", "enemy.cave_spider", sx + 7, sz + 6);
  poi(d, {
    name: "The Sundered Court", kind: "landmark", x: sx, z: sz,
    region, tier: 3, services: ["archaeology"],
  });
}

/**
 * Round-3 expansion: the North-East pinewoods beyond Stonegate — a toll
 * waystation, a working quarry camp, and the old ridge beacon.
 */
export function buildNortheastPines(d: Draft): void {
  const region = "Stonegate";
  // Tollhouse Crossing: the last stamp on the ledger before the wilds.
  const tx = 1998;
  const tz = 492;
  const th = Math.max(0, d.geo.heights[idx(tx, tz)]);
  pad(d, tx - 12, tx + 12, tz - 9, tz + 9, th, "grass");
  feather(d, tx - 12, tx + 12, tz - 9, tz + 9, th);
  house(d, "ne.tollhouse", "object.house.big", tx - 3, tz - 6, 6, 5);
  obj(d, "ne.tollbar", "object.fence.wood", tx - 7, tz + 4);
  obj(d, "ne.tollbar", "object.fence.wood", tx - 6, tz + 4);
  obj(d, "ne.tollbar", "object.fence.wood", tx + 6, tz + 4);
  obj(d, "ne.tollbar", "object.fence.wood", tx + 7, tz + 4);
  obj(d, "ne.fire", "object.campfire.basic", tx + 5, tz - 2);
  obj(d, "ne.bench", "object.bench.wood", tx + 5, tz);
  obj(d, "ne.stores", "object.storage_chest.basic", tx - 8, tz - 5);
  obj(d, "ne.lamp", "object.lamp.post", tx - 9, tz + 6);
  obj(d, "ne.lamp", "object.lamp.post", tx + 9, tz + 6);
  pen(d, "ne.pen", tx - 11, tx - 4, tz + 5, tz + 8, "enemy.sheep", 2);
  npc(d, "ne.npc.toller", "Toller Grimsby", tx, tz - 1, 3, [
    "Stonegate taxes the road; I just count what passes. Mostly wolves.",
    "Quarry's up the track. Beacon's past that. Neither pays toll.",
    "A warm bench and a fire — no charge for those. Yet.",
  ]);
  poi(d, {
    name: "Tollhouse Crossing", kind: "settlement", x: tx, z: tz,
    region, tier: 2, services: ["watch", "campfire", "storage"],
  });

  // Nine Firs Quarry: a cut face still being worked.
  const qx = 2122;
  const qz = 382;
  const qh = Math.max(0, d.geo.heights[idx(qx, qz)]);
  pad(d, qx - 10, qx + 10, qz - 8, qz + 8, qh, "dirt");
  feather(d, qx - 10, qx + 10, qz - 8, qz + 8, qh);
  // The quarry face: a two-block cut wall along the north side.
  for (let x = qx - 10; x <= qx + 10; x++) {
    for (let z = qz - 8; z <= qz - 7; z++) {
      const i = idx(x, z);
      d.geo.heights[i] = qh + 2;
      d.geo.blocks[i] = "stone";
      d.geo.locked[i] = 1;
    }
  }
  node(d, "ne.quarrystone", "resource.rock.copper", qx - 6, qz - 5);
  node(d, "ne.quarrystone", "resource.rock.copper", qx - 2, qz - 5);
  node(d, "ne.quarrycoal", "resource.rock.coal", qx + 2, qz - 5);
  node(d, "ne.quarrycoal", "resource.rock.coal", qx + 6, qz - 5);
  node(d, "ne.quarrytin", "resource.rock.tin", qx + 8, qz - 3);
  obj(d, "ne.quarrybench", "object.workbench.basic", qx - 7, qz + 3);
  obj(d, "ne.quarrycrate", "object.crate.wood", qx - 5, qz + 4);
  obj(d, "ne.quarrycrate", "object.crate.wood", qx - 4, qz + 4);
  obj(d, "ne.quarryfire", "object.campfire.basic", qx + 4, qz + 4);
  npc(d, "ne.npc.quarrier", "Quarrier Hetta", qx, qz + 2, 3, [
    "Nine firs stood here when we broke ground. We kept one. Sentiment.",
    "Coal seam runs shallow — good picking if your arms are honest.",
    "Beacon crew comes down for stone now and then. Odd folk. Quiet.",
  ]);
  poi(d, {
    name: "Nine Firs Quarry", kind: "settlement", x: qx, z: qz,
    region, tier: 2, services: ["mining", "workbench", "campfire"],
  });

  // The Ridge Beacon: a watch-brazier older than the toll road.
  const bx = 2232;
  const bz = 262;
  const bh = Math.max(0, d.geo.heights[idx(bx, bz)]);
  pad(d, bx - 5, bx + 5, bz - 5, bz + 5, bh, "stonebrick");
  feather(d, bx - 5, bx + 5, bz - 5, bz + 5, bh);
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]] as const) {
    const i = idx(bx + dx, bz + dz);
    d.geo.heights[i] = bh + 2;
    d.geo.blocks[i] = "stonebrick";
    d.geo.locked[i] = 1;
  }
  obj(d, "ne.beaconfire", "object.campfire.basic", bx, bz);
  obj(d, "ne.beaconbanner", "object.banner.red", bx, bz - 3);
  foe(d, "ne.beaconwolf", "enemy.timber_wolf", bx - 8, bz + 6);
  foe(d, "ne.beaconwolf", "enemy.timber_wolf", bx + 7, bz + 8);
  poi(d, { name: "The Ridge Beacon", kind: "landmark", x: bx, z: bz, region, tier: 3 });
}

/**
 * Round-4 expansion: the far Sunscar east — a caravanserai on the east
 * trail, the Dune Tombs dig field, and the blinding Glass Flat.
 */
export function buildFarEast(d: Draft): void {
  const region = "The Sunscar Drylands";
  // The Saltpan Caravanserai: thick walls, one gate, water in the middle.
  const cx = 2320;
  const cz = 1298;
  const ch = Math.max(0, d.geo.heights[idx(cx, cz)]);
  pad(d, cx - 13, cx + 13, cz - 10, cz + 10, ch, "sand");
  feather(d, cx - 13, cx + 13, cz - 10, cz + 10, ch);
  wallRect(d, cx - 13, cx + 13, cz - 10, cz + 10, ch, [{ x: cx - 13, z: cz }]);
  obj(d, "fe.well", "object.well.basic", cx, cz);
  house(d, "fe.resthouse", "object.house.small", cx + 4, cz - 7, 5, 4);
  obj(d, "fe.stall", "object.stall.market", cx - 6, cz - 5, { footprint: [{ x: cx - 5, z: cz - 5 }] });
  node(d, "fe.stallnode", "resource.stall.market", cx - 6, cz - 4);
  obj(d, "fe.freight", "object.crate.wood", cx - 8, cz + 5);
  obj(d, "fe.freight", "object.crate.wood", cx - 7, cz + 5);
  obj(d, "fe.freight", "object.barrel.wood", cx - 8, cz + 6);
  obj(d, "fe.fire", "object.campfire.basic", cx + 5, cz + 4);
  obj(d, "fe.bench", "object.bench.wood", cx + 5, cz + 6);
  obj(d, "fe.lamp", "object.lamp.post", cx - 10, cz - 8);
  obj(d, "fe.lamp", "object.lamp.post", cx + 10, cz + 8);
  npc(d, "fe.npc.caravaner", "Serai-Keeper Nadim", cx + 2, cz + 2, 3, [
    "Water, shade, a wall against the wind — everything the sand denies.",
    "The tombs north of here are older than any road. Diggers pay well for what walks out.",
    "The east gate? Closed since before my grandfather counted camels.",
  ]);
  poi(d, {
    name: "The Saltpan Caravanserai", kind: "settlement", x: cx, z: cz,
    region, tier: 3, services: ["water", "market", "campfire", "shelter"],
  });

  // The Dune Tombs: a dig field guarded by what the sand kept.
  const dx = 2378;
  const dz = 1182;
  const dh = Math.max(0, d.geo.heights[idx(dx, dz)]);
  pad(d, dx - 9, dx + 9, dz - 7, dz + 7, dh, "redsand");
  feather(d, dx - 9, dx + 9, dz - 7, dz + 7, dh);
  // Four half-sunken tomb doorways: paired pillars against the dunes.
  for (const [ox, oz] of [[-6, -4], [2, -5], [-3, 3], [5, 2]] as const) {
    for (const px of [0, 2] as const) {
      const i = idx(dx + ox + px, dz + oz);
      d.geo.heights[i] = dh + 2;
      d.geo.blocks[i] = "stonebrick";
      d.geo.locked[i] = 1;
    }
    node(d, "fe.tombdig", "resource.digsite.basic", dx + ox + 1, dz + oz + 1);
  }
  foe(d, "fe.tombhusk", "enemy.dune_husk", dx - 7, dz + 5);
  foe(d, "fe.tombhusk", "enemy.dune_husk", dx + 7, dz - 6);
  foe(d, "fe.tombhusk", "enemy.dune_husk", dx + 8, dz + 6);
  obj(d, "fe.tombbanner", "object.banner.red", dx, dz - 6);
  poi(d, {
    name: "The Dune Tombs", kind: "landmark", x: dx, z: dz,
    region, tier: 4, services: ["archaeology"],
  });

  // The Glass Flat: a blinding salt pan, dead level and dead quiet.
  const gx = 2262;
  const gz = 1432;
  const gh = Math.max(0, d.geo.heights[idx(gx, gz)]);
  for (let z = gz - 9; z <= gz + 9; z++) {
    for (let x = gx - 12; x <= gx + 12; x++) {
      if (Math.hypot((x - gx) * 0.8, z - gz) > 9) continue;
      const i = idx(x, z);
      d.geo.heights[i] = gh;
      d.geo.blocks[i] = "snow";
      d.geo.locked[i] = 1;
    }
  }
  feather(d, gx - 12, gx + 12, gz - 9, gz + 9, gh);
  stampDiscovery(d, "memorial", gx, gz, "fe.glass");
  poi(d, { name: "The Glass Flat", kind: "landmark", x: gx, z: gz, region, tier: 3 });
}

/**
 * Round-5 expansion: the South-West downs — a shepherd steading on open
 * grass, the Barrowfield of an old battle, and a clear forest spring.
 */
export function buildSouthwestDowns(d: Draft): void {
  const region = "The Whisperwood";
  // Longfold Steading: sheep country, one family, many dogs' worth of work.
  const sx = 498;
  const sz = 1902;
  const sh = Math.max(0, d.geo.heights[idx(sx, sz)]);
  pad(d, sx - 13, sx + 13, sz - 10, sz + 10, sh, "grass");
  feather(d, sx - 13, sx + 13, sz - 10, sz + 10, sh);
  house(d, "sw.steading", "object.house.small", sx - 8, sz - 7, 5, 4);
  pen(d, "sw.fold", sx + 1, sx + 12, sz - 8, sz - 1, "enemy.sheep", 4);
  pen(d, "sw.fold2", sx - 12, sx - 2, sz + 2, sz + 8, "enemy.cow", 2);
  obj(d, "sw.hay", "object.crate.wood", sx + 3, sz + 4);
  obj(d, "sw.fire", "object.campfire.basic", sx - 1, sz + 1);
  obj(d, "sw.bench", "object.bench.wood", sx + 1, sz + 1);
  obj(d, "sw.lamp", "object.lamp.post", sx - 10, sz + 9);
  node(d, "sw.wool", "resource.trail.rabbit", sx + 8, sz + 6);
  npc(d, "sw.npc.shepherd", "Shepherd Maud", sx, sz - 2, 4, [
    "Wolves out of the west wood, husks off the fen — and folk ask why I count sheep twice.",
    "The barrows south of here? Walk soft. Old soldiers sleep light.",
    "Spring water east of the fold is the sweetest in the province. The cows agree.",
  ]);
  poi(d, {
    name: "Longfold Steading", kind: "settlement", x: sx, z: sz,
    region, tier: 2, services: ["livestock", "campfire", "hunting"],
  });

  // The Barrowfield: seven mounds over an old defeat nobody names.
  const bx = 420;
  const bz = 2120;
  const bh = Math.max(0, d.geo.heights[idx(bx, bz)]);
  pad(d, bx - 14, bx + 14, bz - 10, bz + 10, bh, "grass");
  feather(d, bx - 14, bx + 14, bz - 10, bz + 10, bh);
  for (const [ox, oz] of [[-10, -5], [-3, -7], [5, -4], [11, -6], [-8, 4], [1, 6], [9, 4]] as const) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const i = idx(bx + ox + dx, bz + oz + dz);
        d.geo.heights[i] = bh + (Math.abs(dx) + Math.abs(dz) === 0 ? 2 : 1);
        d.geo.blocks[i] = "grass";
        d.geo.locked[i] = 1;
      }
    }
  }
  stampDiscovery(d, "memorial", bx, bz, "sw.barrow");
  node(d, "sw.barrowdig", "resource.digsite.basic", bx - 6, bz + 8);
  node(d, "sw.barrowdig", "resource.digsite.basic", bx + 7, bz + 8);
  foe(d, "sw.barrowhusk", "enemy.mire_husk", bx - 12, bz + 9);
  foe(d, "sw.barrowhusk", "enemy.mire_husk", bx + 13, bz - 9);
  poi(d, {
    name: "The Barrowfield", kind: "landmark", x: bx, z: bz,
    region, tier: 3, services: ["archaeology"],
  });

  // Sweetspring Hollow: a clear pool feeding the southern grass.
  const wx = 620;
  const wz = 2010;
  const wh = Math.max(1, d.geo.heights[idx(wx, wz)]);
  pad(d, wx - 8, wx + 8, wz - 8, wz + 8, wh, "grass");
  feather(d, wx - 8, wx + 8, wz - 8, wz + 8, wh);
  obj(d, "sw.springwell", "object.well.basic", wx, wz);
  obj(d, "sw.springreeds", "object.reeds.water", wx - 3, wz + 2);
  obj(d, "sw.springreeds", "object.reeds.water", wx + 3, wz - 2);
  node(d, "sw.springmint", "resource.herb.mint", wx - 4, wz - 3);
  node(d, "sw.springmint", "resource.herb.mint", wx + 4, wz + 3);
  obj(d, "sw.springbench", "object.bench.wood", wx + 1, wz + 3);
  poi(d, { name: "Sweetspring Hollow", kind: "landmark", x: wx, z: wz, region, tier: 2, services: ["herbalist"] });
}

/** The deferred cottage ring: placed only where a house truly fits. */
export function buildCottages(d: Draft): void {
  for (const { prefix, x: hx, z: hz } of d.pendingCottages) {
    if (!houseFits(d, hx, hz, 5, 4)) continue;
    house(d, `${prefix}.house`, "object.house.small", hx, hz, 5, 4);
    // Worn path from the door (south face, house center) toward the plaza.
    const doorX = hx + 2;
    for (let s = 0; s < 3; s++) {
      const i = idx(doorX, hz + 4 + s);
      if (!d.geo.locked[i] && d.geo.blocks[i] !== "water") d.geo.blocks[i] = "dirt";
    }
    const r = cellHash(hx, hz, 401);
    if (r < 0.5 && isFree(d, hx - 2, hz)) obj(d, `${prefix}.yard`, "object.barrel.wood", hx - 2, hz);
    else if (isFree(d, hx + 6, hz + 1)) obj(d, `${prefix}.yard`, "object.crate.wood", hx + 6, hz + 1);
    if (cellHash(hx, hz, 402) < 0.7 && isFree(d, hx + 6, hz + 3)) {
      obj(d, `${prefix}.yardflowers`, "object.flowers.wild", hx + 6, hz + 3);
    }
  }
}

export const SETTLEMENT_BUILDERS = [
  buildGreenvale,
  buildWhisperwood,
  buildHighforge,
  buildFrostspine,
  buildStonegate,
  buildSunscar,
  buildMurkfen,
  buildTidewatch,
  buildIronroot,
  buildNorthwestReaches,
  buildWestMarches,
  buildNortheastPines,
  buildFarEast,
  buildSouthwestDowns,
  buildShortcuts,
  buildGroves,
  buildFishingRuns,
  buildCottages,
];

export { SPAWN };
