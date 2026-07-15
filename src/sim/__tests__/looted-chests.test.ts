// Looted-chest persistence: emptying a dungeon chest marks it looted, and the
// regenerating floor drops it on a later visit instead of refilling it.

import { describe, expect, it } from "vitest";
import { GameSimulation } from "../simulation";
import { buildRegion } from "../world";
import { dynDungeonId } from "../worldgen/dungeons";

const EXIT = { x: 80, z: 80 };

/** The instance id of the first storage chest in a built dungeon floor. */
function firstChest(regionId: string): { id: string; region: ReturnType<typeof buildRegion> } {
  const region = buildRegion(regionId);
  const chest = region.objects.find((o) => o.defId === "object.storage_chest.basic");
  if (!chest) throw new Error("no chest in floor");
  return { id: chest.instanceId, region };
}

describe("looted-chest persistence", () => {
  it("drops a looted chest when the floor regenerates", () => {
    // A finite dungeon floor with a chest; find one.
    const id = dynDungeonId("mine", 4242, 1, 3, EXIT);
    const { id: chestId } = firstChest(id);
    // Rebuilt with the looted flag, that chest is gone.
    const relit = buildRegion(id, [`looted.${chestId}`]);
    expect(relit.objects.some((o) => o.instanceId === chestId)).toBe(false);
    // Other chests (unlooted) still stand.
    const stillHasChests = relit.objects.some((o) => o.defId === "object.storage_chest.basic");
    const originalChests = buildRegion(id).objects.filter((o) => o.defId === "object.storage_chest.basic").length;
    expect(originalChests).toBeGreaterThan(0);
    if (originalChests > 1) expect(stillHasChests).toBe(true);
  });

  it("marks a dungeon chest looted once the player empties it", () => {
    const id = dynDungeonId("mine", 4242, 1, 3, EXIT);
    const { id: chestId, region } = firstChest(id);
    const sim = new GameSimulation(region, 1);
    // The container was seeded from the chest's initial items.
    const chest = sim.containers.get(chestId);
    expect(chest).toBeTruthy();
    // Empty it and mark the chest open, then run the loot hook.
    chest!.slots.fill(null);
    (sim.actions as unknown as { openContainerId: string | null }).openContainerId = chestId;
    (sim as unknown as { noteChestLooted(): void }).noteChestLooted();
    expect(sim.worldFlags.has(`looted.${chestId}`)).toBe(true);
  });

  it("does not mark a chest looted while items remain", () => {
    const id = dynDungeonId("mine", 4242, 1, 3, EXIT);
    const { id: chestId, region } = firstChest(id);
    const sim = new GameSimulation(region, 1);
    const chest = sim.containers.get(chestId)!;
    // Leave at least one item.
    chest.slots.fill(null);
    chest.add("item.coin", 5);
    (sim.actions as unknown as { openContainerId: string | null }).openContainerId = chestId;
    (sim as unknown as { noteChestLooted(): void }).noteChestLooted();
    expect(sim.worldFlags.has(`looted.${chestId}`)).toBe(false);
  });

  it("only tracks chests in regenerating dungeons, not the open world", () => {
    const sim = GameSimulation.createEndless(1);
    // region.id is region.endless here; the loot hook no-ops before it even
    // looks at the open container.
    (sim.actions as unknown as { openContainerId: string | null }).openContainerId = "some.chest";
    (sim as unknown as { noteChestLooted(): void }).noteChestLooted();
    expect([...sim.worldFlags].some((f) => f.startsWith("looted."))).toBe(false);
  });
});
