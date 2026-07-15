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
