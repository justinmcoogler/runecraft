# Runecraft — RuneScape-Themed Art List

Every visual asset the game needs, themed to a classic RuneScape feel: low-poly
chunky fantasy, muted earthy palettes with gold/rune accents, weathered wood +
rough stone, medieval-Britain-meets-high-magic. All world art renders on voxel
box geometry (Minecraft-format textures: 16×16 block tiles, box-UV entity
sheets), so deliver in those formats. Pixel-art style throughout — clean 16px
tiles, no anti-aliasing, readable at small sizes.

Priority key: **P0** = blocks alpha polish · **P1** = strongly wanted · **P2** = nice to have.

## 1. Characters & NPCs (box-UV 64×64 skins)

| Asset | Priority | Notes |
|---|---|---|
| Player default skin (fresh adventurer) | **P0** | Brown tunic, rolled sleeves — RS "newbie" look. Current default skin has broken patches. |
| Tutor skins ×30 (one per skill master) | P1 | Currently palette-recolors of one villager. Each should read as their craft: Lumberjack (flannel + axe strap), Miner (helm + soot), Angler (waders + hat), Cook (whites + apron), Smith (leather apron + tongs), Mage (blue robes + stars), Necromancer (dark robes + skull motif), etc. |
| Gatekeeper / Guide (tutorial) | P1 | A warm "Brother Brace"-style guide; a stern gatekeeper in mail. |
| Town NPCs: shopkeeper, banker, innkeeper, priest, guard ×2 | P1 | RS-style townsfolk. Guards: chainmail + kettle helm. |
| Slayer master (Kull) | P2 | Spiked leathers, trophy necklace. |
| Quest-giver variants (hooded wanderer, noble, farmer) | P2 | |

## 2. Creatures (box-UV entity sheets, vanilla-Minecraft rigs)

| Asset | Priority | Notes |
|---|---|---|
| Pig — snout fix | **P0** | Current pig face is flat; needs the protruding snout box painted/modelled (users read it as "missing nose"). |
| Dragon set: green/blue/red/black + wings | **P0** | Wings currently missing from the rig's art. RS-style dragons are THE aspirational mob. |
| Cow variant: Highland (shaggy) | P2 | |
| Goblin (green, ragged armour) | P1 | Iconic RS starter mob — model + sheet needed (new rig). |
| Imp (small, red, tail) | P2 | Classic RS pest. |
| Giant rat | P1 | Starter cave mob. |
| Skeleton warrior (rusted helm + shield) | P2 | Dressier skeleton tier. |
| Barrows-style wight (shadowed armour) | P2 | For crypt dungeons. |
| King-boss skins: Giant Mole, Kalphite-style beetle | P2 | Future bosses. |

## 3. Tools & Weapons (16×16 item icons + simple held models)

| Asset | Priority | Notes |
|---|---|---|
| Full tool ladders: axe/pickaxe in bronze→iron→steel→mithril-style→rune-style | **P0** | Current icons stop at a few tiers; RS metal palette: bronze (dull brown), iron (grey), steel (bright), mith (blue), addy (green), rune (cyan). |
| Garden hoe icon | **P0** | New tilling tool just added — currently reuses the axe emoji. |
| Fishing rods: basic → fly rod → harpoon | P1 | Harpoon for high fishing. |
| Bows: shortbow→oak→willow→maple→yew→magic (RS wood tints) | P1 | |
| Swords/scimitars per metal tier | P1 | The scimitar silhouette is very RS. |
| Armour sets per metal tier (head/body/legs/feet icons) | P1 | Currently stops at iron. |
| Smithing hammer, tongs, tinderbox | P1 | Tinderbox is iconic for Firemaking. |

## 4. Skill Stations & Props (16× tiles / small voxel props)

| Asset | Priority | Notes |
|---|---|---|
| Anvil (RS-style broad horn) | P1 | |
| Furnace (stone dome + orange glow mouth) | P1 | |
| Cooking range (brick + iron door) | P2 | Alternative to campfire. |
| Rune altar (standing stones + glowing glyphs per rune) | P1 | One glyph tint per rune type. |
| Summoning obelisk (purple crystal spire) | P1 | |
| Prayer altar (marble + gold trim) | P2 | |
| Farming plot states: tilled / seeded / sprouting / grown, per crop | **P0** | Tilling is now player-driven — the plot needs clear visual growth stages. |
| Market stall (striped canopy) | P1 | Thieving target. |
| Bank booth / bank chest | P1 | For a future banking system. |
| Cave ladder-in-ground (descend) + rope ladder (ascend) | **P0** | Replaces the "second cave entrance" descend art (#116). |
| Cave mouth (dark arch + support beams) | P1 | Surface entrance art pass. |
| Fence gate (already modelled; painted texture welcome) | P2 | |
| Agility props: log balance, rope swing, wall grips, cliff rope | P1 | Higher-tier shortcuts to place in the wild. |

## 5. World & Terrain (16×16 block tiles)

| Asset | Priority | Notes |
|---|---|---|
| Tree canopy/trunk variants: willow, yew, magic (blue shimmer) | P1 | RS woodcutting icons. |
| Flame/fire sprite sheet (campfire, firemaking line) | **P0** | Current flame particles read rough. |
| Ore vein overlays per metal (colour-true speckle) | P1 | Now full Minecraft-block size — tiles must read at 1 block. |
| Water: river/sea/marsh tints + fishing-spot shimmer | P2 | |
| Corrupted-biome set (dark grass, dead trees, purple veins) | P2 | For the evil overlays. |
| Road/path tiles (packed dirt with wheel ruts) | P2 | |

## 6. UI (pixel art)

| Asset | Priority | Notes |
|---|---|---|
| Skill icons ×33 (RS-style badge per skill) | **P0** | Currently emoji. Small 16/24px badges: crossed axes, pick, fish, flame, pot, anvil, bow, hoof, leaf, mask, etc. |
| Item icons for every item lacking canvas art | P1 | Egg, seeds, herbs, relics, runes (rune stones with glyphs), potions (RS 4-dose flask silhouette). |
| Quest scroll / exclamation badge | P2 | |
| Coin stack states (1 / few / pile) | P2 | |
| Compass + minimap ring frame | P2 | RS minimap has a strong identity. |

## 7. Player Housing (future — construction roadmap)

| Asset | Priority | Notes |
|---|---|---|
| Claimable plot marker (surveyor post + rope outline) | P2 | Phase 1 of claim-a-plot housing. |
| House frames: wood shack → cottage → stone house | P2 | Three build tiers. |
| Furniture set: bed, table, chairs, bookcase, trophy mount, hearth | P2 | Interior decoration items. |


---

## 8. Skill-expansion art (from SKILL_PLANS.md)

Props, stations, mobs and icons the skill build-outs need. Same RuneScape
style bible as above. Full per-texture spec for the world re-skin lives in
**TEXTURE_PACK.md**.

| Skill | New asset | Art direction |
|---|---|---|
| skill.foraging | Redberry Bush (`resource.bush.redberry`) | sprite.bush.redberry.full / .bare |
| skill.foraging | Cadava Bush (`resource.bush.cadava`) | sprite.bush.cadava.full / .bare |
| skill.foraging | Dwellberry Bramble (`resource.bush.dwellberry`) | sprite.bush.dwellberry.full / .bare |
| skill.foraging | Cloudberry Bush (`resource.bush.cloudberry`) | sprite.bush.cloudberry.full / .bare |
| skill.foraging | Jangerberry Vine (`resource.bush.jangerberry`) | sprite.bush.jangerberry.full / .bare |
| skill.foraging | Prickly Pear Cactus (`resource.bush.prickly`) | sprite.bush.prickly.full / .bare |
| skill.foraging | Whiteberry Bush (`resource.bush.whiteberry`) | sprite.bush.whiteberry.full / .bare |
| skill.foraging | Poison Ivy Bush (`resource.bush.poisonivy`) | sprite.bush.poisonivy.full / .bare |
| skill.foraging | Everlight Bramble (`resource.bush.everlight`) | sprite.bush.everlight.full / .bare (emissive cyan berries) |
| skill.foraging | 9 bush sprite pairs (full + bare) | sprite.bush.{redberry,cadava,dwellberry,cloudberry,jangerberry,prickly,whiteberry,poisonivy,everlight}.full and .bare |
| skill.hunting | Fowl Snare (`resource.trail.fowl`) | trail viewMaterial 'net' -> prop.trap.net |
| skill.hunting | Kebbit Burrow (`resource.trail.kebbit`) | trail viewMaterial 'box' -> prop.trap.box |
| skill.hunting | Boar Wallow (`resource.trail.boar`) | trail viewMaterial 'pit' -> prop.trap.pit |
| skill.hunting | Chinchompa Nest (`resource.trail.chinchompa`) | trail viewMaterial 'box' -> prop.trap.box |
| skill.hunting | Polar Kebbit Track (`resource.trail.polar`) | trail viewMaterial 'deadfall' -> prop.trap.deadfall |
| skill.hunting | Sabre-tooth Track (`resource.trail.sabre`) | trail viewMaterial 'pit' -> prop.trap.pit |
| skill.hunting | Grenwall Thicket (`resource.trail.grenwall`) | trail viewMaterial 'box' -> prop.trap.box |
| skill.hunting | Moonlight Antelope Track (`resource.trail.antelope`) | trail viewMaterial 'net' -> prop.trap.net |
| skill.hunting | 4 trap-rig props by viewMaterial | prop.trap.box, prop.trap.deadfall, prop.trap.net, prop.trap.pit |
| skill.archaeology | Barrow Mound (`resource.digsite.barrow`) | resource.digsite.barrow.face (viewMaterial 'barrow') |
| skill.archaeology | Sunken Ruin (`resource.digsite.ruin`) | resource.digsite.ruin.face (viewMaterial 'ruin') |
| skill.archaeology | Ashen Kiln (`resource.digsite.kiln`) | resource.digsite.kiln.face (viewMaterial 'kiln') |
| skill.archaeology | Buried Temple (`resource.digsite.temple`) | resource.digsite.temple.face (viewMaterial 'temple') |
| skill.archaeology | Frozen Citadel (`resource.digsite.citadel`) | resource.digsite.citadel.face (viewMaterial 'citadel') |
| skill.archaeology | Warforge Trench (`resource.digsite.warforge`) | resource.digsite.warforge.face (viewMaterial 'warforge') |
| skill.archaeology | Everlight Excavation (`resource.digsite.everlight`) | resource.digsite.everlight.face (viewMaterial 'everlight') |
| skill.archaeology | Senntisten Dig (`resource.digsite.senntisten`) | resource.digsite.senntisten.face (viewMaterial 'senntisten') |
| skill.archaeology | 8 digsite face textures by viewMaterial | resource.digsite.{barrow,ruin,kiln,temple,citadel,warforge,everlight,senntisten}.face |
| skill.thieving | Produce Stall (`resource.stall.fruit`) | Reuse the stall mesh (renderer.ts:1849): plank top on log legs, but recolor the two ware boxes to produce — wareA an orange pumpkin crate #d98a3d, wareB a green/red fruit pile #6a9a3a. Add a small hanging apron cloth on the front rail. OSRS muted tones, top-left light. |
| skill.thieving | Silk & Cloth Stall (`resource.stall.silk`) | Stall mesh with tall thin dyed-cloth bolt wares (two upright boxes in indigo #5566aa and madder #aa4466) and a draped cloth swag hanging over the front edge; slightly richer awning than the market stall. |
| skill.thieving | Spice Stall (`resource.stall.spice`) | Stall mesh with open sackcloth mounds of ground spice — ochre/paprika cones #b5651d and #7a5230 — plus a tiny brass balance-scale prop on the table corner. Warm desert-market palette. |
| skill.thieving | Gem Stall (`resource.stall.gem`) | NEW render case for view stall.glass: the plank table carries a translucent glass-topped display box (semi-transparent light box, opacity ~0.4) over a felt tray with 3-4 tiny faceted gem specks that catch a cyan/green/red glint; a small brass lock on the case front. Depleted state = empty open case. |
| skill.thieving | Scholar's Stall (`resource.stall.scholar`) | Stall mesh dressed as a bookseller/antiquary table: rolled parchment scrolls #d9c8a0, an open ledger #3a2d22, and a small locked brass cashbox at the back. Quill in an inkpot for the OSRS detail. |
| skill.thieving | Iron-Banded Strongbox (`resource.strongbox.iron`) | Reuse strongbox mesh (renderer.ts:1890) with a brighter iron band #8a8f98 and a steel latch plate; slightly more rivets than the old box. |
| skill.thieving | Merchant's Strongbox (`resource.strongbox.merchant`) | Strongbox mesh, brass-bound coffer: band #b8863b, a blob of red wax seal on the lid front. Dark oak body. |
| skill.thieving | Vault Strongbox (`resource.strongbox.vault`) | Strongbox mesh scaled ~10% taller, heavy double steel band #6f7680 with corner rivets and a keyhole escutcheon; near-black lacquered body. |
| skill.thieving | Royal Coffer (`resource.strongbox.royal`) | Strongbox mesh as a gilded coffer: gold trim band #d4af37, a small embossed crown motif on the lid, dark lacquer body — the treasure reads as royal. |
| skill.thieving | Warded Reliquary (`resource.strongbox.warded`) | NEW render case for strongbox.warded: blackened-iron chest, band #2a2f3a, with a strip of faintly glowing cyan runes (emissive #38c0d0) banding the lid — the ward. Cracked state = dark hollow with the glow snuffed out. Apex thieving prize. |
| skill.agility | PLACE the orphaned Frayed Cliff Rope (L10) (`object.shortcut.cliffrope`) | Already drawn: knotted rope + stake, same case as wallrope (renderer.ts:2014). To distinguish from wallrope, tint the rope darker/frayed #9c7f56 and lengthen it to ~3.2 for a taller cliff drop. |
| skill.agility | Stepping Stones (`object.shortcut.steppingstones`) | NEW render case: 3-4 flat mossy stone discs (low cylinders, terrain.stone with a #4c7a3d moss cap) set in a staggered line, each a touch different in height, with a small blob shadow under each — reads as hopping stones over water. |
| skill.agility | Rope Swing (`object.shortcut.ropeswing`) | NEW render case: a stout leaning takeoff post (bark log) with a knotted rope loop (ropeMat #b09265) hanging in an arc from an overhead branch stub; a worn dirt scuff at the launch foot. Jungle-vine feel. |
| skill.agility | Balance Beam (`object.shortcut.balancebeam`) | NEW render case: a long, thin, debarked log laid flat (like shortcut.log but 0.5 wide, no moss) with a single hip-height guide rope on one side strung between two short posts; weathered pale timber. |
| skill.agility | Crumbled Wall (`object.shortcut.crumbledwall`) | NEW render case: two stubby stonebrick pillar remnants with a collapsed rubble ramp of andesite/stone between them and a foothold notch; mossy mortar. Ruined-masonry OSRS palette. |
| skill.agility | Cliff Handholds (`object.shortcut.handholds`) | NEW render case: a vertical stone slab with a horizontal row of small dark iron peg handholds (little studs) driven in, and a chalk-scuffed narrow ledge below; a couple of pegs bent. Reads as a lateral cliff traverse. |
| skill.agility | Culvert Squeeze (`object.shortcut.culvert`) | NEW render case: a low stonebrick half-cylinder tunnel mouth set into a bank, a rusted iron grate shoved aside, a trickle of water at the lip. Dark, damp, sewer-toned. |
| skill.agility | Sheer Cliff Climb (`object.shortcut.cliffclimb`) | NEW render case: a tall sheer stone face (taller than cliffrope) with carved footholds and one taut fixed rope line anchored to a hammered iron spike at the top; no knots — a technical climb. ~4 units tall silhouette. |
| skill.agility | Chasm Leap (`object.shortcut.chasmleap`) | NEW render case: two raised rocky lips facing each other across an empty gap, a running-scuff mark and a small stacked-stone cairn marking the takeoff. Badlands/volcanic red-rock tones. The absence of any span sells the danger. |
| skill.agility | Rope Zip-line (`object.shortcut.zipline`) | NEW render case: a tall timber A-frame anchor (two crossed logs) with a taut rope line running off downhill to a distant lower stake, a wooden runner handle hanging on the line. Reads as a descent shortcut from height. |
| skill.agility | Spire Traverse (`object.shortcut.spiretraverse`) | NEW render case: a narrow rock spire/needle with a weathered rope-and-plank catwalk bridging to it from a ledge, double guide ropes, a couple of missing planks; the tallest, most dramatic shortcut silhouette. Wind-worn grey stone + frayed rope. |
| skill.brewing | Keen Forager's Brew (`item.potion.gathering_keen / recipe.potion_gathering_keen`) | 🧪 RS 4-dose flask, mossy-green liquid with a floating leaf fleck; brighter/greener than the base Forager's Brew, one extra dose line etched on the glass. |
| skill.brewing | Emberward Tonic (`item.tonic.warden / recipe.tonic_warden`) | 🧪 4-dose flask, deep forest-green tonic with a slow gold pulse; cork stopper wrapped in twine, ember-orange glint at the base. |
| skill.brewing | Greater Swiftness Draught (`item.potion.swift_greater / recipe.potion_swift_greater`) | 🧪 4-dose flask, pale cyan liquid with a frost rime creeping up the glass and a faint motion streak; silvered stopper. |
| skill.brewing | Greater Forager's Brew (`item.potion.gathering_greater / recipe.potion_gathering_greater`) | 🧪 4-dose flask, rich emerald brew with suspended leaf and a frost-blue swirl where the frostbloom dissolved; two etched dose lines. |
| skill.brewing | Greater Strength Tonic (`item.potion.strength_greater / recipe.potion_strength_greater`) | 🧪 4-dose flask, dark blood-red tonic with a bone-white sediment layer; heavy squat bottle, iron collar around the neck. |
| skill.brewing | Greater Stoneskin Brew (`item.potion.stoneskin_greater / recipe.potion_stoneskin_greater`) | 🧪 4-dose flask, murky grey-brown slurry with visible stone grit and a rime skin from the frostbloom; chipped clay stopper. |
| skill.brewing | Greater Hunter's Focus (`item.potion.focus_greater / recipe.potion_focus_greater`) | 🧪 4-dose flask, clear amber liquid with a single bright eye-glint suspended mid-flask; three fletched feathers tied to the neck. |
| skill.brewing | Greater Warden's Tonic (`item.tonic.warden_greater / recipe.tonic_warden_greater`) | 🧪 4-dose flask, luminous jade tonic with a slow pulsing glow and pale spore motes drifting inside; waxed cork, faint green halo. |
| skill.brewing | Super Swiftness Draught (`item.potion.swift_super / recipe.potion_swift_super`) | 🧪 Slim 4-dose flask, electric teal liquid with a fast comet-tail streak and a violet duskcap tint at the meniscus; polished pewter cap. |
| skill.brewing | Super Forager's Brew (`item.potion.gathering_super / recipe.potion_gathering_super`) | 🧪 Broad 4-dose flask, deep viridian brew crowded with leaf and spore matter, duskcap-purple cloud swirling through; three dose lines, brass collar. |
| skill.brewing | Super Strength Tonic (`item.potion.strength_super / recipe.potion_strength_super`) | 🧪 Heavy 4-dose flask, near-black crimson tonic lit from within by an ember-orange coal; dragon-bone shard fused to the iron collar. |
| skill.brewing | Super Stoneskin Brew (`item.potion.stoneskin_super / recipe.potion_stoneskin_super`) | 🧪 Squat 4-dose flask, gunmetal-grey slurry with a faint bolt-and-rivet motif etched on the glass and a violet duskcap skin; riveted iron band. |
| skill.brewing | Super Hunter's Focus (`item.potion.focus_super / recipe.potion_focus_super`) | 🧪 Tall 4-dose flask, brilliant gold liquid with a blazing ember-star at its heart and a sharp glint; fletched feathers and a fine chain at the neck. |
| skill.brewing | Super Warden's Tonic (`item.tonic.warden_super / recipe.tonic_warden_super`) | 🧪 Rounded 4-dose flask, luminous emerald tonic thick with drifting spores, strong rhythmic glow; wax-sealed cork under a green haze. |
| skill.brewing | Grand Swiftness Elixir (`item.potion.swift_grand / recipe.potion_swift_grand`) | 🧪 Ornate 4-dose flask, brilliant white-cyan elixir throwing off a comet-blur, a cut diamond set in the gilded stopper; frost lace over the whole bottle. |
| skill.brewing | Grand Forager's Elixir (`item.potion.gathering_grand / recipe.potion_gathering_grand`) | 🧪 Ornate 4-dose flask, deep jewel-green elixir with an emerald set in the collar and slow leaf/spore motes orbiting; gold filigree, four dose lines. |
| skill.brewing | Grand Strength Elixir (`item.potion.strength_grand / recipe.potion_strength_grand`) | 🧪 Ornate 4-dose flask, molten crimson elixir with twin ember cores and a dragon-bone motif carved into the base; blackened-gold collar. |
| skill.brewing | Grand Stoneskin Elixir (`item.potion.stoneskin_grand / recipe.potion_stoneskin_grand`) | 🧪 Ornate 4-dose flask, burnished steel-grey elixir with two glowing construct-core rivets flanking the glass; thick riveted band, faint violet sheen. |
| skill.brewing | Grand Hunter's Elixir (`item.potion.focus_grand / recipe.potion_focus_grand`) | 🧪 Ornate 4-dose flask, radiant gold elixir with twin ember-stars and a piercing central glint; fletched feathers fanned at the neck, gilt filigree. |
| skill.brewing | Grand Warden's Draught (`item.tonic.warden_grand / recipe.tonic_warden_grand`) | 🧪 Master 4-dose flask, deep viridian draught with a violet dragonstone set in a gold cage stopper, strong steady heartbeat glow; ornate gilt filigree, four bold dose lines. |
| skill.runecrafting | Copper Rune (Body) (`item.rune.body / recipe.rune_body`) | 🟫 Standing-stone rune tile: copper-brown weathered stone with a ribcage/torso glyph incised and faint verdigris in the grooves. Follows the existing per-rune tint convention (one glyph colour per rune). |
| skill.runecrafting | Star Rune (Cosmic) (`item.rune.cosmic / recipe.rune_cosmic`) | ✨ Standing-stone rune tile: deep indigo stone with a pinprick starfield glyph and a soft cyan glow bleeding from the carved lines. |
| skill.runecrafting | Crimson Rune (Chaos) (`item.rune.chaos / recipe.rune_chaos`) | 💥 Standing-stone rune tile: cracked crimson stone with a jagged burst/shatter glyph, hairline fractures glowing molten orange. |
| skill.runecrafting | Glowstone Rune (Astral) (`item.rune.astral / recipe.rune_astral`) | 💫 Standing-stone rune tile: pale gold luminous stone with a crescent-and-orbit glyph, a gentle warm halo radiating from the carving. |
| skill.herblore | Frostbloom Salve (`item.salve.frost / recipe.frost_salve`) | 🧊 Small pixel tin of frost-blue balm with a rime crust on the lid and a sprig of frostbloom pressed into the surface; RS potion-item scale. |
| skill.herblore | Duskcap Poultice (`item.salve.dusk / recipe.dusk_poultice`) | 🍯 Dark-violet cloth poultice bound with cord, a duskcap mushroom cap motif stamped on it and pale spores dusting the wrap; RS potion-item scale. |
| skill.construction | Carpenter's Bench prop (`art.object.buildbench.basic`) | OSRS-toned oak+steel, ~1 cell footprint, light from top-left, dark 1px silhouette — reads as 'woodworking station', clearly distinct from the plain Workbench and the metal Anvil. |
| skill.construction | Flatpack item icons (16x16) (`art.item.flatpack`) | 16x16 PNG, transparent, top-left light, near-black 1px outline; wire via ITEM_ICON_MATERIALS in src/ui/icons.ts. |
| skill.construction | Plot marker art (`art.object.plot.marker`) | OSRS-toned weathered oak + faded paint board, 1 cell, reads instantly as 'unclaimed ground'. |
| skill.construction | 3 house-frame exteriors (`art.homeframe.3tiers`) | OSRS earthy palette; each tier visibly richer in material and footprint so the upgrade reads at a glance from across the plot. |
| skill.construction | Interior furniture + decoration set (`art.furniture.set`) | 16px OSRS-toned props, wood tiers reading brown->red->deep-red->gilded to match the flatpack tints; interior-lit (top-left) to sit in the warm home theme. |
| skill.smithing | Steel armor set (`armor.*.steel`) | OSRS 16x16 inventory icons, pale silver-grey steel: rounded helm, plate chest, greaves, sabatons; dark 1px outline, top-left light. |
| skill.smithing | Mithril armor set (`armor.*.mithril`) | OSRS icons in deep royal-blue mithril tint, same four silhouettes. |
| skill.smithing | Adamant armor set (`armor.*.adamant`) | OSRS icons in dark olive-green adamant tint. |
| skill.smithing | Rune armor set (`armor.*.rune`) | OSRS icons in bright cyan-turquoise rune tint (the classic RS rune look). |
| skill.smithing | Diamond armor set (manual recipes) (`armor.*.diamond`) | OSRS icons: white-blue crystalline diamond facets set into a pale metal frame, faint sparkle highlight. |
| skill.smithing | Netherite armor set (upgrade recipes) (`armor.*.netherite`) | OSRS icons: dark crimson-black netherite metal, matte with a faint ember-red edge sheen (RS dragon-tier read). |
| skill.smelting | Steel / Mithril / Adamant / Runite bars (`item.bar.steel\|mithril\|adamant\|runite`) | OSRS ingot icons: steel pale-grey, mithril blue, adamant green, runite cyan — trapezoid bar, top-left highlight. |
| skill.mining | Mithril-veined Rock (`resource.rock.mithril`) | OSRS rock with blue mithril flecks; ore icon a blue rough nugget. |
| skill.mining | Adamantite Rock (`resource.rock.adamant`) | OSRS rock with green adamant flecks; ore icon a green nugget. |
| skill.mining | Runite Vein (`resource.rock.runite`) | OSRS rock with cyan runite flecks; ore icon a cyan nugget with faint glow. |
| skill.fishing | Feathered Fly Rod (`tool.fishingrod.fly`) | OSRS icon: slim wooden rod with a feathered fly-lure and thin line. |
| skill.fishing | Barbed Rod (`tool.fishingrod.barbed`) | OSRS icon: reinforced rod with an iron barbed hook. |
| skill.fishing | Pearlshell Rod (`tool.fishingrod.pearl`) | OSRS icon: pale rod inlaid with a pearlescent shell grip and sapphire bead. |
| skill.fletching | Steel / Mithril / Adamant / Rune Arrows (`item.arrow.steel\|mithril\|adamant\|rune`) | OSRS arrow-stack icons, metal head tinted by tier: steel grey, mithril blue, adamant green, rune cyan. |
| skill.boating | River Cutter (`tool.boat.cutter`) | OSRS icon: sleek single-mast cutter with a taut sail, dark hull outline. |
| skill.boating | Coastal Longship (`tool.boat.longship`) | OSRS icon: broad clinker-built longship with striped sail and a carved prow. |
| skill.enchanting | Runed Sabatons (gap filler) (`recipe.runed_boots`) | OSRS icon: iron sabatons wreathed in a faint violet rune-glow. |
| skill.enchanting | Enchanted Rod (gap filler, tops Fishing) (`recipe.runed_rod`) | OSRS icon: pearlshell rod with the line and tip glowing soft cyan-violet. |
| skill.enchanting | Astral Blade (ceiling extension) (`recipe.astral_sword`) | OSRS icon: diamond-edged sword with a starfield-violet enchant aura along the blade. |
| skill.summoning | Blood Lynx Pouch (`item.pouch.lynx`) | OSRS icon: crimson lynx-head pouch charm with tuft ears. |
| skill.summoning | Storm Drake Pouch (`item.pouch.drake`) | OSRS icon: blue-grey winged drake-head pouch charm with a static spark. |
| skill.invention | Bulwark Gizmo (`item.gizmo.bulwark`) | OSRS icon: brass-and-steel clockwork shield gizmo with a glowing core. |
| skill.invention | Titan Gizmo (`item.gizmo.titan`) | OSRS icon: heavy piston-fist gizmo, dark metal with red power lines. |
| skill.farming | Cornfield (`resource.plot.corn`) | OSRS icons: tall golden corn stalk (node) and a yellow cob (crop/seed). |
| skill.farming | Sunfruit Grove (`resource.plot.sunfruit`) | OSRS icons: round sun-orange fruit on a leafy bush (node) and a single glowing fruit (crop). |
| skill.magic | Superheat (fill gap) (`ALCHEMY.superheat`) | N/A (spell) — reuse the Blaze Rune icon; add a spellbook glyph if a Magic panel is built. |
| skill.magic | Grand Alchemy (ceiling) (`ALCHEMY.grand`) | N/A (spell) — reuse Ender/Law Rune icon in the alch UI. |
