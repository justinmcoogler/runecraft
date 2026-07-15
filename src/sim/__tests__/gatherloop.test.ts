// Integration tests: the full tree-gathering loop running headless.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import type { SimEvent } from "../types";
import { makeTestRegion } from "./testRegion";

const TREE = "test.tree.001";
const CHEST = "test.chest.001";

function runTicks(sim: GameSimulation, n: number): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) all.push(...sim.tick());
  return all;
}

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 3000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

describe("tree gathering loop", () => {
  it("walks to the tree, chops it to depletion, awards logs and matching XP, then respawns it", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    const initialResources = sim.nodes.get(TREE)!.remaining;
    expect(initialResources).toBeGreaterThanOrEqual(4);

    sim.enqueue({ type: "interact", targetId: TREE });
    const events = runUntil(sim, (e) => e.type === "nodeDepleted");

    expect(events.some((e) => e.type === "actionStarted")).toBe(true);
    expect(sim.inventory.count("item.log.basic")).toBe(initialResources);
    expect(sim.skills.xp["skill.woodcutting"]).toBe(initialResources * 14);
    expect(sim.nodes.get(TREE)!.phase).toBe("depleted");
    expect(events.some((e) => e.type === "actionEnded" && e.state === "completed")).toBe(true);

    // Respawn after 20s of sim time (200 ticks at 10 Hz).
    const respawn = runUntil(sim, (e) => e.type === "nodeRespawned", 250);
    expect(respawn.length).toBeGreaterThan(0);
    expect(sim.nodes.get(TREE)!.phase).toBe("active");
    expect(sim.nodes.get(TREE)!.remaining).toBeGreaterThan(0);
  });

  it("rejects gathering without an axe", () => {
    const sim = new GameSimulation(makeTestRegion(), 7);
    sim.equippedTool = null; // no axe anywhere
    sim.enqueue({ type: "interact", targetId: TREE });
    const events = runTicks(sim, 2);
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "missing_tool")).toBe(true);
  });

  it("a new move command supersedes the gather pipeline", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.enqueue({ type: "interact", targetId: TREE });
    runUntil(sim, (e) => e.type === "actionStarted");
    const logsAtCancel = sim.inventory.count("item.log.basic");

    sim.enqueue({ type: "moveTo", cell: { x: 1, z: 1 } });
    const events = runTicks(sim, 1);
    expect(
      events.some((e) => e.type === "actionEnded" && e.state === "cancelled" && e.reason === "superseded"),
    ).toBe(true);

    const later = runTicks(sim, 100);
    const gainedAfter = later.filter((e) => e.type === "itemGained").length;
    expect(gainedAfter).toBe(0);
    expect(sim.inventory.count("item.log.basic")).toBe(logsAtCancel);
  });

  it("cancel command stops the action", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.enqueue({ type: "interact", targetId: TREE });
    runUntil(sim, (e) => e.type === "actionStarted");
    sim.enqueue({ type: "cancel" });
    const events = runTicks(sim, 1);
    expect(events.some((e) => e.type === "actionEnded" && e.state === "cancelled")).toBe(true);
  });

  it("losing the tool mid-action interrupts at the next cycle", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.enqueue({ type: "interact", targetId: TREE });
    runUntil(sim, (e) => e.type === "actionStarted");
    sim.equippedTool = null; // simulate the axe being dropped/removed
    const events = runTicks(sim, 30);
    expect(
      events.some((e) => e.type === "actionEnded" && e.state === "interrupted" && e.reason === "missing_tool"),
    ).toBe(true);
  });

  it("a full inventory stops gathering with a warning", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.inventory.add("item.log.basic", 20 * 50); // fill all slots
    expect(sim.inventory.canAdd("item.log.basic", 1)).toBe(false);
    sim.enqueue({ type: "interact", targetId: TREE });
    const events = runUntil(sim, (e) => e.type === "actionEnded", 200);
    expect(events.some((e) => e.type === "inventoryFull")).toBe(true);
    expect(events.some((e) => e.type === "actionEnded" && e.state === "failed" && e.reason === "inventory_full")).toBe(true);
    expect(sim.nodes.get(TREE)!.remaining).toBeGreaterThan(0); // node not consumed on failed cycle
  });

  it("interacting with a depleted tree is rejected", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.enqueue({ type: "interact", targetId: TREE });
    runUntil(sim, (e) => e.type === "nodeDepleted");
    sim.enqueue({ type: "interact", targetId: TREE });
    const events = runTicks(sim, 2);
    expect(events.some((e) => e.type === "actionRejected" && e.reason === "node_unavailable")).toBe(true);
  });

  it("rapid re-targeting leaves exactly one live pipeline (last tap wins)", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    for (let i = 0; i < 5; i++) {
      sim.enqueue({ type: "interact", targetId: TREE });
      sim.enqueue({ type: "moveTo", cell: { x: 4, z: 4 } });
    }
    sim.enqueue({ type: "interact", targetId: TREE });
    runUntil(sim, (e) => e.type === "nodeDepleted"); // still converges to a completed chop
  });
});

describe("storage chest", () => {
  it("opens in range, deposits all logs transactionally, withdraws back", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.inventory.add("item.log.basic", 12);

    sim.enqueue({ type: "interact", targetId: CHEST });
    runUntil(sim, (e) => e.type === "containerOpened");

    sim.enqueue({ type: "depositAll" });
    sim.tick();
    const chest = sim.containers.get(CHEST)!;
    expect(sim.inventory.count("item.log.basic")).toBe(0);
    expect(chest.count("item.log.basic")).toBe(12);

    sim.enqueue({ type: "withdraw", slot: 0 });
    sim.tick();
    expect(sim.inventory.count("item.log.basic")).toBe(12);
    expect(chest.count("item.log.basic")).toBe(0);
  });

  it("walking away closes the container", () => {
    const sim = new GameSimulation(makeTestRegion(), 42);
    sim.enqueue({ type: "interact", targetId: CHEST });
    runUntil(sim, (e) => e.type === "containerOpened");
    sim.enqueue({ type: "moveTo", cell: { x: 8, z: 2 } });
    const events = runTicks(sim, 40);
    expect(events.some((e) => e.type === "containerClosed")).toBe(true);
    expect(sim.actions.openContainerId).toBeNull();
  });
});
