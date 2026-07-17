// The coastal fishing ladder is distance-gated: home shores hold shrimp and
// tidal runs, and each higher tier only ever appears farther from the anchor.

import { describe, expect, it } from "vitest";
import { ECHUNK, ENDLESS_CENTER, generateChunk, remoteness01 } from "../worldgen/endless";

const cc = Math.floor(ENDLESS_CENTER / ECHUNK);
const SEED = 20706;

const GATES: Record<string, number> = {
  "resource.fishing.crab": 0.03,
  "resource.fishing.lobster": 0.07,
  "resource.fishing.marlin": 0.12,
  "resource.fishing.abyss": 0.2,
  "resource.fishing.storm": 0.3,
};

describe("coastal fishing ladder", () => {
  it("every tier respects its remoteness gate, and higher tiers exist out there", () => {
    const seen = new Set<string>();
    // Sweep rings of chunks from home out to ~2600 cells: near ones prove the
    // gates hold, far ones prove the spots actually spawn.
    for (const ringR of [0, 2, 5, 9, 14, 20, 26, 32, 38]) {
      for (let k = -ringR; k <= ringR; k += Math.max(1, ringR)) {
        for (const [dx, dz] of [[ringR, k], [-ringR, k], [k, ringR], [k, -ringR]] as const) {
          const ch = generateChunk(SEED, cc + dx, cc + dz);
          for (const n of ch.nodes) {
            if (!n.defId.startsWith("resource.fishing.")) continue;
            seen.add(n.defId);
            const gate = GATES[n.defId];
            if (gate !== undefined) {
              expect(remoteness01(n.cell.x, n.cell.z), `${n.defId} at ${n.cell.x},${n.cell.z}`)
                .toBeGreaterThanOrEqual(gate);
            }
            // Shrimp shoals are a home-waters catch only.
            if (n.defId === "resource.fishing.shrimp") {
              expect(remoteness01(n.cell.x, n.cell.z)).toBeLessThan(0.03);
            }
          }
        }
      }
    }
    // The starter-adjacent tiers must be reachable early…
    expect(seen.has("resource.fishing.shrimp") || seen.has("resource.fishing.sea") ||
      seen.has("resource.fishing.river") || seen.has("resource.fishing.pond")).toBe(true);
    // …and at least some of the far-water tiers exist in the swept band.
    const far = ["resource.fishing.crab", "resource.fishing.lobster", "resource.fishing.marlin",
      "resource.fishing.abyss", "resource.fishing.storm"].filter((d) => seen.has(d));
    expect(far.length, `far tiers seen: ${far.join(", ") || "none"}`).toBeGreaterThanOrEqual(2);
  });
});
