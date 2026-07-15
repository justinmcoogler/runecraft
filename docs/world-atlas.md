# Stoneleaf Vale — World Atlas

Generated from the deterministic world generator (`game/src/sim/worldgen/`).
Regenerate by re-running the generator; do not hand-edit coordinates.

- World size: 2500 × 2500 blocks. Spawn: (1250, 1418) on the Greenvale plaza road.
- Placements: 20835 resource nodes, 5030 objects, 19 NPCs, 525 enemy spawns, 1 structures.
- Roads: 38 carved routes, 6 bridges.
- Primary Accessible Route proof: a 4-direction flood from spawn (step ≤ 1 block, no water, no blockers) reaches 5,865,642 cells; every table below lists per-POI reachability from that flood.

## Regions

| Region | Center | Tier | Tagline |
| --- | --- | --- | --- |
| Greenvale | (1250, 1375) | 1 | The starter kingdom: meadows, farms and the king's peace. |
| The Whisperwood | (550, 1300) | 2 | Old timber, mist, and things that watch from the ferns. |
| Willowmere | (665, 1415) | 1 | A lantern-lit forest village on the mere. |
| Highforge | (650, 625) | 2 | White stone, deep mines, and smoke over the highlands. |
| The Frostspine | (1315, 265) | 4 | The frozen wall of the north. The pass is safe. Nothing else is. |
| Stonegate | (1800, 750) | 2 | Where every caravan road in the province meets a toll. |
| The Sunscar Drylands | (2125, 1340) | 3 | Red rock, buried ruins, and one cold well between them. |
| The Murkfen | (1175, 2050) | 3 | The ground drinks, and sometimes it swallows. |
| Tidewatch Coast | (2000, 2050) | 2 | Salt wind, white cliffs, and a harbor waiting for sails. |
| Ironroot Camp | (1190, 800) | 2 | The fortified crossroads where recruits become veterans. |

## Settlements (20)

| Name | Coords | Region | Biome | Tier | Services | Nearest road | Reachable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Eastholt | (1420, 1180) | Greenvale | plains | 1 | farming | — | yes |
| Furrowfield | (1085, 1520) | Greenvale | plains | 1 | farming | — | yes |
| Greenvale | (1250, 1375) | Greenvale | plains | 1 | bank, store, inn, smithy, kitchen, training, quests | — | yes |
| Willowmere | (665, 1415) | The Whisperwood | forest | 1 | bank, market, sawmill, herbalist, fishing | trail.wm.blackbriar | yes |
| Ferndown | (772, 1692) | The Whisperwood | plains | 2 | forestry, storage, campfire | road.mf.willowmere | yes |
| Highforge | (650, 625) | Highforge | taiga | 2 | bank, smithy, mining guild, quarry, furnace | — | yes |
| Ironroot Camp | (1190, 800) | Ironroot Camp | plains | 2 | training, storage, trade, smithy | road.ironroot.pass | yes |
| Longfold Steading | (498, 1902) | The Whisperwood | plains | 2 | livestock, campfire, hunting | trail.sw.barrows | yes |
| Netter's Rest | (1700, 1952) | Tidewatch Coast | plains | 2 | fishing | — | yes |
| Nine Firs Quarry | (2122, 382) | Stonegate | taiga | 2 | mining, workbench, campfire | trail.ne.beacon | yes |
| Stonegate | (1800, 750) | Stonegate | taiga | 2 | bank, exchange, smith street, mage quarter, docks, tavern | — | yes |
| Tidewatch Port | (2000, 2050) | Tidewatch Coast | coast | 2 | bank, fish market, shipwright, inn, customs | — | yes |
| Tollhouse Crossing | (1998, 492) | Stonegate | taiga | 2 | watch, campfire, storage | trail.ne.quarry | yes |
| Westmarch Post | (168, 1512) | The Whisperwood | forest | 2 | watch, campfire, storage, training | trail.wp.greenway | yes |
| Cloudrest Monastery | (471, 296) | Highforge | highland | 3 | shrine, herbalist, storage | trail.nw.altar | yes |
| Coldharbour | (1210, 520) | The Frostspine | taiga | 3 | campfire, storage | road.hf.pass | yes |
| Peatlight Hamlet | (1175, 2050) | The Murkfen | swamp | 3 | storage, herbalist, fishing | trail.mf.glowfen | yes |
| Suncall Oasis | (2125, 1340) | The Sunscar Drylands | desert | 3 | bank, bazaar, gem trader, pottery, caravans | — | yes |
| The Saltpan Caravanserai | (2320, 1298) | The Sunscar Drylands | desert | 3 | water, market, campfire, shelter | trail.ss.east | yes |
| Frostwatch Fortress | (1315, 265) | The Frostspine | mountain | 4 | shelter, campfire | trail.pass.gate | yes |

## Dungeons (9)

| Name | Coords | Region | Biome | Tier | Services | Nearest road | Reachable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The Old Starter Mine | (1082, 1183) | Greenvale | plains | 1 | — | trail.gv.mine | yes |
| The Restless Crypt | (1345, 1310) | Greenvale | plains | 1 | — | trail.gv.crypt | yes |
| Blackbriar Manor | (378, 1078) | The Whisperwood | forest | 2 | — | trail.wm.blackbriar | yes |
| The Deepforge | (640, 570) | Highforge | taiga | 2 | — | — | yes |
| The Stonegate Sewers | (1852, 792) | Stonegate | plains | 2 | — | — | yes |
| The Glowfen Caves | (952, 2248) | The Murkfen | swamp | 3 | — | trail.mf.glowfen | yes |
| The Stronghold of Trials | (1196, 838) | Ironroot Camp | plains | 3 | — | road.gv.north | yes |
| The Sunken Sun Temple | (2315, 1625) | The Sunscar Drylands | desert | 4 | — | trail.ss.temple | yes |
| The Ancient Trial City | (1318, 300) | The Frostspine | mountain | 5 | — | road.ironroot.pass | yes |

## Named landmarks (56)

| Name | Coords | Region | Biome | Tier | Services | Nearest road | Reachable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Alder's Lumber Camp | (1166, 1383) | Greenvale | plains | 1 | — | road.gv.willowmere | yes |
| Greenvale Windmill | (1296, 1441) | Greenvale | plains | 1 | — | road.gv.tidewatch | yes |
| Silverlake Docks | (1406, 1502) | Greenvale | plains | 1 | fishing | — | yes |
| The Broken Footbridge | (1178, 1601) | Greenvale | river | 1 | — | — | yes |
| The Wayshrine | (1293, 1453) | Greenvale | plains | 1 | — | road.gv.tidewatch | yes |
| The Wizard's Tower | (1136, 1306) | Greenvale | plains | 1 | — | road.gv.highforge | yes |
| Deepwater Rise | (1593, 1498) | Greenvale | river | 2 | fishing | — | yes |
| Fort Ebb | (1750, 2150) | Tidewatch Coast | plains | 2 | — | — | yes |
| Highforge Quarry | (740, 565) | Highforge | taiga | 2 | mining | — | yes |
| Mosswall Ruin | (200, 1240) | The Whisperwood | forest | 2 | — | trail.wp.greenway | yes |
| Stonegate Docks | (1710, 780) | Stonegate | plains | 2 | fishing, freight | — | yes |
| Sweetspring Hollow | (620, 2010) | The Whisperwood | plains | 2 | herbalist | trail.sw.spring | yes |
| The Abandoned Toll Fort | (2140, 900) | Stonegate | plains | 2 | — | — | yes |
| The Druid Rings | (300, 1420) | The Whisperwood | forest | 2 | — | — | yes |
| The Elder Bough | (520, 1090) | The Whisperwood | forest | 2 | — | — | yes |
| The Old Sentinel | (762, 542) | Highforge | taiga | 2 | woodcutting | — | yes |
| The Shield-Break Fields | (1290, 900) | Ironroot Camp | plains | 2 | — | — | yes |
| The Silver Lady | (700, 1204) | The Whisperwood | forest | 2 | woodcutting | — | yes |
| The Tidewatch Light | (2110, 2072) | Tidewatch Coast | coast | 2 | — | trail.tw.light | yes |
| The Wreck of the Gull | (1840, 2320) | Tidewatch Coast | coast | 2 | — | — | yes |
| Tidewatch Harbor | (2052, 2078) | Tidewatch Coast | coast | 2 | fishing, future sailing | trail.tw.light | yes |
| Brinehollow Cave | (2250, 1950) | Tidewatch Coast | coast | 3 | — | — | yes |
| Cliffside Monastery | (2380, 1900) | Tidewatch Coast | coast | 3 | — | — | yes |
| Cloudrest Monastery | (470, 300) | Highforge | highland | 3 | — | trail.nw.altar | yes |
| Deepwater Rise | (2095, 2104) | Tidewatch Coast | sea | 3 | fishing | trail.tw.light | yes |
| Deepwater Rise | (1445, 2377) | Tidewatch Coast | swamp | 3 | fishing | — | yes |
| Mirrormere | (208, 505) | Highforge | taiga | 3 | fishing | — | yes |
| The Barrowfield | (420, 2120) | The Whisperwood | plains | 3 | archaeology | trail.sw.barrows | yes |
| The Broken Aqueduct | (900, 260) | Highforge | taiga | 3 | — | — | yes |
| The Drowned Ring | (1350, 2200) | The Murkfen | swamp | 3 | — | — | yes |
| The Fen Mother | (1052, 2148) | The Murkfen | swamp | 3 | woodcutting | trail.mf.glowfen | yes |
| The Flooded Watchtower | (1500, 1900) | The Murkfen | plains | 3 | — | — | yes |
| The Fossil Beds | (2050, 1560) | The Sunscar Drylands | desert | 3 | archaeology | — | yes |
| The Glass Flat | (2262, 1432) | The Sunscar Drylands | desert | 3 | — | trail.fe.glass | yes |
| The Hermit's Slope | (252, 380) | Highforge | taiga | 3 | — | trail.nw.hermit | yes |
| The Leaning Mage Tower | (2080, 560) | Stonegate | taiga | 3 | — | — | yes |
| The Lost Ford | (1402, 1972) | The Murkfen | swamp | 3 | — | — | yes |
| The Mirror Tarn | (362, 389) | Highforge | taiga | 3 | fishing | trail.nw.tarn | yes |
| The Old Battlefield | (1600, 520) | Stonegate | taiga | 3 | — | — | yes |
| The Ridge Beacon | (2232, 262) | Stonegate | taiga | 3 | — | trail.ne.beacon | yes |
| The Sundered Court | (232, 1622) | The Whisperwood | forest | 3 | archaeology | trail.wp.court | yes |
| The Sunken Chapel | (1080, 2260) | The Murkfen | swamp | 3 | — | — | yes |
| The Thirsty Crown | (2202, 1452) | The Sunscar Drylands | desert | 3 | woodcutting | trail.ss.temple | yes |
| The Witch's Stilts | (942, 1952) | The Murkfen | swamp | 3 | — | road.mf.willowmere | yes |
| Redwind Bandit Canyon | (2380, 1440) | The Sunscar Drylands | desert | 4 | — | — | yes |
| The Blossom Tree | (882, 1132) | The Whisperwood | forest | 4 | woodcutting | — | yes |
| The Dune Tombs | (2378, 1182) | The Sunscar Drylands | desert | 4 | archaeology | trail.fe.tombs | yes |
| The Duskbark Elder | (332, 1182) | The Whisperwood | forest | 4 | woodcutting | — | yes |
| The Frozen Shelf | (1454, 415) | The Frostspine | taiga | 4 | ice fishing | — | yes |
| The Last Well | (2440, 1330) | The Sunscar Drylands | desert | 4 | — | — | yes |
| The Mountain Shrine | (1530, 330) | The Frostspine | mountain | 4 | — | — | yes |
| The Sky Altar | (553, 212) | Highforge | highland | 4 | — | trail.nw.altar | yes |
| The Sleeping Tor | (340, 200) | Highforge | highland | 4 | — | — | yes |
| The Duskglass Tree | (1292, 242) | The Frostspine | mountain | 5 | woodcutting | trail.pass.gate | yes |
| The Ember Tree | (2338, 1202) | The Sunscar Drylands | desert | 5 | woodcutting | trail.fe.tombs | yes |
| The Lanternwood | (982, 2272) | The Murkfen | swamp | 5 | woodcutting | — | yes |

## Expansion exits (5)

| Name | Coords | Region | Biome | Tier | Services | Nearest road | Reachable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| The Waiting Berth | (2066, 2080) | Tidewatch Coast | coast | 2 | — | trail.tw.light | yes |
| The West Ford Ruin | (150, 1520) | The Whisperwood | forest | 2 | — | trail.wp.court | yes |
| The East Caravan Cut | (2492, 1258) | The Sunscar Drylands | desert | 4 | — | trail.ss.east | yes |
| The Sealed Gate | (1338, 10) | The Frostspine | mountain | 5 | — | trail.pass.gate | yes |
| The Undervault Door | (1338, 300) | The Frostspine | river | 5 | — | road.ironroot.pass | yes |

## Major bridges (6)

| Name | Coords | Region | Biome | Tier | Services | Nearest road | Reachable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bridge | (1211, 1882) | The Murkfen | swamp | 1 | — | road.gv.murkfen | yes |
| Bridge | (1040, 2008) | The Murkfen | swamp | 1 | — | road.mf.willowmere | yes |
| Bridge | (1160, 2080) | The Murkfen | swamp | 1 | — | trail.mf.glowfen | yes |
| Bridge | (1139, 2094) | The Murkfen | swamp | 1 | — | trail.mf.glowfen | yes |
| Bridge | (1106, 2116) | The Murkfen | swamp | 1 | — | trail.mf.glowfen | yes |
| Bridge | (1081, 2132) | The Murkfen | swamp | 1 | — | trail.mf.glowfen | yes |

## Discoveries (105)

Small unnamed-on-map finds (campsites, shrines, wells, carts, ruins,
standing stones, watchposts, fishing spots, memorials, bandit camps)
stamped every 90–180 blocks along the road network and scattered off-road.

## Dungeon interiors

| Dungeon | Overworld door | Rooms | Boss | Route status |
| --- | --- | --- | --- | --- |
| The Restless Crypt | — | 10 | enemy.dune_husk | entrance→boss→exit verified in tests |
| Blackbriar Manor | — | 12 | enemy.rootbound_warden | entrance→boss→exit verified in tests |
| The Deepforge | — | 14 | enemy.canyon_construct | entrance→boss→exit verified in tests |
| The Ancient Trial City | — | 16 | enemy.liftworks_overseer | entrance→boss→exit verified in tests |
| The Stonegate Sewers | — | 18 | enemy.silt_king | entrance→boss→exit verified in tests |
| The Sunken Sun Temple | — | 12 | enemy.canyon_construct | entrance→boss→exit verified in tests |
| The Glowfen Caves | — | 11 | enemy.silt_king | entrance→boss→exit verified in tests |
| The Stronghold of Trials | — | 12 | enemy.old_gnasher | entrance→boss→exit verified in tests |

## Verification

- `game/src/sim/__tests__/overworld.test.ts` proves the accessibility rule
  (flood-fill Primary Accessible Route from spawn to every settlement,
  dungeon door, landmark and expansion exit), biome organicness, road
  discovery spacing, settlement services, and dungeon route compliance.
- Rendering, streaming, the map panel and dungeon round-trips are checked
  in the browser with Playwright before each ship.

