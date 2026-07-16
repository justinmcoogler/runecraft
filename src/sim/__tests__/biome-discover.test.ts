// Biome discovery: crossing into a named biome announces it, the first visit
// pays a bounty and fills the codex, and the codex persists across saves.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { captureSharedState, applySharedState } from "../../save/save";
import { ENDLESS_CENTER, terrainAt } from "../worldgen/endless";
import { biomeName } from "../worldgen/biomes";

const note = (sim: GameSimulation, c: { x: number; z: number }): void =>
  (sim as unknown as { noteBiome(c: { x: number; z: number }): void }).noteBiome(c);

describe("biome discovery", () => {
  it("announces a first-time biome, pays a bounty, and fills the codex", () => {
    const sim = GameSimulation.createEndless(2024);
    sim.events.drain();
    const coin0 = sim.inventory.count("item.coin");
    const c1 = { x: ENDLESS_CENTER + 2000, z: ENDLESS_CENTER + 2000 };
    note(sim, c1);
    const ev = sim.events.drain().find((e) => e.type === "biomeEntered");
    expect(ev).toBeTruthy();
    expect(ev && ev.type === "biomeEntered" && ev.firstTime).toBe(true);
    expect(sim.discoveredBiomes.size).toBe(1);
    expect(sim.inventory.count("item.coin")).toBe(coin0 + 20);
    const firstName = ev && ev.type === "biomeEntered" ? ev.name : "";

    // Standing put — same biome, no fresh announcement.
    note(sim, c1);
    expect(sim.events.drain().some((e) => e.type === "biomeEntered")).toBe(false);

    // Walk until the named biome changes; a fresh biome pays again.
    let c2: { x: number; z: number } | null = null;
    for (let d = 60; d < 8000 && !c2; d += 60) {
      const cand = { x: c1.x + d, z: c1.z };
      const nm = biomeName(2024, cand.x, cand.z, terrainAt(2024, cand.x, cand.z).biome);
      if (nm !== firstName) c2 = cand;
    }
    expect(c2).toBeTruthy();
    const coin1 = sim.inventory.count("item.coin");
    note(sim, c2!);
    const ev2 = sim.events.drain().find((e) => e.type === "biomeEntered");
    expect(ev2 && ev2.type === "biomeEntered" && ev2.firstTime).toBe(true);
    expect(sim.discoveredBiomes.size).toBe(2);
    expect(sim.inventory.count("item.coin")).toBe(coin1 + 20);

    // Returning to the first biome announces it but pays nothing (already known).
    const coin2 = sim.inventory.count("item.coin");
    note(sim, c1);
    const ev3 = sim.events.drain().find((e) => e.type === "biomeEntered");
    expect(ev3 && ev3.type === "biomeEntered" && ev3.firstTime).toBe(false);
    expect(sim.inventory.count("item.coin")).toBe(coin2);
    expect(sim.discoveredBiomes.size).toBe(2);
  });

  it("persists the biome codex across a save round-trip", () => {
    const sim = GameSimulation.createEndless(1);
    sim.discoveredBiomes.add("Oakwood");
    sim.discoveredBiomes.add("Bamboo Forest");
    const shared = captureSharedState(sim);
    expect(shared.discoveredBiomes).toEqual(expect.arrayContaining(["Oakwood", "Bamboo Forest"]));
    const fresh = GameSimulation.createEndless(1);
    applySharedState(fresh, shared);
    expect(fresh.discoveredBiomes.has("Oakwood")).toBe(true);
    expect(fresh.discoveredBiomes.has("Bamboo Forest")).toBe(true);
  });
});
