import { describe, expect, it } from "vitest";
import { CURVES, levelForXp, xpToReachLevel } from "../../content/content";
import { SkillService } from "../skills";
import { SimEventBus } from "../types";

const curve = CURVES["curve.standard"];

describe("experience curve", () => {
  it("starts at level 1 with 0 xp", () => {
    expect(xpToReachLevel(curve, 1)).toBe(0);
    expect(levelForXp(curve, 0, 50)).toBe(1);
  });

  it("is strictly monotonic", () => {
    for (let level = 2; level <= 50; level++) {
      expect(xpToReachLevel(curve, level)).toBeGreaterThan(xpToReachLevel(curve, level - 1));
    }
  });

  it("derives levels exactly at thresholds", () => {
    const xpFor5 = xpToReachLevel(curve, 5);
    expect(levelForXp(curve, xpFor5 - 1, 50)).toBe(4);
    expect(levelForXp(curve, xpFor5, 50)).toBe(5);
  });

  it("clamps at max level", () => {
    expect(levelForXp(curve, 10_000_000, 50)).toBe(50);
  });
});

describe("SkillService", () => {
  it("emits one levelUp per level crossed on a multi-level grant", () => {
    const bus = new SimEventBus();
    const skills = new SkillService(bus);
    const xpFor4 = xpToReachLevel(curve, 4);
    skills.grantXp("skill.woodcutting", xpFor4);
    const events = bus.drain();
    const levelUps = events.filter((e) => e.type === "levelUp");
    expect(levelUps.map((e) => (e.type === "levelUp" ? e.level : 0))).toEqual([2, 3, 4]);
    expect(skills.levelOf("skill.woodcutting")).toBe(4);
  });
});
