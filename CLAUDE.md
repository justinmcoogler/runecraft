# Stoneleaf Vale — working rules

- **Minecraft-exact sizes, always.** Anything that exists in Minecraft (mobs,
  items, blocks, structures, held items) must be modeled at Minecraft's exact
  dimensions: 16 px = 1 block, using the `PX` unit from `render/skin.ts`
  (player = 32 px = 1.8 units). Consult the vanilla model box specs
  (quadruped, spider, etc.) rather than eyeballing proportions.
- **Grid perspective.** World structures are built from axis-aligned unit
  blocks on the cell grid — no arbitrarily rotated boxes. Prefer shaping the
  terrain itself (heights/blocks in `sim/world.ts`) over free-floating props.
- **Everything is a Minecraft block or model — no arbitrary boxes.** Every
  prop must be composed of pieces at Minecraft dimensions: full 1×1×1 cubes
  (barrels, crates, pumpkins, ore), slabs (roof steps), fence posts (4 px)
  and rails (2–3 px), doors (1×2×3⁄16), panes (2 px), lanterns (6×7 px),
  chests (14⁄16), and plants as crossed 16×16 sprites (crops, flowers,
  herbs, bushes). If a size isn't a Minecraft block/model size, don't ship
  it — snap it to the nearest one.
- **Original art only.** Sizes and layouts may follow Minecraft exactly, but
  every shipped texture, skin, sound, name, and character must be original or
  properly licensed. Never bundle or redistribute third-party assets; user
  imports (skins, resource packs) stay on the user's device.
- **Minecraft items/blocks render from the texture system, never ad-hoc boxes.**
  Anything that is a real Minecraft item or block (torches, tools, lanterns,
  ore, food, …) must be drawn from a logical material id resolved through
  `MaterialResolver.texture()` — so a loaded resource pack's art overrides it —
  and shaped on the vanilla model (torches = crossed 16px planes for a
  standing/wall torch, or the diagonal-handle item sprite when carried in-hand
  via `setHeldItem`, exactly like the axe). Never model such a thing as a plain
  coloured `THREE.Box`. Held equipment (tools, torch) always goes through
  `CharacterView.setHeldItem` so it grips in the fist and swings with the arm.
  The built-in art lives in `render/textures.ts` (`CUSTOM_DRAW`/`TILE_SPECS`);
  add the id there so packs can override and the look degrades gracefully.
- **Minecraft block behavior parity (REQUIRED for every parsed asset).** When
  a `.nbt`/`.schem`/model asset is imported, its blocks must behave the way
  they do in vanilla Minecraft — never as inert scenery. This is a hard
  acceptance criterion, enforced by `structures/__tests__/block-parity.test.ts`:
  - **Stairs are walkable** — a floor-level stair block you can step onto/up,
    not an impassable wall (`structures/types.ts` walkability + `renderer.ts`
    oriented stair geometry).
  - **Slabs / half-steps are walkable** — a bottom slab at floor level is a
    stand-on surface, not a blocker.
  - **Doors are openable** — every `*_door` maps to a real open/close object
    (see `homeDoors()` in `sim/worldgen/endless.ts` + `openDoor()` in
    `simulation.ts`), and fence gates and trapdoors toggle too — never a
    static passable panel.
  - **Big builds are solid landmarks you enter through a door-portal.** A large
    multi-storey import doesn't flatten into a walkable 2.5D shell — mark its
    placement `solid` (blocks the whole mass, `solidColumns()` in
    `structures/types.ts`) and hang a door-portal into a clean, purpose-built
    interior region (`houseInteriorId()`/`buildHouseInterior()` in
    `sim/world.ts`). Clicking anywhere on the building enters it — a walled-in
    door with no reachable cell fires the portal on the spot (`actions.ts`),
    and the interior's exit door returns to the yard cell out front.
  - **Windows are translucent** — glass, glass panes, stained glass, and
    iron bars carry `translucent` and render see-through (`transparent`,
    face-culling skips them so they don't hide neighbors).
  - **Fences/walls block movement**, **ladders/vines are climbable**, and
    **anything solid in Minecraft blocks navigation**. If a mapped block's
    real-world behavior isn't wired, wire it (in `structures/mapping.ts` +
    the sim) before shipping the import — do not degrade it to decoration.
  Any new block kind added to `structures/mapping.ts` must declare its
  behavior and get a case in the parity test.
- **Sim first.** Gameplay changes go in the headless simulation with tests
  (`npx vitest run game/src`), then presentation. The HUD and renderer only
  emit commands and react to events.
- **Verify in the browser.** Every visual change gets a Playwright screenshot
  check against the dev server before shipping, then `node
  game/scripts/build-standalone.mjs` and a commit.
