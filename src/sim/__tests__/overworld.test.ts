// Province validation: the non-negotiables of the world charter.
//
// The core proof is a single flood fill from spawn that only ever moves
// between adjacent walkable cells whose heights differ by at most one and
// never crosses water. Any location that flood reaches therefore has a
// Primary Accessible Route BY CONSTRUCTION: no jumps, no swimming, no
// climbing, no block placement or breaking, no steps over one block.
// Every key POI must sit inside that flooded set.

import { describe, expect, it } from "vitest";
import { ENEMIES, ITEMS, NODES, OBJECTS, QUESTS, RECIPES, SKILLS, ZONES } from "../../content/content";
import { applySave, serialize } from "../../save/save";
import type { SimEvent } from "../types";
import { REGION_BUILDERS } from "../world";
import { GameSimulation } from "../simulation";
import { BIOME } from "../worldgen/geo";
import { buildOverworld } from "../worldgen/overworld";
import { ENDLESS_CENTER, tutorialRegion } from "../worldgen/endless";
import { REGIONS, SPAWN, WORLD } from "../worldgen/regions";
import { buildRegion, WorldState } from "../world";
import { findPath } from "../pathfinding";

const { region, pois, roads, biome } = buildOverworld();

/** Flood from spawn under Primary Accessible Route rules (4-dir, step<=1, dry). */
function primaryFlood(): Uint8Array {
  const sim = new GameSimulation(buildRegion("region.vale_clearing"), 1);
  const world = sim.world;
  const W = region.width;
  const seen = new Uint8Array(W * W);
  const queue = new Int32Array(W * W);
  let tail = 0;
  let head = 0;
  seen[SPAWN.z * W + SPAWN.x] = 1;
  queue[tail++] = SPAWN.z * W + SPAWN.x;
  while (head < tail) {
    const i = queue[head++];
    const x = i % W;
    const z = (i / W) | 0;
    const h = region.heights[i];
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]] as const) {
      if (nx < 0 || nz < 0 || nx >= W || nz >= W) continue;
      const ni = nz * W + nx;
      if (seen[ni]) continue;
      if (Math.abs(region.heights[ni] - h) > 1) continue;
      if (!world.walkable({ x: nx, z: nz })) continue;
      seen[ni] = 1;
      queue[tail++] = ni;
    }
  }
  return seen;
}
const flooded = primaryFlood();
const reachedNear = (x: number, z: number, r = 5): boolean => {
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= WORLD || nz >= WORLD) continue;
      if (flooded[nz * WORLD + nx]) return true;
    }
  }
  return false;
};

describe("the starter province", () => {
  it("is exactly 2500x2500 and uses the whole map, not just the center", () => {
    expect(region.width).toBe(2500);
    expect(region.depth).toBe(2500);
    // Settlements in every quadrant, well outside the central 1000x1000.
    const s = pois.filter((p) => p.kind === "settlement");
    expect(s.some((p) => p.x < 1000 && p.z < 1000)).toBe(true); // NW
    expect(s.some((p) => p.x > 1500 && p.z < 1000)).toBe(true); // NE
    expect(s.some((p) => p.x < 1000 && p.z > 1500)).toBe(true); // SW
    expect(s.some((p) => p.x > 1500 && p.z > 1500)).toBe(true); // SE
  });

  it("meets the content charter counts", () => {
    const count = (kind: string) => pois.filter((p) => p.kind === kind).length;
    expect(count("settlement")).toBeGreaterThanOrEqual(8);
    expect(count("dungeon")).toBeGreaterThanOrEqual(8);
    expect(count("landmark") + count("discovery")).toBeGreaterThanOrEqual(50);
    expect(count("bridge")).toBeGreaterThanOrEqual(5); // the charter asks five over the waterways
    expect(count("expansion")).toBeGreaterThanOrEqual(4);
    // Signposts mark the junctions; discoveries dot the verges.
    expect(region.objects.filter((o) => o.defId === "object.signpost").length).toBeGreaterThanOrEqual(20);
  });

  it("gives every key POI a Primary Accessible Route from spawn", () => {
    const stranded: string[] = [];
    for (const p of pois) {
      if (p.kind === "expansion") continue; // sealed exits may sit beyond walls
      if (!reachedNear(p.x, p.z)) stranded.push(`${p.name} @ ${p.x},${p.z}`);
    }
    expect(stranded, stranded.join("; ")).toEqual([]);
  });

  it("keeps every expansion exit visible from a reachable verge", () => {
    for (const p of pois.filter((q) => q.kind === "expansion")) {
      expect(reachedNear(p.x, p.z, 26), p.name).toBe(true);
    }
  });

  it("references only real content ids in every placement", () => {
    for (const n of region.nodes) expect(NODES[n.defId], n.defId).toBeDefined();
    for (const o of region.objects) {
      expect(OBJECTS[o.defId], o.defId).toBeDefined();
      for (const item of o.initialItems ?? []) {
        expect(ITEMS[item.itemId], item.itemId).toBeDefined();
      }
    }
    for (const e of region.enemies ?? []) expect(ENEMIES[e.defId], e.defId).toBeDefined();
  });

  it("teaches the basics within sight of spawn", () => {
    const near = (pred: (o: { defId: string; instanceId: string }) => boolean, r: number) =>
      region.objects.some(
        (o) => pred(o) && Math.abs(o.cell.x - SPAWN.x) <= r && Math.abs(o.cell.z - SPAWN.z) <= r,
      );
    expect(near((o) => o.defId === "object.storage_chest.basic", 70)).toBe(true); // bank
    expect(near((o) => o.defId === "object.furnace.basic", 70)).toBe(true);
    expect(near((o) => o.defId === "object.campfire.basic", 70)).toBe(true); // cooking
    expect(near((o) => o.defId === "object.workbench.basic", 70)).toBe(true);
    expect(near((o) => o.instanceId === "gv.storedoor.001", 70)).toBe(true); // shop
    // Training and first quests: dummies and the taskmasters.
    const dummies = (region.enemies ?? []).filter(
      (e) => e.defId === "enemy.target_dummy" && Math.abs(e.cell.x - SPAWN.x) < 90 && Math.abs(e.cell.z - SPAWN.z) < 90,
    );
    expect(dummies.length).toBeGreaterThanOrEqual(2);
    for (const id of ["village.npc.brusk", "village.npc.fenwick", "castle.npc.corin"]) {
      expect(region.npcs.some((n) => n.instanceId === id), id).toBe(true);
    }
    // Woodcutting, mining, fishing, farming all begin in Greenvale.
    const gnodes = region.nodes.filter(
      (n) => Math.abs(n.cell.x - 1250) < 240 && Math.abs(n.cell.z - 1420) < 240,
    );
    expect(gnodes.some((n) => n.defId.startsWith("resource.tree."))).toBe(true);
    expect(gnodes.some((n) => n.defId.startsWith("resource.plot."))).toBe(true);
    expect(gnodes.some((n) => n.defId.startsWith("resource.fishing."))).toBe(true);
  });

  it("shapes no biome as a rectangle and crosses no border in a straight line", () => {
    for (const [id, name] of [
      [BIOME.forest, "forest"], [BIOME.desert, "desert"], [BIOME.swamp, "swamp"],
      [BIOME.mountain, "mountain"], [BIOME.taiga, "taiga"],
    ] as const) {
      let x0 = WORLD, x1 = 0, z0 = WORLD, z1 = 0, count = 0;
      for (let z = 0; z < WORLD; z += 5) {
        for (let x = 0; x < WORLD; x += 5) {
          if (biome[z * WORLD + x] !== id) continue;
          count++;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (z < z0) z0 = z;
          if (z > z1) z1 = z;
        }
      }
      // A rectangle fills ~100% of its own bounding box.
      const boxCells = ((x1 - x0) / 5 + 1) * ((z1 - z0) / 5 + 1);
      expect(count / boxCells, `${name} fills its bounding box like a rectangle`).toBeLessThan(0.8);
      // Organic borders cross a scanline more than twice somewhere.
      let bestTransitions = 0;
      for (const z of [Math.round((z0 + z1) / 2), Math.round(z0 * 0.3 + z1 * 0.7)]) {
        let transitions = 0;
        let inside = false;
        for (let x = 0; x < WORLD; x += 5) {
          const now = biome[z * WORLD + x] === id;
          if (now !== inside) transitions++;
          inside = now;
        }
        bestTransitions = Math.max(bestTransitions, transitions);
      }
      expect(bestTransitions, `${name} border runs straight`).toBeGreaterThanOrEqual(3);
    }
  });

  it("never lets buildings, trees or wilderness overlap a structure", () => {
    // Building rectangles include the one-block roof-eave overhang.
    const buildings: Array<{ id: string; x0: number; x1: number; z0: number; z1: number }> = [];
    for (const o of region.objects) {
      if (!o.footprint?.length) continue;
      if (!/house|keep|store|spire/.test(o.defId)) continue;
      const xs = [o.cell.x, ...o.footprint.map((c) => c.x)];
      const zs = [o.cell.z, ...o.footprint.map((c) => c.z)];
      buildings.push({
        id: o.instanceId,
        x0: Math.min(...xs) - 1, x1: Math.max(...xs) + 1,
        z0: Math.min(...zs) - 1, z1: Math.max(...zs) + 1,
      });
    }
    for (let i = 0; i < buildings.length; i++) {
      for (let j = i + 1; j < buildings.length; j++) {
        const a = buildings[i];
        const b = buildings[j];
        const overlaps = a.x0 <= b.x1 && b.x0 <= a.x1 && a.z0 <= b.z1 && b.z0 <= a.z1;
        expect(overlaps, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
    // No tree canopy (radius 2) intersects a building.
    for (const n of region.nodes) {
      if (!n.defId.startsWith("resource.tree")) continue;
      for (const b of buildings) {
        const hit =
          n.cell.x + 2 >= b.x0 && n.cell.x - 2 <= b.x1 && n.cell.z + 2 >= b.z0 && n.cell.z - 2 <= b.z1;
        expect(hit, `${n.instanceId} grows through ${b.id}`).toBe(false);
      }
    }
    // Wilderness scatter stays off settlement pads.
    const { pads } = buildOverworld();
    const onAnyPad = (x: number, z: number) =>
      pads.some((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
    for (const n of region.nodes) {
      if (!n.instanceId.startsWith("wild.")) continue;
      expect(onAnyPad(n.cell.x, n.cell.z), `${n.instanceId} sits on a settlement pad`).toBe(false);
    }
    for (const o of region.objects) {
      if (!o.instanceId.startsWith("wild.")) continue;
      expect(onAnyPad(o.cell.x, o.cell.z), `${o.instanceId} sits on a settlement pad`).toBe(false);
    }
  });

  it("spaces discoveries along every major road", () => {
    for (const road of roads) {
      if (road.centerline.length < 220) continue; // spurs
      const stamps = region.objects.filter((o) => o.instanceId.startsWith(`way.${road.id}`));
      const expected = Math.floor((road.centerline.length * 2) / 400);
      expect(stamps.length, `${road.id} is a featureless slog`).toBeGreaterThanOrEqual(
        Math.max(1, expected - 2),
      );
    }
  });

  it("gives every settlement services and a nearby danger", () => {
    for (const p of pois.filter((q) => q.kind === "settlement")) {
      expect(p.services && p.services.length, `${p.name} has no services`).toBeTruthy();
      const danger = (region.enemies ?? []).some(
        (e) =>
          e.defId !== "enemy.target_dummy" &&
          Math.abs(e.cell.x - p.x) < 300 &&
          Math.abs(e.cell.z - p.z) < 300,
      );
      expect(danger, `${p.name} has nothing to fight nearby`).toBe(true);
    }
  });

  it("routes every dungeon's boss and exit compliantly", () => {
    for (const id of [
      "region.copper_hollow", "region.restless_crypt", "region.blackbriar_manor",
      "region.deepforge_mine", "region.trial_city", "region.stonegate_sewers",
      "region.sun_temple", "region.glowfen_caves", "region.stronghold_trials",
    ]) {
      const reg = buildRegion(id);
      const world = new WorldState(reg);
      const targets = [
        reg.objects.find((o) => o.defId === "object.portal.exit")?.cell,
        (reg.enemies ?? []).find((e) => e.instanceId.endsWith(".boss") || e.defId === "enemy.old_gnasher")?.cell,
      ].filter((c): c is { x: number; z: number } => !!c);
      expect(targets.length, `${id} has no exit`).toBeGreaterThan(0);
      for (const t of targets) {
        let goal: { x: number; z: number } | null = null;
        outer: for (let r = 0; r < 4; r++) {
          for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
              const c = { x: t.x + dx, z: t.z + dz };
              if (world.walkable(c)) {
                goal = c;
                break outer;
              }
            }
          }
        }
        expect(goal, `${id}: objective buried`).toBeTruthy();
        expect(findPath(world, reg.spawn, goal!, 300_000), `${id}: objective unreachable`).toBeTruthy();
      }
    }
  });

  it("covers the province with zones and a real danger gradient", () => {
    for (const zone of ZONES) {
      expect(zone.x1).toBeGreaterThan(zone.x0);
      expect(zone.z1).toBeGreaterThan(zone.z0);
    }
    expect(REGIONS.greenvale.tier).toBe(1);
    expect(REGIONS.frostspine.tier).toBeGreaterThanOrEqual(4);
  });
});

function runUntil(sim: GameSimulation, predicate: (e: SimEvent) => boolean, maxTicks = 6000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    const events = sim.tick();
    all.push(...events);
    if (events.some(predicate)) return all;
  }
  throw new Error(`condition not met within ${maxTicks} ticks`);
}

describe("province gameplay", () => {
  const npcIds = new Set(
    Object.keys(REGION_BUILDERS).flatMap((id) => buildRegion(id).npcs.map((n) => n.instanceId)),
  );
  // The tutorial quest chain's givers live in the streamed tutorial vale, not a
  // static region builder — fold them into the known-NPC set.
  for (const n of tutorialRegion(20706, { x: ENDLESS_CENTER, z: ENDLESS_CENTER }).npcs) npcIds.add(n.instanceId);

  it("every skill is trainable (node, recipe, combat, range, or site)", () => {
    // Combat-hooked skills: Strength/Constitution off any hit, Dungeoneering
    // off boss kills, Necromancy off the undead; Magic by alchemy anywhere.
    const trainable = new Set<string>([
      "skill.attack", "skill.defense", "skill.strength", "skill.magic",
      "skill.constitution", "skill.dungeoneering", "skill.necromancy",
    ]);
    for (const n of region.nodes) trainable.add(NODES[n.defId].skillId);
    for (const recipe of Object.values(RECIPES)) trainable.add(recipe.skillId);
    if (RECIPES["recipe.bow_wood"] && (region.enemies ?? []).some((e) => e.defId === "enemy.target_dummy")) {
      trainable.add("skill.archery");
    }
    if (region.objects.some((o) => OBJECTS[o.defId].buildRequires)) trainable.add("skill.construction");
    if (region.objects.some((o) => OBJECTS[o.defId].shortcut)) trainable.add("skill.agility");
    if (region.npcs.some((n) => n.instanceId === "village.npc.brusk")) trainable.add("skill.slaying");
    // Firemaking trains by lighting logs; Prayer by burying bones — both from
    // pack items, not placed nodes.
    if (Object.values(ITEMS).some((i) => i.firemaking)) trainable.add("skill.firemaking");
    if (Object.values(ITEMS).some((i) => i.prayer)) trainable.add("skill.prayer");
    for (const skillId of Object.keys(SKILLS)) {
      if (SKILLS[skillId].mergedInto) continue; // folded skills train via their home
      expect(trainable.has(skillId), `${skillId} has no training source`).toBe(true);
    }
  });

  it("every building door leads inside, and every interior door leads back out", () => {
    const world = new WorldState(region);
    const doors = region.objects.filter((o) => o.defId === "object.door.wood" && o.portal);
    expect(doors.length).toBeGreaterThanOrEqual(4); // store, inn, keep halls
    for (const door of doors) {
      const interior = buildRegion(door.portal!.targetRegionId);
      const arrival = new WorldState(interior);
      expect(arrival.walkable(door.portal!.targetCell), `${door.instanceId} arrival blocked`).toBe(true);
      const back = interior.objects.find((o) => o.defId === "object.door.wood" && o.portal);
      expect(back, `${interior.id} has no exit`).toBeTruthy();
      expect(back!.portal!.targetRegionId).toBe("region.vale_clearing");
      expect(world.walkable(back!.portal!.targetCell), `${interior.id} returns onto a blocked cell`).toBe(true);
    }
  });

  it("a bow shoots from range and trains Archery", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 11);
    sim.equippedTool = "tool.bow.wood";
    sim.inventory.add("item.arrow.bronze", 20); // bows consume arrows per shot
    const dummy = (region.enemies ?? []).find((e) => e.instanceId === "gv.dummy.002")!;
    sim.movement.setCellPosition({ x: dummy.cell.x, z: dummy.cell.z + 4 });
    sim.enqueue({ type: "interact", targetId: "gv.dummy.002" });
    runUntil(sim, (e) => e.type === "playerAttack" && e.damage !== null, 400);
    const dist = Math.max(
      Math.abs(sim.movement.currentCell().x - dummy.cell.x),
      Math.abs(sim.movement.currentCell().z - dummy.cell.z),
    );
    expect(dist).toBeGreaterThan(1);
    expect(sim.skills.xp["skill.archery"]).toBeGreaterThan(0);
    expect(sim.skills.xp["skill.attack"]).toBe(0);
  });

  it("building the jetty consumes materials, trains Construction, and stays built", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 12);
    const site = region.objects.find((o) => o.defId === "object.buildsite.jetty")!;
    // Find the open water the pier will span.
    let waterX = -1;
    for (let x = site.cell.x; x <= site.cell.x + 7; x++) {
      if (!sim.world.walkable({ x, z: site.cell.z })) waterX = x;
    }
    expect(waterX).toBeGreaterThan(0);
    sim.inventory.add("item.plank.cut", 8);
    sim.inventory.add("item.rope", 2);
    sim.movement.setCellPosition({ x: site.cell.x - 2, z: site.cell.z });
    sim.enqueue({ type: "interact", targetId: site.instanceId });
    runUntil(sim, (e) => e.type === "worldFlagSet", 400);
    expect(sim.inventory.count("item.plank.cut")).toBe(0);
    expect(sim.skills.xp["skill.construction"]).toBeGreaterThan(0);
    expect(sim.world.walkable({ x: waterX, z: site.cell.z })).toBe(true); // the pier stands
    const data = serialize(sim);
    const restored = new GameSimulation(buildRegion("region.vale_clearing"), 12);
    applySave(restored, data);
    expect(restored.world.walkable({ x: waterX, z: site.cell.z })).toBe(true);
  });

  it("potions apply timed buffs: swiftness quickens the stride, then fades", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 14);
    sim.inventory.add("item.potion.swift", 1);
    const slot = sim.inventory.slots.findIndex((sl) => sl?.itemId === "item.potion.swift");
    sim.enqueue({ type: "eatSlot", slot });
    const events = runUntil(sim, (e) => e.type === "buffApplied", 10);
    expect(events.find((e) => e.type === "buffApplied")).toMatchObject({ kind: "speed" });
    sim.tick();
    expect(sim.movement.speedCellsPerS).toBeCloseTo(4.55);
    sim.buffs["strength"] = 5;
    sim.buffs["speed"] = 0.01;
    for (let i = 0; i < 12; i++) sim.tick();
    expect(sim.movement.speedCellsPerS).toBeCloseTo(3.5);
    expect(sim.buffs["strength"]).toBeGreaterThan(0);
  });

  it("a build without materials is rejected before walking", () => {
    const sim = new GameSimulation(buildRegion("region.vale_clearing"), 13);
    const site = region.objects.find((o) => o.defId === "object.buildsite.footbridge")!;
    sim.movement.setCellPosition({ x: site.cell.x, z: site.cell.z - 4 });
    sim.enqueue({ type: "interact", targetId: site.instanceId });
    const events = runUntil(sim, (e) => e.type === "actionRejected", 40);
    expect(events.find((e) => e.type === "actionRejected")).toMatchObject({ reason: "missing_inputs" });
  });

  it("keeps the quest chain acyclic over real givers, items and enemies", () => {
    for (const quest of Object.values(QUESTS)) {
      expect(npcIds.has(quest.giverNpcId), `${quest.id} giver ${quest.giverNpcId}`).toBe(true);
      for (const pre of quest.prereqQuestIds ?? []) expect(QUESTS[pre], pre).toBeTruthy();
      for (const objective of quest.objectives) {
        if (objective.itemId) expect(ITEMS[objective.itemId], objective.itemId).toBeTruthy();
        if (objective.enemyDefId) expect(ENEMIES[objective.enemyDefId], objective.enemyDefId).toBeTruthy();
        if (objective.npcId) expect(npcIds.has(objective.npcId), objective.npcId).toBe(true);
      }
      for (const reward of quest.rewards.items) expect(ITEMS[reward.itemId], reward.itemId).toBeTruthy();
    }
    const remaining = new Set(Object.keys(QUESTS));
    let progressed = true;
    const done = new Set<string>();
    while (remaining.size > 0 && progressed) {
      progressed = false;
      for (const id of [...remaining]) {
        const quest = QUESTS[id];
        if ((quest.prereqQuestIds ?? []).every((pre) => done.has(pre))) {
          done.add(id);
          remaining.delete(id);
          progressed = true;
        }
      }
    }
    expect(remaining.size, `cyclic quests: ${[...remaining].join(", ")}`).toBe(0);
  });
});
