// Roaming world events: travelling the endless wild throws up ambushes, lone
// beasts and lost caches, scaled by distance — and never right on the doorstep.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { ENDLESS_CENTER } from "../worldgen/endless";

// rollWorldEvent is private; reach it through a loose cast for the tests.
const roll = (sim: GameSimulation, cell: { x: number; z: number }): void =>
  (sim as unknown as { rollWorldEvent(c: { x: number; z: number }): void }).rollWorldEvent(cell);

describe("roaming world events", () => {
  it("fires a spread of events far from home, spawning foes and paying caches", () => {
    const sim = GameSimulation.createEndless(2024);
    const far = { x: ENDLESS_CENTER + 4000, z: ENDLESS_CENTER + 3000 };
    sim.movement.setCellPosition(far);
    // Stream the chunks around the far cell so foes have walkable ground.
    sim.tick();
    sim.tick();
    sim.events.drain();

    const coin0 = sim.inventory.count("item.coin");
    let ambush = 0, beast = 0, cache = 0;
    for (let i = 0; i < 80; i++) {
      roll(sim, far);
      for (const e of sim.events.drain()) {
        if (e.type !== "worldEvent") continue;
        if (e.kind === "ambush") ambush++;
        else if (e.kind === "beast") beast++;
        else cache++;
      }
    }
    // Every roll produces exactly one announced event.
    expect(ambush + beast + cache).toBe(80);
    // A healthy mix — both combat and reward events show up.
    expect(ambush).toBeGreaterThan(0);
    expect(cache).toBeGreaterThan(0);
    // Ambushes actually place foes into the region…
    const foes = (sim.world.region.enemies ?? []).filter((f) => f.instanceId.startsWith("event.foe."));
    expect(foes.length).toBeGreaterThan(0);
    // …and every spawned foe registered with the enemy system.
    for (const f of foes) expect(sim.enemies.get(f.instanceId)).toBeTruthy();
    // Caches paid out coin.
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(coin0);
  });

  it("keeps the home vale quiet", () => {
    const sim = GameSimulation.createEndless(2024);
    sim.events.drain();
    for (let i = 0; i < 20; i++) roll(sim, { x: ENDLESS_CENTER, z: ENDLESS_CENTER });
    expect(sim.events.drain().filter((e) => e.type === "worldEvent").length).toBe(0);
  });

  it("prunes event foes the player has left far behind", () => {
    const sim = GameSimulation.createEndless(7);
    const a = { x: ENDLESS_CENTER + 5000, z: ENDLESS_CENTER + 5000 };
    sim.movement.setCellPosition(a);
    sim.tick();
    sim.tick();
    // Force several ambushes at A.
    for (let i = 0; i < 40; i++) roll(sim, a);
    const atA = (sim.world.region.enemies ?? []).filter((f) => f.instanceId.startsWith("event.foe.")).length;
    expect(atA).toBeGreaterThan(0);
    // Now roll far away: the A-foes are beyond the keep radius and get retired.
    const b = { x: a.x + 300, z: a.z + 300 };
    sim.movement.setCellPosition(b);
    sim.tick();
    sim.tick();
    for (let i = 0; i < 5; i++) roll(sim, b);
    const stillAtA = (sim.world.region.enemies ?? []).filter(
      (f) => f.instanceId.startsWith("event.foe.") && Math.abs(f.cell.x - a.x) < 20,
    ).length;
    expect(stillAtA).toBe(0);
  });
});
