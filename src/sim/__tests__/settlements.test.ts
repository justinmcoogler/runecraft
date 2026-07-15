// Settlement variety: the commons at a village anchor comes in several kinds,
// each dressed from real props and staffed with folk who talk their trade.

import { describe, expect, it } from "vitest";
import { OBJECTS } from "../../content/content";
import { SETTLEMENTS, type SettlementKind, settlementKind } from "../worldgen/endless";

describe("settlement types", () => {
  it("defines several kinds, each dressed from real object defs", () => {
    const kinds = Object.keys(SETTLEMENTS) as SettlementKind[];
    expect(kinds.length).toBeGreaterThanOrEqual(10);
    for (const kind of kinds) {
      const def = SETTLEMENTS[kind];
      expect(def.dress.length, `${kind}: has dressing`).toBeGreaterThan(2);
      for (const d of def.dress) {
        expect(OBJECTS[d.defId], `${kind}: ${d.defId} is a real object`).toBeTruthy();
      }
      expect(def.folk[0], `${kind}: at least one villager`).toBeGreaterThanOrEqual(1);
      expect(def.lines.length, `${kind}: has chatter`).toBeGreaterThan(0);
      for (const set of def.lines) expect(set.length).toBeGreaterThan(0);
    }
  });

  it("each kind has a distinctive centrepiece", () => {
    const has = (k: SettlementKind, defId: string) => SETTLEMENTS[k].dress.some((d) => d.defId === defId);
    expect(has("mining_camp", "object.anvil.basic")).toBe(true);
    expect(has("shrine", "object.altar.rune")).toBe(true);
    expect(has("farmstead", "object.workbench.basic")).toBe(true);
    expect(has("monastery", "object.enchanter.basic")).toBe(true);
    expect(has("lumber_camp", "object.log.fallen")).toBe(true);
    expect(has("fishing_wharf", "object.reeds.water")).toBe(true);
    // A trade post fields more than one stall.
    expect(SETTLEMENTS.trade_post.dress.filter((d) => d.defId === "object.stall.market").length).toBeGreaterThan(1);
  });

  it("draws a spread of kinds across the map, biased by country", () => {
    const seen = new Set<SettlementKind>();
    // Sweep a lattice of anchor coordinates over both green (biome 1) and rocky
    // (biome 2) country.
    for (let cx = 0; cx < 30; cx++) {
      for (let cz = 0; cz < 30; cz++) {
        seen.add(settlementKind(1234, cx, cz, 1));
        seen.add(settlementKind(1234, cx, cz, 2));
      }
    }
    // The sweep as a whole surfaces a broad spread of the roster.
    expect(seen.size).toBeGreaterThanOrEqual(7);
    // Rocky country leans to mining camps (sampled over a grid for stability).
    let camps = 0, total = 0;
    for (let cx = 0; cx < 40; cx++) {
      for (let cz = 0; cz < 40; cz++) {
        if (settlementKind(99, cx, cz, 2) === "mining_camp") camps++;
        total++;
      }
    }
    expect(camps / total).toBeGreaterThan(0.35);
  });

  it("is deterministic for a given seed and anchor", () => {
    expect(settlementKind(7, 5, 9, 1)).toBe(settlementKind(7, 5, 9, 1));
  });
});
