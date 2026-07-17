# Pixel art needed — Runecraft

Everything below currently renders from an **emoji** or a **procedural
placeholder**. Replace each with original **RuneScape-themed** pixel art.

## Art direction — RuneScape (Old School RuneScape) style

Every asset should read like it belongs in **Old School RuneScape / RuneScape 2**,
not Minecraft:

- **Palette:** earthy, slightly desaturated medieval-fantasy tones — muted
  greens/browns for nature, cool greys for stone/steel, warm golds and gem
  jewel-tones for treasure. Avoid Minecraft's bright saturated blocks.
- **Item icons:** the iconic OSRS inventory look — a **single object drawn at a
  slight 3/4 / isometric angle**, chunky and readable, with a **dark (near-black)
  1px outline**, light coming from the **top-left**, and a soft shadow side on
  the lower-right. Bronze→iron→steel→mithril→adamant→rune→dragon metal tiers
  should read by colour (brown → grey → pale steel → blue → green → cyan →
  crimson) the way RuneScape gear does.
- **Creatures:** RuneScape bestiary designs (goblins, cows, giant rats, imps,
  skeletons, etc.) rather than Minecraft mobs — same silhouettes the engine
  rigs expect, but RS-flavoured colours and detailing.
- **World/blocks:** RuneScape-ground textures — trodden dirt paths, cobbled
  stone, mossy brick, timber — hand-shaded, low-contrast, tileable.

Keep it original art (RS-*inspired*, not ripped): do not copy Jagex sprites.

## Technical sizes (unchanged — the engine is voxel-based)

The renderer is grid/voxel based, so the **canvas sizes stay fixed** even though
the style is RuneScape. All item/block art is **16×16 PNG** with transparency;
entity skins follow the engine's model-box UV layout at the sizes noted.

How art gets wired in (for reference):
- **Item icons** → drop a 16×16 PNG and map the item id to a material key in
  `src/ui/icons.ts` (`ITEM_ICON_MATERIALS`) baked into
  `src/render/default-textures.ts`.
- **Mob skins** → a single entity texture baked as `entity.<mob>` in
  `default-textures.ts` (`DEFAULT_ENTITY_TEXTURES`); the rig UV-maps it (RS
  creature art laid onto the engine's box-UV template).
- **Blocks/props** → material keys in `default-textures.ts` (RuneScape-toned
  16×16 tiles), resolved by `src/render/textures.ts`.

---

## 1. Item icons — 92 (16×16 each)

Currently emoji. Grouped by kind; `(id)` is the item id. **Draw all of these in
the OSRS inventory-icon style** described above. Some names are inherited from
the prototype (e.g. "Netherite", "Redstone", "Nether Quartz") — keep the id, but
render the *art* as its RuneScape-tier equivalent (a top-tier dark metal, a red
mineral dust, a pale crystal, etc.), not the literal Minecraft item.

### Ores, gems & bars
- Redstone Dust `item.ore.redstone`
- Lapis Lazuli `item.gem.lapis`
- Emerald `item.gem.emerald`
- Nether Quartz `item.gem.quartz`
- Ancient Debris `item.debris.ancient`
- Netherite Scrap `item.scrap.netherite`
- Netherite Ingot `item.ingot.netherite`
- Opal `item.gem.opal`, Jade `item.gem.jade`, Topaz `item.gem.topaz`,
  Sapphire `item.gem.sapphire`, Ruby `item.gem.ruby`,
  Dragonstone `item.gem.dragonstone`

### Runes (magic reagents)
- Wind Rune `item.rune.air`, Prismarine Rune `item.rune.water`,
  Amethyst Rune `item.rune.earth`, Blaze Rune `item.rune.fire`,
  Wart Rune `item.rune.nature`, Ender Rune `item.rune.law`,
  Wither Rune `item.rune.death`, Magma Rune `item.rune.blood`,
  Echo Rune `item.rune.soul`
- Arcane Essence `item.essence.rune`

### Tools & weapons
- Diamond Sword/Axe/Pickaxe `tool.{sword,axe,pickaxe}.diamond`
- Netherite Sword/Axe/Pickaxe `tool.{sword,axe,pickaxe}.netherite`
- Runed Sword/Axe/Pickaxe/Longbow `tool.{sword.runed,axe.runed,pickaxe.runed,bow.runed}`
- Shortbow `tool.bow.wood`, Yew Longbow `tool.bow.yew`,
  Oak/Spruce/Jungle/Duskbark bows `tool.bow.{oak,spruce,jungle,dark}`
- Rope Snare `tool.trap.basic`, Fine Box Trap `tool.trap.fine`
- Boats: Log Raft `tool.boat.raft`, Rowboat `tool.boat.rowboat`, Swift Skiff `tool.boat.skiff`

### Fletching / Invention / Summoning
- Bronze Arrows `item.arrow.bronze`, Iron Arrows `item.arrow.iron`
- Salvaged Parts `item.component.parts`, Swift Gizmo `item.gizmo.swift`, Precise Gizmo `item.gizmo.precise`
- Spirit Wolf Pouch `item.pouch.wolf`, Pack Ox Pouch `item.pouch.ox`, War Tortoise Pouch `item.pouch.tortoise`

### Jewellery
- Gold Ring `item.ring.gold`, Gold Amulet `item.amulet.gold`
- Opal Ring `item.ring.opal`, Sapphire Ring `item.ring.sapphire`
- Emerald/Ruby/Dragonstone Amulet `item.amulet.{emerald,ruby,dragonstone}`

### Herbs, potions & food
- Wild Sage `item.herb.sage`, River Mint `item.herb.mint`,
  Emberleaf `item.herb.emberleaf`, Frostbloom `item.herb.frostbloom`, Duskcap `item.herb.duskcap`
- Healing Salve `item.salve.healing`, Oakblood Tonic `item.tonic.oakblood`
- Potions: Swiftness `item.potion.swift`, Strength `item.potion.strength`,
  Stoneskin `item.potion.stoneskin`, Forager's Brew `item.potion.gathering`, Hunter's Focus `item.potion.focus`
- Pumpkin `item.pumpkin`, Roast Pumpkin `item.pumpkin.roast`, Carrot Stew `item.stew.carrot`
- Burnt Chicken `item.chicken.burnt`, Burnt Mutton `item.mutton.burnt`

### Bones, spores, cores, charms
- Big Bones `item.bone.big`, Dragon Bones `item.bone.dragon`
- Pale Spores `item.spore.pale`, Construct Core `item.core.construct`, Bone Charm `item.charm.bone`
- Anchor coils `item.anchor.{root,pump,lift}`

### Relics (Archaeology)
- Pottery Shard `item.relic.shard`, Sunburst Idol `item.relic.idol`, Jade Trinket `item.trinket.jade`
- Clay Urn `item.relic.urn`, Ancient Coin `item.relic.coin`, Carved Tablet `item.relic.tablet`, Gilded Mask `item.relic.mask`

> ~91 more items already have pixel-art icons (logs, raw/cooked meat & fish,
> basic ores/bars, leather/copper/bronze/iron armour, etc.) — leave those.

---

## 2. Mob / entity textures

Drawn **procedurally** today (no skin). Each needs one **RuneScape-styled
creature** texture laid onto the engine's box-UV template at the size in
parentheses — RS bestiary colours/detailing, not Minecraft mobs. **The cow
included — there is no cow texture in the project; it is drawn as procedural
white-with-black patches.** Baked keys become `entity.<name>`.

| Mob | id | Entity texture (vanilla layout) |
|---|---|---|
| Cow | `entity.cow` | 64×32 |
| Sheep | `entity.sheep` | 64×32 (+ wool overlay) |
| Wolf | `entity.wolf` | 64×32 |
| Spider | `entity.spider` | 64×32 |
| Slime | `entity.slime` | 64×32 |
| Creeper | `entity.creeper` | 64×32 |
| Skeleton | `entity.skeleton` | 64×32 (humanoid) |
| Squid | `entity.squid` | 64×32 |
| Ghast | `entity.ghast` | 64×32 |
| Iron/Rust/Canyon Construct | `entity.construct` | 64×64 (golem-ish) |
| Old Gnasher (boss) | `entity.gnasher` | 64×32 |
| Straw Target dummy | `entity.dummy` | small, 32×32 |

- **Tutorial Guide NPC** (`entity.guide`) — the friendly instructor who stands at
  the tutorial spawn and points to each lesson. Reusing a villager skin for now;
  wants its own RuneScape-styled 64×32 humanoid skin.

Already have skins: chicken, pig, zombie, husk (+ chest). Dragons use a
separate Blockbench model system, not these.

Optional: a proper **player skin** (`entity.player`) — currently a simple
original skin.

### 2b. Recolored mob variants — each needs its own skin (28 files)

Today these mobs are **tint-recolors** of a base mob's texture (the whole
skin multiplied by one colour), so families of enemies look like palette
swaps. Each wants its own hand-drawn skin on the **same box-UV layout as its
base mob** — same canvas, same part placement, new art.

**What to call the file (exactly):** deliver each PNG at the path below,
inside `assets/minecraft/textures/entity/` of the texture pack zip. The
engine is pre-wired for these names (`src/texturepacks/entities.ts`) — the
moment the file exists, that mob stops being a recolor, no code edit needed.
To bake them into the shipped defaults, run
`node scripts/bake-default-textures.mjs <pack.zip>` (regenerates
`src/render/default-textures.ts`).

The "tint today" hex is the current recolor — treat it as the colour
direction for the new art, not a constraint.

| Mob (name) | Enemy id | Base layout to follow | Canvas | Tint today | **Deliver file as** |
|---|---|---|---|---|---|
| Frost Wolf | `enemy.frost_wolf` | `wolf/wolf.png` | 64×32 | `#dfe6ea` icy white | `wolf/frost_wolf.png` |
| Dire Wolf | `enemy.dire_wolf` | `wolf/wolf.png` | 64×32 | `#3a3f47` near-black | `wolf/dire_wolf.png` |
| Ash Hound | `enemy.ash_hound` | `wolf/wolf.png` | 64×32 | `#6a352a` ember red | `wolf/ash_hound.png` |
| Gloom Spinner | `enemy.gloom_spinner` | `spider/spider.png` | 64×32 | `#7a4f9b` violet | `spider/gloom_spinner.png` |
| Dust Scuttler | `enemy.dust_scuttler` | `spider/spider.png` | 64×32 | `#a08153` sandy | `spider/dust_scuttler.png` |
| Vine Stalker | `enemy.vine_stalker` | `spider/spider.png` | 64×32 | `#3f6b2f` leafy | `spider/vine_stalker.png` |
| Thornback Spider | `enemy.thornback` | `spider/spider.png` | 64×32 | `#5a4a2f` bramble | `spider/thornback.png` |
| Ember Crawler | `enemy.ember_crawler` | `spider/spider.png` | 64×32 | `#8a3a2a` magma | `spider/ember_crawler.png` |
| Old Gnasher (boss) | `enemy.old_gnasher` | `spider/cave_spider.png` | 64×32 | — (uses cave spider art) | `spider/old_gnasher.png` |
| Bog Slime | `enemy.bog_slime` | `slime/slime.png` | 64×32 | `#5d8c3a` murky green | `slime/bog_slime.png` |
| Blight Slime | `enemy.blight_slime` | `slime/slime.png` | 64×32 | `#8a5fae` corrupt purple | `slime/blight_slime.png` |
| Bramble Slime | `enemy.bramble_slime` | `slime/slime.png` | 64×32 | `#6b8a3a` thorny | `slime/bramble_slime.png` |
| Marsh Lurker | `enemy.marsh_lurker` | `slime/slime.png` | 64×32 | `#4a5f3a` swamp | `slime/marsh_lurker.png` |
| The Silt King (boss) | `enemy.silt_king` | `slime/slime.png` | 64×32 | `#7a6f45` silt gold | `slime/silt_king.png` |
| Mire Husk | `enemy.mire_husk` | `zombie/zombie.png` | 64×64 | `#5f7355` bog green | `zombie/mire_husk.png` |
| Dune Husk | `enemy.dune_husk` | `zombie/husk.png` | 64×64 | `#b9a065` sun-dried | `zombie/dune_husk.png` |
| Glacial Wight | `enemy.glacial_wight` | `zombie/husk.png` | 64×64 | `#bcd6e6` frozen | `zombie/glacial_wight.png` |
| Grave Shambler | `enemy.grave_shambler` | `zombie/zombie.png` | 64×64 | `#4a5548` graveyard | `zombie/grave_shambler.png` |
| Hollow Wight | `enemy.hollow_wight` | `zombie/zombie.png` | 64×64 | `#9fb8c9` spectral | `zombie/hollow_wight.png` |
| Spore Shambler | `enemy.spore_shambler` | `zombie/zombie.png` | 64×64 | `#b9a6c4` fungal | `zombie/spore_shambler.png` |
| Prairie Bull | `enemy.prairie_bull` | `cow/cow.png` | 64×32 | `#7a5a3a` tawny | `cow/prairie_bull.png` |
| Wild Boar | `enemy.boar` | `pig/pig.png` | 64×32 | `#6b4a34` bristle brown | `pig/boar.png` |
| Barrow Lord (boss) | `enemy.barrow_lord` | `skeleton/skeleton.png` | 64×32 | `#c8ccd6` bone pale | `skeleton/barrow_lord.png` |
| Canyon Construct (boss) | `enemy.canyon_construct` | iron-golem-ish | 64×64 | `#9c6b4a` red rock | `golem/canyon_construct.png` |
| Rust-seized Construct | `enemy.rust_construct` | iron-golem-ish | 64×64 | `#7a6355` rust | `golem/rust_construct.png` |
| Rootbound Warden | `enemy.rootbound_warden` | iron-golem-ish | 64×64 | `#4f6b3a` overgrown | `golem/rootbound_warden.png` |
| Moss Golem | `enemy.moss_golem` | iron-golem-ish | 64×64 | `#4f7a3a` mossy | `golem/moss_golem.png` |
| Stone Sentinel | `enemy.stone_sentinel` | iron-golem-ish | 64×64 | `#7a7a7a` granite | `golem/stone_sentinel.png` |
| The Liftworks Overseer (boss) | `enemy.liftworks_overseer` | iron-golem-ish | 64×64 | `#5a6a72` machined steel | `golem/liftworks_overseer.png` |

> Note on the six construct/golem skins: the construct rig is painted boxes
> today (no UV mapping yet). Deliver the art on the iron-golem layout and the
> rig gets UV-mapped to it when the files land — everything else in this
> table applies the moment the file exists.
>
> `enemy.timber_wolf` intentionally shares the base `wolf/wolf.png` — it *is*
> the plain wolf. Everything else above stops being a palette swap once its
> file is delivered.

---

## 3. Voxel props → per-face block textures  (needs a decision)

The rocks, boulders, giant mushrooms and plants scattered in the world are
**colored-voxel models** (a per-voxel colour + a grey grain), not per-face
textures. To give them real RuneScape-styled block faces I need to **re-import
the source `.schem`/`.litematic` files storing the block type per voxel**, then
render each face with the real block texture (the structure system already
does this). **Those source files are not in the repo** — send them and I'll
re-bake. (Alternatively I can approximate by mapping each prop colour to the
nearest block texture — say the word.)

Block textures that imported *structures* currently render as flat colour and
would benefit from 16×16 **RuneScape-toned** tiles — the big families:
`podzol, gravel, netherrack, obsidian, glowstone, amethyst_block, magma_block,
soul_sand/soil, the metal/gem *_block set (iron/gold/diamond/emerald/lapis/
redstone/coal), hay_block, bone_block, sea_lantern, sculk*, mushroom blocks,
copper (all oxidation stages), coral`, plus glass/panes, rails, chains, lanterns.

---

## 4. Torches — procedural placeholders (replace with real 16×16 art)

Both torch sprites currently render from a hand-coded procedural drawing in
`src/render/textures.ts` (`CUSTOM_DRAW`), not real pixel art. Drop in a 16×16
PNG with transparency for each and they resolve automatically (a loaded resource
pack's `torch.png` also overrides them):

- **`sprite.torch`** — the standing / wall torch, drawn on **crossed vertical
  planes**. RuneScape wall-sconce feel: a stout wooden brand with a small
  glowing tip near the top, everything else transparent. Used by the torches
  around the castle wall.
- **`sprite.item.torch`** — the **in-hand item** icon, on the diagonal-handle
  convention (handle rising bottom-left → top-right, like the axe/pickaxe item
  art) so it grips correctly in the fist. Wooden shaft, glowing head at the
  top-right end — same OSRS item-icon shading as the other tools.

> For *this* version the separate flaring flame sprite was removed from the wall
> torches — the torch's own glowing tip reads as the flame. To bring an animated
> flame back later, that's `sprite.flame` (also procedural).

---

## 5. Optional — skill icons & UI

- **28 skill icons** (`src/ui/icons.ts` `SKILL_DRAWS`) are hand-drawn 16×16
  pixel icons already (not emoji) — redraw only if you want a unified look.
- A handful of **UI glyphs** (rotate, center, gear, etc.) are procedural.

---

### Summary of counts
- **92** item icons (16×16)
- **~12** mob skins (+ optional player)
- **2** torch sprites (`sprite.torch`, `sprite.item.torch`) — 16×16, currently procedural
- **1** prop-texturing decision (reimport vs colour-map)
- optional: 28 skill icons, misc UI glyphs, ~30 structure block textures

---

> **Audit note (this version):** a full sweep of the live render path — all 110
> world props/nodes plus terrain and the castle wall — found **no textures
> falling through to the broken magenta placeholder**. Everything either has
> baked art, a procedural tile, or is a colour/model mesh. The outstanding art
> is what's listed above (emoji item icons, mob skins, the torch sprites, and
> the optional structure-block tiles), not broken/missing textures.

---

### Tutorial art / polish backlog (Tutor's Trail rebuild)
- **Pig snout ("missing nose")** — the baked `mob.pig` bbmodel's snout cube
  (`504d7e89…` under the `head` root) renders with a box-UV at `[24,0]` that
  overlaps the head's down-face region in the repacked BetaSharp atlas, so the
  snout shows head-coloured pixels instead of a distinct nose. Fix by giving the
  snout an explicit `fuv` pointing at the real snout texels (needs a visual look
  at `mob-models-data.ts` pig `tex`), or nudge the box-UV origin. Best done in
  the art pass with screenshot iteration.
- **Tutor skins** are procedural placeholders (see `render/skin.ts`
  `TUTOR_PALETTES`) — good enough to read as distinct trainers (smith, mage,
  ranger, sailor…), but bespoke 64×64 skins would look sharper.
- The trail zones reuse existing props; dedicated art for an **archery range**,
  **spirit grove**, **graveyard** and **dig site** would sell those zones more.
