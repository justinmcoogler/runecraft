# Monster Bestiary — the Stoneleaf Reach

All creature behavior runs on the shared `EnemySystem` (wander / aggro /
chase / attack cadence / leash / respawn). Archetypes are **data** in
`content.ts` (`ENEMIES`); regional variants are new defs reusing the same
view rigs with different tints, stats and loot. Views are original blocky
rigs; anything that exists in Minecraft uses Minecraft-exact model boxes
(see `game/CLAUDE.md`).

Understrain leakage explains hostility: creatures near failing anchors are
agitated and territorial; placid livestock stays placid. Settlements and
main roads are spawn-free by placement.

## Roster (✅ implemented / ⏳ designed)

| ID | Name | Family | Region | Lvl | Role | View | Notes / loot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ✅ enemy.cow | Cow | livestock | basin | 2 | placid | cow | beef, hide |
| ✅ enemy.pig | Pig | livestock | basin | 3 | placid | pig | pork |
| ✅ enemy.spider | Spider | spiders | basin/forest | 4 | melee ambush | spider | copper ore |
| ✅ enemy.cave_spider | Cave Spider | spiders | dungeons | 6 | fast melee | spider ×0.75 | iron ore |
| ✅ enemy.timber_wolf | Timber Wolf | wolves | taiga | 5 | pack pursuer | wolf | wolf hide, bone |
| ✅ enemy.frost_wolf | Frost Wolf | wolves | mountains/frozen | 9 | fast pursuer | wolf (frost tint) | wolf hide, bone |
| ✅ enemy.bog_slime | Bog Slime | slimes | swamp | 5 | slow tank | slime (MC medium 1-block cube) | slime glob |
| ✅ enemy.mire_husk | Mire Husk | husks | swamp | 6 | melee undead | husk (zombie-dim humanoid) | bone, slime glob |
| ✅ enemy.dune_husk | Dune Husk | husks | desert | 8 | melee undead | husk (sand tint) | bone, venom sac |
| ✅ enemy.dust_scuttler | Dust Scuttler | scuttlers | desert | 7 | fast ambush | spider (dust tint) | venom sac |
| ✅ enemy.vine_stalker | Vine Stalker | stalkers | jungle | 8 | ambush | spider (green tint) | venom sac, berries |
| ✅ enemy.canyon_construct | Canyon Construct | constructs | badlands | 10 | armored tank | construct (original golem rig) | construct core |
| ✅ enemy.rust_construct | Rust-seized Construct | constructs | Liftworks | 8 | slow tank | construct (rust tint) | construct core |
| ✅ enemy.spore_shambler | Spore Shambler | fungal | Palewick | 9 | melee | husk (pale tint) | pale spores |
| ⏳ archer/kiter, witch/support, drowned, raider, burrower, swarm… | | | | | | | Acts II–V |

Target roster is 24–30 base archetypes; 13 exist. Ranged/support AI roles
need an `EnemySystem` extension (attack range > 1) — tracked as tech debt.

## Elites & bosses

| ID | Name | Where | Role | Guaranteed drop |
| --- | --- | --- | --- | --- |
| ✅ enemy.old_gnasher | Old Gnasher | Copper Hollow | tutorial boss | Emberstone |
| ✅ enemy.rootbound_warden | Rootbound Warden | Rootvault | Act I boss (construct ×1.5, root-armored) | **Rootheart Coil** (quest) |
| ✅ enemy.silt_king | The Silt King | Sunken Pumpworks | Act II boss (slime ×2 = MC large) | **Tidegate Coil** (quest) |
| ✅ enemy.liftworks_overseer | The Liftworks Overseer | Highcairn Liftworks | Act II boss (construct ×1.6, steel-blue) | **Liftworks Coil** (quest) |
| ⏳ Archive Custodian, Cistern Historian, Foundry Engine, Rime Revenant, Fungal Monarch, Beacon Guardian, **Custodian of the Loom** | one per remaining dungeon | multi-phase by Act IV+ | coils / story items |

Boss rules: quest drops are `chance: 1`; bosses respawn only as repeatable
fights (their quest completion state is what gates the story, so a re-kill
never re-triggers story). No boss is a stat-only copy of a common enemy —
size, cadence, damage pattern and arena differ.

## Spawning rules honored

- Settlements and road cells contain no hostile home cells.
- Aggro creatures use small aggro radii (2–4) and leash home (existing AI).
- Dungeon encounters are hand-placed rooms, not random.
- Placid livestock never initiates.
- Quest-required enemies are fixed placements (never rare random spawns).
