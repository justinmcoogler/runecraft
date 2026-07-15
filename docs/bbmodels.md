# Blockbench mob models — how the pipeline works

The dragons are Blockbench/GeckoLib `.bbmodel` files baked into the game.
The same pipeline takes **any** animated entity model pack, so new mobs are
mostly a converter run plus one enemy definition. This documents every step
and the coordinate conventions that were audited into correctness.

## Adding a new mob pack

1. Drop the pack somewhere with this shape (the usual ModelEngine layout):
   ```
   pack/
     models/my_mob.bbmodel     (meta.model_format "animated_entity_model", box_uv)
     textures/my_mob.png       (matches textures[0].name inside the bbmodel)
   ```
2. Re-bake, listing every pack (the output is one merged file):
   ```
   node game/scripts/convert-bbmodels.mjs \
     <dragons pack dir> <new pack dir> [...]
   ```
   Output: `game/src/content/dragons-data.ts` (the name is historical — it
   is the whole baked Blockbench model library).
3. Add an enemy definition in `game/src/content/content.ts` with:
   ```ts
   view: "dragon",              // the generic Blockbench-model enemy view
   viewMaterial: "my_mob",      // the .bbmodel file's base name
   ```
   Stats, loot, aggro etc. work like any other enemy.
4. Spawn it (endless biome feature tables in `worldgen/endless.ts`, or any
   region builder), and add it to the province coverage-test exemption list
   in `worldzones.test.ts` if it is endless-only.

Licensing reminder: only bake packs the project is licensed to use, and
never commit the raw pack files themselves — the baked data ships, the
`.bbmodel` sources stay on the owner's machine.

## What the converter keeps (`convert-bbmodels.mjs`)

- **Cubes**: `from`/`to`/`origin`/`rotation`/`uv_offset`/`inflate` per
  element (only `type: "cube"` elements; box UV assumed).
- **Bones**: the outliner tree — name, pivot (`origin`), static rotation,
  which cubes belong to it, child bones. Groups named `hitbox` are dropped.
- **Animations**: for every animation, each bone's `rotation` and
  `position` keyframe tracks as `[time, x, y, z]` rows (first data point,
  sorted by time). Name, length, and loop flag come along.
- **Texture**: the first texture, inlined as a PNG data URI.

## Runtime (`render/bb-models.ts`)

- Units: Blockbench works in Minecraft pixels — divide by 16 for world
  units, matching the game's `PX` convention. Pivots in a bbmodel are
  absolute; each THREE bone group is positioned at
  `(pivot − parentPivot) / 16` and cubes at `(center − pivot) / 16`.
- **Static rotations (bones and cubes) apply exactly as stored** with
  euler order **ZYX**. Blockbench renders with three.js, so the file holds
  editor-space values. (Negating x/y here was the bug that scrambled the
  dragon wings — that flip belongs to animations only.)
- Rotated cubes pivot about their own `origin` via a wrapper group.
- **Animation keyframes use the bedrock/GeckoLib convention**: applied as
  `(−x, −y, +z)` degrees on top of the bone's base rotation; positions as
  `(−x, +y, +z) / 16` offsets. Interpolation is smoothstep between keys
  (close enough to Blockbench's catmull-rom at game scale).
- Box UV unwrap per cube of size (w,h,d) at offset (u,v), three.js face
  order `+x −x +y −y +z −z`:
  `right (u, v+d)`, `left (u+d+w, v+d)`, `top (u+d, v)`,
  `bottom (u+d+w, v)`, `back (u+d+w+d, v+d)`, `front (u+d, v+d)` —
  u-mirrored, matching `render/skin.ts`.
- `BBAnimator.play("idle" | "walk" | "attack" | ...)` switches tracks; the
  enemy update loop plays `walk` while moving, `attack` while lunging,
  `idle` otherwise.

## Enemy integration (`render/renderer.ts`)

- View kind `"dragon"` builds the model by `def.viewMaterial`, tints all
  materials if the def has `tint`, and sizes the health bar from the
  model's real height.
- Blockbench-model mobs get a per-instance size spread (0.75×–1.4×,
  hashed from the instance id) so encounters vary; classic vanilla rigs
  stay exact-scale.
- Occlusion silhouettes and pick/tap targeting work automatically — the
  ghost pass and `userData.instanceId` tagging traverse whatever the
  builder returns.
