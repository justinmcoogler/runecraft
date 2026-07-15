# Importing Minecraft structures

Stoneleaf Vale can bake real Minecraft builds into the world. You build in
Minecraft, save the build to a file, upload the file in chat, and say where
it goes — the importer does the rest.

## How to export your build

Any of these formats works:

1. **Structure block** (vanilla, no mods): give yourself one with
   `/give @s structure_block`, set it to SAVE mode, size the bounding box
   around your build, name it, and hit SAVE. The file lands in
   `<world>/generated/minecraft/structures/<name>.nbt`. Files that store
   multiple palette variants (`palettes`) are read using the first variant.
2. **WorldEdit / FAWE**: select the build with `//pos1` + `//pos2`, then
   `//copy` and `//schem save <name>`. The file lands in
   `plugins/(Fast)AsyncWorldEdit/schematics/<name>.schem` (Sponge v2 and v3
   are both supported).
3. **Litematica**: save the schematic normally (`.litematic`). All regions
   in the file are merged into one asset; the bit-packed block-state format
   is decoded natively.

4. **Legacy MCEdit `.schematic`** (pre-1.13, numeric block IDs): supported
   through a legacy ID table covering the common building set.

Limits: Minecraft-scale — up to 512 blocks wide/long and 384 tall (the
modern build height). Nothing is cropped on import; monumental builds bake
through `import-structure-packed.mjs`, which culls invisible enclosed cubes
(never the collision layers) and packs the rest. Optional bake arguments:
`[rotate]` (0 or 180) spins a build so its front faces the approach, and
`[sink]` embeds landscaped bases so a build's own grounds sit flush with
the terrain and stay walkable.

**Showcase bundles** (many builds displayed on pedestals over a shared
ground plate) split automatically:

```
node game/scripts/split-showcase-pack.mjs HouseBundle.schematic houses house.
```

Each display becomes its own asset — the ground plate is dropped, builds
cluster by column adjacency, and display pedestals are cut at their
platform plate (recognized by showcase stand materials: stone with
lapis/emerald/diamond bling). The plate stays as the build's sunken floor,
so verandas and yards sit flush with the grass. Builds standing directly
on the ground — including stilt houses — keep everything.

## What happens on import

- The file is parsed natively (`game/src/structures/`): gzipped NBT in,
  plain checked-in TypeScript data out. Nothing from the file ships as-is —
  only block positions and state names are read.
- Block states map onto the game's **logical materials**, so imported
  builds recolor with texture packs like everything else. Blocks with no
  material mapping (wool, concrete, quartz, copper, prismarine, purpur…)
  use their real Minecraft colors.
- **Every vanilla block is auto-recognized.** `structures/texture-colors.ts`
  holds one average color per block texture, extracted from a reference
  resource pack by `game/scripts/extract-pack-colors.mjs` (only computed
  hex values — no third-party pixels ship). Any block the explicit mapping
  doesn't cover resolves through this table, including shaped variants
  (stairs/slabs/walls) via their material root.
- **Blocks outside the table are still learned automatically.** The bake
  looks up the block's unmodified vanilla texture (mcmeta mirror) and
  stores its average color in `game/src/structures/custom-blocks.ts`.
  Modded blocks and offline bakes fall back to a deterministic
  keyword-based guess and are flagged in the report. Entries are plain
  data and can be hand-tuned afterwards.
- Shapes follow vanilla model sizes: full cubes, slabs, stairs (with
  facing), fence/wall posts with connecting rails, doors and fence gates
  as edge panels, glass panes as 2 px sheets, trapdoors/carpets, and
  lantern/torch glow boxes. Plants, air and thin snow are skipped.
- **Floors sink.** If layer y0 is mostly a solid floor, the build embeds
  one block into the terrain so its floor top sits flush with the grass
  and interiors stay walkable.
- **Walkability** is computed per column: anything solid at feet or head
  height blocks movement; doorways, gates, carpets and step-height bottom
  slabs stay passable. The sim path-finds around and through the build
  correctly — open-air compounds like the walled village play entirely in
  the overworld (walk in the gate, around the courtyard, into the towers).

## Baking (maintainer steps)

```
node game/scripts/import-structure.mjs path/to/build.nbt myBuild
```

This writes `game/src/content/structures/myBuild.ts` and prints the size,
blocked-column count, and any unmapped block names. Then:

1. Register it in `game/src/content/structures/index.ts`.
2. Place it in a region in `game/src/sim/world.ts`:
   `structures: [{ instanceId: "vale.structure.myBuild", structureId: "myBuild", cell: { x, z } }]`
   The cell is the build's minimum (north-west) corner. Pick flat ground —
   the build sits at the anchor cell's height.
3. `npx vitest run game/src`, screenshot, standalone build, ship.

`game/samples/wayshrine.nbt` (generated by
`game/scripts/make-sample-structure.mjs`) is a genuine structure-block file
used as the end-to-end test fixture; the baked result stands on the green
south of Bellbrook's cross street.

## Derived interiors (floor-plan match)

`sim/interior.ts` can derive walkable interior regions from an imported
structure's actual layout: each storey with enough connected floor becomes
a region (walls from the build's solids, floor materials from what you
walk on), the build's own door panels become the exit, its stair blocks
link storeys, and recognizable furnishings (chests, furnaces, enchanting
tables) become live objects. The current starting place (the walled
village) is open air and needs no derived interiors — the machinery stays
for future roofed builds.

## Packed libraries (many small assets)

For collections (trees, rocks, props), bake a whole directory into one
gzipped pack instead of hundreds of TS files:

```
node game/scripts/import-structure-pack.mjs <dir> trees tree.
```

This writes `game/src/content/structures/<group>.ts` (a base64 blob that
unpacks lazily at runtime). Register new packs in
`game/src/content/structures/index.ts`; place entries the same way as any
structure. Shipped packs: `house.01`–`house.17` (split from a showcase
bundle) and `village.villagiooo` (the starting compound). The previous
tree library was removed pending better source files — the grand-tree
node defs, species log items and editor plumbing all remain ready.

## The world editor (in-game)

The **Edit** button (bottom-left) opens the world editor in the vale:

- The palette lists every imported structure — trees grouped by species and
  size when a tree pack is installed (each click places a random pick from
  the bucket), plus every house and the wayshrine.
- A translucent ghost follows the mouse; red means the spot is invalid
  (water, something in the way, or the player standing there). Click to
  place. Placed trees are real choppable woodcutting nodes of their species.
- The **Remove tool** deletes placed pieces — editor placements and most
  authored ones (the starting village is protected).
- Every edit applies to the live world immediately and persists locally
  (browser storage) — no export step. **Undo** (button or the Z key)
  reverses placements and removals one at a time; **Reset edits** clears
  the whole layer.

## Texture packs

The game's default art is baked from the project's own resource pack by
`game/scripts/bake-default-textures.mjs` (raw 16x16 RGBA in
`render/default-textures.ts`, decoded synchronously at boot). Third-party
packs are never bundled: imported packs (menu > texture pack) apply
on-device and persist in local storage, overriding the defaults. Resolution
order everywhere: imported pack > baked default > procedural tile.

## Grand trees (woodcutting)

The species ladder (oak 1 → spruce 10 → birch 20 → jungle 30 → acacia 40
→ dark oak 50 → blossom 60 → ember 70 → glow 80 → dusk 90) is fully wired:
node defs, species log items, shop prices, and bake-time classification
(dominant log species + trunk anchor, with fantasy canopy overrides). The
placed tree library was removed pending better source files — when a new
pack lands, placements go back in with `grandTree(...)` in `sim/world.ts`
(the trunk cell is the node cell), and the editor's tree palette fills in
again automatically. Trunks and low branches block movement (leaves never
do), a stump remains while a tree regrows, and the interaction range is 2
so bushy bases stay workable.
