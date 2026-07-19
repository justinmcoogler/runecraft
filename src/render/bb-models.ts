// Runtime for baked Blockbench/GeckoLib models (the dragons): builds a
// THREE bone hierarchy of box-UV cubes and samples keyframe animations.
// Blockbench units are Minecraft pixels — 16 px = 1 block — and Blockbench
// itself renders with three.js, so coordinates map across directly.

import * as THREE from "three";
import { DRAGONS_JSON } from "../content/dragons-data";
import { MOBS_JSON } from "../content/mob-models-data";
import { decodePngBase64 } from "../texturepacks/png";

interface BBCube {
  f: number[];
  t: number[];
  o: number[];
  r: number[] | null;
  /** Box-UV offset (classic layout) … */
  uv?: number[];
  /** … or explicit per-face UV rects ("free"-format models). */
  fuv?: Record<string, number[]>;
  inf: number;
}

interface BBBone {
  n: string;
  o: number[];
  r: number[] | null;
  cubes: string[];
  kids: BBBone[];
}

interface BBAnim {
  name: string;
  len: number;
  loop: boolean;
  bones: Record<string, { rot: number[][]; pos: number[][] }>;
}

interface BBModel {
  id: string;
  resW: number;
  resH: number;
  elements: Record<string, BBCube>;
  roots: BBBone[];
  anims: BBAnim[];
  tex: string | null;
}

const MODELS: Map<string, BBModel> = new Map(
  [
    ...(JSON.parse(DRAGONS_JSON).models as BBModel[]),
    // BetaSharp vanilla mob models (box-UV geometry) skinned with Faithful
    // entity textures — prefixed so they never clash with a dragon id.
    ...(JSON.parse(MOBS_JSON).models as BBModel[]).map((m) => ({ ...m, id: `mob.${m.id}` })),
  ].map((m) => [m.id, m]),
);

// ── Baked-data fixups ────────────────────────────────────────────────────
// The BetaSharp pig exports its snout with box-UV at (24,0) — an empty region
// of the Faithful pig texture, so alphaTest discarded the whole nose. The
// painted snout art lives at the vanilla texOffs (16,16) as a 4×3×1 region;
// stretch its rects over the model's 4×4×2 snout cube per face.
{
  const pig = MODELS.get("mob.pig");
  const snout = pig
    ? Object.values(pig.elements).find(
      (c) => c.uv?.[0] === 24 && c.uv?.[1] === 0 && c.t[0] - c.f[0] === 4 && c.t[2] - c.f[2] === 2,
    )
    : undefined;
  if (snout) {
    delete snout.uv;
    snout.fuv = {
      north: [17, 17, 21, 20], // nose front (nostrils)
      south: [22, 17, 26, 20],
      east: [16, 17, 17, 20],
      west: [21, 17, 22, 20],
      up: [17, 16, 21, 17],
      down: [21, 16, 25, 17],
    };
  }
}

export function bbModelIds(): string[] {
  return [...MODELS.keys()];
}

const P = 1 / 16;
const DEG = Math.PI / 180;
const textureCache = new Map<string, THREE.Texture>();

// The baked livestock sheets carry heavy per-pixel speckle; a small median
// pass inside opaque regions turns the static into clean chunky texels while
// keeping the layout (patches, blazes, eyes) exactly where the UVs expect.
const DENOISE_SKINS = new Set(["mob.cow", "mob.pig", "mob.sheep", "mob.squid"]);

function denoiseSkin(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  const B = 2;
  for (let y = 0; y < h; y += B) {
    for (let x = 0; x < w; x += B) {
      const px: Array<[number, number, number]> = [];
      for (let dy = 0; dy < B && y + dy < h; dy++) {
        for (let dx = 0; dx < B && x + dx < w; dx++) {
          const i = ((y + dy) * w + x + dx) * 4;
          if (d[i + 3] > 64) px.push([d[i], d[i + 1], d[i + 2]]);
        }
      }
      if (!px.length) continue;
      px.sort((a, b) => (a[0] * 3 + a[1] * 6 + a[2]) - (b[0] * 3 + b[1] * 6 + b[2]));
      const m = px[Math.floor(px.length / 2)];
      for (let dy = 0; dy < B && y + dy < h; dy++) {
        for (let dx = 0; dx < B && x + dx < w; dx++) {
          const i = ((y + dy) * w + x + dx) * 4;
          if (d[i + 3] > 64) { d[i] = m[0]; d[i + 1] = m[1]; d[i + 2] = m[2]; }
        }
      }
    }
  }
  ctx.putImageData(im, 0, 0);
}

/** Per-mob colour regrade after denoise — the baked sheets have the right
 *  layout but weak art direction (the cow is cream with brown spots instead
 *  of brown with white patches; the squid is washed grey). */
function gradeSkin(id: string, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const im = ctx.getImageData(0, 0, w, h);
  const d = im.data;
  const mix = (i: number, r: number, g: number, b: number, k: number) => {
    d[i] = d[i] + (r - d[i]) * k;
    d[i + 1] = d[i + 1] + (g - d[i + 1]) * k;
    d[i + 2] = d[i + 2] + (b - d[i + 2]) * k;
  };
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 64) continue;
    const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    if (id === "mob.cow") {
      // Swap the clusters: cream base becomes rich brown, brown patches
      // become white; true darks (nostrils, eyes, hooves) stay dark.
      if (lum > 0.62) { const v = lum / 0.85; mix(i, 116 * v, 78 * v, 48 * v, 1); }
      else if (lum > 0.24) { const v = Math.min(1, lum / 0.5 + 0.55); mix(i, 240 * v, 235 * v, 226 * v, 1); }
    } else if (id === "mob.pig") {
      // Unify toward a healthy pig pink, scaled by the sheet's own shading.
      const v = Math.min(1.15, lum / 0.62);
      if (lum > 0.2) mix(i, 238 * v, 164 * v, 158 * v, 0.72);
    } else if (id === "mob.sheep") {
      // Warm cream face/legs instead of grey.
      const v = Math.min(1.1, lum / 0.6);
      if (lum > 0.2) mix(i, 232 * v, 220 * v, 200 * v, 0.6);
    } else if (id === "mob.squid") {
      // Deep teal-blue body; keep the pale eye whites.
      if (lum < 0.72) { const v = Math.max(0.45, lum / 0.55); mix(i, 74 * v, 104 * v, 130 * v, 0.75); }
    }
  }
  ctx.putImageData(im, 0, 0);
}

function bbTexture(model: BBModel): THREE.Texture | null {
  if (!model.tex) return null;
  let t = textureCache.get(model.id);
  if (!t) {
    if (DENOISE_SKINS.has(model.id) && model.tex.startsWith("data:image/png;base64,")) {
      // Decode synchronously with the repo PNG codec: the async Image path
      // left an all-transparent canvas that alphaTest discarded wholesale.
      const png = decodePngBase64(model.tex.slice("data:image/png;base64,".length));
      const canvas = document.createElement("canvas");
      canvas.width = png ? png.width : model.resW || 64;
      canvas.height = png ? png.height : model.resH || 64;
      const ctx = canvas.getContext("2d")!;
      if (png) {
        ctx.putImageData(new ImageData(png.rgba, png.width, png.height), 0, 0);
        denoiseSkin(ctx, png.width, png.height);
        gradeSkin(model.id, ctx, png.width, png.height);
      }
      t = new THREE.CanvasTexture(canvas);
    } else {
      t = new THREE.TextureLoader().load(model.tex);
    }
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    textureCache.set(model.id, t);
  }
  return t;
}

/** Classic Minecraft box UV: faces unwrap around (u,v) by the cube's dims. */
function applyBoxUV(geo: THREE.BoxGeometry, u: number, v: number, w: number, h: number, d: number, W: number, Hh: number): void {
  // three.js face order: +x, -x, +y, -y, +z, -z
  const rects: Array<[number, number, number, number]> = [
    [u, v + d, d, h], // +x (right)
    [u + d + w, v + d, d, h], // -x (left)
    [u + d, v, w, d], // +y (top)
    [u + d + w, v, w, d], // -y (bottom)
    [u + d + w + d, v + d, w, h], // +z (back)
    [u + d, v + d, w, h], // -z (front)
  ];
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  rects.forEach(([x, y, rw, rh], face) => {
    const u0 = x / W;
    const u1 = (x + rw) / W;
    const vT = 1 - y / Hh;
    const vB = 1 - (y + rh) / Hh;
    const i = face * 4;
    uv.setXY(i, u1, vT);
    uv.setXY(i + 1, u0, vT);
    uv.setXY(i + 2, u1, vB);
    uv.setXY(i + 3, u0, vB);
  });
  uv.needsUpdate = true;
}

/** Explicit per-face UVs; Blockbench face names in three.js face order. */
function applyFaceUV(geo: THREE.BoxGeometry, fuv: Record<string, number[]>, W: number, Hh: number): void {
  const order = ["east", "west", "up", "down", "south", "north"];
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  order.forEach((face, i) => {
    const rect = fuv[face];
    if (!rect) return;
    const [x0, y0, x1, y1] = rect;
    const u0 = x0 / W;
    const u1 = x1 / W;
    const vT = 1 - y0 / Hh;
    const vB = 1 - y1 / Hh;
    const j = i * 4;
    uv.setXY(j, u0, vT);
    uv.setXY(j + 1, u1, vT);
    uv.setXY(j + 2, u0, vB);
    uv.setXY(j + 3, u1, vB);
  });
  uv.needsUpdate = true;
}

export interface BuiltBBModel {
  group: THREE.Group;
  animator: BBAnimator;
  materials: THREE.MeshLambertMaterial[];
  /** Model height in world units (for health bars). */
  height: number;
  /** Bone groups by name (+ their rest rotation), for procedural animation of
   *  models that carry no baked keyframes — legs/arms/wings swing off these. */
  bones: Map<string, { group: THREE.Group; baseRot: THREE.Euler }>;
}

/** Samples keyframe tracks and drives the bone groups. */
export class BBAnimator {
  private t = 0;
  private current: BBAnim | null = null;
  constructor(
    private model: BBModel,
    private bones: Map<string, { group: THREE.Group; baseRot: THREE.Euler; basePos: THREE.Vector3 }>,
  ) {}

  play(name: string): void {
    if (this.current?.name === name) return;
    this.current = this.model.anims.find((a) => a.name === name) ?? null;
    this.t = 0;
  }

  private sample(track: number[][], t: number): [number, number, number] {
    if (track.length === 0) return [0, 0, 0];
    if (t <= track[0][0]) return [track[0][1], track[0][2], track[0][3]];
    const last = track[track.length - 1];
    if (t >= last[0]) return [last[1], last[2], last[3]];
    for (let i = 0; i < track.length - 1; i++) {
      const a = track[i];
      const b = track[i + 1];
      if (t >= a[0] && t <= b[0]) {
        const f = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
        // Smoothstep between keys reads close enough to catmull-rom here.
        const s = f * f * (3 - 2 * f);
        return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s];
      }
    }
    return [last[1], last[2], last[3]];
  }

  update(dt: number): void {
    const anim = this.current;
    if (!anim) return;
    this.t += dt;
    const t = anim.loop ? this.t % anim.len : Math.min(this.t, anim.len);
    for (const [name, tracks] of Object.entries(anim.bones)) {
      const bone = this.bones.get(name);
      if (!bone) continue;
      const [rx, ry, rz] = this.sample(tracks.rot, t);
      // GeckoLib/bedrock convention: x and y rotations flip vs three.js.
      bone.group.rotation.set(
        bone.baseRot.x - rx * DEG,
        bone.baseRot.y - ry * DEG,
        bone.baseRot.z + rz * DEG,
      );
      if (tracks.pos.length) {
        const [px, py, pz] = this.sample(tracks.pos, t);
        bone.group.position.set(
          bone.basePos.x - px * P,
          bone.basePos.y + py * P,
          bone.basePos.z + pz * P,
        );
      }
    }
  }
}

/** Build a model instance: shared geometry is NOT used (bones own cubes). */
export function buildBBModel(id: string, textureOverride?: THREE.Texture): BuiltBBModel | null {
  const model = MODELS.get(id);
  if (!model) return null;
  const tex = textureOverride ?? bbTexture(model);
  const material = new THREE.MeshLambertMaterial(
    tex ? { map: tex, alphaTest: 0.05 } : { color: "#a04040" },
  );
  const materials = [material];
  const root = new THREE.Group();
  const boneMap = new Map<string, { group: THREE.Group; baseRot: THREE.Euler; basePos: THREE.Vector3 }>();
  let maxY = 1;

  const buildBone = (bone: BBBone, parent: THREE.Object3D, parentPivot: number[]): void => {
    const g = new THREE.Group();
    g.name = bone.n;
    g.position.set(
      (bone.o[0] - parentPivot[0]) * P,
      (bone.o[1] - parentPivot[1]) * P,
      (bone.o[2] - parentPivot[2]) * P,
    );
    g.rotation.order = "ZYX";
    if (bone.r) g.rotation.set(bone.r[0] * DEG, bone.r[1] * DEG, bone.r[2] * DEG);
    parent.add(g);
    boneMap.set(bone.n, { group: g, baseRot: g.rotation.clone(), basePos: g.position.clone() });

    for (const uuid of bone.cubes) {
      const c = model.elements[uuid];
      if (!c) continue;
      const w = c.t[0] - c.f[0];
      const h = c.t[1] - c.f[1];
      const d = c.t[2] - c.f[2];
      const geo = new THREE.BoxGeometry(
        (w + c.inf * 2) * P || 0.001,
        (h + c.inf * 2) * P || 0.001,
        (d + c.inf * 2) * P || 0.001,
      );
      if (c.fuv) applyFaceUV(geo, c.fuv, model.resW, model.resH);
      else applyBoxUV(geo, c.uv?.[0] ?? 0, c.uv?.[1] ?? 0, Math.round(w), Math.round(h), Math.round(d), model.resW, model.resH);
      const mesh = new THREE.Mesh(geo, material);
      const cx = (c.f[0] + c.t[0]) / 2;
      const cy = (c.f[1] + c.t[1]) / 2;
      const cz = (c.f[2] + c.t[2]) / 2;
      maxY = Math.max(maxY, c.t[1] * P);
      if (c.r) {
        // Rotated cubes pivot about their own origin.
        const holder = new THREE.Group();
        holder.position.set((c.o[0] - bone.o[0]) * P, (c.o[1] - bone.o[1]) * P, (c.o[2] - bone.o[2]) * P);
        holder.rotation.order = "ZYX";
        holder.rotation.set(c.r[0] * DEG, c.r[1] * DEG, c.r[2] * DEG);
        mesh.position.set((cx - c.o[0]) * P, (cy - c.o[1]) * P, (cz - c.o[2]) * P);
        holder.add(mesh);
        g.add(holder);
      } else {
        mesh.position.set((cx - bone.o[0]) * P, (cy - bone.o[1]) * P, (cz - bone.o[2]) * P);
        g.add(mesh);
      }
    }
    for (const kid of bone.kids) buildBone(kid, g, bone.o);
  };
  for (const bone of model.roots) buildBone(bone, root, [0, 0, 0]);

  const bones = new Map<string, { group: THREE.Group; baseRot: THREE.Euler }>();
  // BetaSharp models carry unnamed bones (n === undefined); those collapse to a
  // single anonymous group and can't be classified for procedural animation, so
  // skip them rather than crash on toLowerCase.
  for (const [name, b] of boneMap) {
    if (!name) continue;
    bones.set(name.toLowerCase(), { group: b.group, baseRot: b.baseRot });
  }
  return { group: root, animator: new BBAnimator(model, boneMap), materials, height: maxY, bones };
}
