// The tutorial vale is a sealed sandbox: no wild content streams in anywhere
// (inside the walls is placed by tutorialRegion; outside is bare terrain).

import { afterEach, describe, expect, it } from "vitest";
import { ECHUNK, ENDLESS_CENTER, generateChunk, setValeActive } from "../worldgen/endless";

const cc = Math.floor(ENDLESS_CENTER / ECHUNK);

describe("tutorial vale is confined", () => {
  afterEach(() => setValeActive(false));

  it("streams no wild content while the vale is active (only the wall's torches)", () => {
    setValeActive(true);
    let nodes = 0, enemies = 0, structures = 0;
    const nonTorchObjects: string[] = [];
    // Sweep a wide square of chunks around the vale — well past the 125-cell wall.
    for (let dz = -4; dz <= 4; dz++) {
      for (let dx = -4; dx <= 4; dx++) {
        const ch = generateChunk(20706, cc + dx, cc + dz);
        nodes += ch.nodes.length;
        enemies += ch.enemies.length;
        structures += ch.structures.length;
        for (const o of ch.objects) if (o.defId !== "object.torch.wall") nonTorchObjects.push(o.defId);
      }
    }
    // No wild resource nodes, beasts, dungeons/ruins, or props — nothing streams.
    expect(nodes).toBe(0);
    expect(enemies).toBe(0);
    expect(structures).toBe(0);
    expect(nonTorchObjects).toEqual([]);
  });

  it("still streams a rich wild world once the vale is off", () => {
    setValeActive(false);
    let total = 0;
    for (let dz = -3; dz <= 3; dz++) {
      for (let dx = -3; dx <= 3; dx++) {
        const ch = generateChunk(20706, cc + dx, cc + dz);
        total += ch.nodes.length + ch.objects.length + ch.enemies.length + ch.structures.length;
      }
    }
    expect(total).toBeGreaterThan(0);
  });
});
