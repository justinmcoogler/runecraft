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

Already have skins: chicken, pig, zombie, husk (+ chest). Dragons use a
separate Blockbench model system, not these.

Optional: a proper **player skin** (`entity.player`) — currently a simple
original skin.

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
