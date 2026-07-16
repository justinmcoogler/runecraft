// Tutor's Trail: a hand-built finite region (its own heightfield, NOT the
// endless generator). A broad grassy field, raised two blocks; a dirt path is
// sunk one step into it and flows in a natural, curving switchback — each leg
// dips and rises in a gentle S rather than running dead-straight — from the
// camp down to the gate. Every master sits in a roomy clearing, and their
// fenced pens / crafting stations tuck into bays set off to the side of the
// path so they never block the way through. The two-block bank is all that
// keeps you on the path — no prop walls.
//
// Nothing here is random: no endless POIs, villages, dungeons, roaming mobs or
// stray minimap markers ever appear.

import type { BlockType } from "../../content/blocks";
import { SKILL_MASTERS, masterNpcId, SKILLS } from "../../content/content";
import type { Cell } from "../types";
import type { EnemyPlacement, NodePlacement, NpcPlacement, ObjectPlacement, RegionSpec } from "../world";

const W = 248; // a bigger, square island
const D = 248;
const BASE = 6; // walk-surface of the sunken path
const BANK = BASE + 2; // the field on either side — two blocks up, so unwalkable
const HALF = 3; // path half-width (7-wide path)
const CLEAR_R = 9; // clearing radius at each master (a roomy 19-cell area)
const STOPS = 32; // camp + 30 tutors + gate
const LEGS = 5; // sweeping passes down the island
const LEG_GAP = 42; // vertical spacing between passes
const Z_TOP = 30;
const X_A = 36;
const X_B = 210;
const TURN_R = 20; // radius of the smooth U-turn between passes
const AMP = 7; // how far each leg dips/rises as it crosses — the S-curve
const WAVES = 1.5; // oscillations per leg (down, up, down) — ends back on the line
const MOAT = 3; // water rim thickness

/** The trail centreline: long passes across the island, each undulating in a
 *  gentle S, joined by wide rounded U-turns — a natural, flowing switchback
 *  trail, not a tight even zigzag. Returned as a dense polyline. */
function buildCenterline(): Cell[] {
  const P: Cell[] = [];
  for (let r = 0; r < LEGS; r++) {
    const baseZ = Z_TOP + r * LEG_GAP;
    const ltr = r % 2 === 0;
    const from = ltr ? X_A : X_B;
    const to = ltr ? X_B : X_A;
    const dir = ltr ? 1 : -1;
    for (let x = from; x !== to + dir; x += dir) {
      const t = (x - from) / (to - from); // 0..1 across the leg
      // sin(WAVES·2π·t) with WAVES=1.5 → dips down, back up, down again, and
      // lands back on baseZ at the leg's end so the U-turn joins cleanly.
      const z = Math.round(baseZ + AMP * Math.sin(WAVES * 2 * Math.PI * t));
      P.push({ x, z });
    }
    if (r < LEGS - 1) {
      // A half-circle U-turn at the leg's end, bulging outward to the next pass.
      const cz = baseZ + TURN_R;
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

/** Unit perpendicular to the trail at polyline index `idx` (looking a few cells
 *  either way so the direction is stable through curves). */
function perpAt(line: Cell[], idx: number): { px: number; pz: number } {
  const a = line[Math.max(0, idx - 3)];
  const b = line[Math.min(line.length - 1, idx + 3)];
  let tx = b.x - a.x, tz = b.z - a.z;
  const m = Math.hypot(tx, tz) || 1;
  tx /= m; tz /= m;
  return { px: -tz, pz: tx }; // rotate tangent 90°
}

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
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const trail = new Uint8Array(W * D);
  const disc = (cx: number, cz: number, r: number, block: BlockType, h = BASE) => {
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz <= r * r + 1 && inB(cx + dx, cz + dz)) {
        blocks[at(cx + dx, cz + dz)] = block;
        heights[at(cx + dx, cz + dz)] = h;
        trail[at(cx + dx, cz + dz)] = 1;
      }
    }
  };

  // 1) The trail — a wide dirt ribbon carved along the flowing centreline.
  const line = buildCenterline();
  for (const p of line) disc(p.x, p.z, HALF, "dirt");

  // 2) Masters spread evenly along the trail by arc length, each in a roomy
  //    clearing floored in its own ground. Remember each stop's polyline index
  //    so we can face bays perpendicular to the trail there.
  const stopIdx = Array.from({ length: STOPS }, (_, i) => Math.round((i * (line.length - 1)) / (STOPS - 1)));
  const stops = stopIdx.map((li) => line[li]);
  stops.forEach((s, i) => {
    const ground = i === 0 || i === STOPS - 1 ? "coarsedirt" : TUTORS[i - 1].ground;
    disc(s.x, s.z, CLEAR_R, ground);
  });

  // 3) A water moat round the rim so it reads as an island.
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (Math.min(x, z, W - 1 - x, D - 1 - z) < MOAT) { set(x, z, "water", BASE); trail[at(x, z)] = 1; }
  }

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

    // Bays sit to the side of the trail: station on one side, pen on the other,
    // both offset well clear of the walking corridor and clamped to stay on the
    // island. The perpendicular is snapped to a cardinal axis so bays are
    // axis-aligned — they never straddle (block) the path, and a pond always
    // leaves an orthogonally-adjacent dry bank to fish from.
    const { px, pz } = perpAt(line, stopIdx[idx + 1]);
    const perp = Math.abs(px) >= Math.abs(pz) ? { x: Math.sign(px) || 1, z: 0 } : { x: 0, z: Math.sign(pz) || 1 };
    const off = (d: number, sign: number): Cell => ({
      x: clamp(stop.x + perp.x * sign * d, MOAT + 4, W - 1 - MOAT - 4),
      z: clamp(stop.z + perp.z * sign * d, MOAT + 4, D - 1 - MOAT - 4),
    });

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
    objects.push({ instanceId: `tut.lamp.${short}`, defId: "object.lamp.post", cell: off(CLEAR_R, -1) });

    // Station bay: on the +perp side. Carve a floored bay and set the station in it.
    if (t.station) {
      if (t.water) {
        // A pond lapping into the clearing on the +perp side: carve water beyond
        // the bank, keep dry clearing to stand on.
        const pondC = off(CLEAR_R + 3, 1);
        disc(pondC.x, pondC.z, 4, "water", BASE);
        const nodeC = off(CLEAR_R - 1, 1); // sits on a water cell at the near lip
        set(nodeC.x, nodeC.z, "water", BASE);
        if (t.station === "resource.fishing.pond") {
          nodes.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: nodeC });
          objects.push({ instanceId: `tut.reeds.${short}`, defId: "object.reeds.water", cell: off(CLEAR_R + 1, 1) });
        } else {
          // Boating: a dry workbench in the bay, water at hand to launch into.
          const bench = off(CLEAR_R - 2, 1);
          set(bench.x, bench.z, "sand", BASE); trail[at(bench.x, bench.z)] = 1;
          objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: bench });
        }
      } else {
        const scell = off(CLEAR_R - 2, 1);
        disc(scell.x, scell.z, 2, "coarsedirt"); // a small floored bay
        if (t.station.startsWith("resource.")) {
          nodes.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
        } else if (t.station === "object.shortcut.log") {
          objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell, portal: { targetRegionId: "region.tutorial", targetCell: { x: stop.x, z: stop.z } } });
        } else {
          objects.push({ instanceId: `tut.station.${short}`, defId: t.station, cell: scell });
        }
      }
    }

    // Fenced pen bay: on the -perp side, gate opening back toward the clearing.
    if (t.pen) {
      const penC = off(CLEAR_R + 3, -1);
      const gate = { dx: Math.sign(Math.round(stop.x - penC.x)), dz: Math.sign(Math.round(stop.z - penC.z)) };
      buildPen(set, trail, enemies, penC.x, penC.z, gate, short, t.pen, !!t.combat, !!t.boss);
    }
  });

  // 4) Dress the field: scattered trees/boulders/flowers on the raised grass,
  //    kept clear of the path AND only on ground that is flat all around, so
  //    nothing ever perches on an exposed column and floats.
  decorateField(blocks, heights, trail, objects, nodes);

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

/** Scatter scenery across the raised field so it looks alive — low flat flowers
 *  and tufts near the verge, the odd boulder or far-back tree deeper in. A prop
 *  is only placed where its cell and every neighbour sit at field height, so it
 *  can never perch on a lone raised column beside the sunken path and float. */
function decorateField(
  blocks: BlockType[],
  heights: number[],
  trail: Uint8Array,
  objects: ObjectPlacement[],
  nodes: NodePlacement[],
): void {
  const at = (x: number, z: number) => z * W + x;
  // Distance from the nearest path/clearing/water cell (multi-source BFS).
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

  // True only where the cell and all 8 neighbours are flat field (BANK height,
  // grass): guarantees the prop sits flush, never on an exposed edge column.
  const flatHere = (x: number, z: number): boolean => {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= D) return false;
      const ni = at(nx, nz);
      if (heights[ni] !== BANK || blocks[ni] !== "grass") return false;
    }
    return true;
  };

  let n = 0;
  const put = (x: number, z: number, defId: string, isNode: boolean) => {
    if (isNode) nodes.push({ instanceId: `dec.${n++}`, defId, cell: { x, z } });
    else objects.push({ instanceId: `dec.${n++}`, defId, cell: { x, z } });
  };
  for (let z = 5; z < D - 5; z += 3) {
    for (let x = 5; x < W - 5; x += 3) {
      const i = at(x, z);
      if (trail[i] || blocks[i] === "water") continue;
      const d = dist[i];
      if (d < 4) continue; // a clean grass verge frames the path
      const h = ((x * 73856093) ^ (z * 19349663)) >>> 0;
      const r = h % 100;
      // Trees and boulders only where the ground is flat all around, so they
      // never float. Low cover (flowers/tufts) can sit anywhere on the field.
      if (d >= 10 && r < 3 && flatHere(x, z)) put(x, z, "resource.tree.basic", true);
      else if (r < 4 && flatHere(x, z)) put(x, z, "object.boulder.stone");
      else if (r < 16) put(x, z, "object.flowers.wild");
      else if (r < 34) put(x, z, "object.grass.tuft");
    }
  }
}

/** A compact fenced pen carved as a floor bay, with a one-cell gate opening on
 *  the side that faces the clearing. */
function buildPen(
  set: (x: number, z: number, block: BlockType, h: number) => void,
  trail: Uint8Array,
  enemies: EnemyPlacement[],
  cx: number,
  cz: number,
  gateDir: { dx: number; dz: number },
  short: string,
  enemyDef: string,
  combat: boolean,
  boss: boolean,
): void {
  const x0 = cx - 2, x1 = cx + 2, z0 = cz - 2, z1 = cz + 2;
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { set(x, z, "coarsedirt", BASE); trail[z * W + x] = 1; }
  // The gate is the mid-cell of whichever wall faces the clearing.
  const gx = gateDir.dx !== 0 ? cx + gateDir.dx * 2 : cx;
  const gz = gateDir.dz !== 0 ? cz + gateDir.dz * 2 : cz;
  const wall = (x: number, z: number) => { if (!(x === gx && z === gz)) set(x, z, "oak_fence", BASE); };
  for (let z = z0; z <= z1; z++) { wall(x0, z); wall(x1, z); }
  for (let x = x0; x <= x1; x++) { wall(x, z0); wall(x, z1); }
  const primary = boss ? `tut.pen.${short}.boss` : `tut.pen.${short}.a`;
  enemies.push(
    { instanceId: primary, defId: enemyDef, cell: { x: cx, z: cz - 1 } },
    { instanceId: `tut.pen.${short}.b`, defId: enemyDef, cell: { x: cx, z: cz + 1 } },
  );
  if (combat) enemies.push({ instanceId: `tut.pen.${short}.c`, defId: enemyDef, cell: { x: cx, z: cz } });
}
