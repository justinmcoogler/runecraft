# Playtest Guide — the Starter Vale build

The world has been rescoped to one dense, hand-detailed 256×256 vale:
**Bellbrook** town, the huge **Castle Stoneleaf**, skill grounds for every
skill, and one dungeon (**Copper Hollow**). The continent design from the
earlier build remains future canon (see WORLD_BIBLE / REGION_MATRIX) and
will grow back outward from this vale act by act.

## Running it

- **Single file**: open `game/dist/stoneleaf-vale.html` in any browser —
  no server, works on phones.
- **Dev server**: `npx vite --host` from the repo root, then `/game/`.
- **Fresh start**: run `localStorage.clear()` in the console and reload.
  (Old saves migrate: unknown positions relocate to the Bellbrook market.)

## The lay of the land

You spawn in the **market square**: stalls, well, lamps, Sella and Bett.
- **North** up the high street: the castle gate, moat and causeway. Inside:
  the ward smithy, barracks and storehouse (enterable), gardens, and the
  grand keep — the great hall and upper floor are enterable; Steward Corin
  waits in the hall.
- **West**: Old Alder's camp at the wood's edge (his chest holds the starter
  pickaxe, fishing rod and hammer), then the deep Westwood — oaks, spruce,
  birch, hedgerow berries, pigs, and two wolves if you go far enough.
- **East**: the mine road climbs the ore terraces — copper low, tin mid,
  iron high — past spiders to the **Copper Hollow** cave mouth.
- **South**: four enterable cottages, the town smithy row, the fenced farm
  rows, then the river: fishing dock, plank bridge, and beyond it the
  fenced pasture (cows and pigs), the orchard, and the warm bay.

## New this build

- Houses rebuilt medieval-style (cobbled foundations, timber frames,
  plaster, shingle gables, chimneys) with Minecraft-style doors hung flush
  in carved doorways. Castle re-dressed in stone brick; the keep gained
  quoins, double window rows, a balcony and chimneys.
- Copper Hollow is now a four-chamber dungeon with three treasure chests
  (coins, bronze bars, a bronze cap), an underground fishing pool, tin and
  iron veins, and the Gnasher in its own hall.
- New animals: chickens (coop by the farm) and sheep (pasture) — feathers,
  wool, chicken and mutton for the pot.
- New skills: **Farming** (wheat/pumpkin plots; bread and roast pumpkin),
  **Herblore** (wild sage; Healing Salve), **Crafting** (workbenches at the
  town smithy row and castle ward: planks, rope, bone charms), and
  **Archaeology** (dig sites at the Old Ruin in the south meadow, the
  riverbank, and ancient foundations in the castle gardens — shards, idols
  and coin), **Archery** (craft a Shortbow at a workbench — 2 planks + rope
  — or buy one at Mara's, then shoot from range; straw targets stand on the
  castle's archery lane, arrows fly, and bow kills train Archery instead of
  Attack), and **Construction** (build sites consume materials and change
  the world for good: the Broken Jetty on the bay needs 8 planks + 2 rope
  and opens new fishing water; the Fallen Footbridge west of the town
  bridge needs 10 planks + 4 stone bricks and spans the river as a
  shortcut — both persist in saves), and **Brewing** (cauldrons at the town
  smithy row and castle ward brew a Swiftness Draught — sage + feather, move
  faster —, Strength Tonic — sage + bone, hit harder — and Stoneskin Brew —
  sage + rough stone, shrug off blows; drink from the inventory sheet for a
  60-second effect). **Enchanting** rounds out the roster: the table in the castle's great hall runes iron tools and yew bows with Archaeology's sunburst idols (Runed Axe/Pickaxe: +24% success; Runed Sword: +10; Runed Longbow: +8). Seventeen skills total. The Westwood was thinned to a
  walkable forest with clearings.

Every town building now has its own look: stair-course roofs like real
stair-block builds, and themes matching who lives there — Mara's store
(awning + barrels), the tall twin-chimney inn with a hanging sign, the
blue-washed fisher's cottage, the gardener's cottage with flower boxes,
the mason's square stone-waisted house, the woodworker's L-shaped house
with crossing gables, the all-masonry barracks and the storehouse.

## The quest chain (all five, every skill)

1. **First Timber** — Old Alder (west camp). Woodcutting.
2. **Tin and Temper** — Alder. Mining, Smelting, Smithing (tin is on the
   middle terrace of the mine road).
3. **Hearth and Harvest** — Bett in the market. Foraging, Fishing, Cooking.
4. **Stones for the Steward** — Corin in the great hall. Mining, Smelting;
   rewards a bronze pickaxe.
5. **The Gnasher Below** — Alder. Forge a blade, climb the mine road, and
   face Old Gnasher in Copper Hollow. Attack & Defense.

## Worth poking at

- Mara's store (buy/sell), the inn, all six enterable town buildings.
- Fishing spots: the dock, the mill pond, the castle moat, the south bay.
- Save/load anywhere, including inside the hollow and the keep.
- Resource-pack import still reskins everything (settings panel).

## Known not-in-yet

Future acts (the continent), ranged enemies, Farming/Brewing/etc. — parked
designs live in `game/docs/`.
