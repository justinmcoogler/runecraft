// Villager errands: deterministic generation from (seed, npc), the full
// accept -> deliver -> reward loop through the ordinary QuestService, and the
// active-errand cap that keeps the log a to-do list.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { isErrandGiver, villagerQuestFor } from "../villager-quests";
import { ECHUNK, ENDLESS_CENTER, generateChunk, setValeActive } from "../worldgen/endless";
import type { NpcPlacement } from "../types";

const npcAt = (id: string, x: number, z: number): NpcPlacement => ({
  instanceId: id, name: "Wren", cell: { x, z }, wanderRadius: 2, lines: ["hm"],
});

describe("villager errands", () => {
  it("only skill-home residents give errands, deterministically", () => {
    const home = ENDLESS_CENTER + 400;
    const giver = npcAt("end.512.520.res", home, home);
    const a = villagerQuestFor(7, giver);
    const b = villagerQuestFor(7, giver);
    expect(a).not.toBeNull();
    expect(a).toEqual(b); // same seed + npc -> the very same errand
    expect(villagerQuestFor(8, giver)?.id).toBe(a!.id); // id tracks the npc
    expect(isErrandGiver("end.512.520.pr3.res")).toBe(true);
    expect(villagerQuestFor(7, npcAt("tutorial.guide", home, home))).toBeNull();
    expect(villagerQuestFor(7, npcAt("end.512.520.sk2", home, home))).toBeNull();
  });

  it("runs the accept -> deliver -> reward loop through the quest service", () => {
    const sim = GameSimulation.createEndless(42);
    const home = ENDLESS_CENTER + 60;
    // Find a giver whose errand is a deliver (gather/craft family).
    let def = null;
    for (let k = 0; def === null && k < 40; k++) {
      const cand = villagerQuestFor(42, npcAt(`end.500.${500 + k}.res`, home, home));
      if (cand?.objectives[0]?.type === "deliver") def = cand;
    }
    expect(def).not.toBeNull();
    sim.quests.addDef(def!);
    expect(sim.quests.states[def!.id].status).toBe("available");
    // Talking accepts the errand.
    sim.quests.process([{ type: "npcChat", instanceId: def!.giverNpcId, name: "Wren" }]);
    expect(sim.quests.states[def!.id].status).toBe("active");
    // Come back with the goods: they're consumed, coins + xp paid out.
    const obj = def!.objectives[0];
    sim.inventory.add(obj.itemId!, obj.qty!);
    const coinsBefore = sim.inventory.count("item.coin");
    const skill = def!.rewards.xp[0].skillId;
    const xpBefore = sim.skills.xp[skill] ?? 0;
    sim.quests.process([{ type: "npcChat", instanceId: def!.giverNpcId, name: "Wren" }]);
    expect(sim.quests.states[def!.id].status).toBe("completed");
    expect(sim.inventory.count(obj.itemId!)).toBe(0);
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(coinsBefore);
    expect(sim.skills.xp[skill] ?? 0).toBeGreaterThan(xpBefore);
  });

  it("caps active errands at three; the fourth villager just chats", () => {
    const sim = GameSimulation.createEndless(42);
    const home = ENDLESS_CENTER + 60;
    const defs = [];
    for (let k = 0; defs.length < 4 && k < 60; k++) {
      const d = villagerQuestFor(42, npcAt(`end.510.${500 + k}.res`, home, home));
      if (d) { defs.push(d); sim.quests.addDef(d); }
    }
    expect(defs.length).toBe(4);
    for (const d of defs) sim.quests.process([{ type: "npcChat", instanceId: d.giverNpcId, name: "Wren" }]);
    const active = defs.filter((d) => sim.quests.states[d.id].status === "active");
    expect(active.length).toBe(3);
    expect(sim.quests.states[defs[3].id].status).toBe("available");
  });

  it("streams errand defs in with village chunks", () => {
    setValeActive(false);
    // Find a chunk with a skill-home resident, then confirm the def registers
    // through the chunk manager by walking the sim there... cheaper: register
    // exactly what the chunk carries and check ids line up.
    const cc = Math.floor(ENDLESS_CENTER / ECHUNK);
    let found: NpcPlacement | null = null;
    outer: for (let dz = -12; dz <= 12 && !found; dz++) {
      for (let dx = -12; dx <= 12; dx++) {
        const ch = generateChunk(7, cc + dx, cc + dz);
        const res = ch.npcs.find((n) => isErrandGiver(n.instanceId));
        if (res) { found = res; break outer; }
      }
    }
    expect(found, "no skill-home resident within 25x25 chunks").not.toBeNull();
    const def = villagerQuestFor(7, found!);
    expect(def).not.toBeNull();
    expect(def!.giverNpcId).toBe(found!.instanceId);
    expect(def!.objectives.length).toBeGreaterThan(0);
    expect(def!.rewards.items.some((r) => r.itemId === "item.coin")).toBe(true);
  });
});
