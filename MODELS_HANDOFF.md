# Model & Art Handoff Spec (for external generators)

Give this file to whoever (or whatever) is generating art/models. Anything
that follows these conventions drops into the pipeline with no code changes.

## 1. Item / inventory icons
- **Format:** 64x64 PNG, transparent background, chunky pixel-art look.
- **Drop into:** `src/render/art/items/<kebab-name>-64.png`
  (runes go in `src/render/art/runes/`).
- **Bake:** `node scripts/bake-original-art.mjs` regenerates
  `src/render/original-art.ts`; then map the item id in
  `src/ui/icons.ts` `ITEM_ICON_MATERIALS` → `"icon.original.<kebab-name>"`.
- **Wanted next:** all remaining food, ores/bars (copper→netherite), armor
  pieces per tier, seeds/crops, logs per species, fish (raw+cooked), the
  necromancy rites, mount reins art (reins per species, not the old pouches).

## 2. Mob skins for CLASSIC rigs (our hand-animated rigs)
These are Minecraft-style entity atlases. The rig samples vanilla box-UV
layouts, so use the SAME layout as the vanilla mob named:
- zombie-family (husks, shamblers, wights): vanilla **zombie** layout, 64x64.
- spider variants: vanilla **spider** layout, 64x32.
- wolf variants: vanilla **wolf** layout, 64x32.
- slime variants: vanilla **slime** layout, 64x32.
- cow variants (prairie bull): vanilla **cow** layout, 64x64 (project cow is 64x64).
- construct/golem family: OUR construct atlas, 64x64 — copy the face
  placement of `src/render/art/entities/construct.png`.
- target dummy: 32x32 per-face sheet, copy `entities/dummy.png` placement.
- **Drop into:** `src/render/art/entities/<key>.png` where `<key>` matches the
  `ENEMY_SKINS` key in `src/render/renderer.ts` minus the `entity.` prefix
  (e.g. `entity.mire_husk` → `mire_husk.png`). Bake as above. The moment a
  variant's own file exists, the engine stops tinting the base skin and uses
  it — zero code changes.
- **Priority list with per-variant look notes:** ASSETS_NEEDED.md §"Mob skin
  variations" (husk family first, then spider, construct, slime, wolf,
  skeleton-variants, cattle).
- **New creature roster (fox, rabbit, stag/doe, crab, duck, goat, frog,
  squirrel, rat, wisp, mimic):** per-creature atlas specs with exact sizes,
  region lists and palette notes in ASSETS_NEEDED.md §"New creature roster —
  texture atlases needed". These are project-original rigs — follow the
  region grids there, not vanilla layouts (except duck = chicken layout,
  bandit = pillager layout).

## 3. Baked BB-models (creeper/skeleton/squid/ghast/warden/dragons…)
- These carry their own baked textures inside
  `src/content/mob-models-data.ts` / `dragons-data.ts` (Blockbench exports
  converted by `game/scripts/convert-mob-models.mjs`).
- **Do NOT hand these loose atlas PNGs** — an external atlas garbles their
  baked UV islands (we tried; the skeleton turned to noise).
- To replace one: supply a full **Blockbench .bbmodel** (geometry + texture
  embedded, idle pose standing, Y-up, 1 block = 16 units) and we re-convert.
- **Wanted:** dragon with real wings (current dragons render wingless),
  a bat with bigger silhouette, distinct drowned/stray variants.

## 4. Held tool sprites (shown in the player's hand)
- 16x16 PNG, transparent, item pointing up-right at 45° like vanilla.
- Wanted: bow, mattock, hoe, secateurs, trap, fishing rod tiers, hammer.
- Wire-up: `HELD_SPRITES` map in `src/render/renderer.ts`.

## 5. Terrain tiles
- 16x16 PNG, seamless-tiling. Append the id to `TERRAIN_ATLAS_ORDER` in
  `src/render/textures.ts` (APPEND ONLY — existing order is load-bearing).
- Wanted for the biome overhaul: mycelium variants, red-sand/terracotta
  band set, drygrass, petal-scattered grass, moss floor.

## Ground rules
- Palette: muted Minecraft-adjacent tones; strong silhouettes; no
  anti-aliasing (hard pixels only); transparency = fully transparent
  (alphaTest discards < 5% alpha).
- Names: kebab-case, ASCII, no spaces.
- Never overwrite an existing file with a same-name different-subject image.
