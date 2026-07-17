// The skill guide joins the scattered content tables into one per-skill
// activity ladder — the data behind the HUD's "what unlocks at what level".

import { describe, expect, it } from "vitest";
import { SKILLS } from "../content";
import { skillActivities, skillCeiling, skillIds } from "../skill-guide";

describe("skill guide", () => {
  it("lists every skill", () => {
    expect(skillIds().length).toBe(Object.values(SKILLS).filter((s) => !s.mergedInto).length);
    for (const id of skillIds()) expect(SKILLS[id]).toBeTruthy();
  });

  it("returns activities sorted by unlock level", () => {
    const wc = skillActivities("skill.woodcutting");
    expect(wc.length).toBeGreaterThan(5);
    for (let i = 1; i < wc.length; i++) expect(wc[i].level).toBeGreaterThanOrEqual(wc[i - 1].level);
    // The tree ladder reaches the high-level trees now the cap is 99.
    expect(skillCeiling("skill.woodcutting")).toBeGreaterThan(80);
  });

  it("carries the Minecraft ore ladder up toward the cap", () => {
    const mining = skillActivities("skill.mining");
    // The classic ores are all present, in order.
    for (const ore of ["Redstone", "Lapis", "Emerald", "Nether Quartz", "Ancient Debris"]) {
      expect(mining.some((a) => a.name.includes(ore)), `mining missing ${ore}`).toBe(true);
    }
    // Ancient Debris is the deepest dig — mining now trains into the 90s.
    expect(skillCeiling("skill.mining")).toBeGreaterThanOrEqual(90);
    // Netherite gear gives smithing its high end.
    expect(skillActivities("skill.smithing").some((a) => a.name.includes("Netherite"))).toBe(true);
    expect(skillCeiling("skill.smithing")).toBeGreaterThanOrEqual(70);
  });

  it("routes gathering, crafting and slaying to the right skills", () => {
    // Mining lists ore rocks with real level gates.
    const mining = skillActivities("skill.mining");
    expect(mining.some((a) => a.name.includes("Diamond") && a.level === 50)).toBe(true);
    // Smithing includes crafted recipes.
    expect(skillActivities("skill.smithing").some((a) => a.verb === "Smith")).toBe(true);
    // Slaying surfaces taskmaster contracts.
    expect(skillActivities("skill.slaying").some((a) => a.verb === "Slay")).toBe(true);
    // Agility surfaces shortcut obstacles.
    expect(skillActivities("skill.agility").some((a) => a.verb === "Cross")).toBe(true);
  });

  it("lists Firemaking's log ladder and gem jewellery under Crafting", () => {
    const fire = skillActivities("skill.firemaking");
    expect(fire.length).toBeGreaterThanOrEqual(10); // one per log tier
    expect(fire.every((a) => a.verb === "Light")).toBe(true);
    expect(skillCeiling("skill.firemaking")).toBeGreaterThan(90);
    // Gems struck while mining feed jewellery recipes in Crafting.
    const craft = skillActivities("skill.crafting");
    expect(craft.some((a) => a.name.includes("Amulet"))).toBe(true);
  });

  it("surfaces the five new skills' activities", () => {
    expect(skillActivities("skill.prayer").some((a) => a.verb === "Bury")).toBe(true);
    expect(skillActivities("skill.magic").some((a) => a.name === "High Alchemy")).toBe(true);
    expect(skillActivities("skill.strength").length).toBeGreaterThan(0);
    expect(skillActivities("skill.fletching").some((a) => a.verb === "Fletch")).toBe(true);
    const rc = skillActivities("skill.runecrafting");
    expect(rc.some((a) => a.name.includes("Echo Rune"))).toBe(true);
    expect(skillCeiling("skill.runecrafting")).toBeGreaterThanOrEqual(90);
  });

  it("gives combat skills a note even without a level gate", () => {
    const atk = skillActivities("skill.attack");
    expect(atk.length).toBeGreaterThan(0);
    expect(atk[0].level).toBe(1);
  });

  it("never lists an activity above the level cap", () => {
    for (const id of skillIds()) {
      const cap = SKILLS[id].maxLevel;
      for (const a of skillActivities(id)) {
        expect(a.level, `${id}: ${a.name} unlock exceeds cap`).toBeLessThanOrEqual(cap);
      }
    }
  });
});
