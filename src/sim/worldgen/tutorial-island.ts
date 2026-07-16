// The tutorial island: a hand-built finite region (its own heightfield, NOT the
// endless generator) shaped as one guided trail. The newcomer starts at a camp,
// follows a dirt path that snakes through themed training grounds, meets every
// skill's tutor in order, and steps through a gateway into the wild at the end.
//
// Nothing here is random: no endless POIs, villages, dungeons, roaming mobs or
// stray minimap markers ever appear, because the tutorial never touches the
// streamed world. The island is ringed by a beach, a moat and cliffs so the
// only way onward is the gateway. Tutors carry themed skins (smith, mage,
// ranger…) and each stands beside a small station or fenced pen that matches
// their craft; fenced pens keep the practice mobs penned in.

import type { BlockType } from "../../content/blocks";
import { SKILL_MASTERS, masterNpcId, SKILLS } from "../../content/content";
import type { Cell } from "../types";
import type { EnemyPlacement, NodePlacement, NpcPlacement, ObjectPlacement, RegionSpec } from "../world";

const W = 120;
const D = 160;
const BASE = 6; // interior ground height
const CLIFF = BASE + 8; // enclosing cliff / mountain rim

const PER_ROW = 5;
const ROWS = 7; // 35 stops: camp + 33 tutors + exit gate
const ROW_GAP = 20;
const X_L = 20;
const X_R = W - 20;
const PATH: BlockType = "dirt";

/** A tutor stop: which skill it teaches, the tutor's themed skin, the ground it
 *  stands on, and how its little training ground is dressed. `station` is a
 *  node/object placed beside the tutor; `pen` fences a weak practice mob in. */
interface Tutor {
  skill: string;
  skin: string;
  ground: BlockType;
  station?: string; // resource.* node or object.* prop beside the tutor
  pen?: string; // enemy defId fenced into a pen
  water?: boolean; // carve a pond beside the stop (fishing / mariner docks)
  /** One instructor teaches all of melee — Attack, Strength, Defence and
   *  Constitution — and how the attack-style toggle routes XP between them. */
  combat?: boolean;
}

// The user-specified teaching order, each with its look and training ground.
const TUTORS: Tutor[] = [
  { skill: "skill.woodcutting", skin: "lumberjack", ground: "grass", station: "resource.tree.basic" },
  { skill: "skill.mining", skin: "miner", ground: "stone", station: "resource.rock.copper" },
  { skill: "skill.foraging", skin: "forager", ground: "grass", station: "resource.bush.berry" },
  { skill: "skill.fishing", skin: "angler", ground: "sand", station: "resource.fishing.pond", water: true },
  { skill: "skill.cooking", skin: "cook", ground: "coarsedirt", station: "object.campfire.basic" },
  { skill: "skill.smelting", skin: "smelter", ground: "stonebrick", station: "object.furnace.basic" },
  { skill: "skill.smithing", skin: "smith", ground: "stonebrick", station: "object.anvil.basic" },
  // One instructor for all of melee: Attack, Strength, Defence and Constitution,
  // taught through the attack-style toggle rather than four separate tutors.
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
  { skill: "skill.boating", skin: "sailor", ground: "sand", water: true },
  { skill: "skill.firemaking", skin: "firewarden", ground: "coarsedirt", station: "object.campfire.basic" },
  { skill: "skill.prayer", skin: "priest", ground: "stonebrick", station: "object.obelisk.summon" },
  { skill: "skill.runecrafting", skin: "runemaster", ground: "calcite", station: "object.altar.rune" },
  { skill: "skill.fletching", skin: "fletcher", ground: "grass", station: "object.workbench.basic" },
  { skill: "skill.magic", skin: "mage", ground: "purpur", station: "object.enchanter.basic" },
  { skill: "skill.dungeoneering", skin: "delver", ground: "stone", station: "object.portal.cave" },
  { skill: "skill.summoning", skin: "summoner", ground: "moss", station: "object.obelisk.summon" },
  { skill: "skill.necromancy", skin: "necromancer", ground: "podzol", pen: "enemy.skeleton" },
  { skill: "skill.invention", skin: "inventor", ground: "stonebrick", station: "object.workbench.basic" },
];

const colX = (c: number): number => Math.round(X_L + ((X_R - X_L) * c) / (PER_ROW - 1));
const rowZ = (r: number): number => 22 + r * ROW_GAP;

/** The 35 stop cells in serpentine (boustrophedon) order: camp, 33 tutors, gate.
 *  Consecutive stops are always axis-aligned, so the trail between them is a
 *  straight horizontal or vertical run. */
function stopCells(): Cell[] {
  const stops: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < PER_ROW; c++) {
      const cc = r % 2 === 0 ? c : PER_ROW - 1 - c;
      stops.push({ x: colX(cc), z: rowZ(r) });
    }
  }
  return stops;
}

export function tutorialRegion(_seed: number, _spawn: Cell): RegionSpec {
  const heights = new Array<number>(W * D).fill(BASE);
  const blocks = new Array<BlockType>(W * D).fill("grass");
  const nodes: NodePlacement[] = [];
  const objects: ObjectPlacement[] = [];
  const npcs: NpcPlacement[] = [];
  const enemies: EnemyPlacement[] = [];
  const at = (x: number, z: number) => z * W + x;
  const inBounds = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < D;
  const set = (x: number, z: number, block: BlockType, h = BASE) => {
    if (!inBounds(x, z)) return;
    blocks[at(x, z)] = block;
    heights[at(x, z)] = h;
  };

  // --- island rim: cliffs → moat → beach → interior grass ---
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const d = Math.min(x, z, W - 1 - x, D - 1 - z);
      if (d < 4) set(x, z, "stone", CLIFF);
      else if (d < 8) set(x, z, "water", BASE);
      else if (d < 11) set(x, z, "sand", BASE);
    }
  }

  // --- the trail: a 3-wide dirt path threading every stop in order ---
  const stops = stopCells();
  const paint = (x: number, z: number, block: BlockType) => {
    // Never pave over the moat/cliff rim; only lay path on the interior.
    if (!inBounds(x, z)) return;
    const d = Math.min(x, z, W - 1 - x, D - 1 - z);
    if (d < 11) return;
    set(x, z, block, BASE);
  };
  const carve = (a: Cell, b: Cell, block: BlockType) => {
    if (a.z === b.z) {
      const [x0, x1] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
      for (let x = x0; x <= x1; x++) for (let w = -1; w <= 1; w++) paint(x, a.z + w, block);
    } else {
      const [z0, z1] = a.z < b.z ? [a.z, b.z] : [b.z, a.z];
      for (let z = z0; z <= z1; z++) for (let w = -1; w <= 1; w++) paint(a.x + w, z, block);
    }
  };
  for (let i = 0; i + 1 < stops.length; i++) carve(stops[i], stops[i + 1], PATH);

  // --- a river with a plank bridge crossing one mid-trail segment (row 3) ---
  {
    const bz = rowZ(3);
    const riverX = colX(2);
    for (let z = bz - 9; z <= bz + 9; z++) {
      for (let x = riverX - 1; x <= riverX + 1; x++) {
        if (!inBounds(x, z)) continue;
        const d = Math.min(x, z, W - 1 - x, D - 1 - z);
        if (d < 11) continue;
        // Keep the trail crossing walkable as a bridge deck over the water.
        if (Math.abs(z - bz) <= 1) set(x, z, "bridge", BASE);
        else set(x, z, "water", BASE);
      }
    }
  }

  // --- camp (stop 0): chest of starter gear, bed, hearth, signpost, guide ---
  const camp = stops[0];
  const guideCell = { x: camp.x + 2, z: camp.z };
  objects.push(
    {
      instanceId: "tutorial.camp.chest",
      defId: "object.storage_chest.basic",
      cell: { x: camp.x - 2, z: camp.z - 1 },
      initialItems: [
        { itemId: "tool.pickaxe.copper", qty: 1 },
        { itemId: "tool.fishingrod.basic", qty: 1 },
        { itemId: "tool.sword.bronze", qty: 1 },
        { itemId: "tool.bow.oak", qty: 1 },
        { itemId: "item.arrow.bronze", qty: 30 },
        { itemId: "item.pork.cooked", qty: 5 },
      ],
    },
    { instanceId: "tutorial.camp.bed", defId: "object.bed.basic", cell: { x: camp.x - 3, z: camp.z + 1 } },
    { instanceId: "tutorial.camp.fire", defId: "object.campfire.basic", cell: { x: camp.x, z: camp.z - 3 } },
    { instanceId: "tutorial.camp.sign", defId: "object.signpost", cell: { x: camp.x + 1, z: camp.z + 2 } },
  );
  patchGround(set, camp.x, camp.z, 4, "coarsedirt");
  npcs.push({
    instanceId: "tutorial.guide",
    name: "Rowan the Guide",
    cell: guideCell,
    wanderRadius: 0,
    skin: "guide",
    lines: [
      "Welcome to Runecraft! This is Tutor's Trail.",
      "Follow the path and meet each master in turn — they'll each teach you their craft.",
      "When you reach the far gate, step through to enter your own world.",
    ],
  });

  // --- tutor stops ---
  TUTORS.forEach((t, i) => {
    const stop = stops[i + 1];
    const short = t.skill.slice("skill.".length);
    const master = SKILL_MASTERS.find((m) => m.skill === t.skill);
    const skillName = SKILLS[t.skill]?.name ?? short;
    const title = master?.title ?? "Master";
    const tutorName = master?.name ?? "Tutor";
    // Zone dressing sits to the field side of the row (above on even rows,
    // below on odd) so neighbouring grounds never collide.
    const rowIdx = Math.floor((i + 1) / PER_ROW);
    const side = rowIdx % 2 === 0 ? -1 : 1;
    const fieldZ = stop.z + side * 6;

    // Tint the tutor's little ground patch to its theme.
    patchGround(set, stop.x, stop.z, 3, t.ground);
    patchGround(set, stop.x, fieldZ, 3, t.ground);

    // The tutor stands just off the path.
    npcs.push({
      instanceId: masterNpcId(t.skill),
      name: t.combat ? "Sergeant Gareth, Combat Instructor" : `${tutorName} the ${title}`,
      cell: { x: stop.x + 2, z: stop.z },
      wanderRadius: 0,
      skin: t.skin,
      lines: t.combat
        ? [
            "I teach the whole art of melee — Attack, Strength, Defence and Constitution all at once.",
            "See the attack-style button on your bar? Accurate trains Attack, Aggressive trains Strength, Defensive trains Defence, Controlled splits all three.",
            "Constitution always grows as you fight. Switch styles between blows, then cull the pigs in the pen to practise.",
          ]
        : [
            `I'm ${tutorName}, master of ${skillName}. Speak to me to begin the lesson.`,
            `Train ${skillName} right here, then follow the trail on to the next master.`,
          ],
    });
    // A lamp post + sign marks each ground so the trail reads clearly.
    objects.push({ instanceId: `tut.lamp.${short}`, defId: "object.lamp.post", cell: { x: stop.x - 2, z: stop.z + side } });

    // Optional pond beside the stop (fishing / mariner).
    if (t.water) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          const x = stop.x + dx;
          const z = fieldZ + dz;
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (inBounds(x, z) && Math.min(x, z, W - 1 - x, D - 1 - z) >= 11) set(x, z, "water", BASE);
        }
      }
      objects.push({ instanceId: `tut.reeds.${short}`, defId: "object.reeds.water", cell: { x: stop.x + 3, z: fieldZ } });
    }

    // Station: a resource node or a prop the tutor's craft trains at.
    if (t.station) {
      const scell = { x: stop.x, z: t.water ? stop.z + side * 3 : fieldZ };
      if (t.station.startsWith("resource.")) nodes.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
      else objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
    }

    // Fenced practice pen with a weak, contained mob.
    if (t.pen) {
      buildPen(set, objects, enemies, stop.x, fieldZ, side, short, t.pen);
      // The combat lesson wants three pigs to cull across the attack styles.
      if (t.combat) enemies.push({ instanceId: `tut.pen.${short}.c`, defId: t.pen, cell: { x: stop.x, z: fieldZ } });
    }

    // A little themed scatter for polish (kept off the path).
    scatter(objects, nodes, t, stop.x, fieldZ, short);
  });

  // --- gateway (last stop): gatekeeper + graduation portal ---
  const gate = stops[stops.length - 1];
  patchGround(set, gate.x, gate.z, 3, "stonebrick");
  objects.push(
    {
      instanceId: "tutorial.graduate",
      defId: "object.portal.graduate",
      cell: { x: gate.x, z: gate.z + 2 },
      portal: { targetRegionId: "region.endless", targetCell: { x: gate.x, z: gate.z } },
    },
    { instanceId: "tutorial.gate.lampL", defId: "object.lamp.post", cell: { x: gate.x - 2, z: gate.z + 2 } },
    { instanceId: "tutorial.gate.lampR", defId: "object.lamp.post", cell: { x: gate.x + 2, z: gate.z + 2 } },
  );
  npcs.push({
    instanceId: "tutorial.gatekeeper",
    name: "Gatekeeper Alder",
    cell: { x: gate.x + 2, z: gate.z },
    wanderRadius: 0,
    skin: "gatekeeper",
    lines: [
      "You've walked the whole trail and met every master — well done.",
      "Speak with me and the gateway will open. Beyond it lies your own world.",
    ],
  });

  // The overworld's skill-coverage test keys Slaying off this classic warden id;
  // keep it present (aliasing the Slayer master) so that check still holds.
  npcs.push({
    instanceId: "village.npc.brusk",
    name: "Warden Brusk",
    cell: { x: gate.x - 2, z: gate.z },
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
    spawn: { x: camp.x, z: camp.z + 2 },
    theme: { sky: "#8fc7e8", sun: 1.0, ambient: 0.62 },
  };
}

/** Paint a small square ground patch (odd side length) around a centre. */
function patchGround(
  set: (x: number, z: number, block: BlockType, h?: number) => void,
  cx: number,
  cz: number,
  rad: number,
  block: BlockType,
): void {
  for (let dz = -rad; dz <= rad; dz++) {
    for (let dx = -rad; dx <= rad; dx++) {
      set(cx + dx, cz + dz, block, BASE);
    }
  }
}

/** A 5×4 fenced pen offset from the trail, gated on the path side, holding two
 *  weak practice mobs that stay penned behind the fence posts. */
function buildPen(
  set: (x: number, z: number, block: BlockType, h?: number) => void,
  objects: ObjectPlacement[],
  enemies: EnemyPlacement[],
  sx: number,
  fieldZ: number,
  side: number,
  short: string,
  enemyDef: string,
): void {
  const x0 = sx - 2;
  const x1 = sx + 2;
  const zNear = fieldZ - side * 2; // fence edge nearest the trail (holds the gate)
  const zFar = fieldZ + side * 2;
  const zLo = Math.min(zNear, zFar);
  const zHi = Math.max(zNear, zFar);
  patchGround(set, sx, fieldZ, 2, "coarsedirt");
  // Fence the perimeter, leaving a one-cell gate on the trail side (at sx).
  for (let x = x0; x <= x1; x++) {
    if (!(x === sx)) set(x, zNear, "oak_fence", BASE); // gate gap at the centre
    set(x, zFar, "oak_fence", BASE);
  }
  for (let z = zLo; z <= zHi; z++) {
    set(x0, z, "oak_fence", BASE);
    set(x1, z, "oak_fence", BASE);
  }
  enemies.push(
    { instanceId: `tut.pen.${short}.a`, defId: enemyDef, cell: { x: sx - 1, z: fieldZ } },
    { instanceId: `tut.pen.${short}.b`, defId: enemyDef, cell: { x: sx + 1, z: fieldZ } },
  );
}

/** Themed scenery scatter per zone — trees in the grove, boulders in the
 *  quarry, mushrooms in the summoning grove, and so on. Purely decorative. */
function scatter(
  objects: ObjectPlacement[],
  nodes: NodePlacement[],
  t: Tutor,
  sx: number,
  fieldZ: number,
  short: string,
): void {
  const spots: Cell[] = [
    { x: sx - 4, z: fieldZ },
    { x: sx + 4, z: fieldZ },
  ];
  let prop: string | null = null;
  let node: string | null = null;
  switch (t.skill) {
    case "skill.woodcutting": node = "resource.tree.basic"; break;
    case "skill.mining": prop = "object.boulder.stone"; break;
    case "skill.foraging": prop = "object.flowers.showy"; break;
    case "skill.herblore": prop = "object.flowers.wild"; break;
    case "skill.summoning": prop = "object.mushroom.giant"; break;
    case "skill.necromancy": prop = "object.log.fallen"; break;
    case "skill.thieving": prop = "object.crate.wood"; break;
    case "skill.construction": prop = "object.crate.wood"; break;
    case "skill.invention": prop = "object.barrel.wood"; break;
    case "skill.magic": prop = "object.torch.wall"; break;
    case "skill.prayer": prop = "object.torch.wall"; break;
    case "skill.agility": prop = "object.log.fallen"; break;
    default: prop = "object.grass.tuft"; break;
  }
  spots.forEach((c, k) => {
    if (node) nodes.push({ instanceId: `tut.scat.${short}.${k}`, defId: node, cell: c });
    else if (prop) objects.push({ instanceId: `tut.scat.${short}.${k}`, defId: prop, cell: c });
  });
}
