// Surface ore distribution: only common ores (coal/copper/tin/iron) surface in
// the open world; the precious and exotic ores are underground-only, and any
// rare surface vein is downgraded to a common one.

import { beforeEach, describe, expect, it } from "vitest";
import { ECHUNK, ENDLESS_CENTER, generateChunk, setValeActive } from "../worldgen/endless";
import { dungeonSpecFor } from "../worldgen/dungeons";

const cc = Math.floor(ENDLESS_CENTER / ECHUNK);
const COMMON = new Set(["resource.rock.copper", "resource.rock.tin", "resource.rock.coal", "resource.rock.iron"]);
const RARE = ["gold", "redstone", "lapis", "diamond", "emerald", "quartz", "netherite", "essence"].map((o) => `resource.rock.${o}`);

describe("surface ore distribution", () => {
  beforeEach(() => setValeActive(false));

  it("never surfaces a rare ore across a wide multi-seed sweep", () => {
    const surfaced = new Set<string>();
    for (const seed of [7, 4242, 99, 31337]) {
      // Sweep near-home and far-out chunks so every danger tier is covered.
      for (let i = 0; i < 24; i++) {
        const ch = generateChunk(seed, cc + i * 5, cc + i * 3);
        for (const n of ch.nodes) if (n.defId.startsWith("resource.rock.")) surfaced.add(n.defId);
      }
      for (let i = 1; i <= 20; i++) {
        const far = Math.floor((ENDLESS_CENTER + 7000) / ECHUNK);
        const ch = generateChunk(seed, far + i, cc + i);
        for (const n of ch.nodes) if (n.defId.startsWith("resource.rock.")) surfaced.add(n.defId);
      }
    }
    // Some common ore was surfaced…
    expect([...surfaced].some((o) => COMMON.has(o))).toBe(true);
    // …and no rare ore ever was.
    for (const rare of RARE) expect(surfaced.has(rare), `${rare} surfaced`).toBe(false);
  });

  it("still stocks the rare ores in underground mine/vault dungeons", () => {
    // Sweep seeds (affixes can swap a single dungeon's rock pool) and collect
    // every ore the deep places offer.
    const underground = new Set<string>();
    for (let s = 0; s < 24; s++) {
      for (const style of ["mine", "vault", "foundry", "sanctum"] as const) {
        for (const r of dungeonSpecFor(style, s, 3, 5, { x: 0, z: 0 }).rocks ?? []) underground.add(r.defId);
      }
    }
    // The deep is where diamonds and gold live.
    expect(underground.has("resource.rock.diamond")).toBe(true);
    expect(underground.has("resource.rock.gold")).toBe(true);
  });
});
