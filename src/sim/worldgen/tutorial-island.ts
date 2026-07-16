// Tutor's Trail: a hand-built finite region (its own heightfield, NOT the
// endless generator) shaped as ONE broad, gently winding trail. The island is a
// flat grassy field raised two blocks; a wide dirt path is sunk one step into
// it and meanders from the camp down to the gate. The two-block bank on either
// side is all that keeps you on the path — no walls of props, nothing to hide
// the tutors behind. Every master stands in a wide clearing right on the trail.
//
// Nothing here is random: no endless POIs, villages, dungeons, roaming mobs or
// stray minimap markers ever appear.

import type { BlockType } from "../../content/blocks";
import { SKILL_MASTERS, masterNpcId, SKILLS } from "../../content/content";
import type { Cell } from "../types";
import type { EnemyPlacement, NodePlacement, NpcPlacement, ObjectPlacement, RegionSpec } from "../world";

const W = 112;
const D = 276;
const BASE = 6; // walk-surface of the sunken trail
const BANK = BASE + 2; // the field on either side — two blocks up, so unwalkable
const HALF = 3; // trail half-width (=> a 7-wide path, twice the old width)
const CLEAR_R = 5; // clearing radius at each stop (a wide 11-cell opening)
const STOPS = 32; // camp + 30 tutors + gate
const Z_TOP = 18;
const Z_STEP = 8;

/** The trail centreline: a smooth left-right meander down the island (two
 *  gentle sine waves, no switchbacks). x stays well inside the banks. */
const centerX = (z: number): number =>
  56 + 24 * Math.sin((z - Z_TOP) * 0.026) + 10 * Math.sin((z - Z_TOP) * 0.011 + 2.1);

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

// The teaching order down the trail (Attack folds Strength/Defence/Constitution
// into one Combat Instructor).
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

const stopZ = (i: number): number => Z_TOP + i * Z_STEP;
const stopCell = (i: number): Cell => ({ x: Math.round(centerX(stopZ(i))), z: stopZ(i) });

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
  // Carve a filled disc down to the trail (BASE) — overlapping discs make a
  // smooth, rounded path with no stair-stepped edges.
  const disc = (cx: number, cz: number, r: number, block: BlockType) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz <= r * r + 1) set(cx + dx, cz + dz, block, BASE);
    }
  };

  // 1) The trail: sweep the meandering centreline and carve a wide dirt ribbon.
  for (let z = Z_TOP - 2; z <= stopZ(STOPS - 1) + 2; z++) {
    disc(Math.round(centerX(z)), z, HALF, "dirt");
  }
  // 2) A broad clearing at every stop, floored in the tutor's own ground.
  const stops = Array.from({ length: STOPS }, (_, i) => stopCell(i));
  stops.forEach((s, i) => {
    const ground = i === 0 || i === STOPS - 1 ? "coarsedirt" : TUTORS[i - 1].ground;
    disc(s.x, s.z, CLEAR_R, ground);
  });
  // 3) A thin water moat around the rim so it reads as an island.
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (Math.min(x, z, W - 1 - x, D - 1 - z) < 3) set(x, z, "water", BASE);
  }

  // --- camp (stop 0) ---
  const camp = stops[0];
  const off = (i: number) => (i % 2 === 0 ? -1 : 1); // alternate the side dressing sits on
  objects.push(
    {
      instanceId: "tutorial.camp.chest",
      defId: "object.storage_chest.basic",
      cell: { x: camp.x - 3, z: camp.z },
      // Just provisions — every master hands over the tool their lesson needs.
      initialItems: [{ itemId: "item.pork.cooked", qty: 5 }, { itemId: "item.coin", qty: 20 }],
    },
    { instanceId: "tutorial.camp.bed", defId: "object.bed.basic", cell: { x: camp.x - 3, z: camp.z + 2 } },
    { instanceId: "tutorial.camp.fire", defId: "object.campfire.basic", cell: { x: camp.x + 3, z: camp.z } },
    { instanceId: "tutorial.camp.sign", defId: "object.signpost", cell: { x: camp.x, z: camp.z - 3 } },
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
    const side = off(idx) as 1 | -1;

    // The tutor stands in the open middle of the clearing.
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

    // A pond beside the clearing for the anglers/mariners.
    if (t.water) {
      for (let dz = -2; dz <= 2; dz++) for (let dx = 0; dx <= 3; dx++) {
        set(stop.x + side * (CLEAR_R - 1 + dx), stop.z + dz, "water", BASE);
      }
      objects.push({ instanceId: `tut.reeds.${short}`, defId: "object.reeds.water", cell: { x: stop.x + side * (CLEAR_R - 1), z: stop.z } });
    }

    // Station beside the tutor, inside the clearing.
    if (t.station) {
      const scell = { x: stop.x + side * 3, z: stop.z + (t.water ? -2 : 0) };
      set(scell.x, scell.z, "coarsedirt", BASE); // make sure it sits on the floor
      if (t.station.startsWith("resource.")) {
        nodes.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
      } else if (t.station === "object.shortcut.log") {
        objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell, portal: { targetRegionId: "region.tutorial", targetCell: { x: stop.x, z: stop.z } } });
      } else {
        objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
      }
    }

    // Fenced practice pen, carved as a small alcove off the far side.
    if (t.pen) {
      buildPen(set, enemies, stop.x - side * (CLEAR_R + 1), stop.z, side, short, t.pen, !!t.combat, !!t.boss);
    }
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
    objects,
    npcs,
    enemies,
    spawn: { x: camp.x, z: camp.z },
    theme: { sky: "#8fc7e8", sun: 1.0, ambient: 0.64 },
  };
}

/** A compact fenced pen carved as a floor alcove, gated toward the trail, with
 *  two (or three) weak practice beasts that stay penned. */
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
  // Fence the perimeter, leaving a one-cell gate on the trail-facing side.
  const gateX = cx + side * 2; // the side nearest the clearing
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
