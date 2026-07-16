// The editor's "delete asset from the game" dev tool: a disabled asset must
// stop streaming into the endless world through the ChunkManager, and come
// back when restored. Deletion is the model-prefs disabled set.

import { afterEach, describe, expect, it } from "vitest";
import { isModelEnabled, setModelEnabled } from "../../render/model-prefs";
import { GameSimulation } from "../simulation";

/** Every node def id streamed active around the player right now. */
function activeNodeDefs(sim: GameSimulation): Set<string> {
  return new Set(sim.world.region.nodes.map((n) => n.defId));
}

describe("deleting an asset stops it spawning", () => {
  const touched: string[] = [];
  afterEach(() => {
    for (const id of touched.splice(0)) setModelEnabled(id, true); // restore
  });

  it("a disabled node never streams into the endless world; restoring brings it back", () => {
    const seed = 4242;
    // Baseline: build the world and pick a node that actually streamed in.
    const before = GameSimulation.createEndless(seed);
    const present = activeNodeDefs(before);
    expect(present.size).toBeGreaterThan(0);
    const target = [...present][0];

    // Delete it (as the editor's trash button does), then rebuild the world.
    touched.push(target);
    setModelEnabled(target, false);
    expect(isModelEnabled(target)).toBe(false);
    const deleted = GameSimulation.createEndless(seed);
    expect(activeNodeDefs(deleted).has(target), `${target} still spawned after delete`).toBe(false);

    // Restore it — it streams again, deterministically.
    setModelEnabled(target, true);
    const restored = GameSimulation.createEndless(seed);
    expect(activeNodeDefs(restored).has(target), `${target} did not come back after restore`).toBe(true);
  });
});
