# Stoneleaf Vale — Alpha-Test Readiness Audit

Living checklist for the first outside playtest. Statuses: ✅ ready,
🔧 fixed during this audit, ⏳ scheduled (expansion rounds), 📋 beta-scope.

## Core loop & safety

- ✅ **Death is safe.** Blacking out respawns at camp with full health and
  inventory intact (`simulation.damagePlayer`), with a toast and sound.
- ✅ **Saves survive.** Format v2 with round-trip tests; old-format saves
  are discarded cleanly rather than corrupting.
- ✅ **Every skill is trainable** from a fresh spawn (proven in
  `overworld.test.ts`), and every settlement, dungeon door, landmark and
  expansion exit is reachable by flat-walk flood-fill from spawn — the
  Primary Accessible Route rule is machine-checked on every test run.
- ✅ **Quest chain is acyclic** over real givers, items and enemies.
- ✅ **Dungeon routes** (entrance → boss → exit) verified per dungeon.

## Onboarding & UX

- 🔧 **How-to-play help** now lives in the ⚙ Settings panel (movement,
  interaction, hotkeys, crafting, death rules).
- ✅ **Mobile HUD** uncrowded: toggle row lifts above the action row on
  phones, action plate centered, icon-only toggles under 720 px.
- ✅ First-run toast points at the nearest tree; taskmasters, quest
  tracker and skills panel cover progression discovery.
- 📋 A proper quest-arrow/waypoint system — beta.

## Content completeness

- ✅ Skill ladders shipped for woodcutting (oak→dark oak + 9 grand trees),
  mining (copper→diamond), fishing (shallows→deepwater), cooking,
  smithing (copper→diamond gear + gold jewelry), farming (wheat→melon),
  herblore (sage→duskcap), slaying (12-rung assignment rotation),
  agility, construction, archaeology, hunting, thieving.
- ✅ 19 settlements, 9 dungeons, 50+ named landmarks, 73 monster dens,
  ~15k resource nodes, ~500 enemy spawns, 34 roads and trails, 201
  registered POIs — all proven reachable; atlas regenerable via
  `node game/scripts/build-atlas.mjs`.
- 🔧 Peatlight Hamlet was a bare plank field — now a railed stilt village
  with five houses, market, benches, freight, lamps and reed beds.
- ✅ Frontier quadrants filled (expansion rounds 1–5): the North-West
  Reaches (Cloudrest Monastery, Mirror Tarn, Hermit's Slope, Sky
  Altar), the West Marches (Westmarch Post, Sundered Court), the
  North-East pinewoods (Tollhouse Crossing, Nine Firs Quarry, Ridge
  Beacon), the far Sunscar east (Saltpan Caravanserai, Dune Tombs,
  Glass Flat) and the South-West downs (Longfold Steading,
  Barrowfield, Sweetspring Hollow).

## Performance

- ✅ Terrain streams in 50-cell chunks, entities in a 130-cell radius;
  final end-to-end pass (boot → pathfinding walk → gathering → map →
  dungeon round-trip) ran with zero page errors.
- ✅ Standalone build ≈ 1 MB, loads to playable in ~5–7 s.
- 📋 Height/block arrays are JS arrays over 6.25 M cells; a typed-array
  palette would cut memory for low-end phones — beta.

## Known paper cuts

- 📋 Zone banner briefly shows the overworld zone inside a dungeon
  before fading (cosmetic).
- 📋 Economy has few coin sinks (no inn fees, repairs, or fast travel).
- 📋 No audio settings toggle.
