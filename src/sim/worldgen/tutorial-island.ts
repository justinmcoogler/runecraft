// Tutor's Trail: a hand-built finite region (its own heightfield, NOT the
// endless generator) shaped as ONE long winding corridor. The whole island is
// raised, varied terrain — forest banks, rocky crags, wetland lakes, mires,
// highland — and the ONLY walkable ground is a 3-wide trail carved down through
// it. You cannot cut across to another tutor: the banks step up more than a
// block on either side, so the path is single-file from the camp to the gate.
//
// Nothing here is random: no endless POIs, villages, dungeons, roaming mobs or
// stray minimap markers ever appear. Tutors carry themed skins and each stands
// in a small clearing on the trail beside a matching station or fenced pen.

import type { BlockType } from "../../content/blocks";
import { SKILL_MASTERS, masterNpcId, SKILLS } from "../../content/content";
import type { Cell } from "../types";
import type { EnemyPlacement, NodePlacement, NpcPlacement, ObjectPlacement, RegionSpec } from "../world";

const W = 132;
const D = 196;
const BASE = 6; // walk-surface height of the trail
const PER_ROW = 4;
const ROWS = 8; // 32 stops: camp + 30 tutors + gate
const ROW_GAP = 22;
const X_L = 26;
const X_R = W - 26;
const Z_START = 24;
const HALF = 1; // trail half-width (=> 3-wide corridor)
const CLEAR_R = 4; // clearing radius at each stop

/** A tutor stop: skill, the tutor's themed skin, the clearing ground, and how
 *  its training ground is dressed. `station` sits beside the tutor; `pen`
 *  fences a weak practice mob in. */
interface Tutor {
  skill: string;
  skin: string;
  ground: BlockType;
  station?: string;
  pen?: string;
  water?: boolean;
  /** One instructor teaches all of melee (Attack/Strength/Defence/Constitution)
   *  and the attack-style toggle. */
  combat?: boolean;
}

// The teaching order down the trail, each with its look and training ground.
const TUTORS: Tutor[] = [
  { skill: "skill.woodcutting", skin: "lumberjack", ground: "grass", station: "resource.tree.basic" },
  { skill: "skill.mining", skin: "miner", ground: "stone", station: "resource.rock.copper" },
  { skill: "skill.foraging", skin: "forager", ground: "grass", station: "resource.bush.berry" },
  { skill: "skill.fishing", skin: "angler", ground: "sand", station: "resource.fishing.pond", water: true },
  { skill: "skill.cooking", skin: "cook", ground: "coarsedirt", station: "object.campfire.basic" },
  { skill: "skill.smelting", skin: "smelter", ground: "stonebrick", station: "object.furnace.basic" },
  { skill: "skill.smithing", skin: "smith", ground: "stonebrick", station: "object.anvil.basic" },
  // One instructor for all of melee, taught through the attack-style toggle.
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

/** A terrain band the trail passes through — sets the flanking hills' block,
 *  how steeply they rise, whether lakes pool in the low ground, and the props
 *  scattered on the banks. Each switchback row is a different band, so the walk
 *  changes scenery as it goes. */
interface Band {
  bank: BlockType;
  rise: number; // max bank height above BASE
  lake?: boolean; // pool water in the far low ground
  props: string[]; // scenery scattered on the banks
}

const BANDS: Band[] = [
  { bank: "grass", rise: 3, props: ["object.log.fallen", "object.flora.wild", "object.grass.tuft"] }, // birchwood
  { bank: "stone", rise: 6, props: ["object.boulder.stone", "object.rock.outcrop"] }, // quarry crags
  { bank: "mud", rise: 2, lake: true, props: ["object.reeds.water", "object.grass.tuft"] }, // fen
  { bank: "drygrass", rise: 2, props: ["object.flowers.showy", "object.flowers.wild"] }, // meadow
  { bank: "grass", rise: 4, props: ["object.log.fallen", "object.mushroom.giant"] }, // pinewood
  { bank: "andesite", rise: 6, props: ["object.rock.outcrop", "object.boulder.stone"] }, // highland crag
  { bank: "podzol", rise: 3, lake: true, props: ["object.mushroom.giant", "object.log.fallen"] }, // mire
  { bank: "calcite", rise: 4, props: ["object.flowers.wild", "object.grass.tuft"] }, // pale approach
];

const colX = (c: number): number => Math.round(X_L + ((X_R - X_L) * c) / (PER_ROW - 1));
const rowZ = (r: number): number => Z_START + r * ROW_GAP;
const bandForZ = (z: number): Band => BANDS[Math.max(0, Math.min(ROWS - 1, Math.round((z - Z_START) / ROW_GAP))) % BANDS.length];

/** The 32 stop cells in serpentine order: camp, 30 tutors, gate. Consecutive
 *  stops are axis-aligned so the corridor between them is a straight run. */
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
  const inB = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < D;
  const set = (x: number, z: number, block: BlockType, h: number) => {
    if (inB(x, z)) { blocks[at(x, z)] = block; heights[at(x, z)] = h; }
  };

  // 1) Carve the trail's centreline + widen clearings at each stop. `trail`
  //    marks every walkable cell so the banks can be raised around it.
  const trail = new Uint8Array(W * D);
  const markTrail = (x: number, z: number) => { if (inB(x, z)) trail[at(x, z)] = 1; };
  const stops = stopCells();
  const carve = (a: Cell, b: Cell) => {
    if (a.z === b.z) {
      const [x0, x1] = a.x < b.x ? [a.x, b.x] : [b.x, a.x];
      for (let x = x0; x <= x1; x++) for (let w = -HALF; w <= HALF; w++) markTrail(x, a.z + w);
    } else {
      const [z0, z1] = a.z < b.z ? [a.z, b.z] : [b.z, a.z];
      for (let z = z0; z <= z1; z++) for (let w = -HALF; w <= HALF; w++) markTrail(a.x + w, z);
    }
  };
  for (let i = 0; i + 1 < stops.length; i++) carve(stops[i], stops[i + 1]);
  // Clearings: a wider walkable room at every stop.
  const clearingR = (i: number) => (i === 0 || i === stops.length - 1 ? CLEAR_R : TUTORS[i - 1]?.pen || TUTORS[i - 1]?.water ? CLEAR_R : 3);
  stops.forEach((s, i) => {
    const r = clearingR(i);
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) markTrail(s.x + dx, s.z + dz);
  });

  // 2) Distance-from-trail (multi-source BFS), to ramp the banks up away from
  //    the path — a shallow verge by the trail rising to tall hills beyond.
  const dist = new Int16Array(W * D).fill(-1);
  let queue: number[] = [];
  for (let i = 0; i < trail.length; i++) if (trail[i]) { dist[i] = 0; queue.push(i); }
  while (queue.length) {
    const next: number[] = [];
    for (const idx of queue) {
      const x = idx % W, z = (idx / W) | 0, d = dist[idx];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz;
        if (!inB(nx, nz)) continue;
        const ni = at(nx, nz);
        if (dist[ni] === -1) { dist[ni] = d + 1; next.push(ni); }
      }
    }
    queue = next;
  }

  // 3) Lay terrain. Trail cells get their per-tutor ground (BASE, walkable);
  //    off-trail cells rise into diverse banks (unwalkable) or pool into lakes.
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const edge = Math.min(x, z, W - 1 - x, D - 1 - z);
      if (trail[at(x, z)]) { set(x, z, "grass", BASE); continue; } // ground refined below per-stop
      const band = bandForZ(z);
      const d = dist[at(x, z)];
      if (edge < 3) { set(x, z, "stone", BASE + 8); continue; } // outer cliff rim
      if (edge < 6) { set(x, z, "water", BASE); continue; } // moat
      if (band.lake && d > 7) { set(x, z, "water", BASE); continue; } // valley lake
      const rise = Math.min(band.rise, 1 + Math.floor(d / 2));
      set(x, z, band.bank, BASE + Math.max(2, rise)); // banks step up >1 => unwalkable
    }
  }

  // 4) Scatter scenery on the banks (decorative; the banks are unwalkable), a
  //    couple of props per band cell chosen deterministically by position.
  const bankProps: ObjectPlacement[] = [];
  let propN = 0;
  for (let z = 8; z < D - 8; z += 2) {
    for (let x = 8; x < W - 8; x += 2) {
      if (trail[at(x, z)]) continue;
      const d = dist[at(x, z)];
      if (d < 2 || d > 9) continue; // hug the trail, skip deep interior
      if ((x * 7 + z * 13) % 6 !== 0) continue;
      const band = bandForZ(z);
      if (blocks[at(x, z)] === "water") continue;
      const prop = band.props[(x + z) % band.props.length];
      bankProps.push({ instanceId: `tut.bank.${propN++}`, defId: prop, cell: { x, z } });
    }
  }

  // --- camp (stop 0): starter-gear chest, bed, hearth, signpost, guide ---
  const camp = stops[0];
  patchGround(set, camp.x, camp.z, CLEAR_R - 1, "coarsedirt");
  objects.push(
    {
      instanceId: "tutorial.camp.chest",
      defId: "object.storage_chest.basic",
      cell: { x: camp.x - 2, z: camp.z - 1 },
      // Just provisions — every master hands over the tool their own lesson needs.
      initialItems: [
        { itemId: "item.pork.cooked", qty: 5 },
        { itemId: "item.coin", qty: 20 },
      ],
    },
    { instanceId: "tutorial.camp.bed", defId: "object.bed.basic", cell: { x: camp.x - 3, z: camp.z + 1 } },
    { instanceId: "tutorial.camp.fire", defId: "object.campfire.basic", cell: { x: camp.x + 2, z: camp.z - 2 } },
    { instanceId: "tutorial.camp.sign", defId: "object.signpost", cell: { x: camp.x, z: camp.z + 2 } },
  );
  npcs.push({
    instanceId: "tutorial.guide",
    name: "Rowan the Guide",
    cell: { x: camp.x + 1, z: camp.z },
    wanderRadius: 0,
    skin: "guide",
    lines: [
      "Welcome to Runecraft! This is Tutor's Trail.",
      "There's just the one path — follow it, meet each master in turn, and it'll bring you to the gate.",
      "Step through the gate at the end to enter your own world.",
    ],
  });

  // --- tutor stops along the trail ---
  TUTORS.forEach((t, i) => {
    const stop = stops[i + 1];
    const short = t.skill.slice("skill.".length);
    const master = SKILL_MASTERS.find((m) => m.skill === t.skill);
    const skillName = SKILLS[t.skill]?.name ?? short;
    const title = master?.title ?? "Master";
    const tutorName = master?.name ?? "Tutor";
    // Which side of the corridor the training ground sits on.
    const side = (i % 2 === 0 ? -1 : 1) as 1 | -1;

    // Refine the clearing ground to the tutor's theme.
    patchGround(set, stop.x, stop.z, 3, t.ground);

    npcs.push({
      instanceId: masterNpcId(t.skill),
      name: t.combat ? "Sergeant Gareth, Combat Instructor" : `${tutorName} the ${title}`,
      cell: { x: stop.x + 1, z: stop.z },
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
            `Train ${skillName} here in the clearing, then carry on down the trail.`,
          ],
    });
    objects.push({ instanceId: `tut.lamp.${short}`, defId: "object.lamp.post", cell: { x: stop.x - 2, z: stop.z } });

    // Optional pond beside the stop (fishing / mariner) — carved into the clearing.
    if (t.water) {
      for (let dz = -1; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        set(stop.x + dx, stop.z + side * 2 + dz, "water", BASE);
      }
      objects.push({ instanceId: `tut.reeds.${short}`, defId: "object.reeds.water", cell: { x: stop.x + 3, z: stop.z } });
    }

    // Station beside the tutor, inside the clearing.
    if (t.station) {
      const scell = { x: stop.x - 1, z: stop.z + side * (t.water ? 1 : 2) };
      if (t.station.startsWith("resource.")) nodes.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
      else objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
    }

    // Fenced practice pen inside the clearing.
    if (t.pen) {
      buildPen(set, objects, enemies, stop.x, stop.z + side * 3, side, short, t.pen, !!t.combat);
    }
  });

  // --- gateway (last stop): gatekeeper + graduation portal ---
  const gate = stops[stops.length - 1];
  patchGround(set, gate.x, gate.z, CLEAR_R - 1, "stonebrick");
  objects.push(
    {
      instanceId: "tutorial.graduate",
      defId: "object.portal.graduate",
      cell: { x: gate.x, z: gate.z - 2 },
      portal: { targetRegionId: "region.endless", targetCell: { x: gate.x, z: gate.z } },
    },
    { instanceId: "tutorial.gate.lampL", defId: "object.lamp.post", cell: { x: gate.x - 3, z: gate.z } },
    { instanceId: "tutorial.gate.lampR", defId: "object.lamp.post", cell: { x: gate.x + 3, z: gate.z } },
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
  // The overworld skill-coverage test keys Slaying off this classic warden id.
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
    objects: [...objects, ...bankProps],
    npcs,
    enemies,
    spawn: { x: camp.x, z: camp.z + 1 },
    theme: { sky: "#8fc7e8", sun: 1.0, ambient: 0.62 },
  };
}

/** Paint a small square ground patch around a centre (trail cells only stay at
 *  BASE, so this never punches a hole in the enclosing banks). */
function patchGround(
  set: (x: number, z: number, block: BlockType, h: number) => void,
  cx: number,
  cz: number,
  rad: number,
  block: BlockType,
): void {
  for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) set(cx + dx, cz + dz, block, BASE);
}

/** A compact fenced pen on one side of a clearing, gated toward the corridor,
 *  holding two (or three) weak practice mobs that stay penned behind the fence. */
function buildPen(
  set: (x: number, z: number, block: BlockType, h: number) => void,
  objects: ObjectPlacement[],
  enemies: EnemyPlacement[],
  cx: number,
  cz: number,
  side: 1 | -1,
  short: string,
  enemyDef: string,
  combat: boolean,
): void {
  const x0 = cx - 2, x1 = cx + 2;
  const zNear = cz - side; // the fence side toward the corridor (holds the gate)
  const zFar = cz + side;
  const zLo = Math.min(zNear, zFar), zHi = Math.max(zNear, zFar);
  for (let z = zLo; z <= zHi; z++) for (let x = x0; x <= x1; x++) set(x, z, "coarsedirt", BASE);
  for (let x = x0; x <= x1; x++) {
    if (x !== cx) set(x, zNear, "oak_fence", BASE); // gate gap at the centre
    set(x, zFar, "oak_fence", BASE);
  }
  set(x0, cz, "oak_fence", BASE);
  set(x1, cz, "oak_fence", BASE);
  enemies.push(
    { instanceId: `tut.pen.${short}.a`, defId: enemyDef, cell: { x: cx - 1, z: cz } },
    { instanceId: `tut.pen.${short}.b`, defId: enemyDef, cell: { x: cx + 1, z: cz } },
  );
  if (combat) enemies.push({ instanceId: `tut.pen.${short}.c`, defId: enemyDef, cell: { x: cx, z: cz } });
}
