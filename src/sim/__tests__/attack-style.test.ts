// RuneScape-style attack styles: the chosen style decides which melee combat
// skill the XP feeds. Constitution always shares; a bow always trains Archery.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { RegionSpec, BlockType } from "../world";

function tinyRegion(): RegionSpec {
  const w = 8, d = 8;
  return {
    id: "region.style_test",
    width: w,
    depth: d,
    heights: new Array<number>(w * d).fill(0),
    blocks: new Array<BlockType>(w * d).fill("grass"),
    nodes: [],
    objects: [],
    npcs: [],
    enemies: [],
    spawn: { x: 2, z: 2 },
  };
}

const xp = (sim: GameSimulation, id: string) => sim.skills.xp[id] ?? 0;

describe("attack styles route melee combat XP", () => {
  it("Accurate trains Attack, not Strength or Defence", () => {
    const sim = new GameSimulation(tinyRegion(), 1);
    sim.attackStyle = "accurate";
    sim.awardCombatXp(100);
    expect(xp(sim, "skill.attack")).toBeGreaterThan(0);
    expect(xp(sim, "skill.strength")).toBe(0);
    expect(xp(sim, "skill.defense")).toBe(0);
  });

  it("Aggressive trains Strength, not Attack", () => {
    const sim = new GameSimulation(tinyRegion(), 1);
    sim.attackStyle = "aggressive";
    sim.awardCombatXp(100);
    expect(xp(sim, "skill.strength")).toBeGreaterThan(0);
    expect(xp(sim, "skill.attack")).toBe(0);
  });

  it("Defensive trains Defence, not Attack or Strength", () => {
    const sim = new GameSimulation(tinyRegion(), 1);
    sim.attackStyle = "defensive";
    sim.awardCombatXp(100);
    expect(xp(sim, "skill.defense")).toBeGreaterThan(0);
    expect(xp(sim, "skill.attack")).toBe(0);
    expect(xp(sim, "skill.strength")).toBe(0);
  });

  it("Controlled splits across Attack, Strength and Defence", () => {
    const sim = new GameSimulation(tinyRegion(), 1);
    sim.attackStyle = "controlled";
    sim.awardCombatXp(99);
    expect(xp(sim, "skill.attack")).toBeGreaterThan(0);
    expect(xp(sim, "skill.strength")).toBeGreaterThan(0);
    expect(xp(sim, "skill.defense")).toBeGreaterThan(0);
  });

  it("Constitution always takes a share, whatever the style", () => {
    const sim = new GameSimulation(tinyRegion(), 1);
    sim.attackStyle = "aggressive";
    sim.awardCombatXp(100);
    expect(xp(sim, "skill.constitution")).toBeGreaterThan(0);
  });

  it("a bow always trains Archery, ignoring the melee style", () => {
    const sim = new GameSimulation(tinyRegion(), 1);
    sim.attackStyle = "aggressive"; // would be Strength if melee
    sim.equippedTool = "tool.bow.oak";
    sim.awardCombatXp(100);
    expect(xp(sim, "skill.archery")).toBeGreaterThan(0);
    expect(xp(sim, "skill.strength")).toBe(0);
    expect(xp(sim, "skill.attack")).toBe(0);
  });

  it("cycles through all four styles and back", () => {
    const sim = new GameSimulation(tinyRegion(), 1);
    expect(sim.attackStyle).toBe("accurate");
    expect(sim.cycleAttackStyle()).toBe("aggressive");
    expect(sim.cycleAttackStyle()).toBe("defensive");
    expect(sim.cycleAttackStyle()).toBe("controlled");
    expect(sim.cycleAttackStyle()).toBe("accurate");
  });
});
