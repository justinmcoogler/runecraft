// The organized province: zones announce themselves, every enemy in the
// bestiary spawns somewhere real, and the anchor-coil quest items remain
// obtainable from the bosses that carry them.

import { describe, expect, it } from "vitest";
import { ENEMIES, ZONES } from "../../content/content";
import { GameSimulation } from "../simulation";
import { buildRegion, REGION_BUILDERS } from "../world";

describe("the organized province", () => {
  it("announces zones as the player crosses into them", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 41);
    const first = sim.tick();
    expect(first.some((e) => e.type === "zoneEntered" && e.zoneId === "zone.greenvale.town")).toBe(true);
    // Walk out to Willowmere: a new announcement, once.
    sim.movement.setCellPosition({ x: 665, z: 1415 });
    const there = sim.tick();
    expect(there.some((e) => e.type === "zoneEntered" && e.zoneId === "zone.willowmere")).toBe(true);
    // Standing still re-announces nothing.
    expect(sim.tick().some((e) => e.type === "zoneEntered")).toBe(false);
  });

  it("spawns every authored enemy somewhere across the province and its dungeons", () => {
    // These haunt the endless worlds' corrupted biomes (gravemoor and
    // blightwood feature tables in worldgen/endless.ts), not the province.
    const ENDLESS_ONLY = new Set([
      // The wildlife + gap-filler roster lives in the endless wilds/dungeons.
      "enemy.fox", "enemy.rabbit", "enemy.stag", "enemy.doe", "enemy.crab.shore",
      "enemy.duck", "enemy.goat", "enemy.frog", "enemy.squirrel",
      "enemy.giant_rat", "enemy.bandit", "enemy.wisp", "enemy.mimic",
      "enemy.grave_shambler",
      "enemy.hollow_wight",
      "enemy.dire_wolf",
      "enemy.gloom_spinner",
      "enemy.blight_slime",
      "enemy.creeper",
      "enemy.zombie",
      "enemy.skeleton",
      "enemy.squid",
      "enemy.ghast",
      "enemy.dragon.fire",
      "enemy.dragon.ice",
      "enemy.dragon.hydra",
      "enemy.dragon.twoheaded",
      // Wilds fauna seeded only through the endless biomes and dungeons.
      "enemy.boar",
      "enemy.prairie_bull",
      "enemy.bramble_slime",
      "enemy.thornback",
      "enemy.moss_golem",
      "enemy.stone_sentinel",
      "enemy.marsh_lurker",
      "enemy.ash_hound",
      "enemy.ember_crawler",
      "enemy.glacial_wight",
      // Capstone undead — a deep endless-crypt elite only.
      "enemy.barrow_lord",
      // New vanilla mobs on BetaSharp/oafs/CornCraft models — defined and
      // render-ready, but not yet placed in the world (feature placement is off
      // during the asset transition; see CLEAR_ASSETS).
      "enemy.drowned", "enemy.stray", "enemy.pillager", "enemy.witch",
      "enemy.vindicator", "enemy.evoker", "enemy.illusioner", "enemy.ravager",
      "enemy.armadillo", "enemy.sniffer", "enemy.bat", "enemy.allay",
      "enemy.bee", "enemy.mooshroom",
      "enemy.warden",
    ]);
    const everywhere = new Set<string>();
    for (const id of Object.keys(REGION_BUILDERS)) {
      for (const e of buildRegion(id).enemies ?? []) everywhere.add(e.defId);
    }
    for (const defId of Object.keys(ENEMIES)) {
      if (ENDLESS_ONLY.has(defId)) continue;
      expect(everywhere.has(defId), `${defId} spawns nowhere`).toBe(true);
    }
  });

  it("makes the anchor coils obtainable from the bosses that carry them", () => {
    const everywhere = new Set<string>();
    for (const id of Object.keys(REGION_BUILDERS)) {
      for (const e of buildRegion(id).enemies ?? []) everywhere.add(e.defId);
    }
    for (const coil of ["item.anchor.root", "item.anchor.pump", "item.anchor.lift"]) {
      const carrier = Object.values(ENEMIES).find((e) => e.loot.some((l) => l.itemId === coil));
      expect(carrier, `${coil} has no carrier`).toBeTruthy();
      expect(everywhere.has(carrier!.id), `${coil} carrier ${carrier!.id} never spawns`).toBe(true);
    }
  });

  it("zone rectangles resolve their own hearts (nested towns first)", () => {
    for (const zone of ZONES) {
      const cx = Math.round((zone.x0 + zone.x1) / 2);
      const cz = Math.round((zone.z0 + zone.z1) / 2);
      const first = ZONES.find((z) => cx >= z.x0 && cx <= z.x1 && cz >= z.z0 && cz <= z.z1)!;
      // Either the zone claims its own center, or a deliberately nested
      // town zone (listed earlier) sits on top of it.
      const nested =
        first.x0 >= zone.x0 && first.x1 <= zone.x1 && first.z0 >= zone.z0 && first.z1 <= zone.z1;
      expect(nested, `${zone.id} center resolves to unrelated ${first.id}`).toBe(true);
    }
  });
});
