// Tutor's Trail: a hand-built finite region (its own heightfield, NOT the
// endless generator). A broad grassy field, raised two blocks; a dirt path is
// sunk one step into it and flows in a gentle meander (no switchbacks) from the
// camp down to the gate, opening into a roomy clearing at every master. The
// two-block bank is all that keeps you on the path — no prop walls. The field
// beyond the path is dressed with scattered trees, boulders and flowers so it
// reads as living countryside, never a barren plain.
//
// Nothing here is random: no endless POIs, villages, dungeons, roaming mobs or
// stray minimap markers ever appear.

import type { BlockType } from "../../content/blocks";
import { SKILL_MASTERS, masterNpcId, SKILLS } from "../../content/content";
import type { Cell } from "../types";
import type { EnemyPlacement, NodePlacement, NpcPlacement, ObjectPlacement, RegionSpec } from "../world";

const W = 200;
const D = 214;
const BASE = 6; // walk-surface of the sunken path
const BANK = BASE + 2; // the field on either side — two blocks up, so unwalkable
const HALF = 3; // path half-width (7-wide path)
const CLEAR_R = 6; // clearing radius at each master (a roomy 13-cell area)
const STOPS = 32; // camp + 30 tutors + gate
const LEGS = 5; // sweeping passes down the island
const LEG_GAP = 36; // vertical spacing between passes — wide switchbacks, lots of grass between
const Z_TOP = 24;
const X_A = 36;
const X_B = 164;
const TURN_R = LEG_GAP / 2; // radius of the smooth U-turn between passes

/** The trail centreline: long sweeping passes across the island joined by wide,
 *  rounded U-turns — a natural switchback trail, not a tight zigzag. Returned as
 *  a dense polyline so the carved path curves smoothly. */
function buildCenterline(): Cell[] {
  const P: Cell[] = [];
  for (let r = 0; r < LEGS; r++) {
    const z = Z_TOP + r * LEG_GAP;
    const ltr = r % 2 === 0;
    const from = ltr ? X_A : X_B;
    const to = ltr ? X_B : X_A;
    const dir = ltr ? 1 : -1;
    for (let x = from; x !== to + dir; x += dir) P.push({ x, z });
    if (r < LEGS - 1) {
      // A half-circle U-turn at the leg's end, bulging outward to the next pass.
      const cz = z + TURN_R;
      const steps = 26;
      for (let s = 1; s <= steps; s++) {
        const th = -Math.PI / 2 + (Math.PI * s) / steps;
        P.push({ x: Math.round(to + dir * TURN_R * Math.cos(th)), z: Math.round(cz + TURN_R * Math.sin(th)) });
      }
    }
  }
  return P;
}

interface Tutor {
  skill: string;
  skin: string;
  ground: BlockType;
  station?: string;
  pen?: string;
  water?: boolean;
  combat?: boolean;
  boss?: boolean;
}

const TUTORS: Tutor[] = [
  { skill: "skill.woodcutting", skin: "lumberjack", ground: "grass", station: "resource.tree.basic" },
  { skill: "skill.mining", skin: "miner", ground: "stone", station: "resource.rock.copper" },
  { skill: "skill.foraging", skin: "forager", ground: "grass", station: "resource.bush.berry" },
  { skill: "skill.fishing", skin: "angler", ground: "sand", station: "resource.fishing.pond", water: true },
  { skill: "skill.cooking", skin: "cook", ground: "coarsedirt", station: "object.campfire.basic" },
  { skill: "skill.smelting", skin: "smelter", ground: "stonebrick", station: "object.furnace.basic" },
  { skill: "skill.smithing", skin: "smith", ground: "stonebrick", station: "object.anvil.basic" },
  { skill: "skill.attack", skin: "warrior", ground: "coarsedirt", pen: "enemy.pig", combat: true },
  { skill: "skill.farming", skin: "farmer", ground: "dirt", station: "resource.plot.wheat" },
  { skill: "skill.herblore", skin: "herbalist", ground: "grass", station: "resource.herb.sage" },
  { skill: "skill.crafting", skin: "crafter", ground: "coarsedirt", station: "object.workbench.basic" },
  { skill: "skill.archaeology", skin: "scholar", ground: "sand", station: "resource.digsite.basic" },
  { skill: "skill.archery", skin: "ranger", ground: "grass", pen: "enemy.target_dummy" },
  { skill: "skill.construction", skin: "builder", ground: "coarsedirt", station: "object.buildsite.ramp" },
  { skill: "skill.brewing", skin: "brewer", ground: "grass", station: "object.cauldron.basic" },
  { skill: "skill.enchanting", skin: "enchanter", ground: "purpur", station: "object.enchanter.basic" },
  { skill: "skill.hunting", skin: "hunter", ground: "grass", station: "resource.trail.rabbit", pen: "enemy.chicken" },
  { skill: "skill.thieving", skin: "rogue", ground: "coarsedirt", station: "object.stall.market" },
  { skill: "skill.agility", skin: "freerunner", ground: "grass", station: "object.shortcut.log" },
  { skill: "skill.slaying", skin: "slayer", ground: "podzol", pen: "enemy.sheep" },
  { skill: "skill.boating", skin: "sailor", ground: "sand", station: "object.workbench.basic", water: true },
  { skill: "skill.firemaking", skin: "firewarden", ground: "coarsedirt", station: "object.campfire.basic" },
  { skill: "skill.prayer", skin: "priest", ground: "stonebrick", station: "object.obelisk.summon" },
  { skill: "skill.runecrafting", skin: "runemaster", ground: "calcite", station: "object.altar.rune" },
  { skill: "skill.fletching", skin: "fletcher", ground: "grass", station: "object.workbench.basic" },
  { skill: "skill.magic", skin: "mage", ground: "purpur", station: "object.enchanter.basic" },
  { skill: "skill.dungeoneering", skin: "delver", ground: "stone", station: "object.portal.cave", pen: "enemy.pig", boss: true },
  { skill: "skill.summoning", skin: "summoner", ground: "moss", station: "object.obelisk.summon" },
  { skill: "skill.necromancy", skin: "necromancer", ground: "podzol", pen: "enemy.skeleton" },
  { skill: "skill.invention", skin: "inventor", ground: "stonebrick", station: "object.workbench.basic" },
];

export function tutorialRegion(_seed: number, _spawn: Cell): RegionSpec {
  const heights = new Array<number>(W * D).fill(BANK);
  const blocks = new Array<BlockType>(W * D).fill("grass");
  const nodes: NodePlacement[] = [];
  const objects: ObjectPlacement[] = [];
  const npcs: NpcPlacement[] = [];
  const enemies: EnemyPlacement[] = [];
  const at = (x: number, z: number) => z * W + x;
  const inB = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < D;
  const set = (x: number, z: number, block: BlockType, h: number) => {
    if (inB(x, z)) { blocks[at(x, z)] = block; heights[at(x, z)] = h; }
  };
  const trail = new Uint8Array(W * D);
  const disc = (cx: number, cz: number, r: number, block: BlockType) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz <= r * r + 1 && inB(cx + dx, cz + dz)) {
        blocks[at(cx + dx, cz + dz)] = block;
        heights[at(cx + dx, cz + dz)] = BASE;
        trail[at(cx + dx, cz + dz)] = 1;
      }
    }
  };

  // 1) The trail — a wide dirt ribbon carved along the switchback centreline.
  const line = buildCenterline();
  for (const p of line) disc(p.x, p.z, HALF, "dirt");
  // 2) Masters spread evenly along the trail by arc length, each in a roomy
  //    clearing floored in its own ground.
  const stops = Array.from({ length: STOPS }, (_, i) => line[Math.round((i * (line.length - 1)) / (STOPS - 1))]);
  stops.forEach((s, i) => {
    const ground = i === 0 || i === STOPS - 1 ? "coarsedirt" : TUTORS[i - 1].ground;
    disc(s.x, s.z, CLEAR_R, ground);
  });
  // 3) A water moat round the rim so it reads as an island.
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (Math.min(x, z, W - 1 - x, D - 1 - z) < 3) { set(x, z, "water", BASE); trail[at(x, z)] = 1; }
  }

  // 4) Dress the field: scattered trees/boulders/flowers on the raised grass,
  //    kept clear of the path so the tutors are never hidden. Distance-from-path
  //    (multi-source BFS) drives how far out the taller scenery sits.
  decorateField(blocks, heights, trail, objects, nodes);

  // --- camp (stop 0) ---
  const camp = stops[0];
  objects.push(
    {
      instanceId: "tutorial.camp.chest",
      defId: "object.storage_chest.basic",
      cell: { x: camp.x - 4, z: camp.z },
      initialItems: [{ itemId: "item.pork.cooked", qty: 5 }, { itemId: "item.coin", qty: 20 }],
    },
    { instanceId: "tutorial.camp.bed", defId: "object.bed.basic", cell: { x: camp.x - 4, z: camp.z + 2 } },
    { instanceId: "tutorial.camp.fire", defId: "object.campfire.basic", cell: { x: camp.x + 4, z: camp.z } },
    { instanceId: "tutorial.camp.sign", defId: "object.signpost", cell: { x: camp.x, z: camp.z - 4 } },
  );
  npcs.push({
    instanceId: "tutorial.guide",
    name: "Rowan the Guide",
    cell: { x: camp.x + 1, z: camp.z + 1 },
    wanderRadius: 0,
    skin: "guide",
    lines: [
      "Welcome to Runecraft! This is Tutor's Trail.",
      "There's just the one path — follow it, meet each master in turn, and it'll bring you to the gate.",
      "Step through the gate at the end to enter your own world.",
    ],
  });

  // --- tutor stops ---
  TUTORS.forEach((t, idx) => {
    const stop = stops[idx + 1];
    const short = t.skill.slice("skill.".length);
    const master = SKILL_MASTERS.find((m) => m.skill === t.skill);
    const skillName = SKILLS[t.skill]?.name ?? short;
    const title = master?.title ?? "Master";
    const tutorName = master?.name ?? "Tutor";
    const side = (idx % 2 === 0 ? -1 : 1) as 1 | -1;

    npcs.push({
      instanceId: masterNpcId(t.skill),
      name: t.combat ? "Sergeant Gareth, Combat Instructor" : `${tutorName} the ${title}`,
      cell: { x: stop.x, z: stop.z },
      wanderRadius: 0,
      skin: t.skin,
      lines: t.combat
        ? [
            "I teach the whole art of melee — Attack, Strength, Defence and Constitution all at once.",
            "The attack-style button on your bar picks which one grows: Accurate, Aggressive, Defensive, or Controlled to split them.",
            "Constitution always grows as you fight. Cull the pigs in the pen, then report back to me.",
          ]
        : [
            `I'm ${tutorName}, master of ${skillName}. Speak to me to begin the lesson.`,
            `Train ${skillName} here, then come back to me and I'll sign it off.`,
          ],
    });
    objects.push({ instanceId: `tut.lamp.${short}`, defId: "object.lamp.post", cell: { x: stop.x, z: stop.z - CLEAR_R } });

    // A pond off to one side of the clearing for the anglers/mariners.
    if (t.water) {
      for (let dz = -2; dz <= 2; dz++) for (let dx = 0; dx <= 3; dx++) {
        set(stop.x + side * (CLEAR_R - 1 + dx), stop.z + dz, "water", BASE);
      }
      objects.push({ instanceId: `tut.reeds.${short}`, defId: "object.reeds.water", cell: { x: stop.x + side * (CLEAR_R - 1), z: stop.z } });
    }

    // Station out toward the edge of the roomy clearing.
    if (t.station) {
      const scell = { x: stop.x + side * 4, z: stop.z + (t.water ? -3 : 0) };
      set(scell.x, scell.z, "coarsedirt", BASE);
      if (t.station.startsWith("resource.")) {
        nodes.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
      } else if (t.station === "object.shortcut.log") {
        objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell, portal: { targetRegionId: "region.tutorial", targetCell: { x: stop.x, z: stop.z } } });
      } else {
        objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
      }
    }

    // Fenced pen as an alcove off the far side.
    if (t.pen) buildPen(set, enemies, stop.x - side * (CLEAR_R + 1), stop.z, side, short, t.pen, !!t.combat, !!t.boss);
  });

  // --- gateway (last stop) ---
  const gate = stops[STOPS - 1];
  objects.push(
    {
      instanceId: "tutorial.graduate",
      defId: "object.portal.graduate",
      cell: { x: gate.x, z: gate.z + CLEAR_R - 1 },
      portal: { targetRegionId: "region.endless", targetCell: { x: gate.x, z: gate.z } },
    },
    { instanceId: "tutorial.gate.lampL", defId: "object.lamp.post", cell: { x: gate.x - 3, z: gate.z + CLEAR_R - 1 } },
    { instanceId: "tutorial.gate.lampR", defId: "object.lamp.post", cell: { x: gate.x + 3, z: gate.z + CLEAR_R - 1 } },
  );
  npcs.push({
    instanceId: "tutorial.gatekeeper",
    name: "Gatekeeper Alder",
    cell: { x: gate.x + 1, z: gate.z },
    wanderRadius: 0,
    skin: "gatekeeper",
    lines: [
      "You've walked the whole trail and met every master — well done.",
      "Speak with me and the gateway will open. Beyond it lies your own world.",
    ],
  });
  npcs.push({
    instanceId: "village.npc.brusk",
    name: "Warden Brusk",
    cell: { x: gate.x - 1, z: gate.z },
    wanderRadius: 0,
    skin: "slayer",
    lines: ["The wilds are dangerous. Keep your blade sharp and your wits sharper."],
  });

  return {
    id: "region.tutorial",
    width: W,
    depth: D,
    heights,
    blocks,
    nodes,
    objects,
    npcs,
    enemies,
    spawn: { x: camp.x, z: camp.z },
    theme: { sky: "#8fc7e8", sun: 1.0, ambient: 0.64 },
  };
}

/** Scatter scenery across the raised field so it looks alive — dense flat
 *  flowers/tufts near the verge, boulders and the odd tree further out, all kept
 *  a few cells clear of the path so nothing crowds or hides a tutor. */
function decorateField(
  blocks: BlockType[],
  heights: number[],
  trail: Uint8Array,
  objects: ObjectPlacement[],
  nodes: NodePlacement[],
): void {
  const at = (x: number, z: number) => z * W + x;
  // Distance from the nearest path/clearing cell (multi-source BFS).
  const dist = new Int16Array(W * D).fill(-1);
  let q: number[] = [];
  for (let i = 0; i < trail.length; i++) if (trail[i]) { dist[i] = 0; q.push(i); }
  while (q.length) {
    const nq: number[] = [];
    for (const idx of q) {
      const x = idx % W, z = (idx / W) | 0, d = dist[idx];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
        const ni = at(nx, nz);
        if (dist[ni] === -1) { dist[ni] = d + 1; nq.push(ni); }
      }
    }
    q = nq;
  }

  let n = 0;
  const put = (x: number, z: number, defId: string, isNode: boolean) => {
    if (isNode) nodes.push({ instanceId: `dec.${n++}`, defId, cell: { x, z } });
    else objects.push({ instanceId: `dec.${n++}`, defId, cell: { x, z } });
  };
  // Deliberately restrained: low flat cover (grass tufts, small wildflowers)
  // near the verge, a rare grey boulder, and the odd tree kept well back so its
  // canopy never reaches the path. No giant mushrooms / tall colourful voxels.
  for (let z = 5; z < D - 5; z += 3) {
    for (let x = 5; x < W - 5; x += 3) {
      const i = at(x, z);
      if (trail[i] || blocks[i] === "water") continue;
      const d = dist[i];
      if (d < 4) continue; // a clean grass verge frames the path
      const h = ((x * 73856093) ^ (z * 19349663)) >>> 0;
      const r = h % 100;
      if (d >= 10 && r < 3) put(x, z, "resource.tree.basic", true); // sparse, far-back trees
      else if (r < 4) put(x, z, "object.boulder.stone"); // occasional grey rock
      else if (r < 16) put(x, z, "object.flowers.wild"); // small wildflowers
      else if (r < 34) put(x, z, "object.grass.tuft"); // low grass tufts
    }
  }
}

/** A compact fenced pen carved as a floor alcove, gated toward the clearing. */
function buildPen(
  set: (x: number, z: number, block: BlockType, h: number) => void,
  enemies: EnemyPlacement[],
  cx: number,
  cz: number,
  side: 1 | -1,
  short: string,
  enemyDef: string,
  combat: boolean,
  boss: boolean,
): void {
  const x0 = cx - 2, x1 = cx + 2, z0 = cz - 2, z1 = cz + 2;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, z, "coarsedirt", BASE);
  const gateX = cx + side * 2; // the side nearest the clearing carries the gate
  for (let z = z0; z <= z1; z++) {
    if (!(z === cz && x1 === gateX)) set(x1, z, "oak_fence", BASE);
    if (!(z === cz && x0 === gateX)) set(x0, z, "oak_fence", BASE);
  }
  for (let x = x0; x <= x1; x++) { set(x, z0, "oak_fence", BASE); set(x, z1, "oak_fence", BASE); }
  const primary = boss ? `tut.pen.${short}.boss` : `tut.pen.${short}.a`;
  enemies.push(
    { instanceId: primary, defId: enemyDef, cell: { x: cx, z: cz - 1 } },
    { instanceId: `tut.pen.${short}.b`, defId: enemyDef, cell: { x: cx, z: cz + 1 } },
  );
  if (combat) enemies.push({ instanceId: `tut.pen.${short}.c`, defId: enemyDef, cell: { x: cx, z: cz } });
}
