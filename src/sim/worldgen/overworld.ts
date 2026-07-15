// The starter province, assembled: geography -> settlements -> roads ->
// roadside discoveries -> biome scatter -> spawn. Exposes the finished
// RegionSpec plus the POI register and road network for signposts, the
// world atlas and the accessibility test suite.

import type { RegionSpec } from "../world";
import { BIOME, buildGeography, relaxWalkability, type Geography } from "./geo";
import { cellHash } from "./noise";
import {
  type Draft,
  type Poi,
  idx,
  isFree,
  onPad,
  makeDraft,
  node,
  foe,
  obj,
  poi,
  stampDiscovery,
  type DiscoveryKind,
} from "./props";
import { carveRoad, healJunctions, type RoadResult, type RoadSpec } from "./roads";
import { REGIONS, SPAWN, WORLD } from "./regions";
import { SETTLEMENT_BUILDERS } from "./settlements";

/** Portal target that world.ts resolves to the destination's spawn cell. */
export const RESOLVE_SPAWN = { x: -1, z: -1 };

// ---------------------------------------------------------------------------
// The road network. Royal roads (width 6) join Greenvale to the province;
// regional roads (4) ring the outer settlements; trails (3) reach the
// spurs. Endpoints sit just outside town gates.
// ---------------------------------------------------------------------------
const ROADS: RoadSpec[] = [
  // Greenvale spokes.
  { id: "road.gv.willowmere", width: 6, points: [[1192, 1375], [1050, 1392], [900, 1432], [780, 1424], [706, 1415]] },
  { id: "road.gv.highforge", width: 6, points: [[1190, 1368], [1080, 1240], [980, 1100], [870, 930], [760, 760], [652, 678]] },
  { id: "road.gv.north", width: 6, points: [[1250, 1317], [1230, 1180], [1160, 1058], [1192, 1000], [1195, 880], [1190, 830]] },
  { id: "road.ironroot.pass", width: 6, points: [[1190, 770], [1210, 640], [1226, 528], [1280, 400], [1315, 291]] },
  { id: "road.gv.stonegate", width: 6, points: [[1308, 1372], [1420, 1300], [1500, 1210], [1600, 1080], [1700, 950], [1800, 812]] },
  { id: "road.gv.sunscar", width: 6, points: [[1308, 1378], [1470, 1400], [1650, 1382], [1800, 1360], [1950, 1346], [2079, 1340]] },
  { id: "road.gv.murkfen", width: 5, points: [[1250, 1433], [1290, 1560], [1270, 1700], [1220, 1850], [1180, 1960], [1175, 2022]] },
  { id: "road.gv.tidewatch", width: 5, points: [[1256, 1433], [1330, 1520], [1420, 1610], [1560, 1700], [1700, 1800], [1850, 1930], [1956, 2046]] },
  // The outer ring.
  { id: "road.hf.pass", width: 4, points: [[700, 620], [850, 600], [1000, 590], [1120, 560], [1206, 545]] },
  { id: "road.pass.stonegate", width: 4, points: [[1240, 520], [1350, 560], [1440, 590], [1560, 620], [1700, 680], [1796, 690]] },
  { id: "road.sg.sunscar", width: 4, points: [[1862, 750], [2000, 850], [2080, 1000], [2120, 1150], [2124, 1294]] },
  { id: "road.ss.tidewatch", width: 4, points: [[2125, 1386], [2130, 1500], [2100, 1650], [2060, 1800], [2030, 1930], [2004, 2006]] },
  { id: "road.tw.murkfen", width: 4, points: [[1956, 2054], [1800, 2062], [1650, 2082], [1500, 2090], [1350, 2072], [1211, 2050]] },
  { id: "road.mf.willowmere", width: 4, points: [[1139, 2048], [1000, 2000], [880, 1900], [800, 1750], [740, 1600], [684, 1455]] },
  { id: "road.wm.highforge", width: 4, points: [[665, 1375], [640, 1250], [600, 1100], [560, 950], [600, 800], [644, 675]] },
  // Trails and spurs.
  { id: "trail.wm.blackbriar", width: 3, points: [[629, 1409], [520, 1300], [430, 1180], [382, 1100]] },
  { id: "trail.gv.mine", width: 3, points: [[1084, 1245], [1082, 1206]] },
  { id: "trail.gv.crypt", width: 3, points: [[1310, 1366], [1338, 1332], [1345, 1318]] },
  { id: "trail.pass.gate", width: 4, points: [[1318, 240], [1330, 120], [1338, 18]] },
  { id: "road.sg.tollroad", width: 4, points: [[1812, 702], [1880, 620], [1950, 540], [1996, 506]] },
  { id: "trail.ne.quarry", width: 3, points: [[2010, 486], [2060, 440], [2110, 392]] },
  { id: "trail.ne.beacon", width: 3, points: [[2132, 374], [2180, 320], [2226, 270]] },
  { id: "trail.ss.east", width: 3, points: [[2171, 1340], [2300, 1302], [2420, 1272], [2488, 1258]] },
  { id: "trail.fe.tombs", width: 3, points: [[2330, 1288], [2355, 1235], [2374, 1192]] },
  { id: "trail.fe.glass", width: 3, points: [[2312, 1310], [2285, 1370], [2266, 1420]] },
  { id: "trail.ss.temple", width: 3, points: [[2128, 1386], [2200, 1480], [2280, 1580], [2313, 1617]] },
  { id: "trail.mf.glowfen", width: 3, points: [[1173, 2072], [1080, 2150], [1000, 2200], [954, 2240]] },
  { id: "trail.sw.steading", width: 3, points: [[770, 1706], [660, 1800], [560, 1870], [512, 1896]] },
  { id: "trail.sw.barrows", width: 3, points: [[492, 1914], [460, 2010], [430, 2106]] },
  { id: "trail.sw.spring", width: 3, points: [[512, 1908], [570, 1960], [610, 2002]] },
  { id: "trail.tw.light", width: 3, points: [[2044, 2050], [2075, 2058], [2100, 2066]] },
  { id: "trail.hf.monastery", width: 3, points: [[598, 620], [520, 500], [478, 340], [471, 308]] },
  { id: "trail.nw.tarn", width: 3, points: [[466, 310], [420, 360], [370, 392]] },
  { id: "trail.nw.hermit", width: 3, points: [[352, 396], [300, 388], [262, 381]] },
  { id: "trail.nw.altar", width: 3, points: [[478, 294], [520, 252], [550, 218]] },
  { id: "trail.wm.west", width: 3, points: [[625, 1415], [500, 1442], [380, 1470], [240, 1500], [184, 1512]] },
  { id: "trail.wp.court", width: 3, points: [[176, 1524], [205, 1578], [228, 1612]] },
  { id: "trail.wp.greenway", width: 3, points: [[170, 1500], [192, 1400], [200, 1256]] },
];

// ---------------------------------------------------------------------------

function regionOf(x: number, z: number): { name: string; tier: number } {
  for (const key of Object.keys(REGIONS)) {
    const r = REGIONS[key];
    if (key === "willowmere") continue; // nested in whisperwood
    if (x >= r.rect.x0 && x <= r.rect.x1 && z >= r.rect.z0 && z <= r.rect.z1) {
      return { name: r.name, tier: r.tier };
    }
  }
  return { name: "The Wilds", tier: 2 };
}

/** Roadside discoveries: something useful or curious every 90–180 blocks. */
function roadsideDiscoveries(d: Draft, roads: RoadResult[]): void {
  const kinds: DiscoveryKind[] = [
    "campsite", "shrine", "well", "cart", "ruin", "stones",
    "watchpost", "fishing", "memorial", "bandit",
  ];
  const banditFoes: Record<number, string> = {
    1: "enemy.spider", 2: "enemy.timber_wolf", 3: "enemy.dune_husk",
    4: "enemy.frost_wolf", 5: "enemy.rust_construct",
  };
  for (const road of roads) {
    let next = 100 + Math.floor(cellHash(road.centerline.length, 1, 701) * 80);
    for (let k = 0; k < road.centerline.length; k++) {
      if (k < next) continue;
      const [cx, cz] = road.centerline[k];
      // Perpendicular offset off the verge.
      const [px, pz] = road.centerline[Math.max(0, k - 6)];
      const dx = cx - px;
      const dz = cz - pz;
      const len = Math.hypot(dx, dz) || 1;
      const side = cellHash(cx, cz, 703) < 0.5 ? 1 : -1;
      const ox = Math.round(cx + (-dz / len) * side * 9);
      const oz = Math.round(cz + (dx / len) * side * 9);
      next = k + 45 + Math.floor(cellHash(cx, cz, 707) * 45); // 90–180 blocks at 2-block steps
      if (!isFree(d, ox, oz) || !isFree(d, ox + 2, oz + 1)) continue;
      if (onPad(d, ox, oz, 4)) continue;
      const { tier } = regionOf(ox, oz);
      const kind = kinds[Math.floor(cellHash(ox, oz, 709) * kinds.length)];
      stampDiscovery(d, kind, ox, oz, `way.${road.id}`, banditFoes[tier] ?? "enemy.spider");
      if (cellHash(ox, oz, 711) < 0.3) {
        const { name } = regionOf(ox, oz);
        poi(d, { name: `${kind === "bandit" ? "Ambush at" : "Waystop by"} ${name}`, kind: "discovery", x: ox, z: oz, region: name, tier });
      }
    }
    // A signpost at each end of every road.
    for (const [sx, sz] of [road.centerline[0], road.centerline[road.centerline.length - 1]]) {
      for (const [tx, tz] of [[sx + 4, sz + 2], [sx - 4, sz - 2], [sx + 2, sz - 4]] as const) {
        if (isFree(d, tx, tz)) {
          obj(d, "sign", "object.signpost", tx, tz);
          break;
        }
      }
    }
    for (const b of road.bridges) {
      poi(d, {
        name: "Bridge", kind: "bridge", x: b.x, z: b.z,
        region: regionOf(b.x, b.z).name, tier: 1,
      });
    }
  }
}

/** Wilderness vegetation, ore, herbs and fauna, dressed per biome. */
function scatter(d: Draft, geo: Geography): void {
  const step = 7;
  const towns = Object.values(REGIONS).map((r) => r.center);
  const nearTown = (x: number, z: number, r: number) =>
    towns.some((t) => Math.abs(t.x - x) < r && Math.abs(t.z - z) < r);
  for (let z = 100; z < WORLD - 100; z += step) {
    for (let x = 100; x < WORLD - 100; x += step) {
      const jx = x + Math.floor(cellHash(x, z, 801) * step);
      const jz = z + Math.floor(cellHash(z, x, 803) * step);
      if (!isFree(d, jx, jz)) continue;
      if (onPad(d, jx, jz, 3)) continue; // settlement yards stay tidy
      const i = idx(jx, jz);
      if (geo.locked[i]) continue; // never on roads or pads
      const b = geo.biome[i];
      const h = geo.heights[i];
      const r = cellHash(jx, jz, 807);
      // Monster dens: a knot of biome-fitting foes around an abandoned
      // camp, well off the roads and far from any town. Slayer fodder.
      const droll = cellHash(jx, jz, 907);
      if (droll < 0.0012 && !nearTown(jx, jz, 240) && !onPad(d, jx, jz, 24)) {
        const den =
          b === BIOME.forest ? { name: "Wolf Den", foe: "enemy.timber_wolf", n: 3 }
          : b === BIOME.taiga ? { name: "Spider Hollow", foe: "enemy.spider", n: 4 }
          : b === BIOME.swamp ? { name: "Slime Wallow", foe: "enemy.bog_slime", n: 4 }
          : b === BIOME.desert ? { name: "Husk Circle", foe: "enemy.dune_husk", n: 3 }
          : (b === BIOME.mountain || b === BIOME.highland) && h > 14
            ? { name: "Frostwolf Den", foe: "enemy.frost_wolf", n: 3 }
          : b === BIOME.plains ? { name: "Spider Nest", foe: "enemy.spider", n: 4 }
          : null;
        if (den) {
          for (let k = 0; k < den.n; k++) {
            foe(d, "wild.den", den.foe,
              jx + Math.floor(cellHash(jx + k, jz, 917) * 5) - 2,
              jz + Math.floor(cellHash(jx, jz + k, 919) * 5) - 2);
          }
          if (isFree(d, jx + 3, jz + 1)) obj(d, "wild.dencamp", "object.crate.wood", jx + 3, jz + 1);
          if (isFree(d, jx + 3, jz + 2)) obj(d, "wild.dencamp", "object.barrel.wood", jx + 3, jz + 2);
          poi(d, {
            name: den.name, kind: "discovery", x: jx, z: jz,
            region: regionOf(jx, jz).name, tier: regionOf(jx, jz).tier,
          });
          continue;
        }
      }
      // Waterlines get life of their own: fishing runs in the shallows
      // and reed beds along the banks.
      const wroll = cellHash(jx, jz, 813);
      if (b !== BIOME.sea && wroll < (b === BIOME.coast ? 0.6 : 0.36)) {
        const wn = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
          .map(([dx, dz]) => [jx + dx, jz + dz] as const)
          .find(([x, z]) => geo.blocks[idx(x, z)] === "water");
        if (wn) {
          if (wroll < (b === BIOME.coast ? 0.35 : 0.1)) {
            const seaSide = geo.biome[idx(wn[0], wn[1])] === BIOME.sea || b === BIOME.coast;
            node(d, "wild.fishrun", seaSide ? "resource.fishing.sea" : "resource.fishing.river", wn[0], wn[1]);
          } else {
            obj(d, "wild.reeds", "object.reeds.water", jx, jz);
          }
          continue;
        }
      }
      switch (b) {
        case BIOME.forest:
          // Duskbark groves: high-level dark oak clustered in deep-forest
          // pockets far from any town.
          if (cellHash(jx >> 5, jz >> 5, 911) > 0.82 && r < 0.2 && !nearTown(jx, jz, 260)) {
            node(d, "wild.darkoak", "resource.tree.darkoak", jx, jz);
          } else if (cellHash(jx >> 5, jz >> 5, 911) > 0.82 && r < 0.24 && !nearTown(jx, jz, 260)) {
            node(d, "wild.duskcap", "resource.herb.duskcap", jx, jz);
          } else if (r < 0.34) node(d, "wild.oak", "resource.tree.basic", jx, jz);
          else if (r < 0.44) node(d, "wild.birch", "resource.tree.birch", jx, jz);
          else if (r < 0.475) node(d, "wild.berry", "resource.bush.berry", jx, jz);
          else if (r < 0.49) node(d, "wild.sage", "resource.herb.sage", jx, jz);
          else if (r < 0.515) obj(d, "wild.flowers", "object.flowers.wild", jx, jz);
          else if (r < 0.527) obj(d, "wild.logfall", "object.log.fallen", jx, jz);
          else if (r < 0.533 && !nearTown(jx, jz, 180)) foe(d, "wild.wolf", "enemy.timber_wolf", jx, jz);
          break;
        case BIOME.taiga:
          if (r < 0.24) node(d, "wild.spruce", "resource.tree.spruce", jx, jz);
          else if (r < 0.27) node(d, "wild.berry", "resource.bush.berry", jx, jz);
          else if (r < 0.285) node(d, "wild.tin", "resource.rock.tin", jx, jz);
          else if (r < 0.3) node(d, "wild.coal", "resource.rock.coal", jx, jz);
          else if (r < 0.312) node(d, "wild.frostbloom", "resource.herb.frostbloom", jx, jz);
          else if (r < 0.328) obj(d, "wild.boulder", "object.boulder.stone", jx, jz);
          else if (r < 0.324 && !nearTown(jx, jz, 180)) foe(d, "wild.wolf", "enemy.timber_wolf", jx, jz);
          break;
        case BIOME.plains:
          if (r < 0.055) node(d, "wild.oak", "resource.tree.basic", jx, jz);
          else if (r < 0.09) node(d, "wild.birch", "resource.tree.birch", jx, jz);
          else if (r < 0.115) node(d, "wild.berry", "resource.bush.berry", jx, jz);
          else if (r < 0.17) obj(d, "wild.flowers", "object.flowers.wild", jx, jz);
          else if (r < 0.178) obj(d, "wild.boulder", "object.boulder.stone", jx, jz);
          break;
        case BIOME.mountain:
        case BIOME.highland:
          if (h < 15 && r < 0.09) node(d, "wild.spruce", "resource.tree.spruce", jx, jz);
          else if (r < 0.11) node(d, "wild.copper", "resource.rock.copper", jx, jz);
          else if (r < 0.13) node(d, "wild.tin", "resource.rock.tin", jx, jz);
          else if (r < 0.14 && b === BIOME.highland) node(d, "wild.iron", "resource.rock.iron", jx, jz);
          else if (r < 0.155) node(d, "wild.coal", "resource.rock.coal", jx, jz);
          else if (r < 0.163 && h > 16) node(d, "wild.gold", "resource.rock.gold", jx, jz);
          else if (r < 0.167 && h > 22 && b === BIOME.mountain) node(d, "wild.diamond", "resource.rock.diamond", jx, jz);
          else if (r < 0.2) obj(d, "wild.boulder", "object.boulder.stone", jx, jz);
          else if (r < 0.203 && h > 20) foe(d, "wild.frostwolf", "enemy.frost_wolf", jx, jz);
          break;
        case BIOME.desert:
          if (r < 0.04) node(d, "wild.acacia", "resource.tree.acacia", jx, jz);
          else if (r < 0.05) node(d, "wild.dig", "resource.digsite.basic", jx, jz);
          else if (r < 0.058) node(d, "wild.copper", "resource.rock.copper", jx, jz);
          else if (r < 0.066) node(d, "wild.gold", "resource.rock.gold", jx, jz);
          else if (r < 0.071 && !nearTown(jx, jz, 220)) foe(d, "wild.scuttler", "enemy.dust_scuttler", jx, jz);
          break;
        case BIOME.swamp:
          if (r < 0.09) node(d, "wild.fenwood", "resource.tree.jungle", jx, jz);
          else if (r < 0.108) node(d, "wild.ember", "resource.herb.ember", jx, jz);
          else if (r < 0.118) node(d, "wild.berry", "resource.bush.berry", jx, jz);
          else if (r < 0.126) node(d, "wild.duskcap", "resource.herb.duskcap", jx, jz);
          else if (r < 0.132 && !nearTown(jx, jz, 160)) foe(d, "wild.slime", "enemy.bog_slime", jx, jz);
          break;
        case BIOME.coast:
          if (r < 0.035) node(d, "wild.palm", "resource.tree.acacia", jx, jz);
          else if (r < 0.06) obj(d, "wild.flowers", "object.flowers.wild", jx, jz);
          break;
        default:
          break;
      }
    }
  }
}

export interface OverworldBuild {
  region: RegionSpec;
  pois: Poi[];
  roads: RoadResult[];
  /** The geography's biome mask (validation + the world atlas read it). */
  biome: Uint8Array;
  /** Settlement pad rectangles (the overlap regression test reads these). */
  pads: Array<{ x0: number; x1: number; z0: number; z1: number }>;
}

let cached: OverworldBuild | null = null;

export function buildOverworld(): OverworldBuild {
  if (cached) return cached;
  const geo = buildGeography();
  const d = makeDraft(geo);

  for (const build of SETTLEMENT_BUILDERS) build(d);

  const roads: RoadResult[] = ROADS.map((spec) => carveRoad(geo, spec));
  healJunctions(geo);
  relaxWalkability(geo.heights, geo.blocks, geo.locked, WORLD, 6);

  roadsideDiscoveries(d, roads);
  scatter(d, geo);

  // Expansion silhouettes not tied to a settlement builder.
  poi(d, {
    name: "The West Ford Ruin", kind: "expansion", x: 150, z: 1520,
    region: REGIONS.whisperwood.name, tier: 2,
    notes: "A washed-out bridge; the forest road resumes beyond it.",
  });
  poi(d, {
    name: "The Undervault Door", kind: "expansion", x: 1338, z: 300,
    region: REGIONS.frostspine.name, tier: 5,
    notes: "Sealed stone beneath the Trial City. It is not locked from this side.",
  });

  const region: RegionSpec = {
    id: "region.vale_clearing",
    width: WORLD,
    depth: WORLD,
    heights: geo.heights,
    blocks: geo.blocks,
    nodes: d.nodes,
    objects: d.objects,
    npcs: d.npcs,
    enemies: d.enemies,
    structures: d.structures,
    spawn: { ...SPAWN },
  };
  cached = { region, pois: d.pois, roads, biome: geo.biome, pads: d.pads };
  return cached;
}
