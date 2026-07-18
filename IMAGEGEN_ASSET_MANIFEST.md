# RuneCraft ImageGen production manifest

Updated after a live-code audit on 2026-07-17. This supersedes the stale counts
in `ASSETS_NEEDED.md`.

## Locked art direction

- Use the attached creature lineup only for voxel density, material richness,
  raised-camera readability, ambient depth, and selective glow.
- All RuneCraft subjects must be original rather than copies of creatures,
  textures, UI, or items from another game.
- Models use many small, irregular blocks with layered anatomy and chunky
  silhouettes. Avoid large plain cuboids, smooth plastic, and palette swaps.
- Surfaces are dark medieval fantasy: chipped stone, cracked bone, corroded
  metal, splintered timber, moss, roots, fungi, frost, soot, mud, and worn cloth.
- Glow is compact and purposeful: eyes, runes, embers, crystals, magical cores.

The ImageGen master reference is:

`src/render/art/reference/runecraft-voxel-style-bible-v1.png`

## What the runtime actually contains

- 61 enemy definitions.
- 56 exact-ID native procedural voxel rigs with dedicated silhouettes and
  animation hooks.
- 4 existing keyframed dragon rigs and the attributed Warden rig are retained.
- 253 ImageGen item/rune masters wired at exact 64x64 RGBA runtime size.
- All 162 formerly missing P0 inventory IDs now route to generated art; none of
  the audited P0 set falls back to emoji.
- 227 inherited/default raster textures controlling most world surfaces.
- 6 ImageGen-authored core terrain overrides are active in the material atlas.
- 30 active named tutorial/NPC skins rendered procedurally.
- Only 16 equipped item IDs mapped to five generic held-item silhouettes.
- An authored title background is active; loading art, NPC portraits, and a
  dedicated world-logo asset remain P1 work.

## Production status

### Generated with ImageGen

- `src/render/art/reference/runecraft-voxel-style-bible-v1.png`
- `src/render/art/ui/runecraft-start-keyart-v1.png`
- `src/render/art/ui/runecraft-start-keyart-v1.webp` (runtime-optimized derivative)
- 162 new exact-size inventory sources under `src/render/art/items/` and
  `src/render/art/runes/`.
- Six deterministic runtime terrain tiles under
  `src/render/art/materials/tiles/`.

### Runtime integration complete

- 259 baked runtime textures: 253 inventory/rune icons plus 6 terrain tiles.
- All 61 enemy IDs have an explicit native or retained model route.
- 37 focused art, route, model-structure, animation, and coverage checks pass.
- `dist/runecraft.html` is rebuilt as a self-contained offline game.

## P0: creature overhaul — complete

Texture replacement alone cannot produce the reference silhouettes, so the
runtime now uses exact-ID repo-native voxel rigs. Shared combat, hit, lunge, and
death handling is preserved; each procedural family adds its own idle,
walk/fly/swim, attack, appendage, and detail motion. The four keyframed dragons
and the attributed Warden remain explicit retained paths rather than fallbacks.

First family groups:

1. Undead: grave shambler, hollow wight, mire husk, dune husk, spore shambler,
   glacial wight, skeletons, drowned, stray, barrow lord.
2. Arachnids: spider, cave spider, gloom spinner, dust scuttler, vine stalker,
   thornback, ember crawler, old gnasher.
3. Constructs: canyon construct, rust construct, rootbound warden, liftworks
   overseer, moss golem, stone sentinel, warden.
4. Oozes: bog slime, blight slime, bramble slime, marsh lurker, silt king.
5. Beasts: timber/frost/dire wolves, ash hound, boar, prairie bull, livestock,
   ravager, armadillo, sniffer, mooshroom.
6. Fliers/aquatics: bat, allay, bee, ghast, squid.
7. Dragons: fire, ice, hydra, and two-headed dragon.
8. Raiders and NPC-shaped enemies: pillager, vindicator, evoker, illusioner,
   witch, target dummy.

The 29 absent-but-wired legacy atlas inputs remain useful as interim skins, but
must not be described as finished custom models.

## P0: 162 missing inventory masters — complete

Every item below received a separate ImageGen call, a transparent 64x64 RGBA
source, an `icon.original.*` bake entry, and an exact live item-ID mapping.

### Armor (25)

`armor.boots.adamant`, `armor.boots.diamond`, `armor.boots.mithril`,
`armor.boots.netherite`, `armor.boots.rune`, `armor.boots.runed`,
`armor.boots.steel`, `armor.cap.adamant`, `armor.cap.diamond`,
`armor.cap.mithril`, `armor.cap.netherite`, `armor.cap.rune`,
`armor.cap.steel`, `armor.leggings.adamant`, `armor.leggings.diamond`,
`armor.leggings.mithril`, `armor.leggings.netherite`, `armor.leggings.rune`,
`armor.leggings.steel`, `armor.tunic.adamant`, `armor.tunic.diamond`,
`armor.tunic.mithril`, `armor.tunic.netherite`, `armor.tunic.rune`,
`armor.tunic.steel`.

### Combat, tools, boats, and ammunition (27)

`item.arrow.adamant`, `item.arrow.mithril`, `item.arrow.rune`,
`item.arrow.shaft`, `item.arrow.steel`, `tool.boat.cutter`,
`tool.boat.longship`, `tool.fishingrod.barbed`, `tool.fishingrod.enchanted`,
`tool.fishingrod.fly`, `tool.fishingrod.pearl`, `tool.hoe.basic`,
`tool.mattock.basic`, `tool.mattock.crystal`, `tool.mattock.dragon`,
`tool.mattock.iron`, `tool.secateurs.basic`, `tool.secateurs.magic`,
`tool.sword.astral`, `tool.trap.box`, `tool.trap.magic`, `item.antler`,
`item.chinchompa`, `item.spike.grenwall`, `item.tusk`, `item.gizmo.bulwark`,
`item.gizmo.titan`.

### Ores, bars, planks, crops, seeds, and gathered plants (28)

`item.bar.adamant`, `item.bar.mithril`, `item.bar.runite`, `item.bar.steel`,
`item.ore.adamant`, `item.ore.mithril`, `item.ore.runite`,
`item.plank.mahogany`, `item.plank.oak`, `item.plank.teak`, `item.crop.corn`,
`item.crop.sunfruit`, `item.seed.corn`, `item.seed.sunfruit`,
`item.forage.cadava`, `item.forage.cloudberry`, `item.forage.dwellberry`,
`item.forage.everlight`, `item.forage.jangerberry`, `item.forage.poisonivy`,
`item.forage.pricklypear`, `item.forage.redberry`, `item.forage.whiteberry`,
`item.arch.samples`, `item.bone.ancient`, `item.bone.warden`,
`item.hide.antelope`, `item.hide.kebbit`.

### Hunting, fish, and cooked food (31)

`item.hide.polar`, `item.hide.sabre`, `item.hide.thick`, `item.game.antelope`,
`item.game.boar`, `item.game.fowl`, `item.game.grenwall`,
`item.antelope.cooked`, `item.boar.cooked`, `item.fowl.cooked`,
`item.grenwall.cooked`, `item.fish.crab`, `item.fish.gloom`,
`item.fish.lobster`, `item.fish.marlin`, `item.fish.shrimp`,
`item.fish.stormscale`, `item.crab.cooked`, `item.gloom.cooked`,
`item.lobster.cooked`, `item.marlin.cooked`, `item.shrimp.cooked`,
`item.stormscale.cooked`, `item.pouch.drake`, `item.pouch.lynx`,
`item.rite.barrow`, `item.rite.drowned`, `item.rite.shambler`,
`item.rite.skeleton`, `item.rite.stray`, `item.rite.wight`.

### Construction flatpacks (17)

`item.flatpack.altar`, `item.flatpack.bed`, `item.flatpack.bench`,
`item.flatpack.bookshelf`, `item.flatpack.cabinet`, `item.flatpack.chair`,
`item.flatpack.crate`, `item.flatpack.dresser`, `item.flatpack.fireplace`,
`item.flatpack.fourposter`, `item.flatpack.hearth`, `item.flatpack.shelf`,
`item.flatpack.stool`, `item.flatpack.table`, `item.flatpack.throne`,
`item.flatpack.wardrobe`, `item.treasure_map`.

### Potions and tonics (25)

`item.potion.focus_grand`, `item.potion.focus_greater`,
`item.potion.focus_super`, `item.potion.gathering_grand`,
`item.potion.gathering_greater`, `item.potion.gathering_keen`,
`item.potion.gathering_super`, `item.potion.stoneskin_grand`,
`item.potion.stoneskin_greater`, `item.potion.stoneskin_super`,
`item.potion.strength_grand`, `item.potion.strength_greater`,
`item.potion.strength_super`, `item.potion.swift_grand`,
`item.potion.swift_greater`, `item.potion.swift_super`, `item.salve.dusk`,
`item.salve.ember`, `item.salve.frost`, `item.salve.kings`,
`item.tonic.warden`, `item.tonic.warden_grand`,
`item.tonic.warden_greater`, `item.tonic.warden_super`,
`item.rune.astral`.

### Runes and relics (9)

`item.rune.body`, `item.rune.chaos`, `item.rune.cosmic`,
`item.relic.astrolabe`, `item.relic.censer`, `item.relic.chalice`,
`item.relic.crown`, `item.relic.sceptre`, `item.relic.torque`.

## P1: world and UI art

- Replace 47 core terrain images and their 24 tree/rock/resource surfaces.
- Replace 67 colored blocks/glass, 16 objects, 14 sprites, 3 roofs, and plaster.
- Generate proper torch, flame, hammer, advanced held tools, and crop sprites.
- Generate 30 named NPC skins plus model references; add the missing NPC art map.
- Generate title/loading art, portraits, 33 skill icons, and 9 UI glyphs.
- Preserve the 310 tree and 316 rock voxel shapes; upgrade their material faces.

## Integration rules

1. Never count a concept sheet as a runtime model or texture.
2. Keep high-resolution ImageGen masters under `src/render/art/`.
3. Derive exact alpha, pixel size, UV layout, and seamless tiles deterministically.
4. Run `node scripts/bake-original-art.mjs` after changing baked icons/entities.
5. Add an automated source-to-baked coverage test so a PNG cannot be forgotten.
6. Build and inspect the standalone HTML after every shipped batch.
