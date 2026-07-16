# Runecraft — Full Custom Texture Pack (RuneScape re-skin)

**Goal:** recreate EVERY texture in the game with an original RuneScape fill, so
Runecraft ships its own custom pack instead of aliasing Minecraft art.

**Style bible (applies to every tile):** classic RuneScape — muted earthy
palettes (moss greens, umber browns, cold greys), 2–3 tone chunky dither, low
detail that reads at a glance, gold/rune accents only where fitting. Pixel art,
no anti-aliasing. Nothing shrill; textures are seen thousands of times.

**How the pack works (technical):** the game resolves art through *logical
material IDs* (see `src/texturepacks/importer.ts` `ALIASES`, and
`src/render/textures.ts`). Deliver one PNG per material ID below. Block/prop/
item tiles are **16×16** (larger square sizes accepted, kept native). Entity/
character skins are **box-UV sheets** (64×64 / 64×32) laid out like Minecraft
entity textures. Some grayscale tiles are biome-tinted at runtime (noted with a
tint hex) — paint those **grayscale** and let the engine tint. A handful of
water/leaf tiles ship pre-coloured (noted).

**Counts:** 226 block/prop/foliage/item materials · 69 entity & character skins · 196 item icons · 56 UI/FX sprites. Everything below is a real ID pulled from the codebase.

---

## 1. Blocks, terrain, props & foliage materials (`ALIASES` table)

> Complete catalog of every materialId in the ALIASES table of src/texturepacks/importer.ts: 161 literal AliasDef entries (lines 32-197) plus 65 generated via the DYE_COLORS loops and pushes (wool x16, concrete x16, terracotta x16, block.terracotta.plain, stained_glass x16). Each entry gives a human label, an inferred group, the fixed 16x16 size, the first vanilla source filename (with tint where the def specifies one), and a one-line RuneScape-flavoured art direction. sprite.item.hammer has an empty files array (no vanilla source; built-in art kept).

### terrain (44)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `terrain.grass.top` | Grass (top) | 16x16 | grass_block_top.png +tint #79c05a | Muted moss-green turf, chunky 2-3 tone dither with faint worn dirt flecks, plain Lumbridge field. |
| `terrain.grass.side` | Grass (side) | 16x16 | grass_block_side.png | Earthy umber soil band capped by a ragged green fringe, low-detail RS embankment edge. |
| `terrain.dirt` | Dirt | 16x16 | dirt.png | Flat umber loam with a few darker pebble specks, deliberately drab OSRS ground. |
| `terrain.stone` | Stone | 16x16 | stone.png | Cold grey bedrock, chunky mottled two-tone shading, mine-tunnel floor. |
| `terrain.sand` | Sand | 16x16 | sand.png | Pale desert tan with subtle grain speckle, sun-bleached Al Kharid dune. |
| `terrain.snow` | Snow | 16x16 | snow.png | Near-white drift with faint blue-grey shadow dips, crisp Fremennik frost. |
| `terrain.ice` | Ice | 16x16 | ice.png | Glassy pale-cyan sheet with sparse crack lines, muted frozen-lake glaze. |
| `terrain.mud` | Mud | 16x16 | mud.png | Dark sodden brown with wet-sheen blotches, swampy mire tile. |
| `terrain.redsand` | Red sand | 16x16 | red_sand.png | Rusty ochre grit speckle, baked desert-canyon floor. |
| `terrain.mycelium` | Mycelium | 16x16 | mycelium_top.png | Dusky purple-grey fungal crust with fine spore stipple, eerie cave floor. |
| `terrain.stonebrick` | Stone brick | 16x16 | stone_bricks.png | Grey mortared blocks with chunky recessed grout, weathered castle masonry. |
| `terrain.plank` | Wooden plank floor | 16x16 | oak_planks.png | Warm oak boards with dark seam lines, sturdy tavern flooring. |
| `terrain.gravel` | Gravel | 16x16 | gravel.png | Cool grey pebble scatter, two-tone rubble, mine-cart path. |
| `terrain.coarsedirt` | Coarse dirt | 16x16 | coarse_dirt.png | Rough dry earth peppered with grit, cracked wilderness track. |
| `terrain.podzol` | Podzol | 16x16 | podzol_top.png | Rust-brown needle litter over dark soil, shaded forest floor. |
| `terrain.clay` | Clay | 16x16 | clay.png | Soft pale grey-blue paste, smooth riverbank deposit. |
| `terrain.moss` | Moss | 16x16 | moss_block.png | Deep verdant clumped green with dark pits, damp dungeon stone-cap. |
| `terrain.andesite` | Andesite | 16x16 | andesite.png | Speckled ash-grey stone, subtle salt-and-pepper mottle. |
| `terrain.terracotta` | Terracotta | 16x16 | terracotta.png | Muted clay-orange fired earth with faint banded striations. |
| `terrain.redterracotta` | Red terracotta | 16x16 | red_terracotta.png | Deep brick-red baked clay, earthy oxide tone. |
| `terrain.orangeterracotta` | Orange terracotta | 16x16 | orange_terracotta.png | Burnt-amber fired clay, warm kiln hue. |
| `terrain.whiteterracotta` | White terracotta | 16x16 | white_terracotta.png | Chalky off-white clay with grey wash, dusty adobe. |
| `terrain.plank.birch` | Birch plank floor | 16x16 | birch_planks.png | Pale creamy boards with faint grain, bright cabin flooring. |
| `terrain.plank.jungle` | Jungle plank floor | 16x16 | jungle_planks.png | Reddish-tan tropical boards with warm seam shading. |
| `terrain.plank.acacia` | Acacia plank floor | 16x16 | acacia_planks.png | Orange-toned savanna boards with knotty grain. |
| `terrain.plank.mangrove` | Mangrove plank floor | 16x16 | mangrove_planks.png | Deep rose-brown swamp boards, muted damp finish. |
| `terrain.plank.cherry` | Cherry plank floor | 16x16 | cherry_planks.png | Soft pink-blush boards, gentle pastel grain. |
| `terrain.plank.crimson` | Crimson plank floor | 16x16 | crimson_planks.png | Dusky maroon fungal boards, otherworldly nether tone. |
| `terrain.plank.warped` | Warped plank floor | 16x16 | warped_planks.png | Teal-cyan fungal boards, eerie muted underglow. |
| `terrain.plank.bamboo` | Bamboo plank floor | 16x16 | bamboo_planks.png | Pale straw stalks lashed tight, fine vertical striping. |
| `terrain.plank.paleoak` | Pale oak plank floor | 16x16 | pale_oak_planks.png | Bleached ash-blond boards, faint cool grain. |
| `terrain.diorite` | Diorite | 16x16 | diorite.png | Bright speckled white-grey stone, peppery mineral flecks. |
| `terrain.granite` | Granite | 16x16 | granite.png | Warm pink-grey mottled rock, coarse crystalline speckle. |
| `terrain.quartz` | Quartz | 16x16 | quartz_block_side.png | Clean creamy-white stone, smooth polished temple block. |
| `terrain.calcite` | Calcite | 16x16 | calcite.png | Pale bone-white chalky stone with faint powdery grain. |
| `terrain.basalt` | Basalt | 16x16 | basalt_side.png | Dark slate-grey columnar stone with vertical ridges. |
| `terrain.netherbrick` | Nether brick | 16x16 | nether_bricks.png | Dim oxblood-brown brickwork with charred infernal mortar. |
| `terrain.prismarine` | Prismarine | 16x16 | prismarine.png | Muted teal-green sea stone with mottled aqua veins. |
| `terrain.darkprismarine` | Dark prismarine | 16x16 | dark_prismarine.png | Deep sea-green slab, dark mossy underwater tone. |
| `terrain.purpur` | Purpur | 16x16 | purpur_block.png | Dusty lilac-purple stone with faint pored texture, end-temple block. |
| `terrain.endstone` | End stone | 16x16 | end_stone.png | Pale sallow yellow-white stone with cratered alien pallor. |
| `terrain.blackstone` | Blackstone | 16x16 | blackstone.png | Near-black charcoal stone with faint grey speckle. |
| `terrain.deepslate` | Deepslate | 16x16 | deepslate.png | Cold dark blue-grey slate, tight banded striations, deep mine stone. |
| `terrain.drygrass` | Dry grass | 16x16 | grass_block_top.png +tint #bfb755 | Sun-parched khaki-gold turf, brittle scrub tone. |

### liquid (1)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `terrain.water` | Water | 16x16 | water_still.png +tint #3f76c9 | Flat cobalt-blue tile with two-tone lapping highlights, no shimmer, old-school river. |

### tree/foliage (27)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `resource.tree.birch.side` | Birch log (side) | 16x16 | birch_log.png | Pale silver bark with dark eye-knots, slender birch trunk for woodcutting. |
| `resource.tree.log.side` | Oak log (side) | 16x16 | oak_log.png | Warm brown bark with vertical furrows, sturdy oak trunk node. |
| `resource.tree.log.top` | Oak log (top) | 16x16 | oak_log_top.png | Concentric ring cross-section in tan heartwood, chopped stump face. |
| `resource.tree.stump.top` | Tree stump (top) | 16x16 | oak_log_top.png | Freshly cut ring-grain top with sappy pale core, felled woodcutting node. |
| `resource.tree.leaves` | Oak leaves | 16x16 | oak_leaves.png +tint #59ae30 | Clumped muted green canopy, chunky dark leaf pockets, blocky RS foliage. |
| `resource.tree.spruce.side` | Spruce log (side) | 16x16 | spruce_log.png | Dark ruddy-brown bark with deep vertical cracks, northern pine trunk. |
| `resource.tree.jungle.side` | Jungle log (side) | 16x16 | jungle_log.png | Olive-brown mottled bark, mossy tropical trunk. |
| `resource.tree.acacia.side` | Acacia log (side) | 16x16 | acacia_log.png | Grey-brown streaked bark, dry savanna trunk. |
| `resource.tree.darkoak.side` | Dark oak log (side) | 16x16 | dark_oak_log.png | Deep umber near-black bark, gnarled ancient trunk. |
| `resource.tree.blossom.side` | Blossom log (side) | 16x16 | cherry_log.png | Warm grey bark with rosy undertone, cherry-blossom trunk. |
| `resource.tree.birch.leaves` | Birch leaves | 16x16 | birch_leaves.png +tint #80a755 | Airy yellow-green canopy, light dappled leaf clusters. |
| `resource.tree.spruce.leaves` | Spruce leaves | 16x16 | spruce_leaves.png +tint #619961 | Dusky blue-green needles, dense shadowed boughs. |
| `resource.tree.jungle.leaves` | Jungle leaves | 16x16 | jungle_leaves.png +tint #48b518 | Vivid deep-green fronds, lush overgrown mass. |
| `resource.tree.acacia.leaves` | Acacia leaves | 16x16 | acacia_leaves.png +tint #a3a23c | Dry olive-gold sparse foliage, sun-faded savanna crown. |
| `resource.tree.darkoak.leaves` | Dark oak leaves | 16x16 | dark_oak_leaves.png +tint #4e7a28 | Heavy shadowed forest-green canopy, brooding dense boughs. |
| `resource.tree.blossom.leaves` | Blossom leaves | 16x16 | cherry_leaves.png | Soft pink petal clusters with gentle bloom, ships pre-coloured (no tint). |
| `sprite.bush.berry.full` | Berry bush (full) | 16x16 | sweet_berry_bush_stage3.png | Tangled green bush dotted with red berries, cross-sprite shrub. |
| `sprite.bush.berry.bare` | Berry bush (bare) | 16x16 | sweet_berry_bush_stage1.png | Sparse leafless twig sprig, freshly picked bush. |
| `sprite.crop.wheat.full` | Wheat crop (ripe) | 16x16 | wheat_stage7.png | Golden ripe grain stalks heavy with heads, farm row sprite. |
| `sprite.crop.wheat.sprout` | Wheat crop (sprout) | 16x16 | wheat_stage2.png | Short green seedling blades, freshly sown furrow. |
| `sprite.herb.full` | Herb (full) | 16x16 | fern.png +tint #59ae30 | Leafy green fern frond, wild herb-gathering sprite. |
| `sprite.herb.bare` | Herb (bare) | 16x16 | dead_bush.png | Brittle brown dead twig-bush, withered scrub. |
| `sprite.flowers.wild` | Wild flowers | 16x16 | oxeye_daisy.png | White-petal daisy with a gold centre on a green stem. |
| `sprite.reeds` | Reeds | 16x16 | sugar_cane.png +tint #87b25a | Tall pale-green cane stalks, riverbank reed cluster. |
| `sprite.grass.tuft` | Grass tuft | 16x16 | short_grass.png +tint #79b855 | Small ragged green blade cluster, meadow sprig. |
| `icon.log` | Log (icon) | 16x16 | oak_log.png | Short bark-wrapped log with ringed ends, woodcutting yield icon. |
| `icon.plank` | Plank (icon) | 16x16 | oak_planks.png | Sawn oak board with seam lines, sawmill product icon. |

### rock/ore (20)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `resource.rock.stone` | Stone rock | 16x16 | stone.png | Grey boulder node with chunky facets, plain mining rock. |
| `resource.rock.copper` | Copper rock | 16x16 | copper_ore.png | Grey stone laced with teal-orange copper veins, mining node. |
| `resource.rock.tin` | Tin rock | 16x16 | iron_ore.png | Grey rock with pale metallic flecks (borrows iron ore art), tin node. |
| `resource.rock.iron` | Iron rock | 16x16 | iron_ore.png | Grey stone streaked with rusty tan iron ore, mining node. |
| `resource.rock.coal` | Coal rock | 16x16 | coal_ore.png | Grey rock studded with jet-black coal chunks. |
| `resource.rock.gold` | Gold rock | 16x16 | gold_ore.png | Grey stone glinting with warm gold nuggets, rune-worthy sparkle. |
| `resource.rock.diamond` | Diamond rock | 16x16 | diamond_ore.png | Grey rock set with icy pale-cyan gem facets. |
| `icon.bar.iron` | Iron bar (icon) | 16x16 | iron_ingot.png | Stubby grey metal ingot with dull forge-sheen, inventory bar. |
| `icon.bar.gold` | Gold bar (icon) | 16x16 | gold_ingot.png | Gleaming yellow ingot with a warm rune-gold highlight. |
| `icon.bar.copper` | Copper bar (icon) | 16x16 | copper_ingot.png | Ruddy-orange ingot with a soft metallic sheen. |
| `icon.bar.tin` | Tin bar (icon) | 16x16 | iron_ingot.png +tint #dfe6ea | Pale silvery-white ingot, cool dull tin (tinted iron art). |
| `icon.bar.bronze` | Bronze bar (icon) | 16x16 | copper_ingot.png +tint #d9a05a | Warm tan-bronze ingot with a muted alloy glow (tinted copper art). |
| `icon.ore.iron` | Iron ore (icon) | 16x16 | raw_iron.png | Lumpy grey-brown raw ore chunk, flecked and craggy. |
| `icon.ore.gold` | Gold ore (icon) | 16x16 | raw_gold.png | Rough nugget clump glinting gold in grey stone. |
| `icon.ore.copper` | Copper ore (icon) | 16x16 | raw_copper.png | Craggy teal-and-orange raw copper lump. |
| `icon.ore.tin` | Tin ore (icon) | 16x16 | raw_iron.png +tint #e3e9ee | Pale silvery raw ore chunk with a cool wash (tinted iron art). |
| `icon.ore.coal` | Coal (icon) | 16x16 | coal.png | Jet-black jagged lump with faint facet glints. |
| `icon.gem.diamond` | Diamond (icon) | 16x16 | diamond.png | Faceted pale-cyan gem with a bright rune-sparkle. |
| `icon.stone` | Stone (icon) | 16x16 | cobblestone.png | Chunky grey cobble lump, rough rubble icon. |
| `icon.brick` | Brick (icon) | 16x16 | brick.png | Single fired clay-red brick with a mortared edge. |

### roof (3)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `roof.shingle` | Roof shingle | 16x16 | spruce_planks.png | Weathered grey-brown timber shingles overlapping in rows, cottage roof. |
| `roof.darkoak` | Dark oak roof | 16x16 | dark_oak_planks.png | Deep espresso-brown boards, heavy manor roofing planks. |
| `roof.slate` | Slate roof | 16x16 | deepslate_tiles.png | Cool grey tiled slate, neat mortared keep roofing. |

### prop-surface (85)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `block.glass` | Glass | 16x16 | glass.png | Pale translucent pane with a thin bright frame, faint blue tint. |
| `block.tintedglass` | Tinted glass | 16x16 | tinted_glass.png | Smoky dark-grey pane, dim shaded glass block. |
| `wall.plaster` | Plaster wall | 16x16 | white_terracotta.png | Chalky off-white rendered wall with faint trowel mottle, cottage interior. |
| `resource.digsite.face` | Digsite face | 16x16 | rooted_dirt.png | Packed brown earth threaded with pale roots, archaeology dig wall. |
| `object.workbench.top` | Workbench (top) | 16x16 | crafting_table_top.png | Worn wood surface with carved tool grooves and a grid, crafting bench. |
| `object.workbench.side` | Workbench (side) | 16x16 | crafting_table_front.png | Timber cabinet face hung with saw and tools, crafting station. |
| `object.pumpkin.side` | Pumpkin (side) | 16x16 | pumpkin_side.png | Ribbed orange gourd with vertical shading grooves. |
| `object.pumpkin.top` | Pumpkin (top) | 16x16 | pumpkin_top.png | Orange crown with knobbly brown stem and ringed ridges. |
| `object.melon.side` | Melon (side) | 16x16 | melon_side.png | Green rind with pale mottled stripes, ripe gourd. |
| `object.melon.top` | Melon (top) | 16x16 | melon_top.png | Dark-green striped crown, speckled melon top. |
| `object.barrel.side` | Barrel (side) | 16x16 | barrel_side.png | Staved oak cask bound with dark iron hoops, tavern barrel. |
| `object.barrel.top` | Barrel (top) | 16x16 | barrel_top.png | Planked lid with an iron ring, ale-cellar cask top. |
| `object.cauldron.side` | Cauldron (side) | 16x16 | cauldron_side.png | Dark riveted iron pot wall, witch's brewing cauldron. |
| `object.haybale.side` | Hay bale (side) | 16x16 | hay_block_side.png | Bound golden straw bundle with rope ties. |
| `object.haybale.top` | Hay bale (top) | 16x16 | hay_block_top.png | Coiled straw end knot, sun-dried gold. |
| `object.door.top` | Door (top) | 16x16 | oak_door_top.png | Upper oak plank panel with iron studs and a small window. |
| `object.door.bottom` | Door (bottom) | 16x16 | oak_door_bottom.png | Lower oak plank panel with iron hinge and round handle. |
| `object.lantern.sheet` | Lantern | 16x16 | lantern.png | Iron-caged lantern with a warm amber glow-core, adventurer's light (from block sheet). |
| `object.furnace.side` | Furnace (side) | 16x16 | furnace_side.png | Grey stone block with a riveted band, smelting furnace wall. |
| `object.furnace.front` | Furnace (front) | 16x16 | furnace_front.png | Stone face with a dark iron grate maw, cold forge mouth. |
| `block.wool.white` | White wool | 16x16 | white_wool.png | Soft off-white fleece weave, chunky matte dye-block, muted RS palette. |
| `block.wool.orange` | Orange wool | 16x16 | orange_wool.png | Warm amber-orange fleece weave, chunky matte dye-block. |
| `block.wool.magenta` | Magenta wool | 16x16 | magenta_wool.png | Dusky pink-magenta fleece weave, chunky matte dye-block. |
| `block.wool.light_blue` | Light blue wool | 16x16 | light_blue_wool.png | Pale sky-blue fleece weave, chunky matte dye-block. |
| `block.wool.yellow` | Yellow wool | 16x16 | yellow_wool.png | Mellow gold-yellow fleece weave, chunky matte dye-block with a hint of rune-gold. |
| `block.wool.lime` | Lime wool | 16x16 | lime_wool.png | Bright yellow-green fleece weave, chunky matte dye-block. |
| `block.wool.pink` | Pink wool | 16x16 | pink_wool.png | Soft rose-pink fleece weave, chunky matte dye-block. |
| `block.wool.gray` | Gray wool | 16x16 | gray_wool.png | Deep slate-grey fleece weave, chunky matte dye-block. |
| `block.wool.light_gray` | Light gray wool | 16x16 | light_gray_wool.png | Pale ash-grey fleece weave, chunky matte dye-block. |
| `block.wool.cyan` | Cyan wool | 16x16 | cyan_wool.png | Muted teal-cyan fleece weave, chunky matte dye-block. |
| `block.wool.purple` | Purple wool | 16x16 | purple_wool.png | Royal muted-purple fleece weave, chunky matte dye-block. |
| `block.wool.blue` | Blue wool | 16x16 | blue_wool.png | Deep navy-blue fleece weave, chunky matte dye-block. |
| `block.wool.brown` | Brown wool | 16x16 | brown_wool.png | Earthy cocoa-brown fleece weave, chunky matte dye-block. |
| `block.wool.green` | Green wool | 16x16 | green_wool.png | Dark forest-green fleece weave, chunky matte dye-block. |
| `block.wool.red` | Red wool | 16x16 | red_wool.png | Deep brick-red fleece weave, chunky matte dye-block. |
| `block.wool.black` | Black wool | 16x16 | black_wool.png | Near-black charcoal fleece weave, chunky matte dye-block. |
| `block.concrete.white` | White concrete | 16x16 | white_concrete.png | Flat off-white slab, smooth matte finish, bold building block. |
| `block.concrete.orange` | Orange concrete | 16x16 | orange_concrete.png | Flat warm-orange slab, smooth matte finish, bold building block. |
| `block.concrete.magenta` | Magenta concrete | 16x16 | magenta_concrete.png | Flat dusky-magenta slab, smooth matte finish, bold building block. |
| `block.concrete.light_blue` | Light blue concrete | 16x16 | light_blue_concrete.png | Flat pale sky-blue slab, smooth matte finish, bold building block. |
| `block.concrete.yellow` | Yellow concrete | 16x16 | yellow_concrete.png | Flat gold-yellow slab, smooth matte finish, bold building block. |
| `block.concrete.lime` | Lime concrete | 16x16 | lime_concrete.png | Flat yellow-green slab, smooth matte finish, bold building block. |
| `block.concrete.pink` | Pink concrete | 16x16 | pink_concrete.png | Flat rose-pink slab, smooth matte finish, bold building block. |
| `block.concrete.gray` | Gray concrete | 16x16 | gray_concrete.png | Flat slate-grey slab, smooth matte finish, bold building block. |
| `block.concrete.light_gray` | Light gray concrete | 16x16 | light_gray_concrete.png | Flat ash-grey slab, smooth matte finish, bold building block. |
| `block.concrete.cyan` | Cyan concrete | 16x16 | cyan_concrete.png | Flat muted-teal slab, smooth matte finish, bold building block. |
| `block.concrete.purple` | Purple concrete | 16x16 | purple_concrete.png | Flat royal-purple slab, smooth matte finish, bold building block. |
| `block.concrete.blue` | Blue concrete | 16x16 | blue_concrete.png | Flat navy-blue slab, smooth matte finish, bold building block. |
| `block.concrete.brown` | Brown concrete | 16x16 | brown_concrete.png | Flat cocoa-brown slab, smooth matte finish, bold building block. |
| `block.concrete.green` | Green concrete | 16x16 | green_concrete.png | Flat forest-green slab, smooth matte finish, bold building block. |
| `block.concrete.red` | Red concrete | 16x16 | red_concrete.png | Flat brick-red slab, smooth matte finish, bold building block. |
| `block.concrete.black` | Black concrete | 16x16 | black_concrete.png | Flat charcoal-black slab, smooth matte finish, bold building block. |
| `block.terracotta.white` | White terracotta (dyed) | 16x16 | white_terracotta.png | Chalky white-glazed fired clay, dusty kiln tone. |
| `block.terracotta.orange` | Orange terracotta (dyed) | 16x16 | orange_terracotta.png | Earthy orange-glazed fired clay, dusty kiln tone. |
| `block.terracotta.magenta` | Magenta terracotta (dyed) | 16x16 | magenta_terracotta.png | Muted magenta-glazed fired clay, dusty kiln tone. |
| `block.terracotta.light_blue` | Light blue terracotta (dyed) | 16x16 | light_blue_terracotta.png | Soft pale-blue-glazed fired clay, dusty kiln tone. |
| `block.terracotta.yellow` | Yellow terracotta (dyed) | 16x16 | yellow_terracotta.png | Ochre-yellow-glazed fired clay, dusty kiln tone. |
| `block.terracotta.lime` | Lime terracotta (dyed) | 16x16 | lime_terracotta.png | Olive-lime-glazed fired clay, dusty kiln tone. |
| `block.terracotta.pink` | Pink terracotta (dyed) | 16x16 | pink_terracotta.png | Dusty rose-glazed fired clay, dusty kiln tone. |
| `block.terracotta.gray` | Gray terracotta (dyed) | 16x16 | gray_terracotta.png | Slate-grey-glazed fired clay, dusty kiln tone. |
| `block.terracotta.light_gray` | Light gray terracotta (dyed) | 16x16 | light_gray_terracotta.png | Ash-grey-glazed fired clay, dusty kiln tone. |
| `block.terracotta.cyan` | Cyan terracotta (dyed) | 16x16 | cyan_terracotta.png | Muted teal-glazed fired clay, dusty kiln tone. |
| `block.terracotta.purple` | Purple terracotta (dyed) | 16x16 | purple_terracotta.png | Dusty purple-glazed fired clay, dusty kiln tone. |
| `block.terracotta.blue` | Blue terracotta (dyed) | 16x16 | blue_terracotta.png | Muted navy-glazed fired clay, dusty kiln tone. |
| `block.terracotta.brown` | Brown terracotta (dyed) | 16x16 | brown_terracotta.png | Deep cocoa-glazed fired clay, dusty kiln tone. |
| `block.terracotta.green` | Green terracotta (dyed) | 16x16 | green_terracotta.png | Olive-green-glazed fired clay, dusty kiln tone. |
| `block.terracotta.red` | Red terracotta (dyed) | 16x16 | red_terracotta.png | Brick-red-glazed fired clay, dusty kiln tone. |
| `block.terracotta.black` | Black terracotta (dyed) | 16x16 | black_terracotta.png | Charcoal-glazed fired clay, dusty kiln tone. |
| `block.terracotta.plain` | Plain terracotta | 16x16 | terracotta.png | Muted clay-orange fired earth block with faint banded striations, undyed. |
| `block.stained_glass.white` | White stained glass | 16x16 | white_stained_glass.png | Translucent frosted-white pane with a bright leaded frame. |
| `block.stained_glass.orange` | Orange stained glass | 16x16 | orange_stained_glass.png | Translucent amber-orange pane with a bright leaded frame, warm cast light. |
| `block.stained_glass.magenta` | Magenta stained glass | 16x16 | magenta_stained_glass.png | Translucent magenta pane with a bright leaded frame. |
| `block.stained_glass.light_blue` | Light blue stained glass | 16x16 | light_blue_stained_glass.png | Translucent pale-blue pane with a bright leaded frame. |
| `block.stained_glass.yellow` | Yellow stained glass | 16x16 | yellow_stained_glass.png | Translucent gold-yellow pane with a bright leaded frame, rune-gold glow. |
| `block.stained_glass.lime` | Lime stained glass | 16x16 | lime_stained_glass.png | Translucent yellow-green pane with a bright leaded frame. |
| `block.stained_glass.pink` | Pink stained glass | 16x16 | pink_stained_glass.png | Translucent rose-pink pane with a bright leaded frame. |
| `block.stained_glass.gray` | Gray stained glass | 16x16 | gray_stained_glass.png | Translucent slate-grey pane with a bright leaded frame, smoky light. |
| `block.stained_glass.light_gray` | Light gray stained glass | 16x16 | light_gray_stained_glass.png | Translucent ash-grey pane with a bright leaded frame. |
| `block.stained_glass.cyan` | Cyan stained glass | 16x16 | cyan_stained_glass.png | Translucent teal-cyan pane with a bright leaded frame. |
| `block.stained_glass.purple` | Purple stained glass | 16x16 | purple_stained_glass.png | Translucent royal-purple pane with a bright leaded frame. |
| `block.stained_glass.blue` | Blue stained glass | 16x16 | blue_stained_glass.png | Translucent deep-blue pane with a bright leaded frame. |
| `block.stained_glass.brown` | Brown stained glass | 16x16 | brown_stained_glass.png | Translucent cocoa-brown pane with a bright leaded frame. |
| `block.stained_glass.green` | Green stained glass | 16x16 | green_stained_glass.png | Translucent forest-green pane with a bright leaded frame. |
| `block.stained_glass.red` | Red stained glass | 16x16 | red_stained_glass.png | Translucent ruby-red pane with a bright leaded frame, warm cast light. |
| `block.stained_glass.black` | Black stained glass | 16x16 | black_stained_glass.png | Translucent smoky-black pane with a bright leaded frame. |

### misc (46)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `sprite.flame` | Flame | 16x16 | fire_0.png | Flickering orange-yellow flame tongues, chunky campfire sprite (first fire frame). |
| `sprite.item.axe` | Axe (held) | 16x16 | iron_axe.png | Grey iron axe head on a stubby wood haft, woodcutting tool sprite. |
| `sprite.item.pickaxe` | Pickaxe (held) | 16x16 | iron_pickaxe.png | Iron pick head on a timber shaft, mining tool sprite. |
| `sprite.item.sword` | Sword (held) | 16x16 | iron_sword.png | Straight grey iron blade with a brown grip, adventurer's sword. |
| `sprite.item.rod` | Fishing rod (held) | 16x16 | fishing_rod.png | Slender wood rod with a taut line, angler's tool sprite. |
| `sprite.item.hammer` | Hammer (held) | 16x16 | none (empty files; built-in art kept) | Blocky iron mallet head on a stout haft, smithing hammer; no vanilla source, keep the built-in sprite. |
| `icon.fish.raw` | Raw fish (icon) | 16x16 | cod.png | Pale grey-blue raw fish, limp fresh catch. |
| `icon.fish.cooked` | Cooked fish (icon) | 16x16 | cooked_cod.png | Golden-browned grilled fish with crispy edges. |
| `icon.fish.fancy` | Fancy fish (icon) | 16x16 | salmon.png | Pink-fleshed raw salmon with silvery skin. |
| `icon.fish.fancy.cooked` | Cooked fancy fish (icon) | 16x16 | cooked_salmon.png | Seared salmon fillet with a warm charred glaze. |
| `icon.berries` | Berries (icon) | 16x16 | sweet_berries.png | Cluster of glossy red berries, foraged handful. |
| `icon.bread` | Bread (icon) | 16x16 | bread.png | Golden baked loaf with rounded crust ridges. |
| `icon.wheat` | Wheat (icon) | 16x16 | wheat.png | Bundled golden grain sheaf of harvested stalks. |
| `icon.carrot` | Carrot (icon) | 16x16 | carrot.png | Bright orange root with a green leafy top. |
| `icon.potato` | Potato (icon) | 16x16 | potato.png | Lumpy tan spud with shadowed eyes. |
| `icon.potato.baked` | Baked potato (icon) | 16x16 | baked_potato.png | Split roasted potato, warm golden inside. |
| `icon.melon` | Melon slice (icon) | 16x16 | melon_slice.png | Red wedge with green rind and dark seeds. |
| `icon.beef.raw` | Raw beef (icon) | 16x16 | beef.png | Marbled red raw steak cut. |
| `icon.beef.cooked` | Cooked beef (icon) | 16x16 | cooked_beef.png | Seared brown steak with grill marks. |
| `icon.pork.raw` | Raw pork (icon) | 16x16 | porkchop.png | Pink raw chop with a pale fat rim. |
| `icon.pork.cooked` | Cooked pork (icon) | 16x16 | cooked_porkchop.png | Golden-browned chop with a crisp fat edge. |
| `icon.chicken.raw` | Raw chicken (icon) | 16x16 | chicken.png | Pale pink raw drumstick. |
| `icon.chicken.cooked` | Cooked chicken (icon) | 16x16 | cooked_chicken.png | Roasted golden drumstick with crispy skin. |
| `icon.mutton.raw` | Raw mutton (icon) | 16x16 | mutton.png | Dark-red raw mutton cut. |
| `icon.mutton.cooked` | Cooked mutton (icon) | 16x16 | cooked_mutton.png | Browned grilled mutton slab. |
| `icon.rabbit.cooked` | Cooked rabbit (icon) | 16x16 | cooked_rabbit.png | Roasted rabbit leg with a golden glaze. |
| `icon.rabbit.raw` | Raw rabbit (icon) | 16x16 | rabbit.png | Small pink raw rabbit cut. |
| `icon.bone` | Bone (icon) | 16x16 | bone.png | Pale off-white knobbed bone, prayer-training relic. |
| `icon.slime` | Slime (icon) | 16x16 | slime_ball.png | Translucent lime-green gel blob, wobbly ooze. |
| `icon.venom` | Venom (icon) | 16x16 | spider_eye.png | Dark crimson eye orb oozing sickly green, poison drop. |
| `icon.leather` | Leather (icon) | 16x16 | leather.png | Tan cured hide swatch with soft tanned edges. |
| `icon.hide.wolf` | Wolf hide (icon) | 16x16 | rabbit_hide.png +tint #9b9186 | Grey-brown pelt scrap with a coarse fur wash (tinted rabbit hide). |
| `icon.feather` | Feather (icon) | 16x16 | feather.png | Single white quill feather with a faint grey vane. |
| `icon.coin` | Coin (icon) | 16x16 | gold_nugget.png | Small round gold coin with a rune-stamp glint, currency piece. |
| `icon.wool` | Wool (icon) | 16x16 | string.png +tint #eceff1 | Fluffy off-white fibre wad, soft spun tuft (tinted string). |
| `icon.rope` | Rope (icon) | 16x16 | string.png +tint #c9a86a | Coiled tan braided cord, sturdy hemp rope (tinted string). |
| `icon.egg` | Egg (icon) | 16x16 | egg.png | Pale speckled egg with a smooth cream shell. |
| `icon.seeds` | Seeds (icon) | 16x16 | wheat_seeds.png | Scatter of small brown-green seeds, a sowing pinch. |
| `icon.helmet.leather` | Leather helmet (icon) | 16x16 | leather_helmet.png | Simple tan leather cap with a stitched brim. |
| `icon.chest.leather` | Leather chestplate (icon) | 16x16 | leather_chestplate.png | Tan leather jerkin with lace ties. |
| `icon.legs.leather` | Leather leggings (icon) | 16x16 | leather_leggings.png | Tan hide leg guards with worn creases. |
| `icon.boots.leather` | Leather boots (icon) | 16x16 | leather_boots.png | Short tan leather boots with scuffed toes. |
| `icon.helmet.iron` | Iron helmet (icon) | 16x16 | iron_helmet.png | Grey riveted iron helm with a nasal guard. |
| `icon.chest.iron` | Iron chestplate (icon) | 16x16 | iron_chestplate.png | Grey plated iron cuirass with a dull steel sheen. |
| `icon.legs.iron` | Iron leggings (icon) | 16x16 | iron_leggings.png | Grey banded iron greaves. |
| `icon.boots.iron` | Iron boots (icon) | 16x16 | iron_boots.png | Heavy grey iron sabatons with riveted plates. |

---

## 2. Entity & character skins (box-UV)

> 69 distinct entity/character skin sheets across two render paths. PATH A — BetaSharp bbmodels baked with Faithful vanilla skins (renderer.ts MOB_VIEW_MODEL ~L3924, early-returns from buildEnemyBody): cow, pig, sheep, chicken, mooshroom, creeper, zombie, skeleton, squid, slimebody, ghast, pillager, vindicator, evoker, illusioner, witch, ravager, drowned, stray, armadillo, bat, allay, sniffer, bee, warden. PATH B — procedural box-UV rigs skinned via ENEMY_SKINS (entities.ts ENTITY_TEXTURES): wolf, spider, cave_spider, slime, zombie, husk. Wolf & spider HAVE bbmodels but they bake a lying-down/splayed pose (no stand-up keyframes) so they deliberately fall through to Path B and UV-map the same Faithful sheets. Dragons take their own path (fire/ice/hydra/two_headed, 256x256, NightBeam pack). 61 EnemyDefs collapse onto ~30 sheets because regional variants are color-multiply TINTS on a shared sheet (frost/dire/timber wolf, grave/hollow/spore/mire/dune husk, bog/silt/blight slime, etc.), not new art. NOT sheets: construct view (6 enemies incl. moss_golem, stone_sentinel, liftworks_overseer) and dummy view (Straw Target) are procedurally painted with no texture; ash_hound (wolf) & glacial_wight (husk) lack ENEMY_SKINS entries so render painted+tinted only. Player/NPC skins are all PROCEDURAL 64x64 player-layout canvases drawn in skin.ts: defaultHeroSkin (hero), villagerSkin (3 townsfolk palettes), wardenSkin (Grove Warden / Alder NPC), and tutorSkin driven by TUTOR_PALETTES — 30 skill-tutor masters (tutorial-island.ts) + guide + gatekeeper. PIG-SNOUT ISSUE: the pig snout is a separate 4x3x1 protruding cube UV-mapped to region (16,16) on the pig sheet (renderer.ts L4112); it only appears on the procedural fallback rig (default pig uses mob.pig bbmodel), and any RS reskin must carve/keep that snout patch or it falls back to flat #d9838f pink. DRAGON-WINGS ISSUE: dragon wings are large membrane elements on the licensed 256x256 NightBeam atlases animated ONLY by each model's baked 'idle' keyframe clip (renderer.ts L4025-4033) — the generic /wing/ bone-flap loop used for bee/bat/allay does NOT drive them, and multi-wing/multi-head rigs (hydra, two_headed) can't be reskinned by a vanilla-layout swap; the whole 256px sheet incl. wing membranes must be repainted. EXCLUDED/LATENT: entity.chest (prop atlas, not a mob); baked mob.villager/iron_golem/wandering_trader/slimecube (present in mob-models-data.ts, no NPC or enemy references them); TUTOR_PALETTES strongarm/guardian/healer (defined, zero NPC uses).

### livestock (6)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `entity.cow` | Cow | 64x64 box-UV (classic 64x32 layout) | vanilla entity/cow/temperate_cow.png (Faithful; mob.cow bbmodel) | Chunky cel-shaded Lumbridge dairy cow: flat warm-brown/cream patches, hard black outline, no photo-noise; RS3-style soft AO on the belly. |
| `entity.pig` | Pig | 64x64 box-UV (classic 64x32 layout) | vanilla entity/pig/temperate_pig.png (Faithful; mob.pig bbmodel) | Round pink OSRS farm pig; keep the (16,16) snout patch painted as a distinct darker muzzle so the protruding snout cube reads. See pig-snout issue. |
| `entity.sheep.skin` | Sheep (body/face) | 64x32 box-UV | vanilla entity/sheep/sheep.png (Faithful; mob.sheep bbmodel) | Bare skin-tone body with a stylised RS sheep face; flat shading, simple hoof caps. |
| `entity.sheep.wool` | Sheep (wool overlay) | 64x32 box-UV (overlay) | vanilla entity/sheep/sheep_wool.png (Faithful) | Separate fleece overlay, tintable — cloudy off-white wool with clumpy RS-style highlight blocks; recolour drives dyed variants. |
| `entity.chicken` | Chicken | 64x32 box-UV | vanilla entity/chicken/temperate_chicken.png (Faithful; mob.chicken bbmodel) | White RS barnyard hen, red wattle/comb, orange beak+legs; flat feathers, single highlight band. |
| `mob.mooshroom` | Mooshroom | 64x64 box-UV | vanilla entity/cow/red_mooshroom.png (Faithful; mob.mooshroom bbmodel) | Red cow-hide with painted RS toadstool caps; earthy fungal palette, storybook shading. |

### monster (8)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `entity.spider` | Spider | 64x32 box-UV (bbmodel 32x32; procedural rig maps 64-wide) | vanilla entity/spider/spider.png (Faithful; procedural rig, bbmodel lies down) | Menacing OSRS cave-spider silhouette: dark chitin, red cluster eyes, hairy leg segments as flat bristle rows. |
| `entity.cave_spider` | Cave Spider (Old Gnasher) | 64x32 box-UV | vanilla entity/spider/cave_spider.png (Faithful; procedural rig) | Blue-black venomous variant; teal accent stripes, brighter poison-green eyes; used by gnasher/gloom_spinner too. |
| `entity.wolf` | Wolf | 64x32 box-UV | vanilla entity/wolf/wolf.png (Faithful; procedural rig, bbmodel lies down) | Grey RS jackal/wolf; base grey tintable to frost-white / dire-charcoal / ash-rust; flat fur planes, snarling muzzle mask. |
| `entity.slime` | Slime | 64x32 box-UV | vanilla entity/slime/slime.png (Faithful; mob.slimebody bbmodel) | Translucent green gel cube with inner dark core dot; tintable to swamp/blight purples; RS gloopy specular blob. |
| `mob.creeper` | Creeper | 64x32 box-UV | vanilla entity/creeper/creeper.png (Faithful; mob.creeper bbmodel) | Mottled green camo reworked as an RS mossy husk; keep the iconic face but flatten the dithering into painted leaf-blotches. |
| `mob.ghast` | Ghast | 64x32 box-UV | vanilla entity/ghast/ghast.png (Faithful; mob.ghast bbmodel) | Ghostly floating RS wight-head; pale off-white body, downturned shadow face, wispy tentacle strips. |
| `mob.ravager` | Ravager | 128x128 box-UV | vanilla entity/illager/ravager.png (Faithful; mob.ravager bbmodel) | Hulking RS boss beast: grey hide, cracked horn plate, scarred saddle; heavy AO, dramatic rim light. |
| `mob.warden` | Warden (Deep-Dark boss) | 128x128 box-UV (+ bioluminescent/pulsating/heart overlays) | vanilla entity/warden/warden.png (CC BY-SA licensed rig) | Towering dark-blue sculk colossus; glowing cyan sensor ribs and chest-heart, RS-style emissive vein overlays. Distinct from the Grove Warden NPC skin. |

### illager (5)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `mob.pillager` | Pillager | 64x64 box-UV | vanilla entity/illager/pillager.png (Faithful; mob.pillager bbmodel) | Grey-green illager bandit as an RS brigand; leather jerkin, long nose profile flattened to a cartoon sneer. |
| `mob.vindicator` | Vindicator | 64x64 box-UV | vanilla entity/illager/vindicator.png (Faithful; mob.vindicator bbmodel) | Axe-wielding illager thug; darker teal tunic, crossed straps, grim RS mercenary face. |
| `mob.evoker` | Evoker | 64x64 box-UV | vanilla entity/illager/evoker.png (Faithful; mob.evoker bbmodel) | Gold-trimmed grey robe RS cultist-mage; layered vestments, glowing rune sash. |
| `mob.illusioner` | Illusioner | 64x64 box-UV | vanilla entity/illager/illusioner.png (Faithful; mob.illusioner bbmodel) | Blue-caped arcane illager; midnight robe with silver moons, RS enchanter mystique. |
| `mob.witch` | Witch | 64x128 box-UV | vanilla entity/witch/witch.png (Faithful; mob.witch bbmodel) | Hunched RS hag: warty green face, tall crooked purple hat, tattered mauve robe. |

### undead (5)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `entity.zombie` | Zombie | 64x64 box-UV | vanilla entity/zombie/zombie.png (Faithful; mob.zombie bbmodel + procedural husk views) | Rotting green RS zombie in torn brown rags; flat sickly skin, sunken black eye sockets; tintable to grave/hollow/spore/mire wights. |
| `entity.husk` | Husk | 64x64 box-UV | vanilla entity/zombie/husk.png (Faithful; procedural husk rig) | Desert-mummified undead; dry tan wrappings, cracked leathery skin, RS crypt palette; used by dune_husk. |
| `mob.skeleton` | Skeleton | 64x32 box-UV | vanilla entity/skeleton/skeleton.png (Faithful; mob.skeleton bbmodel) | Bleached bone RS undead archer; clean ivory highlights, hollow eye pits; tintable to barrow-lord bone-grey. |
| `mob.drowned` | Drowned | 64x64 box-UV | vanilla entity/zombie/drowned.png (Faithful; mob.drowned bbmodel) | Waterlogged teal-green zombie; kelp-draped, barnacle blotches, RS drowned-city murk. |
| `mob.stray` | Stray | 64x32 box-UV (+ stray_overlay) | vanilla entity/skeleton/stray.png (Faithful; mob.stray bbmodel) | Frostbitten skeleton with tattered ice-blue cloak overlay; icy rime on bones, RS wintry undead. |

### aquatic (1)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `mob.squid` | Squid | 64x32 box-UV | vanilla entity/squid/squid.png (Faithful; mob.squid bbmodel) | Deep-blue RS kraken-spawn; smooth mantle gradient, curling tentacle strips, single pale belly highlight. |

### dragon (4)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `fire_dragon` | Fire Dragon | 256x256 box-UV | NightBeam Dragons Pack (licensed, non-vanilla; keyframed bbmodel) | Classic OSRS red dragon: crimson scales, cream underbelly, tattered leather wings — repaint entire 256 atlas incl. wing membranes. See dragon-wings issue. |
| `ice_dragon` | Ice Dragon | 256x256 box-UV | NightBeam Dragons Pack (licensed, non-vanilla; keyframed bbmodel) | Frost-white/pale-cyan scales, glassy spines, translucent icy wing membranes; RS frozen-wyrm palette. |
| `hydra_dragon` | Hydra | 256x256 box-UV | NightBeam Dragons Pack (licensed, non-vanilla; keyframed bbmodel) | Multi-headed swamp hydra; venom-green scales, each head distinct — wings/heads can't be vanilla-swapped, full atlas repaint. See dragon-wings issue. |
| `two_headed_dragon` | Two-Headed Dragon | 256x256 box-UV | NightBeam Dragons Pack (licensed, non-vanilla; keyframed bbmodel) | Twin-necked RS dragon boss; mirrored heads, broad membrane wings driven only by baked idle clip. See dragon-wings issue. |

### insect/misc (5)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `mob.bee` | Bee | 64x64 box-UV | vanilla entity/bee/bee.png (Faithful; mob.bee bbmodel) | Fuzzy amber/black RS bee; flat stripe bands, tiny translucent wings, friendly rounded face. |
| `mob.allay` | Allay | 32x32 box-UV | vanilla entity/allay/allay.png (Faithful; mob.allay bbmodel) | Small glowing blue sprite/fairy; soft cyan body, wispy limbs, RS spirit-familiar bloom. |
| `mob.bat` | Bat | 32x32 box-UV | vanilla entity/bat/bat.png (Faithful; mob.bat bbmodel) | Small brown RS cave bat; leathery wing planes, pointed ears, single beady eye highlight. |
| `mob.sniffer` | Sniffer | 192x192 box-UV | vanilla entity/sniffer/sniffer.png (Faithful; mob.sniffer bbmodel) | Large lumbering ancient beast; mossy-red hide, drooping snout, RS prehistoric-grazer earth tones. |
| `mob.armadillo` | Armadillo | 64x64 box-UV | vanilla entity/armadillo/armadillo.png (Faithful; mob.armadillo bbmodel) | Armoured RS critter; banded shell plates with hard highlights, soft tan underbelly. |

### player (2)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `skin.player.hero` | Default Hero (player) | 64x64 player-layout | procedural (skin.ts defaultHeroSkin) | OSRS newcomer adventurer: rust tunic + belt, olive trousers, leather boots, dark hair — RuneScape starter-gear look, not any named character. Imported user skins reuse this same 64x64/64x32 layout. |
| `skin.villager` | Townsfolk / Villager (3 palettes) | 64x64 player-layout | procedural (skin.ts villagerSkin: storekeeper/fisher/villager) | Generic RS town NPCs: storekeeper apron, fisher blue, plain villager; muted burgher palette, simple tunic + fringe hair. |

### npc/tutor (33)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `tutor.lumberjack` | Woodcutting tutor (Lumberjack) | 64x64 player-layout | procedural (skin.ts tutorSkin, TUTOR_PALETTES.lumberjack) | Green flannel woodsman with red axe-emblem tabard; rugged RS forester. |
| `tutor.miner` | Mining tutor (Miner) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.miner; hat) | Brown overalls, gold hard-hat brim, dusty RS quarry palette. |
| `tutor.forager` | Foraging tutor (Forager) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.forager; hood) | Leaf-green hooded gatherer with pale foliage sash; woodland RS ranger-lite. |
| `tutor.angler` | Fishing tutor (Angler) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.angler; hat) | Blue oilskin fisher, straw sun-hat, cream apron; RS harbour dockhand. |
| `tutor.cook` | Cooking tutor (Cook) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.cook; hat) | White chef's whites + toque, maroon trousers; RS Lumbridge cook. |
| `tutor.smelter` | Smelting tutor (Smelter) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.smelter) | Soot-grey furnace worker with rust apron; heat-scorched RS foundry look. |
| `tutor.smith` | Smithing tutor (Smith) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.smith) | Brown leather-apron blacksmith, dark hair, steel-grey legs; classic RS anvil master. |
| `tutor.warrior` | Attack tutor (Warrior) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.warrior) | Red-tunic swordsman with steel-plate accent; RS combat instructor. |
| `tutor.farmer` | Farming tutor (Farmer) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.farmer; hat) | Green smock, straw hat, blue overalls; RS allotment farmer. |
| `tutor.herbalist` | Herblore tutor (Herbalist) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.herbalist; hood) | Sage-green hooded apothecary with leaf-green accent; RS herb-master. |
| `tutor.crafter` | Crafting tutor (Crafter) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.crafter) | Tan artisan tunic with cream tool-apron; RS craft-guild worker. |
| `tutor.scholar` | Archaeology tutor (Scholar) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.scholar) | Grey-haired academic in brown field-coat, parchment sash; RS antiquarian. |
| `tutor.ranger` | Archery tutor (Ranger) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.ranger; hood) | Lincoln-green hooded archer with leather bracer; RS Ranger / Robin-Hood cue. |
| `tutor.builder` | Construction tutor (Builder) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.builder; hat) | Orange hi-vis tunic, gold hard-hat, steel legs; RS construction foreman. |
| `tutor.brewer` | Brewing tutor (Brewer) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.brewer; hat) | Ruddy tavern brewer, leather cap, cream apron; RS ale-house keeper. |
| `tutor.enchanter` | Enchanting tutor (Enchanter) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.enchanter; hood) | Purple hooded mage with gold rune-accent; RS enchantment-altar keeper. |
| `tutor.hunter` | Hunting tutor (Hunter) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.hunter; hood) | Brown fur-trimmed trapper hood, tan leather; RS wilderness hunter. |
| `tutor.rogue` | Thieving tutor (Rogue) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.rogue; hood) | Near-black hooded thief, grey mask accent; RS Rogues'-Den cutpurse. |
| `tutor.freerunner` | Agility tutor (Freerunner) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.freerunner) | Teal athletic top, dark leggings, lime accent; RS agility-course trainer. |
| `tutor.slayer` | Slaying tutor (Slayer) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.slayer; hood) | Dark hooded slayer master, blood-red accent; grim RS Slayer-tower veteran. |
| `tutor.sailor` | Boating tutor (Sailor) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.sailor; hat) | Navy pea-coat, white sailor cap; RS Port Sarim seadog. |
| `tutor.firewarden` | Firemaking tutor (Firewarden) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.firewarden) | Ember-red tunic, orange flame accent, singed hair; RS pyre-keeper. |
| `tutor.priest` | Prayer tutor (Priest) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.priest; hood) | White monk robe, grey hair, gold holy accent; RS Saradomin cleric. |
| `tutor.runemaster` | Runecrafting tutor (Runemaster) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.runemaster; hood) | Violet hooded robe with cyan rune-glow accent; RS Rune-altar aurora-mage. |
| `tutor.fletcher` | Fletching tutor (Fletcher) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.fletcher) | Green-brown woodworker with leather accent; RS bow-maker. |
| `tutor.mage` | Magic tutor (Mage) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.mage; hood) | Deep-blue star-robe hood, gold trim; classic RS wizard (blue mage-robe archetype). |
| `tutor.delver` | Dungeoneering tutor (Delver) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.delver; hat) | Brown spelunker with lantern-gold accent and cap; RS Daemonheim delver. |
| `tutor.summoner` | Summoning tutor (Summoner) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.summoner; hood) | Teal-green mystic hood, spirit-green accent; RS familiar-summoner. |
| `tutor.necromancer` | Necromancy tutor (Necromancer) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.necromancer; hood) | Near-black death-robe, pale grey skin, sickly-green accent; RS City-of-Um necromancer. |
| `tutor.inventor` | Invention tutor (Inventor) | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.inventor; hat) | Brown tinker coat, steel goggle-cap, gold gadget accent; RS Invention-guild inventor. |
| `tutor.guide` | Tutorial Guide | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.guide) | Friendly green-tunic RuneScape Guide with gold trim; welcoming Tutorial-Island greeter. |
| `tutor.gatekeeper` | Gatekeeper | 64x64 player-layout | procedural (tutorSkin, TUTOR_PALETTES.gatekeeper) | Grey-haired blue-tabard sentry with steel-gold accent; RS city gate guard. |
| `skin.warden` | Grove Warden (Alder NPC) | 64x64 player-layout | procedural (skin.ts wardenSkin; instanceId vale.npc.alder) | Moss-green hooded robe, grey beard, gold clasp; wise RS druid/grove-keeper elder. NOT the Deep-Dark Warden boss (mob.warden) — separate humanoid skin. |

---

## 3. Item icons (16×16)

> Enumerated EVERY item icon in the Runecraft ITEMS record (src/content/content.ts lines 399-1697) cross-referenced against src/ui/icons.ts. NOTE: the brief said 289 items, but the ITEMS record actually holds 196 top-level entries (145 item.*, 35 tool.*, 16 armor.*); the extra id: matches elsewhere in the file are recipe/loot references, and functions like runeRecipes()/armorRecipes() only generate recipes, not items. All 196 are reported here. Icon resolution (itemIconUrl): a pack material from ITEM_ICON_MATERIALS wins when a pack provider is set, else the ITEM_DRAWS procedural canvas draw, else the emoji glyph. Source breakdown: 78 pack-material (of which 25 ALSO have a procedural-draw fallback), 24 procedural-draw only, 94 emoji-only. Every ITEM_DRAWS key (49) and ITEM_ICON_MATERIALS key (78) maps to a valid item id (no orphans). Note several materials are reused: all 10 logs -> icon.log; all 5 seeds -> icon.seeds; copper/bronze/iron boots all -> icon.boots.iron; the 5 'fancy' fish share icon.fish.fancy(.cooked); wolf pelt and fur share icon.hide.wolf. Group tally: ore/bar/gem 27, tool 22, herb/seed/crop 17, potion/rune/essence 17, coin/misc 17, armor 16, relic/treasure 15, weapon 13, fish 13, food-cooked 13, log/plank 11, food-raw 6, charm/pouch 6, ammo 3.

### log/plank (11)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.log.basic` | Oak Log | 16x16 icon | pack-material:icon.log | Short golden oak log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.spruce` | Spruce Log | 16x16 icon | pack-material:icon.log | Short reddish spruce log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.birch` | Birch Log | 16x16 icon | pack-material:icon.log | Short pale silvery birch log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.jungle` | Jungle Log | 16x16 icon | pack-material:icon.log | Short olive jungle log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.acacia` | Acacia Log | 16x16 icon | pack-material:icon.log | Short burnt-orange acacia log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.darkoak` | Dark Oak Log | 16x16 icon | pack-material:icon.log | Short deep dark-oak log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.blossom` | Blossomwood Log | 16x16 icon | pack-material:icon.log | Short pink blossomwood log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.ember` | Emberwood Log | 16x16 icon | pack-material:icon.log | Short ember-veined smouldering log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.glow` | Lanternwood Log | 16x16 icon | pack-material:icon.log | Short softly luminous lanternwood log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.log.dusk` | Duskglass Bough | 16x16 icon | pack-material:icon.log | Short translucent duskglass log, 3/4 view, growth rings on the cut end — RS woodcutting log icon |
| `item.plank.cut` | Cut Planks | 16x16 icon | pack-material:icon.plank | Stack of sawn planks, pale cut faces and grain lines — RS sawmill plank icon |

### tool (22)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `tool.axe.basic` | Worn Axe | 16x16 icon | procedural-draw | Chipped worn iron-grey axe head on a wooden haft, bevelled edge — classic RS woodcutting-axe pose |
| `tool.boat.raft` | Log Raft | 16x16 icon | emoji-only | Side-on lashed-log raft on a sliver of water — RS charter/boat travel icon |
| `tool.boat.rowboat` | Rowboat | 16x16 icon | emoji-only | Side-on little wooden rowboat with oars on a sliver of water — RS boat travel icon |
| `tool.boat.skiff` | Swift Skiff | 16x16 icon | emoji-only | Side-on sleek single-sail skiff on a sliver of water — RS boat travel icon |
| `tool.axe.copper` | Copper Axe | 16x16 icon | procedural-draw | Ruddy copper axe head on a wooden haft, bevelled edge — classic RS woodcutting-axe pose |
| `tool.pickaxe.basic` | Worn Pickaxe | 16x16 icon | procedural-draw | Chipped worn iron-grey pickaxe head on a haft, twin points, bright edge — RS mining-pick look |
| `tool.fishingrod.basic` | Bent Fishing Rod | 16x16 icon | procedural-draw | Slim diagonal rod with a fine line and tip guides — RS fishing-rod icon |
| `tool.axe.runed` | Runed Axe | 16x16 icon | emoji-only | Rune-etched glowing axe head on a wooden haft, bevelled edge — RS woodcutting-axe pose |
| `tool.pickaxe.runed` | Runed Pickaxe | 16x16 icon | emoji-only | Rune-etched glowing pickaxe head on a haft, twin points, bright edge — RS mining-pick look |
| `tool.hammer.basic` | Smithing Hammer | 16x16 icon | procedural-draw | Blocky steel hammer head on a wooden handle, top-face highlight — RS anvil-work tool |
| `tool.hoe.basic` | Garden Hoe | 16x16 icon | emoji-only | Angled hoe: flat blade on a long earthy-tan haft — RS farming tool |
| `tool.pickaxe.copper` | Copper Pickaxe | 16x16 icon | procedural-draw | Ruddy copper pickaxe head on a haft, twin points, bright edge — RS mining-pick look |
| `tool.pickaxe.netherite` | Netherite Pickaxe | 16x16 icon | emoji-only | Near-black netherite pickaxe head on a haft, twin points, bright edge — RS mining-pick look |
| `tool.axe.netherite` | Netherite Axe | 16x16 icon | emoji-only | Near-black netherite axe head on a wooden haft, bevelled edge — RS woodcutting-axe pose |
| `tool.axe.bronze` | Bronze Axe | 16x16 icon | procedural-draw | Warm bronze axe head on a wooden haft, bevelled edge — RS woodcutting-axe pose |
| `tool.pickaxe.bronze` | Bronze Pickaxe | 16x16 icon | procedural-draw | Warm bronze pickaxe head on a haft, twin points, bright edge — RS mining-pick look |
| `tool.axe.iron` | Iron Axe | 16x16 icon | procedural-draw | Cold steel-iron axe head on a wooden haft, bevelled edge — RS woodcutting-axe pose |
| `tool.pickaxe.iron` | Iron Pickaxe | 16x16 icon | procedural-draw | Cold steel-iron pickaxe head on a haft, twin points, bright edge — RS mining-pick look |
| `tool.axe.diamond` | Diamond-edged Axe | 16x16 icon | emoji-only | Cyan diamond-edged axe head on a wooden haft, bevelled edge — RS woodcutting-axe pose |
| `tool.pickaxe.diamond` | Diamond-tipped Pickaxe | 16x16 icon | emoji-only | Cyan diamond-tipped pickaxe head on a haft, twin points, bright edge — RS mining-pick look |
| `tool.trap.basic` | Rope Snare | 16x16 icon | emoji-only | Coiled rope snare loop pegged to the ground — RS hunter snare icon |
| `tool.trap.fine` | Fine Box Trap | 16x16 icon | emoji-only | Wooden box trap propped on a stick, bait beneath — RS hunter box-trap icon |

### weapon (13)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `tool.sword.copper` | Copper Sword | 16x16 icon | procedural-draw | Diagonal down-left ruddy copper blade, crossguard and wrapped hilt, edge highlight — RS attack-icon read |
| `tool.bow.wood` | Shortbow | 16x16 icon | emoji-only | Vertical C-curve plain-wood bow, taut string, subtle nock tips — RS ranged-weapon silhouette |
| `tool.bow.yew` | Yew Longbow | 16x16 icon | emoji-only | Vertical C-curve yew longbow, taut string, subtle nock tips — RS ranged-weapon silhouette |
| `tool.sword.runed` | Runed Sword | 16x16 icon | emoji-only | Diagonal down-left rune-etched glowing blade, crossguard and wrapped hilt — RS attack-icon read |
| `tool.bow.runed` | Runed Longbow | 16x16 icon | emoji-only | Vertical C-curve rune-etched glowing longbow, taut string — RS ranged-weapon silhouette |
| `tool.sword.bronze` | Bronze Sword | 16x16 icon | procedural-draw | Diagonal down-left warm bronze blade, crossguard and wrapped hilt — RS attack-icon read |
| `tool.sword.netherite` | Netherite Sword | 16x16 icon | emoji-only | Diagonal down-left near-black netherite blade, crossguard and wrapped hilt — RS attack-icon apex |
| `tool.sword.iron` | Iron Sword | 16x16 icon | procedural-draw | Diagonal down-left cold steel-iron blade, crossguard and wrapped hilt — RS attack-icon read |
| `tool.sword.diamond` | Diamond-edged Sword | 16x16 icon | emoji-only | Diagonal down-left cyan diamond-edged blade, crossguard and wrapped hilt — RS attack-icon read |
| `tool.bow.oak` | Oak Longbow | 16x16 icon | emoji-only | Vertical C-curve golden-oak longbow, taut string, subtle nock tips — RS ranged-weapon silhouette |
| `tool.bow.spruce` | Spruce Longbow | 16x16 icon | emoji-only | Vertical C-curve reddish-spruce longbow, taut string, subtle nock tips — RS ranged-weapon silhouette |
| `tool.bow.jungle` | Jungle Warbow | 16x16 icon | emoji-only | Vertical C-curve olive jungle warbow, taut string, subtle nock tips — RS ranged-weapon silhouette |
| `tool.bow.dark` | Duskbark Bow | 16x16 icon | emoji-only | Vertical C-curve deep dark-oak duskbark bow, taut string — RS ranged-weapon silhouette |

### ore/bar/gem (27)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.ore.copper` | Copper Ore | 16x16 icon | pack-material:icon.ore.copper | Grey rock chunk studded with orange copper nuggets — RS mining ore rock |
| `item.stone.rough` | Rough Stone | 16x16 icon | pack-material:icon.stone | Plain grey fieldstone, rounded and faceted — RS rough-stone icon |
| `item.bar.copper` | Copper Bar | 16x16 icon | pack-material:icon.bar.copper | Single cast ruddy copper bar, trapezoid with top sheen — RS smelted bar icon |
| `item.brick.stone` | Stone Brick | 16x16 icon | pack-material:icon.brick | Mortared grey stone brick block, chiselled faces — RS masonry brick |
| `item.ore.tin` | Tin Ore | 16x16 icon | pack-material:icon.ore.tin | Grey rock chunk studded with pale tin nuggets — RS mining ore rock |
| `item.bar.tin` | Tin Bar | 16x16 icon | pack-material:icon.bar.tin | Single cast pale-grey tin bar, trapezoid with top sheen — RS smelted bar icon |
| `item.bar.bronze` | Bronze Bar | 16x16 icon | pack-material:icon.bar.bronze | Single cast warm bronze bar, trapezoid with top sheen — RS smelted bar icon |
| `item.ore.iron` | Iron Ore | 16x16 icon | pack-material:icon.ore.iron | Grey rock chunk studded with rusty iron nuggets — RS mining ore rock |
| `item.ore.coal` | Coal | 16x16 icon | pack-material:icon.ore.coal | Grey rock chunk studded with black coal nuggets — RS mining ore rock |
| `item.ore.gold` | Gold Ore | 16x16 icon | pack-material:icon.ore.gold | Grey rock chunk studded with yellow gold nuggets — RS mining ore rock |
| `item.gem.diamond` | Diamond | 16x16 icon | pack-material:icon.gem.diamond | Faceted white diamond, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.bar.gold` | Gold Bar | 16x16 icon | pack-material:icon.bar.gold | Single cast bright gold bar, trapezoid with top sheen — RS smelted bar icon |
| `item.bar.iron` | Iron Bar | 16x16 icon | pack-material:icon.bar.iron | Single cast cold steel-iron bar, trapezoid with top sheen — RS smelted bar icon |
| `item.ore.redstone` | Redstone Dust | 16x16 icon | emoji-only | Grey rock chunk studded with glinting red redstone specks — RS mining ore rock |
| `item.gem.lapis` | Lapis Lazuli | 16x16 icon | emoji-only | Faceted deep-blue lapis, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.gem.emerald` | Emerald | 16x16 icon | emoji-only | Faceted green emerald, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.gem.quartz` | Nether Quartz | 16x16 icon | emoji-only | Faceted milky-white quartz, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.debris.ancient` | Ancient Debris | 16x16 icon | emoji-only | Rough ancient-debris lump, brown scorched ore — RS rare mining find |
| `item.scrap.netherite` | Netherite Scrap | 16x16 icon | emoji-only | Jagged netherite scrap, charred dark-metal fragment — RS smelting intermediate |
| `item.ingot.netherite` | Netherite Ingot | 16x16 icon | emoji-only | Dark netherite ingot, matte with a faint purple sheen — RS top-tier smithing bar |
| `item.gem.emberstone` | Emberstone | 16x16 icon | procedural-draw | Faceted fiery-orange emberstone, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.gem.opal` | Opal | 16x16 icon | emoji-only | Faceted iridescent pale opal, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.gem.jade` | Jade | 16x16 icon | emoji-only | Faceted green jade, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.gem.topaz` | Topaz | 16x16 icon | emoji-only | Faceted amber topaz, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.gem.sapphire` | Sapphire | 16x16 icon | emoji-only | Faceted blue sapphire, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.gem.ruby` | Ruby | 16x16 icon | emoji-only | Faceted red ruby, cut kite shape with a bright glint — RS gem-drop sparkle |
| `item.gem.dragonstone` | Dragonstone | 16x16 icon | emoji-only | Faceted purple dragonstone, cut kite shape with a bright glint — RS gem-drop sparkle |

### herb/seed/crop (17)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.berry.basic` | Thicket Berries | 16x16 icon | pack-material:icon.berries | Sprig of blue thicket berries on a green stem — RS foraged berries icon |
| `item.wheat` | Wheat Sheaf | 16x16 icon | pack-material:icon.wheat | Bundled golden wheat sheaf, tied stalks — RS grain icon |
| `item.pumpkin` | Pumpkin | 16x16 icon | emoji-only | Round ribbed orange pumpkin with a stub stem — RS pumpkin icon |
| `item.herb.sage` | Wild Sage | 16x16 icon | emoji-only | Sprig of grey-green wild sage, leaves fanned — RS grimy-herb icon |
| `item.spore.pale` | Pale Spores | 16x16 icon | emoji-only | Cluster of pale drifting spores/mushroom caps — RS foraged spores icon |
| `item.seed.wheat` | Wheat Seed | 16x16 icon | pack-material:icon.seeds | Little pinch of wheat seeds, tan specks in a cluster — RS farming seed icon (shared seed art) |
| `item.seed.carrot` | Carrot Seed | 16x16 icon | pack-material:icon.seeds | Little pinch of carrot seeds, tan specks in a cluster — RS farming seed icon (shared seed art) |
| `item.seed.pumpkin` | Pumpkin Seed | 16x16 icon | pack-material:icon.seeds | Little pinch of pumpkin seeds, tan specks in a cluster — RS farming seed icon (shared seed art) |
| `item.seed.potato` | Seed Potato | 16x16 icon | pack-material:icon.seeds | Little pinch of seed potatoes, tan specks in a cluster — RS farming seed icon (shared seed art) |
| `item.seed.melon` | Melon Seed | 16x16 icon | pack-material:icon.seeds | Little pinch of melon seeds, tan specks in a cluster — RS farming seed icon (shared seed art) |
| `item.carrot` | Carrot | 16x16 icon | pack-material:icon.carrot | Orange carrot with a green leafy top — RS allotment carrot icon |
| `item.crop.potato` | Potato | 16x16 icon | pack-material:icon.potato | Knobbly raw potato, earthy brown — RS harvested potato icon |
| `item.melon.slice` | Melon Slice | 16x16 icon | pack-material:icon.melon | Red melon wedge with green rind and seeds — RS melon-slice icon |
| `item.herb.frostbloom` | Frostbloom | 16x16 icon | emoji-only | Sprig of icy pale-blue frostbloom, leaves fanned — RS grimy-herb icon |
| `item.herb.duskcap` | Duskcap | 16x16 icon | emoji-only | Dusky purple duskcap toadstool, capped stem — RS grimy-herb icon |
| `item.herb.mint` | River Mint | 16x16 icon | emoji-only | Sprig of fresh green river mint, leaves fanned — RS grimy-herb icon |
| `item.herb.emberleaf` | Emberleaf | 16x16 icon | emoji-only | Sprig of rusty-red emberleaf, leaves fanned — RS grimy-herb icon |

### fish (13)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.fish.raw` | Raw Fish | 16x16 icon | pack-material:icon.fish.raw | Side-on raw fish, blue-grey scales, gill line and eye dot — RS raw-fish icon |
| `item.fish.cooked` | Cooked Fish | 16x16 icon | pack-material:icon.fish.cooked | Golden-cooked fish, warm crisped scales — RS cooked-fish icon |
| `item.fish.burnt` | Burnt Fish | 16x16 icon | procedural-draw | Charred blackened fish, curled and smoking — RS burnt-fish icon |
| `item.fish.eel` | Marsh Eel | 16x16 icon | pack-material:icon.fish.raw | Side-on raw dark marsh-green eel, gill line and eye dot — RS raw-fish icon (shares basic raw-fish art) |
| `item.eel.cooked` | Smoked Eel | 16x16 icon | pack-material:icon.fish.cooked | Smoked eel, warm crisped scales — RS cooked-fish icon (shares basic cooked-fish art) |
| `item.fish.icefin` | Icefin | 16x16 icon | pack-material:icon.fish.fancy | Side-on raw icefin, icy pale-blue scales, gill line and eye dot — RS fancy raw-fish icon |
| `item.icefin.cooked` | Seared Icefin | 16x16 icon | pack-material:icon.fish.fancy.cooked | Golden-seared icefin, warm crisped scales — RS fancy cooked-fish icon |
| `item.fish.trout` | River Trout | 16x16 icon | pack-material:icon.fish.fancy | Side-on raw trout, speckled brown scales, gill line and eye dot — RS fancy raw-fish icon |
| `item.trout.cooked` | Pan-fried Trout | 16x16 icon | pack-material:icon.fish.fancy.cooked | Golden pan-fried trout, warm crisped scales — RS fancy cooked-fish icon |
| `item.fish.seabass` | Sea Bass | 16x16 icon | pack-material:icon.fish.fancy | Side-on raw sea bass, silver scales, gill line and eye dot — RS fancy raw-fish icon |
| `item.seabass.cooked` | Roast Sea Bass | 16x16 icon | pack-material:icon.fish.fancy.cooked | Golden roast sea bass, warm crisped scales — RS fancy cooked-fish icon |
| `item.fish.sunscale` | Sunscale | 16x16 icon | pack-material:icon.fish.fancy | Side-on raw sunscale, golden scales, gill line and eye dot — RS fancy raw-fish icon |
| `item.sunscale.cooked` | Glazed Sunscale | 16x16 icon | pack-material:icon.fish.fancy.cooked | Golden glazed sunscale, warm crisped scales — RS fancy cooked-fish icon |

### food-cooked (13)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.bread.basic` | Fresh Bread | 16x16 icon | pack-material:icon.bread | Golden crusty loaf of bread with a soft top-sheen — RS bread icon |
| `item.pumpkin.roast` | Roast Pumpkin | 16x16 icon | emoji-only | Roasted pumpkin wedge, caramelised orange — RS cooked-pumpkin icon |
| `item.chicken.cooked` | Roast Chicken | 16x16 icon | pack-material:icon.chicken.cooked | Browned roasted chicken cut, glistening — RS cooked-meat icon |
| `item.chicken.burnt` | Burnt Chicken | 16x16 icon | emoji-only | Charred blackened chicken, smoking ruin — RS burnt-food icon |
| `item.mutton.cooked` | Roast Mutton | 16x16 icon | pack-material:icon.mutton.cooked | Browned roasted mutton cut, glistening — RS cooked-meat icon |
| `item.mutton.burnt` | Burnt Mutton | 16x16 icon | emoji-only | Charred blackened mutton, smoking ruin — RS burnt-food icon |
| `item.beef.cooked` | Cooked Beef | 16x16 icon | pack-material:icon.beef.cooked | Browned roasted beef cut, glistening — RS cooked-meat icon |
| `item.beef.burnt` | Charred Beef | 16x16 icon | procedural-draw | Charred blackened beef, smoking ruin — RS burnt-food icon |
| `item.pork.cooked` | Cooked Pork | 16x16 icon | pack-material:icon.pork.cooked | Browned roasted pork cut, glistening — RS cooked-meat icon |
| `item.pork.burnt` | Charred Pork | 16x16 icon | procedural-draw | Charred blackened pork, smoking ruin — RS burnt-food icon |
| `item.potato.baked` | Baked Potato | 16x16 icon | pack-material:icon.potato.baked | Split baked potato, fluffy steaming middle — RS baked-potato icon |
| `item.stew.carrot` | Carrot Stew | 16x16 icon | emoji-only | Bowl of orange carrot stew, steam curl rising — RS stew bowl icon |
| `item.rabbit.cooked` | Roast Rabbit | 16x16 icon | pack-material:icon.rabbit.cooked | Roasted rabbit haunch, golden-brown — RS cooked-game icon |

### potion/rune/essence (17)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.salve.healing` | Healing Salve | 16x16 icon | emoji-only | Small tub of pale healing salve, waxy sheen — RS salve pot icon |
| `item.potion.swift` | Swiftness Draught | 16x16 icon | emoji-only | Corked vial of sky-blue draught liquid, glass highlight — RS potion vial icon |
| `item.potion.strength` | Strength Tonic | 16x16 icon | emoji-only | Corked vial of red tonic liquid, glass highlight — RS potion vial icon |
| `item.potion.stoneskin` | Stoneskin Brew | 16x16 icon | emoji-only | Corked vial of grey brew liquid, glass highlight — RS potion vial icon |
| `item.potion.gathering` | Forager's Brew | 16x16 icon | emoji-only | Corked vial of green brew liquid, glass highlight — RS potion vial icon |
| `item.potion.focus` | Hunter's Focus | 16x16 icon | emoji-only | Corked vial of amber focus liquid, glass highlight — RS potion vial icon |
| `item.tonic.oakblood` | Oakblood Tonic | 16x16 icon | emoji-only | Round flask of dark oakblood tonic, warm red-brown — RS tonic flask icon |
| `item.essence.rune` | Arcane Essence | 16x16 icon | emoji-only | Chunk of raw arcane essence, faintly glowing pale stone — RS rune-essence icon |
| `item.rune.air` | Wind Rune | 16x16 icon | emoji-only | Rounded pale wind-blue rune stone stamped with an arcane glyph — RS runecrafting rune icon |
| `item.rune.water` | Prismarine Rune | 16x16 icon | emoji-only | Rounded teal prismarine rune stone stamped with an arcane glyph — RS runecrafting rune icon |
| `item.rune.earth` | Amethyst Rune | 16x16 icon | emoji-only | Rounded purple amethyst rune stone stamped with an arcane glyph — RS runecrafting rune icon |
| `item.rune.fire` | Blaze Rune | 16x16 icon | emoji-only | Rounded orange blaze rune stone stamped with an arcane glyph — RS runecrafting rune icon |
| `item.rune.nature` | Wart Rune | 16x16 icon | emoji-only | Rounded sickly wart-green rune stone stamped with an arcane glyph — RS runecrafting rune icon |
| `item.rune.law` | Ender Rune | 16x16 icon | emoji-only | Rounded ender-green rune stone stamped with an arcane glyph — RS runecrafting rune icon |
| `item.rune.death` | Wither Rune | 16x16 icon | emoji-only | Rounded grey wither rune stone stamped with an arcane glyph — RS runecrafting rune icon |
| `item.rune.blood` | Magma Rune | 16x16 icon | emoji-only | Rounded deep magma-red rune stone stamped with an arcane glyph — RS runecrafting rune icon |
| `item.rune.soul` | Echo Rune | 16x16 icon | emoji-only | Rounded ink-black echo rune stone stamped with an arcane glyph — RS runecrafting rune icon |

### food-raw (6)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.chicken.raw` | Raw Chicken | 16x16 icon | pack-material:icon.chicken.raw | Fatty pale raw poultry cut on the bone — RS raw-meat icon |
| `item.egg` | Egg | 16x16 icon | procedural-draw | Cream egg with soft highlight and shaded base — RS egg icon |
| `item.mutton.raw` | Raw Mutton | 16x16 icon | pack-material:icon.mutton.raw | Fatty dark-red raw mutton cut on the bone — RS raw-meat icon |
| `item.beef.raw` | Raw Beef | 16x16 icon | pack-material:icon.beef.raw | Fatty red raw beef cut — RS raw-meat icon |
| `item.pork.raw` | Raw Pork | 16x16 icon | pack-material:icon.pork.raw | Fatty pink raw pork cut — RS raw-meat icon |
| `item.game.rabbit` | Raw Rabbit | 16x16 icon | pack-material:icon.rabbit.raw | Small raw rabbit carcass, pinkish with fur tufts — RS hunter raw-game icon |

### coin/misc (17)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.feather` | Feather | 16x16 icon | pack-material:icon.feather | Single white feather, soft barbs and quill — RS feather icon |
| `item.wool` | Wool | 16x16 icon | pack-material:icon.wool | Fluffy ball of cream wool yarn — RS wool icon |
| `item.rope` | Coiled Rope | 16x16 icon | pack-material:icon.rope | Neatly coiled brown rope — RS rope icon |
| `item.hide.wolf` | Wolf Pelt | 16x16 icon | pack-material:icon.hide.wolf | Stretched grey wolf pelt with a furred edge — RS hunter pelt icon |
| `item.bone.old` | Weathered Bone | 16x16 icon | pack-material:icon.bone | Single weathered off-white bone — RS prayer bones icon |
| `item.glob.slime` | Slime Glob | 16x16 icon | pack-material:icon.slime | Wobbling green slime glob with a glossy highlight — RS slime drop |
| `item.venom.sac` | Venom Sac | 16x16 icon | pack-material:icon.venom | Translucent green venom sac, bulging and glossy — RS poison-gland drop |
| `item.core.construct` | Construct Core | 16x16 icon | emoji-only | Riveted metal construct core, bolts and a dim glow — RS golem core drop |
| `item.anchor.root` | Rootheart Coil | 16x16 icon | emoji-only | Spiralled metal anchor-coil (Rootheart) — RS device coil, quest key item |
| `item.anchor.pump` | Tidegate Coil | 16x16 icon | emoji-only | Spiralled metal anchor-coil (Tidegate) — RS device coil, quest key item |
| `item.anchor.lift` | Liftworks Coil | 16x16 icon | emoji-only | Spiralled metal anchor-coil (Liftworks) — RS device coil, quest key item |
| `item.coin` | Coin | 16x16 icon | pack-material:icon.coin | Stack of stamped gold coins with a mint mark — RS coins icon |
| `item.hide.cow` | Cowhide | 16x16 icon | pack-material:icon.leather | Stretched tan cowhide with darker spots — RS crafting leather-hide icon |
| `item.fur` | Soft Fur | 16x16 icon | pack-material:icon.hide.wolf | Tuft of soft pale fur — RS hunter fur icon (shares wolf-pelt art) |
| `item.bone.big` | Big Bones | 16x16 icon | emoji-only | Large heavy bone with thick knobbed ends — RS big-bones icon |
| `item.bone.dragon` | Dragon Bones | 16x16 icon | emoji-only | Massive scorched dragon bone, ivory with dark cracks — RS dragon-bones icon |
| `item.component.parts` | Salvaged Parts | 16x16 icon | emoji-only | Heap of salvaged cogs and springs — RS invention components icon |

### charm/pouch (6)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.charm.bone` | Bone Charm | 16x16 icon | emoji-only | Small bone charm on a thong, pale carved fetish — RS summoning charm |
| `item.pouch.wolf` | Spirit Wolf Pouch | 16x16 icon | emoji-only | Drawstring summoning pouch marked with a wolf sigil — RS familiar pouch icon |
| `item.pouch.ox` | Pack Ox Pouch | 16x16 icon | emoji-only | Drawstring summoning pouch marked with an ox sigil — RS familiar pouch icon |
| `item.pouch.tortoise` | War Tortoise Pouch | 16x16 icon | emoji-only | Drawstring summoning pouch marked with a tortoise sigil — RS familiar pouch icon |
| `item.gizmo.swift` | Swift Gizmo | 16x16 icon | emoji-only | Brass clockwork Swift gizmo, gears and a glowing core — RS invention gizmo |
| `item.gizmo.precise` | Precise Gizmo | 16x16 icon | emoji-only | Brass clockwork Precise gizmo, gears and a glowing core — RS invention gizmo |

### relic/treasure (15)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.relic.shard` | Pottery Shard | 16x16 icon | emoji-only | Jagged painted pottery shard, terracotta with faded pattern — RS dig-site find |
| `item.relic.idol` | Sunburst Idol | 16x16 icon | emoji-only | Small sunburst idol figurine, ochre clay with rays — RS relic idol |
| `item.ring.gold` | Gold Ring | 16x16 icon | emoji-only | Plain gold ring, thin band catching light — RS jewellery ring icon |
| `item.amulet.gold` | Gold Amulet | 16x16 icon | emoji-only | Gold amulet on a cord with a plain gold pendant — RS enchant-amulet icon |
| `item.trinket.jade` | Jade Trinket | 16x16 icon | emoji-only | Small carved jade trinket bead, green with a bright facet — RS thieving loot |
| `item.relic.urn` | Clay Urn | 16x16 icon | emoji-only | Round clay urn with a narrow neck, terracotta — RS archaeology urn |
| `item.relic.coin` | Ancient Coin | 16x16 icon | emoji-only | Worn ancient coin, tarnished gold with a faded face — RS numismatics find |
| `item.treasure_map` | Treasure Map | 16x16 icon | emoji-only | Rolled parchment treasure map with a red X — RS clue/treasure map icon |
| `item.relic.tablet` | Carved Tablet | 16x16 icon | emoji-only | Carved stone tablet with etched glyph rows — RS inscribed tablet |
| `item.relic.mask` | Gilded Mask | 16x16 icon | emoji-only | Gilded ceremonial mask, gold face with eye holes — RS treasure mask |
| `item.ring.opal` | Opal Ring | 16x16 icon | emoji-only | Gold band ring set with a pale opal bezel — RS jewellery ring icon |
| `item.ring.sapphire` | Sapphire Ring | 16x16 icon | emoji-only | Gold band ring set with a blue sapphire bezel — RS jewellery ring icon |
| `item.amulet.emerald` | Emerald Amulet | 16x16 icon | emoji-only | Gold amulet on a cord with a green emerald pendant — RS enchant-amulet icon |
| `item.amulet.ruby` | Ruby Amulet | 16x16 icon | emoji-only | Gold amulet on a cord with a red ruby pendant — RS enchant-amulet icon |
| `item.amulet.dragonstone` | Dragonstone Amulet | 16x16 icon | emoji-only | Gold amulet on a cord with a purple dragonstone pendant — RS enchant-amulet icon |

### armor (16)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `armor.cap.iron` | Iron Helm | 16x16 icon | pack-material:icon.helmet.iron | Front-facing polished iron helm with eye slit and crown highlight — RS head-slot icon |
| `armor.tunic.iron` | Iron Chestplate | 16x16 icon | pack-material:icon.chest.iron | Polished iron chestplate, shoulders and collar shaded — RS body-slot icon |
| `armor.leggings.iron` | Iron Greaves | 16x16 icon | pack-material:icon.legs.iron | Polished iron greaves, twin leg plates — RS legs-slot icon |
| `armor.boots.leather` | Leather Boots | 16x16 icon | pack-material:icon.boots.leather | Chunky tan hide-leather boot, side profile with sole line — RS feet-slot icon |
| `armor.boots.copper` | Copper Boots | 16x16 icon | pack-material:icon.boots.iron | Chunky ruddy copper boot, side profile with sole line — RS feet-slot icon (shares iron-boot art) |
| `armor.boots.bronze` | Bronze Boots | 16x16 icon | pack-material:icon.boots.iron | Chunky warm bronze boot, side profile with sole line — RS feet-slot icon (shares iron-boot art) |
| `armor.boots.iron` | Iron Sabatons | 16x16 icon | pack-material:icon.boots.iron | Chunky polished iron sabaton, side profile with sole line — RS feet-slot icon |
| `armor.cap.leather` | Leather Cap | 16x16 icon | pack-material:icon.helmet.leather | Front-facing tan hide-leather cap with crown highlight — RS head-slot icon |
| `armor.tunic.leather` | Leather Tunic | 16x16 icon | pack-material:icon.chest.leather | Tan hide-leather tunic, shoulders and collar shaded — RS body-slot icon |
| `armor.leggings.leather` | Leather Leggings | 16x16 icon | pack-material:icon.legs.leather | Tan hide-leather leggings, twin leg plates — RS legs-slot icon |
| `armor.cap.copper` | Copper Helm | 16x16 icon | procedural-draw | Front-facing ruddy copper helm with eye slit and crown highlight — RS head-slot icon |
| `armor.tunic.copper` | Copper Chestplate | 16x16 icon | procedural-draw | Ruddy copper chestplate, shoulders and collar shaded — RS body-slot icon |
| `armor.leggings.copper` | Copper Greaves | 16x16 icon | procedural-draw | Ruddy copper greaves, twin leg plates — RS legs-slot icon |
| `armor.cap.bronze` | Bronze Helm | 16x16 icon | procedural-draw | Front-facing warm bronze helm with eye slit and crown highlight — RS head-slot icon |
| `armor.tunic.bronze` | Bronze Chestplate | 16x16 icon | procedural-draw | Warm bronze chestplate, shoulders and collar shaded — RS body-slot icon |
| `armor.leggings.bronze` | Bronze Greaves | 16x16 icon | procedural-draw | Warm bronze greaves, twin leg plates — RS legs-slot icon |

### ammo (3)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `item.arrow.shaft` | Arrow Shafts | 16x16 icon | emoji-only | Bundle of plain wooden arrow shafts, no heads — RS fletching intermediate |
| `item.arrow.bronze` | Bronze Arrows | 16x16 icon | emoji-only | Fanned quiver of arrows tipped in warm bronze, red fletchings — RS ranged-ammo stack |
| `item.arrow.iron` | Iron Arrows | 16x16 icon | emoji-only | Fanned quiver of arrows tipped in cold steel-iron, red fletchings — RS ranged-ammo stack |

---

## 4. UI icons, skill badges & effects

> Enumerated all UI + EFFECTS art for Runecraft. All icons are procedural 16x16 pixel-art baked to PNG data URLs on canvas (src/ui/icons.ts), served through skillIconHtml/uiIconHtml/itemIconHtml. FINDINGS: (1) All 33 skills in SKILLS (content.ts) have a matching SKILL_DRAWS entry in icons.ts — every badge is drawn procedurally (16x16), rendered at 20px in the skills panel / 22px in the level-up toast. (2) HUD button icons come from UI_DRAWS: rotl, rotr, center, skin, pack, inv, heart, quest, skills (9 kinds). Health glyph = uiIcon 'heart'; quest glyph = uiIcon 'quest'; coin glyph reuses the item.coin icon (icon.coin baked default / ITEM_DRAWS fallback); the stamina 'glyph' is just a CSS fill-bar plus the 🏃 run-toggle emoji (no drawn sprite). (3) There is NO custom mouse cursor image — the UI uses native CSS cursor:pointer/crosshair/default only. The in-world 'cursor'/locator is sprite.player.arrow (a gold chevron drawn through dungeon walls, textures.ts). (4) The minimap (minimap.ts) is entirely canvas-drawn primitives: a white player dot, a rotated gold quest diamond, a dark 'underground' panel with a downward chevron, and a terrain color palette (BLOCK_COLORS) — no sprite files. (5) particles.ts (ParticleBursts) is ONLY a pooled wood-chip/leaf burst — three vertex-colored 0.09³ boxes (#7a5230/#59a83b/#a5793f), no textures. The task's expected 'flame, smoke, spark, splash, level-up' textures mostly DO NOT EXIST: 'splash' is only an audio cue (audio.ts), 'levelUp' is a CSS HUD toast carrying the skill icon (no texture), and there are no smoke/spark sprites anywhere. The only real FX textures are sprite.flame (animated flicker crossfire, textures.ts + baked default) and sprite.torch/sprite.item.torch; plus the soft radial blob shadow (makeBlobShadow, 64x64 gradient) under characters/props, and the overhead NPC quest markers sprite.quest.give ('!') and sprite.quest.ready ('?').

### skill-badge (33)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `skill.woodcutting` | Woodcutting | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | felling axe — grey iron head on a diagonal wooden handle |
| `skill.mining` | Mining | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | steel pickaxe — dark head arc over a wooden shaft |
| `skill.foraging` | Foraging | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS (reuses ITEM_DRAWS item.berry.basic) | cluster of blue berries on a green leafy sprig |
| `skill.fishing` | Fishing | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS (rod) | fishing rod — wooden pole with a steel tip and hanging line/hook |
| `skill.cooking` | Cooking | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | three-tone cooking flame (dark red base, orange, yellow core) |
| `skill.smelting` | Smelting | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | stone furnace front with a glowing orange firebox mouth |
| `skill.smithing` | Smithing | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | iron anvil, dark grey with a lighter top face |
| `skill.attack` | Attack | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS (sword) | upright sword — bright silver blade with a gold crossguard |
| `skill.defense` | Defense | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | grey kite shield tapering to a point, gold central boss |
| `skill.farming` | Farming | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | golden wheat sheaf on a brown stalk |
| `skill.herblore` | Herblore | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | sprig of green leaves on a central stem |
| `skill.crafting` | Crafting | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | handsaw resting over a cut wooden plank |
| `skill.archaeology` | Archaeology | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | excavation brush over a half-buried terracotta pot in dirt |
| `skill.archery` | Archery | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | wooden bow with a nocked white arrow and grey head |
| `skill.construction` | Construction | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | hammer above a half-built grey stone wall |
| `skill.brewing` | Brewing | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | black cauldron with teal bubbling brew and rising bubbles |
| `skill.enchanting` | Enchanting | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | open cream tome on a leather spine with a rising violet glint |
| `skill.hunting` | Hunting | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | rope snare loop mounted on a wooden stake |
| `skill.thieving` | Thieving | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | cinched leather coin purse with a gold coin peeking out |
| `skill.agility` | Agility | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | springing leather boot with pale-blue motion dashes |
| `skill.slaying` | Slaying | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | bone-white skull with a small red slayer mark |
| `skill.boating` | Mariner (Boating) | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | silver mariner's anchor with ring, stock and flukes |
| `skill.firemaking` | Firemaking | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | tall bright bonfire flame with a white-hot core |
| `skill.strength` | Strength | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | loaded barbell — dark plates on a short grey bar |
| `skill.prayer` | Prayer | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | lit candle within a golden halo ring |
| `skill.fletching` | Fletching | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | diagonal arrow — wooden shaft, silver head, red fletching |
| `skill.runecrafting` | Runecrafting | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | purple rune tablet inscribed with a glowing cyan glyph |
| `skill.magic` | Magic | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | four-point violet sparkle star with a smaller cyan glint |
| `skill.constitution` | Constitution | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | red heart with pink highlights (distinct from the HUD hp heart) |
| `skill.dungeoneering` | Dungeoneering | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | old gold key — round bow, dark hole, toothed bit |
| `skill.summoning` | Summoning | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | tan animal paw print — pad with four toe beans |
| `skill.necromancy` | Necromancy | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | bone skull haloed in a sickly green glow, green eye sockets |
| `skill.invention` | Invention | 16x16 | /workspace/runecraft/src/ui/icons.ts SKILL_DRAWS | steel cog/gear with a lighter hub and dark axle hole |

### hud-icon (10)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `ui.rotl` | Rotate Left button | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.rotl (rotateArrow mirrored) | white three-quarter ring with a gold arrowhead, curving anticlockwise |
| `ui.rotr` | Rotate Right button | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.rotr (rotateArrow) | white three-quarter ring with a gold arrowhead, curving clockwise |
| `ui.center` | Center Camera button | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.center | white four-way reticle/crosshair around a gold dot with a dark pupil |
| `ui.skin` | Character Skin button | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.skin | head-and-shoulders bust — skin face, brown hair, teal shirt |
| `ui.pack` | Texture Pack button | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.pack | painter's palette with thumb hole and red/blue/yellow/green paint dabs |
| `ui.inv` | Inventory button | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.inv | brown backpack with straps, top handle and a gold buckle flap |
| `ui.heart` | Health (HP) glyph | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.heart | classic red heart with a pink shine; drives the hp bar and heal toasts |
| `ui.quest` | Quest glyph | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.quest | gold vertical quest marker (quill/exclamation shape on dark outline) |
| `ui.skills` | Skills glyph | 16x16 | /workspace/runecraft/src/ui/icons.ts UI_DRAWS.skills | three ascending stat bars — green, gold, blue (levels glyph) |
| `item.coin` | Coin HUD glyph | 16x16 (icon.coin baked default at pack size) | /workspace/runecraft/src/ui/icons.ts ITEM_DRAWS['item.coin'] + default-textures.ts icon.coin; shown via itemIconHtml in shop/alch HUD | round gold coin with a highlighted rim and a dark stamped mark |

### cursor (2)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `cursor.player.arrow` | Player locator arrow (in-world cursor/marker) | 16x16 sprite on 0.5x0.5 plane | /workspace/runecraft/src/render/textures.ts 'sprite.player.arrow'; used in renderer.ts playerMarker (dungeon themes, drawn through walls) | downward gold chevron/arrowhead with a dark outline, floats above the player |
| `cursor.native.css` | Native mouse cursors (no art asset) | n/a | /workspace/runecraft/src/ui/hud.css, minimap.ts, start-screen.css | no custom cursor image — only CSS cursor:pointer (buttons), cursor:crosshair (map travel), cursor:default; nothing to reskin |

### minimap (4)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `minimap.player.dot` | Minimap player dot | ~px radius on 148px/560px canvas | /workspace/runecraft/src/ui/minimap.ts draw() | white filled circle with a dark outline, centered on the map |
| `minimap.quest.diamond` | Minimap quest marker | ~2.4*px square on 148px/560px canvas | /workspace/runecraft/src/ui/minimap.ts draw() (activeQuestTarget) | gold rotated square (diamond) with a dark outline, clamped to the map edge |
| `minimap.underground.chevron` | Minimap underground state | 148px canvas | /workspace/runecraft/src/ui/minimap.ts drawUnderground() | dark deepslate panel with speckle and a grey downward chevron (you have descended) |
| `minimap.terrain.palette` | Minimap terrain color key | per-pixel fill | /workspace/runecraft/src/ui/minimap.ts BLOCK_COLORS + shadeHex height shading | top-down biome palette (water blue, grass green, sand tan, stone grey, etc.) with subtle height relief |

### particle/fx (6)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `fx.particle.chips` | Chop/mine particle burst | 0.09x0.09x0.09 box meshes, pool of 48 | /workspace/runecraft/src/render/particles.ts ParticleBursts | tumbling untextured cubes in wood-brown #7a5230, leaf-green #59a83b, tan #a5793f — gravity-fed chips/leaves on chop cycles (NO texture) |
| `fx.blob.shadow` | Soft blob shadow | 64x64 canvas texture on a plane | /workspace/runecraft/src/render/renderer.ts makeBlobShadow() | radial black-to-transparent gradient disc laid flat under characters, props and trees |
| `sprite.flame` | Flame FX sprite (campfire) | 16x16 alpha cutout, crossed planes | /workspace/runecraft/src/render/textures.ts 'sprite.flame' + default-textures.ts baked; flicker animated in renderer.ts flameGroups | noisy tapering flame, orange #e2903a body with a yellow #f6c65a inner core, scale-flickers each frame |
| `sprite.torch` | Torch FX sprite | 16x16 alpha cutout, crossed planes | /workspace/runecraft/src/render/textures.ts 'sprite.torch' (and 'sprite.item.torch') | wooden stick with an ember base and a bright orange flame tip with a hot white centre |
| `sprite.quest.give` | NPC quest 'give' marker | 16x16 alpha cutout | /workspace/runecraft/src/render/textures.ts 'sprite.quest.give' (drawQuestMark '!') | gold exclamation mark on a dark outline, floats over an NPC head |
| `sprite.quest.ready` | NPC quest 'ready' marker | 16x16 alpha cutout | /workspace/runecraft/src/render/textures.ts 'sprite.quest.ready' (drawQuestMark '?') | gold question mark on a dark outline, floats over an NPC head |

### misc-ui (1)

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `hud.stamina.bar` | Stamina bar + run glyph (no sprite) | CSS fill bar | /workspace/runecraft/src/ui/hud.ts refreshStamina() + .stamina-chip; run toggle uses 🏃 emoji | CSS-drawn depleting fill bar that turns warning-colored when low; the run toggle is a 🏃 emoji, not a drawn icon — no dedicated stamina art |

---

## 5. Block/foliage detail & gaps

> Enumerated distinct block/foliage/rock/tree/prop materials across blocks.ts, tree-models.ts+trees-data.ts, rock-models.ts+rocks-data.ts, and voxel-props.ts+props-data.ts, cross-checked against the importer.ts ALIASES table. 15 gaps found among texture-mapped materials: 8 tree-species bark tiles (pine, willow, maple, palm, dead, ember, glow, dusk — all have procedural TILE_SPECS in textures.ts and are referenced by renderer.ts TRUNKS but have NO importer alias, so an imported pack cannot retexture them), 6 ore-rock surface tiles (essence, redstone, lapis, emerald, quartz, netherite — drawn in textures.ts CUSTOM_DRAW/TILE_SPECS, referenced via content.ts viewMaterial, but absent from ALIASES; note resource.rock.quartz is distinct from the aliased terrain.quartz), and 1 block tile (terrain.cobble — the Cobblestone full block; cobble_slab/stairs/wall instead borrow terrain.gravel). Separately, ALL voxel props (8 categories, 520 models) are vertex-colored with a single shared procedural grain texture and reference no alias id at all — a systemic gap where the prop pipeline is entirely outside the pack-import/retexture path. Non-gap coverage: 7 aliased tree trunks + log.top/stump.top, all 7 leaf tiles, 7 aliased ore tiles, ~35 aliased terrain tiles, wool×16, concrete×16, and all plant/crop foliage sprites are present in ALIASES. Voxel rock models (rock-models.ts) only ever resolve terrain.stone/terrain.dirt, both aliased. Tile size is 16×16 (native up to 128 on pack import); props are vertex-colored (16px grain). — entries whose name flags "GAP" have no alias yet and need a material added in code as well as art.

| Material ID | Name | Size | Currently | RuneScape art direction |
|---|---|---|---|---|
| `resource.tree.pine.side` | Pine bark [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L80 + renderer.ts TRUNKS L1643; species in trees-data.ts (22 models) | RS pine/evergreen woodcutting tree |
| `resource.tree.willow.side` | Willow bark [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L81 + renderer.ts TRUNKS L1645; trees-data.ts (20 models) | RS willow (classic waterside woodcutting) |
| `resource.tree.maple.side` | Maple bark [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L82 + renderer.ts TRUNKS L1646; trees-data.ts (22 models) | RS maple (autumn woodcutting) |
| `resource.tree.palm.side` | Palm bark [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L83 + renderer.ts TRUNKS L1646; trees-data.ts (19 models) | RS palm/tropical (Karamja-style) |
| `resource.tree.dead.side` | Dead tree bark [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L84 + renderer.ts TRUNKS L1647; trees-data.ts (19 models) | RS dead tree (wilderness/barren) |
| `resource.tree.ember.side` | Ember tree bark [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L85 + renderer.ts TRUNKS L1648; trees-data.ts (13 models); leaves emissive-recoloured | fantasy magic tree (RS-style enchanted/fiery) |
| `resource.tree.glow.side` | Glow tree bark [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L86 + renderer.ts TRUNKS L1648; trees-data.ts (16 models); emissive leaves | fantasy glowing tree (RS-style enchanted) |
| `resource.tree.dusk.side` | Dusk tree bark [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L87 + renderer.ts TRUNKS L1649; trees-data.ts (13 models); emissive leaves | fantasy dusk/violet tree (RS-style enchanted) |
| `resource.rock.essence` | Rune essence rock [GAP: not in ALIASES] | 16×16 | textures.ts TILE_SPECS L95; ore node surface via content.ts viewMaterial | RS Runecrafting rune essence mine |
| `resource.rock.redstone` | Redstone ore rock [GAP: not in ALIASES] | 16×16 | textures.ts CUSTOM_DRAW L190; content.ts viewMaterial | RS red gem/ore vein |
| `resource.rock.lapis` | Lapis ore rock [GAP: not in ALIASES] | 16×16 | textures.ts CUSTOM_DRAW L203; content.ts viewMaterial | RS blue gem/lapis vein |
| `resource.rock.emerald` | Emerald ore rock [GAP: not in ALIASES] | 16×16 | textures.ts CUSTOM_DRAW L216; content.ts viewMaterial | RS emerald gem rock |
| `resource.rock.quartz` | Quartz ore rock [GAP: not in ALIASES] (distinct from aliased terrain.quartz) | 16×16 | textures.ts CUSTOM_DRAW L229; content.ts viewMaterial | RS crystalline/quartz vein |
| `resource.rock.netherite` | Ancient debris rock [GAP: not in ALIASES] | 16×16 | textures.ts CUSTOM_DRAW L243; content.ts viewMaterial | RS ancient/deep dark ore |
| `terrain.cobble` | Cobblestone block [GAP: not in ALIASES] (slab/stairs/wall variants use terrain.gravel instead) | 16×16 | blocks.ts cobble/STONE + textures.ts TILE_SPECS L118 | RS castle-wall cobblestone masonry |
| `prop.rock_over` | Overhang rock props [GAP: vertex-colored, no import path] (26 models) | vertex-color | props-data.ts cat rock_over + voxel-props.ts propMat()/propGeometry | RS mining scenery boulders/outcrops |
| `prop.rock_brown` | Brown rock props [GAP: vertex-colored, no import path] (26 models) | vertex-color | props-data.ts cat rock_brown + voxel-props.ts | RS dirt/brown boulder scenery |
| `prop.rock_mesa` | Mesa rock props [GAP: vertex-colored, no import path] (26 models) | vertex-color | props-data.ts cat rock_mesa + voxel-props.ts | RS desert/mesa rock scenery |
| `prop.rock_ocean` | Ocean rock props [GAP: vertex-colored, no import path] (26 models) | vertex-color | props-data.ts cat rock_ocean + voxel-props.ts | RS coastal/underwater rock scenery |
| `prop.details` | Detail dressing props [GAP: vertex-colored, no import path] (196 models) | vertex-color | props-data.ts cat details + voxel-props.ts | RS ground/town dressing clutter |
| `prop.flowers` | Flower props [GAP: vertex-colored, no import path] (89 models) | vertex-color | props-data.ts cat flowers + voxel-props.ts propMat() | RS Farming/flora flowers |
| `prop.mushrooms` | Mushroom props [GAP: vertex-colored, no import path] (84 models) | vertex-color | props-data.ts cat mushrooms + voxel-props.ts | RS fungus/mushroom flora |
| `prop.plants` | Plant/bush props [GAP: vertex-colored, no import path] (47 models) | vertex-color | props-data.ts cat plants + voxel-props.ts | RS bushes/undergrowth flora |
| `resource.tree.[oak/log,birch,spruce,jungle,acacia,darkoak,blossom].side` | Aliased tree trunk tiles (7 species — in ALIASES) | 16×16 | importer.ts ALIASES L43/48/52-56 + renderer.ts TRUNKS L1642-1649 | RS standard woodcutting trees (regular/oak, birch, teak/jungle, etc.) |
| `resource.tree.log.top,resource.tree.stump.top` | Tree log-top + stump-top ring tiles (in ALIASES) | 16×16 | importer.ts ALIASES L49-50 + renderer.ts L1728/1733 | RS felled-log ring / stump |
| `resource.tree.[leaves,birch,spruce,jungle,acacia,darkoak,blossom].leaves` | Leaf/canopy tiles (7 distinct, all in ALIASES; pine/willow/maple/palm/glow/ember/dusk reuse+recolour these RGBA cutout tiles) | 16×16 | importer.ts ALIASES L51/57-62 + renderer.ts LEAVES L1656-1664 | RS tinted cutout foliage canopy |
| `resource.rock.[stone,copper,tin,iron,coal,gold,diamond]` | Aliased ore/rock surface tiles (7 — in ALIASES) | 16×16 | importer.ts ALIASES L63-69 + textures.ts + content.ts | RS Mining rocks (copper/tin/iron/coal/gold/diamond) |
| `terrain.* (natural+stone families)` | ~35 aliased terrain block tiles (grass/dirt/stone/sand/water/plank/snow/ice/mud/redsand/mycelium/drygrass/stonebrick/gravel/coarsedirt/podzol/clay/moss/andesite/calcite/terracotta family/basalt/diorite/granite/endstone/netherbrick/prismarine/darkprismarine/purpur/quartz/blackstone/deepslate — in ALIASES) | 16×16 | blocks.ts NATURAL/STONE + importer.ts ALIASES + textures.ts TILE_SPECS | RS terrain/ground + building stone |
| `block.wool.<16 colors>` | Wool block family (16 dye colors — all in ALIASES) | 16×16 | blocks.ts DYED + importer.ts generated ALIASES L209-212 | RS dyed cloth/crafting blocks |
| `block.concrete.<16 colors>` | Concrete block family (16 dye colors — all in ALIASES) | 16×16 | blocks.ts DYED + importer.ts generated ALIASES L209-212 | RS solid dyed building blocks |
| `sprite.{crop.wheat.*,herb.*,bush.berry.*,flowers.wild,grass.tuft,reeds}+object.{pumpkin,melon}.*` | Plant/crop foliage sprites + pumpkin/melon (all in ALIASES) | 16×16 | importer.ts ALIASES L112-132 + renderer.ts crossSprite/crop cases + textures.ts CUSTOM_DRAW | RS Farming crops + wild flora sprites |
| `rock-models ROCK_MATERIAL_TILES` | Voxel boulder/mining-rock surfaces resolve only terrain.stone/terrain.dirt (both aliased — no own material) | 16×16 | rock-models.ts L58 ROCK_MATERIAL_TILES; rocks-data.ts 316 models all use material index 0 | RS mineable boulder/ore outcrop (grey stone) |
