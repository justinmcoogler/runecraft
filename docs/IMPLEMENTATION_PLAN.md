# Implementation Plan & Status — continent rebuild

> **RESCOPE (current build):** the shipped world is now the **Starter Vale**
> — one dense 256x256 map (Bellbrook + Castle Stoneleaf + skill grounds +
> Copper Hollow) with a 5-quest chain covering every skill. The continent
> below is parked as forward canon; future acts grow outward from the vale.
> The pre-rescope continent build is commit `4629cd0`.

## Project audit (2026-07-12)

- **World**: `sim/world.ts` — authored `RegionSpec` grids (heights/blocks per
  cell), portal-linked sub-regions, ASCII dungeon/room builders. Rendered as
  one static batched terrain mesh (`render/renderer.ts`), materials resolved
  via logical IDs (`render/textures.ts` atlas) — texture-pack safe.
- **Navigation**: A* (binary heap) on the cell grid; step allowed iff
  |Δheight| ≤ 1; water/blockers unwalkable. Tap/click-to-move only.
- **Quests**: `sim/quests.ts` — data-driven, event-advanced objectives
  (talk / equipTag / gather / deliver / slay), prereq chains.
- **Enemies**: `sim/enemies.ts` — shared AI (wander/aggro/chase/leash/respawn),
  data-defined stats/loot/views.
- **Saves**: versioned JSON (localStorage), region snapshots, legacy-id
  migration, seed-item recovery.
- **Reused as-is**: all of the above, plus shops, containers, workstations,
  skills, HUD. **Extended**: BlockType palette, tree/enemy views, world-state
  flags, save validation. **Backup**: the pre-rebuild map is commit
  `77bb278` (git history is the rollback path).

## Pass status

| Pass | Content | Status |
| --- | --- | --- |
| 1 Audit & canon | docs/ bibles | ✅ this commit |
| 2 Continental greybox | 384×352 map, coasts, Meander, mountains, biome bands, southern band, Palewick | ✅ this commit |
| 3 Navigation | roads, ford, bridges, boardwalk, switchbacks, pier; BFS/A* tests | ✅ this commit |
| 4 Starting-region slice | Bellbrook spawn, prologue chain incl. The First Span (bridge world-flag) | ✅ this commit |
| 5 Settlements | Tanglewood, Mirefen, Sunward, Lianvale, Highcairn (+ existing Bellbrook/castle) | ✅ compact versions; interiors ⏳ |
| 6 Biome terrain | palettes (snow/ice/mud/redsand/mycelium/drygrass), 4 new tree types | ✅ this commit |
| 7 Monster ecology | 9 new archetypes + 2 bosses placed by region | ✅ subset (13/24 target) |
| 8 Dungeons | Rootvault, Sunken Pumpworks, Highcairn Liftworks (+2 existing) | ✅ 5/12; rest per DUNGEON_BIBLE |
| 9 Skills & resources | biome nodes, new shops, drops economy | ✅ first placement |
| 10 Main story | quests 1–11 of 18 implemented (incl. The Magpie's Price); flags drive visible repairs | ✅ partial |
| 11 Side content | regional side quests | ⏳ |
| 12 Validation & perf | vitest suites + browser smoke; perf notes below | ✅ ongoing |

## Known technical debt

- Ranged/support enemy AI (attack range > 1) not yet in `EnemySystem`.
- Interiors for the four new settlements (doors are currently scenery).
- Farming/Brewing/Enchanting/Archaeology/Construction skills (Acts II–IV).
- Terrain is a single static mesh — fine at 384×352 (measured), but chunking
  is the plan before any further growth.
- Day/night, minimap, boss multi-phase mechanics.

## Mobile performance

384×352 = 135k cells → one static batched mesh + instanced props; enemy AI
is O(active enemies) at 10 Hz with early-outs; spawn density kept low per
region. Verified against the dev server via Playwright on a 1280×800 and a
390×844 viewport; frame pacing unchanged from the 256×256 map within
measurement noise. Re-profile before adding chunk streaming.
