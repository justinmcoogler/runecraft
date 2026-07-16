// Stamina & running: sprinting drains stamina and moves faster; walking or
// resting refills it; the run toggle and exhaustion gate behave.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { RegionSpec, BlockType } from "../world";

function openField(): RegionSpec {
  const w = 40, d = 8;
  return {
    id: "region.stamina_test",
    width: w,
    depth: d,
    heights: new Array<number>(w * d).fill(0),
    blocks: new Array<BlockType>(w * d).fill("grass"),
    nodes: [],
    objects: [],
    npcs: [],
    enemies: [],
    spawn: { x: 2, z: 4 },
  };
}

function walk(sim: GameSimulation, ticks: number) {
  const p = sim.movement.currentCell();
  sim.enqueue({ type: "moveTo", cell: { x: p.x + 30, z: p.z } });
  for (let i = 0; i < ticks; i++) sim.tick();
}

describe("stamina & running", () => {
  it("drains stamina and moves faster while running", () => {
    const sim = new GameSimulation(openField(), 1);
    sim.running = true;
    sim.stamina = 100;
    const startX = sim.movement.pos.x;
    walk(sim, 20);
    expect(sim.stamina).toBeLessThan(100); // sprinting spent stamina
    expect(sim.movement.pos.x - startX).toBeGreaterThan(6); // and covered ground
  });

  it("keeps full stamina when walking (run toggled off)", () => {
    const sim = new GameSimulation(openField(), 1);
    sim.running = false;
    sim.stamina = 100;
    walk(sim, 20);
    expect(sim.stamina).toBe(100);
  });

  it("regenerates stamina while standing still", () => {
    const sim = new GameSimulation(openField(), 1);
    sim.running = true;
    sim.stamina = 40;
    for (let i = 0; i < 30; i++) sim.tick(); // idle
    expect(sim.stamina).toBeGreaterThan(40);
  });

  it("running is faster than walking over the same interval", () => {
    const run = new GameSimulation(openField(), 1);
    run.running = true; run.stamina = 100;
    walk(run, 8);
    const walkSim = new GameSimulation(openField(), 1);
    walkSim.running = false;
    walk(walkSim, 8);
    expect(run.movement.pos.x).toBeGreaterThan(walkSim.movement.pos.x);
  });

  it("toggleRun flips the flag", () => {
    const sim = new GameSimulation(openField(), 1);
    const before = sim.running;
    expect(sim.toggleRun()).toBe(!before);
    expect(sim.running).toBe(!before);
  });
});
