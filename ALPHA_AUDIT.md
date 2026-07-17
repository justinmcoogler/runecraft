# Alpha Readiness Audit — Runecraft

Eight parallel auditors swept the game (content integrity, textures, worldgen,
UX/onboarding, progression/economy, save/load, stability, multiplayer
readiness); seven returned full findings before the run was interrupted (the
Playwright stability pass was lost). Findings below are grouped by status.
Texture needs live in **ASSETS_NEEDED.md** (§2b has the exact file names);
this report carries the corrected counts.

## Fixed since the audit ran

- **Dev editor + delete-asset tool gated** behind `?dev` / `localStorage
  runecraft.dev=1` — auditors confirmed testers cannot reach it.
- **Debug panel gated** the same way (was fully open in Settings: noclip,
  time/weather override, collision overlay).
- **First death after graduating teleported the player back to the tutorial
  island** — a stale tutorial homePoint riding the save. Fixed: an endless-
  world death drops a tutorial home and respawns at the world spawn.
- **Player could stand on ores** (teleport-family arrivals + chunks streaming
  a node in underfoot). Fixed with a tick-level unstick guard + regression
  suite.
- **Tutorial guidance died after construction / done lessons didn't register**
  — both self-heal now (tracking re-pins every tick; masters check the XP
  ledger on report-back).
- **Selling to a shop with a full pack destroyed the item and paid nothing**
  — the sale now refuses (item restored) when the coins can't fit.
- **R key double-bound** (run toggle + camera tilt) — camera tilt moved to V.
- **Wild worlds listed ~35 unstartable tutorial-island quests** in the log —
  filtered unless actually started.
- **Wild-start welcome toast** referenced a camp chest that doesn't exist —
  reworded to the starter-kit reality.
- Cow walking backwards / sheep without wool / pig without a snout; fence
  gates disconnected + floating; farmyard/field visuals — all fixed earlier
  tonight.

## Refuted

- "Phantom vale-wall ring painted ~120 cells around endless spawns" — probed
  radially and around the ring at r=120: smooth height gradient, zero
  wall-like samples, no cobble. Not present in the current build.

## Open — worth fixing soon (not blocking tomorrow)

### Gameplay / economy
- **Agility shortcuts grant full XP with no cooldown** — a click loop prints
  Agility XP. Add a per-use cooldown or diminishing returns.
- **Death has zero penalty** and doubles as free fast-travel home. Acceptable
  for a friendly alpha; decide a penalty before wider testing.
- **Magic is gated behind Runecrafting 14** (~2–3h of essence) because fire
  runes only come from runecrafting. Seed fire runes into a shop.
- **Biome mob tables vs danger tiers**: some biome tables can host high-level
  elites regardless of distance ring (the near-spawn sweep tests pass, so
  exposure is limited to specific biomes; verify volcanic/corrupt edges).
- **Superheat uses 1 ore/bar vs furnace's 2** — strictly better; align costs.
- **Smithed gear below diamond can't be sold or alched** — add sinks.
- **Curator auto-confiscates all relics on talk**, including ones the player
  wanted to keep. Add a confirm.
- Potato/melon seeds unobtainable (dead-locks those plots + baked-potato
  recipe); three regional shops defined but their counters never placed; five
  upgrade tools ungrantable (magic secateurs/box trap, iron/dragon/crystal
  mattocks); top-end dead ranges (Herblore stops at L34, Prayer L40, Magic
  L44, Fishing L45).

### Save/load
- **No save happens inside dungeons** — refresh mid-dungeon loses the run
  (surfaces as "my progress vanished"). Save on floor transitions.
- **Reload mid-treasure-hunt dead-ends the chain** (target saved, hint lost).
- **Items deposited into streamed wild containers are destroyed on chunk
  retire** — either persist container diffs or make wild containers
  loot-only.
- **Endless saves have no format-version check** — add one before saves
  accumulate in the wild.
- Minor: planted crops / potion buffs / ground items don't survive reload;
  tutorial-island editor layer never re-applies.

### UX
- **Fast Travel (T) and Factions (G) are keyboard-only** — unreachable on
  phones. Add buttons.
- Escape both closes overlays and cancels the current action in one press.
- Death toast always says "wake at camp" regardless of actual respawn.
- Dead "Lesson X/N" banner code (TutorialDriver never instantiated) — delete.
- Worldgen debug overlay still on a public hotkey — gate with dev mode.
- Hud/input hotkeys lack a focused-input guard (typing a seed can steer the
  camera).

### Textures (corrected counts — ASSETS_NEEDED.md updated separately)
- **BLOCKER-tier art gap**: `armor.plate.{steel,mithril,adamant,rune,diamond,
  netherite}` have no material — high-tier worn armor has no art.
- 231 of 333 items lack icons (docs said 92) — biggest families: 33 potion/
  tonic/salve, 25 armor, 21 gem/bar/ore, 19 construction, 14 runes, plus
  relics/jewellery/ammo/summoning.
- Held-tool sprites missing: bow, mattock, hoe, secateurs, trap.
- 10 foraging bush tiers + 5 herb species + digsite/stall/strongbox/trail
  tiers share one sprite each; sunfruit/corn reuse pumpkin/wheat art.
- 4 mob skins missing from ENEMY_SKINS pre-wiring have since been added
  (§2b covers all 28 variant mobs).
- TEXTURE_PACK.md and ASSETS_NEEDED.md counts were stale — §2b is current;
  the icon counts above supersede the docs' "92".

### Worldgen (minor)
- "basalt" missing from the endless palette (ashlands render grass).
- Worldgen caches key the seed into 7–8 bits (collisions across worlds in one
  process — matters for multiplayer, see below).
- Buildings never check roadDist (can stamp astride a road); dungeon descend
  can share a cell with an ore; floor-1 exit lands on the cave-mouth's own
  blocked cell (the unstick guard now recovers this).

## Multiplayer readiness (for the next phase)

Verdict: **surprisingly good foundation.** The sim is deterministic given
(seed, inputs) — zero `Math.random`/`Date.now` in `src/sim`, all randomness
via seeded RNG, fixed 10 Hz tick; two same-seed sims ticked 600× serialize
byte-identically, and the sim runs headless in Node today. Renderer is
strictly read-only. Join-sync payload is tiny (~78 KB region, 3.6 KB player).

Ranked refactors before starting:
1. **Purge client model-prefs from the sim** (chunk-manager reads
   localStorage-backed `isModelEnabled`) — with it, no two clients agree on
   world state. Make disabled-assets a world/save property, not device state.
2. Route the ~10 remaining UI mutations through the Command queue so the
   input log is complete and serializable.
3. Move region travel into the sim (today main.ts destroys and rebuilds the
   whole GameSimulation).
4. Kill process-global worldgen state: `VALE_ACTIVE` and the seed-truncated
   cache keys (`seed & 0xff`) that collide across sims in one process.
5. Implement the planned per-chunk diff layer — it is both save fidelity
   (felled trees regrowing) and the network world-delta format.
