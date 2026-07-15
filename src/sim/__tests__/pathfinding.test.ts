import { describe, expect, it } from "vitest";
import { findPath } from "../pathfinding";
import { WorldState } from "../world";
import { makeTestRegion } from "./testRegion";

describe("grid A*", () => {
  it("finds a straight path on open ground", () => {
    const world = new WorldState(makeTestRegion());
    const path = findPath(world, { x: 0, z: 0 }, { x: 4, z: 0 });
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 4, z: 0 });
    expect(path!.length).toBe(4);
  });

  it("routes around blockers", () => {
    const world = new WorldState(makeTestRegion());
    // Wall across x=3 except a gap at z=9.
    for (let z = 0; z <= 8; z++) world.registerBlocker(`wall.${z}`, { x: 3, z });
    const path = findPath(world, { x: 0, z: 0 }, { x: 6, z: 0 });
    expect(path).not.toBeNull();
    expect(path!.some((c) => c.z >= 8)).toBe(true); // went through the gap
    expect(path!.every((c) => world.walkable(c))).toBe(true);
  });

  it("returns null for unreachable targets", () => {
    const world = new WorldState(makeTestRegion());
    for (let z = 0; z <= 9; z++) world.registerBlocker(`wall.${z}`, { x: 3, z });
    expect(findPath(world, { x: 0, z: 0 }, { x: 6, z: 0 })).toBeNull();
  });

  it("refuses elevation steps greater than one", () => {
    const region = makeTestRegion();
    // A 2-high pillar ridge across x=3.
    for (let z = 0; z <= 9; z++) region.heights[z * region.width + 3] = 2;
    const world = new WorldState(region);
    expect(findPath(world, { x: 0, z: 0 }, { x: 6, z: 0 })).toBeNull();
  });
});
