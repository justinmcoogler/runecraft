# Dungeon Bible — the Stoneleaf Reach

Dungeons are portal-linked regions with authored ASCII layouts (the
`makeIronDelve` pattern): deterministic, testable, tap-to-move navigable,
no precision movement anywhere. Every dungeon has a clear entrance object on
the main map, an exit object inside, hand-placed encounters, and a reason to
exist in the story (each guards a Braid anchor or its records).

## Lineup

| # | Dungeon (region id) | Entrance | Act | Palette / identity | Boss | First-clear result | Status |
| - | --- | --- | --- | --- | --- | --- | --- |
| 1 | Copper Hollow (`region.copper_hollow`) | cave mouth (30,27) | Prologue | dim copper cave | Old Gnasher | Emberstone; combat tutorial | ✅ shipped |
| 2 | **Rootvault** (`region.rootvault`) | root-split outcrop (28,168), taiga | I | living roots through Braidwright stonework; green gloom | **Rootbound Warden** | Rootheart Coil → `worldstate.anchor_root_stabilized` | ✅ this pass |
| 3 | Iron Delve (`region.iron_delve`) | outcrop (76,64), iron hills | I–II | ravine mine | cave-spider nest | iron route | ✅ shipped |
| 4 | **Sunken Pumpworks** (`region.pumpworks`) | flooded stair (332,178), delta | II | drowned pump halls, silt water channels | **The Silt King** | Tidegate Coil → `worldstate.anchor_pump_stabilized` | ✅ this pass |
| 5 | **Highcairn Liftworks** (`region.liftworks`) | shaft-head (342,32), Highcairn plateau | II | dead haul-mine galleries, rust-seized machinery | **The Liftworks Overseer** | Liftworks Coil → `worldstate.liftworks_running` (haul-road) | ✅ this pass |
| 6 | Verdant Archive | jungle | III | overgrown records-hall | Archive Custodian | governor-valve revelation | ⏳ |
| 7 | Gilded Cistern | desert | III | buried reservoir, dry fountains | Cistern Historian | Sundering records | ⏳ |
| 8 | Cinderworks | badlands | IV | dead foundry, rail spurs | Foundry Engine | stabilizer coil | ⏳ |
| 9 | Rimehold Vault | frozen north | IV | ice-cased vault | Rime Revenant | last surface coil | ⏳ |
| 10 | Sporevault | Palewick Isle | V | mycelial laboratory | Fungal Monarch | final coil | ⏳ |
| 11 | Tidegate Beacon | south coast | optional | half-sunk beacon | Beacon Guardian | ferry lore, gear | ⏳ |
| 12 | Undervault & the Loomheart | deep entrance (Act V) | V | buried city → governor core | **Custodian of the Loom** | ending; `worldstate.loomheart_balanced` | ⏳ |

## Layout rules (all dungeons)

- Rooms ≥3 cells wide; corridors ≥2; no diagonal-only links; no overhangs
  that hide the player from the fixed camera.
- One reliable entrance and exit each; exits are interactable objects.
- Encounters are placed in rooms, never on the entrance cell.
- Skill interactions: ore nodes, root-choked doors (Woodcutting ⏳ interaction),
  fishing pools in flooded rooms.
- Lore via set dressing (banners, chests with journals ⏳, architecture).
- Connectivity is enforced by automated BFS tests (see `__tests__`).

## Small delves

Copper Hollow plays the small-delve role today. Roadmap: one 5–15 minute
delve per region (cellar, sea cave, crypt, ruined tower) added with its act.
