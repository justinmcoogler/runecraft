# Stoneleaf Reach — World & Story Bible

Authoritative canon for the continent, its history, and the main storyline.
Nothing here may be contradicted by later content. Deliberate changes must
edit this file in the same commit.

## The world in one paragraph

The **Stoneleaf Reach** is a continent stitched together by **the Braid** — a
network of roads, bridges, boardwalks, tunnels, pump-stations, mountain lifts
and coastal beacons built long ago by an engineer-civilization called the
**Braidwrights**. Beneath the visible network, the Braid was also a governor:
buried **anchor-coils** bled away the **Understrain**, a slow pressure that
builds beneath the continent and warps living things where it leaks. Three
centuries ago an over-tightened anchor snapped and the network cascade-failed
— **the Sundering**. Rivers rerouted, bridges fell, the Braidwrights' capital
**Undervault** was buried, and their knowledge scattered. Today the anchors
are failing one by one, Understrain leakage is agitating the wild creatures,
and the scattered settlements of the Reach are slowly being cut off. The
player is a newly sworn apprentice of the **Roadwrights' Guild**, sent to
mend the first broken span — and pulled, one repair at a time, into the
question the Sundering left behind: *what was the Braid holding down?*

## Timeline

| Era | Event |
| --- | --- |
| ~800 years ago | The Braidwrights unify the Reach; the Braid is woven. Undervault founded above the Loomheart, the Braid's central governor. |
| ~500 years ago | Height of the network: ferries, lifts, beacons; the Understrain is fully bled and the deep creatures sleep. |
| ~300 years ago | **The Sundering.** An over-tightened anchor cascades. Undervault is buried in a day. Rivers change course; the Great Meander cuts the continent in two. |
| ~300–50 years ago | The long quiet. Settlements re-form around surviving Braid pieces. Factions inherit fragments of Braidwright knowledge. |
| ~40 years ago | Castle Stoneleaf rebuilt on old Braid foundations; Steward Corin's line keeps the king's road open. |
| ~10 years ago | Anchors begin failing in sequence. Monster migrations start. The Relight forms. |
| Year 0 (now) | The West Span falls. The player takes the Roadwrights' oath at Bellbrook. The game begins. |

## The central conflict

- **The Roadwrights' Guild** (player's faction) repairs what people need,
  piece by piece, and wants the Braid *understood* before it is re-powered.
- **The Relight**, led by Provost **Serah Vane**, is relighting every Braid
  station at full power to restore the old golden age. Vane is sympathetic:
  Mirefen starved for a winter when the East Ferry line failed, and she
  buried her sister that year. She is also wrong: full power without
  balancing coils re-tightens the anchors — the exact mistake that caused
  the Sundering.
- **The Magpie Company**, salvagers under Captain **Corvo Bray**, strip
  anchor-coils from ruins and sell them — often to the Relight. Bray is the
  recurring rival: faster than the player, cheerfully mercenary, and
  gradually horrified by what loose coils do to the land.

**Midgame revelation (Act III):** records in the Verdant Archive and the
Gilded Cistern prove the Braid was a governor valve, not just infrastructure.
The Sundering was not an accident of age — it was an overload. The Relight's
program is rebuilding the overload.

**Endgame (Act V):** a race to recover stabilizer coils before Vane brings
the Loomheart to full power. The final descent through buried Undervault
ends at the Loomheart and its keeper — **the Custodian of the Loom**, the
Braidwrights' last warden-construct, still executing its corrupted final
order: *let no hand tighten the Braid again.* It cannot tell menders from
tighteners. Defeating (not destroying) it lets the player seat the recovered
coils and **rebalance** the Loomheart: the Understrain bleeds again, the
monsters recede, and every repaired span, ferry and beacon across the Reach
lights up. Vane, shown the Sundering records, stands down; her followers
splinter (expansion hook).

## Why the player travels everywhere

Each act needs stabilizer coils and knowledge that survive only in the
regional anchor-sites — every major region holds one Braid anchor, its
dungeon, and a settlement that depends on the route the player restores.

## Story delivery rules

- Lore arrives through NPC talk lines, quest dialogue, ruins, dungeon set
  dressing, and visible world changes — never through long text dumps.
- No prophecy; the player earns standing by fixing things.
- The antagonist is reasonable, present from Act II, and reachable by words
  at the end.

## Canon glossary

| Term | Meaning |
| --- | --- |
| The Braid | The continent-wide Braidwright network (roads, spans, stations, anchors). |
| Anchor / anchor-coil | Buried governor node; its coil bleeds Understrain. Dungeon prizes. |
| Understrain | Slow pressure under the continent; leakage agitates and warps creatures. |
| The Sundering | The cascade failure ~300 years ago. |
| Undervault | Buried Braidwright capital; final dungeon. |
| The Loomheart | Central governor beneath Undervault. |
| Custodian of the Loom | Final boss; last warden-construct. |
| The Meander | The great west–east river cut by the Sundering. |
| Stabilizer coil | Recoverable component needed to rebalance the Loomheart. |

## The five acts (main quest line, 18 quests)

Quest IDs are canon. ✅ = implemented in the sim today; ⏳ = designed, not yet implemented.

### Prologue — The First Broken Road (levels 1–10, Central Basin)
1. ✅ `quest.first_timber` — Old Alder teaches Woodcutting/crafting.
2. ✅ `quest.tin_and_temper` — smelting and smithing at the camp forge.
3. ✅ `quest.the_gnasher` — first dungeon (Copper Hollow), first boss (Old Gnasher).
4. ✅ `quest.the_first_span` — repair the fallen **West Span** over the Meander with engineer **Wren Fairweather** (sets `worldstate.bridge_west_repaired`; opens the west road).

### Act I — Roots and Ridges (levels 10–25, Tanglewood & taiga)
5. ✅ `quest.wolves_at_the_woodline` — thin the wolf packs pressing Tanglewood Landing.
6. ✅ `quest.the_rootvault` — enter the Rootvault, defeat the **Rootbound Warden**, recover the first stabilizer coil (sets `worldstate.anchor_root_stabilized`).
7. ✅ `quest.the_magpies_price` — first meeting with Corvo Bray on the vault trail; buy back the coil he sold the Relight.

### Act II — Stone and Water (levels 20–35, Highcairn & Mirefen)
8. ✅ `quest.silt_in_the_water` — Mirefen Quay's catch is fouled; cull the bog slimes and husks.
9. ✅ `quest.the_sunken_pumpworks` — drain-dungeon under the delta; defeat the **Silt King**, recover the Tidegate coil (sets `worldstate.anchor_pump_stabilized`).
10. ✅ `quest.the_long_causeway` — rebuild the savanna causeway to Lianvale (sets `worldstate.causeway_south_repaired`).
11. ✅ `quest.the_liftworks` — put the Liftworks Overseer to rest, recover the north coil, and open the Compact's haul-road (sets `worldstate.liftworks_running`); Purser Deln plants the Relight's flag at Highcairn.

### Act III — The Buried Record (levels 30–45, Lianvale, Sunward, desert)
12. ⏳ `quest.the_verdant_archive` — jungle archive dungeon; the governor-valve revelation.
13. ⏳ `quest.the_gilded_cistern` — desert dungeon; the Sundering was an overload.
14. ⏳ `quest.vanes_answer` — confront Vane with the records; she refuses; the race begins.

### Act IV — The Edge of the World (levels 40–55, badlands & frozen north)
15. ⏳ `quest.the_cinderworks` — badlands foundry dungeon; Bray switches sides.
16. ⏳ `quest.rimehold` — frozen vault dungeon; the last surface coil.

### Act V — Beneath the Continent (levels 50–60, Palewick & Undervault)
17. ⏳ `quest.the_pale_ferry` — restore the Palewick ferry line; the Sporevault coil.
18. ⏳ `quest.the_loomheart` — descend through Undervault; the Custodian; rebalance the Loom. Epilogue.

**Meaningful decisions (two, non-branching-world):** whether to expose or
shield Bray's early looting (changes his Act IV dialogue and reward), and
whether Vane is arrested or joins the rebalancing (changes epilogue lines and
Mirefen's reaction).

## World-state flag index

| Flag | Set by | Visible effect |
| --- | --- | --- |
| `worldstate.bridge_west_repaired` | quest.the_first_span | West Span planked and walkable; west road open. |
| `worldstate.anchor_root_stabilized` | quest.the_rootvault | Rootvault calms (lore; wolf pressure lore-reduced). |
| `worldstate.anchor_pump_stabilized` | quest.the_sunken_pumpworks | Delta waters settle (lore). |
| `worldstate.causeway_south_repaired` | quest.the_long_causeway | Savanna causeway planked; Lianvale road open. |
| ✅ `worldstate.liftworks_running` | quest.the_liftworks | The graded haul-road descends the mountain's west face at z 39–41. |
| ⏳ `worldstate.ferry_palewick` | quest.the_pale_ferry | Palewick ferry pier. |
| ⏳ `worldstate.loomheart_balanced` | quest.the_loomheart | Epilogue lighting/dialogue across all settlements. |

## Expansion hooks (must not feel unfinished)

- Sea charts in Mirefen mention lands beyond the Reach (future continent).
- A dormant deep line runs north under the frozen ocean (future dungeon).
- The Relight splinters after the ending (future faction arc).
