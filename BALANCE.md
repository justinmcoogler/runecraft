# Balance & Exploit Audit — alpha readiness (#124)

Automated audit over the content data (`scripts/balance-audit.mjs`,
run with `npx tsx scripts/balance-audit.mjs`). Re-run after any change
to SHOPS, RECIPES, ITEMS, NODES or ENEMIES.

## Results (2026-07-18)

**Money loops — CLEAN.** Across all shops, 8 items are both purchasable
and fenceable; every one sells back below its cheapest purchase price
(closest margin: berries and bronze arrows at −1 coin each).

**Craft arbitrage — CLEAN.** Of 216 recipes, 11 have fully shop-purchasable
inputs; none yields outputs worth more than the inputs cost (success rate
included). Crafting for profit requires gathered materials, as intended.

**Low-level farming — CLEAN.** No enemy at level ≤ 5 drops loot worth an
expected 40+ coins per kill at best shop prices. High-value drops sit on
nightOnly and remoteness-gated spawns.

**XP ladders — four accepted low-band spikes.** Nodes giving > 3× the
band minimum within levels 1–10 are tier steps, not bugs:
redberry bush (Foraging 8, 30xp), pumpkin plot (Farming 6, 42xp),
ember herb (Herblore 8, 46xp), old strongbox (Thieving 5, 55xp).
Strongbox thieving carries lockout risk; the rest are gated by seeds,
biome placement or respawn timers.

## Tutorial island passes (1–3)

- Reachability: all 31 NPCs, 272 nodes and every station flood-reachable
  from spawn (`scripts/probe-tutorial-audit.mjs`).
- Real-action walkthrough: guide → woodcutting → firemaking → mining
  completed via genuine interactions (`scripts/probe-quest-walk.mjs`).
- Full trail: all 30 quests to graduation with no wedges
  (`scripts/probe-trail-full.mjs`).

## Deferred by design

- Construction claim-a-plot housing (#130) and terrain features pass
  (#156) remain on the roadmap by user decision.
- Dedicated icons for 9 placeholder-routed items (see ASSETS_NEEDED.md).
