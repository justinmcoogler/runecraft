# Runecraft — Tutorial Island → Random World (scope)

## Vision

A new player starts in a small, hand-authored **tutorial region** (a walled
learning ground), works through a short lesson for **every skill**, and — once
the required lessons are done — steps through a **graduation portal** that drops
them into a **freshly-seeded random endless world** to play for real.

This mirrors RuneScape's Tutorial Island: a safe, guided on-ramp, then the open
world. The random world is already fully random from spawn (the origin vale/wall
is removed — `STARTER_VALE = false`); the vale geometry is retained in code to
build the tutorial region.

```
Start screen ── New World ─▶ Tutorial region ──(finish core lessons)──▶ Graduation portal ─▶ random seed world
                └ Continue ─▶ your saved random world (skips tutorial if already graduated)
```

---

## Architecture (reuse what exists)

| Need | Reuse |
|---|---|
| Tutorial ground | The walled vale geometry (`valeWall`/gates/quarry/paths in `endless.ts`), promoted to its own **`region.tutorial`** with authored content. |
| Lesson tracking | The existing **quest system** (`sim/quests`, quest log + tracker HUD) — each lesson is a quest step with an objective + map marker. |
| Teleport out | The existing **portal object** + `enterRegion` flow (same mechanism as dungeon portals). |
| Carry-over | `captureSharedState`/`applySharedState` already move player state (skills, inventory, bed) between regions. |
| "Graduated" flag | A `worldFlag` (`tutorial.done`) persisted in the save; the start screen and portal read it. |

New pieces to build: the tutorial region builder (authored props/NPCs per
lesson), a **lesson/objective driver**, the **graduation portal**, and start-screen
wiring (`New World` → tutorial the first time, with a **Skip tutorial** option).

---

## The lessons — one per skill (all 33)

Grouped by how they're taught. Each lesson reuses that skill's existing activity;
the tutorial just provides the node/station/target and a guided objective. ✔ = the
skill's activity already exists in the sim.

### Movement & basics (pre-skill)
- **Move / camera** — walk to a marker.
- **Inventory & equip** — open the pack, equip the starter axe.
- **Save & respawn** — sleep in a bed to set spawn.

### Gathering
1. **Woodcutting** ✔ — chop the marked tree.
2. **Mining** ✔ — mine ore in the tutorial quarry.
3. **Fishing** ✔ — catch a fish at the pond.
4. **Foraging** ✔ — pick the marked bush/flora.
5. **Farming** ✔ — sow a seed in a plot, harvest when grown.
6. **Hunting** ✔ — set a trap on the game trail, collect the catch.
7. **Herblore** ✔ — gather the marked herb. *(processing half taught under Brewing.)*
8. **Archaeology** ✔ — excavate the dig site, hand the relic to the curator.
9. **Thieving** ✔ — pickpocket the stall / open the locked chest.

### Processing / crafting
10. **Firemaking** ✔ — light logs into a campfire.
11. **Cooking** ✔ — cook raw food on the fire.
12. **Smelting** ✔ — smelt ore into a bar at the furnace.
13. **Smithing** ✔ — forge a bar into a tool/weapon at the anvil.
14. **Crafting** ✔ — craft an item at the workbench (e.g. leather/cloth).
15. **Fletching** ✔ — cut a log into arrow shafts / a bow.
16. **Brewing** ✔ — brew a simple potion (uses the herb from lesson 7).
17. **Construction** ✔ — raise a marked build-site piece.
18. **Runecrafting** ✔ — bind essence into a rune at the altar.
19. **Enchanting** ✔ — enchant an item at the enchanter.
20. **Invention** ✔ — assemble a gizmo from parts.
21. **Boating** ✔ — craft a raft and paddle across the tutorial pond.

### Combat & defence
22. **Attack** ✔ — melee the training dummy / a weak foe.
23. **Strength** ✔ — (shares the melee lesson; note the strength XP).
24. **Defense** ✔ — block/take hits from a weak foe.
25. **Constitution** ✔ — (taught passively via combat; note HP/heal by eating).
26. **Archery** ✔ — shoot the target with a bow.
27. **Slaying** ✔ — take a task from the taskmaster, kill the assigned foe.

### Support / spiritual
28. **Prayer** ✔ — bury bones / pray at the altar.
29. **Magic** ✔ — cast a starter spell (uses a rune from lesson 18).
30. **Summoning** ✔ — make a pouch, summon a familiar.
31. **Necromancy** ✔ — raise a shade at the obelisk.
32. **Agility** ✔ — cross the marked shortcut/obstacle.
33. **Dungeoneering** ✔ — enter the tutorial's tiny dungeon, clear one room, exit.

> Every skill's *doing* already exists in the headless sim — the tutorial supplies
> the target + a guided objective, so no new gameplay systems are required, only
> authored placement and lesson scripting.

### Gating
- A short **required core** unlocks graduation: Move, Inventory, Save, and one
  gather (Woodcutting) + one process (Firemaking→Cooking) + one combat (Attack) —
  enough to survive.
- The other lessons are **optional** and can be done or skipped; a "skip the rest
  and graduate" prompt appears once the core is done, so veterans aren't trapped.

---

## Graduation

1. Finishing the required core reveals the **graduation portal** (a lit gateway
   in the tutorial square).
2. Interacting rolls a **fresh random seed**, sets `worldFlag: tutorial.done`,
   captures player state, and `enterRegion` into `region.endless` at that seed.
3. Carry-over: starter tools + a little starting stock + all XP earned in the
   tutorial. Bed/respawn resets to the new world's first safe ground.
4. Thereafter, **Continue** loads the random world directly; **New World** offers
   "replay tutorial" or "skip to a fresh random world".

---

## Build phases (small, staged — each shippable)

1. **P0 (done):** de-vale the random world (`STARTER_VALE = false`), rename to
   Runecraft.
2. **P1 — Graduation spike:** a bare tutorial region + a single graduation portal
   → fresh random seed. Prove the "finish → dropped into the wild" moment.
3. **P2 — Core lessons:** the required-core lessons wired to the quest system
   (move/inventory/save/chop/fire/cook/attack) + the skip-to-graduate prompt.
4. **P3 — All-skill lessons:** author the remaining ~26 lessons, one region zone
   per lesson cluster (gathering yard, forge row, altar court, combat pit, docks,
   tiny dungeon).
5. **P4 — Polish:** guide NPC/dialogue, objective pointers, completion rewards,
   "graduated" cosmetics.

## Open decisions (need your call)

- **Tutorial persistence:** one-and-done per save (recommended) vs. a returnable
  hub.
- **World content:** the random world currently streams **bare terrain + roads**
  (`CLEAR_ASSETS = true`). Graduating into a world you can actually *skill* in
  means turning world content **on** (trees, ore, mobs, villages). Recommend
  enabling it as part of P1 so the destination is a real, playable world.
- **One world or many:** single random world (recommended v1) vs. a hub that
  spawns several (later, multiplayer-adjacent).
