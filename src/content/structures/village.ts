// Procedural medieval village houses built from Minecraft-shaped blocks (cubes,
// slabs, stairs, posts, panes, panels, trapdoors, lanterns). Each house is a
// StructureAsset placed as a solid landmark whose ground-floor door is a portal
// into a reconstructed interior (structures/interior-plan.ts). Houses compose
// from reusable pieces — stone footings, timber-framed plaster walls, pitched
// stair roofs, wings and lean-to sheds — parameterised so no two read alike.

import type { Facing, StructureAsset, StructureBlock } from "../../structures/types";

type Kind = StructureBlock["kind"];

interface Palette {
  footing: string; base: string; plaster: string; timber: string; beam: string; roof: string; floor: string;
}
// A warm, humble medieval palette: cobbled stone footings, oak-log framing, and
// brown shingle roofs. Walls are either warm oak plank (cottages, workshops) or
// pale plaster (the inn, store, leader's house) — set per building for variety.
const THEME: Palette = {
  footing: "terrain.stonebrick",
  base: "terrain.stonebrick",       // cobbled stone base course
  plaster: "terrain.plank",         // warm oak plank walls (default)
  timber: "resource.tree.log.side", // oak-log corner posts and beams
  beam: "resource.tree.log.side",
  roof: "roof.darkoak",             // warm brown shingles
  floor: "terrain.plank",
};
const PLASTER_WHITE = "block.terracotta.white"; // pale plaster infill for grander builds

class Build {
  private m = new Map<string, StructureBlock>();
  put(x: number, y: number, z: number, kind: Kind, material?: string, extra?: Partial<StructureBlock>): void {
    if (y < 0 || x < 0 || z < 0) return;
    this.m.set(`${x},${y},${z}`, { x, y, z, kind, material, ...extra });
  }
  clear(x: number, y: number, z: number): void { this.m.delete(`${x},${y},${z}`); }
  has(x: number, y: number, z: number): boolean { return this.m.has(`${x},${y},${z}`); }
  fill(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, kind: Kind, mat: string): void {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) this.put(x, y, z, kind, mat);
  }
  blocks(): StructureBlock[] { return [...this.m.values()]; }
}

/** Timber-framed plaster walls for one storey: a stone ground course (when this
 *  is the storey sitting on the earth), white plaster infill, dark-oak corner
 *  posts, a sill/mid-rail/head beam, and studs — the classic Tudor frame. */
function framedWalls(b: Build, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, p: Palette, stoneBase: boolean): void {
  for (let y = y0; y <= y1; y++) {
    const mat = stoneBase && y === y0 ? p.base : p.plaster;
    for (let x = x0; x <= x1; x++) { b.put(x, y, z0, "cube", mat); b.put(x, y, z1, "cube", mat); }
    for (let z = z0; z <= z1; z++) { b.put(x0, y, z, "cube", mat); b.put(x1, y, z, "cube", mat); }
  }
  const framY = stoneBase ? y0 + 1 : y0; // timber sits above the stone course
  // Keep the timber SPARSE so the walls read white: just corner posts and a top
  // plate (window/door frames add the rest of the dark accents). A dense frame
  // turned the whole wall brown.
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const)
    for (let y = framY; y <= y1; y++) b.put(cx, y, cz, "cube", p.timber);
  for (let x = x0; x <= x1; x++) { b.put(x, y1, z0, "cube", p.timber); b.put(x, y1, z1, "cube", p.timber); }
  for (let z = z0; z <= z1; z++) { b.put(x0, y1, z, "cube", p.timber); b.put(x1, y1, z, "cube", p.timber); }
}

/** A two-tall glass window set in a dark timber frame (lintel above, sill below),
 *  carved into a wall run — crisp dark accents on the white plaster. */
function windowsAlong(b: Build, x0: number, x1: number, z0: number, z1: number, y: number, p: Palette): void {
  const win = (x: number, z: number, f: Facing) => {
    b.put(x, y, z, "pane", "block.glass", { translucent: true, facing: f });
    b.put(x, y + 1, z, "pane", "block.glass", { translucent: true, facing: f });
    b.put(x, y - 1, z, "cube", p.timber); // sill
    b.put(x, y + 2, z, "cube", p.timber); // lintel
  };
  if (z0 === z1) for (let x = x0 + 2; x < x1; x += 3) win(x, z0, "north");
  else for (let z = z0 + 2; z < z1; z += 3) win(x0, z, "east");
}

/** A diagonal knee-brace of stairs supporting a jettied storey or eave. */
function kneeBrace(b: Build, x: number, y: number, z: number, facing: Facing, p: Palette): void {
  b.put(x, y, z, "stairs", p.beam, { facing, top: true });
}

/** A pitched gable roof from stairs; ridge along the longer side. baseY is the
 *  first roof course (top of the walls + 1). Returns the ridge Y. */
function gableRoof(b: Build, x0: number, x1: number, z0: number, z1: number, baseY: number, p: Palette): number {
  const w = x1 - x0, d = z1 - z0;
  const alongX = w >= d;
  const half = Math.floor((alongX ? d : w) / 2);
  // Roof stays flush to the walls (no eave overhang) — in a column-blocking 2.5D
  // grid an overhang would seal the cell in front of the door.
  for (let i = 0; i <= half; i++) {
    const y = baseY + i;
    if (alongX) {
      const zA = z0 + i, zB = z1 - i;
      for (let x = x0; x <= x1; x++) {
        b.put(x, y, zA, "stairs", p.roof, { facing: "south" });
        if (zB !== zA) b.put(x, y, zB, "stairs", p.roof, { facing: "north" });
      }
      for (const x of [x0, x1]) for (let z = zA + 1; z < zB; z++) b.put(x, y - 1, z, "cube", p.plaster);
    } else {
      const xA = x0 + i, xB = x1 - i;
      for (let z = z0; z <= z1; z++) {
        b.put(xA, y, z, "stairs", p.roof, { facing: "east" });
        if (xB !== xA) b.put(xB, y, z, "stairs", p.roof, { facing: "west" });
      }
      for (const z of [z0, z1]) for (let x = xA + 1; x < xB; x++) b.put(x, y - 1, z, "cube", p.plaster);
    }
  }
  const topY = baseY + half;
  if (alongX) { const zc = z0 + half; for (let x = x0; x <= x1; x++) b.put(x, topY, zc, "slab", p.roof); }
  else { const xc = x0 + half; for (let z = z0; z <= z1; z++) b.put(xc, topY, z, "slab", p.roof); }
  return topY;
}

/** A single-slope (lean-to) roof, high on the `high` edge sloping to the far side. */
function leanRoof(b: Build, x0: number, x1: number, z0: number, z1: number, baseY: number, high: Facing, p: Palette): void {
  const run = high === "north" || high === "south" ? z1 - z0 : x1 - x0;
  for (let i = 0; i <= run; i++) {
    const y = baseY + (run - i);
    if (high === "south") for (let x = x0; x <= x1; x++) b.put(x, y, z1 - i, "stairs", p.roof, { facing: "north" });
    else if (high === "north") for (let x = x0; x <= x1; x++) b.put(x, y, z0 + i, "stairs", p.roof, { facing: "south" });
    else if (high === "east") for (let z = z0; z <= z1; z++) b.put(x1 - i, y, z, "stairs", p.roof, { facing: "west" });
    else for (let z = z0; z <= z1; z++) b.put(x0 + i, y, z, "stairs", p.roof, { facing: "east" });
  }
}

interface Box {
  x0: number; z0: number; w: number; d: number; stories: number;
  roof?: "gable" | "lean"; leanHigh?: Facing;
}

interface HouseOpts {
  boxes: Box[];
  wall?: string; // wall material override (pale plaster for grander builds)
  door: { box: number; side: Facing };
  chimney?: [number, number]; // local x,z at the base of a chimney stack
  jetty?: boolean; // upper storeys overhang every wall but the door's
  porch?: boolean;
  dormers?: boolean;
}

const STORY = 4; // wall height per storey (roomy Tudor ground floors)
const DECK = 1;  // floor deck between storeys

function boxYtop(box: Box): number { return box.stories * (STORY + DECK); } // wall top of top storey

function makeHouse(name: string, o: HouseOpts): StructureAsset {
  const p: Palette = o.wall ? { ...THEME, plaster: o.wall } : THEME;
  const b = new Build();
  // Offset everything by +1 so there's a margin for the interior extractor.
  const OFF = 1;
  const boxes = o.boxes.map((bx) => ({ ...bx, x0: bx.x0 + OFF, z0: bx.z0 + OFF }));

  boxes.forEach((box, bi) => {
    const bx0 = box.x0, bx1 = box.x0 + box.w - 1, bz0 = box.z0, bz1 = box.z0 + box.d - 1;
    b.fill(bx0, bx1, 0, 0, bz0, bz1, "cube", p.footing);
    b.fill(bx0, bx1, 0, 0, bz0, bz1, "cube", p.floor);
    const doorSide = o.door.box === bi ? o.door.side : null;
    for (let s = 0; s < box.stories; s++) {
      const yb = 1 + s * (STORY + DECK), yt = yb + STORY - 1;
      // A jettied upper storey overhangs every wall EXCEPT the one carrying the
      // door (a front overhang would seal the doorway in this column grid).
      const jet = o.jetty && s > 0 ? 1 : 0;
      const jw = jet && doorSide !== "west" ? 1 : 0, je = jet && doorSide !== "east" ? 1 : 0;
      const jn = jet && doorSide !== "north" ? 1 : 0, js = jet && doorSide !== "south" ? 1 : 0;
      const ex0 = bx0 - jw, ex1 = bx1 + je, ez0 = bz0 - jn, ez1 = bz1 + js;
      framedWalls(b, ex0, ex1, ez0, ez1, yb, yt, p, s === 0);
      if (jet) {
        // Exposed floor joists + knee braces carrying the overhang.
        for (let x = ex0; x <= ex1; x++) { if (jn) b.put(x, yb - 1, ez0, "cube", p.beam); if (js) b.put(x, yb - 1, ez1, "cube", p.beam); }
        for (let z = ez0; z <= ez1; z++) { if (jw) b.put(ex0, yb - 1, z, "cube", p.beam); if (je) b.put(ex1, yb - 1, z, "cube", p.beam); }
        if (jn) { kneeBrace(b, ex0, yb - 2, ez0, "south", p); kneeBrace(b, ex1, yb - 2, ez0, "south", p); }
        if (js) { kneeBrace(b, ex0, yb - 2, ez1, "north", p); kneeBrace(b, ex1, yb - 2, ez1, "north", p); }
      }
      const wy = yb + 1;
      windowsAlong(b, ex0, ex1, ez0, ez0, wy, p);
      windowsAlong(b, ex0, ex1, ez1, ez1, wy, p);
      windowsAlong(b, ex0, ex0, ez0, ez1, wy, p);
      windowsAlong(b, ex1, ex1, ez0, ez1, wy, p);
      if (s < box.stories - 1) for (let x = bx0; x <= bx1; x++) { b.put(x, yt + 1, bz0, "cube", p.beam); b.put(x, yt + 1, bz1, "cube", p.beam); }
    }
    // Roof + gable trim.
    const rb = boxYtop(box) - DECK + 1;
    if (box.roof === "lean") leanRoof(b, bx0, bx1, bz0, bz1, rb, box.leanHigh ?? "north", p);
    else {
      const ridgeY = gableRoof(b, bx0, bx1, bz0, bz1, rb, p);
      // Dormer windows on the front slope of tall roofs (one, or two if wide).
      if (o.dormers && box.stories >= 2) {
        const dz = bz1 - 1, cxm = Math.round((bx0 + bx1) / 2);
        const dxs = box.w >= 9 ? [bx0 + 2, bx1 - 2] : [cxm];
        for (const dx of dxs) {
          b.put(dx, rb + 1, dz, "cube", p.plaster);
          b.put(dx, rb + 2, dz, "pane", "block.glass", { translucent: true, facing: "north" });
          b.put(dx - 1, rb + 2, dz, "stairs", p.roof, { facing: "east" });
          b.put(dx + 1, rb + 2, dz, "stairs", p.roof, { facing: "west" });
          b.put(dx, rb + 3, dz, "slab", p.roof);
        }
      }
      // A carved bargeboard + finial post on each gable end.
      const w = bx1 - bx0, d = bz1 - bz0, alongX = w >= d, half = Math.floor((alongX ? d : w) / 2);
      if (alongX) { const zc = bz0 + half; b.put(bx0, ridgeY + 1, zc, "post", p.timber); b.put(bx1, ridgeY + 1, zc, "post", p.timber); }
      else { const xc = bx0 + half; b.put(xc, ridgeY + 1, bz0, "post", p.timber); b.put(xc, ridgeY + 1, bz1, "post", p.timber); }
    }
  });

  // Carve doorways between overlapping/adjacent boxes so the interior connects.
  if (boxes.length > 1) {
    const main = boxes[0];
    for (let i = 1; i < boxes.length; i++) {
      const wb = boxes[i];
      // shared edge midpoint — open a 1-wide, 2-tall passage at ground level.
      const cx = Math.round((Math.max(main.x0, wb.x0) + Math.min(main.x0 + main.w - 1, wb.x0 + wb.w - 1)) / 2);
      const cz = Math.round((Math.max(main.z0, wb.z0) + Math.min(main.z0 + main.d - 1, wb.z0 + wb.d - 1)) / 2);
      for (let y = 1; y <= 2; y++) { b.clear(cx, y, cz); b.clear(cx, y, cz + 1); b.clear(cx, y, cz - 1); b.clear(cx + 1, y, cz); b.clear(cx - 1, y, cz); }
    }
  }

  // Front door at ground level.
  const db = boxes[o.door.box];
  const dbx0 = db.x0, dbx1 = db.x0 + db.w - 1, dbz0 = db.z0, dbz1 = db.z0 + db.d - 1;
  const dcx = Math.round((dbx0 + dbx1) / 2), dcz = Math.round((dbz0 + dbz1) / 2);
  const doorPos: Record<Facing, [number, number]> = { south: [dcx, dbz1], north: [dcx, dbz0], east: [dbx1, dcz], west: [dbx0, dcz] };
  const [dx, dz] = doorPos[o.door.side];
  b.clear(dx, 1, dz); b.clear(dx, 2, dz);
  b.put(dx, 1, dz, "panel", "terrain.plank", { facing: o.door.side });
  b.put(dx, 2, dz, "panel", "terrain.plank", { facing: o.door.side });
  b.put(dx, 3, dz, "cube", p.beam); // lintel

  if (o.porch) {
    // A covered stoop that FLANKS the door — posts to either side and an awning
    // above — leaving the cell straight out from the door clear to walk through.
    const out: Record<Facing, [number, number]> = { south: [0, 1], north: [0, -1], east: [1, 0], west: [-1, 0] };
    const [ox, oz] = out[o.door.side];
    const perp: [number, number] = ox === 0 ? [1, 0] : [0, 1]; // along the wall
    for (const s of [-1, 1]) {
      const px = dx + ox + perp[0] * s, pz = dz + oz + perp[1] * s;
      b.put(px, 1, pz, "post", p.beam); b.put(px, 2, pz, "post", p.beam);
      b.put(px, 3, pz, "slab", p.roof, { top: true });
    }
    b.put(dx, 3, dz, "slab", p.roof, { top: true }); // awning lip over the door only
    b.put(dx + perp[0], 3, dz + perp[1], "glow", "#ffd873"); // lantern beside the door
  }

  if (o.chimney) {
    const [cx, cz] = [o.chimney[0] + OFF, o.chimney[1] + OFF];
    let top = 1; for (const bl of b.blocks()) if (Math.abs(bl.x - cx) <= 1 && Math.abs(bl.z - cz) <= 1) top = Math.max(top, bl.y);
    for (let y = 1; y <= top + 1; y++) b.put(cx, y, cz, "cube", p.footing);
    b.put(cx, top + 2, cz, "slab", p.footing);
  }

  const blocks = b.blocks();
  let mx = 0, my = 0, mz = 0;
  for (const bl of blocks) { mx = Math.max(mx, bl.x); my = Math.max(my, bl.y); mz = Math.max(mz, bl.z); }
  return {
    name, format: "sponge-schem",
    sx: mx + 2, sy: my + 1, sz: mz + 2, sink: 0,
    ax: Math.round(mx / 2), az: Math.round(mz / 2),
    blocks, unmapped: [],
  };
}

// A humble nine-building starter village. Each has a distinct footprint and a
// clear purpose; the grander three (inn, store, leader) wear pale plaster, the
// rest warm oak plank, all with oak-log framing, stone bases and brown roofs.
export const VILLAGE_HOUSES: Record<string, StructureAsset> = {
  // The inn — L-shaped, two-storey, plaster, a porch and dormers. Rest here and
  // meet the first quest-giver.
  inn: makeHouse("inn", { boxes: [{ x0: 0, z0: 0, w: 10, d: 7, stories: 2, roof: "gable" }, { x0: 7, z0: 7, w: 6, d: 5, stories: 1, roof: "gable" }], wall: PLASTER_WHITE, door: { box: 0, side: "south" }, chimney: [1, 1], porch: true, dormers: true }),
  // The blacksmith — a stone-walled forge hall with a lean-to store; the anvil
  // and firewood sit in an outdoor workspace beside it (placed in worldgen).
  blacksmith: makeHouse("blacksmith", { boxes: [{ x0: 0, z0: 0, w: 7, d: 7, stories: 1, roof: "gable" }, { x0: 7, z0: 1, w: 4, d: 5, stories: 1, roof: "lean", leanHigh: "west" }], door: { box: 0, side: "south" }, chimney: [1, 1] }),
  // The general store — a wide single storey with a covered shopfront porch.
  general_store: makeHouse("general_store", { boxes: [{ x0: 0, z0: 0, w: 11, d: 7, stories: 1, roof: "gable" }], wall: PLASTER_WHITE, door: { box: 0, side: "south" }, chimney: [1, 1], porch: true }),
  // The herbalist's cottage — small, with a chimney and a garden out front.
  herbalist: makeHouse("herbalist", { boxes: [{ x0: 0, z0: 0, w: 6, d: 6, stories: 1, roof: "gable" }], door: { box: 0, side: "south" }, chimney: [1, 1], porch: true }),
  // The village leader's house — the largest, a cross-gable two-storey in
  // plaster with a hall wing and dormers.
  leader_house: makeHouse("leader_house", { boxes: [{ x0: 0, z0: 0, w: 11, d: 8, stories: 2, roof: "gable" }, { x0: 11, z0: 1, w: 5, d: 6, stories: 2, roof: "gable" }], wall: PLASTER_WHITE, door: { box: 0, side: "south" }, chimney: [1, 1], dormers: true, porch: true }),
  // A rectangular one-storey cottage.
  cottage_a: makeHouse("cottage_a", { boxes: [{ x0: 0, z0: 0, w: 7, d: 6, stories: 1, roof: "gable" }], door: { box: 0, side: "south" }, chimney: [1, 1], porch: true }),
  // A narrow jettied two-storey home.
  cottage_b: makeHouse("cottage_b", { boxes: [{ x0: 0, z0: 0, w: 5, d: 8, stories: 2, roof: "gable" }], door: { box: 0, side: "south" }, chimney: [1, 1], jetty: true }),
  // An L-shaped cottage with a little attached shed.
  cottage_c: makeHouse("cottage_c", { boxes: [{ x0: 0, z0: 0, w: 8, d: 6, stories: 1, roof: "gable" }, { x0: 8, z0: 1, w: 4, d: 4, stories: 1, roof: "lean", leanHigh: "west" }], door: { box: 0, side: "south" }, chimney: [1, 1] }),
  // The guard post — a stout little stone gatehouse at the village entrance.
  guard_post: makeHouse("guard_post", { boxes: [{ x0: 0, z0: 0, w: 5, d: 5, stories: 2, roof: "gable" }], wall: "terrain.stonebrick", door: { box: 0, side: "south" } }),
};

export const VILLAGE_HOUSE_IDS = Object.keys(VILLAGE_HOUSES);
