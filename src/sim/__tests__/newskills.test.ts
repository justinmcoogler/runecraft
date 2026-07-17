// The eight-skill expansion: farming plots, hunting trails, thieving,
// agility shortcuts, slaying assignments, the relic collection, potion
// effects that actually do something, and the new construction sites.

import { describe, expect, it } from "vitest";
import { NODES } from "../../content/content";
import { GameSimulation } from "../simulation";
import { buildRegion } from "../world";
import type { RegionSpec, BlockType } from "../world";
import type { SimEvent } from "../types";

function flatRegion(nodes: RegionSpec["nodes"], objects: RegionSpec["objects"] = []): RegionSpec {
  const width = 16;
  const depth = 16;
  return {
    id: "region.newskills_test",
    width,
    depth,
    heights: new Array<number>(width * depth).fill(0),
    blocks: new Array<BlockType>(width * depth).fill("grass"),
    nodes,
    objects,
    npcs: [],
    spawn: { x: 1, z: 1 },
  };
}

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 4000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

function runTicks(sim: GameSimulation, ticks: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) all.push(...sim.tick());
  return all;
}

describe("farming plots", () => {
  it("plants a seed, waits out the growth, harvests, and goes dormant again", () => {
    const sim = new GameSimulation(
      flatRegion([{ instanceId: "t.plot", defId: "resource.plot.wheat", cell: { x: 4, z: 4 } }]),
      21,
    );
    const plot = sim.nodes.get("t.plot")!;
    expect(plot.phase).toBe("depleted"); // starts empty
    expect(plot.respawnRemainingS).toBeLessThan(0); // dormant, not growing

    // No seeds: rejected before walking.
    sim.enqueue({ type: "interact", targetId: "t.plot" });
    const rejected = runTicks(sim, 3);
    expect(rejected.some((e) => e.type === "actionRejected" && e.reason === "missing_inputs")).toBe(true);

    // With a seed: plant it.
    sim.inventory.add("item.seed.wheat", 2);
    sim.enqueue({ type: "interact", targetId: "t.plot" });
    const planted = runUntil(sim, (e) => e.type === "planted");
    expect(planted.some((e) => e.type === "xpGained" && e.skillId === "skill.farming")).toBe(true);
    expect(sim.inventory.count("item.seed.wheat")).toBe(1);
    expect(plot.respawnRemainingS).toBeGreaterThan(0); // growing now

    // Growth completes on the timer (60s -> 600 ticks).
    runUntil(sim, (e) => e.type === "nodeRespawned" && e.instanceId === "t.plot", 650);
    expect(plot.phase).toBe("active");

    // Harvest to empty; the plot returns to dormant, not to a timer.
    sim.enqueue({ type: "interact", targetId: "t.plot" });
    runUntil(sim, (e) => e.type === "actionEnded" && e.reason === "target_depleted", 2000);
    expect(sim.inventory.count("item.wheat") + sim.inventory.count("item.seed.wheat")).toBeGreaterThan(1);
    expect(plot.phase).toBe("depleted");
    expect(plot.respawnRemainingS).toBeLessThan(0);
    // Waiting does NOT regrow an unplanted plot.
    runTicks(sim, 700);
    expect(plot.phase).toBe("depleted");
  });
});

describe("hunting trails", () => {
  it("requires a trap and yields game", () => {
    const sim = new GameSimulation(
      flatRegion([{ instanceId: "t.trail", defId: "resource.trail.rabbit", cell: { x: 4, z: 4 } }]),
      22,
    );
    sim.enqueue({ type: "interact", targetId: "t.trail" });
    const rejected = runTicks(sim, 3);
    expect(rejected.some((e) => e.type === "actionRejected" && e.reason === "missing_tool")).toBe(true);

    sim.inventory.add("tool.trap.basic", 1);
    sim.enqueue({ type: "interact", targetId: "t.trail" });
    const events = runUntil(
      sim,
      (e) => e.type === "itemGained" && ["item.game.rabbit", "item.feather", "item.fur"].includes(e.itemId),
    );
    expect(events.some((e) => e.type === "xpGained" && e.skillId === "skill.hunting")).toBe(true);
  });
});

describe("thieving", () => {
  it("pilfers the stall for coin, but a botched grab stings and ends the attempt", () => {
    const sim = new GameSimulation(
      flatRegion([{ instanceId: "t.stall", defId: "resource.stall.market", cell: { x: 4, z: 4 } }]),
      7,
    );
    const hpBefore = sim.hp;
    let gained = 0;
    let caught = false;
    for (let attempt = 0; attempt < 40 && (!caught || gained === 0); attempt++) {
      const node = sim.nodes.get("t.stall")!;
      if (node.phase !== "active") {
        // Wait out the stall's restock timer, then try again.
        for (let i = 0; i < 400 && node.phase !== "active"; i++) sim.tick();
        continue;
      }
      sim.enqueue({ type: "interact", targetId: "t.stall" });
      for (let i = 0; i < 400; i++) {
        const events = sim.tick();
        for (const ev of events) {
          if (ev.type === "itemGained") gained++;
          if (ev.type === "thieveryCaught") caught = true;
        }
        if (events.some((e) => e.type === "actionEnded")) break;
      }
    }
    expect(gained).toBeGreaterThan(0);
    expect(caught).toBe(true);
    expect(sim.hp).toBeLessThan(hpBefore);
    expect(sim.skills.xp["skill.thieving"]).toBeGreaterThan(0);
  });

  it("gates the strongbox behind Thieving 5", () => {
    const sim = new GameSimulation(
      flatRegion([{ instanceId: "t.box", defId: "resource.strongbox.old", cell: { x: 4, z: 4 } }]),
      7,
    );
    sim.enqueue({ type: "interact", targetId: "t.box" });
    const events = runTicks(sim, 3);
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "level_too_low")).toBe(true);
  });
});

describe("agility shortcuts", () => {
  const shortcutRegion = (): RegionSpec =>
    flatRegion(
      [],
      [
        {
          instanceId: "t.log",
          defId: "object.shortcut.log",
          cell: { x: 4, z: 4 },
          portal: { targetRegionId: "region.newskills_test", targetCell: { x: 10, z: 10 } },
        },
        {
          instanceId: "t.rope",
          defId: "object.shortcut.wallrope",
          cell: { x: 6, z: 6 },
          portal: { targetRegionId: "region.newskills_test", targetCell: { x: 12, z: 12 } },
        },
      ],
    );

  it("hops the player across and grants Agility xp", () => {
    const sim = new GameSimulation(shortcutRegion(), 5);
    sim.enqueue({ type: "interact", targetId: "t.log" });
    runUntil(sim, (e) => e.type === "shortcutUsed", 200);
    expect(sim.movement.currentCell()).toEqual({ x: 10, z: 10 });
    expect(sim.skills.xp["skill.agility"]).toBeGreaterThan(0);
  });

  it("rejects a shortcut above the player's level", () => {
    const sim = new GameSimulation(shortcutRegion(), 5);
    sim.enqueue({ type: "interact", targetId: "t.rope" }); // needs Agility 7
    const events = runTicks(sim, 3);
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "level_too_low")).toBe(true);
  });
});

describe("slaying assignments", () => {
  it("assigns, tracks kills, and pays out at Warden Brusk", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 31);
    // Talk to the warden: a task is assigned.
    const brusk = sim.npcs.get("village.npc.brusk")!;
    sim.movement.setCellPosition({ x: brusk.movement.currentCell().x - 1, z: brusk.movement.currentCell().z });
    sim.enqueue({ type: "interact", targetId: "village.npc.brusk" });
    const assigned = runUntil(sim, (e) => e.type === "slayerTaskAssigned", 200);
    const task = assigned.find((e) => e.type === "slayerTaskAssigned")!;
    expect(task.type === "slayerTaskAssigned" && task.count).toBeGreaterThan(0);
    expect(sim.slayer.state.taskDefId).toBe("enemy.spider");

    // Shrink the tally to one, kill a spider, and the task completes.
    sim.slayer.state.remaining = 1;
    const spider = [...sim.enemies.enemies.values()].find(
      (e) => e.defId === "enemy.spider" && e.phase === "alive",
    )!;
    sim.skills.grantXp("skill.attack", 5000);
    spider.hp = 1; // one clean hit finishes it — the fight isn't under test
    const cell = spider.movement.currentCell();
    sim.movement.setCellPosition({ x: cell.x - 1, z: cell.z });
    sim.enqueue({ type: "interact", targetId: spider.instanceId });
    runUntil(sim, (e) => e.type === "slayerTaskProgress" && e.remaining === 0, 2000);

    // Report back: xp + coins, and the next task queues on a fresh talk.
    sim.movement.setCellPosition({ x: brusk.movement.currentCell().x - 1, z: brusk.movement.currentCell().z });
    sim.enqueue({ type: "interact", targetId: "village.npc.brusk" });
    const paid = runUntil(sim, (e) => e.type === "slayerTaskComplete", 200);
    expect(paid.some((e) => e.type === "slayerTaskAssigned")).toBe(true); // next task, same visit
    expect(sim.skills.xp["skill.slaying"]).toBeGreaterThan(0);
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(0);
  });
});

describe("the relic collection", () => {
  it("donates relics to Curator Fenwick and completes the roster", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 32);
    const fenwick = sim.npcs.get("village.npc.fenwick")!;
    const at = fenwick.movement.currentCell();
    sim.movement.setCellPosition({ x: at.x - 1, z: at.z });

    sim.inventory.add("item.relic.idol", 1);
    sim.inventory.add("item.relic.shard", 3);
    sim.enqueue({ type: "interact", targetId: "village.npc.fenwick" });
    const donated = runUntil(sim, (e) => e.type === "relicDonated", 200);
    expect(donated.some((e) => e.type === "relicDonated" && e.itemId === "item.relic.idol" && e.firstOfKind)).toBe(true);
    expect(sim.inventory.count("item.relic.idol")).toBe(0);
    expect(sim.skills.xp["skill.archaeology"]).toBeGreaterThan(0);

    // The rest of the roster completes the collection for the big reward.
    const coinsBefore = sim.inventory.count("item.coin");
    for (const id of ["item.relic.urn", "item.relic.coin", "item.relic.tablet", "item.relic.mask"]) {
      sim.inventory.add(id, 1);
    }
    sim.enqueue({ type: "interact", targetId: "village.npc.fenwick" });
    runUntil(sim, (e) => e.type === "relicCollectionComplete", 200);
    expect(sim.inventory.count("item.coin")).toBeGreaterThan(coinsBefore);
    // Donating more of a known type never re-fires the completion bonus.
    sim.inventory.add("item.relic.urn", 1);
    sim.enqueue({ type: "interact", targetId: "village.npc.fenwick" });
    const again = runUntil(sim, (e) => e.type === "relicDonated", 200);
    expect(again.some((e) => e.type === "relicCollectionComplete")).toBe(false);
  });
});

describe("potions with teeth", () => {
  it("Forager's Brew pushes an impossible gather into the possible", () => {
    // A pathological node: 0% base chance, no level growth, capped at 0.
    // Only the +0.08 gathering buff can ever make a cycle succeed.
    NODES["resource.test.hopeless"] = {
      ...NODES["resource.bush.berry"],
      id: "resource.test.hopeless",
      requiredLevel: 1,
      successBase: 0,
      successPerLevel: 0,
      successMax: 0,
      resourceMin: 50,
      resourceMax: 50,
    };
    const region = flatRegion([
      { instanceId: "t.hopeless", defId: "resource.test.hopeless", cell: { x: 4, z: 4 } },
    ]);
    const dry = new GameSimulation(region, 33);
    dry.enqueue({ type: "interact", targetId: "t.hopeless" });
    const withoutBuff = runTicks(dry, 800);
    expect(withoutBuff.some((e) => e.type === "itemGained")).toBe(false);

    const buffed = new GameSimulation(region, 33);
    buffed.inventory.add("item.potion.gathering", 1);
    buffed.enqueue({ type: "eatSlot", slot: 0 });
    buffed.tick();
    expect(buffed.buffs["gathering"]).toBeGreaterThan(0);
    buffed.enqueue({ type: "interact", targetId: "t.hopeless" });
    const withBuff = runTicks(buffed, 800);
    expect(withBuff.some((e) => e.type === "itemGained")).toBe(true);
    delete NODES["resource.test.hopeless"];
  });

  it("Oakblood Tonic knits wounds even without resting", () => {
    const sim = new GameSimulation(flatRegion([]), 34);
    sim.damagePlayer(8);
    const low = sim.hp;
    sim.inventory.add("item.tonic.oakblood", 1);
    sim.enqueue({ type: "eatSlot", slot: 0 });
    sim.tick();
    expect(sim.buffs["regen"]).toBeGreaterThan(0);
    runTicks(sim, 60); // 6 seconds: regen delay would normally still be idle
    expect(sim.hp).toBeGreaterThan(low);
  });
});

describe("new construction sites", () => {
  it("lays the ford: stones bridge the lower Silverrun and stay in the save flags", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 35);
    const site = sim.world.region.objects.find((o) => o.defId === "object.buildsite.ford")!;
    // The channel west of the site is open water before the work.
    let midRiver: { x: number; z: number } | null = null;
    for (let x = site.cell.x - 12; x < site.cell.x; x++) {
      if (!sim.world.walkable({ x, z: site.cell.z })) midRiver = { x, z: site.cell.z };
    }
    expect(midRiver).toBeTruthy();
    sim.inventory.add("item.stone.rough", 8);
    sim.inventory.add("item.plank.cut", 4);
    sim.movement.setCellPosition({ x: site.cell.x + 2, z: site.cell.z });
    sim.enqueue({ type: "interact", targetId: site.instanceId });
    runUntil(sim, (e) => e.type === "worldFlagSet" && e.flag === "worldstate.ford_built", 400);
    expect(sim.world.walkable(midRiver!)).toBe(true);
    expect(sim.skills.xp["skill.construction"]).toBeGreaterThan(0);
  });

  it("builds the road ramp and records the flag", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 36);
    const site = sim.world.region.objects.find((o) => o.defId === "object.buildsite.ramp")!;
    sim.inventory.add("item.brick.stone", 6);
    sim.inventory.add("item.plank.cut", 4);
    sim.movement.setCellPosition({ x: site.cell.x + 2, z: site.cell.z + 2 });
    sim.enqueue({ type: "interact", targetId: site.instanceId });
    runUntil(sim, (e) => e.type === "worldFlagSet" && e.flag === "worldstate.ramp_built", 400);
    expect(sim.skills.xp["skill.construction"]).toBeGreaterThan(0);
    // The laid steps climb one block at a time.
    const col = site.cell.x;
    let prev = sim.world.heightAt({ x: col, z: site.cell.z + 1 });
    for (let z = site.cell.z; z >= site.cell.z - 2; z--) {
      const h = sim.world.heightAt({ x: col, z });
      expect(Math.abs(h - prev)).toBeLessThanOrEqual(1);
      prev = h;
    }
  });
});

describe("slayer assignments are always completable", () => {
  it("only assigns enemies that actually spawn somewhere", async () => {
    const { REGION_BUILDERS, buildRegion } = await import("../world");
    const spawned = new Set<string>();
    for (const id of Object.keys(REGION_BUILDERS)) {
      for (const e of buildRegion(id).enemies ?? []) spawned.add(e.defId);
    }
    // The endless wild spawns its beasts from the danger-tier pools.
    const { DANGER_MOBS } = await import("../worldgen/endless");
    for (const pool of DANGER_MOBS) for (const id of pool) spawned.add(id);
    const { ASSIGNMENTS } = await import("../taskmasters");
    expect(ASSIGNMENTS.length).toBeGreaterThan(0);
    for (const a of ASSIGNMENTS) {
      expect(spawned.has(a.defId), `${a.defId} is assigned by Brusk but never spawns`).toBe(true);
    }
  });
});
