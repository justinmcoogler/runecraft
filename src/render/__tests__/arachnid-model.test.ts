import { describe, expect, it } from "vitest";
import { ENEMIES } from "../../content/content";
import {
  ARACHNID_ENEMY_IDS,
  ARACHNID_LEGS,
  ARACHNID_STYLES,
} from "../arachnid-model";

describe("native arachnid voxel rigs", () => {
  it("covers every live spider and gnasher definition", () => {
    const liveIds = Object.values(ENEMIES)
      .filter((def) => def.view === "spider" || def.view === "gnasher")
      .map((def) => def.id)
      .sort();

    expect(liveIds).toEqual([...ARACHNID_ENEMY_IDS].sort());
    expect(Object.keys(ARACHNID_STYLES).sort()).toEqual([...ARACHNID_ENEMY_IDS].sort());
  });

  it("gives every variant authored feature geometry and a complete palette", () => {
    const features = new Set<string>();
    for (const id of ARACHNID_ENEMY_IDS) {
      const style = ARACHNID_STYLES[id];
      features.add(style.feature);
      expect(style.body, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.shell, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.leg, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.accent, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.eye, id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.abdomen.every((dimension) => dimension > 0), id).toBe(true);
    }
    expect(features.size).toBe(ARACHNID_ENEMY_IDS.length);
  });

  it("defines eight mirrored, independently articulated gait rows", () => {
    expect(ARACHNID_LEGS).toHaveLength(8);
    expect(ARACHNID_LEGS.filter((leg) => leg.side === -1)).toHaveLength(4);
    expect(ARACHNID_LEGS.filter((leg) => leg.side === 1)).toHaveLength(4);
    expect(ARACHNID_LEGS.filter((leg) => leg.phase === 0)).toHaveLength(4);
    expect(ARACHNID_LEGS.filter((leg) => leg.phase === Math.PI)).toHaveLength(4);

    for (let slot = 0; slot < 4; slot++) {
      const left = ARACHNID_LEGS.find((leg) => leg.side === -1 && leg.slot === slot)!;
      const right = ARACHNID_LEGS.find((leg) => leg.side === 1 && leg.slot === slot)!;
      expect(left.attachZ).toBe(right.attachZ);
      expect(left.yaw).toBe(-right.yaw);
      expect(Math.abs(left.phase - right.phase)).toBe(Math.PI);
    }
  });
});
