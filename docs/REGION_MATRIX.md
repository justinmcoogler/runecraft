# Region Matrix — the Stoneleaf Reach

The continent is one continuous 384×352 block map (`region.vale_clearing`,
kept for save compatibility) plus portal-linked dungeon and interior regions.
Coordinates are cell coordinates in the main map. z=0 is the far north edge
(frozen shore); z grows toward the camera (south).

## Macro map

```
x→ 0        64       128      192      256      320      383
z=0   FROZEN SHORE ······ moat ····· | NORTHERN MOUNTAIN CHAIN (snow) |
      CASTLE STONELEAF   king's road |  Highcairn ▲  Iron peaks       |
z=56  Bellbrook ▪ vale camp ▪ lake   |  foothills | EASTERN SWAMP     |
      old forest | iron hills | Delve▾            |  & mangrove delta |
z=96  ~~~~~~~~~~ THE GREAT MEANDER (west span ▸ ford ▸ east bridge) ~~
z=104 WESTERN TAIGA      | CENTRAL MEADOWS  |   Mirefen Quay ▪        |
      Tanglewood ▪       |  birch groves    |   Pumpworks ▾  E.COAST~ |
z=168 Rootvault ▾        |  south road      |                         |
z=236 BADLANDS mesas | DESERT dunes | SAVANNA  ▪Sunward | JUNGLE ▪Lianvale
z=324 ~~~~ beaches ~~~~~~~ WARM SOUTHERN OCEAN ~~~~~~ bamboo coast ~~~
z=336 ·········· Palewick Isle (mushroom fields) ···········
```

Scale note: at this project's scale one region ≈ 60–130 cells across; the
continent crosses in ~3–4 minutes on foot, settlements are 40–90 s apart.
This is the same deliberate compression the rest of the game uses.

## Regions

| # | Region (stable id) | Bounds (approx) | Biomes | Levels | Settlement | Skills | Threats | Dungeon | Story purpose |
| - | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `zone.central_basin` | x0–255, z0–92 | plains, oak forest, lake, iron hills | 1–10 | **Bellbrook** (starting village, x37–55 z6–17) + **Castle Stoneleaf** | Woodcutting, Mining, Fishing, Cooking, Smithing | cows/pigs (placid), spiders, cave spiders | Copper Hollow ▾(30,27); Iron Delve ▾(76,64) | Prologue; first anchor clue |
| 2 | `zone.north_mountains` | x256–383, z0–92 | stony/jagged peaks, snowy slopes, grove, frozen shore | 15–30 | **Highcairn** outpost (≈330,40) | Mining, Smithing | frost wolves, rust constructs | **Highcairn Liftworks** ▾(342,32) | Delvers' Compact; Act II |
| 3 | `zone.western_taiga` | x0–118, z104–232 | taiga, old-growth spruce, windswept hills | 8–20 | **Tanglewood Landing** (≈50,128) | Woodcutting, Foraging | timber wolves, spiders | **Rootvault** ▾(28,168) | Act I; first stabilizer coil |
| 4 | `zone.central_meadows` | x120–250, z104–232 | meadow, flower forest, birch/old-growth birch, sunflower plains | 5–15 | roadside camps | Foraging, Farming(⏳) | slimes, night undead(⏳) | small delves(⏳) | crossroads of the south road |
| 5 | `zone.eastern_swamp` | x252–360, z56–200 | swamp, mangrove delta, river mouth | 20–35 | **Mirefen Quay** (≈300,140) | Fishing, Foraging, Brewing(⏳) | bog slimes, mire husks | **Sunken Pumpworks** ▾(332,178) | Act II; the seal warning |
| 6 | `zone.badlands` | x4–88, z240–320 | badlands, wooded/eroded badlands | 40–55 | frontier camp (⏳) | Mining, Smithing | canyon constructs | ⏳ Cinderworks | Act IV |
| 7 | `zone.desert` | x92–198, z238–322 | desert, oasis | 30–45 | oasis camp (⏳ Sunward serves it) | Archaeology(⏳), Mining | dune husks, dust scuttlers | ⏳ Gilded Cistern | Act III; Sundering records |
| 8 | `zone.savanna` | x202–278, z236–318 | savanna, savanna plateau, windswept savanna | 20–40 | **Sunward Rest** (≈236,258) | Farming(⏳), Cooking, trade | pack hunters, raiders(⏳) | optional stronghold (⏳) | southern trade knot |
| 9 | `zone.jungle` | x282–372, z212–316 | jungle, sparse jungle, bamboo coast | 30–45 | **Lianvale** (≈318,262) | Foraging, Fishing | vine stalkers | ⏳ Verdant Archive | Act III revelation |
| 10 | `zone.coasts` | map edges; east x362+, south z324+ | beaches, stony/snowy shores, warm/cold ocean | 15–50 | fishing docks | Fishing | drowned husks(⏳) | ⏳ Tidegate Beacon | travel + Palewick route |
| 11 | `zone.palewick` | x150–184, z334–350 | mushroom fields | 50–60 | research camp | Foraging, Brewing(⏳) | spore shamblers | ⏳ Sporevault | Act V; final coil |
| 12 | `zone.undervault` | portal regions | lush/dripstone caves, deep dark analogue | 50–60 | expedition camp | Mining, combat | deep constructs | ⏳ Undervault + Loomheart | finale |

▾ = dungeon entrance on the main map. ⏳ = designed here, not yet implemented.

## Roads and crossings

| Crossing / road (stable id) | Route | State |
| --- | --- | --- |
| `road.kings_road` | vale camp → castle gate (existing, z20/58) | built |
| `road.south_road` | castle gate → King's Ford → Sunward Rest (x172) | built |
| `bridge.west_span` | x44–48 over the Meander (z96–102) | **broken**; repaired by `quest.the_first_span` |
| `ford.kings_ford` | x168–176 sand shallows over the Meander | built (always open) |
| `bridge.east_meander` | x298–302 plank bridge near Mirefen | built |
| `road.west_road` | Bellbrook → West Span → Tanglewood | built (gated by span) |
| `road.mirefen_boardwalk` | plank boardwalk z140 across the delta | built |
| `road.mountain_switchback` | castle road → Highcairn, landings every climb | built |
| `bridge.south_causeway` | x278–281 over the jungle river (z258–264) | **broken**; repaired by `quest.the_long_causeway` |
| `road.savanna_road` | Sunward Rest → causeway → Lianvale (z262) | built (gated by causeway) |
| `pier.palewick` | south-coast pier x166 → Palewick Isle | built (ferry-quest upgrade ⏳) |
| `road.badlands_track`, `road.desert_caravan` | Sunward → desert → badlands (z258→ mesas) | built |
| further crossings (taiga ravine bridge, frozen crossing, cavern bridge…) | | ⏳ with their acts |

Rules honored: main roads ≥3–4 cells wide or clearly landmarked; no
main-story route requires a jump; every climb uses ≤1-block steps with
landings; resources never sit on road cells.
