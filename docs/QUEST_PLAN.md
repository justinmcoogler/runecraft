# Runecraft — Tutorial Quest Plan (draft for review)

Concrete, orderable lesson script for the tutorial region (`region.tutorial`,
built by `createTutorial`). Every lesson reuses an activity that **already
exists in the sim** — the tutorial only places the target + drives a guided
objective and reveals the next one on completion. Edit freely; ✅ = required for
graduation, ○ = optional (can be skipped).

## How a lesson works (framework to build in P2)

Each lesson is a small object in a `TUTORIAL_LESSONS` list:

```ts
{ id, skill, title, blurb,          // shown in the quest tracker
  need: { objective },              // e.g. { gather: "resource.tree.basic", count: 1 }
  place: [ {defId|nodeId, cell} ],  // props/nodes/stations this lesson spawns
  marker: cell,                     // objective pointer + map ping (reuse quest tracker)
  reward?: { items? , xp? },        // optional grant on completion
  next: id }                        // the lesson revealed next
```

Drive it off existing sim events (`gatherComplete`, `craftComplete`,
`enemyKilled`, `itemObtained`, `skillXp`, `regionEntered`) — the quest/tracker
HUD already renders objective text + a map marker. On the last required lesson,
reveal the **graduation gateway** (already placed) and toast "You're ready —
step through the gateway."

## Tutorial layout (zones in the vale)

```
                 [Gateway to the Wild]  ← graduation, N of spawn
                         │
   [Altar Court]────[Village Square / Guide]────[Forge Row]
   prayer/magic/rune      (spawn, camp chest)       smelt/smith/craft/cook/fire
        │                       │                        │
   [Combat Pit]           [Gather Yard]              [Docks + Pond]
   attack/def/archery     tree/rock/herb/dig         fish/boat
```
The Guide NPC (reuse a villager skin for now) stands at spawn and points to the
next lesson.

---

## Act 1 — Basics ✅ (required)

| # | Lesson | Objective | Places |
|---|---|---|---|
| 1 | **Move** | Walk to the marker by the camp | a target flag |
| 2 | **Look around** | Rotate/zoom the camera | — |
| 3 | **Open your pack** | Open inventory, equip the **bronze axe** from the camp chest | camp chest w/ starter tools |
| 4 | **Set your spawn** | Sleep in the camp **bed** | bed |

## Act 2 — Gathering (Gather Yard)

| # | Skill | Objective | Places |
|---|---|---|---|
| 5 ✅ | **Woodcutting** | Chop the marked tree → 1 log | `resource.tree.basic` |
| 6 ✅ | **Mining** | Mine the marked rock → 1 ore | `resource.rock.copper` (+ tin nearby) |
| 7 ○ | **Foraging** | Pick the marked bush/flora | `resource.bush.berry` |
| 8 ○ | **Farming** | Sow a seed in the plot; come back to harvest | `resource.plot.wheat` + seed |
| 9 ○ | **Herblore (gather)** | Pick the marked herb | `resource.herb.mint` |
| 10 ○ | **Hunting** | Set a trap on the game trail; collect the catch | `resource.trail.rabbit` |
| 11 ○ | **Archaeology** | Excavate the dig site → a relic | `resource.digsite.basic` |
| 12 ○ | **Thieving** | Pickpocket the stall / crack the locked chest | `object.stall.market`, locked chest |
| 13 ○ | **Fishing** | Catch a fish at the pond | `resource.fishing.pond` |

## Act 3 — Processing (Forge Row)

| # | Skill | Objective | Places |
|---|---|---|---|
| 14 ✅ | **Firemaking** | Light your logs into a campfire | (uses log from #5) |
| 15 ✅ | **Cooking** | Cook the raw fish/meat on the fire | fire (uses fish from #13 or given raw meat) |
| 16 ○ | **Smelting** | Smelt copper + tin → a bronze bar | `object.furnace.basic` |
| 17 ○ | **Smithing** | Forge the bar into a dagger at the anvil | `object.anvil.basic` |
| 18 ○ | **Crafting** | Craft leather/cloth at the workbench | `object.workbench.basic` |
| 19 ○ | **Fletching** | Cut a log into arrow shafts / a shortbow | workbench (uses log) |
| 20 ○ | **Brewing** | Brew a simple potion (uses herb from #9) | `object.cauldron.basic` |
| 21 ○ | **Construction** | Raise the marked build-site piece | `object.buildsite.*` |

## Act 4 — Spiritual (Altar Court)

| # | Skill | Objective | Places |
|---|---|---|---|
| 22 ○ | **Runecrafting** | Bind essence → a rune at the altar | `object.altar.rune` |
| 23 ○ | **Magic** | Cast the starter spell (uses a rune from #22) | a practice target |
| 24 ○ | **Prayer** | Bury bones / pray at the altar | bones + `object.altar.rune` |
| 25 ○ | **Enchanting** | Enchant an item at the enchanter | `object.enchanter.basic` |
| 26 ○ | **Summoning** | Make a pouch, summon a familiar | pouch materials |
| 27 ○ | **Necromancy** | Raise a shade at the obelisk | `object.obelisk.summon` |
| 28 ○ | **Invention** | Assemble a gizmo from parts | parts + workbench |

## Act 5 — Combat & movement (Combat Pit)

| # | Skill | Objective | Places |
|---|---|---|---|
| 29 ✅ | **Attack / Strength** | Hit the training dummy → melee XP | `enemy.dummy` (or a weak pig) |
| 30 ○ | **Defense / Constitution** | Trade blows with a weak foe; eat to heal | weak `enemy.pig`; cooked food |
| 31 ○ | **Archery** | Shoot the target with a bow | target + `tool.bow.wood` |
| 32 ○ | **Slaying** | Take a task from the taskmaster; kill the assigned foe | taskmaster NPC + spawn |
| 33 ○ | **Agility** | Cross the marked shortcut/obstacle | `object.shortcut.*` |
| 34 ○ | **Boating** | Craft a raft; paddle across the pond | pond + raft materials |
| 35 ○ | **Dungeoneering** | Enter the tiny tutorial dungeon, clear one room, exit | a `portal.cave` → 1-room dungeon |

## Graduation ✅

When the **required** lessons (1–6, 14, 15, 29) are done, the Guide says
"You're ready for the wild," the **gateway** lights fully, and a "**Skip the rest
& graduate**" prompt appears. Stepping through:
- marks `tutorial.done`,
- carries all XP + starter kit,
- drops the player into their own random world (the seed picked at New World).

Optional lessons stay available until you graduate, so completionists can do all
33 first.

---

## Carry-over on graduation
- Bronze tools (axe, pickaxe), a few starter logs/ore/food, and **all XP earned**.
- Respawn/bed resets to the new world's first safe ground.

## What P2 builds (from this plan)
1. `TUTORIAL_LESSONS` data + a lightweight lesson driver (hooks existing sim
   events; renders via the quest tracker).
2. Authored placement in `tutorialRegion()` for each lesson's nodes/stations,
   arranged in the zones above.
3. Guide NPC + objective pointer; the "skip & graduate" prompt.

## Open questions for you
- **Required set** — is 1–6, 14, 15, 29 the right "must-do" core, or do you want
  more (e.g. one from each act) before the gateway opens?
- **Guide NPC** — reuse a villager skin for now, or wait for custom art?
- **Rewards** — grant a small item per lesson, or just XP?
- Any **signature moment** you want scripted (e.g. "first tree → first fire →
  first cooked fish" as a mandatory opening beat)?
