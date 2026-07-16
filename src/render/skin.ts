// Minecraft-format character skins: the standard 64x64 (and legacy 64x32) skin
// layout mapped onto a blocky humanoid model. The game ships only original
// procedurally-drawn skins; users can import any skin PNG they own — imported
// skins are cosmetic only and never leave the device.

import * as THREE from "three";

export const SKIN_W = 64;
export const SKIN_H = 64;
/** World units per skin pixel (character stands ~1.8 units tall). */
export const PX = 1.8 / 32;

type Rect = [number, number, number, number]; // x, y, w, h in skin pixels

interface FaceRects {
  right: Rect;
  left: Rect;
  top: Rect;
  bottom: Rect;
  front: Rect;
  back: Rect;
}

/** Standard skin cross-layout for a box of size w*h*d with block origin (u,v). */
function blockRects(u: number, v: number, w: number, h: number, d: number): FaceRects {
  return {
    top: [u + d, v, w, d],
    bottom: [u + d + w, v, w, d],
    right: [u, v + d, d, h],
    front: [u + d, v + d, w, h],
    left: [u + d + w, v + d, d, h],
    back: [u + d + w + d, v + d, w, h],
  };
}

export interface PartSpec {
  name: "head" | "body" | "armR" | "armL" | "legR" | "legL";
  size: [number, number, number]; // w, h, d in px
  base: FaceRects;
  overlay: FaceRects;
  /** Pivot point in px, in character space (feet at y=0, +x = character's right). */
  pivot: [number, number, number];
  /** Box-center offset from the pivot, in px. */
  centerOffset: [number, number, number];
}

export function partSpecs(slim: boolean): PartSpec[] {
  const armW = slim ? 3 : 4;
  return [
    {
      name: "head",
      size: [8, 8, 8],
      base: blockRects(0, 0, 8, 8, 8),
      overlay: blockRects(32, 0, 8, 8, 8),
      pivot: [0, 24, 0],
      centerOffset: [0, 4, 0],
    },
    {
      name: "body",
      size: [8, 12, 4],
      base: blockRects(16, 16, 8, 12, 4),
      overlay: blockRects(16, 32, 8, 12, 4),
      pivot: [0, 18, 0],
      centerOffset: [0, 0, 0],
    },
    {
      name: "armR",
      size: [armW, 12, 4],
      base: blockRects(40, 16, armW, 12, 4),
      overlay: blockRects(40, 32, armW, 12, 4),
      pivot: [4 + armW / 2, 23, 0],
      centerOffset: [0, -5, 0],
    },
    {
      name: "armL",
      size: [armW, 12, 4],
      base: blockRects(32, 48, armW, 12, 4),
      overlay: blockRects(48, 48, armW, 12, 4),
      pivot: [-(4 + armW / 2), 23, 0],
      centerOffset: [0, -5, 0],
    },
    {
      name: "legR",
      size: [4, 12, 4],
      base: blockRects(0, 16, 4, 12, 4),
      overlay: blockRects(0, 32, 4, 12, 4),
      pivot: [2, 12, 0],
      centerOffset: [0, -6, 0],
    },
    {
      name: "legL",
      size: [4, 12, 4],
      base: blockRects(16, 48, 4, 12, 4),
      overlay: blockRects(0, 48, 4, 12, 4),
      pivot: [-2, 12, 0],
      centerOffset: [0, -6, 0],
    },
  ];
}

/**
 * Apply per-face skin UVs to a BoxGeometry. three.js face order: +x, -x, +y, -y, +z, -z.
 * Model faces -Z, so: +x = character's right face, -z = front, +z = back.
 */
export function applyBoxUVs(geometry: THREE.BoxGeometry, rects: FaceRects): void {
  const order: Rect[] = [rects.right, rects.left, rects.top, rects.bottom, rects.back, rects.front];
  const uv = geometry.getAttribute("uv") as THREE.BufferAttribute;
  order.forEach(([x, y, w, h], face) => {
    const u0 = x / SKIN_W;
    const u1 = (x + w) / SKIN_W;
    const vTop = 1 - y / SKIN_H;
    const vBot = 1 - (y + h) / SKIN_H;
    const i = face * 4;
    // Mirror horizontally so front/back textures read correctly on the -Z-facing model.
    uv.setXY(i, u1, vTop);
    uv.setXY(i + 1, u0, vTop);
    uv.setXY(i + 2, u1, vBot);
    uv.setXY(i + 3, u0, vBot);
  });
  uv.needsUpdate = true;
}

// ---------- skin image handling ----------

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Copy a face rect horizontally mirrored (used when synthesising left limbs on legacy skins). */
function copyFlipped(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sx: number,
  sy: number,
  w: number,
  h: number,
  dx: number,
  dy: number,
): void {
  ctx.save();
  ctx.translate(dx + w, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(src, sx, sy, w, h, 0, 0, w, h);
  ctx.restore();
}

/** Mirror a whole limb block (w=4,h=12,d=4) from origin (u,v) to (U,V), swapping right/left faces. */
function mirrorLimbBlock(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  u: number,
  v: number,
  U: number,
  V: number,
): void {
  copyFlipped(ctx, src, u + 4, v, 4, 4, U + 4, V); // top
  copyFlipped(ctx, src, u + 8, v, 4, 4, U + 8, V); // bottom
  copyFlipped(ctx, src, u + 4, v + 4, 4, 12, U + 4, V + 4); // front
  copyFlipped(ctx, src, u + 12, v + 4, 4, 12, U + 12, V + 4); // back
  copyFlipped(ctx, src, u, v + 4, 4, 12, U + 8, V + 4); // right -> left
  copyFlipped(ctx, src, u + 8, v + 4, 4, 12, U, V + 4); // left -> right
}

export interface LoadedSkin {
  canvas: HTMLCanvasElement;
  slim: boolean;
}

/**
 * Normalise a skin image to the modern 64x64 layout. Legacy 64x32 skins get
 * mirrored left limbs. Throws on unsupported dimensions.
 */
export function normalizeSkin(img: HTMLImageElement | HTMLCanvasElement): LoadedSkin {
  const w = img.width;
  const h = img.height;
  if (w !== 64 || (h !== 64 && h !== 32)) {
    throw new Error(`Unsupported skin size ${w}x${h} — expected 64x64 or 64x32.`);
  }
  const [canvas, ctx] = makeCanvas(SKIN_W, SKIN_H);
  ctx.drawImage(img, 0, 0);
  if (h === 32) {
    mirrorLimbBlock(ctx, img, 0, 16, 16, 48); // right leg -> left leg
    mirrorLimbBlock(ctx, img, 40, 16, 32, 48); // right arm -> left arm
  }
  // Slim-arm (3px) detection: the strip x=52..55, y=20..31 is unused by slim skins.
  const probe = ctx.getImageData(54, 20, 2, 12).data;
  let empty = true;
  for (let i = 3; i < probe.length; i += 4) {
    if (probe[i] !== 0) {
      empty = false;
      break;
    }
  }
  return { canvas, slim: empty && h === 64 };
}

export function skinTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- built-in original skins ----------

function fillBlock(
  ctx: CanvasRenderingContext2D,
  u: number,
  v: number,
  w: number,
  h: number,
  d: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(u + d, v, w * 2, d); // top + bottom row
  ctx.fillRect(u, v + d, d + w + d + w, h); // right, front, left, back strip
}

function speckle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  density: number,
  seed: number,
): void {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  ctx.fillStyle = color;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if (rand() < density) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  }
}

/** Original default hero: rust tunic, olive trousers, dark hair. Deliberately not any existing character. */
export function defaultHeroSkin(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(SKIN_W, SKIN_H);
  const skinTone = "#d9a578";
  const hair = "#3b2a1a";
  const tunic = "#a8502e";
  const tunicDark = "#8c3f22";
  const trousers = "#5c6132";
  const boots = "#38302a";

  // Head: skin, hair on top/back and a fringe.
  fillBlock(ctx, 0, 0, 8, 8, 8, skinTone);
  ctx.fillStyle = hair;
  ctx.fillRect(8, 0, 16, 8); // top + bottom row area (top gets hair; bottom overwritten below)
  ctx.fillStyle = skinTone;
  ctx.fillRect(16, 0, 8, 8); // bottom of head back to skin
  ctx.fillStyle = hair;
  ctx.fillRect(0, 8, 8, 3); // right side top rows
  ctx.fillRect(16, 8, 8, 3); // left side top rows
  ctx.fillRect(24, 8, 8, 8); // back full
  ctx.fillRect(8, 8, 8, 2); // fringe
  // Face: symmetric eyes + mouth.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(9, 12, 2, 1);
  ctx.fillRect(13, 12, 2, 1);
  ctx.fillStyle = "#4a6c8c";
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(13, 12, 1, 1);
  ctx.fillStyle = "#b07a52";
  ctx.fillRect(11, 14, 2, 1);

  // Body: tunic with belt.
  fillBlock(ctx, 16, 16, 8, 12, 4, tunic);
  speckle(ctx, 16, 20, 24, 8, tunicDark, 0.12, 11);
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(16, 26, 24, 2); // belt band across right/front/left
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(23, 26, 2, 2); // buckle

  // Arms: sleeves on the upper half, skin below.
  for (const [u, v] of [
    [40, 16],
    [32, 48],
  ] as Array<[number, number]>) {
    fillBlock(ctx, u, v, 4, 12, 4, skinTone);
    ctx.fillStyle = tunic;
    ctx.fillRect(u, v + 4, 16, 5);
    ctx.fillRect(u + 4, v, 8, 4); // shoulder top/bottom
  }

  // Legs: trousers + boots.
  for (const [u, v] of [
    [0, 16],
    [16, 48],
  ] as Array<[number, number]>) {
    fillBlock(ctx, u, v, 4, 12, 4, trousers);
    ctx.fillStyle = boots;
    ctx.fillRect(u, v + 4 + 9, 16, 3);
  }
  return canvas;
}

/** Original townsfolk skins: simple tunic + hair, palette per villager. */
export function villagerSkin(variant: number): HTMLCanvasElement {
  const palettes = [
    { skin: "#c99b73", hair: "#7a4a2a", tunic: "#3f7d8c", tunicDark: "#356a77", apron: "#d9c9a8" }, // storekeeper
    { skin: "#b8845c", hair: "#d9b45a", tunic: "#4a6b9a", tunicDark: "#3d5a82", apron: null }, // fisher
    { skin: "#d8a97e", hair: "#3a2e28", tunic: "#8c4a6b", tunicDark: "#773d5a", apron: null }, // villager
  ];
  const pal = palettes[Math.abs(variant) % palettes.length];
  const [canvas, ctx] = makeCanvas(SKIN_W, SKIN_H);

  fillBlock(ctx, 0, 0, 8, 8, 8, pal.skin);
  // Hair: top, back, and a fringe.
  ctx.fillStyle = pal.hair;
  ctx.fillRect(8, 0, 8, 8); // top
  ctx.fillRect(24, 8, 8, 8); // back
  ctx.fillRect(0, 8, 8, 4); // sides upper
  ctx.fillRect(16, 8, 8, 4);
  ctx.fillRect(8, 8, 8, 2); // fringe
  // Face.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(9, 12, 2, 1);
  ctx.fillRect(13, 12, 2, 1);
  ctx.fillStyle = "#38302a";
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(13, 12, 1, 1);
  ctx.fillStyle = "#a86a5a";
  ctx.fillRect(11, 14, 2, 1); // mouth

  // Torso tunic (+ apron for the storekeeper).
  fillBlock(ctx, 16, 16, 8, 12, 4, pal.tunic);
  speckle(ctx, 16, 20, 24, 8, pal.tunicDark, 0.12, 31 + variant);
  if (pal.apron) {
    ctx.fillStyle = pal.apron;
    ctx.fillRect(21, 24, 6, 7); // front apron panel
  }

  // Arms: tunic sleeves, bare hands.
  for (const [u, v] of [
    [40, 16],
    [32, 48],
  ] as Array<[number, number]>) {
    fillBlock(ctx, u, v, 4, 12, 4, pal.tunic);
    ctx.fillStyle = pal.skin;
    ctx.fillRect(u, v + 4 + 9, 16, 3);
  }
  // Legs: trousers + boots.
  for (const [u, v] of [
    [0, 16],
    [16, 48],
  ] as Array<[number, number]>) {
    fillBlock(ctx, u, v, 4, 12, 4, pal.tunicDark);
    ctx.fillStyle = "#38302a";
    ctx.fillRect(u, v + 4 + 10, 16, 2);
  }
  return canvas;
}

// ---------- tutorial tutor skins ----------
// The tutorial island's skill tutors each look the part — a smith in a leather
// apron, a ranger in a green hood, a mage in a starred robe — instead of the
// generic townsfolk skin. One parameterised drawer covers them all; the
// TUTOR_PALETTES table gives every tutor its own colours and headgear.

export interface TutorPalette {
  skin: string;
  hair: string;
  /** Tunic / robe body colour. */
  top: string;
  topDark: string;
  legs: string;
  boots: string;
  /** Head covered by a hood in the `top` colour (mages, rangers, monks). */
  hood?: boolean;
  /** A cap/helmet/brim colour drawn over the head (hats, hard hats, straw). */
  hat?: string;
  /** Front torso panel — an apron, tabard or emblem. */
  accent?: string;
  /** Bare skin-toned arms (the strongman) instead of sleeves. */
  bareArms?: boolean;
}

export const TUTOR_PALETTES: Record<string, TutorPalette> = {
  lumberjack: { skin: "#d8a97e", hair: "#4a2f1a", top: "#3f6b3a", topDark: "#2f5230", legs: "#5a4632", boots: "#38302a", accent: "#a8402e" },
  miner: { skin: "#c99b73", hair: "#3a2e28", top: "#5a4a38", topDark: "#463a2c", legs: "#454049", boots: "#2f2b28", hat: "#e0b53a", accent: "#7a6a4a" },
  forager: { skin: "#c99b73", hair: "#5a4028", top: "#6a8a4a", topDark: "#517038", legs: "#4a5a30", boots: "#38302a", hood: true, accent: "#c8d98a" },
  angler: { skin: "#d8a97e", hair: "#c9a24a", top: "#3f6d9a", topDark: "#335a82", legs: "#3a4652", boots: "#2f2b28", hat: "#c8a24a", accent: "#d9c9a8" },
  cook: { skin: "#d8a97e", hair: "#4a3a2a", top: "#e8e2d4", topDark: "#cfc6b4", legs: "#8a4a4a", boots: "#38302a", hat: "#f2efe6", accent: "#cfc6b4" },
  smith: { skin: "#c98f63", hair: "#2a2420", top: "#6a5238", topDark: "#4a3a28", legs: "#454049", boots: "#2f2b28", accent: "#33302c" },
  smelter: { skin: "#c98f63", hair: "#33302c", top: "#4a4038", topDark: "#38302a", legs: "#3a3630", boots: "#2f2b28", accent: "#a8502e" },
  warrior: { skin: "#d8a97e", hair: "#3a2e28", top: "#8a3a34", topDark: "#6a2a26", legs: "#454049", boots: "#33302c", accent: "#b0b4bc" },
  strongarm: { skin: "#cd9a6e", hair: "#3a2e28", top: "#7a4630", topDark: "#5e3524", legs: "#454049", boots: "#33302c", bareArms: true, accent: "#b0b4bc" },
  guardian: { skin: "#d8a97e", hair: "#4a3a2a", top: "#3f5a8c", topDark: "#324875", legs: "#3a3f47", boots: "#33302c", accent: "#c0c4cc" },
  healer: { skin: "#d8a97e", hair: "#8a6a4a", top: "#ece4d6", topDark: "#d6ccbc", legs: "#c8bca8", boots: "#8a7a5a", hood: true, accent: "#b23a3a" },
  farmer: { skin: "#cd9a6e", hair: "#7a5a2a", top: "#6a8a4a", topDark: "#517038", legs: "#3f6d9a", boots: "#5a4632", hat: "#d8c058", accent: "#3f6d9a" },
  herbalist: { skin: "#c99b73", hair: "#5a4028", top: "#4e6b3a", topDark: "#3d552c", legs: "#3f4a2c", boots: "#38302a", hood: true, accent: "#9ec46a" },
  crafter: { skin: "#d8a97e", hair: "#4a3a2a", top: "#8a6a44", topDark: "#6a4f34", legs: "#5a4632", boots: "#38302a", accent: "#cabf9a" },
  scholar: { skin: "#d8a97e", hair: "#b8b4ac", top: "#7a5a3a", topDark: "#5e442a", legs: "#4a3a2a", boots: "#38302a", accent: "#cabf9a" },
  ranger: { skin: "#cd9a6e", hair: "#4a3a2a", top: "#3f6b3a", topDark: "#2f5230", legs: "#5a4632", boots: "#38302a", hood: true, accent: "#8a6f4a" },
  builder: { skin: "#cd9a6e", hair: "#3a2e28", top: "#c8781f", topDark: "#a5641a", legs: "#454049", boots: "#33302c", hat: "#e0b53a", accent: "#b0b4bc" },
  brewer: { skin: "#d8a97e", hair: "#7a4a2a", top: "#7a4630", topDark: "#5e3524", legs: "#4a3a2a", boots: "#38302a", hat: "#8a6f4a", accent: "#d9c9a8" },
  enchanter: { skin: "#d8a97e", hair: "#6a4a8c", top: "#6a4a8c", topDark: "#52396e", legs: "#3a3050", boots: "#2f2b38", hood: true, accent: "#c9a227" },
  hunter: { skin: "#cd9a6e", hair: "#4a3a2a", top: "#5a4632", topDark: "#463424", legs: "#3f4a2c", boots: "#38302a", hood: true, accent: "#8a6f4a" },
  rogue: { skin: "#c99b73", hair: "#2a2420", top: "#2f3038", topDark: "#242530", legs: "#33302c", boots: "#1f1d22", hood: true, accent: "#4a4c52" },
  freerunner: { skin: "#cd9a6e", hair: "#2a2420", top: "#4aa3a0", topDark: "#38817e", legs: "#2f3038", boots: "#1f1d22", accent: "#d8e058" },
  slayer: { skin: "#c98f63", hair: "#2a2420", top: "#3a3630", topDark: "#2a2724", legs: "#33302c", boots: "#1f1d22", hood: true, accent: "#7a2a2a" },
  sailor: { skin: "#d8a97e", hair: "#3a2e28", top: "#26406a", topDark: "#1d3252", legs: "#33302c", boots: "#2f2b28", hat: "#ece4d6", accent: "#ece4d6" },
  firewarden: { skin: "#d8a97e", hair: "#8a3a1f", top: "#b23a1f", topDark: "#8c2c16", legs: "#4a3a2a", boots: "#38302a", accent: "#f2a03a" },
  priest: { skin: "#d8a97e", hair: "#b8b4ac", top: "#ece4d6", topDark: "#d6ccbc", legs: "#c8bca8", boots: "#8a7a5a", hood: true, accent: "#c9a227" },
  mage: { skin: "#d8a97e", hair: "#5a5a7a", top: "#3a4a8c", topDark: "#2d3a70", legs: "#2f3050", boots: "#2f2b38", hood: true, accent: "#c9a227" },
  runemaster: { skin: "#d8a97e", hair: "#5a5a7a", top: "#5a4a8c", topDark: "#46396e", legs: "#2f3050", boots: "#2f2b38", hood: true, accent: "#6ac0d0" },
  fletcher: { skin: "#cd9a6e", hair: "#5a4028", top: "#5a7a3a", topDark: "#46612c", legs: "#5a4632", boots: "#38302a", accent: "#8a6f4a" },
  delver: { skin: "#c99b73", hair: "#3a2e28", top: "#6a5238", topDark: "#4a3a28", legs: "#454049", boots: "#2f2b28", hat: "#c8a24a", accent: "#e0b53a" },
  summoner: { skin: "#d8a97e", hair: "#3a6a5a", top: "#2f7a6a", topDark: "#245f52", legs: "#2f4a44", boots: "#2f2b38", hood: true, accent: "#9ec46a" },
  necromancer: { skin: "#cbb8a0", hair: "#2a2730", top: "#2a2730", topDark: "#1d1b24", legs: "#242530", boots: "#1a181f", hood: true, accent: "#6a8a4a" },
  inventor: { skin: "#d8a97e", hair: "#7a5a3a", top: "#7a5a3a", topDark: "#5e442a", legs: "#454049", boots: "#33302c", hat: "#b0b4bc", accent: "#c9a227" },
  guide: { skin: "#d8a97e", hair: "#4a3a2a", top: "#4a6b3a", topDark: "#3a552c", legs: "#4a3a2a", boots: "#38302a", accent: "#c9a227" },
  gatekeeper: { skin: "#c98f63", hair: "#b8b4ac", top: "#3f5a8c", topDark: "#324875", legs: "#3a3f47", boots: "#33302c", accent: "#c9a227" },
};

/** Draw a parameterised tutor skin (falls back to a plain villager look). */
export function tutorSkin(name: string): HTMLCanvasElement {
  const pal = TUTOR_PALETTES[name];
  if (!pal) return villagerSkin(Math.abs(hashName(name)) % 3);
  const [canvas, ctx] = makeCanvas(SKIN_W, SKIN_H);

  fillBlock(ctx, 0, 0, 8, 8, 8, pal.skin);
  // Head covering: a hood in the robe colour, or hair.
  if (pal.hood) {
    ctx.fillStyle = pal.top;
    ctx.fillRect(8, 0, 8, 8);
    ctx.fillRect(24, 8, 8, 8);
    ctx.fillRect(0, 8, 8, 4);
    ctx.fillRect(16, 8, 8, 4);
    ctx.fillRect(8, 8, 8, 2);
  } else {
    ctx.fillStyle = pal.hair;
    ctx.fillRect(8, 0, 8, 8);
    ctx.fillRect(24, 8, 8, 8);
    ctx.fillRect(0, 8, 8, 3);
    ctx.fillRect(16, 8, 8, 3);
    ctx.fillRect(8, 8, 8, 2);
  }
  // Hat / helmet / brim over the crown.
  if (pal.hat) {
    ctx.fillStyle = pal.hat;
    ctx.fillRect(8, 0, 8, 8); // crown
    ctx.fillRect(0, 8, 24, 2); // brim band around the sides + front + back
  }
  // Face.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(9, 12, 2, 1);
  ctx.fillRect(13, 12, 2, 1);
  ctx.fillStyle = "#38302a";
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(13, 12, 1, 1);
  ctx.fillStyle = "#a86a5a";
  ctx.fillRect(11, 14, 2, 1);

  // Torso + a front panel (apron / tabard / emblem).
  fillBlock(ctx, 16, 16, 8, 12, 4, pal.top);
  speckle(ctx, 16, 20, 24, 8, pal.topDark, 0.12, 47);
  if (pal.accent) {
    ctx.fillStyle = pal.accent;
    ctx.fillRect(21, 24, 6, 7);
  }
  // Arms: sleeves (or bare skin), bare hands.
  for (const [u, v] of [
    [40, 16],
    [32, 48],
  ] as Array<[number, number]>) {
    fillBlock(ctx, u, v, 4, 12, 4, pal.bareArms ? pal.skin : pal.top);
    ctx.fillStyle = pal.skin;
    ctx.fillRect(u, v + 4 + 9, 16, 3);
  }
  // Legs + boots.
  for (const [u, v] of [
    [0, 16],
    [16, 48],
  ] as Array<[number, number]>) {
    fillBlock(ctx, u, v, 4, 12, 4, pal.legs);
    ctx.fillStyle = pal.boots;
    ctx.fillRect(u, v + 4 + 10, 16, 2);
  }
  return canvas;
}

function hashName(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Original NPC: the Grove Warden — moss-green hooded robe, grey beard. */
export function wardenSkin(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(SKIN_W, SKIN_H);
  const skinTone = "#c99b73";
  const robe = "#4e6b3a";
  const robeDark = "#3d552c";
  const beard = "#b8b4ac";

  fillBlock(ctx, 0, 0, 8, 8, 8, skinTone);
  // Hood covers top, back, and upper sides/front.
  ctx.fillStyle = robe;
  ctx.fillRect(8, 0, 8, 8); // top
  ctx.fillRect(24, 8, 8, 8); // back
  ctx.fillRect(0, 8, 8, 3);
  ctx.fillRect(16, 8, 8, 3);
  ctx.fillRect(8, 8, 8, 2);
  // Face + beard.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(9, 12, 2, 1);
  ctx.fillRect(13, 12, 2, 1);
  ctx.fillStyle = "#54452f";
  ctx.fillRect(10, 12, 1, 1);
  ctx.fillRect(13, 12, 1, 1);
  ctx.fillStyle = beard;
  ctx.fillRect(9, 14, 6, 2);

  fillBlock(ctx, 16, 16, 8, 12, 4, robe);
  speckle(ctx, 16, 20, 24, 8, robeDark, 0.15, 29);
  ctx.fillStyle = "#c9a227";
  ctx.fillRect(23, 24, 2, 1); // clasp

  for (const [u, v] of [
    [40, 16],
    [32, 48],
  ] as Array<[number, number]>) {
    fillBlock(ctx, u, v, 4, 12, 4, robe);
    ctx.fillStyle = skinTone;
    ctx.fillRect(u, v + 4 + 9, 16, 3); // hands
  }
  for (const [u, v] of [
    [0, 16],
    [16, 48],
  ] as Array<[number, number]>) {
    fillBlock(ctx, u, v, 4, 12, 4, robeDark);
    ctx.fillStyle = "#38302a";
    ctx.fillRect(u, v + 4 + 10, 16, 2);
  }
  return canvas;
}
