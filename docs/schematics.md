# Schematics — authoring guide

Schematics are hand-drawn structure stamps for the endless world: houses,
ruins, camps, big set-piece trees, anything built from blocks and props.
They live in `game/src/sim/worldgen/schematics.ts` and are stamped into
chunks by the generator. This is the format to use when handing over new
houses, trees, and other assets.

## Format

A schematic is up to three **aligned character grids** (same width, same
height — one string per row) plus legends:

| Grid     | Meaning                                                        |
|----------|----------------------------------------------------------------|
| `ground` | Surface block per cell. `.` keeps the natural terrain block.   |
| `lift`   | Extra terrain height, digits `1`-`9`. `.` or `0` means flat.   |
| `marks`  | One object/node/enemy per cell. `.` is empty.                  |

Legends map characters to game ids:

- `groundLegend`: char → block (`grass`, `dirt`, `stone`, `sand`, `plank`,
  `snow`, `ice`, `mud`, `redsand`, `mycelium`, `drygrass`, `stonebrick`)
- `markLegend`: char → `{ kind: "object" | "node" | "enemy", defId }` using
  ids from `game/src/content/content.ts` (e.g. `object.barrel.wood`,
  `resource.tree.grand.oak`, `enemy.timber_wolf`)

## Example

```ts
export const RUIN_STONE_CIRCLE: Schematic = {
  name: "ruin.stone.circle",
  ground: [
    ".#####.",
    "#######",
    "##...##",
    "##...##",
    "##...##",
    "#######",
    ".#####.",
  ],
  lift: [
    ".......",
    ".2...2.",   // 2-block stonebrick pillars on the ring
    ".......",
    ".......",
    ".......",
    ".2...2.",
    ".......",
  ],
  marks: [
    ".......",
    ".......",
    "...B...",   // B: tumbled boulder
    "..X....",   // X: old strongbox (thieving)
    ".......",
    "....B..",
    ".......",
  ],
  groundLegend: { "#": "stonebrick" },
  markLegend: {
    B: { kind: "object", defId: "object.boulder.stone" },
    X: { kind: "node", defId: "resource.strongbox.old" },
  },
};
```

## How stamping works

- The generator rolls a rare per-chunk chance, picks a schematic from a
  site table (`WILD_SCHEMATICS` today; per-biome tables when there are
  more), and picks a jittered spot.
- `schematicFits` rejects sites that touch water/ice or have more than
  2 blocks of relief; `stampSchematic` flattens the footprint to the
  center cell's height, applies ground/lift/marks, and registers the
  placements with the chunk so they stream in and out with it.
- Lifted cells render with their block's side tiles and block movement
  (>1 step), so pillars and walls come from `lift` + a hard block —
  no special casing.
- Everything stays a pure function of (seed, chunk), so the same seed
  always rebuilds the same world.

## Rules for new schematics

- Keep grids rectangular and aligned; footprints up to ~40×40 fit the
  current chunk-local stamper (must sit 1 cell inside a 64×64 chunk).
- Blocks and props must exist in the palette/content registry first —
  add new defs to `content.ts` (and textures via the importer aliases)
  before referencing them in a legend.
- Minecraft-exact sizes as always: houses are built from full blocks,
  door cells, fence posts; trees from trunk cells and canopy props.
- Leave the outermost ring of the schematic as `.` ground where possible
  so it blends into the terrain.
