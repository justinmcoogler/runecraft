# Main Quest Graph — dependency order

Machine-checkable rules live in `game/src/sim/__tests__/continent.test.ts`
(prereq existence, acyclicity, guaranteed quest drops, reachability of every
giver and target with the flags available at that point).

```
quest.first_timber
  └─ quest.tin_and_temper
       └─ quest.the_gnasher                      (boss: Old Gnasher)
            └─ quest.the_first_span              → worldstate.bridge_west_repaired
                 ├─ quest.wolves_at_the_woodline
                 │    └─ quest.the_rootvault     (boss: Rootbound Warden)
                 │         → worldstate.anchor_root_stabilized
                 │         └─ quest.the_magpies_price   (Corvo Bray, the vault trail)
                 └─ quest.silt_in_the_water
                      └─ quest.the_sunken_pumpworks   (boss: The Silt King)
                           → worldstate.anchor_pump_stabilized
                           └─ quest.the_long_causeway → worldstate.causeway_south_repaired
                                └─ quest.the_liftworks   (boss: The Liftworks Overseer)
                                     → worldstate.liftworks_running
                                     └─ ⏳ quest.the_verdant_archive … (Acts III–V per WORLD_BIBLE)
```

Invariants (tested):

- Every `prereqQuestIds` entry exists; the graph is acyclic.
- No quest requires an item obtainable only behind that quest's own flag.
- Every giver NPC exists in a region reachable with the prerequisite flags.
- Quest-critical drops (`item.anchor.*`, Emberstone) have `chance: 1`.
- World flags only ever open routes — no flag removes walkability, so no
  save can strand the player.
- Repeat boss kills after completion give normal loot but never re-fire
  story (quest state machine is forward-only).
