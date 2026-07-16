// Presentation layer: three.js scene built from sim state, updated by SimEvents.
// Nothing here is authoritative — it can be rebuilt from the simulation at any time.

import * as THREE from "three";
import { blockBase, blockShape, blockTint, isTranslucent, sideTile, surfaceOffset, topTile } from "../content/blocks";
import { ENEMIES, NODES, OBJECTS, type EnemyViewKind, type NodeViewKind } from "../content/content";
import { getStructure } from "../content/structures";
import type { StructureAsset, StructureBlock } from "../structures/types";
import { effectiveSink, groundFloorTop } from "../structures/types";
import type { GameSimulation } from "../sim/simulation";
import type { SimEvent, Cell } from "../sim/types";
import { findPath } from "../sim/pathfinding";
import { activeQuestTarget } from "../ui/quest-helper";
import type { BlockType, ObjectPlacement as ObjectPlacementView } from "../sim/world";
import { CameraRig } from "./camera";
import { CharacterView, type CharacterPose } from "./character";
import { ParticleBursts } from "./particles";
import { addPeepHole, peepUniforms } from "./peephole";
import { defaultHeroSkin, normalizeSkin, tutorSkin, villagerSkin, wardenSkin, PX, type LoadedSkin } from "./skin";
import { MaterialResolver, type EntitySkin } from "./textures";
import { TREES_BY_SPECIES, hash01, pickTreeModel, treeGeometry } from "./tree-models";
import { ROCK_MATERIAL_TILES, ROCK_MATERIAL_TINTS, ROCK_MODELS_ALL, pickBoulderModel, pickMiningRock, rockGeometry } from "./rock-models";
import { buildBBModel } from "./bb-models";
import { isModelEnabled } from "./model-prefs";
import { itemIconUrl } from "../ui/icons";

// Lower ambient relative to sun so faces facing away from the sun read as
// shaded — that gap is what gives blocks their sense of depth. The colours
// below (warm sun, cool sky-fill) are applied to the lights themselves.
const DEFAULT_THEME = { sky: "#8fc4e8", sun: 1.65, ambient: 0.72 };
const SUN_COLOR = 0xfff1d4; // warm midday sunlight
const SKY_FILL_COLOR = 0x9fb8d8; // cool ambient bounce from the sky

/** Animatable parts of an enemy rig (all children of `body` for lunging). */
interface EnemyAnim {
  body: THREE.Group;
  legs: THREE.Object3D[];
  head: THREE.Object3D | null;
  headRestZ: number;
  segments: THREE.Object3D[];
  walkPhase: number;
  lungeT: number;
  /** Keyframe-animated Blockbench model (dragons) — replaces rig anims. */
  bb?: import("./bb-models").BBAnimator;
  /** Flapping wing bones (bee, bat, allay, ghast, parrot…) on baked mob models
   *  that carry no keyframes: each flaps about its rest z by a mirrored sign. */
  wings?: Array<{ obj: THREE.Object3D; base: number; sign: number }>;
  /** A ground bird (chicken): wings stay tucked and only flutter — gently at
   *  rest, harder when it scurries — instead of the constant hover-flap. */
  groundBird?: boolean;
  /** Slow idle sway for limbless dangly bits (warden tendrils, tails, spines):
   *  a gentle rock about the rest x/z, always on, so the boss never freezes. */
  sway?: Array<{ obj: THREE.Object3D; baseX: number; baseZ: number; sign: number }>;
}

const WATER_SURFACE_Y = -0.35;

// World streaming: terrain builds in CHUNK-sized tiles around the player and
// entity visuals build inside ENTITY_RADIUS; both retire as the player moves
// on. The simulation always holds the whole region — streaming is purely a
// presentation window onto it.
const CHUNK = 50;
// Radius 3 keeps a 7x7 ring of 50-cell chunks resident (350x350 cells) so
// zoomed-out and fast-travelling views rarely see terrain pop-in; entity
// visuals follow inside a slightly tighter circle. Chunk meshes are merged
// geometry, so the extra ring costs draw calls roughly 2x radius-2 — fine
// on desktop, and distant chunks fade via the same occlusion alpha.
const TERRAIN_CHUNK_RADIUS = 3;
// Entities render out to roughly the terrain edge (3 chunks ≈ 150 cells).
// Beyond that they're too small to matter and just cost draw calls.
const ENTITY_RADIUS = 150;
/** Small ground cover (grass/flower sprites) renders only this close — a full
 *  ENTITY_RADIUS of tufts is thousands of needless draw calls. */
const DETAIL_RADIUS = 60;
const DETAIL_DEFS = new Set(["object.grass.tuft", "object.flowers.wild"]);
/** New entity visuals built per frame, so first load streams in smoothly. */
const STREAM_ADD_BUDGET = 24;

interface NodeView {
  instanceId: string;
  kind: NodeViewKind;
  cell: Cell;
  baseY: number;
  baseScale: number;
  activeGroup: THREE.Group;
  depletedMesh: THREE.Object3D;
  fadeMaterials: THREE.MeshLambertMaterial[];
  shakeT: number;
  animPhase: number;
}


const HELD_SPRITES: Record<string, string> = {
  "tool.axe.basic": "sprite.item.axe",
  "tool.axe.copper": "sprite.item.axe",
  "tool.pickaxe.basic": "sprite.item.pickaxe",
  "tool.pickaxe.copper": "sprite.item.pickaxe",
  "tool.fishingrod.basic": "sprite.item.rod",
  "tool.sword.copper": "sprite.item.sword",
  "tool.sword.bronze": "sprite.item.sword",
  "tool.sword.iron": "sprite.item.sword",
  "tool.axe.bronze": "sprite.item.axe",
  "tool.axe.iron": "sprite.item.axe",
  "tool.pickaxe.bronze": "sprite.item.pickaxe",
  "tool.pickaxe.iron": "sprite.item.pickaxe",
  "tool.hammer.basic": "sprite.item.hammer",
  "tool.sword.runed": "sprite.item.sword",
  "tool.axe.runed": "sprite.item.axe",
  "tool.pickaxe.runed": "sprite.item.pickaxe",
};

let blobTexture: THREE.CanvasTexture | null = null;

/** Soft radial-gradient disc used to ground characters and objects. */

/**
 * Which pack entity texture skins each enemy. Variants sharing one texture
 * keep their def tint as a color multiply; original creatures (constructs,
 * the archery dummy) have no vanilla-layout equivalent and stay painted.
 */
const ENEMY_SKINS: Record<string, { key: string; wool?: string; tinted?: boolean }> = {
  "enemy.cow": { key: "entity.cow" },
  "enemy.pig": { key: "entity.pig" },
  "enemy.chicken": { key: "entity.chicken" },
  "enemy.sheep": { key: "entity.sheep.skin", wool: "entity.sheep.wool" },
  "enemy.spider": { key: "entity.spider" },
  "enemy.cave_spider": { key: "entity.cave_spider" },
  "enemy.old_gnasher": { key: "entity.cave_spider" },
  "enemy.timber_wolf": { key: "entity.wolf" },
  "enemy.frost_wolf": { key: "entity.wolf", tinted: true },
  "enemy.bog_slime": { key: "entity.slime" },
  "enemy.silt_king": { key: "entity.slime", tinted: true },
  "enemy.mire_husk": { key: "entity.zombie" },
  "enemy.dune_husk": { key: "entity.husk" },
  "enemy.grave_shambler": { key: "entity.zombie", tinted: true },
  "enemy.hollow_wight": { key: "entity.zombie", tinted: true },
  "enemy.dire_wolf": { key: "entity.wolf", tinted: true },
  "enemy.gloom_spinner": { key: "entity.cave_spider", tinted: true },
  "enemy.blight_slime": { key: "entity.slime", tinted: true },
  "enemy.spore_shambler": { key: "entity.zombie", tinted: true },
  "enemy.dust_scuttler": { key: "entity.spider", tinted: true },
  "enemy.vine_stalker": { key: "entity.spider", tinted: true },
};

/** An entity skin bound to one rig: shared material + texture scale. */
interface RigSkin {
  material: THREE.MeshLambertMaterial;
  width: number;
  height: number;
  /** pixels per base pixel (classic entity layouts are 64 base px wide) */
  k: number;
}

/**
 * Map a classic Minecraft-entity box UV layout (origin u,v; box w*h*d in
 * base pixels) onto a three.js BoxGeometry. Face order and orientation
 * follow the java model format: [side | front | side | back] strips under
 * [top | bottom], tops rotated 180° relative to three.js plane layout.
 */
function setEntityUVs(
  geo: THREE.BoxGeometry,
  skin: RigSkin,
  u: number,
  v: number,
  w: number,
  h: number,
  d: number,
): void {
  const faces: Array<[number, number, number, number, boolean]> = [
    [u + d + w, v + d, d, h, false], // +x
    [u, v + d, d, h, false], // -x
    [u + d, v, w, d, true], // +y
    [u + d + w, v, w, d, false], // -y
    [u + 2 * d + w, v + d, w, h, false], // +z (back)
    [u + d, v + d, w, h, false], // -z (front)
  ];
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  faces.forEach(([x, y, fw, fh, rotate], face) => {
    const u0 = (x * skin.k) / skin.width;
    const u1 = ((x + fw) * skin.k) / skin.width;
    const v1 = 1 - (y * skin.k) / skin.height;
    const v0 = 1 - ((y + fh) * skin.k) / skin.height;
    const quad = rotate
      ? [[u1, v0], [u0, v0], [u1, v1], [u0, v1]]
      : [[u0, v1], [u1, v1], [u0, v0], [u1, v0]];
    quad.forEach(([qu, qv], i) => uv.setXY(face * 4 + i, qu, qv));
  });
  uv.needsUpdate = true;
}

function makeBlobShadow(radius: number): THREE.Mesh {
  if (!blobTexture) {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,0.4)");
    g.addColorStop(0.7, "rgba(0,0,0,0.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    blobTexture = new THREE.CanvasTexture(c);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.renderOrder = 1;
  return mesh;
}

export type PickResult =
  | { kind: "entity"; instanceId: string }
  | { kind: "ground"; cell: Cell }
  | null;

/** A baked mob-model rendered as a walking NPC (villager, trader, iron golem).
 *  Satisfies the same tiny interface the NPC frame loop uses as CharacterView —
 *  a group, update(dt, pose), dispose() — so the two are interchangeable. Faces
 *  with the body; no limb animation (the models carry no keyframes yet). */
class NpcModelView {
  readonly group = new THREE.Group();
  private readonly legs: THREE.Object3D[];
  private phase = 0;
  constructor(
    modelGroup: THREE.Group,
    private readonly materials: THREE.Material[],
    bones?: Map<string, { group: THREE.Group; baseRot: THREE.Euler }>,
  ) {
    this.group.add(modelGroup);
    this.legs = [];
    if (bones) {
      for (const [name, b] of bones) {
        if (/leg|arm|limb/.test(name)) this.legs.push(b.group);
      }
    }
  }
  update(dt: number, pose: CharacterPose): void {
    this.group.position.set(pose.x, pose.targetY, pose.z);
    this.group.rotation.y = pose.facing + Math.PI;
    if (pose.moving) this.phase += dt * 9;
    const swing = Math.sin(this.phase) * 0.5;
    this.legs.forEach((leg, i) => {
      leg.rotation.x = pose.moving ? (i % 2 === 0 ? swing : -swing) : leg.rotation.x * 0.8;
    });
  }
  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.materials) m.dispose();
  }
}

/** Objects (and structure lanterns) that cast light after dark: a warm colour,
 *  how far it reaches, its strength, and how high off the ground it sits. New
 *  emitters just add an entry and start lighting the world automatically. */
const LIGHT_SOURCES: Record<string, { color: string; dist: number; power: number; y: number }> = {
  "object.campfire.basic": { color: "#ff9a3c", dist: 10, power: 2.4, y: 0.7 },
  "object.lamp.post": { color: "#ffd27a", dist: 8.5, power: 1.7, y: 2.3 },
  "object.lantern.iron": { color: "#ffcf7a", dist: 8, power: 1.6, y: 1.1 },
  "object.torch.wall": { color: "#ffb24d", dist: 11, power: 2.6, y: 1.3 },
  "object.glowstone.block": { color: "#fff2b0", dist: 9, power: 1.9, y: 0.5 },
  "object.furnace.basic": { color: "#ff7a2c", dist: 6, power: 1.3, y: 0.6 },
};
const LIGHT_POOL_SIZE = 12;

export class GameRenderer {
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  private renderer: THREE.WebGLRenderer;
  private sim: GameSimulation;
  readonly materials: MaterialResolver;
  private nodeViews = new Map<string, NodeView>();
  private groundItemViews = new Map<string, { group: THREE.Group; cell: Cell; baseY: number }>();
  /** Quest-guidance pathing world: doors/gates count walkable (cached per world). */
  private guideWorld: import("../sim/world").WorldState | null = null;
  private guideWorldFor: unknown = null;
  private pickables: THREE.Object3D[] = [];
  private terrainChunks = new Map<string, {
    mesh: THREE.Mesh;
    water: THREE.Mesh | null;
    trans: THREE.Mesh | null;
    quadRanges: Map<string, number[]>;
  }>();
  private terrainMaterial: THREE.MeshLambertMaterial | null = null;
  private streamCenter = { x: -9999, z: -9999 };
  private debugCollision = false;
  private debugCollisionMesh: THREE.Mesh | null = null;
  private objectViews = new Map<string, THREE.Group>();
  private fenceCells = new Set<string>();
  private playerView!: CharacterView;
  private npcViews = new Map<string, CharacterView | NpcModelView>();
  private particles: ParticleBursts;
  private enemyViews = new Map<
    string,
    {
      group: THREE.Group;
      barGroup: THREE.Group;
      barFg: THREE.Mesh;
      shakeT: number;
      barHeight: number;
      anim: EnemyAnim;
    }
  >();
  private flameGroups: THREE.Group[] = [];
  /** Portal glow materials, pulsed each frame so the gate reads as "lit". The
   *  owning group lets us prune + dispose them when the portal streams out. */
  private portalGlows: Array<{ mat: THREE.MeshBasicMaterial; base: number; amp: number; group: THREE.Group }> = [];
  private waterTexture: THREE.Texture | null = null;
  /** Buildings and other tall props that fade when hiding the player. */
  /** Tall occluders (buildings, structures) raycast against the player sightline. */
  private objectFadeGroups: Array<{
    group: THREE.Group;
    materials: THREE.MeshLambertMaterial[];
  }> = [];
  /** Terrain occlusion: per-cell quad vertex ranges + currently faded cells. */

  private terrainFaded = new Set<string>();
  private terrainMaxHeight = 0;
  private selectionRing: THREE.Mesh;
  private destinationMarker: THREE.Mesh;
  /** Placed-structure visuals by instanceId (world editor add/remove). */
  private structureVisuals = new Map<string, {
    group: THREE.Group;
    materials: THREE.MeshLambertMaterial[];
    /** Roof-cutaway plane shared by all this structure's materials. */
    cutPlane: THREE.Plane;
    /** World Y above which nothing of this structure reaches (rest state). */
    cutTop: number;
    /** World Y of the interior floor (= door sill). Cut height keys off this. */
    floorY: number;
    /** World Y to slice to when inside: keeps the ground-floor walls, removes
     *  the roof (and any upper storey) so the interior floor and walls show. */
    roofCut: number;
    /** World Y of the ground-floor walk surface (for projecting clicks in). */
    interiorY: number;
    /** Cached walkable cell at the centre of the recognized interior floor —
     *  where a click on this building walks the player. Computed on first use
     *  (once the sim has registered the build's walk surfaces). */
    interiorCell?: Cell | null;
    bounds: { x0: number; z0: number; x1: number; z1: number };
    /** elapsed-clock deadline until which the roof is cut away (roof-click). */
    peek: number;
    /** The placement's ids, so a click can route to the "enter this building"
     *  flow (houses) or fall through to walking (the lobby hub's tiles). */
    instanceId: string;
    structureId: string;
    /** World-space emissive block positions (lanterns/torches/glowstone baked
     *  into this build) so updateLights() can light them at night. */
    lights: Array<{ x: number; y: number; z: number; color: string }>;
  }>();
  /** Peek-hole strength, eased toward 1 while anything occludes the player. */
  private peepStrength = 0;
  /** Editor ghost preview. */
  private ghost: { group: THREE.Group; materials: THREE.MeshLambertMaterial[]; ax: number; az: number; sink: number; anchored: boolean } | null = null;
  /** True while something occludes the player and the x-ray pass is on. */
  private playerXray = false;
  private ringPulse = 0;
  private elapsed = 0;
  /** A glowing pillar over the current tutorial objective so the newcomer can
   *  find the next (spread-out) station. */
  private tutorialBeacon: THREE.Mesh | null = null;
  private questDots: THREE.Mesh[] = [];
  private questDotGeo: THREE.PlaneGeometry | null = null;
  private questDotTex: THREE.CanvasTexture | null = null;

  /** A small hard-edged pixel disc (drawn per-pixel, nearest-filtered) so the
   *  quest-trail dots read as chunky pixel circles, not smooth vectors. */
  private pixelDiscTexture(): THREE.CanvasTexture {
    if (this.questDotTex) return this.questDotTex;
    const N = 12, r = N / 2 - 0.5, cc = (N - 1) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext("2d")!;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(x - cc, y - cc);
        if (d <= r) {
          // A darker 1px rim, bright core — a little pixel coin.
          ctx.fillStyle = d > r - 1.2 ? "#b98a1a" : "#ffdc55";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.questDotTex = tex;
    return tex;
  }

  /** A glowing pillar over the active quest objective, plus a trail of dots
   *  marking the walkable path to it — quest help that shows where to go. */
  private updateQuestGuidance(): void {
    const target = activeQuestTarget(this.sim);
    if (!target) {
      if (this.tutorialBeacon) this.tutorialBeacon.visible = false;
      for (const d of this.questDots) d.visible = false;
      return;
    }
    const goal = target.cell;
    // Objective beacon.
    if (!this.tutorialBeacon) {
      const geo = new THREE.BoxGeometry(0.5, 10, 0.5);
      geo.translate(0, 5, 0);
      const mat = new THREE.MeshBasicMaterial({ color: "#ffdc55", transparent: true, opacity: 0.5, depthWrite: false });
      this.tutorialBeacon = new THREE.Mesh(geo, mat);
      this.tutorialBeacon.renderOrder = 3;
      this.scene.add(this.tutorialBeacon);
    }
    (this.tutorialBeacon.material as THREE.MeshBasicMaterial).opacity = 0.32 + 0.22 * (0.5 + 0.5 * Math.sin(this.elapsed * 3));
    this.tutorialBeacon.position.set(goal.x + 0.5, this.sim.world.surfaceY(goal), goal.z + 0.5);
    this.tutorialBeacon.visible = true;

    // Dotted trail from the player to a walkable cell beside the objective.
    // Click-to-open doors and pen gates count as walkable for GUIDANCE (the
    // player can open them), or the dots would vanish for any objective that
    // sits behind a closed gate.
    const player = this.sim.movement.currentCell();
    const world = this.sim.world;
    if (this.guideWorldFor !== world) {
      const doorCells = new Set(
        world.region.objects
          .filter((o) => (o.defId.startsWith("object.door.") || o.defId.startsWith("object.gate.")) && !o.portal)
          .map((o) => `${o.cell.x},${o.cell.z}`),
      );
      const gw = Object.create(world) as typeof world;
      gw.walkable = (c: Cell, boat?: boolean) => world.walkable(c, boat) || doorCells.has(`${c.x},${c.z}`);
      this.guideWorld = gw;
      this.guideWorldFor = world;
    }
    const approach = this.walkableNear(goal);
    const path = approach ? findPath(this.guideWorld!, player, approach) : null;
    if (!path || path.length === 0) {
      for (const d of this.questDots) d.visible = false;
      return;
    }
    if (!this.questDotGeo) {
      this.questDotGeo = new THREE.PlaneGeometry(0.5, 0.5);
      this.questDotGeo.rotateX(-Math.PI / 2);
    }
    // One dot every other path cell (capped), pulsing as it "marches" toward
    // the goal so the trail reads as a direction, not a static dotted line.
    let di = 0;
    for (let i = 0; i < path.length && di < 48; i += 2) {
      const c = path[i];
      if (di >= this.questDots.length) {
        const mat = new THREE.MeshBasicMaterial({ map: this.pixelDiscTexture(), transparent: true, opacity: 0.6, alphaTest: 0.35, depthWrite: false });
        const mesh = new THREE.Mesh(this.questDotGeo, mat);
        mesh.renderOrder = 3;
        this.scene.add(mesh);
        this.questDots.push(mesh);
      }
      const dot = this.questDots[di++];
      dot.position.set(c.x + 0.5, this.sim.world.surfaceY(c) + 0.16, c.z + 0.5);
      (dot.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.4 * (0.5 + 0.5 * Math.sin(this.elapsed * 4 - i * 0.6));
      dot.visible = true;
    }
    for (; di < this.questDots.length; di++) this.questDots[di].visible = false;
  }

  /** The cell itself if walkable, else a walkable neighbour, else null. */
  private walkableNear(cell: { x: number; z: number }): { x: number; z: number } | null {
    if (this.sim.world.walkable(cell)) return cell;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const c = { x: cell.x + dx, z: cell.z + dz };
      if (this.sim.world.walkable(c)) return c;
    }
    return null;
  }
  /** Shared canopy-sway clock + amplitude (weather-driven), referenced by every
   *  leaf material so the whole forest breathes off one uniform. */
  private windTime = { value: 0 };
  private windAmp = { value: 0.05 };

  /**
   * Give a leaf material a gentle wind sway (vertex displacement that grows
   * with canopy height) and, for the magical woods, an animated emissive
   * glow — ember flickers, dusk shimmers, glow pulses, blossom breathes.
   * All animation rides the shared wind clock, so there is no per-tree JS
   * bookkeeping and streamed trees can be disposed freely.
   */
  private applyLeafSway(
    mat: THREE.MeshLambertMaterial,
    mode: "leaf" | "glow" | "ember" | "dusk" | "blossom" = "leaf",
  ): void {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = this.windTime;
      shader.uniforms.uWindAmp = this.windAmp;
      shader.vertexShader =
        "uniform float uWindTime;\nuniform float uWindAmp;\nvarying float vLeafY;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
           vLeafY = position.y;
           float _h = max(position.y - 1.0, 0.0);
           transformed.x += sin(uWindTime * 1.6 + position.x * 0.35 + position.z * 0.25) * uWindAmp * _h;
           transformed.z += cos(uWindTime * 1.2 + position.z * 0.40 + position.x * 0.20) * uWindAmp * _h * 0.7;`,
        );
      if (mode !== "leaf") {
        const flick =
          mode === "ember"
            ? "0.70 + 0.35 * sin(uWindTime * 7.0 + vLeafY * 3.0) + 0.15 * sin(uWindTime * 13.0)"
            : mode === "dusk"
              ? "0.80 + 0.28 * sin(uWindTime * 2.0 + vLeafY * 1.5)"
              : mode === "glow"
                ? "0.82 + 0.22 * sin(uWindTime * 1.6 + vLeafY)"
                : "0.90 + 0.10 * sin(uWindTime * 1.1)"; // blossom
        shader.fragmentShader =
          "uniform float uWindTime;\nvarying float vLeafY;\n" +
          shader.fragmentShader.replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>\n totalEmissiveRadiance *= (${flick});`,
          );
      }
    };
    // Distinct cache key per mode so three doesn't share one program across
    // the sway-only and emissive variants.
    mat.customProgramCacheKey = () => `leafsway_${mode}`;
  }

  constructor(canvas: HTMLCanvasElement, sim: GameSimulation) {
    this.sim = sim;
    this.materials = new MaterialResolver();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true; // roof cutaway planes
    this.bindSim(sim);
    this.resize();
  }

  /**
   * (Re)build the entire scene from a simulation — called at boot and again
   * on every region transition. Presentation is disposable by design.
   */
  bindSim(sim: GameSimulation): void {
    this.sim = sim;
    this.playerView?.dispose();
    for (const view of this.npcViews.values()) view.dispose();
    this.scene.clear();
    this.nodeViews.clear();
    this.npcViews.clear();
    this.enemyViews.clear();
    this.pickables = [];
    this.flameGroups = [];
    this.portalGlows = [];
    this.waterTexture = null;
    this.objectFadeGroups = [];
    this.structureVisuals = new Map();
    this.ghost = null;
    this.playerXray = false;
    this.terrainChunks.clear();
    this.terrainMaterial = null;
    this.objectViews.clear();
    this.streamCenter = { x: -9999, z: -9999 };
    this.terrainMaxHeight = 0;
    this.terrainFaded = new Set();

    // Region mood: sky + light intensities (dungeons are dim).
    const theme = sim.world.region.theme ?? DEFAULT_THEME;
    this.scene.background = new THREE.Color(theme.sky);
    const region = sim.world.region;
    const outdoor = region.id === "region.vale_clearing" || region.id === "region.endless" || region.id === "region.tutorial";
    // Outdoor light is warm+directional against a cool sky fill; dungeons keep
    // neutral white so their own themed tint reads correctly.
    const sun = new THREE.DirectionalLight(outdoor ? SUN_COLOR : 0xffffff, theme.sun);
    // A steeper, more oblique sun rakes across block faces for stronger relief.
    sun.position.set(region.width / 2 + 26, 30, region.depth / 2 + 15);
    sun.target.position.set(region.width / 2, 0, region.depth / 2);
    this.scene.add(sun, sun.target);
    const ambient = new THREE.AmbientLight(outdoor ? SKY_FILL_COLOR : 0xffffff, theme.ambient);
    this.scene.add(ambient);
    // Day/night + weather drive the outdoor regions from these baselines.
    this.sunLight = sun;
    this.ambientLight = ambient;
    // Point-light pool for nearby emitters (assigned each frame by updateLights).
    this.lightPool = [];
    for (let i = 0; i < LIGHT_POOL_SIZE; i++) {
      const pl = new THREE.PointLight(0xffffff, 0, 10, 1.6);
      pl.visible = false;
      this.scene.add(pl);
      this.lightPool.push(pl);
    }
    this.baseTheme = theme;
    this.baseSky = new THREE.Color(theme.sky);
    this.outdoorCycle = outdoor;
    // No scene fog: under a top-down iso camera the whole play area sits at a
    // near-uniform camera distance, so fog would wash the scene flat rather
    // than add depth. Depth comes from the warm-sun / cool-ambient contrast.
    this.scene.fog = null;
    if (this.precip) {
      this.scene.remove(this.precip);
      this.precip.geometry.dispose();
      (this.precip.material as THREE.Material).dispose();
      this.precip = null;
      this.precipKind = null;
    }

    // Fence rails only reach toward neighboring fence cells.
    this.fenceCells = new Set(
      sim.world.region.objects
        .filter((o) => o.defId === "object.fence.wood")
        .map((o) => `${o.cell.x},${o.cell.z}`),
    );
    this.buildStructures();
    this.buildCharacters();
    this.ensureStreamed(true);
    this.particles = new ParticleBursts(this.scene);

    this.selectionRing = this.makeRing(0.72, 0.86, "#ffd54a");
    this.destinationMarker = this.makeRing(0.3, 0.42, "#69f0ae");
    this.scene.add(this.selectionRing, this.destinationMarker);
    this.rig.center();
  }

  /**
   * Apply an imported texture pack (or null to restore built-in art), then
   * rebuild the scene so every cached material picks up the new pixels.
   * Cosmetic only — the simulation is never touched.
   */
  async applyTexturePack(textures: Record<string, string> | null): Promise<void> {
    await this.materials.setPack(textures);
    this.bindSim(this.sim);
  }

  // ---------- construction ----------

  /**
   * Ground marker as a chunky pixel-art circle: a midpoint-circle ring of
   * square texels on a 16x16 tile, matching the game's block-art density.
   */
  private makeRing(inner: number, outer: number, color: string): THREE.Mesh {
    const size = 16;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const c = size / 2 - 0.5; // center between texels
    const midR = ((inner + outer) / 2 / outer) * (size / 2 - 1);
    ctx.fillStyle = color;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.sqrt((x - c) * (x - c) + (y - c) * (y - c));
        if (Math.abs(d - midR) < 0.75) ctx.fillRect(x, y, 1, 1);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(outer * 2.15, outer * 2.15),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.5,
        opacity: 0.95,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    return mesh;
  }

  /** The water surface height at a cell: the global sea level for natural
   *  water, or just under the bank for an elevated pool (see the water-mesh
   *  branch) so actors ride the tutorial pond instead of the far-below sea. */
  private waterSurfaceY(cell: Cell): number {
    const h = this.sim.world.heightAt(cell);
    return h > WATER_SURFACE_Y + 1 ? h - 0.3 : WATER_SURFACE_Y;
  }

  /** Ground height for markers: water cells use the water surface, not the bed;
   *  slabs/stairs stand a half-block proud (via world.surfaceY). */
  private surfaceY(cell: Cell): number {
    return this.sim.world.blockAt(cell) === "water" ? this.waterSurfaceY(cell) : this.sim.world.surfaceY(cell);
  }

  // Top-face and cliff-wall tiles come straight from the block registry
  // (content/blocks.ts) so the palette and its strata live in one place. A
  // cliff's `depth` is how far below the surface unit a wall unit sits (0 =
  // the lip); soil blocks band down through dirt to stone.
  private topTileFor(block: BlockType): string {
    return topTile(block);
  }

  private sideTileFor(block: BlockType, depth: number): string {
    return sideTile(block, depth);
  }

  private chunkKeyFor(x: number, z: number): string {
    return `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
  }

  /**
   * Stream the world around the player: terrain chunks within
   * TERRAIN_CHUNK_RADIUS, node/object/enemy visuals within ENTITY_RADIUS.
   * Cheap early-out until the player has moved a meaningful distance.
   */
  ensureStreamed(force: boolean): void {
    const p = this.sim.movement.pos;
    if (!force && Math.abs(p.x - this.streamCenter.x) < 22 && Math.abs(p.z - this.streamCenter.z) < 22) {
      return;
    }
    this.streamCenter = { x: p.x, z: p.z };
    const region = this.sim.world.region;
    const pcx = Math.floor(p.x / CHUNK);
    const pcz = Math.floor(p.z / CHUNK);
    const maxCx = Math.ceil(region.width / CHUNK) - 1;
    const maxCz = Math.ceil(region.depth / CHUNK) - 1;
    for (let dz = -TERRAIN_CHUNK_RADIUS; dz <= TERRAIN_CHUNK_RADIUS; dz++) {
      for (let dx = -TERRAIN_CHUNK_RADIUS; dx <= TERRAIN_CHUNK_RADIUS; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (cx < 0 || cz < 0 || cx > maxCx || cz > maxCz) continue;
        if (!this.terrainChunks.has(`${cx},${cz}`)) this.buildTerrainChunk(cx, cz);
      }
    }
    for (const [key, chunk] of [...this.terrainChunks]) {
      const [cx, cz] = key.split(",").map(Number);
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > TERRAIN_CHUNK_RADIUS + 1) {
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        if (chunk.water) {
          this.scene.remove(chunk.water);
          chunk.water.geometry.dispose();
        }
        if (chunk.trans) {
          this.scene.remove(chunk.trans);
          chunk.trans.geometry.dispose();
        }
        this.terrainChunks.delete(key);
      }
    }
    if (this.debugCollision) this.refreshDebugCollision();
  }

  /** Debug: overlay a red marker on every cell you can't stand on, around the
   *  player. Toggled from the debug menu; rebuilt as you move. */
  setDebugCollision(on: boolean): void {
    this.debugCollision = on;
    this.refreshDebugCollision();
  }

  refreshDebugCollision(): void {
    if (this.debugCollisionMesh) {
      this.scene.remove(this.debugCollisionMesh);
      this.debugCollisionMesh.geometry.dispose();
      this.debugCollisionMesh = null;
    }
    if (!this.debugCollision) return;
    const world = this.sim.world;
    const p = this.sim.movement.pos;
    const cx = Math.round(p.x), cz = Math.round(p.z), R = 40;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    // A cell "collides" if you can't stand on it (water, props, obstacles) OR it
    // rises 2+ above a walkable neighbour — a wall/cliff face you can't climb.
    const collides = (cell: { x: number; z: number }): boolean => {
      if (!world.walkable(cell)) return true;
      const h = world.heightAt(cell);
      for (const [dx, dz] of nb) {
        const n2 = { x: cell.x + dx, z: cell.z + dz };
        if (world.inBounds(n2) && world.walkable(n2) && h - world.heightAt(n2) >= 2) return true;
      }
      return false;
    };
    const pos: number[] = [], idx: number[] = [];
    let n = 0;
    for (let z = cz - R; z <= cz + R; z++) {
      for (let x = cx - R; x <= cx + R; x++) {
        const cell = { x, z };
        if (!world.inBounds(cell) || !collides(cell)) continue;
        const y = world.heightAt(cell) + 1.02;
        pos.push(x, y, z + 1, x + 1, y, z + 1, x + 1, y, z, x, y, z);
        idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
        n += 4;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({
      color: "#ff3030", transparent: true, opacity: 0.4, depthWrite: false,
    });
    this.debugCollisionMesh = new THREE.Mesh(geo, mat);
    this.debugCollisionMesh.renderOrder = 5;
    this.scene.add(this.debugCollisionMesh);
  }

  private streamEntities(px: number, pz: number): void {
    const near = (cell: { x: number; z: number }, r: number) =>
      Math.abs(cell.x - px) < r && Math.abs(cell.z - pz) < r;
    // Building meshes is the expensive part, so cap how many new visuals we
    // create per frame — the first load fills in over a moment instead of
    // freezing while thousands of trees and tufts are built at once.
    let budget = STREAM_ADD_BUDGET;

    for (const node of this.sim.nodes.instances.values()) {
      if (budget <= 0) break;
      if (near(node.cell, ENTITY_RADIUS) && !this.nodeViews.has(node.instanceId)) {
        this.addNodeVisual(node);
        budget--;
      }
    }
    for (const view of [...this.nodeViews.values()]) {
      if (!near(view.cell, ENTITY_RADIUS + 60)) this.removeNodeVisual(view.instanceId);
    }

    // Ground items (dropped loot, laid eggs): stream in near the player, cull
    // when they're picked up / despawned (gone from the sim) or drift far off.
    for (const item of this.sim.groundItems.instances.values()) {
      if (budget <= 0) break;
      if (near(item.cell, ENTITY_RADIUS) && !this.groundItemViews.has(item.instanceId)) {
        this.addGroundItemVisual(item);
        budget--;
      }
    }
    for (const [id, view] of [...this.groundItemViews]) {
      if (!this.sim.groundItems.get(id) || !near(view.cell, ENTITY_RADIUS + 60)) {
        this.removeGroundItemVisual(id);
      }
    }

    for (const obj of this.sim.world.region.objects) {
      if (budget <= 0) break;
      if (this.objectViews.has(obj.instanceId)) continue;
      // Tiny ground cover only needs to exist right around the player; a
      // 180-cell radius of grass sprites is thousands of wasted draw calls.
      const r = DETAIL_DEFS.has(obj.defId) ? DETAIL_RADIUS : ENTITY_RADIUS;
      if (near(obj.cell, r)) {
        this.addObjectVisual(obj);
        budget--;
      }
    }
    for (const [id, group] of [...this.objectViews]) {
      // Cull by the group's own position (no O(n) region lookup per view).
      const cell = { x: group.position.x, z: group.position.z };
      const keep = DETAIL_DEFS.has(group.userData.defId) ? DETAIL_RADIUS + 30 : ENTITY_RADIUS + 60;
      if (!near(cell, keep)) this.disposeObjectVisual(id, group);
    }

    for (const placement of this.sim.world.region.enemies ?? []) {
      if (budget <= 0) break;
      if (near(placement.cell, ENTITY_RADIUS) && !this.enemyViews.has(placement.instanceId)) {
        this.addEnemyVisual(placement);
        budget--;
      }
    }
    for (const [id, view] of [...this.enemyViews]) {
      const enemy = this.sim.enemies.get(id);
      const cell = enemy ? enemy.movement.currentCell() : null;
      if (cell && !near(cell, ENTITY_RADIUS + 60)) this.disposeEnemyVisual(id, view);
    }

    // Village folk stream in and out like the rest of the entities.
    for (const npc of this.sim.world.region.npcs) {
      if (budget <= 0) break;
      if (near(npc.cell, ENTITY_RADIUS) && !this.npcViews.has(npc.instanceId)) {
        this.addNpcVisual(npc);
        budget--;
      }
    }
    for (const [id, view] of [...this.npcViews]) {
      const npc = this.sim.npcs.get(id);
      if (!npc) { this.disposeNpcVisual(id); continue; } // streamed out of the sim
      if (!near(npc.movement.currentCell(), ENTITY_RADIUS + 60)) this.disposeNpcVisual(id);
    }

    // Structures (wild homesteads and the town cottage) are heavy meshes, so
    // build at most one per frame and cull by their min corner.
    let structuresAdded = 0;
    for (const st of this.sim.world.region.structures ?? []) {
      if (structuresAdded >= 1) break;
      if (this.structureVisuals.has(st.instanceId)) continue;
      if (near(st.cell, ENTITY_RADIUS)) {
        this.addStructureVisual(st);
        structuresAdded++;
      }
    }
    for (const [id, visual] of [...this.structureVisuals]) {
      const corner = { x: visual.bounds.x0, z: visual.bounds.z0 };
      if (!near(corner, ENTITY_RADIUS + 80)) this.removeStructureVisual(id);
    }
  }

  private disposeObjectVisual(id: string, group: THREE.Group): void {
    this.scene.remove(group);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.pickables = this.pickables.filter((g) => g !== group);
    this.objectFadeGroups = this.objectFadeGroups.filter((f) => f.group !== group);
    // Prune + dispose this object's portal glow materials so they don't leak
    // as gates stream in and out of range in the endless overworld.
    this.portalGlows = this.portalGlows.filter((p) => {
      if (p.group !== group) return true;
      p.mat.dispose();
      return false;
    });
    this.flameGroups = this.flameGroups.filter((f) => {
      let inside = false;
      f.traverseAncestors((a) => {
        if (a === group) inside = true;
      });
      return !inside && f !== group;
    });
    this.objectViews.delete(id);
  }

  /** Free a group's mesh geometry, and (only when materials are per-instance)
   *  its materials too. Enemy rigs reuse a shared skin material — disposing it
   *  would break every other mob of that type — so pass materials:false there;
   *  the health-bar planes own private materials, so pass materials:true. */
  private disposeGroupResources(group: THREE.Group, materials: boolean): void {
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      if (!materials) return;
      const mat = o.material;
      if (Array.isArray(mat)) for (const m of mat) m.dispose();
      else mat.dispose();
    });
  }

  private disposeEnemyVisual(id: string, view: { group: THREE.Group; barGroup: THREE.Group }): void {
    this.scene.remove(view.group, view.barGroup);
    // The sibling health-bar group is added straight to the scene, not under
    // the rig, so it must be freed explicitly or its plane geometry + private
    // materials leak on every streaming cull.
    this.disposeGroupResources(view.group, false);
    this.disposeGroupResources(view.barGroup, true);
    this.pickables = this.pickables.filter((g) => g !== view.group);
    this.enemyViews.delete(id);
  }

  private buildTerrainChunk(chunkX: number, chunkZ: number): void {
    const region = this.sim.world.region;
    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const waterPositions: number[] = [];
    const waterColors: number[] = [];
    const waterUvs: number[] = [];
    const waterIndices: number[] = [];
    // See-through blocks (glass): a colored translucent mesh, no atlas.
    const transPositions: number[] = [];
    const transColors: number[] = [];
    const transIndices: number[] = [];
    const quadRanges = new Map<string, number[]>();

    const pushQuad = (
      corners: Array<[number, number, number]>,
      materialId: string,
      shade: number,
      cellX?: number,
      cellZ?: number,
    ) => {
      const base = positions.length / 3;
      const [u0, v0, u1, v1] = this.materials.atlasUv(materialId);
      const quadUv: Array<[number, number]> = [
        [u0, v0], [u1, v0], [u1, v1], [u0, v1],
      ];
      corners.forEach((c, i) => {
        positions.push(...c);
        uvs.push(...quadUv[i]);
        colors.push(shade, shade, shade, 1);
      });
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      if (cellX !== undefined && cellZ !== undefined) {
        const key = `${cellX},${cellZ}`;
        const list = quadRanges.get(key) ?? [];
        list.push(base);
        quadRanges.set(key, list);
      }
    };

    // A flat-colored quad for the translucent (glass) pass.
    const pushTrans = (corners: Array<[number, number, number]>, rgb: [number, number, number], shade: number) => {
      const base = transPositions.length / 3;
      for (const c of corners) {
        transPositions.push(...c);
        transColors.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade, 0.5);
      }
      transIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    // An axis-aligned box (fence/wall post + rails): 4 sides + top, one tile.
    const pushBox = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, mat: string, cx: number, cz: number) => {
      pushQuad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], mat, 1.0, cx, cz); // top
      pushQuad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], mat, 0.72, cx, cz); // -x
      pushQuad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], mat, 0.72, cx, cz); // +x
      pushQuad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], mat, 0.84, cx, cz); // -z
      pushQuad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], mat, 0.84, cx, cz); // +z
    };

    const world = this.sim.world;
    const heightOrVoid = (x: number, z: number): number => {
      if (x < 0 || z < 0 || x >= region.width || z >= region.depth) return -2;
      return world.heightAt({ x, z });
    };
    // Depth of the water bed below the flat surface at a cell (0 on land). The
    // raw bed is integer-stepped, which shades into hard contour bands — so we
    // box-blur it over a wide kernel to get a smooth, continuous depth field.
    const bedDepthCache = new Map<number, number>();
    const bedDepth = (x: number, z: number): number => {
      const key = x * 8388608 + z;
      const hit = bedDepthCache.get(key);
      if (hit !== undefined) return hit;
      const v = x < 0 || z < 0 || x >= region.width || z >= region.depth
        ? 3
        : world.blockAt({ x, z }) !== "water"
          ? 0
          : Math.max(0, WATER_SURFACE_Y - world.heightAt({ x, z }));
      bedDepthCache.set(key, v);
      return v;
    };
    // Wide box-blur of the bed depth (radius R), memoised per grid corner, so
    // the depth — and thus the colour — varies smoothly instead of in steps.
    const R = 4;
    const cornerDepthCache = new Map<number, number>();
    const cornerDepth = (gx: number, gz: number): number => {
      const key = gx * 8388608 + gz;
      const hit = cornerDepthCache.get(key);
      if (hit !== undefined) return hit;
      let sum = 0, n = 0;
      for (let dz = -R; dz <= R; dz++) {
        for (let dx = -R; dx <= R; dx++) { sum += bedDepth(gx + dx, gz + dz); n++; }
      }
      const v = sum / n;
      cornerDepthCache.set(key, v);
      return v;
    };
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    // Shallow teal near the shore deepening to dark blue; multiplies the ripple
    // texture. Smoothstep on the blurred depth so the gradient reads as water,
    // not contour lines.
    const waterColorAt = (gx: number, gz: number): [number, number, number] => {
      const t = Math.min(1, cornerDepth(gx, gz) / 6);
      const s = t * t * (3 - 2 * t);
      return [lerp(0.58, 0.12, s), lerp(0.80, 0.24, s), lerp(0.86, 0.46, s)];
    };

    const x0 = chunkX * CHUNK;
    const z0 = chunkZ * CHUNK;
    const x1 = Math.min(region.width, x0 + CHUNK);
    const z1 = Math.min(region.depth, z0 + CHUNK);
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const block = world.blockAt({ x, z });
        const h = world.heightAt({ x, z });
        if (block === "water") {
          // Natural water sits at the global sea surface; an elevated pool
          // (the tutorial vale pond, well above sea level) instead floats its
          // surface just under its own bank so it reads as a shallow pond
          // rather than a sunken sandy pit far below.
          const elevated = h > WATER_SURFACE_Y + 1;
          const surfY = elevated ? h - 0.3 : WATER_SURFACE_Y;
          const bedY = elevated ? h - 1 : h;
          // Bed under the translucent surface: sandy in the shallows,
          // dark silt in the deeps.
          pushQuad(
            [[x, bedY, z + 1], [x + 1, bedY, z + 1], [x + 1, bedY, z], [x, bedY, z]],
            bedY >= -1 ? "terrain.sand" : "terrain.dirt",
            bedY >= -1 ? 0.72 : 0.45,
          );
          const wBase = waterPositions.length / 3;
          waterPositions.push(
            x, surfY, z + 1,
            x + 1, surfY, z + 1,
            x + 1, surfY, z,
            x, surfY, z,
          );
          // Continuous world-space UVs so the ripple texture flows across
          // cells instead of tiling with a seam at every block edge.
          const us = 0.5;
          waterUvs.push(x * us, (z + 1) * us, (x + 1) * us, (z + 1) * us, (x + 1) * us, z * us, x * us, z * us);
          // Smooth per-corner depth colour — kills the terraced banding.
          for (const [cx, cz] of [[x, z + 1], [x + 1, z + 1], [x + 1, z], [x, z]] as const) {
            const [r, g, b] = waterColorAt(cx, cz);
            waterColors.push(r, g, b, 1);
          }
          waterIndices.push(wBase, wBase + 1, wBase + 2, wBase, wBase + 2, wBase + 3);
          continue;
        }
        // See-through blocks (glass): a full tinted cube in the translucent
        // pass — top plus any exposed side walls.
        if (isTranslucent(block)) {
          const hex = blockTint(block);
          const rgb: [number, number, number] = [
            parseInt(hex.slice(1, 3), 16) / 255,
            parseInt(hex.slice(3, 5), 16) / 255,
            parseInt(hex.slice(5, 7), 16) / 255,
          ];
          pushTrans([[x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z], [x, h, z]], rgb, 1.0);
          for (const [nx, nz, sh, corners] of [
            [x - 1, z, 0.8, (y0: number) => [[x, y0, z], [x, y0, z + 1], [x, y0 + 1, z + 1], [x, y0 + 1, z]]],
            [x + 1, z, 0.8, (y0: number) => [[x + 1, y0, z + 1], [x + 1, y0, z], [x + 1, y0 + 1, z], [x + 1, y0 + 1, z + 1]]],
            [x, z - 1, 0.9, (y0: number) => [[x + 1, y0, z], [x, y0, z], [x, y0 + 1, z], [x + 1, y0 + 1, z]]],
            [x, z + 1, 0.9, (y0: number) => [[x, y0, z + 1], [x + 1, y0, z + 1], [x + 1, y0 + 1, z + 1], [x, y0 + 1, z + 1]]],
          ] as const) {
            const nh = heightOrVoid(nx as number, nz as number);
            for (let y = nh; y < h; y++) pushTrans((corners as (y0: number) => Array<[number, number, number]>)(y), rgb, sh as number);
          }
          continue;
        }
        this.terrainMaxHeight = Math.max(this.terrainMaxHeight, h);

        // Relief shading: contact shadow at the foot of rises.
        let higher = 0;
        for (const [nx, nz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]] as const) {
          if (heightOrVoid(nx, nz) > h) higher++;
        }
        // Altitude tint saturates instead of growing linearly, so 80-block
        // peaks don't blow out to white while low relief still reads.
        const shade = Math.max(
          0.6,
          Math.min(1.12, 0.8 + Math.min(0.32, Math.max(0, h) * 0.014) - higher * 0.12),
        );
        // Fences/walls render their ground floor from a base block, then a
        // post on top; everything else renders its own top face. Slabs/stairs
        // raise the surface a half-block (surfaceH = h + 0.5); a full cube
        // keeps surfaceH = h so nothing in the existing world shifts.
        const shape = blockShape(block);
        const isBarrier = shape === "fence" || shape === "wall";
        const isBridge = block === "bridge";
        const isGateArch = block === "gatearch";
        const faceBlock = (isBarrier ? blockBase(block) : null) ?? block;
        const off = isBarrier ? 0 : surfaceOffset(block);
        const surfaceH = h + off;
        pushQuad(
          [[x, surfaceH, z + 1], [x + 1, surfaceH, z + 1], [x + 1, surfaceH, z], [x, surfaceH, z]],
          this.topTileFor(faceBlock),
          shade,
          x,
          z,
        );

        // Side walls where a neighbour column is lower (one quad per unit height).
        const sides: Array<{ nx: number; nz: number; shade: number; corners: (y0: number, y1: number) => Array<[number, number, number]> }> = [
          { nx: x - 1, nz: z, shade: 0.72, corners: (y0, y1) => [[x, y0, z], [x, y0, z + 1], [x, y1, z + 1], [x, y1, z]] },
          { nx: x + 1, nz: z, shade: 0.72, corners: (y0, y1) => [[x + 1, y0, z + 1], [x + 1, y0, z], [x + 1, y1, z], [x + 1, y1, z + 1]] },
          { nx: x, nz: z - 1, shade: 0.84, corners: (y0, y1) => [[x + 1, y0, z], [x, y0, z], [x, y1, z], [x + 1, y1, z]] },
          { nx: x, nz: z + 1, shade: 0.84, corners: (y0, y1) => [[x, y0, z + 1], [x + 1, y0, z + 1], [x + 1, y1, z + 1], [x, y1, z + 1]] },
        ];
        if (isBridge) {
          // A real bridge, built only from cube-family shapes: a one-plank-thick
          // slab deck (top at h) carried on full 1×1 stone pier columns, with the
          // river flowing visibly UNDERNEATH — not a filled column, and never a
          // void below.
          const BED_Y = WATER_SURFACE_Y - 1;
          // Water surface under the deck (into the translucent water mesh).
          const wBase = waterPositions.length / 3;
          waterPositions.push(
            x, WATER_SURFACE_Y, z + 1, x + 1, WATER_SURFACE_Y, z + 1,
            x + 1, WATER_SURFACE_Y, z, x, WATER_SURFACE_Y, z,
          );
          const us = 0.5;
          waterUvs.push(x * us, (z + 1) * us, (x + 1) * us, (z + 1) * us, (x + 1) * us, z * us, x * us, z * us);
          for (let i = 0; i < 4; i++) waterColors.push(0.30, 0.52, 0.70, 1);
          waterIndices.push(wBase, wBase + 1, wBase + 2, wBase, wBase + 2, wBase + 3);
          // A sandy bed a block under the surface so the channel reads as water.
          pushQuad([[x, BED_Y, z + 1], [x + 1, BED_Y, z + 1], [x + 1, BED_Y, z], [x, BED_Y, z]], "terrain.sand", 0.5, x, z);

          // Deck: full 1×1×1 plank blocks (one full block thick), top the walk
          // surface at h (the top face is pushed above) — so a height change
          // between deck cells reads as a clean full-block step, not a half-slab.
          const deckBot = h - 1;
          const plankSide = this.sideTileFor(block, 0);
          for (const side of sides) {
            const nh = heightOrVoid(side.nx, side.nz);
            if (nh < h) pushQuad(side.corners(deckBot, h), plankSide, side.shade, x, z); // exposed deck edge
          }
          pushQuad([[x, deckBot, z], [x + 1, deckBot, z], [x + 1, deckBot, z + 1], [x, deckBot, z + 1]], plankSide, 0.55, x, z); // underside
          // A pier every few cells: a full 1×1 stone column from the bed to the
          // deck — one Minecraft block thick, stacked cubes, not a thin post.
          if (((x * 2 + z * 3) & 3) === 0) {
            pushBox(x, x + 1, z, z + 1, BED_Y, deckBot, topTile("stone"), x, z);
          }
        } else {
          for (const side of sides) {
            const nh = heightOrVoid(side.nx, side.nz);
            for (let y = nh; y < h; y++) {
              pushQuad(side.corners(y, y + 1), this.sideTileFor(faceBlock, h - 1 - y), side.shade, x, z);
            }
          }
        }

        // Gate arch: stone brick fills the TOP HALF of the gateway, up to the
        // flanking wall's own top, so the archway reads as a tall covered gate
        // that climbs to the battlements — with roughly half the wall's height
        // as headroom. Same block as the wall so the span matches the rest.
        if (isGateArch) {
          let top = h;
          for (const [nx, nz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]] as const) {
            top = Math.max(top, heightOrVoid(nx, nz));
          }
          if (top > h + 4) {
            const bot = h + Math.floor((top - h) / 2);
            pushBox(x, x + 1, z, z + 1, bot, top, topTile("stonebrick"), x, z);
          }
        }

        // Slab/stair geometry: a half-block riser above the cell floor, and for
        // stairs a second half-block over the back (north) half of the cell.
        if (off > 0) {
          const face = this.sideTileFor(block, 0);
          for (const side of sides) pushQuad(side.corners(h, surfaceH), face, side.shade, x, z);
          if (shape === "stairs") {
            const t2 = surfaceH + 0.5;
            pushQuad([[x, t2, z + 0.5], [x + 1, t2, z + 0.5], [x + 1, t2, z], [x, t2, z]], this.topTileFor(block), shade, x, z);
            pushQuad([[x, surfaceH, z + 0.5], [x + 1, surfaceH, z + 0.5], [x + 1, t2, z + 0.5], [x, t2, z + 0.5]], face, 0.84, x, z);
            pushQuad([[x, surfaceH, z], [x, surfaceH, z + 0.5], [x, t2, z + 0.5], [x, t2, z]], face, 0.72, x, z);
            pushQuad([[x + 1, surfaceH, z + 0.5], [x + 1, surfaceH, z], [x + 1, t2, z], [x + 1, t2, z + 0.5]], face, 0.72, x, z);
            pushQuad([[x + 1, surfaceH, z], [x, surfaceH, z], [x, t2, z], [x + 1, t2, z]], face, 0.84, x, z);
          }
        }

        // Fence/wall post on top of the floor, with rails to adjacent barriers.
        if (isBarrier) {
          const mat = this.topTileFor(block);
          const wall = shape === "wall";
          const r = wall ? 4 / 16 : 2 / 16; // post half-width (wall 8px, fence 4px)
          const top = h + (wall ? 1.4 : 1.5);
          pushBox(x + 0.5 - r, x + 0.5 + r, z + 0.5 - r, z + 0.5 + r, h, top, mat, x, z);
          // Rails/connectors toward each neighbouring barrier.
          const rr = 2 / 16; // rail half-thickness
          const bars: Array<[number, number]> = wall ? [[top - 0.5, top]] : [[h + 0.5, h + 0.7], [h + 1.05, h + 1.25]];
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
            const nb = world.blockAt({ x: x + dx, z: z + dz });
            if (blockShape(nb) !== "fence" && blockShape(nb) !== "wall") continue;
            for (const [y0, y1] of bars) {
              if (dx !== 0) {
                const xa = dx < 0 ? x : x + 0.5 + r, xb = dx < 0 ? x + 0.5 - r : x + 1;
                pushBox(xa, xb, z + 0.5 - rr, z + 0.5 + rr, y0, y1, mat, x, z);
              } else {
                const za = dz < 0 ? z : z + 0.5 + r, zb = dz < 0 ? z + 0.5 - r : z + 1;
                pushBox(x + 0.5 - rr, x + 0.5 + rr, za, zb, y0, y1, mat, x, z);
              }
            }
          }
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 4));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    if (!this.terrainMaterial) {
      this.terrainMaterial = new THREE.MeshLambertMaterial({
        map: this.materials.terrainAtlas,
        vertexColors: true,
        transparent: true, // per-vertex alpha: walls fade when hiding the player
        side: THREE.DoubleSide,
      });
    }
    const mesh = new THREE.Mesh(geometry, this.terrainMaterial);
    this.scene.add(mesh);

    let water: THREE.Mesh | null = null;
    if (waterPositions.length > 0) {
      if (!this.waterTexture) {
        this.waterTexture = this.materials.texture("terrain.water");
        this.waterTexture.wrapS = THREE.RepeatWrapping;
        this.waterTexture.wrapT = THREE.RepeatWrapping;
      }
      const wg = new THREE.BufferGeometry();
      wg.setAttribute("position", new THREE.Float32BufferAttribute(waterPositions, 3));
      wg.setAttribute("uv", new THREE.Float32BufferAttribute(waterUvs, 2));
      wg.setAttribute("color", new THREE.Float32BufferAttribute(waterColors, 4));
      wg.setIndex(waterIndices);
      wg.computeVertexNormals();
      water = new THREE.Mesh(
        wg,
        new THREE.MeshLambertMaterial({
          map: this.waterTexture,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          vertexColors: true,
        }),
      );
      this.scene.add(water);
    }

    let trans: THREE.Mesh | null = null;
    if (transPositions.length > 0) {
      const tg = new THREE.BufferGeometry();
      tg.setAttribute("position", new THREE.Float32BufferAttribute(transPositions, 3));
      tg.setAttribute("color", new THREE.Float32BufferAttribute(transColors, 4));
      tg.setIndex(transIndices);
      tg.computeVertexNormals();
      trans = new THREE.Mesh(
        tg,
        new THREE.MeshLambertMaterial({
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          vertexColors: true,
          depthWrite: false,
        }),
      );
      this.scene.add(trans);
    }
    this.terrainChunks.set(`${chunkX},${chunkZ}`, { mesh, water, trans, quadRanges });
  }

  private lambert(materialId: string): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({ map: this.materials.texture(materialId) });
  }

  /**
   * A vanilla lantern body (6x7x6 px) UV-mapped from the block sheet:
   * caged sides over the glow, iron plate on top. Emissive so it reads lit
   * in shade; tint (soul lanterns) multiplies the glow.
   */
  private makeLantern(tint?: string): { mesh: THREE.Mesh; material: THREE.MeshLambertMaterial } {
    const sheet = this.materials.texture("object.lantern.sheet");
    const material = new THREE.MeshLambertMaterial({
      color: "#000000",
      emissive: new THREE.Color(tint ?? "#ffffff"),
      emissiveMap: sheet,
    });
    const geo = new THREE.BoxGeometry(0.375, 0.4375, 0.375);
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    const setFace = (face: number, x: number, y: number, w: number, h: number) => {
      const u0 = x / 16, u1 = (x + w) / 16;
      const v1 = 1 - y / 16, v0 = 1 - (y + h) / 16;
      const quad = [[u0, v1], [u1, v1], [u0, v0], [u1, v0]] as const;
      quad.forEach(([qu, qv], i) => uv.setXY(face * 4 + i, qu, qv));
    };
    for (const face of [0, 1, 4, 5]) setFace(face, 0, 2, 6, 7); // caged sides
    for (const face of [2, 3]) setFace(face, 0, 9, 6, 6); // iron plates
    uv.needsUpdate = true;
    return { mesh: new THREE.Mesh(geo, material), material };
  }

  /**
   * Box sized in whole/half blocks whose UVs repeat one 16x16 tile per block —
   * standard block-art texel density, so imported block textures map 1:1.
   */
  private tiledBox(
    w: number,
    h: number,
    d: number,
    side: THREE.MeshLambertMaterial,
    top?: THREE.MeshLambertMaterial,
    bottom?: THREE.MeshLambertMaterial,
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
    const spans: Array<[number, number]> = [
      [d, h], [d, h], [w, d], [w, d], [w, h], [w, h], // +x,-x,+y,-y,+z,-z
    ];
    spans.forEach(([su, sv], face) => {
      for (let i = face * 4; i < face * 4 + 4; i++) {
        uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
      }
    });
    uv.needsUpdate = true;
    const topMat = top ?? side;
    return new THREE.Mesh(geo, [side, side, topMat, bottom ?? topMat, side, side]);
  }

  /** Crossed 1x1 cutout planes — the standard block-game plant representation. */
  private crossSprite(spriteId: string): { group: THREE.Group; material: THREE.MeshLambertMaterial } {
    const material = new THREE.MeshLambertMaterial({
      map: this.materials.texture(spriteId),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    const group = new THREE.Group();
    for (const angle of [Math.PI / 4, -Math.PI / 4]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      plane.rotation.y = angle;
      plane.position.y = 0.5;
      group.add(plane);
    }
    return { group, material };
  }

  private buildNodes(): void {
    for (const node of this.sim.nodes.instances.values()) this.addNodeVisual(node);
  }

  /** Remove a node's meshes (editor delete). */
  removeNodeVisual(instanceId: string): void {
    const view = this.nodeViews.get(instanceId);
    if (!view) return;
    this.scene.remove(view.activeGroup, view.depletedMesh);
    for (const root of [view.activeGroup, view.depletedMesh]) {
      root.traverse((o) => {
        // Tree models share cached geometry across instances — never dispose those.
        if (o instanceof THREE.Mesh && !o.geometry.userData.shared) o.geometry.dispose();
      });
    }
    this.pickables = this.pickables.filter((p) => p !== view.activeGroup && p !== view.depletedMesh);
    this.nodeViews.delete(instanceId);
  }

  /** A dropped stack lying in the world: the item's icon on a small billboard
   *  that bobs above the ground (see the bob in update()). Clickable so you can
   *  send the player to walk over and grab it. */
  addGroundItemVisual(item: { instanceId: string; itemId: string; cell: Cell }): void {
    const baseY = this.sim.world.heightAt(item.cell);
    const cx = item.cell.x + 0.5;
    const cz = item.cell.z + 0.5;
    const group = new THREE.Group();

    const url = itemIconUrl(item.itemId);
    let visual: THREE.Object3D;
    if (url) {
      const tex = new THREE.TextureLoader().load(url);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.72, 0.72, 0.72);
      visual = sprite;
    } else {
      const mat = new THREE.MeshLambertMaterial({ color: 0xf1e6c8 });
      visual = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), mat);
    }
    // A soft shadow-ish disc so it reads as sitting on the ground.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.02;
    group.add(disc, visual);
    visual.position.y = 0.45;
    group.position.set(cx, baseY, cz);
    group.userData.instanceId = item.instanceId;
    group.traverse((o) => { o.userData.instanceId = item.instanceId; });
    this.scene.add(group);
    this.pickables.push(group);
    this.groundItemViews.set(item.instanceId, { group, cell: item.cell, baseY });
  }

  removeGroundItemVisual(instanceId: string): void {
    const view = this.groundItemViews.get(instanceId);
    if (!view) return;
    this.scene.remove(view.group);
    view.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
      if (o instanceof THREE.Sprite) (o.material as THREE.SpriteMaterial).map?.dispose();
    });
    this.pickables = this.pickables.filter((p) => p !== view.group);
    this.groundItemViews.delete(instanceId);
  }

  /** Ghost overlays: entities glow through occluders when hidden. */
  private ghostEntities: Array<{ root: THREE.Object3D; meshes: THREE.Mesh[] }> = [];
  /** Swinging door leaves by instanceId, plus their target open angle (rad). */
  private doorLeaves = new Map<string, THREE.Group>();
  private doorTargets = new Map<string, number>();

  /**
   * Tinted ghost copy of the entity, drawn through everything (depth test
   * off) but only switched on while the entity is actually occluded — the
   * same treatment the player's x-ray silhouette gets.
   */
  private addSilhouette(root: THREE.Object3D, color: string): void {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.34,
      depthTest: false,
      depthWrite: false,
    });
    const targets: THREE.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof THREE.Mesh && (o.material as THREE.MeshBasicMaterial).map !== blobTexture) targets.push(o);
    });
    const meshes: THREE.Mesh[] = [];
    for (const m of targets) {
      const ghost = new THREE.Mesh(m.geometry, mat);
      ghost.renderOrder = 985;
      ghost.visible = false;
      m.add(ghost); // inherits every animated transform
      meshes.push(ghost);
    }
    this.ghostEntities.push({ root, meshes });
  }

  /** Build one node's visual (world build or live editor placement). */
  addNodeVisual(node: { instanceId: string; defId: string; cell: Cell; structureId?: string; phase: string }): void {
    {
      const kind = NODES[node.defId].view;
      const baseY = this.sim.world.heightAt(node.cell);
      const cx = node.cell.x + 0.5;
      const cz = node.cell.z + 0.5;
      const variety = hash01(node.instanceId);

      // Grand trees: the imported structure is the living tree; a stump
      // remains while it regrows. Anchored so the trunk sits on the cell,
      // and parented at the trunk so shake/grow pivot correctly.
      if (kind === "structure" && node.structureId) {
        const asset = getStructure(node.structureId);
        if (!asset) return;
        const built = this.buildStructureGroup(asset);
        const activeGroup = new THREE.Group();
        built.group.position.set(
          -((asset.ax ?? 0) + 0.5),
          -asset.sink + (asset.sink > 0 ? 0.012 : 0),
          -((asset.az ?? 0) + 0.5),
        );
        activeGroup.add(built.group);
        activeGroup.position.set(cx, baseY, cz);
        activeGroup.traverse((o) => (o.userData.instanceId = node.instanceId));
        const stump = this.tiledBox(
          1, 0.5, 1,
          this.lambert("resource.tree.log.side"),
          this.lambert("resource.tree.stump.top"),
        );
        stump.position.set(cx, baseY + 0.25, cz);
        stump.userData.instanceId = node.instanceId;
        stump.visible = node.phase === "depleted";
        activeGroup.visible = node.phase === "active";
        this.scene.add(activeGroup, stump);
        this.pickables.push(activeGroup, stump);
        this.nodeViews.set(node.instanceId, {
          instanceId: node.instanceId,
          kind,
          cell: node.cell,
          baseY,
          baseScale: 1,
          activeGroup,
          depletedMesh: stump,
          fadeMaterials: built.materials,
          shakeT: 0,
          animPhase: variety * Math.PI * 2,
        });
        return;
      }

      const built = this.buildNodeVisual(kind, variety, NODES[node.defId].viewMaterial);
      for (const mat of built.fadeMaterials) addPeepHole(mat);
      const baseScale = built.baseScale;
      built.activeGroup.position.set(cx, kind === "pond" ? this.waterSurfaceY(node.cell) + 0.015 : baseY, cz);
      built.activeGroup.scale.setScalar(baseScale);
      built.activeGroup.traverse((o) => (o.userData.instanceId = node.instanceId));
      built.depletedMesh.position.set(cx, baseY + built.depletedYOffset, cz);
      built.depletedMesh.traverse((o) => (o.userData.instanceId = node.instanceId));
      built.depletedMesh.visible = node.phase === "depleted";
      built.activeGroup.visible = node.phase === "active";

      this.scene.add(built.activeGroup, built.depletedMesh);
      this.pickables.push(built.activeGroup, built.depletedMesh);
      this.nodeViews.set(node.instanceId, {
        instanceId: node.instanceId,
        kind,
        cell: node.cell,
        baseY,
        baseScale,
        activeGroup: built.activeGroup,
        depletedMesh: built.depletedMesh,
        fadeMaterials: built.fadeMaterials,
        shakeT: 0,
        animPhase: variety * Math.PI * 2,
      });
    }
  }

  /** A stepped pyramid of true Minecraft-sized blocks — a 2×2 base capped by
   *  one — used for ore veins. Full 1×1×1 blocks at real block scale, so the
   *  vein has the heft of actual Minecraft ore and its textures map one tile
   *  per face, undistorted. The same shape (in stone) serves the mined-out
   *  state, so mining just swaps the ore block for plain stone. The 2×2 base
   *  overhangs into the neighbouring cells (which stay walkable — only the
   *  vein's own cell blocks nav), the same way a tree's canopy does. */
  private orePyramid(mat: THREE.MeshLambertMaterial): THREE.Group {
    const g = new THREE.Group();
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]] as const) {
      const block = this.tiledBox(1, 1, 1, mat);
      block.position.set(dx, 0.5, dz);
      g.add(block);
    }
    const cap = this.tiledBox(1, 1, 1, mat);
    cap.position.set(0, 1.5, 0);
    g.add(cap);
    return g;
  }

  private buildNodeVisual(
    kind: NodeViewKind,
    variety: number,
    viewMaterial?: string,
  ): {
    activeGroup: THREE.Group;
    depletedMesh: THREE.Object3D;
    fadeMaterials: THREE.MeshLambertMaterial[];
    baseScale: number;
    depletedYOffset: number;
  } {
    const activeGroup = new THREE.Group();

    // Geometry uses whole-block dimensions (1 block = 1 unit = one 16x16 tile
    // per face) so standard block textures can be applied without distortion.
    switch (kind) {
      case "structure": {
        // Structure nodes are built directly in buildNodes; this path only
        // runs if a placement forgot its structureId.
        const empty = new THREE.Group();
        empty.visible = false;
        return { activeGroup, depletedMesh: empty, fadeMaterials: [], baseScale: 1, depletedYOffset: 0 };
      }
      case "tree":
      case "tree.darkoak":
      case "tree.spruce":
      case "tree.birch":
      case "tree.acacia":
      case "tree.jungle":
      case "tree.pine":
      case "tree.willow":
      case "tree.maple":
      case "tree.palm":
      case "tree.dead":
      case "tree.grand": {
        // Every species at vanilla proportions: 1x1 trunks (dark oak 2x2),
        // whole-block leaf layers. Oak = round crown + plus cap, spruce =
        // tiered cone, birch = pale slim crown, acacia = offset flat canopy,
        // jungle = tall giant with a mid-story shelf, dark oak = squat and
        // huge. Grand trees reuse their species' silhouette, grown taller
        // and half again as large.
        const grand = kind === "tree.grand";
        const species = grand
          ? (viewMaterial ?? "oak")
          : kind === "tree" ? "oak" : kind.slice("tree.".length);
        const TRUNKS: Record<string, string> = {
          oak: "resource.tree.log.side", birch: "resource.tree.birch.side",
          spruce: "resource.tree.spruce.side", pine: "resource.tree.pine.side",
          jungle: "resource.tree.jungle.side", acacia: "resource.tree.acacia.side",
          darkoak: "resource.tree.darkoak.side", willow: "resource.tree.willow.side",
          maple: "resource.tree.maple.side", palm: "resource.tree.palm.side",
          dead: "resource.tree.dead.side", blossom: "resource.tree.blossom.side",
          ember: "resource.tree.ember.side", glow: "resource.tree.glow.side",
          dusk: "resource.tree.dusk.side",
        };
        // Leaves ALWAYS resolve to a baked Minecraft leaf tile — those carry
        // the cutout alpha (RGBA) that makes foliage see-through. New species
        // reuse the closest existing MC leaf art and are *recoloured* per
        // species below, exactly like vanilla tints foliage.png. (Never a
        // procedural/opaque tile here, or the canopy renders as solid blocks.)
        const LEAVES: Record<string, string> = {
          oak: "resource.tree.leaves", birch: "resource.tree.birch.leaves",
          spruce: "resource.tree.spruce.leaves", pine: "resource.tree.spruce.leaves",
          jungle: "resource.tree.jungle.leaves", acacia: "resource.tree.acacia.leaves",
          darkoak: "resource.tree.darkoak.leaves", willow: "resource.tree.jungle.leaves",
          maple: "resource.tree.acacia.leaves", palm: "resource.tree.jungle.leaves",
          blossom: "resource.tree.blossom.leaves", ember: "resource.tree.darkoak.leaves",
          glow: "resource.tree.jungle.leaves", dusk: "resource.tree.darkoak.leaves",
        };
        const trunkSide = this.lambert(TRUNKS[species] ?? "resource.tree.log.side");
        const leavesMat = this.lambert(LEAVES[species] ?? "resource.tree.leaves");
        // Minecraft-style cutout foliage: the baked leaf tiles carry clean
        // binary alpha, so alphaTest punches the gaps through to sky and
        // canopy behind. Cutout (not transparent) keeps leaves in the opaque
        // pass — no z-sorting artifacts — like MC's cutout_mipped leaves.
        leavesMat.alphaTest = 0.5;
        // Recolour the MC leaf art per species (× material colour, so the
        // foliage detail + cutout show through the tint). The fantasy woods
        // also self-illuminate (emissive) so they read as enchanted at night.
        // Maple blazes across an autumn range (gold→orange→scarlet) per tree.
        let swayMode: "leaf" | "glow" | "ember" | "dusk" | "blossom" = "leaf";
        if (species === "glow") {
          leavesMat.color.set("#9ff0d6");
          leavesMat.emissive = new THREE.Color("#46e6c4");
          leavesMat.emissiveIntensity = 0.9;
          swayMode = "glow";
        } else if (species === "ember") {
          leavesMat.color.set("#ff8a4a");
          leavesMat.emissive = new THREE.Color("#ff5a1e");
          leavesMat.emissiveIntensity = 0.8;
          swayMode = "ember";
        } else if (species === "dusk") {
          leavesMat.color.set("#b79bea");
          leavesMat.emissive = new THREE.Color("#7a53c8");
          leavesMat.emissiveIntensity = 0.5;
          swayMode = "dusk";
        } else if (species === "blossom") {
          leavesMat.color.setHSL(0.92, 0.5, 0.82 + variety * 0.06);
          leavesMat.emissive = new THREE.Color("#f6c6de");
          leavesMat.emissiveIntensity = 0.12;
          swayMode = "blossom";
        } else if (species === "maple") {
          // Autumn spread over the warm acacia leaf art. Bias to amber→orange
          // (the olive base muddies pure scarlet), so it reads as fall gold.
          // A low warm emissive lifts the tint past what a plain multiply can
          // reach, so the canopy blazes vividly instead of muddying to olive.
          leavesMat.color.setHSL(0.045 + variety * 0.055, 1.0, 0.68 + variety * 0.07);
          leavesMat.emissive = new THREE.Color().setHSL(0.045 + variety * 0.05, 0.95, 0.35);
          leavesMat.emissiveIntensity = 0.5;
        } else if (species === "pine") {
          leavesMat.color.setHSL(0.36, 0.5, 0.7); // deep blue-green needles
        } else if (species === "willow") {
          leavesMat.color.setHSL(0.22, 0.45, 0.92 + variety * 0.04); // soft sage
        } else if (species === "palm") {
          leavesMat.color.setHSL(0.30, 0.7, 0.9); // bright tropical
        } else {
          leavesMat.color.setHSL(0.28, 0.08, 0.86 + variety * 0.1);
        }
        this.applyLeafSway(leavesMat, swayMode);

        // Every tree is a hand-built voxel model from the schematic library,
        // chosen deterministically per instance from its species' pool.
        const model = pickTreeModel(species, grand, variety);
        let trunkW = 1;
        if (model) {
          const geo = treeGeometry(model);
          const logMesh = new THREE.Mesh(geo.log, trunkSide);
          const leafMesh = new THREE.Mesh(geo.leaf, leavesMat);
          activeGroup.add(logMesh, leafMesh, makeBlobShadow(Math.min(4.2, 1.4 + model.r * 0.3)));
          trunkW = geo.baseCells >= 3 ? 2 : 1;
        } else {
          // No model for the species (shouldn't happen): a bare trunk.
          const trunk = this.tiledBox(1, 4, 1, trunkSide, this.lambert("resource.tree.log.top"));
          trunk.position.y = 2;
          activeGroup.add(trunk, makeBlobShadow(1.7));
        }
        // Stump: half-slab of log with the ring texture on top.
        const stump = this.tiledBox(trunkW, 0.5, trunkW, trunkSide, this.lambert("resource.tree.stump.top"));
        return {
          activeGroup,
          depletedMesh: stump,
          fadeMaterials: [trunkSide, leavesMat],
          baseScale: 1,
          depletedYOffset: 0.25,
        };
      }
      case "crop.wheat": {
        // Vanilla-style crop: crossed 16x16 planes (wheat_stage7 look).
        const full = this.crossSprite("sprite.crop.wheat.full");
        full.group.rotation.y = variety * Math.PI;
        activeGroup.add(full.group);
        const sprout = this.crossSprite("sprite.crop.wheat.sprout");
        sprout.group.rotation.y = variety * Math.PI;
        return { activeGroup, depletedMesh: sprout.group, fadeMaterials: [full.material], baseScale: 1, depletedYOffset: 0 };
      }
      case "crop.pumpkin": {
        // Pumpkins (and melons) are full 16x16x16 blocks in Minecraft.
        const melon = viewMaterial === "melon";
        const side = this.lambert(melon ? "object.melon.side" : "object.pumpkin.side");
        const block = this.tiledBox(1, 1, 1, side, this.lambert(melon ? "object.melon.top" : "object.pumpkin.top"));
        block.position.y = 0.5;
        activeGroup.add(block);
        const sprout = this.crossSprite("sprite.crop.wheat.sprout");
        sprout.group.rotation.y = variety * Math.PI;
        return { activeGroup, depletedMesh: sprout.group, fadeMaterials: [side], baseScale: 1, depletedYOffset: 0 };
      }
      case "herb": {
        const full = this.crossSprite("sprite.herb.full");
        full.group.rotation.y = variety * Math.PI;
        activeGroup.add(full.group);
        const bare = this.crossSprite("sprite.herb.bare");
        bare.group.rotation.y = variety * Math.PI;
        return { activeGroup, depletedMesh: bare.group, fadeMaterials: [full.material], baseScale: 1, depletedYOffset: 0 };
      }
      case "digsite": {
        // A full block of disturbed earth; excavated, plain dirt remains.
        const face = this.lambert("resource.digsite.face");
        const mound = this.tiledBox(1, 1, 1, face);
        mound.position.y = 0.5;
        activeGroup.add(mound);
        const spent = this.tiledBox(1, 1, 1, this.lambert("terrain.dirt"));
        return {
          activeGroup,
          depletedMesh: spent,
          fadeMaterials: [face],
          baseScale: 1,
          depletedYOffset: 0.5,
        };
      }
      case "rock": {
        // A mineable ore: a small stepped pyramid of cubes surfaced in the ore's
        // colour, so a vein reads at a glance. Mined out, the very same pyramid
        // turns plain stone — the ore colour vanishes until the vein regrows and
        // it can be mined again.
        const oreMat = this.lambert(viewMaterial ?? "resource.rock.copper");
        activeGroup.add(this.orePyramid(oreMat), makeBlobShadow(1.6));
        const spent = this.orePyramid(this.lambert("resource.rock.stone"));
        return {
          activeGroup,
          depletedMesh: spent,
          fadeMaterials: [oreMat],
          baseScale: 1,
          depletedYOffset: 0,
        };
      }
      case "bush": {
        // Cross-plane cutout sprite, the standard plant representation.
        // Per-instance rotation keeps thickets from looking stamped.
        const full = this.crossSprite("sprite.bush.berry.full");
        full.group.rotation.y = variety * Math.PI;
        activeGroup.add(full.group, makeBlobShadow(0.45));

        const bare = this.crossSprite("sprite.bush.berry.bare");
        bare.group.rotation.y = variety * Math.PI;
        return {
          activeGroup,
          depletedMesh: bare.group,
          fadeMaterials: [full.material],
          baseScale: 1,
          depletedYOffset: 0,
        };
      }
      case "trail": {
        // A snare line: two fence-post stakes (4 px) with a rope strung
        // between, over a scuffed dirt patch — a worked game trail.
        const stakeMat = this.lambert("resource.tree.log.side");
        const stakeGeo = new THREE.BoxGeometry(0.25, 0.75, 0.25);
        const stakeA = new THREE.Mesh(stakeGeo, stakeMat);
        stakeA.position.set(-0.35, 0.375, 0);
        const stakeB = new THREE.Mesh(stakeGeo, stakeMat);
        stakeB.position.set(0.35, 0.375, 0);
        const ropeMat = new THREE.MeshLambertMaterial({ color: "#b09265" });
        const rope = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.125, 0.125), ropeMat);
        rope.position.y = 0.6;
        const scuff = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.0625, 1),
          this.lambert("terrain.dirt"),
        );
        scuff.position.y = 0.03;
        activeGroup.add(stakeA, stakeB, rope, scuff);
        // Sprung: only the scuffed ground remains.
        const spent = new THREE.Mesh(
          new THREE.BoxGeometry(1, 0.0625, 1),
          this.lambert("terrain.dirt"),
        );
        return {
          activeGroup,
          depletedMesh: spent,
          fadeMaterials: [stakeMat, ropeMat],
          baseScale: 1,
          depletedYOffset: 0.03,
        };
      }
      case "stall": {
        // A vendor's table: plank top on log legs with wares — pilferable.
        const plank = this.lambert("terrain.plank");
        const top = new THREE.Mesh(new THREE.BoxGeometry(1, 0.125, 1), plank);
        top.position.y = 0.6875;
        const legMat = this.lambert("resource.tree.log.side");
        const legGeo = new THREE.BoxGeometry(0.25, 0.625, 0.25);
        for (const [lx, lz] of [[-0.375, -0.375], [0.375, -0.375], [-0.375, 0.375], [0.375, 0.375]]) {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(lx, 0.3125, lz);
          activeGroup.add(leg);
        }
        const wareA = new THREE.Mesh(
          new THREE.BoxGeometry(0.375, 0.25, 0.375),
          new THREE.MeshLambertMaterial({ color: "#a12722" }),
        );
        wareA.position.set(-0.2, 0.875, -0.1);
        const wareB = new THREE.Mesh(
          new THREE.BoxGeometry(0.3125, 0.1875, 0.3125),
          new THREE.MeshLambertMaterial({ color: "#d9a066" }),
        );
        wareB.position.set(0.25, 0.84, 0.2);
        activeGroup.add(top, wareA, wareB);
        // Cleaned out: the bare table stands, wares gone.
        const bare = new THREE.Group();
        const bareTop = new THREE.Mesh(new THREE.BoxGeometry(1, 0.125, 1), plank);
        bareTop.position.y = 0.6875;
        for (const [lx, lz] of [[-0.375, -0.375], [0.375, -0.375], [-0.375, 0.375], [0.375, 0.375]]) {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(lx, 0.3125, lz);
          bare.add(leg);
        }
        bare.add(bareTop);
        return {
          activeGroup,
          depletedMesh: bare,
          fadeMaterials: [plank, legMat],
          baseScale: 1,
          depletedYOffset: 0,
        };
      }
      case "strongbox": {
        // A 14/16-block iron-banded chest, kept locked. Cracked open, the
        // lid sits ajar (a darker, shorter box).
        const side = this.lambert("object.chest.side");
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.875, 0.875, 0.875), [
          side, side, this.lambert("object.chest.top"), side, side, side,
        ]);
        box.position.y = 0.4375;
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(0.9375, 0.1875, 0.9375),
          new THREE.MeshLambertMaterial({ color: "#5a5e66" }),
        );
        band.position.y = 0.4375;
        activeGroup.add(box, band);
        const cracked = new THREE.Mesh(
          new THREE.BoxGeometry(0.875, 0.4375, 0.875),
          new THREE.MeshLambertMaterial({ color: "#3a3129" }),
        );
        return {
          activeGroup,
          depletedMesh: cracked,
          fadeMaterials: [side],
          baseScale: 1,
          depletedYOffset: 0.22,
        };
      }
      case "pond": {
        const ringMat = new THREE.MeshBasicMaterial({
          color: "#dbeeff",
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        });
        const outer = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 20), ringMat);
        outer.rotation.x = -Math.PI / 2;
        const inner = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 16), ringMat);
        inner.rotation.x = -Math.PI / 2;
        inner.position.y = 0.005;
        activeGroup.add(outer, inner);

        const dummy = new THREE.Group(); // ponds never deplete
        dummy.visible = false;
        return {
          activeGroup,
          depletedMesh: dummy,
          fadeMaterials: [],
          baseScale: 1,
          depletedYOffset: 0,
        };
      }
    }
  }

  /** Build one placed object's meshes (streamed in around the player). */
  /** Remove one object's meshes (world editor). */
  removeObjectVisual(instanceId: string): void {
    const group = this.objectViews.get(instanceId);
    if (!group) return;
    this.scene.remove(group);
    group.traverse((o) => {
      if (o instanceof THREE.Mesh && !o.geometry.userData.shared) o.geometry.dispose();
    });
    this.pickables = this.pickables.filter((p) => p !== group);
    this.objectViews.delete(instanceId);
    this.doorLeaves.delete(instanceId);
    this.doorTargets.delete(instanceId);
    this.ghostEntities = this.ghostEntities.filter((g) => g.root !== group);
  }

  addObjectVisual(obj: ObjectPlacementView): void {
    const fenceCells = this.fenceCells;
    {
      const baseY = this.sim.world.heightAt(obj.cell);
      const group = new THREE.Group();
      switch (obj.defId) {
        case "object.campfire.basic": {
          // Crossed log slabs with a flickering flame sprite.
          const logMat = this.lambert("resource.tree.log.side");
          for (const angle of [Math.PI / 4, -Math.PI / 4]) {
            const log = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.22), logMat);
            log.rotation.y = angle;
            log.position.y = 0.08;
            group.add(log);
          }
          const flame = this.crossSprite("sprite.flame");
          flame.group.position.y = 0.12;
          group.add(flame.group, makeBlobShadow(0.5));
          this.flameGroups.push(flame.group);
          break;
        }
        case "object.furnace.basic": {
          // Full stone-brick block with a glowing firebox on the front.
          const side = this.lambert("object.furnace.side");
          const furnace = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
            side, side, side, side, side, this.lambert("object.furnace.front"),
          ]);
          furnace.position.y = 0.5;
          group.add(furnace);
          break;
        }
        case "object.shortcut.balancebeam":
        case "object.shortcut.spiretraverse":
        case "object.shortcut.log": {
          // A mossy fallen trunk, long enough to read as a river crossing.
          // The higher rungs (balance beam, spire catwalk) reuse the plank/log
          // silhouette; their distinct art is a later texture-pack pass.
          const bark = this.lambert("resource.tree.log.side");
          const trunk = this.tiledBox(0.875, 0.875, 2.5, bark, this.lambert("resource.tree.log.top"));
          trunk.position.y = 0.4375;
          const moss = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.0625, 1.2),
            new THREE.MeshLambertMaterial({ color: "#4c7a3d" }),
          );
          moss.position.y = 0.91;
          group.add(trunk, moss, makeBlobShadow(0.8));
          break;
        }
        case "object.shortcut.steppingstones":
        case "object.shortcut.crumbledwall":
        case "object.shortcut.culvert":
        case "object.shortcut.chasmleap":
        case "object.shortcut.scramble":
        case "object.shortcut.mesaledge": {
          // Broken rock steps jutting from the terrace face. The stepping
          // stones, crumbled wall, culvert and chasm-leap rungs reuse this
          // rock silhouette until their bespoke art lands.
          const stone = this.lambert("terrain.stone");
          for (const [sy, sx] of [[0.25, -0.25], [0.75, 0.05], [1.25, 0.3]] as const) {
            const step = this.tiledBox(0.5, 0.5, 0.5, stone);
            step.position.set(sx, sy, 0);
            group.add(step);
          }
          break;
        }
        case "object.shortcut.ropeswing":
        case "object.shortcut.handholds":
        case "object.shortcut.cliffclimb":
        case "object.shortcut.zipline":
        case "object.shortcut.wallrope":
        case "object.shortcut.cliffrope": {
          // A knotted rope hanging down the wall, anchored on a stake. The
          // rope-swing, handholds, cliff-climb and zip-line rungs reuse this
          // rope silhouette until their bespoke art lands.
          const ropeMat = new THREE.MeshLambertMaterial({ color: "#b09265" });
          const rope = new THREE.Mesh(new THREE.BoxGeometry(0.125, 2.4, 0.125), ropeMat);
          rope.position.y = 1.2;
          for (const ky of [0.5, 1.1, 1.7]) {
            const knot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.125, 0.25), ropeMat);
            knot.position.y = ky;
            group.add(knot);
          }
          const stake = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.4, 0.25),
            this.lambert("resource.tree.log.side"),
          );
          stake.position.y = 0.2;
          group.add(rope, stake);
          break;
        }
        case "object.buildsite.jetty":
        case "object.buildsite.footbridge":
        case "object.buildsite.ford":
        case "object.buildsite.ramp": {
          // A construction site: stacked materials and corner scaffold poles.
          const plankMat = this.lambert("terrain.plank");
          const pile = this.tiledBox(1, 1, 1, plankMat);
          pile.position.y = 0.5;
          const halfPile = this.tiledBox(1, 0.5, 0.5, plankMat);
          halfPile.position.set(0, 1.25, -0.2);
          group.add(pile, halfPile);
          const pole = this.lambert("resource.tree.log.side");
          for (const [px, pz] of [[-0.6, -0.6], [0.6, 0.6]] as const) {
            const scaffold = this.tiledBox(0.25, 2.2, 0.25, pole);
            scaffold.position.set(px, 1.1, pz);
            group.add(scaffold);
          }
          const beam = this.tiledBox(1.7, 0.25, 0.25, pole);
          beam.position.set(0, 2.1, 0);
          group.add(beam);
          break;
        }
        case "object.enchanter.basic": {
          // Enchanting-table proportions: a 12px dark base, red cloth top,
          // and an open tome resting above it.
          const dark = new THREE.MeshLambertMaterial({ color: "#221d2e" });
          const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.75, 1), dark);
          base.position.y = 0.375;
          const cloth = new THREE.Mesh(
            new THREE.BoxGeometry(0.9, 0.08, 0.9),
            new THREE.MeshLambertMaterial({ color: "#a4243b" }),
          );
          cloth.position.y = 0.79;
          const pages = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.08, 0.4),
            new THREE.MeshLambertMaterial({ color: "#efe6d5" }),
          );
          pages.position.y = 0.95;
          const spine = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.05, 0.08),
            new THREE.MeshLambertMaterial({ color: "#5d3a16" }),
          );
          spine.position.set(0, 0.92, 0);
          const glint = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshBasicMaterial({ color: "#b9a6ff" }),
          );
          glint.position.set(0.3, 1.1, -0.25);
          group.add(base, cloth, pages, spine, glint);
          break;
        }
        case "object.altar.rune": {
          // A carved stone plinth with a hovering, glowing rune above it.
          const stone = this.lambert("resource.rock.stone");
          const plinth = this.tiledBox(0.9, 0.55, 0.9, stone);
          plinth.position.y = 0.275;
          const top = this.tiledBox(1, 0.18, 1, this.lambert("terrain.calcite"));
          top.position.y = 0.64;
          const rune = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.28, 0.06),
            new THREE.MeshBasicMaterial({ color: "#8fd8ff" }),
          );
          rune.position.y = 1.15;
          const halo = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.02),
            new THREE.MeshBasicMaterial({ color: "#3a6fae", transparent: true, opacity: 0.4 }),
          );
          halo.position.y = 1.15;
          group.add(plinth, top, halo, rune, makeBlobShadow(0.55));
          break;
        }
        case "object.obelisk.summon": {
          // A tapering dark obelisk with a golden gem set near its crown.
          const dark = new THREE.MeshLambertMaterial({ color: "#2a2f3a" });
          const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.5), dark);
          shaft.position.y = 0.85;
          const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.34), new THREE.MeshLambertMaterial({ color: "#3a4150" }));
          cap.position.y = 1.75;
          const base = this.tiledBox(0.85, 0.22, 0.85, this.lambert("resource.rock.stone"));
          base.position.y = 0.11;
          const gem = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.2, 0.2),
            new THREE.MeshBasicMaterial({ color: "#ffd24a" }),
          );
          gem.position.y = 1.35;
          group.add(base, shaft, cap, gem, makeBlobShadow(0.5));
          break;
        }
        case "object.cauldron.basic": {
          // Vanilla cauldron proportions: a 16px shell on stub feet with a
          // 2px rim, the brew glowing inside.
          const iron = new THREE.MeshLambertMaterial({ color: "#3a3d42" });
          const shell = this.tiledBox(1, 0.75, 1, this.lambert("object.cauldron.side"));
          shell.position.y = 0.56;
          for (const [fx, fz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]] as const) {
            const foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.19, 0.25), iron);
            foot.position.set(fx, 0.09, fz);
            group.add(foot);
          }
          const brew = new THREE.Mesh(
            new THREE.BoxGeometry(0.75, 0.06, 0.75),
            new THREE.MeshBasicMaterial({ color: "#7fe0c3" }),
          );
          brew.position.y = 0.9;
          group.add(shell, brew);
          break;
        }
        case "object.workbench.basic": {
          // Crafting-table style: a full plank block with a scarred top.
          const bench = this.tiledBox(
            1, 1, 1,
            this.lambert("object.workbench.side"),
            this.lambert("object.workbench.top"),
          );
          bench.position.y = 0.5;
          group.add(bench);
          break;
        }
        case "object.buildbench.basic": {
          // Carpenter's Bench: a stout oak trestle with a saw biting a
          // half-cut plank clamped on top — reads as a woodworking station,
          // distinct from the plain crafting Workbench and the metal Anvil.
          const oak = this.lambert("resource.tree.log.side");
          const plank = this.lambert("terrain.plank");
          const top = this.tiledBox(0.95, 0.16, 0.62, plank);
          top.position.y = 0.5;
          group.add(top);
          for (const dx of [-0.36, 0.36] as const) for (const dz of [-0.22, 0.22] as const) {
            const leg = this.tiledBox(0.12, 0.5, 0.12, oak);
            leg.position.set(dx, 0.25, dz);
            group.add(leg);
          }
          // A board clamped on the bench, mid-cut.
          const board = this.tiledBox(0.7, 0.06, 0.24, plank);
          board.position.set(0.05, 0.61, -0.02);
          group.add(board);
          // The saw: a thin steel blade on a dark handle, angled into the cut.
          const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.02, 0.2, 0.34),
            new THREE.MeshLambertMaterial({ color: "#b8bcc2" }),
          );
          blade.position.set(0.18, 0.72, 0.06);
          blade.rotation.z = 0.5;
          const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.1, 0.12),
            new THREE.MeshLambertMaterial({ color: "#5a3a1e" }),
          );
          handle.position.set(0.30, 0.80, 0.06);
          // A mallet resting on the far corner.
          const mallet = this.tiledBox(0.1, 0.1, 0.22, oak);
          mallet.position.set(-0.32, 0.6, 0.16);
          group.add(blade, handle, mallet, makeBlobShadow(0.55));
          break;
        }
        case "object.anvil.basic": {
          // Classic silhouette: base, waist, and a long top with a horn.
          const iron = new THREE.MeshLambertMaterial({ color: "#3a3d42" });
          const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.5), iron);
          base.position.y = 0.09;
          const waist = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.3), iron);
          waist.position.y = 0.3;
          const top = new THREE.Mesh(
            new THREE.BoxGeometry(0.88, 0.2, 0.36),
            new THREE.MeshLambertMaterial({ color: "#4a4e54" }),
          );
          top.position.y = 0.52;
          const horn = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.2), iron);
          horn.position.set(0.5, 0.5, 0);
          group.add(base, waist, top, horn, makeBlobShadow(0.5));
          break;
        }
        case "object.store.basic":
        case "object.house.small":
        case "object.house.big": {
          // Medieval timber-frame buildings, each themed for what lives
          // inside. Roofs are laid in stair courses (full lower slab, set-
          // back upper half) exactly like stair-block roofs in-game.
          const cells = [obj.cell, ...(obj.footprint ?? [])];
          const xs = cells.map((c) => c.x - obj.cell.x);
          const zs = cells.map((c) => c.z - obj.cell.z);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minZ = Math.min(...zs), maxZ = Math.max(...zs);
          const w = maxX - minX + 1;
          const d = maxZ - minZ + 1;
          const cx = (minX + maxX) / 2;
          const cz = (minZ + maxZ) / 2;
          const brick = this.lambert("terrain.stonebrick");
          const log = this.lambert("resource.tree.log.side");

          interface HouseTheme {
            plaster: string;
            roof: string;
            wallH: number;
            axis: "x" | "z";
            stoneWaist?: boolean; // mason: stone up to the beam
            stoneWalls?: boolean; // barracks: all masonry
            crossWing?: boolean; // woodworker: L-shaped double gable
            flowerBoxes?: boolean;
            barrels?: boolean;
            hangingSign?: string; // sign board color
          }
          // Roofs are real block materials (plank shingles, dark oak,
          // slate tiles, stone) — never flat paint.
          const THEMES: Record<string, HouseTheme> = {
            "town.store.001": { plaster: "#e8e0cf", roof: "roof.shingle", wallH: 4, axis: "x", barrels: true },
            "town.inn.001": { plaster: "#e8dcc0", roof: "roof.darkoak", wallH: 5, axis: "x", hangingSign: "#c0455a" },
            "town.house.001": { plaster: "#cfdce3", roof: "roof.slate", wallH: 4, axis: "z", barrels: true },
            "town.house.002": { plaster: "#e4e8cf", roof: "terrain.plank", wallH: 4, axis: "x", flowerBoxes: true },
            "town.house.003": { plaster: "#e0d8c8", roof: "terrain.stone", wallH: 4, axis: "z", stoneWaist: true },
            "town.house.004": { plaster: "#e8e0cf", roof: "roof.shingle", wallH: 4, axis: "x", crossWing: true },
            "castle.barracks.001": { plaster: "#b9bcbf", roof: "roof.slate", wallH: 4, axis: "x", stoneWalls: true, hangingSign: "#a4243b" },
            "castle.storehouse.001": { plaster: "#e0d4b8", roof: "roof.shingle", wallH: 4, axis: "z", barrels: true },
          };
          // Named buildings keep their authored themes; every other house
          // derives one from its instance id so no two neighbours match.
          const roll = (salt: number): number => {
            let hsh = 2166136261 ^ salt;
            for (let i = 0; i < obj.instanceId.length; i++) {
              hsh = Math.imul(hsh ^ obj.instanceId.charCodeAt(i), 16777619);
            }
            return ((hsh >>> 0) % 1024) / 1024;
          };
          const PLASTERS = ["#e8e0cf", "#cfdce3", "#e4e8cf", "#e0d8c8", "#e6d3b3", "#d9cfe0", "#cfe0d8", "#e8d6c4"];
          const ROOFS = ["roof.shingle", "roof.slate", "roof.darkoak", "terrain.plank", "roof.shingle"];
          const derived: HouseTheme = {
            plaster: PLASTERS[Math.floor(roll(1) * PLASTERS.length)],
            roof: ROOFS[Math.floor(roll(2) * ROOFS.length)],
            wallH: roll(3) < 0.3 ? 5 : 4,
            axis: w >= d ? "x" : "z",
            stoneWaist: roll(4) < 0.28,
            flowerBoxes: roll(5) < 0.4,
            barrels: roll(6) < 0.35,
            crossWing: w >= 8 && roll(7) < 0.5,
          };
          const theme = THEMES[obj.instanceId] ?? derived;
          const wallH = theme.wallH;
          const plaster = this.lambert("wall.plaster");
          plaster.color.set(theme.plaster);
          const roofMat = this.lambert(theme.roof);

          // Foundation and walls (masonry themes swap materials).
          const base = this.tiledBox(w, theme.stoneWaist ? 2 : 1, d, brick);
          base.position.set(cx, theme.stoneWaist ? 1 : 0.5, cz);
          const wallMat = theme.stoneWalls ? brick : plaster;
          const wallBase = theme.stoneWaist ? 2 : 1;
          const walls = this.tiledBox(w, wallH - wallBase, d, wallMat);
          walls.position.set(cx, wallBase + (wallH - wallBase) / 2, cz);
          group.add(base, walls);
          // Timber frame: proud corner posts, waist beam, top plate.
          for (const [px, pz] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]] as const) {
            const post = this.tiledBox(1.08, wallH, 1.08, theme.stoneWalls ? brick : log);
            post.position.set(px, wallH / 2, pz);
            group.add(post);
          }
          if (!theme.stoneWalls) {
            const waist = this.tiledBox(w + 0.08, 0.28, d + 0.08, log);
            waist.position.set(cx, theme.stoneWaist ? 2.15 : 2.45, cz);
            group.add(waist);
          }
          const plate = this.tiledBox(w + 0.08, 0.36, d + 0.08, log);
          plate.position.set(cx, wallH - 0.18, cz);
          group.add(plate);

          // Windows with frames and sills; gable ends get one each.
          const southZ = cz + d / 2;
          const addWindow = (wx: number, wz: number, rotated = false) => {
            const frame = new THREE.Mesh(
              new THREE.BoxGeometry(rotated ? 0.14 : 0.92, 1.0, rotated ? 0.92 : 0.14),
              new THREE.MeshLambertMaterial({ color: "#4a3823" }),
            );
            frame.position.set(wx, 2.2, wz);
            const pane = new THREE.Mesh(
              new THREE.BoxGeometry(rotated ? 0.16 : 0.64, 0.72, rotated ? 0.64 : 0.16),
              new THREE.MeshBasicMaterial({ color: "#cfe8ff" }),
            );
            pane.position.set(wx, 2.2, wz);
            const sill = new THREE.Mesh(
              new THREE.BoxGeometry(rotated ? 0.2 : 1.04, 0.12, rotated ? 1.04 : 0.2),
              this.lambert("resource.tree.log.top"),
            );
            sill.position.set(wx, 1.64, wz);
            group.add(frame, pane, sill);
            if (!rotated) {
              for (const side of [-1, 1]) {
                const shutter = new THREE.Mesh(
                  new THREE.BoxGeometry(0.3, 0.96, 0.1),
                  new THREE.MeshLambertMaterial({ color: "#5d4626" }),
                );
                shutter.position.set(wx + side * 0.66, 2.2, wz + 0.02);
                group.add(shutter);
              }
            }
            if (theme.flowerBoxes && !rotated) {
              const box = new THREE.Mesh(
                new THREE.BoxGeometry(1.0, 0.24, 0.3),
                new THREE.MeshLambertMaterial({ color: "#5d4626" }),
              );
              box.position.set(wx, 1.4, wz + 0.16);
              group.add(box);
              for (const [fx, color] of [[-0.28, "#d0484f"], [0, "#e6c94e"], [0.28, "#efe3ef"]] as const) {
                const bloom = new THREE.Mesh(
                  new THREE.BoxGeometry(0.16, 0.14, 0.16),
                  new THREE.MeshLambertMaterial({ color }),
                );
                bloom.position.set(wx + fx, 1.58, wz + 0.16);
                group.add(bloom);
              }
            }
          };
          for (const off of w >= 7 ? [-2.5, 2.5] : [-1.6, 1.6]) {
            addWindow(cx + off, southZ + 0.02);
          }
          addWindow(minX - 0.52, (minZ + maxZ) / 2, true);
          addWindow(maxX + 0.52, (minZ + maxZ) / 2, true);
          // A real textured door panel set into the south face, with its
          // frame — the same two-half construction as free-hung doors.
          const doorFrameMat = this.lambert("resource.tree.log.side");
          for (const fx of [-0.62, 0.62]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.22), doorFrameMat);
            post.position.set(cx + fx, 1.1, southZ);
            group.add(post);
          }
          const doorLintel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.22), doorFrameMat);
          doorLintel.position.set(cx, 2.24, southZ);
          group.add(doorLintel);
          const doorEdge = this.lambert("terrain.plank");
          for (const [id, py] of [["object.door.bottom", 0.5], ["object.door.top", 1.5]] as const) {
            const doorFace = new THREE.MeshLambertMaterial({
              map: this.materials.texture(id),
              alphaTest: 0.5,
            });
            const half = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1875), [
              doorEdge, doorEdge, doorEdge, doorEdge, doorFace, doorFace,
            ]);
            half.position.set(cx, py, southZ);
            group.add(half);
          }

          // Stair-course gable roof: every course's eaves are true stair
          // profiles — a full-depth lower half-slab with a set-back upper.
          const stairRoof = (
            rcx: number, rcz: number, rw: number, rd: number, alongX: boolean, topY: number,
          ): number => {
            const longLen = (alongX ? rw : rd) + 2;
            const span = (alongX ? rd : rw) + 2;
            let peak = topY;
            for (let i = 0; ; i++) {
              const remain = span - i * 2;
              if (remain <= 0) break;
              const y = topY + 0.5 + i;
              if (remain <= 1) {
                const ridge = new THREE.Mesh(
                  alongX
                    ? new THREE.BoxGeometry(longLen, 1, 1)
                    : new THREE.BoxGeometry(1, 1, longLen),
                  roofMat,
                );
                ridge.position.set(rcx, y, rcz);
                group.add(ridge);
                peak = y + 0.5;
                break;
              }
              if (remain > 2) {
                const core = new THREE.Mesh(
                  alongX
                    ? new THREE.BoxGeometry(longLen, 1, remain - 2)
                    : new THREE.BoxGeometry(remain - 2, 1, longLen),
                  roofMat,
                );
                core.position.set(rcx, y, rcz);
                group.add(core);
              }
              for (const side of [-1, 1]) {
                const edgeOff = side * (remain / 2 - 0.5);
                const stepLower = new THREE.Mesh(
                  alongX
                    ? new THREE.BoxGeometry(longLen, 0.5, 1)
                    : new THREE.BoxGeometry(1, 0.5, longLen),
                  roofMat,
                );
                stepLower.position.set(
                  rcx + (alongX ? 0 : edgeOff), y - 0.25, rcz + (alongX ? edgeOff : 0),
                );
                const backOff = side * (remain / 2 - 0.75);
                const stepUpper = new THREE.Mesh(
                  alongX
                    ? new THREE.BoxGeometry(longLen, 0.5, 0.5)
                    : new THREE.BoxGeometry(0.5, 0.5, longLen),
                  roofMat,
                );
                stepUpper.position.set(
                  rcx + (alongX ? 0 : backOff), y + 0.25, rcz + (alongX ? backOff : 0),
                );
                group.add(stepLower, stepUpper);
              }
              peak = y + 0.5;
            }
            return peak;
          };

          let peak: number;
          if (theme.crossWing) {
            // L-shape: a long body with a perpendicular wing at the east end.
            const wingW = 3;
            const bodyW = w - wingW;
            const bodyCx = minX + (bodyW - 1) / 2;
            const wingCx = maxX - (wingW - 1) / 2;
            peak = stairRoof(bodyCx, cz, bodyW, d, true, wallH);
            const wingPeak = stairRoof(wingCx, cz, wingW, d, false, wallH);
            peak = Math.max(peak, wingPeak);
          } else {
            peak = stairRoof(cx, cz, w, d, theme.axis === "x", wallH);
          }

          // A little stair canopy shelters the door, with a lantern beside
          // it and shutters on the south windows.
          const canopyLow = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1), roofMat);
          canopyLow.position.set(cx, 2.55, southZ + 0.4);
          const canopyHigh = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 0.5), roofMat);
          canopyHigh.position.set(cx, 3.05, southZ + 0.15);
          group.add(canopyLow, canopyHigh);
          const lanternCap = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.08, 0.3),
            new THREE.MeshLambertMaterial({ color: "#3a3d42" }),
          );
          lanternCap.position.set(cx + 1.3, 2.5, southZ + 0.2);
          const lantern = this.makeLantern().mesh;
          lantern.position.set(cx + 1.3, 2.25, southZ + 0.2);
          group.add(lanternCap, lantern);

          // Stone doorstep slab.
          const doorstep = this.tiledBox(1.25, 0.5, 0.9, brick);
          doorstep.position.set(cx, 0.25, southZ + 0.55);
          group.add(doorstep);

          // Theme props.
          if (theme.barrels) {
            const barrel = this.tiledBox(1, 1, 1, log);
            barrel.position.set(maxX + 1, 0.5, maxZ - 0.5);
            const hoop = new THREE.Mesh(
              new THREE.BoxGeometry(1.04, 0.125, 1.04),
              new THREE.MeshLambertMaterial({ color: "#3a3d42" }),
            );
            hoop.position.set(maxX + 1, 0.7, maxZ - 0.5);
            group.add(barrel, hoop);
          }
          if (theme.hangingSign) {
            const arm = this.tiledBox(1.2, 0.14, 0.14, log);
            arm.position.set(cx + 1.6, wallH - 0.6, southZ + 0.5);
            const board = new THREE.Mesh(
              new THREE.BoxGeometry(0.8, 0.6, 0.1),
              new THREE.MeshLambertMaterial({ color: theme.hangingSign }),
            );
            board.position.set(cx + 2.0, wallH - 1.15, southZ + 0.5);
            group.add(arm, board);
          }
          if (obj.defId === "object.store.basic") {
            const awning = new THREE.Mesh(
              new THREE.BoxGeometry(w - 1, 0.14, 1.1),
              new THREE.MeshLambertMaterial({ color: "#c0455a" }),
            );
            awning.position.set(cx, 2.9, southZ + 0.5);
            const trim = new THREE.Mesh(
              new THREE.BoxGeometry(w - 1, 0.12, 0.24),
              new THREE.MeshLambertMaterial({ color: "#efe6d5" }),
            );
            trim.position.set(cx, 2.82, southZ + 1.0);
            const coin = new THREE.Mesh(
              new THREE.BoxGeometry(0.3, 0.3, 0.07),
              new THREE.MeshBasicMaterial({ color: "#ffd54a" }),
            );
            coin.position.set(cx, 2.3, southZ + 0.1);
            group.add(awning, trim, coin);
          }
          break;
        }
        case "object.well.basic": {
          const brick = this.lambert("object.furnace.side");
          const ring = this.tiledBox(0.95, 0.55, 0.95, brick);
          ring.position.y = 0.27;
          const hole = new THREE.Mesh(
            new THREE.BoxGeometry(0.55, 0.58, 0.55),
            new THREE.MeshBasicMaterial({ color: "#0a1016" }),
          );
          hole.position.y = 0.29;
          const wood = this.lambert("resource.tree.log.side");
          for (const px of [-0.42, 0.42]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.1), wood);
            post.position.set(px, 0.85, 0);
            group.add(post);
          }
          const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.09), wood);
          crossbar.position.set(0, 1.32, 0);
          const roof = this.tiledBox(1.25, 0.22, 0.8, wood);
          roof.position.y = 1.5;
          group.add(ring, hole, crossbar, roof);
          break;
        }
        case "object.door.wood": {
          // Minecraft-proportioned door: a 1x2 panel, 3/16 thin, hung flush
          // against the building face on the north edge of its cell, with
          // its frame, four little panes up top, and a brass handle.
          const frameMat = this.lambert("resource.tree.log.side");
          const face = -0.44; // north edge of the door cell = the wall plane
          for (const fx of [-0.55, 0.55]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.2), frameMat);
            post.position.set(fx, 1.1, face);
            group.add(post);
          }
          const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.18, 0.2), frameMat);
          lintel.position.set(0, 2.24, face);
          // Two stacked halves so door art (window in the upper half) maps
          // exactly; pack door windows are cutouts, so dark panes sit inside
          // the panel and read as glass through the holes.
          // The swinging leaf lives in its own group hinged at the left post
          // so click-to-open can rotate it; frame and step stay put.
          const leaf = new THREE.Group();
          leaf.position.set(-0.5, 0, face); // hinge at the left jamb, in the wall plane
          const edge = this.lambert("terrain.plank");
          for (const [id, py] of [["object.door.bottom", 0.5], ["object.door.top", 1.5]] as const) {
            const faceMat = new THREE.MeshLambertMaterial({
              map: this.materials.texture(id),
              alphaTest: 0.5,
            });
            const half = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1875), [
              edge, edge, edge, edge, faceMat, faceMat,
            ]);
            half.position.set(0.5, py, 0); // panel centre, one unit right of the hinge
            leaf.add(half);
          }
          for (const px of [-0.17, 0.17]) {
            for (const py of [1.55, 1.85]) {
              const pane = new THREE.Mesh(
                new THREE.BoxGeometry(0.1875, 0.1875, 0.02),
                new THREE.MeshBasicMaterial({ color: "#1d2a38" }),
              );
              pane.position.set(0.5 + px, py, 0);
              leaf.add(pane);
            }
          }
          const handle = new THREE.Mesh(
            new THREE.BoxGeometry(0.125, 0.125, 0.22),
            new THREE.MeshBasicMaterial({ color: "#c9a227" }),
          );
          handle.position.set(0.84, 1.0, 0);
          leaf.add(handle);
          leaf.userData.doorLeaf = true;
          this.doorLeaves.set(obj.instanceId, leaf);
          group.add(leaf);
          const step = this.tiledBox(1, 0.14, 0.6, this.lambert("terrain.stonebrick"));
          step.position.set(0, 0.07, face + 0.35);
          group.add(lintel, step);
          // Turn the whole door (frame, swinging leaf, step) to face the wall
          // it hangs on. Built facing north (-z); rotate to the placement's
          // facing. The leaf still swings relative to this, so open still works.
          group.rotation.y = obj.facing === "south" ? Math.PI
            : obj.facing === "east" ? -Math.PI / 2
            : obj.facing === "west" ? Math.PI / 2
            : 0;
          break;
        }
        case "object.gate.oak": {
          // A Minecraft oak fence gate: just the swinging gate — two rails and
          // vertical slats spanning the full cell — hung between the posts of
          // the oak fences on either side (which supply the posts, so we add
          // none of our own). Same plank wood as the fences, so the line reads
          // continuous. The leaf is a doorLeaf so click-to-open/close rotates it.
          const wood = this.lambert("terrain.plank");
          const leaf = new THREE.Group();
          leaf.position.set(-0.5, 0, 0); // hinge at the left fence post
          for (const py of [0.6, 1.15]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.16, 0.16), wood);
            rail.position.set(0.5, py, 0); // spans post to post
            leaf.add(rail);
          }
          for (const sx of [0.15, 0.5, 0.85]) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.13), wood);
            slat.position.set(sx, 0.875, 0);
            leaf.add(slat);
          }
          leaf.userData.doorLeaf = true;
          this.doorLeaves.set(obj.instanceId, leaf);
          group.add(leaf, makeBlobShadow(0.5));
          group.rotation.y = obj.facing === "south" ? Math.PI
            : obj.facing === "east" ? -Math.PI / 2
            : obj.facing === "west" ? Math.PI / 2
            : 0;
          break;
        }
        case "object.stairs.up":
        case "object.stairs.down": {
          // Clickable staircase: stepped stone blocks rising toward the back,
          // with a glow marking the landing (bright going up, dark going down).
          const up = obj.defId === "object.stairs.up";
          const stone = this.lambert("terrain.stone");
          for (let i = 0; i < 4; i++) {
            const step = this.tiledBox(0.9, 0.24, 0.26, stone);
            step.position.set(0, 0.12 + i * 0.24, 0.36 - i * 0.24);
            group.add(step);
          }
          const landing = new THREE.Mesh(
            new THREE.PlaneGeometry(0.86, 0.5),
            new THREE.MeshBasicMaterial({ color: up ? "#ffe9b0" : "#05070c" }),
          );
          landing.rotation.x = -Math.PI / 2 + 0.35;
          landing.position.set(0, 1.06, -0.42);
          group.add(landing);
          break;
        }
        case "object.counter.shop": {
          const wood = this.lambert("resource.tree.log.side");
          const base = this.tiledBox(1.3, 0.7, 0.55, wood);
          base.position.y = 0.35;
          const top = this.tiledBox(1.45, 0.12, 0.7, this.lambert("resource.tree.log.top"));
          top.position.y = 0.76;
          const coin = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.2, 0.05),
            new THREE.MeshBasicMaterial({ color: "#ffd54a" }),
          );
          coin.position.set(0.3, 0.88, 0.1);
          coin.rotation.x = -Math.PI / 2;
          group.add(base, top, coin);
          break;
        }
        case "object.banner.red": {
          const pole = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 2.6, 0.08),
            this.lambert("resource.tree.log.side"),
          );
          pole.position.y = 1.3;
          const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 0.08, 0.08),
            new THREE.MeshBasicMaterial({ color: "#c9a227" }),
          );
          bar.position.y = 2.45;
          const cloth = new THREE.Mesh(
            new THREE.BoxGeometry(0.56, 1.5, 0.06),
            new THREE.MeshLambertMaterial({ color: "#a4243b" }),
          );
          cloth.position.set(0, 1.65, 0.08);
          const emblem = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.24, 0.03),
            new THREE.MeshBasicMaterial({ color: "#ffd54a" }),
          );
          emblem.position.set(0, 1.85, 0.13);
          group.add(pole, bar, cloth, emblem);
          break;
        }
        case "object.bed.basic": {
          // Minecraft bed proportions: 1 block wide, 2 long, 9/16 high,
          // head at the placement cell, foot on the footprint cell.
          const foot = obj.footprint?.[0] ?? { x: obj.cell.x, z: obj.cell.z + 1 };
          const dx = foot.x - obj.cell.x;
          const dz = foot.z - obj.cell.z;
          const along = (v: number) => new THREE.Vector3(dx * v, 0, dz * v);
          const horizontal = dx !== 0;
          const boxDims = (w: number, len: number, h: number) =>
            horizontal ? ([len, h, w] as const) : ([w, h, len] as const);
          const mk = (w: number, len: number, h: number, color: string) =>
            new THREE.Mesh(new THREE.BoxGeometry(...boxDims(w, len, h)), new THREE.MeshLambertMaterial({ color }));
          const frame = mk(0.95, 1.95, 0.32, "#6e4620");
          frame.position.copy(along(0.5));
          frame.position.y = 0.16;
          const mattress = mk(0.85, 1.85, 0.16, "#e8e2d4");
          mattress.position.copy(along(0.5));
          mattress.position.y = 0.4;
          const blanket = mk(0.87, 1.1, 0.1, "#c0455a");
          blanket.position.copy(along(0.9));
          blanket.position.y = 0.46;
          const pillow = mk(0.6, 0.4, 0.1, "#f5f2ea");
          pillow.position.copy(along(0.06));
          pillow.position.y = 0.46;
          group.add(frame, mattress, blanket, pillow);
          break;
        }
        case "object.table.basic": {
          const wood = this.lambert("resource.tree.log.side");
          const top = this.tiledBox(0.95, 0.12, 0.95, wood); // dark top: reads against plank floors
          top.position.y = 0.62;
          group.add(top);
          for (const [lx, lz] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.1), wood);
            leg.position.set(lx, 0.31, lz);
            group.add(leg);
          }
          break;
        }
        case "object.spire.large":
        case "object.spire.small": {
          // Tower cap: an overhanging crenellated stone ring sitting on the
          // terrain tower below, a steep dark spire of shrinking slabs, a red
          // flag at the point, and lit windows dressing the shaft beneath.
          const large = obj.defId === "object.spire.large";
          const brick = this.lambert("object.furnace.side");
          const slate = this.lambert("roof.darkoak");
          const cap = this.tiledBox(5, 1, 5, brick);
          cap.position.y = 0.5;
          group.add(cap);
          for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
              if (Math.abs(dx) !== 2 && Math.abs(dz) !== 2) continue;
              if ((dx + dz + 4) % 2 !== 0) continue;
              const merlon = this.tiledBox(1, 1, 1, brick);
              merlon.position.set(dx, 1.5, dz);
              group.add(merlon);
            }
          }
          // Stepped whole-block cone, the way castle caps are laid in-game.
          const widths = large ? [3, 3, 2, 1, 1] : [3, 2, 1];
          widths.forEach((sw, i) => {
            const step = new THREE.Mesh(new THREE.BoxGeometry(sw, 1, sw), slate);
            step.position.y = 2 + i;
            group.add(step);
          });
          const tip = 1.5 + widths.length;
          const pole = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 1.3, 0.07),
            this.lambert("resource.tree.log.side"),
          );
          pole.position.y = tip + 0.6;
          const flag = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 0.5, 0.05),
            new THREE.MeshLambertMaterial({ color: "#b3202e" }),
          );
          flag.position.set(0.46, tip + 0.95, 0);
          group.add(pole, flag);
          // Lit windows down the shaft (the shaft itself is terrain blocks).
          const glow = new THREE.MeshLambertMaterial({ color: "#2b2312", emissive: new THREE.Color("#ffd873") });
          const face = large ? 2.52 : 1.52;
          const rows = large ? [-2.5, -4.5, -6.5] : [-2, -4];
          for (const wy of rows) {
            const pane = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.08), glow);
            pane.position.set(0, wy, face);
            group.add(pane);
          }
          break;
        }
        case "object.keep.grand": {
          // The great keep, after the reference build: a stone-brick base
          // story, a log beam band, a timber-framed plank upper story with
          // rows of lit windows, and a steep gable roof of dark slabs with
          // red flags flying from both ridge ends.
          const cells = [obj.cell, ...(obj.footprint ?? [])];
          const xs = cells.map((c) => c.x - obj.cell.x);
          const zs = cells.map((c) => c.z - obj.cell.z);
          const minX = Math.min(...xs), maxX = Math.max(...xs);
          const minZ = Math.min(...zs), maxZ = Math.max(...zs);
          const w = maxX - minX + 1;
          const d = maxZ - minZ + 1;
          const cx = (minX + maxX) / 2;
          const cz = (minZ + maxZ) / 2;
          const brick = this.lambert("object.furnace.side");
          const log = this.lambert("resource.tree.log.side");
          const plank = this.lambert("terrain.plank");
          const slate = this.lambert("roof.darkoak");
          const glow = new THREE.MeshLambertMaterial({ color: "#2b2312", emissive: new THREE.Color("#ffd873") });
          const baseH = 4, bandH = 1, upperH = 4, capH = 1;
          const wallH = baseH + bandH + upperH + capH;

          const base = this.tiledBox(w, baseH, d, brick);
          base.position.set(cx, baseH / 2, cz);
          const band = this.tiledBox(w, bandH, d, log);
          band.position.set(cx, baseH + bandH / 2, cz);
          const upper = this.tiledBox(w, upperH, d, plank);
          upper.position.set(cx, baseH + bandH + upperH / 2, cz);
          const capBand = this.tiledBox(w, capH, d, log);
          capBand.position.set(cx, wallH - capH / 2, cz);
          group.add(base, band, upper, capBand);

          // Dressed stone quoins up the base-story corners.
          for (const [qx, qz] of [[minX, minZ], [maxX, minZ], [minX, maxZ], [maxX, maxZ]] as const) {
            const quoin = this.tiledBox(1.12, baseH, 1.12, brick);
            quoin.position.set(qx, baseH / 2, qz);
            group.add(quoin);
          }
          // Timber framing: log posts up the upper story, slightly proud.
          for (let px = minX; px <= maxX; px += 4) {
            for (const pz of [minZ, maxZ]) {
              const post = this.tiledBox(1, upperH, 1.12, log);
              post.position.set(px, baseH + bandH + upperH / 2, pz);
              group.add(post);
            }
          }
          for (let pz = minZ; pz <= maxZ; pz += 5) {
            for (const px of [minX, maxX]) {
              const post = this.tiledBox(1.12, upperH, 1, log);
              post.position.set(px, baseH + bandH + upperH / 2, pz);
              group.add(post);
            }
          }
          // Steep gable roof along the x-axis, laid in stair courses: each
          // eave is a full lower half-slab with a set-back upper half.
          for (let i = 0; ; i++) {
            const rd = d + 2 - i * 2;
            if (rd <= 0) break;
            const y = wallH + 0.5 + i;
            if (rd <= 1) {
              const ridge = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1, 1), slate);
              ridge.position.set(cx, y, cz);
              group.add(ridge);
              break;
            }
            if (rd > 2) {
              const core = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1, rd - 2), slate);
              core.position.set(cx, y, cz);
              group.add(core);
            }
            for (const side of [-1, 1]) {
              const lower = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.5, 1), slate);
              lower.position.set(cx, y - 0.25, cz + side * (rd / 2 - 0.5));
              const upper = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 0.5, 0.5), slate);
              upper.position.set(cx, y + 0.25, cz + side * (rd / 2 - 0.75));
              group.add(lower, upper);
            }
          }
          const ridgeY = wallH + Math.ceil((d + 2) / 2);
          for (const fx of [-1, 1]) {
            const pole = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2, 0.09), log);
            pole.position.set(cx + fx * (w / 2 - 0.5), ridgeY + 0.6, cz);
            const flag = new THREE.Mesh(
              new THREE.BoxGeometry(1.1, 0.65, 0.06),
              new THREE.MeshLambertMaterial({ color: "#b3202e" }),
            );
            flag.position.set(cx + fx * (w / 2 - 0.5) + fx * 0.6, ridgeY + 1.2, cz);
            group.add(pole, flag);
          }
          // Lit windows: rows spanning the south face (toward the camera),
          // one bay every four blocks, leaving the entrance bay clear.
          const southZ = cz + d / 2 + 0.06;
          for (let wx = minX + 2; wx <= maxX - 2; wx += 4) {
            for (const wy of [baseH + bandH + 1.4, baseH + bandH + upperH - 1.2]) {
              const upperWin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.1), glow);
              upperWin.position.set(wx, wy, southZ);
              group.add(upperWin);
            }
            if (Math.abs(wx) < 4) continue; // the entrance bay below
            const baseWin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.1), glow);
            baseWin.position.set(wx, 2.2, southZ);
            group.add(baseWin);
          }
          // A timbered balcony over the entrance, and chimneys on the slopes.
          const balcony = this.tiledBox(5, 0.34, 1.4, log);
          balcony.position.set(0, baseH + bandH + 0.2, cz + d / 2 + 0.6);
          group.add(balcony);
          for (const bx of [-2.2, 2.2]) {
            const rail = this.tiledBox(0.16, 1.0, 0.16, log);
            rail.position.set(bx, baseH + bandH + 0.9, cz + d / 2 + 1.1);
            group.add(rail);
          }

          // Grand entrance arch protruding around the (separate) door object,
          // which stands one cell south of the wall face.
          for (const ax of [-1.5, 1.5]) {
            const pillar = this.tiledBox(1, 3, 1.2, brick);
            pillar.position.set(ax, 1.5, cz + d / 2 + 0.35);
            group.add(pillar);
          }
          const lintel = this.tiledBox(4, 1, 1.2, brick);
          lintel.position.set(0, 3.5, cz + d / 2 + 0.35);
          group.add(lintel);
          break;
        }
        case "object.fence.wood": {
          // MC fence proportions: a 4px post, rails reaching only toward
          // neighboring fence cells so runs read as continuous.
          const wood = this.lambert("resource.tree.log.side");
          const post = this.tiledBox(0.25, 1, 0.25, wood);
          post.position.y = 0.5;
          group.add(post);
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            if (!fenceCells.has(`${obj.cell.x + dx},${obj.cell.z + dz}`)) continue;
            for (const railY of [0.469, 0.844]) {
              const rail = this.tiledBox(
                dx !== 0 ? 0.5 : 0.125,
                0.1875,
                dz !== 0 ? 0.5 : 0.125,
                wood,
              );
              rail.position.set(dx * 0.25, railY, dz * 0.25);
              group.add(rail);
            }
          }
          break;
        }
        case "object.torch.wall": {
          // A standing torch at vanilla size: crossed planes of the torch
          // sprite (2px stick, glowing tip) rising ~10px from its footing.
          // The sprite's own coal tip reads as the flame; no separate flaring
          // flame sprite this version. The lighting pass hangs a warm point
          // light on it after dark.
          const torch = this.crossSprite("sprite.torch");
          torch.group.scale.set(0.7, 0.7, 0.7);
          group.add(torch.group);
          break;
        }
        case "object.lamp.post": {
          // The classic Minecraft street lamp: a fence post carrying a
          // lantern at its vanilla model size (6px wide, 7px tall).
          const post = this.tiledBox(0.25, 2.5, 0.25, this.lambert("resource.tree.log.side"));
          post.position.y = 1.25;
          const cage = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.0625, 0.5),
            new THREE.MeshLambertMaterial({ color: "#3a3d42" }),
          );
          cage.position.y = 2.53;
          const lantern = this.makeLantern().mesh;
          lantern.position.y = 2.28;
          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.125, 0.25),
            new THREE.MeshLambertMaterial({ color: "#3a3d42" }),
          );
          cap.position.y = 2.56;
          group.add(post, cage, lantern, cap);
          break;
        }
        case "object.stall.market": {
          // Market stall: corner posts, a counter, goods, striped awning.
          const cells = [obj.cell, ...(obj.footprint ?? [])];
          const w = Math.max(...cells.map((c) => c.x)) - Math.min(...cells.map((c) => c.x)) + 1;
          const cx = (w - 1) / 2;
          const wood = this.lambert("resource.tree.log.side");
          for (const px of [-0.5, w - 0.5]) {
            for (const pz of [-0.35, 0.35]) {
              const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.0, 0.25), wood);
              post.position.set(px + 0.0, 1.0, pz);
              group.add(post);
            }
          }
          const counter = this.tiledBox(w - 0.2, 0.8, 0.7, wood);
          counter.position.set(cx, 0.4, 0);
          group.add(counter);
          for (const [gx, color] of [[-0.25, "#c94f4f"], [0.15, "#e0c04a"], [0.55, "#5a8f4a"]] as const) {
            const goods = new THREE.Mesh(
              new THREE.BoxGeometry(0.26, 0.2, 0.3),
              new THREE.MeshLambertMaterial({ color }),
            );
            goods.position.set(cx + gx, 0.9, 0);
            group.add(goods);
          }
          const awning = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.3, 0.1875, 1.1),
            new THREE.MeshLambertMaterial({ color: "#c0455a" }),
          );
          awning.position.set(cx, 2.05, 0.1);
          const trim = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.3, 0.1, 0.2),
            new THREE.MeshLambertMaterial({ color: "#efe6d5" }),
          );
          trim.position.set(cx, 1.98, 0.62);
          group.add(awning, trim);
          break;
        }
        case "object.crate.wood": {
          // A full plank block — crates are whole blocks, like everything.
          const crate = this.tiledBox(1, 1, 1, this.lambert("terrain.plank"));
          crate.position.y = 0.5;
          group.add(crate);
          break;
        }
        case "object.barrel.wood": {
          // Barrels are full 1x1x1 blocks in Minecraft; hoops live in the art.
          const body = this.tiledBox(1, 1, 1, this.lambert("object.barrel.side"), this.lambert("object.barrel.top"));
          body.position.y = 0.5;
          group.add(body);
          break;
        }
        case "object.flowers.wild": {
          // Flowers are cross-sprites in Minecraft; ours too.
          const bloom = this.crossSprite("sprite.flowers.wild");
          bloom.group.rotation.y = hash01(obj.instanceId) * Math.PI;
          group.add(bloom.group);
          break;
        }
        case "object.portal.graduate": {
          // A Minecraft Nether-style gateway: a dark obsidian frame around a
          // wide 2×3 opening, with the glowing membrane filling ONLY the
          // interior (the frame itself doesn't glow). Step through to leave the
          // tutorial for a fresh random world. All cubes.
          const obsidian = new THREE.MeshLambertMaterial({ color: "#160f22" });
          const bar = (w: number, h: number, x: number, y: number) => {
            const b = this.tiledBox(w, h, 0.5, obsidian);
            b.position.set(x, y, 0);
            group.add(b);
          };
          bar(0.5, 4, -1.25, 2);  // left post
          bar(0.5, 4, 1.25, 2);   // right post
          bar(3, 0.5, 0, 3.75);   // top lintel
          bar(3, 0.5, 0, 0.25);   // bottom sill
          // The purple portal surface — glows and pulses, only within the frame.
          const glowMat = new THREE.MeshBasicMaterial({
            color: "#a35bff", transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
          });
          const membrane = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.14), glowMat);
          membrane.position.set(0, 2, 0);
          group.add(membrane, makeBlobShadow(1.2));
          this.portalGlows.push({ mat: glowMat, base: 0.6, amp: 0.2, group });
          break;
        }
        case "object.portal.cave": {
          // Cave mouth in the rock outcrop: the walls around this cell are
          // real terrain blocks (see makeValeRegion); here we add the unit
          // stone roof block bridging them, the dark void beneath it, and
          // stalactite teeth — all axis-aligned to the grid.
          const stone = this.lambert("terrain.stone");
          const roof = this.tiledBox(1, 1, 1, stone);
          roof.position.y = 2.5;
          const void_ = new THREE.Mesh(
            new THREE.BoxGeometry(0.96, 2.0, 0.96),
            new THREE.MeshBasicMaterial({ color: "#04060a" }),
          );
          void_.position.y = 1.0;
          group.add(roof, void_);
          // Teeth hang from the roof over the open south face.
          for (const [x, z, len] of [
            [-0.32, 0.48, 0.28], [0.05, 0.48, 0.2], [0.34, 0.48, 0.26],
          ] as const) {
            const tooth = this.tiledBox(0.14, len, 0.14, stone);
            tooth.position.set(x, 2.0 - len / 2, z);
            group.add(tooth);
          }
          // A glowing portal membrane fills the mouth so the gate reads as
          // an active, lit entrance (not a dead dark hole). MeshBasic ignores
          // scene lighting → always full-bright, i.e. self-illuminated.
          const glowMat = new THREE.MeshBasicMaterial({
            color: "#d63be0",
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const membrane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 1.95), glowMat);
          membrane.position.set(0, 1.0, 0.46);
          group.add(membrane);
          this.portalGlows.push({ mat: glowMat, base: 0.6, amp: 0.22, group });
          // A soft light beam rising from the gate — a landmark visible from
          // across the clearing so the entrance is easy to find.
          const beamMat = new THREE.MeshBasicMaterial({
            color: "#c451ff",
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          // A square beam (Minecraft beacon style) — cube-family, not a cylinder.
          const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), beamMat);
          beam.position.set(0, 4.6, 0.2);
          group.add(beam);
          this.portalGlows.push({ mat: beamMat, base: 0.12, amp: 0.06, group });
          break;
        }
        case "object.portal.exit": {
          // The way home: a wooden ladder rising through a shaft of daylight.
          const wood = new THREE.MeshLambertMaterial({ color: "#b98a4a" });
          for (const x of [-0.26, 0.26]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.5, 0.12), wood);
            rail.position.set(x, 1.25, 0.3);
            group.add(rail);
          }
          for (let i = 0; i < 7; i++) {
            const rung = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.1), wood);
            rung.position.set(0, 0.25 + i * 0.34, 0.3);
            group.add(rung);
          }
          // Soft daylight shaft falling from the surface above.
          const shaft = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 2.5, 0.6),
            new THREE.MeshBasicMaterial({
              color: "#cfe8ff",
              transparent: true,
              opacity: 0.16,
              depthWrite: false,
            }),
          );
          shaft.position.set(0, 1.25, 0.15);
          const sky = new THREE.Mesh(
            new THREE.PlaneGeometry(0.8, 0.55),
            new THREE.MeshBasicMaterial({ color: "#eaf6ff" }),
          );
          sky.rotation.x = Math.PI / 2;
          sky.position.set(0, 2.52, 0.2);
          group.add(shaft, sky, makeBlobShadow(0.5));
          break;
        }
        case "object.rock.outcrop":
        case "object.rock.mesa":
        case "object.rock.tidal": {
          // Code-drawn rocky outcrop: a small cluster of stone blocks of
          // varied height (replaces the retired voxel-prop packs). Tinted per
          // kind — mesa red rock, tidal wet grey, outcrop plain stone.
          const color = obj.defId === "object.rock.mesa" ? "#9a5a3a"
            : obj.defId === "object.rock.tidal" ? "#6f7a80" : "#8a8d90";
          const mat = new THREE.MeshLambertMaterial({ color });
          const blocks = 3 + Math.floor(hash01(obj.instanceId) * 3); // 3..5
          for (let b = 0; b < blocks; b++) {
            const s = 0.45 + hash01(`${obj.instanceId}s${b}`) * 0.45;
            const h = 0.4 + hash01(`${obj.instanceId}h${b}`) * 0.9;
            const box = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), mat);
            box.position.set(
              (hash01(`${obj.instanceId}x${b}`) - 0.5) * 0.8,
              h / 2 - 0.15,
              (hash01(`${obj.instanceId}z${b}`) - 0.5) * 0.8,
            );
            group.add(box);
          }
          group.add(makeBlobShadow(1.2));
          break;
        }
        case "object.mushroom.giant": {
          // Stem + domed cap, code-drawn (red toadstool or tan cap).
          const cap = hash01(obj.instanceId) < 0.55 ? "#b5402f" : "#c98a3a";
          const capMat = new THREE.MeshLambertMaterial({ color: cap });
          const stem = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.72, 0.3), new THREE.MeshLambertMaterial({ color: "#e8e0cf" }));
          stem.position.y = 0.36;
          const cap1 = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.34, 0.95), capMat);
          cap1.position.y = 0.8;
          const cap2 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 0.62), capMat);
          cap2.position.y = 1.02;
          group.add(stem, cap1, cap2, makeBlobShadow(0.7));
          break;
        }
        case "object.plant.tropic": {
          // A leafy tropical clump: fanned green blades.
          const green = new THREE.MeshLambertMaterial({ color: "#3f8f36", side: THREE.DoubleSide });
          for (let a = 0; a < 5; a++) {
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.05), green);
            const ang = (a / 5) * Math.PI * 2 + hash01(obj.instanceId) * Math.PI;
            blade.position.set(Math.cos(ang) * 0.18, 0.44, Math.sin(ang) * 0.18);
            blade.rotation.set(a % 2 ? 0.35 : -0.35, ang, a % 2 ? 0.25 : -0.25);
            group.add(blade);
          }
          group.add(makeBlobShadow(0.5));
          break;
        }
        case "object.flowers.showy": {
          const bloom = this.crossSprite("sprite.flowers.wild");
          bloom.group.rotation.y = hash01(obj.instanceId) * Math.PI;
          bloom.group.scale.setScalar(1.1);
          group.add(bloom.group);
          break;
        }
        case "object.flora.wild": {
          // Low undergrowth: a small green tuft.
          const green = new THREE.MeshLambertMaterial({ color: "#4a7a34", side: THREE.DoubleSide });
          for (let a = 0; a < 3; a++) {
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.04), green);
            const ang = (a / 3) * Math.PI * 2 + hash01(obj.instanceId) * Math.PI;
            blade.position.set(Math.cos(ang) * 0.12, 0.21, Math.sin(ang) * 0.12);
            blade.rotation.y = ang;
            group.add(blade);
          }
          group.add(makeBlobShadow(0.35));
          break;
        }
        case "object.boulder.stone": {
          // A hand-built rock from the sliced asset library, chosen per
          // instance; falls back to the classic cube-and-shard.
          const model = pickBoulderModel(hash01(obj.instanceId));
          if (model) {
            for (const geo of rockGeometry(model)) {
              const m = geo.userData.material as number;
              const mat = this.lambert(ROCK_MATERIAL_TILES[m]);
              const tint = ROCK_MATERIAL_TINTS[m];
              if (tint) mat.color.set(tint);
              const mesh = new THREE.Mesh(geo, mat);
              mesh.position.y = -0.18; // settle into the turf
              group.add(mesh);
            }
            group.add(makeBlobShadow(0.6 + model.r * 0.35));
          } else {
            const stone = this.lambert("terrain.stone");
            const big = this.tiledBox(1, 1, 1, stone);
            big.position.set(-0.08, 0.32, -0.05);
            const shard = this.tiledBox(0.5, 0.5, 0.5, stone);
            shard.position.set(0.42, 0.22, 0.3);
            group.add(big, shard, makeBlobShadow(0.8));
          }
          break;
        }
        case "object.log.fallen": {
          // A toppled trunk: two blocks of bark with ring ends, mossy top.
          const bark = this.lambert("resource.tree.log.side");
          const ring = this.lambert("resource.tree.stump.top");
          const logMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), [
            ring, ring, bark, bark, bark, bark,
          ]);
          logMesh.position.y = 0.42;
          const flip = (obj.cell.x * 31 + obj.cell.z * 17) % 2 === 0;
          logMesh.rotation.y = flip ? 0 : Math.PI / 2;
          group.add(logMesh, makeBlobShadow(1.0));
          break;
        }
        case "object.grass.tuft": {
          const tuft = this.crossSprite("sprite.grass.tuft");
          tuft.group.rotation.y = ((obj.cell.x * 11 + obj.cell.z * 5) % 8) * (Math.PI / 8);
          tuft.group.scale.setScalar(0.8);
          group.add(tuft.group);
          break;
        }
        case "object.reeds.water": {
          const reeds = this.crossSprite("sprite.reeds");
          reeds.group.rotation.y = ((obj.cell.x * 13 + obj.cell.z * 7) % 8) * (Math.PI / 8);
          group.add(reeds.group);
          break;
        }
        case "object.bench.wood": {
          // Plank-slab bench on fence-post legs with a two-rail back.
          const plankMat = this.lambert("terrain.plank");
          const logMat = this.lambert("resource.tree.log.side");
          const seat = this.tiledBox(1.0, 0.19, 0.44, plankMat);
          seat.position.set(0, 0.5, 0.06);
          for (const lx of [-0.36, 0.36]) {
            const leg = this.tiledBox(0.125, 0.5, 0.125, logMat);
            leg.position.set(lx, 0.25, 0.06);
            group.add(leg);
          }
          for (const ry of [0.82, 1.06]) {
            const rail = this.tiledBox(1.0, 0.14, 0.11, plankMat);
            rail.position.set(0, ry, -0.18);
            group.add(rail);
          }
          for (const lx of [-0.36, 0.36]) {
            const back = this.tiledBox(0.125, 0.62, 0.125, logMat);
            back.position.set(lx, 0.9, -0.18);
            group.add(back);
          }
          group.add(seat, makeBlobShadow(0.45));
          break;
        }
        case "object.signpost": {
          const wood = this.lambert("resource.tree.log.side");
          const post = this.tiledBox(0.1875, 1.75, 0.1875, wood);
          post.position.y = 0.875;
          const plank = this.lambert("terrain.plank");
          const board = this.tiledBox(0.95, 0.3, 0.125, plank);
          board.position.set(0.28, 1.45, 0);
          const board2 = this.tiledBox(0.8, 0.28, 0.125, plank);
          board2.rotation.y = Math.PI / 2;
          board2.position.set(0, 1.08, 0.24);
          group.add(post, board, board2, makeBlobShadow(0.3));
          break;
        }
        default: {
          // Real 3D chest model (BetaSharp/oafs geometry, Faithful skin) with a
          // lid and latch, falling back to a composited 14/16 box if the baked
          // model is unavailable.
          const built = buildBBModel("mob.chest");
          if (built) {
            group.add(built.group, makeBlobShadow(0.6));
          } else {
            const side = this.lambert("object.chest.side");
            const chest = new THREE.Mesh(new THREE.BoxGeometry(0.875, 0.875, 0.875), [
              side, side, this.lambert("object.chest.top"), side, side, this.lambert("object.chest.front"),
            ]);
            chest.position.y = 0.4375;
            group.add(chest, makeBlobShadow(0.6));
          }
        }
      }
      if (OBJECTS[obj.defId].containerSlots) this.addSilhouette(group, "#ffc23e");
      group.position.set(obj.cell.x + 0.5, baseY, obj.cell.z + 0.5);
      group.userData.defId = obj.defId; // streaming reads this for cull distance
      group.traverse((o) => (o.userData.instanceId = obj.instanceId));
      this.scene.add(group);
      this.objectViews.set(obj.instanceId, group);
      if (!OBJECTS[obj.defId].scenery) this.pickables.push(group);
      if (["object.store.basic", "object.house.small", "object.house.big", "object.portal.cave", "object.keep.grand", "object.spire.large", "object.spire.small"].includes(obj.defId)) {
        const materials: THREE.MeshLambertMaterial[] = [];
        group.traverse((o) => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshLambertMaterial) {
            addPeepHole(o.material);
            materials.push(o.material);
          }
        });
        this.objectFadeGroups.push({ group, materials });
      }
    }
  }

  /**
   * Imported Minecraft structures: true 3D voxel props. Full cubes are
   * batched into one InstancedMesh per material (enclosed cubes culled);
   * shaped pieces (stairs, slabs, fences, doors, panes…) get individual
   * meshes at vanilla model sizes.
   */
  private buildStructures(): void {
    for (const placement of this.sim.world.region.structures ?? []) {
      // The lobby's ~160 tiles are heavy; let the per-frame streamer build only
      // the ones near the player instead of all of them at load (a 20s stall).
      if (placement.structureId.startsWith("lobby.")) continue;
      this.addStructureVisual(placement);
    }
  }

  /** Add one placed structure's meshes (world build or live editor). */
  addStructureVisual(placement: { instanceId: string; structureId: string; cell: Cell }): void {
    const asset = getStructure(placement.structureId);
    if (!asset || this.structureVisuals.has(placement.instanceId)) return;
    const { group, materials, lights } = this.buildStructureGroup(asset);
    const baseY = this.sim.world.heightAt(placement.cell);
    // Bury a tall foundation so the living floor sits at ground (matches the
    // walkable grid, which uses the same effectiveSink for collisions).
    const sink = effectiveSink(asset);
    // Sunken floors sit a hair above the terrain surface so the floor
    // face wins the coplanar depth fight and renders consistently.
    const lift = sink > 0 ? 0.012 : 0;
    const floorY = baseY - sink + lift;
    group.position.set(placement.cell.x, floorY, placement.cell.z);
    this.scene.add(group);
    // Roof cutaway: one horizontal clip plane per structure, parked above
    // the build (no effect) until the player walks inside and is hidden.
    const cutTop = baseY - sink + asset.sy + 4;
    const cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), cutTop);
    for (const mat of materials) mat.clippingPlanes = [cutPlane];
    // Slice above the ground-floor room: keep the floor and its walls, remove
    // the roof (and any upper storey) so the interior reads.
    const gTop = groundFloorTop(asset);
    const roofCut = floorY + gTop + 4.5;
    const interiorY = floorY + gTop;
    const bounds = {
      x0: placement.cell.x,
      z0: placement.cell.z,
      x1: placement.cell.x + asset.sx - 1,
      z1: placement.cell.z + asset.sz - 1,
    };
    if (asset.sy - sink >= 3) {
      this.objectFadeGroups.push({ group, materials });
    }
    // Structure is placed by pure translation (no rotation), so a glow block's
    // world position is just the placement cell + its local offset.
    const worldLights = lights.map((l) => ({
      x: placement.cell.x + l.x,
      y: floorY + l.y,
      z: placement.cell.z + l.z,
      color: l.color,
    }));
    this.structureVisuals.set(placement.instanceId, { group, materials, cutPlane, cutTop, floorY, roofCut, interiorY, bounds, peek: 0, instanceId: placement.instanceId, structureId: placement.structureId, lights: worldLights });
  }

  /** Remove a placed structure's meshes and free their GPU resources. */
  removeStructureVisual(instanceId: string): void {
    const visual = this.structureVisuals.get(instanceId);
    if (!visual) return;
    this.scene.remove(visual.group);
    this.objectFadeGroups = this.objectFadeGroups.filter((f) => f.group !== visual.group);
    visual.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const mat of visual.materials) mat.dispose();
    this.structureVisuals.delete(instanceId);
  }

  // ---------- editor ghost preview ----------

  /** Show a translucent preview of a structure (trees anchor at trunk). */
  showGhost(structureId: string, anchored: boolean): void {
    this.hideGhost();
    const asset = getStructure(structureId);
    if (!asset) return;
    const { group, materials } = this.buildStructureGroup(asset);
    for (const mat of materials) {
      mat.transparent = true;
      mat.opacity = 0.55;
      mat.depthWrite = false;
    }
    group.visible = false;
    this.scene.add(group);
    this.ghost = {
      group,
      materials,
      ax: anchored ? asset.ax ?? 0 : 0,
      az: anchored ? asset.az ?? 0 : 0,
      sink: effectiveSink(asset),
      anchored,
    };
  }

  /** Position the ghost on a hovered cell; red-tint when invalid. */
  moveGhost(cell: Cell | null, valid: boolean): void {
    if (!this.ghost) return;
    if (!cell || !this.sim.world.inBounds(cell)) {
      this.ghost.group.visible = false;
      return;
    }
    const baseY = this.sim.world.heightAt(cell);
    this.ghost.group.position.set(
      cell.x - this.ghost.ax,
      Math.max(0, baseY) - this.ghost.sink + 0.02,
      cell.z - this.ghost.az,
    );
    this.ghost.group.visible = true;
    const tint = valid ? 0xffffff : 0xff5544;
    for (const mat of this.ghost.materials) {
      if (mat.color.getHex() !== tint) mat.color.setHex(tint);
    }
  }

  hideGhost(): void {
    if (!this.ghost) return;
    this.scene.remove(this.ghost.group);
    this.ghost.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const mat of this.ghost.materials) mat.dispose();
    this.ghost = null;
  }

  /** Cheap ground pick for hover (ray vs the y=0 plane; no mesh raycast). */
  groundCellFromClient(clientX: number, clientY: number): Cell | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.rig.camera);
    // Raycast the real terrain surface (raised to each block's height) so the
    // reported cell is exactly under the cursor. The old y=0-plane pick landed
    // a cell "behind" a raised block, because in the tilted camera a block top
    // projects to the same pixel as a further-back point on the ground plane.
    const groundHits = ray.intersectObjects(
      [...this.terrainChunks.values()].map((c) => c.mesh),
      false,
    );
    if (groundHits.length > 0) {
      const p = groundHits[0].point;
      // Nudge along the ray so a hit exactly on a cell boundary resolves to the
      // face the cursor is over, not its neighbour.
      const cell = {
        x: Math.floor(p.x + ray.ray.direction.x * 0.001),
        z: Math.floor(p.z + ray.ray.direction.z * 0.001),
      };
      return this.sim.world.inBounds(cell) ? cell : null;
    }
    // Fallback: no terrain mesh under the cursor — intersect the y=0 plane.
    const t = -ray.ray.origin.y / ray.ray.direction.y;
    if (!Number.isFinite(t) || t < 0) return null;
    const x = Math.floor(ray.ray.origin.x + ray.ray.direction.x * t);
    const z = Math.floor(ray.ray.origin.z + ray.ray.direction.z * t);
    const cell = { x, z };
    return this.sim.world.inBounds(cell) ? cell : null;
  }

  /** Build one structure's meshes in local block coordinates (min corner at origin). */
  private grainTexture: THREE.Texture | null = null;
  /** A near-white tileable grain so colour-only blocks (tinted by their own
   *  colour) show surface detail instead of a flat swatch. Cached + shared. */
  private structureGrain(): THREE.Texture {
    if (this.grainTexture) return this.grainTexture;
    const N = 16;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(N, N);
    // A greyscale "painted surface" tile multiplied by the block's own colour:
    // a soft grain gives it material, a faint pixel-lift/shadow reads as a
    // hand-mixed finish, and a darker outer ring delineates each cube so a
    // wall of one colour reads as stacked blocks, not a flat slab. Deterministic
    // hash noise (no Math.random) keeps builds reproducible.
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = y * N + x;
        let h = (i * 2654435761) >>> 0;
        h ^= h >>> 15;
        // Base grain, a little wider than before so the surface has tooth.
        let n = 214 + (h % 42); // 214..255
        // Sparse brighter flecks and darker pits, like pigment in plaster.
        if (h % 23 === 0) n = 255;
        else if (h % 29 === 0) n = 196;
        // Edge shading: darken the outer ring, hard-darken the very corner
        // pixels, so adjacent same-colour blocks show their seams.
        const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
        if (edge) n = Math.round(n * 0.82);
        img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = n;
        img.data[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.grainTexture = tex;
    return tex;
  }

  private buildStructureGroup(asset: StructureAsset): {
    group: THREE.Group;
    materials: THREE.MeshLambertMaterial[];
    lights: Array<{ x: number; y: number; z: number; color: string }>;
  } {
    {
      const group = new THREE.Group();
      const allMaterials: THREE.MeshLambertMaterial[] = [];
      // Local-space positions of emissive blocks (glow kind: lanterns, torches,
      // glowstone, candles…) so the caller can place point lights at night.
      const lights: Array<{ x: number; y: number; z: number; color: string }> = [];
      const matCache = new Map<string, THREE.MeshLambertMaterial>();
      const matFor = (b: StructureBlock): THREE.MeshLambertMaterial => {
        const key = `${b.material ?? ""}|${b.color ?? ""}|${b.translucent ? 1 : 0}`;
        let mat = matCache.get(key);
        if (!mat) {
          mat = b.material
            ? this.lambert(b.material)
            // Unmapped blocks (concrete, terracotta, quartz, wool…) have no
            // texture in our set — give them a subtle grain tinted to their
            // colour so they read as a surface, not a flat swatch.
            : new THREE.MeshLambertMaterial({ map: this.structureGrain(), color: b.color ?? "#9a9da0" });
          matCache.set(key, mat);
          if (b.translucent) {
            mat.transparent = true;
            mat.opacity = 0.6;
          }
          // Every structure material joins the peek-hole and (via the
          // caller) the roof-cutaway clip plane — glass included, so the
          // cutaway never leaves floating window panes.
          addPeepHole(mat);
          allMaterials.push(mat);
        }
        return mat;
      };

      // Cubes: cull fully enclosed ones, then batch per material.
      const solid = new Set(
        asset.blocks
          .filter((b) => b.kind === "cube" && !b.translucent)
          .map((b) => `${b.x},${b.y},${b.z}`),
      );
      const exposed = (b: StructureBlock) =>
        !(
          solid.has(`${b.x + 1},${b.y},${b.z}`) && solid.has(`${b.x - 1},${b.y},${b.z}`) &&
          solid.has(`${b.x},${b.y + 1},${b.z}`) && solid.has(`${b.x},${b.y - 1},${b.z}`) &&
          solid.has(`${b.x},${b.y},${b.z + 1}`) && solid.has(`${b.x},${b.y},${b.z - 1}`)
        );
      const cubesByMat = new Map<THREE.MeshLambertMaterial, StructureBlock[]>();
      for (const b of asset.blocks) {
        if (b.kind !== "cube" || !exposed(b)) continue;
        const mat = matFor(b);
        const list = cubesByMat.get(mat);
        if (list) list.push(b);
        else cubesByMat.set(mat, [b]);
      }
      const unitBox = new THREE.BoxGeometry(1, 1, 1);
      const m4 = new THREE.Matrix4();
      for (const [mat, list] of cubesByMat) {
        const instanced = new THREE.InstancedMesh(unitBox, mat, list.length);
        list.forEach((b, i) => {
          instanced.setMatrixAt(i, m4.makeTranslation(b.x + 0.5, b.y + 0.5, b.z + 0.5));
        });
        // Frustum culling uses the geometry's unit-box bounds by default,
        // which would cull the whole batch once its origin corner leaves
        // the screen — compute real instance-aware bounds instead.
        instanced.computeBoundingSphere();
        group.add(instanced);
      }

      // Shaped pieces at vanilla model sizes.
      const posts = new Set(
        asset.blocks.filter((b) => b.kind === "post").map((b) => `${b.x},${b.y},${b.z}`),
      );
      const DIR: Record<string, [number, number]> = {
        north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0],
      };
      // Ground-level door panels: the interiored homes ship their front doors
      // as panel blocks (often textured as roof planks), so they'd otherwise
      // render as flat brown boards. Find each door column's bottom block so we
      // can draw one recognizable 2-tall door there and skip its upper half —
      // panels higher up are gable/roof trim and stay flat leaves.
      const feetY = effectiveSink(asset);
      const doorBottoms = new Map<string, number>();
      for (const b of asset.blocks) {
        if (b.kind !== "panel" || b.y - feetY > 1) continue;
        const k = `${b.x},${b.z}`;
        const cur = doorBottoms.get(k);
        if (cur === undefined || b.y < cur) doorBottoms.set(k, b.y);
      }
      for (const b of asset.blocks) {
        if (b.kind === "cube") continue;
        const mat = matFor(b);
        const cx = b.x + 0.5;
        const cz = b.z + 0.5;
        switch (b.kind) {
          case "slab": {
            const slab = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), mat);
            slab.position.set(cx, b.y + (b.top ? 0.75 : 0.25), cz);
            group.add(slab);
            break;
          }
          case "stairs": {
            // Vanilla stairs: full half-slab plus a half-depth riser on the
            // high (facing) side; upside-down stairs mirror vertically.
            const base = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), mat);
            base.position.set(cx, b.y + (b.top ? 0.75 : 0.25), cz);
            const [dx, dz] = DIR[b.facing ?? "north"];
            const riser = new THREE.Mesh(
              new THREE.BoxGeometry(dx === 0 ? 1 : 0.5, 0.5, dz === 0 ? 1 : 0.5),
              mat,
            );
            riser.position.set(cx + dx * 0.25, b.y + (b.top ? 0.25 : 0.75), cz + dz * 0.25);
            group.add(base, riser);
            break;
          }
          case "post": {
            // Fence post 4px / wall post 8px, with 3px rails toward
            // neighboring posts so runs read as fences, not pickets.
            const w = b.wide ? 0.5 : 0.25;
            const post = new THREE.Mesh(new THREE.BoxGeometry(w, 1, w), mat);
            post.position.set(cx, b.y + 0.5, cz);
            group.add(post);
            for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
              if (!posts.has(`${b.x + dx},${b.y},${b.z + dz}`)) continue;
              for (const railY of b.wide ? [0.5] : [0.469, 0.844]) {
                const rail = new THREE.Mesh(
                  new THREE.BoxGeometry(
                    dx ? 1 : (b.wide ? 0.3 : 0.1875),
                    b.wide ? 0.8 : 0.1875,
                    dz ? 1 : (b.wide ? 0.3 : 0.1875),
                  ),
                  mat,
                );
                rail.position.set(cx + dx * 0.5, b.y + railY, cz + dz * 0.5);
                group.add(rail);
              }
            }
            break;
          }
          case "panel": {
            const [dx, dz] = DIR[b.facing ?? "north"];
            // Ground-level door panels are drawn as real, openable door objects
            // (emitted alongside the structure in worldgen), so skip them here —
            // otherwise a static leaf would double up with the swinging door.
            if (doorBottoms.has(`${b.x},${b.z}`)) break;
            // Roof/gable trim panel: a flat 3px board on its facing edge.
            const leaf = new THREE.Mesh(
              new THREE.BoxGeometry(dx === 0 ? 1 : 0.1875, 1, dz === 0 ? 1 : 0.1875),
              mat,
            );
            leaf.position.set(cx + dx * 0.4, b.y + 0.5, cz + dz * 0.4);
            group.add(leaf);
            break;
          }
          case "pane": {
            // Glass pane / iron bars: a 2px sheet through the cell center.
            const alongX = b.facing === "east" || b.facing === "west";
            const sheet = new THREE.Mesh(
              new THREE.BoxGeometry(alongX ? 1 : 0.125, 1, alongX ? 0.125 : 1),
              mat,
            );
            sheet.position.set(cx, b.y + 0.5, cz);
            group.add(sheet);
            break;
          }
          case "thin": {
            if (b.open) {
              // Open trapdoor: a vertical 3px shutter hinged on its facing
              // edge (wall trim / awnings / gable detail), NOT a horizontal
              // shelf jutting out of the wall.
              const [dx, dz] = DIR[b.facing ?? "north"];
              const shutter = new THREE.Mesh(
                new THREE.BoxGeometry(dx === 0 ? 1 : 0.1875, 1, dz === 0 ? 1 : 0.1875),
                mat,
              );
              shutter.position.set(cx + dx * 0.406, b.y + 0.5, cz + dz * 0.406);
              group.add(shutter);
              break;
            }
            // Closed trapdoor / carpet / rail: a thin horizontal panel lying
            // flat on the bottom (or the top half when half=top), never a
            // raised/floating slab.
            const flat = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1875, 1), mat);
            flat.position.set(cx, b.y + (b.top ? 0.906 : 0.094), cz);
            group.add(flat);
            break;
          }
          case "glow": {
            // Vanilla lantern (6x7 px): the block-sheet body art (iron cage
            // over the glow) on a lantern box. Its material joins the
            // structure set so the roof cutaway clips wall lanterns along
            // with their walls — otherwise they float as bare glowing cubes.
            const soul = b.color && b.color !== "#ffd873" ? b.color : undefined;
            const dark = matFor({ ...b, material: undefined, color: "#3a3d42", translucent: false });
            // The source build hangs these on chains and brackets the
            // importer drops, so re-derive a support from the neighbors:
            // chain from a ceiling, bracket from a wall, else a post down
            // to the ground — never a bare cube floating in the street.
            const hasAbove = solid.has(`${b.x},${b.y + 1},${b.z}`);
            const hasBelow = solid.has(`${b.x},${b.y - 1},${b.z}`);
            let ox = 0;
            let oz = 0;
            if (hasBelow) {
              // Ground contact shadow: a 6px box only covers the middle of
              // its floor tile, so without one it reads as floating.
              const shadow = makeBlobShadow(0.4);
              shadow.position.set(cx, b.y + 0.01, cz);
              group.add(shadow);
            }
            if (hasAbove) {
              const chain = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.5, 0.125), dark);
              chain.position.set(cx, b.y + 0.75, cz);
              group.add(chain);
            } else if (!hasBelow) {
              const wall = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).find(([dx, dz]) =>
                solid.has(`${b.x + dx},${b.y},${b.z + dz}`),
              );
              if (wall) {
                // Wall-mounted: hug the supporting wall on a little arm.
                ox = wall[0] * 0.26;
                oz = wall[1] * 0.26;
                const arm = new THREE.Mesh(
                  new THREE.BoxGeometry(wall[0] !== 0 ? 0.3 : 0.125, 0.125, wall[1] !== 0 ? 0.3 : 0.125),
                  dark,
                );
                arm.position.set(cx + wall[0] * 0.38, b.y + 0.45, cz + wall[1] * 0.38);
                group.add(arm);
              } else {
                for (let gap = 1; gap <= 3; gap++) {
                  if (!solid.has(`${b.x},${b.y - 1 - gap},${b.z}`)) continue;
                  const post = new THREE.Mesh(new THREE.BoxGeometry(0.125, gap, 0.125), dark);
                  post.position.set(cx, b.y - gap / 2, cz);
                  const shadow = makeBlobShadow(0.4);
                  shadow.position.set(cx, b.y - gap + 0.01, cz);
                  group.add(post, shadow);
                  break;
                }
              }
            }
            // Register this emitter so the caller can hang a point light on it.
            lights.push({ x: cx + ox, y: b.y + 0.35, z: cz + oz, color: b.color ?? "#ffd873" });
            const lantern = this.makeLantern(soul);
            addPeepHole(lantern.material);
            allMaterials.push(lantern.material);
            lantern.mesh.position.set(cx + ox, b.y + 0.22, cz + oz);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.0625, 0.25), dark);
            cap.position.set(cx + ox, b.y + 0.47, cz + oz);
            group.add(lantern.mesh, cap);
            break;
          }
          case "cross": {
            // Ground plants: crossed 16x16 sprite planes (grass, flowers,
            // crops) sitting on the cell floor.
            const sprite = this.crossSprite(b.material ?? "sprite.grass.tuft");
            sprite.group.position.set(cx, b.y, cz);
            allMaterials.push(sprite.material);
            group.add(sprite.group);
            break;
          }
          case "sign": {
            // A plank board on a short post, turned to face its facing.
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.55, 0.125), mat);
            post.position.set(cx, b.y + 0.275, cz);
            const board = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.0625), mat);
            board.position.set(cx, b.y + 0.72, cz);
            const [sdx] = DIR[b.facing ?? "north"];
            board.rotation.y = sdx !== 0 ? Math.PI / 2 : 0;
            group.add(post, board);
            break;
          }
          case "banner": {
            // A tall dyed cloth hanging from a short pole.
            const dark = matFor({ ...b, material: undefined, color: "#3a2a1a", translucent: false });
            const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), dark);
            pole.position.set(cx, b.y + 0.175, cz);
            const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.0625), mat);
            cloth.position.set(cx, b.y + 1.1, cz);
            const [bdx] = DIR[b.facing ?? "north"];
            cloth.rotation.y = bdx !== 0 ? Math.PI / 2 : 0;
            pole.rotation.y = cloth.rotation.y;
            group.add(pole, cloth);
            break;
          }
        }
      }

      return { group, materials: allMaterials, lights };
    }
  }

  private currentSkin: LoadedSkin | null = null;
  private playerMarker: THREE.Mesh | null = null;

  private buildCharacters(): void {
    if (!this.currentSkin) this.currentSkin = normalizeSkin(defaultHeroSkin());
    this.playerView = new CharacterView(this.currentSkin);
    this.playerView.group.add(makeBlobShadow(0.42));
    this.scene.add(this.playerView.group);

    // The held torch itself is shown via setHeldItem (gripped in the fist just
    // like the axe); here we only add the warm point light it casts. It rides
    // with the character, up near where the torch head sits in-hand, and stays
    // off until the player turns the torch on.
    this.torchLight = new THREE.PointLight("#ffb24d", 0, 16, 1.05);
    this.torchLight.position.set(0.34, 1.2, 0.12);
    this.playerView.group.add(this.torchLight);

    // Locator arrow, drawn through walls — only in dungeon-themed regions
    // where terrain can hide the character.
    this.playerMarker = null;
    if (this.sim.world.region.theme) {
      this.playerMarker = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.5),
        new THREE.MeshBasicMaterial({
          map: this.materials.texture("sprite.player.arrow"),
          alphaTest: 0.5,
          depthTest: false,
          transparent: true,
        }),
      );
      this.playerMarker.renderOrder = 13;
      this.scene.add(this.playerMarker);
    }
    this.syncHeldItem();

    for (const npc of this.sim.world.region.npcs) this.addNpcVisual(npc);
  }

  /** Build one NPC's character view (region init and live chunk streaming). */
  private addNpcVisual(npc: { instanceId: string; name: string; cell: Cell; model?: string; skin?: string }): void {
    if (this.npcViews.has(npc.instanceId)) return;
    // A model-backed NPC (villager, wandering trader, iron golem) renders its
    // baked mob model; a tutor carries a named themed skin; everyone else is a
    // skinned humanoid whose skin index is derived from the id so it stays
    // stable no matter the streaming order.
    let view: CharacterView | NpcModelView;
    const built = npc.model ? buildBBModel(npc.model) : null;
    if (built) {
      built.group.userData.instanceId = npc.instanceId;
      view = new NpcModelView(built.group, built.materials, built.bones);
    } else {
      const skinCanvas = npc.skin
        ? tutorSkin(npc.skin)
        : npc.instanceId === "vale.npc.alder"
          ? wardenSkin()
          : villagerSkin(Math.floor(hash01(npc.instanceId) * 8));
      view = new CharacterView(normalizeSkin(skinCanvas), npc.instanceId);
    }
    view.group.add(makeBlobShadow(0.42));
    // Quest marker: "!" (quest to give) or "?" (delivery ready), toggled per frame.
    for (const [kind, spriteId] of [
      ["give", "sprite.quest.give"],
      ["ready", "sprite.quest.ready"],
    ] as const) {
      const marker = this.crossSprite(spriteId);
      marker.group.scale.setScalar(0.55);
      marker.group.position.y = 2.15;
      marker.group.visible = false;
      marker.group.name = `quest-${kind}`;
      view.group.add(marker.group);
    }
    this.addSilhouette(view.group, "#ffd84a");
    this.npcViews.set(npc.instanceId, view);
    this.scene.add(view.group);
    this.pickables.push(view.group);
  }

  /** Free a streamed-out NPC's view. */
  private disposeNpcVisual(id: string): void {
    const view = this.npcViews.get(id);
    if (!view) return;
    this.scene.remove(view.group);
    this.pickables = this.pickables.filter((g) => g !== view.group);
    view.dispose();
    this.npcViews.delete(id);
  }

  /**
   * Swap the player's skin. Accepts a standard 64x64 (or legacy 64x32)
   * Minecraft-format skin image; null restores the built-in original skin.
   * Throws on unsupported images (caller shows the error).
   */
  setPlayerSkin(image: HTMLImageElement | null): void {
    const skin = normalizeSkin(image ?? defaultHeroSkin());
    this.currentSkin = skin;
    this.scene.remove(this.playerView.group);
    this.playerView.dispose();
    this.playerXray = false;
    this.playerView = new CharacterView(skin);
    this.playerView.group.add(makeBlobShadow(0.42));
    this.scene.add(this.playerView.group);
    this.syncHeldItem();
  }

  /** Build one enemy's rig + health bar (streamed in around the player). */
  /** Remove one enemy's meshes (world editor). */
  removeEnemyVisual(instanceId: string): void {
    const view = this.enemyViews.get(instanceId);
    if (!view) return;
    this.scene.remove(view.group, view.barGroup);
    this.disposeGroupResources(view.group, false);
    this.disposeGroupResources(view.barGroup, true);
    this.pickables = this.pickables.filter((p) => p !== view.group);
    this.enemyViews.delete(instanceId);
    this.ghostEntities = this.ghostEntities.filter((g) => g.root !== view.group);
  }

  addEnemyVisual(placement: { instanceId: string; defId: string; cell: Cell }): void {
    {
      const def = ENEMIES[placement.defId];
      const group = new THREE.Group();
      // Blockbench-model mobs (dragons) spawn in a spread of sizes, so no
      // two encounters read identical; classic rigs stay vanilla-exact.
      const sizeJitter = def.view === "dragon" ? 0.75 + hash01(placement.instanceId) * 0.65 : 1;
      const scale = (def.scale ?? 1) * sizeJitter;
      const built = this.buildEnemyBody(group, def.view, def.tint, placement.defId);
      const barHeight = built.barHeight * scale;
      group.scale.setScalar(scale);

      // Floating health bar (billboarded per frame).
      const barGroup = new THREE.Group();
      // depthTest off: bars stay readable through dungeon walls.
      const barBg = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.09),
        new THREE.MeshBasicMaterial({ color: "#301010", depthTest: false, transparent: true }),
      );
      const barFg = new THREE.Mesh(
        new THREE.PlaneGeometry(0.7, 0.09),
        new THREE.MeshBasicMaterial({ color: "#e04040", depthTest: false, transparent: true }),
      );
      barBg.renderOrder = 11;
      barFg.renderOrder = 12;
      barFg.position.z = 0.002;
      barGroup.add(barBg, barFg);
      barGroup.position.y = barHeight;
      barGroup.visible = false;
      this.scene.add(barGroup);

      if (def.aggroRadiusCells > 0) this.addSilhouette(group, "#ff5044");
      const baseY = this.sim.world.heightAt(placement.cell);
      group.position.set(placement.cell.x + 0.5, baseY, placement.cell.z + 0.5);
      group.traverse((o) => (o.userData.instanceId = placement.instanceId));
      this.scene.add(group);
      this.pickables.push(group);
      this.enemyViews.set(placement.instanceId, {
        group,
        barGroup,
        barFg,
        shakeT: 0,
        barHeight,
        anim: built.anim,
      });
    }
  }

  /**
   * Blocky original critters with animatable rigs: legs trot, segments
   * undulate, heads extend on a lunge. Returns the health-bar height too.
   */
  // Enemy view kinds that have a BetaSharp vanilla model (skinned via Faithful).
  // Views not listed here keep their original animatable rig.
  // Enemy view kinds mapped to a BetaSharp vanilla model (skinned via Faithful).
  // All twelve read correctly in-world; views not listed keep their own rig.
  // BetaSharp bbmodels used where they read correctly. The wolf and spider
  // bbmodels bake a lying-down / splayed default pose (no keyframes to stand
  // them up), so those kinds fall through to the vanilla-accurate procedural
  // rigs below, which UV-map the same Faithful entity skins.
  private static readonly MOB_VIEW_MODEL: Partial<Record<string, string>> = {
    cow: "mob.cow", pig: "mob.pig", sheep: "mob.sheep", chicken: "mob.chicken",
    creeper: "mob.creeper", zombie: "mob.zombie", skeleton: "mob.skeleton",
    squid: "mob.squid", slime: "mob.slimebody", ghast: "mob.ghast",
    pillager: "mob.pillager", vindicator: "mob.vindicator", evoker: "mob.evoker",
    illusioner: "mob.illusioner", witch: "mob.witch", ravager: "mob.ravager",
    drowned: "mob.drowned", stray: "mob.stray", armadillo: "mob.armadillo",
    bat: "mob.bat", allay: "mob.allay", sniffer: "mob.sniffer",
    bee: "mob.bee", mooshroom: "mob.mooshroom",
    // Warden rides the licensed CC BY-SA rig.
    warden: "mob.warden",
  };

  private buildEnemyBody(
    group: THREE.Group,
    kind: EnemyViewKind,
    tint?: string,
    defId?: string,
  ): { barHeight: number; anim: EnemyAnim } {
    // Livestock rigs are built in exact Minecraft model pixels (16 px = 1
    // block, the same PX unit as the player), converted here to world units.
    const P = PX;
    const box = (w: number, h: number, d: number, color: string) =>
      new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), new THREE.MeshLambertMaterial({ color }));
    // Entity-skin resolution: when the active texture set carries this
    // mob's texture, boxes UV-map onto it and painted detail boxes (eyes,
    // patches) drop out; otherwise the rig keeps its original painted art.
    const skinDef = ENEMY_SKINS[defId ?? ""];
    const bindSkin = (entity: EntitySkin | null): RigSkin | null => {
      if (!entity) return null;
      const material = new THREE.MeshLambertMaterial({
        map: entity.texture,
        alphaTest: 0.05,
      });
      if (skinDef?.tinted && tint) material.color.set(tint);
      return { material, width: entity.width, height: entity.height, k: entity.width / 64 };
    };
    const rigSkin = skinDef ? bindSkin(this.materials.entitySkin(skinDef.key)) : null;
    const woolSkin = skinDef?.wool ? bindSkin(this.materials.entitySkin(skinDef.wool)) : null;
    /** UV-mapped box when skinned (uvDims: region size if it differs from geometry). */
    const skinned = (
      s: RigSkin | null,
      w: number,
      h: number,
      d: number,
      color: string,
      u: number,
      v: number,
      uvDims?: [number, number, number],
    ): THREE.Mesh => {
      if (!s) return box(w, h, d, color);
      const geo = new THREE.BoxGeometry(w * P, h * P, d * P);
      const [uw, uh, ud] = uvDims ?? [w, h, d];
      setEntityUVs(geo, s, u, v, uw, uh, ud);
      return new THREE.Mesh(geo, s.material);
    };
    const body = new THREE.Group();
    const shadowSize = {
      cow: 0.75, pig: 0.6, spider: 0.65, gnasher: 0.7,
      wolf: 0.55, slime: 0.6, husk: 0.5, construct: 0.7,
      chicken: 0.35, sheep: 0.7, dummy: 0.5, dragon: 1.6,
      creeper: 0.45, zombie: 0.5, skeleton: 0.45, squid: 0.5, ghast: 0.9,
      pillager: 0.5, vindicator: 0.5, evoker: 0.5, illusioner: 0.5, witch: 0.5,
      ravager: 1.1, drowned: 0.5, stray: 0.45, armadillo: 0.5, bat: 0.3,
      allay: 0.3, sniffer: 0.9, bee: 0.3, mooshroom: 0.75,
      warden: 1.0,
    }[kind] ?? 0.5;
    group.add(body, makeBlobShadow(shadowSize));
    const anim: EnemyAnim = { body, legs: [], head: null, headRestZ: 0, segments: [], walkPhase: 0, lungeT: 0, groundBird: kind === "chicken" };
    // BetaSharp vanilla mob models: exact box-UV geometry skinned with the
    // Faithful entity textures baked in. Static for now (the source files carry
    // no keyframe animation), but a clear upgrade over the approximate rigs.
    const mobModelId = GameRenderer.MOB_VIEW_MODEL[kind];
    if (mobModelId) {
      const built = buildBBModel(mobModelId);
      if (built) {
        if (tint) for (const m of built.materials) m.color.set(tint); // variant recolor (multiplies the skin)
        // A few bb-models are authored facing the opposite way to the rest of
        // the pack (verified empirically with camera-facing line-ups): spin
        // those rigs 180° so they walk forwards instead of rear-first.
        if (mobModelId === "mob.sheep" || mobModelId === "mob.cow") built.group.rotation.y += Math.PI;
        body.add(built.group);
        // Procedural animation off the bone names: legs and arms swing on the
        // walk cycle (the existing leg loop drives anim.legs), wings flap, and
        // dangly limbless bits (tendrils/tails/spines) get a slow idle sway.
        let wi = 0;
        let si = 0;
        for (const [name, bone] of built.bones) {
          if (/wing/.test(name)) {
            anim.wings ??= [];
            anim.wings.push({ obj: bone.group, base: bone.baseRot.z, sign: wi++ % 2 === 0 ? 1 : -1 });
          } else if (/leg|arm|limb/.test(name)) {
            anim.legs.push(bone.group);
          } else if (/tendril|tail|spine|queue|antenna|fin/.test(name)) {
            anim.sway ??= [];
            anim.sway.push({ obj: bone.group, baseX: bone.baseRot.x, baseZ: bone.baseRot.z, sign: si++ % 2 === 0 ? 1 : -1 });
          }
        }
        return { barHeight: built.height + 0.4, anim };
      }
    }
    if (kind === "dragon") {
      // Baked Blockbench model with its own keyframe animations.
      const built = buildBBModel(ENEMIES[defId ?? ""]?.viewMaterial ?? "fire_dragon");
      if (built) {
        if (tint) for (const m of built.materials) m.color.set(tint);
        body.add(built.group);
        anim.bb = built.animator;
        anim.bb.play("idle");
        return { barHeight: built.height + 0.5, anim };
      }
      // Model missing: a stand-in bulk so the boss still exists.
      const bulk = box(30, 24, 40, "#7a3030");
      bulk.position.y = 20 * P;
      body.add(bulk);
      return { barHeight: 3, anim };
    }
    const quadLegs = (w: number, legH: number, xOff: number, color: string, s: RigSkin | null = null) => {
      // Vanilla quadruped legs: front pair at z -5, back pair at z +7,
      // swinging from the hip (geometry shifted below its pivot). Skinned
      // legs all share the classic (0,16) leg region.
      for (const [x, z] of [[-xOff, -5], [xOff, -5], [-xOff, 7], [xOff, 7]] as const) {
        const leg = skinned(s, w, legH, w, color, 0, 16);
        leg.geometry.translate(0, (-legH / 2) * P, 0);
        leg.position.set(x * P, legH * P, z * P);
        anim.legs.push(leg);
        body.add(leg);
      }
    };

    switch (kind) {
      case "cow": {
        // ModelCow: 12x18x10 body on 4x12x4 legs, 8x8x6 head with 1x3x1
        // horns. The body is a length-18 box laid down like vanilla's, so
        // skin UVs at (18,4) map exactly.
        const trunk = skinned(rigSkin, 12, 18, 10, "#f0ece2", 18, 4); // holstein white (original art)
        trunk.rotation.x = -Math.PI / 2;
        trunk.position.set(0, 16 * P, 1 * P);
        if (!rigSkin) {
          for (const [x, y, z, w, h, d] of [
            [-3, 17, 5, 6.2, 8.2, 7], // black patches wrapping the hide
            [4, 15, -4, 4.4, 8.2, 6],
            [-2, 20, -6, 5, 2.4, 5],
          ] as const) {
            const patch = box(w, h, d, "#2e2a28");
            patch.position.set(x * P, y * P, z * P);
            body.add(patch);
          }
        }
        const udder = skinned(rigSkin, 4, 6, 1, "#e8b8b8", 52, 0); // vanilla 4x6x1 slab under the belly
        udder.rotation.x = -Math.PI / 2;
        udder.position.set(0, 10.5 * P, 5.5 * P);
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 8, 8, 6, "#f0ece2", 0, 0);
        skull.position.z = -3 * P;
        head.add(skull);
        for (const side of [-1, 1]) {
          const horn = skinned(rigSkin, 1, 3, 1, "#d9d2bd", 22, 0); // vanilla horn box
          horn.position.set(side * 4.5 * P, 3.5 * P, -3.5 * P);
          head.add(horn);
          if (!rigSkin) {
            const eye = box(1, 1, 0.5, "#1c1c1c");
            eye.position.set(side * 2 * P, 1 * P, -6.2 * P);
            head.add(eye);
          }
        }
        if (!rigSkin) {
          const muzzle = box(4, 3, 0.5, "#e8b8b8");
          muzzle.position.set(0, -2.5 * P, -6.2 * P);
          head.add(muzzle);
        }
        head.position.set(0, 20 * P, -8 * P); // group origin; skull local −3 → vanilla centre −11
        anim.head = head;
        anim.headRestZ = -8 * P;
        quadLegs(4, 12, 4, "#e5e0d2", rigSkin);
        body.add(trunk, udder, head);
        return { barHeight: 24 * P + 0.25, anim };
      }
      case "pig": {
        // ModelPig: 10x8x16 body on 4x6x4 legs, 8x8x8 head with 4x3x1
        // snout. The body is vanilla's length-16 box laid down (UV 28,8).
        const trunk = skinned(rigSkin, 10, 16, 8, "#e8a2ad", 28, 8);
        trunk.rotation.x = -Math.PI / 2;
        trunk.position.set(0, 9 * P, -1 * P);
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 8, 8, 8, "#e8a2ad", 0, 0);
        skull.position.z = -4 * P;
        head.add(skull);
        const snout = skinned(rigSkin, 4, 3, 1, "#d9838f", 16, 16); // vanilla snout box
        snout.position.set(0, -1.5 * P, -8.5 * P);
        head.add(snout);
        if (!rigSkin) {
          for (const side of [-1, 1]) {
            const nostril = box(1, 1, 0.4, "#a85a66");
            nostril.position.set(side * 1 * P, -1.5 * P, -9.1 * P);
            head.add(nostril);
            const eye = box(1, 1, 0.5, "#1c1c1c");
            eye.position.set(side * 2 * P, 1 * P, -8.2 * P);
            head.add(eye);
          }
        }
        head.position.set(0, 12 * P, -6 * P); // group origin; skull local −4 → vanilla centre −10
        anim.head = head;
        anim.headRestZ = -6 * P;
        quadLegs(4, 6, 3, "#d9838f", rigSkin);
        body.add(trunk, head);
        return { barHeight: 16 * P + 0.22, anim };
      }
      case "chicken": {
        // Vanilla ModelChicken boxes: 6x8x6 body laid down, 4x6x3 head with
        // a 4x2x2 beak and 2x2x2 wattle, flat 1x4x6 wings, 3x5x3 legs.
        const feathers = "#f0ece2";
        const trunk = skinned(rigSkin, 6, 8, 6, feathers, 0, 9);
        trunk.rotation.x = -Math.PI / 2;
        trunk.position.set(0, 8 * P, 0);
        for (const [x, z] of [[-1.5, 1], [1.5, 1]] as const) {
          const leg = skinned(rigSkin, 3, 5, 3, "#d9a13f", 26, 0);
          leg.geometry.translate(0, -2.5 * P, 0);
          leg.position.set(x * P, 5 * P, z * P);
          anim.legs.push(leg);
          body.add(leg);
        }
        for (const side of [-1, 1]) {
          const wing = skinned(rigSkin, 1, 4, 6, "#e0dbd0", 24, 13);
          wing.position.set(side * 3.5 * P, 9 * P, 0);
          body.add(wing);
        }
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 4, 6, 3, feathers, 0, 0);
        skull.position.y = 3 * P;
        head.add(skull);
        const beak = skinned(rigSkin, 4, 2, 2, "#e8a13f", 14, 0);
        beak.position.set(0, 3.5 * P, -2.5 * P);
        head.add(beak);
        const wattle = skinned(rigSkin, 2, 2, 2, "#c0455a", 14, 4);
        wattle.position.set(0, 1.5 * P, -2 * P);
        head.add(wattle);
        if (!rigSkin) {
          for (const side of [-1, 1]) {
            const eye = box(0.8, 0.8, 0.4, "#1c1c1c");
            eye.position.set(side * 1.4 * P, 4 * P, -1.8 * P);
            head.add(eye);
          }
        }
        head.position.set(0, 9 * P, -4 * P);
        anim.head = head;
        anim.headRestZ = -4 * P;
        body.add(trunk, head);
        return { barHeight: 15 * P + 0.2, anim };
      }
      case "sheep": {
        // Vanilla ModelSheep boxes: 8x16x6 woolly body (wool overlay art)
        // on 4x12x4 legs, 6x6x8 head with a wool cap.
        const wool = "#eceae2";
        const hide = "#cbb9a8";
        const trunk = skinned(woolSkin, 8, 16, 9, wool, 28, 8, [8, 16, 6]);
        trunk.rotation.x = -Math.PI / 2;
        trunk.position.set(0, 15 * P, 1 * P);
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 6, 6, 8, hide, 0, 0);
        skull.position.z = -3 * P;
        head.add(skull);
        const cap = skinned(woolSkin, 6.6, 3, 6, wool, 0, 0, [6, 6, 6]);
        cap.position.set(0, 2.5 * P, -2 * P);
        head.add(cap);
        if (!rigSkin) {
          for (const side of [-1, 1]) {
            const eye = box(1, 1, 0.5, "#1c1c1c");
            eye.position.set(side * 2 * P, 1 * P, -7.2 * P);
            head.add(eye);
          }
        }
        head.position.set(0, 18 * P, -8 * P);
        anim.head = head;
        anim.headRestZ = -8 * P;
        quadLegs(4, 12, 3, wool, rigSkin);
        body.add(trunk, head);
        return { barHeight: 22 * P + 0.24, anim };
      }
      case "dummy": {
        // Straw archery target: a hay-bale block on a stub post, painted
        // rings on the face. It wobbles when hit and never hits back.
        const post = box(4, 8, 4, "#6b4a2a");
        post.position.y = 4 * P;
        const hay = new THREE.MeshLambertMaterial({ map: this.materials.texture("object.haybale.side") });
        const hayTop = new THREE.MeshLambertMaterial({ map: this.materials.texture("object.haybale.top") });
        const bale = new THREE.Mesh(
          new THREE.BoxGeometry(16 * P, 16 * P, 16 * P),
          [hay, hay, hayTop, hayTop, hay, hay],
        );
        bale.position.y = 16 * P;
        for (const [size, color, dz] of [
          [10, "#efe6d5", 8.2], [6, "#c0455a", 8.5], [2, "#efe6d5", 8.8],
        ] as const) {
          const ring = box(size, size, 0.4, color);
          ring.position.set(0, 16 * P, -dz * P);
          body.add(ring);
        }
        body.add(post, bale);
        return { barHeight: 26 * P + 0.2, anim };
      }
      case "wolf": {
        // Vanilla ModelWolf: 6x9x6 body and 8x6x7 mane both laid down along
        // z (rotateAngleX = pi/2), 6x6x4 head with a 3x3x4 muzzle and 2x2x1
        // ears, four 2x8x2 legs, and a 2x8x2 tail drooping off the rump.
        const fur = tint ?? "#9a9088";
        const dark = "#5a534c";
        // Exact vanilla ModelWolf boxes: legs 2x8x2 at x±1.5, back pair z7,
        // front pair z-4; feet at y=0.
        for (const [x, z] of [[-1.5, -4], [1.5, -4], [-1.5, 7], [1.5, 7]] as const) {
          const leg = skinned(rigSkin, 2, 8, 2, fur, 0, 18);
          leg.geometry.translate(0, -4 * P, 0);
          leg.position.set(x * P, 8 * P, z * P);
          anim.legs.push(leg);
          body.add(leg);
        }
        // Body (6x9x6) and mane ruff (8x6x7) both laid flat (rotateX=pi/2). The
        // trunk is pushed back to z≈3 so its rump reaches the hind legs (z7) and
        // the tail (z8); the ruff covers the shoulders over the front legs, so
        // the whole torso is one continuous mass with nothing floating.
        const trunk = skinned(rigSkin, 6, 9, 6, fur, 18, 14);
        trunk.rotation.x = -Math.PI / 2;
        trunk.position.set(0, 11 * P, 3.5 * P);
        const mane = skinned(rigSkin, 8, 6, 7, fur, 21, 0);
        mane.rotation.x = -Math.PI / 2;
        mane.position.set(0, 11 * P, -2 * P);
        // Neck: fills the ruff-to-skull gap so the head isn't a floating box.
        const neck = skinned(rigSkin, 4, 5, 5, fur, 0, 0, [6, 6, 4]);
        neck.position.set(0, 11 * P, -4 * P);
        // Head sits level with the back (centre y=10.5), not up on a giraffe
        // neck — the vanilla wolf holds its head low.
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 6, 6, 4, fur, 0, 0);
        head.add(skull);
        const snout = skinned(rigSkin, 3, 3, 4, dark, 0, 10);
        snout.position.set(0, -1.5 * P, -3 * P);
        head.add(snout);
        for (const side of [-1, 1]) {
          const ear = skinned(rigSkin, 2, 2, 1, dark, 16, 14);
          ear.position.set(side * 2 * P, 4 * P, 0.5 * P);
          head.add(ear);
          if (!rigSkin) {
            const eye = box(1, 1, 0.5, "#1c1c1c");
            eye.position.set(side * 1.5 * P, 0.5 * P, -2.2 * P);
            head.add(eye);
          }
        }
        head.position.set(0, 10.5 * P, -7 * P);
        anim.head = head;
        anim.headRestZ = -7 * P;
        // Tail hangs from the rump (pivot y12, z7 — tucked into the trunk back so
        // it reads as joined) and droops down-and-back.
        const tail = skinned(rigSkin, 2, 8, 2, fur, 9, 18);
        tail.geometry.translate(0, -4 * P, 0);
        tail.position.set(0, 12 * P, 7 * P);
        tail.rotation.x = -0.5;
        body.add(trunk, mane, neck, head, tail);
        return { barHeight: 17 * P + 0.24, anim };
      }
      case "slime": {
        // Vanilla slime: translucent outer cube with a solid core and face.
        // The base rig is the 1-block medium size; bosses scale up by def.
        const goo = tint ?? "#5d8c3a";
        let outer: THREE.Mesh;
        if (rigSkin) {
          const geo = new THREE.BoxGeometry(16 * P, 16 * P, 16 * P);
          setEntityUVs(geo, rigSkin, 0, 0, 8, 8, 8); // vanilla jelly shell region
          const gel = new THREE.MeshLambertMaterial({
            map: rigSkin.material.map,
            color: rigSkin.material.color,
            transparent: true,
            opacity: 0.7,
          });
          outer = new THREE.Mesh(geo, gel);
        } else {
          outer = new THREE.Mesh(
            new THREE.BoxGeometry(16 * P, 16 * P, 16 * P),
            new THREE.MeshLambertMaterial({ color: goo, transparent: true, opacity: 0.55 }),
          );
        }
        outer.position.y = 8 * P;
        outer.userData.baseY = outer.position.y;
        anim.segments.push(outer); // wobble
        const core = skinned(rigSkin, 10, 10, 10, goo, 0, 16, [6, 6, 6]);
        core.position.y = 8 * P;
        for (const side of [-1, 1]) {
          const eye = skinned(rigSkin, 2, 2, 1, "#1c1c1c", 32, 0, [2, 2, 2]);
          eye.position.set(side * 3.5 * P, 10 * P, -7.8 * P);
          body.add(eye);
        }
        const mouth = skinned(rigSkin, 1, 1, 1, "#1c1c1c", 32, 4);
        mouth.position.set(0, 6.5 * P, -7.8 * P);
        body.add(outer, core, mouth);
        return { barHeight: 18 * P + 0.2, anim };
      }
      case "husk": {
        // Zombie-dimension humanoid (8x8x8 head, 8x12x4 torso, 4x12x4
        // limbs) with the classic arms-forward shamble. Tint = skin.
        const hide = tint ?? "#5f7355";
        const garb = "#4c463c";
        for (const side of [-1, 1]) {
          const leg = skinned(rigSkin, 4, 12, 4, garb, 0, 16);
          leg.geometry.translate(0, -6 * P, 0);
          leg.position.set(side * 2 * P, 12 * P, 0);
          anim.legs.push(leg);
          body.add(leg);
        }
        const torso = skinned(rigSkin, 8, 12, 4, garb, 16, 16);
        torso.position.y = 18 * P;
        for (const side of [-1, 1]) {
          const arm = skinned(rigSkin, 4, 12, 4, hide, 40, 16);
          arm.geometry.translate(0, -6 * P, 0);
          arm.position.set(side * 6 * P, 23 * P, 0);
          // Reaching toward the rig's front (-z): positive pitch swings a
          // hanging limb forward, same sign convention as the player rig.
          arm.rotation.x = Math.PI / 2 - 0.15;
          body.add(arm);
        }
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 8, 8, 8, hide, 0, 0);
        skull.position.y = 4 * P;
        head.add(skull);
        if (!rigSkin) {
          for (const side of [-1, 1]) {
            const eye = box(2, 2, 0.5, "#191d16");
            eye.position.set(side * 2 * P, 5 * P, -4.2 * P);
            head.add(eye);
          }
        }
        head.position.set(0, 24 * P, 0);
        anim.head = head;
        anim.headRestZ = 0;
        body.add(torso, head);
        return { barHeight: 32 * P + 0.2, anim };
      }
      case "creeper": {
        // Vanilla ModelCreeper: 8x8x8 head, 8x12x4 body, four 4x6x4 legs.
        // Original mossy-green art (no bundled MC skin).
        const green = tint ?? "#588f3d";
        const dark = "#3c6a2c";
        for (const [x, z] of [[-2, 4], [2, 4], [-2, -4], [2, -4]] as const) {
          const leg = box(4, 6, 4, green);
          leg.geometry.translate(0, -3 * P, 0);
          leg.position.set(x * P, 6 * P, z * P);
          anim.legs.push(leg);
          body.add(leg);
        }
        const torso = box(8, 12, 4, green);
        torso.position.y = 12 * P;
        for (const [px, py, pz, pw, ph] of [[-2, 15, 2, 3, 4], [3, 10, -2, 2.5, 5], [-3, 8, 2, 2, 3]] as const) {
          const patch = box(pw, ph, 0.4, dark);
          patch.position.set(px * P, py * P, pz * P);
          body.add(patch);
        }
        const head = new THREE.Group();
        const skull = box(8, 8, 8, green);
        skull.position.y = 4 * P;
        head.add(skull);
        // The unmistakable face: two eyes and the pixel mouth.
        for (const [fx, fy, fw, fh] of [[-2, 5, 2, 2], [2, 5, 2, 2], [0, 2, 2, 4], [-2, 1, 2, 2], [2, 1, 2, 2]] as const) {
          const p = box(fw, fh, 0.5, "#0e140e");
          p.position.set(fx * P, fy * P, -4.2 * P);
          head.add(p);
        }
        head.position.set(0, 18 * P, 0);
        anim.head = head;
        anim.headRestZ = 0;
        body.add(torso, head);
        return { barHeight: 26 * P + 0.2, anim };
      }
      case "zombie": {
        // Vanilla biped dimensions (8x8x8 head, 8x12x4 torso, 4x12x4 limbs)
        // with the classic arms-out shamble. Original rotted-green art.
        const skin = tint ?? "#4f7a3a";
        const shirt = "#3a5a8a";
        const pants = "#33436a";
        for (const side of [-1, 1]) {
          const leg = box(4, 12, 4, pants);
          leg.geometry.translate(0, -6 * P, 0);
          leg.position.set(side * 2 * P, 12 * P, 0);
          anim.legs.push(leg);
          body.add(leg);
        }
        const torso = box(8, 12, 4, shirt);
        torso.position.y = 18 * P;
        for (const side of [-1, 1]) {
          const arm = box(4, 12, 4, skin);
          arm.geometry.translate(0, -6 * P, 0);
          arm.position.set(side * 6 * P, 23 * P, 0);
          arm.rotation.x = Math.PI / 2 - 0.1; // reaching forward
          body.add(arm);
        }
        const head = new THREE.Group();
        const skull = box(8, 8, 8, skin);
        skull.position.y = 4 * P;
        head.add(skull);
        for (const side of [-1, 1]) {
          const eye = box(2, 2, 0.5, "#0c1a0c");
          eye.position.set(side * 2 * P, 5 * P, -4.2 * P);
          head.add(eye);
        }
        head.position.set(0, 24 * P, 0);
        anim.head = head;
        anim.headRestZ = 0;
        body.add(torso, head);
        return { barHeight: 32 * P + 0.2, anim };
      }
      case "skeleton": {
        // Vanilla skeleton: biped torso/head with thin 2x12x2 arms and legs.
        // Original bone-white art, hollow eye sockets.
        const bone = tint ?? "#d8d5c8";
        for (const side of [-1, 1]) {
          const leg = box(2, 12, 2, bone);
          leg.geometry.translate(0, -6 * P, 0);
          leg.position.set(side * 2 * P, 12 * P, 0);
          anim.legs.push(leg);
          body.add(leg);
        }
        const torso = box(8, 12, 4, bone);
        torso.position.y = 18 * P;
        for (const side of [-1, 1]) {
          const arm = box(2, 12, 2, bone);
          arm.geometry.translate(0, -6 * P, 0);
          arm.position.set(side * 5 * P, 23 * P, 0);
          arm.rotation.x = Math.PI / 2 - 0.1;
          body.add(arm);
        }
        const head = new THREE.Group();
        const skull = box(8, 8, 8, bone);
        skull.position.y = 4 * P;
        head.add(skull);
        for (const side of [-1, 1]) {
          const socket = box(2, 2, 0.5, "#20201c");
          socket.position.set(side * 2 * P, 5 * P, -4.2 * P);
          head.add(socket);
        }
        head.position.set(0, 24 * P, 0);
        anim.head = head;
        anim.headRestZ = 0;
        body.add(torso, head);
        return { barHeight: 32 * P + 0.2, anim };
      }
      case "squid": {
        // Vanilla squid: a 12x16x12 mantle with eight 2x18x2 tentacles ringed
        // below. Original ink-purple art; it drifts on the water.
        const ink = tint ?? "#7166a6";
        const mantle = box(12, 16, 12, ink);
        mantle.position.y = 14 * P;
        body.add(mantle);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const t = box(2, 12, 2, ink);
          t.geometry.translate(0, -6 * P, 0);
          t.position.set(Math.cos(a) * 5 * P, 6 * P, Math.sin(a) * 5 * P);
          t.rotation.x = Math.sin(a) * 0.25;
          t.rotation.z = Math.cos(a) * 0.25;
          anim.legs.push(t);
          body.add(t);
        }
        for (const side of [-1, 1]) {
          const eye = box(2, 3, 0.5, "#141018");
          eye.position.set(side * 3.5 * P, 16 * P, -6.2 * P);
          body.add(eye);
        }
        return { barHeight: 24 * P + 0.2, anim };
      }
      case "ghast": {
        // Vanilla ghast: a 16x16x16 body with nine tentacles trailing below.
        // Original pale art with the mournful red face; it floats.
        const pale = tint ?? "#e6e6ea";
        const cube = box(16, 16, 16, pale);
        cube.position.y = 8 * P;
        body.add(cube);
        for (const side of [-1, 1]) {
          const eye = box(3, 2, 0.5, "#8f2b2b");
          eye.position.set(side * 3 * P, 10 * P, -8.2 * P);
          body.add(eye);
        }
        const mouth = box(2, 4, 0.5, "#8f2b2b");
        mouth.position.set(0, 5 * P, -8.2 * P);
        body.add(mouth);
        const tpos: Array<[number, number, number]> = [
          [3.75, 8, -5], [-1.25, 13, -5], [-6.25, 9, -5], [6.25, 11, 0], [1.25, 11, 0],
          [-3.75, 10, 0], [3.75, 12, 5], [-1.25, 9, 5], [-6.25, 12, 5],
        ];
        for (const [tx, th, tz] of tpos) {
          const t = box(2, th, 2, pale);
          t.geometry.translate(0, (-th / 2) * P, 0);
          t.position.set(tx * P, 0, tz * P);
          anim.legs.push(t);
          body.add(t);
        }
        return { barHeight: 18 * P + 0.5, anim };
      }
      case "construct": {
        // Original Braidwright warden-construct: stacked masonry blocks
        // around a glowing core seam. Not a Minecraft creature — original
        // proportions, deliberately heavier than a person.
        const stone = tint ?? "#8a8d90";
        const dark = "#5d6165";
        for (const side of [-1, 1]) {
          const leg = box(4, 8, 4, dark);
          leg.geometry.translate(0, -4 * P, 0);
          leg.position.set(side * 3 * P, 8 * P, 0);
          anim.legs.push(leg);
          body.add(leg);
        }
        const torso = box(10, 10, 6, stone);
        torso.position.y = 13 * P;
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(6 * P, 2 * P, 6.4 * P),
          new THREE.MeshBasicMaterial({ color: "#7fe0c3" }),
        );
        seam.position.y = 13 * P;
        const shoulders = box(14, 4, 6, dark);
        shoulders.position.y = 20 * P;
        for (const side of [-1, 1]) {
          const arm = box(4, 12, 4, stone);
          arm.geometry.translate(0, -6 * P, 0);
          arm.position.set(side * 9 * P, 20 * P, 0);
          anim.legs.push(arm); // arms swing with the lumbering gait
          body.add(arm);
        }
        const head = new THREE.Group();
        const skull = box(6, 5, 6, stone);
        skull.position.y = 2.5 * P;
        head.add(skull);
        const eye = new THREE.Mesh(
          new THREE.BoxGeometry(4 * P, 1 * P, 0.5 * P),
          new THREE.MeshBasicMaterial({ color: "#7fe0c3" }),
        );
        eye.position.set(0, 3 * P, -3.2 * P);
        head.add(eye);
        head.position.set(0, 22 * P, 0);
        anim.head = head;
        anim.headRestZ = 0;
        body.add(torso, seam, shoulders, head);
        return { barHeight: 28 * P + 0.22, anim };
      }
      case "spider":
      case "gnasher": {
        // Vanilla ModelSpider boxes: 8x8x8 head, 6x6x6 thorax, 10x8x12
        // abdomen, eight 16x2x2 legs fanned from the thorax. Old Gnasher is
        // the same rig scaled up by its def, ore-crusted, with ember eyes.
        const boss = kind === "gnasher";
        const bodyColor = boss ? "#3a2f26" : tint ?? "#3d3630";
        const legColor = boss ? "#2e2620" : tint ?? "#332d28";
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 8, 8, 8, bodyColor, 32, 4);
        skull.position.z = -4 * P;
        head.add(skull);
        if (!rigSkin) {
          // Two rows of glinting eyes across the face.
          for (const [x, y, w] of [[-2.6, 1.5, 1.4], [2.6, 1.5, 1.4], [-1.1, -0.5, 1], [1.1, -0.5, 1]] as const) {
            const eye = new THREE.Mesh(
              new THREE.BoxGeometry(w * P, w * P, 0.5 * P),
              new THREE.MeshBasicMaterial({ color: boss ? "#ff5a2a" : "#c0392b" }),
            );
            eye.position.set(x * P, y * P, -8.2 * P);
            head.add(eye);
          }
          for (const side of [-1, 1]) {
            const fang = box(1, 2, 1, legColor);
            fang.position.set(side * 2 * P, -4.5 * P, -7 * P);
            head.add(fang);
          }
        }
        head.position.set(0, 9 * P, -3 * P); // vanilla head pivot
        anim.head = head;
        anim.headRestZ = -3 * P;
        const thorax = skinned(rigSkin, 6, 6, 6, bodyColor, 0, 0);
        thorax.position.set(0, 9 * P, 0);
        const abdomen = skinned(rigSkin, 10, 8, 12, bodyColor, 0, 12);
        abdomen.position.set(0, 9 * P, 9 * P);
        abdomen.userData.baseY = abdomen.position.y;
        anim.segments.push(abdomen); // abdomen bobs with the undulation anim
        if (boss) {
          // Ore crust and spikes along the abdomen: she sleeps under the lode.
          const ore = new THREE.MeshLambertMaterial({
            map: this.materials.texture("resource.rock.tin"),
          });
          for (const [x, y, z, sz] of [[-2, 4, -2, 4], [2.5, 4, 2, 3], [0, 4.5, 0, 3.5]] as const) {
            const nub = new THREE.Mesh(new THREE.BoxGeometry(sz * P, sz * 0.7 * P, sz * P), ore);
            nub.position.set(x * P, y * P, z * P); // relative to abdomen center
            abdomen.add(nub);
          }
          for (const z of [-4, 0, 4]) {
            const spike = box(1.5, 3.5, 1.5, "#2e2620");
            spike.position.set(0, 5 * P, z * P);
            abdomen.add(spike);
          }
        }
        // Eight legs, pivoting at the thorax, fanned and tilted to the ground.
        for (const side of [-1, 1] as const) {
          for (let i = 0; i < 4; i++) {
            const leg = skinned(rigSkin, 16, 2, 2, legColor, 18, 0);
            leg.geometry.translate(side * 8 * P, 0, 0);
            leg.position.set(side * 2 * P, 9 * P, (2 - i * 2) * P);
            leg.rotation.y = side * (i - 1.5) * -0.45;
            leg.rotation.z = side * -0.5; // slope down so the tips touch ground
            anim.legs.push(leg);
            body.add(leg);
          }
        }
        body.add(head, thorax, abdomen);
        return { barHeight: 13 * P + 0.25, anim };
      }
    }
  }

  private arrows: Array<{ mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number }> = [];

  private spawnArrow(from: THREE.Vector3, to: THREE.Vector3): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.45),
      new THREE.MeshBasicMaterial({ color: "#d9c48f" }),
    );
    mesh.position.copy(from);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.arrows.push({ mesh, from, to, t: 0 });
  }

  private updateArrows(dt: number): void {
    for (const arrow of [...this.arrows]) {
      arrow.t += dt / 0.16; // ~160ms of flight
      if (arrow.t >= 1) {
        this.scene.remove(arrow.mesh);
        arrow.mesh.geometry.dispose();
        (arrow.mesh.material as THREE.Material).dispose();
        this.arrows.splice(this.arrows.indexOf(arrow), 1);
        continue;
      }
      arrow.mesh.position.lerpVectors(arrow.from, arrow.to, arrow.t);
    }
  }

  private updateEnemies(dt: number): void {
    this.updateArrows(dt);
    for (const [id, view] of this.enemyViews) {
      const enemy = this.sim.enemies.get(id);
      if (!enemy) continue;
      const alive = enemy.phase === "alive";
      view.group.visible = alive;
      view.barGroup.visible = false;
      if (!alive) continue;

      const view3 = ENEMIES[enemy.defId]?.view;
      // Squid rides the waterline; the ghast drifts well above the ground.
      const onWater = this.sim.world.blockAt(enemy.movement.currentCell()) === "water";
      let cellH = view3 === "squid" && onWater
        ? this.waterSurfaceY(enemy.movement.currentCell())
        : this.sim.world.surfaceY(enemy.movement.currentCell());
      if (view3 === "ghast") cellH += 2.6 + Math.sin(this.elapsed * 1.5) * 0.2;
      const moving = enemy.movement.isMoving();
      const bob = moving && view3 !== "ghast" && view3 !== "squid" ? Math.abs(Math.sin(this.elapsed * 10)) * 0.05 : 0;
      view.group.position.set(enemy.movement.pos.x, cellH + bob, enemy.movement.pos.z);
      view.group.rotation.y = enemy.movement.facing + Math.PI;
      if (view.shakeT > 0) {
        view.shakeT -= dt;
        view.group.rotation.z = Math.sin(view.shakeT * 45) * 0.08 * Math.max(0, view.shakeT);
        if (view.shakeT <= 0) view.group.rotation.z = 0;
      }

      // Rig animation: trotting legs, undulating segments, lunge on attack.
      const anim = view.anim;
      if (anim.bb) {
        if (anim.lungeT > 0) {
          anim.lungeT -= dt;
          anim.bb.play("attack");
        } else {
          anim.bb.play(moving ? "walk" : "idle");
        }
        anim.bb.update(dt);
      }
      if (moving) anim.walkPhase += dt * 11;
      const swing = Math.sin(anim.walkPhase) * 0.55;
      anim.legs.forEach((leg, i) => {
        leg.rotation.x = moving ? (i % 2 === 0 ? swing : -swing) : leg.rotation.x * 0.8;
      });
      if (anim.wings) {
        if (anim.groundBird) {
          // Wings tucked, fluttering up from the body — a gentle idle ripple,
          // faster while it scurries — rather than a frantic constant flap.
          const amp = moving ? 0.5 : 0.12;
          const flap = Math.abs(Math.sin(this.elapsed * (moving ? 9 : 3))) * amp;
          for (const w of anim.wings) w.obj.rotation.z = w.base + w.sign * flap;
        } else {
          // Hovering flyers (bat, bee, allay…) beat their wings constantly.
          const flap = Math.sin(this.elapsed * 22) * 0.6;
          for (const w of anim.wings) w.obj.rotation.z = w.base + w.sign * flap;
        }
      }
      if (anim.sway) {
        const s = Math.sin(this.elapsed * 2.2);
        for (const w of anim.sway) {
          w.obj.rotation.z = w.baseZ + w.sign * s * 0.18;
          w.obj.rotation.x = w.baseX + Math.sin(this.elapsed * 1.7 + w.sign) * 0.1;
        }
      }
      anim.segments.forEach((seg, i) => {
        seg.position.y = (seg.userData.baseY as number) + Math.sin(this.elapsed * 6 + i * 0.9) * 0.035;
      });
      if (anim.lungeT > 0) {
        anim.lungeT -= dt;
        const extension = Math.sin((1 - Math.max(0, anim.lungeT) / 0.35) * Math.PI);
        anim.body.position.z = -extension * 0.28;
        if (anim.head) anim.head.position.z = anim.headRestZ - extension * 0.22;
      } else {
        anim.body.position.z *= 0.7;
        if (anim.head) anim.head.position.z = anim.headRestZ;
      }

      const def = ENEMIES[enemy.defId];
      if (enemy.engaged || enemy.hp < def.maxHealth) {
        const frac = Math.max(0, enemy.hp / def.maxHealth);
        view.barFg.scale.x = frac;
        view.barFg.position.x = (-0.7 * (1 - frac)) / 2;
        view.barGroup.position.set(
          enemy.movement.pos.x,
          cellH + view.barHeight,
          enemy.movement.pos.z,
        );
        view.barGroup.quaternion.copy(this.rig.camera.quaternion);
        view.barGroup.visible = true;
      }
    }
  }

  /** Show the equipped tool in the player's hand — or the torch, which the
   *  player carries in-hand (gripped like any tool) while "hold torch" is on. */
  private syncHeldItem(): void {
    const itemId = this.sim.equippedTool;
    const spriteId = this.holdTorch
      ? "sprite.item.torch"
      : itemId ? HELD_SPRITES[itemId] : undefined;
    this.playerView.setHeldItem(spriteId ? this.materials.texture(spriteId) : null);
    this.syncArmor();
  }

  /** Dress the player model in whatever armor the sim says is worn. */
  private syncArmor(): void {
    const plate = (itemId: string | null): THREE.Texture | null => {
      if (!itemId) return null;
      const tier = itemId.split(".").pop()!;
      return this.materials.texture(`armor.plate.${tier}`);
    };
    this.playerView.setArmor({
      head: plate(this.sim.equippedArmor.head),
      body: plate(this.sim.equippedArmor.body),
      legs: plate(this.sim.equippedArmor.legs),
    });
  }

  // ---------- events ----------

  handleEvents(events: SimEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case "targetSelected": {
          this.selectionRing.position.set(ev.cell.x + 0.5, this.surfaceY(ev.cell) + 0.03, ev.cell.z + 0.5);
          this.selectionRing.visible = true;
          break;
        }
        case "destinationSet": {
          this.destinationMarker.position.set(ev.cell.x + 0.5, this.surfaceY(ev.cell) + 0.03, ev.cell.z + 0.5);
          this.destinationMarker.visible = true;
          break;
        }
        case "actionEnded":
        case "actionRejected":
          this.selectionRing.visible = false;
          break;
        case "doorOpened":
          this.doorTargets.set(ev.instanceId, -Math.PI / 2 + 0.08); // swing inward
          this.selectionRing.visible = false;
          break;
        case "doorClosed":
          this.doorTargets.set(ev.instanceId, 0);
          break;
        case "containerOpened":
          this.selectionRing.visible = false;
          break;
        case "equipmentChanged":
          this.syncHeldItem();
          break;
        case "playerAttack": {
          const view = this.enemyViews.get(ev.instanceId);
          if (view && ev.damage !== null) {
            view.shakeT = 0.3;
            this.particles.burst(view.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 5);
          }
          // Bow shots trace a dart to the target (melee reads on its own).
          if (view && this.playerView) {
            const from = this.playerView.group.position.clone().add(new THREE.Vector3(0, 1.2, 0));
            const to = view.group.position.clone().add(new THREE.Vector3(0, 0.9, 0));
            if (from.distanceTo(to) > 1.8) this.spawnArrow(from, to);
          }
          break;
        }
        case "enemyDied": {
          const view = this.enemyViews.get(ev.instanceId);
          if (view) this.particles.burst(view.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 14);
          this.selectionRing.visible = false;
          break;
        }
        case "enemyAttack": {
          const view = this.enemyViews.get(ev.instanceId);
          if (view) view.anim.lungeT = 0.35;
          break;
        }
        case "actionCycle": {
          const view = this.nodeViews.get(ev.targetId);
          if (view) {
            view.shakeT = 0.35;
            if (ev.success) {
              this.particles.burst(
                new THREE.Vector3(view.cell.x + 0.5, view.baseY + 1.1, view.cell.z + 0.5),
              );
            }
          }
          break;
        }
        case "nodeDepleted": {
          const view = this.nodeViews.get(ev.instanceId);
          if (view) {
            view.activeGroup.visible = false;
            view.depletedMesh.visible = true;
          }
          break;
        }
        case "nodeRespawned": {
          const view = this.nodeViews.get(ev.instanceId);
          if (view) {
            view.activeGroup.visible = true;
            view.depletedMesh.visible = false;
            view.activeGroup.scale.setScalar(view.baseScale * 0.35); // grow-pop handled in update()
          }
          break;
        }
        default:
          break;
      }
    }
  }

  // ---------- per-frame ----------

  private playerBoat: THREE.Group | null = null;
  private playerBoatTier: string | null = null;

  /** Hull colours per boat tier (raft logs, planked rowboat, dark skiff). */
  private static readonly BOAT_TINT: Record<string, string> = {
    "tool.boat.raft": "#7c5a33",
    "tool.boat.rowboat": "#9a7a46",
    "tool.boat.skiff": "#5f4326",
  };

  /** Build a simple planked hull: a shallow floor ringed by low gunwales. */
  private buildBoatHull(itemId: string): THREE.Group {
    const g = new THREE.Group();
    const color = GameRenderer.BOAT_TINT[itemId] ?? "#7c5a33";
    const mat = new THREE.MeshLambertMaterial({ color });
    const trim = new THREE.MeshLambertMaterial({ color: "#3f2c17" });
    const part = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      g.add(mesh);
    };
    part(1.5, 0.2, 2.3, mat, 0, 0.1, 0); // floor
    part(1.5, 0.32, 0.18, trim, 0, 0.26, -1.15); // bow rail
    part(1.5, 0.32, 0.18, trim, 0, 0.26, 1.15); // stern rail
    part(0.18, 0.32, 2.3, trim, -0.72, 0.26, 0); // port gunwale
    part(0.18, 0.32, 2.3, trim, 0.72, 0.26, 0); // starboard gunwale
    return g;
  }

  /** Show/track the boat hull under the player when they're afloat. */
  private updatePlayerBoat(itemId: string | null, pos: { x: number; z: number }, playerY: number): void {
    if (!itemId) {
      if (this.playerBoat) this.playerBoat.visible = false;
      return;
    }
    if (!this.playerBoat || this.playerBoatTier !== itemId) {
      if (this.playerBoat) this.scene.remove(this.playerBoat);
      this.playerBoat = this.buildBoatHull(itemId);
      this.playerBoatTier = itemId;
      this.scene.add(this.playerBoat);
    }
    this.playerBoat.visible = true;
    // Sit just below the player, at the waterline, aligned to travel heading.
    this.playerBoat.position.set(pos.x, playerY - 0.2, pos.z);
    this.playerBoat.rotation.y = -this.sim.movement.facing;
  }

  playerWorldPos(): THREE.Vector3 {
    return this.playerView.group.position.clone();
  }

  private sunLight: THREE.DirectionalLight | null = null;
  private ambientLight: THREE.AmbientLight | null = null;
  /** A small pool of point lights reused for the nearest live light sources
   *  (campfires, lamps, lanterns…) around the player; the torch rides on the
   *  player when held. Lit at night / in the dark, off in daylight. */
  private lightPool: THREE.PointLight[] = [];
  private torchLight: THREE.PointLight | null = null;
  private holdTorch = false;
  private baseTheme: { sky: string; sun: number; ambient: number } = DEFAULT_THEME;
  private baseSky = new THREE.Color(DEFAULT_THEME.sky);
  private outdoorCycle = false;
  private precip: THREE.Points | null = null;
  private precipKind: "rain" | "snow" | "storm" | null = null;
  private readonly skyWork = new THREE.Color();
  private readonly seasonSky = new THREE.Color();
  private static readonly NIGHT_SKY = new THREE.Color("#0c1524");
  private static readonly STORM_SKY = new THREE.Color("#4c5866");
  private static readonly FLASH_SKY = new THREE.Color("#e8eef6");
  /** Lightning: current flash brightness (0..1) and countdown to next bolt. */
  private lightning = 0;
  private lightningWait = 2.5;

  /** Turn the held torch on/off (character carries a lit torch as they move).
   *  The torch shows in the fist via the held-item system, gripped like a tool;
   *  toggling off restores whatever tool was equipped. */
  setHoldTorch(on: boolean): void {
    this.holdTorch = on;
    if (!on && this.torchLight) this.torchLight.intensity = 0;
    this.syncHeldItem();
  }

  /**
   * Assign the point-light pool to the nearest live emitters around the player,
   * and drive the held torch. Lights ramp up after dark (or fully in the dark of
   * a dungeon) and fade out in daylight, so a torch/lamp actually lights the way.
   */
  private updateLights(): void {
    const dark = this.outdoorCycle ? Math.max(0, 1 - this.sim.daylight() * 1.15) : 1;
    // The held torch always burns while carried (dimmer by day, bright at night).
    if (this.torchLight) this.torchLight.intensity = this.holdTorch ? 3.4 + 4.4 * dark : 0;

    const p = this.sim.movement.pos;
    // Unified candidate list: placed emitter objects (campfire/lantern/…) plus
    // emissive blocks baked into streamed structures (house lanterns, glowstone).
    const near: Array<{ x: number; y: number; z: number; color: string; dist: number; power: number; d2: number }> = [];
    if (dark > 0.02) {
      for (const o of this.sim.world.region.objects) {
        const spec = LIGHT_SOURCES[o.defId];
        if (!spec) continue;
        const wx = o.cell.x + 0.5, wz = o.cell.z + 0.5;
        const dx = wx - p.x, dz = wz - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 46 * 46) {
          near.push({ x: wx, y: this.sim.world.surfaceY(o.cell) + spec.y, z: wz, color: spec.color, dist: spec.dist, power: spec.power, d2 });
        }
      }
      for (const v of this.structureVisuals.values()) {
        for (const l of v.lights) {
          const dx = l.x - p.x, dz = l.z - p.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < 46 * 46) {
            const soul = l.color !== "#ffd873";
            near.push({ x: l.x, y: l.y, z: l.z, color: l.color, dist: 9.5, power: soul ? 1.7 : 2.0, d2 });
          }
        }
      }
      // Enchanted trees cast their own coloured glow into the canopy at night
      // — a glow-tree lights a clearing cyan, an ember-tree burns it orange.
      // These are rare, so the scan stays cheap.
      for (const n of this.sim.world.region.nodes) {
        const glow = n.defId === "resource.tree.grand.glow";
        const ember = !glow && n.defId === "resource.tree.grand.ember";
        if (!glow && !ember) continue;
        const wx = n.cell.x + 0.5, wz = n.cell.z + 0.5;
        const dx = wx - p.x, dz = wz - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 46 * 46) {
          near.push({
            x: wx, y: this.sim.world.surfaceY(n.cell) + 6, z: wz,
            color: glow ? "#46e6c4" : "#ff6a2a", dist: 14, power: glow ? 2.4 : 2.0, d2,
          });
        }
      }
      near.sort((a, b) => a.d2 - b.d2);
    }
    for (let i = 0; i < this.lightPool.length; i++) {
      const pl = this.lightPool[i];
      const hit = near[i];
      if (!hit) { pl.visible = false; pl.intensity = 0; continue; }
      pl.color.set(hit.color);
      pl.distance = hit.dist;
      pl.intensity = hit.power * dark;
      pl.position.set(hit.x, hit.y, hit.z);
      pl.visible = pl.intensity > 0.01;
    }
  }

  /** Day/night light + sky, and precipitation around the player. */
  private updateSkyAndWeather(dt: number): void {
    if (!this.outdoorCycle || !this.sunLight || !this.ambientLight) return;
    const daylight = this.sim.daylight();
    const weather = this.sim.weather();
    const wDim = weather === "clear" ? 0 : weather === "overcast" ? 0.22 : weather === "rain" ? 0.42 : 0.58;

    const targetSun = this.baseTheme.sun * (0.16 + 0.84 * daylight) * (1 - wDim * 0.6);
    const targetAmb = this.baseTheme.ambient * (0.42 + 0.58 * daylight) * (1 - wDim * 0.4);
    this.sunLight.intensity += (targetSun - this.sunLight.intensity) * Math.min(1, dt * 2);
    this.ambientLight.intensity += (targetAmb - this.ambientLight.intensity) * Math.min(1, dt * 2);

    // Storm lightning: occasional bolt that briefly floods the scene with a
    // cold-white flash (a quick double-strike), then decays.
    if (weather === "storm") {
      this.lightningWait -= dt;
      if (this.lightningWait <= 0) {
        this.lightning = 1;
        // Next bolt in 3–10s; a short gap sometimes gives a flicker/re-strike.
        this.lightningWait = Math.random() < 0.35 ? 0.12 + Math.random() * 0.1 : 3 + Math.random() * 7;
      }
    } else {
      this.lightning = 0;
    }
    if (this.lightning > 0) {
      this.lightning = Math.max(0, this.lightning - dt * 5.5);
      const flash = this.lightning * this.lightning; // sharp attack, soft tail
      this.sunLight.intensity += flash * 2.2;
      this.ambientLight.intensity += flash * 1.6;
    }

    // Night pulls the sky toward deep blue; foul weather greys it out; a bolt
    // whitens it for an instant. The season leans daytime skies toward its own
    // hue (autumn amber, winter pale blue…), strongest under a clear noon.
    this.skyWork.copy(this.baseSky);
    this.seasonSky.set(this.sim.seasonInfo().tint);
    this.skyWork.lerp(this.seasonSky, daylight * (1 - wDim) * 0.14);
    this.skyWork.lerp(GameRenderer.NIGHT_SKY, (1 - daylight) * 0.92);
    this.skyWork.lerp(GameRenderer.STORM_SKY, wDim);
    if (this.lightning > 0) this.skyWork.lerp(GameRenderer.FLASH_SKY, this.lightning * this.lightning * 0.85);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.lerp(this.skyWork, Math.min(1, dt * 2));
    }

    // Precipitation: rain streaks or snow, riding along with the player.
    const playerCell = this.sim.movement.currentCell();
    const ground = this.sim.world.blockAt(playerCell);
    // Snow falls on cold ground — and everywhere in the depths of winter.
    const cold = ground === "snow" || ground === "ice" || this.sim.seasonInfo().cold;
    const want: "rain" | "snow" | "storm" | null =
      weather === "rain" || weather === "storm" ? (cold ? "snow" : weather === "storm" ? "storm" : "rain") : null;
    if (want !== this.precipKind) {
      if (this.precip) {
        this.scene.remove(this.precip);
        this.precip.geometry.dispose();
        (this.precip.material as THREE.Material).dispose();
        this.precip = null;
      }
      this.precipKind = want;
      if (want) {
        const count = want === "storm" ? 900 : want === "snow" ? 380 : 550;
        const arr = new Float32Array(count * 3);
        const p = this.sim.movement.pos;
        for (let i = 0; i < count; i++) {
          arr[i * 3] = p.x + (Math.random() - 0.5) * 46;
          arr[i * 3 + 1] = Math.random() * 20;
          arr[i * 3 + 2] = p.z + (Math.random() - 0.5) * 46;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
        const mat = new THREE.PointsMaterial({
          color: want === "snow" ? "#f2f6fb" : "#b8d0ea",
          size: want === "snow" ? 0.22 : 0.17,
          transparent: true,
          opacity: want === "snow" ? 0.95 : 0.8,
          depthWrite: false,
        });
        this.precip = new THREE.Points(g, mat);
        this.precip.frustumCulled = false;
        this.scene.add(this.precip);
      }
    }
    if (this.precip) {
      const p = this.sim.movement.pos;
      const py = this.sim.world.heightAt(playerCell);
      const attr = this.precip.geometry.getAttribute("position") as THREE.BufferAttribute;
      const a = attr.array as Float32Array;
      const fall = (this.precipKind === "snow" ? 3.2 : this.precipKind === "storm" ? 24 : 17) * dt;
      const drift = this.precipKind === "snow" ? Math.sin(this.elapsed * 0.7) * 0.6 * dt : 0;
      for (let i = 0; i < a.length; i += 3) {
        a[i + 1] -= fall;
        a[i] += drift;
        if (a[i + 1] < py - 1) {
          a[i] = p.x + (Math.random() - 0.5) * 46;
          a[i + 1] = py + 14 + Math.random() * 8;
          a[i + 2] = p.z + (Math.random() - 0.5) * 46;
        }
      }
      attr.needsUpdate = true;
    }
  }

  update(dt: number): void {
    this.ensureStreamed(false); // terrain chunks (throttled to movement)
    // Entity visuals stream every frame within a per-frame budget, so the
    // first load fills in smoothly rather than in one giant hitch.
    const pp = this.sim.movement.pos;
    this.streamEntities(pp.x, pp.z);
    this.elapsed += dt;
    // Dropped items bob gently and spin so they catch the eye.
    for (const view of this.groundItemViews.values()) {
      view.group.position.y = view.baseY + 0.08 + Math.sin(this.elapsed * 2.6 + view.cell.x) * 0.06;
      view.group.rotation.y = this.elapsed * 1.2;
    }
    // Canopy sway: gentle in calm weather, stronger (and faster) in wind/rain.
    const weather = this.sim.weather();
    const gust = weather === "storm" ? 3.0 : weather === "rain" ? 1.7 : weather === "overcast" ? 1.2 : 1.0;
    this.windTime.value = this.elapsed * (1.0 + gust * 0.25);
    this.windAmp.value = 0.04 * gust;
    this.updateSkyAndWeather(dt);
    this.updateLights();

    // Player character (position, elevation smoothing, and animation).
    const pos = this.sim.movement.pos;
    const onWater = this.sim.world.blockAt(this.sim.movement.currentCell()) === "water";
    const boating = onWater && this.sim.bestBoat() !== null;
    // On the water the player rides at the flat surface, not down on the bed.
    const cellH = onWater ? this.waterSurfaceY(this.sim.movement.currentCell()) + (boating ? 0.18 : 0) : this.sim.world.surfaceY(this.sim.movement.currentCell());
    this.playerView.update(dt, {
      x: pos.x,
      z: pos.z,
      targetY: cellH,
      facing: this.sim.movement.facing,
      moving: this.sim.movement.isMoving() && !boating, // sitting, not walking
      action: this.sim.actions.currentActionAnim(),
    });
    this.updatePlayerBoat(boating ? this.sim.bestBoat()!.itemId : null, pos, this.playerView.group.position.y);

    // Portal membranes breathe so an active gate visibly shimmers.
    if (this.portalGlows.length > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.4);
      for (const g of this.portalGlows) g.mat.opacity = g.base + g.amp * pulse;
    }

    this.updateQuestGuidance();

    // Doors ease toward their open/closed angle.
    for (const [id, leaf] of this.doorLeaves) {
      const target = this.doorTargets.get(id) ?? 0;
      if (Math.abs(leaf.rotation.y - target) > 0.001) {
        leaf.rotation.y += (target - leaf.rotation.y) * Math.min(1, dt * 10);
      }
    }

    // NPCs + quest markers.
    for (const [id, view] of this.npcViews) {
      const npc = this.sim.npcs.get(id);
      if (!npc) continue;
      view.update(dt, {
        x: npc.movement.pos.x,
        z: npc.movement.pos.z,
        targetY: this.sim.world.surfaceY(npc.movement.currentCell()),
        facing: npc.movement.facing,
        moving: npc.movement.isMoving(),
        action: null,
      });
      const mark = this.sim.quests.markFor(id);
      const bob = 2.15 + Math.sin(this.elapsed * 3) * 0.08;
      for (const kind of ["give", "ready"] as const) {
        const marker = view.group.getObjectByName(`quest-${kind}`);
        if (marker) {
          marker.visible = mark === kind;
          marker.position.y = bob;
          marker.rotation.y = -view.group.rotation.y; // keep it steady while the NPC turns
        }
      }
    }

    // Node shake, respawn grow-pop, and pond ripple pulse.
    for (const view of this.nodeViews.values()) {
      if (view.kind === "pond") {
        const s = 1 + Math.sin(this.elapsed * 2.2 + view.animPhase) * 0.16;
        view.activeGroup.scale.setScalar(s);
        continue;
      }
      if (view.shakeT > 0) {
        view.shakeT -= dt;
        const s = Math.sin(view.shakeT * 40) * 0.05 * Math.max(0, view.shakeT);
        view.activeGroup.rotation.z = s;
        if (view.shakeT <= 0) view.activeGroup.rotation.z = 0;
      }
      if (view.activeGroup.visible && view.activeGroup.scale.x < view.baseScale) {
        const s = Math.min(view.baseScale, view.activeGroup.scale.x + dt * 2.5);
        view.activeGroup.scale.setScalar(s);
      }
      // Farm plots: the sprout swells with growth progress — bare dirt when
      // unplanted, a full-size sprout just before the crop pops.
      const node = this.sim.nodes.get(view.instanceId);
      const grow = node ? NODES[node.defId].plantable : undefined;
      if (node && grow && node.phase === "depleted") {
        const progress =
          node.respawnRemainingS < 0
            ? 0
            : 1 - Math.min(1, node.respawnRemainingS / grow.growS);
        view.depletedMesh.scale.setScalar(0.2 + progress * 0.8);
      }
    }

    // Water drift, campfire flicker, particles.
    if (this.waterTexture) {
      this.waterTexture.offset.set(this.elapsed * 0.03, Math.sin(this.elapsed * 0.4) * 0.02);
    }
    for (const flame of this.flameGroups) {
      const flicker = 1 + Math.sin(this.elapsed * 9) * 0.08 + Math.sin(this.elapsed * 23) * 0.05;
      flame.scale.set(flicker, 1 / flicker + 0.08, flicker);
    }
    this.particles.update(dt);

    // Selection ring pulse, quantized to steps so it reads as retro frames.
    this.ringPulse += dt * 4;
    if (this.selectionRing.visible) {
      const s = 1 + Math.round(Math.sin(this.ringPulse) * 2) * 0.05;
      this.selectionRing.scale.setScalar(s);
    }
    // Hide destination marker once movement stops.
    if (!this.sim.movement.isMoving() && this.destinationMarker.visible && this.sim.actions.phase === "idle") {
      this.destinationMarker.visible = false;
    }

    this.updateEnemies(dt);
    if (this.playerMarker) {
      const p = this.playerView.group.position;
      this.playerMarker.position.set(p.x, p.y + 2.15 + Math.sin(this.elapsed * 3) * 0.06, p.z);
      this.playerMarker.quaternion.copy(this.rig.camera.quaternion);
    }
    this.updateOcclusionFade();
    this.rig.update(dt, this.playerWorldPos());
    this.renderer.render(this.scene, this.rig.camera);
  }

  /** Screen position of an arbitrary world point (for HUD floaters). */
  worldPointToScreen(x: number, y: number, z: number): { x: number; y: number } {
    return this.worldToScreen(new THREE.Vector3(x, y, z));
  }

  /**
   * Occlusion handling — the world stays SOLID, always:
   * - a dithered peek-hole opens through whatever stands between the
   *   camera and the player (buildings, trees), never touching anything
   *   at or below head height;
   * - standing INSIDE a structure that hides you slices its roof and
   *   upper walls off at head height (clip-plane cutaway, floor-plan
   *   style);
   * - the x-ray player silhouette covers whatever the hole can't;
   * - terrain walls keep their per-cell vertex-alpha windows.
   */
  private updateOcclusionFade(): void {
    const playerPos = this.playerWorldPos().add(new THREE.Vector3(0, 0.6, 0));
    const camPos = this.rig.camera.position.clone();
    const dir = playerPos.clone().sub(camPos);
    const dist = dir.length();
    dir.normalize();
    const ray = new THREE.Raycaster(camPos, dir, 0.1, dist - 0.5);
    // Tree canopies are dense merged meshes now — a triangle-precise
    // raycast per frame is ruinous. A bounding-box hit is plenty for the
    // peek-hole decision, and only trees near the sightline get tested.
    let treesOcclude = false;
    const box = new THREE.Box3();
    for (const v of this.nodeViews.values()) {
      if (!v.activeGroup.visible) continue;
      const dx = v.cell.x - playerPos.x;
      const dz = v.cell.z - playerPos.z;
      if (dx * dx + dz * dz > 45 * 45) continue;
      box.setFromObject(v.activeGroup);
      if (box.isEmpty()) continue;
      if (ray.ray.intersectsBox(box)) {
        treesOcclude = true;
        break;
      }
    }

    // Buildings and cave mouths: which groups actually hide the player?
    const fadeGroups = this.objectFadeGroups;
    const hitGroups = new Set<THREE.Object3D>();
    if (fadeGroups.length > 0) {
      for (const hit of ray.intersectObjects(fadeGroups.map((f) => f.group), true)) {
        let o: THREE.Object3D | null = hit.object;
        while (o && !fadeGroups.some((f) => f.group === o)) o = o.parent;
        if (o) hitGroups.add(o);
      }
    }
    const occluded = treesOcclude || hitGroups.size > 0;

    // Drive the peek-hole shader (eased so the dither dissolves in/out).
    const target = occluded ? 1 : 0;
    this.peepStrength += (target - this.peepStrength) * 0.2;
    if (Math.abs(this.peepStrength - target) < 0.01) this.peepStrength = target;
    peepUniforms.uPeepOn.value = this.peepStrength;
    peepUniforms.uPeepFeetY.value = this.playerWorldPos().y;
    peepUniforms.uPeepView.value
      .copy(playerPos)
      .applyMatrix4(this.rig.camera.matrixWorldInverse);

    // Roof cutaway: inside a structure that hides you, its roof and upper
    // walls slide down to head height; they rise back when you step out.
    const cell = this.sim.movement.currentCell();
    for (const visual of this.structureVisuals.values()) {
      const inside =
        cell.x >= visual.bounds.x0 && cell.x <= visual.bounds.x1 &&
        cell.z >= visual.bounds.z0 && cell.z <= visual.bounds.z1;
      // Cut the roof when the player is inside AND it hides them, OR when the
      // player recently clicked this structure's roof to peek inside.
      const wantCut = (inside && hitGroups.has(visual.group)) || this.elapsed < visual.peek;
      // Slice above the ground-floor room so its floor and walls stay visible
      // and the roof (and any upper storey) is removed. Keys off the structure
      // floor (not the player) so raised builds cut right.
      const goal = wantCut ? visual.roofCut : visual.cutTop;
      const eased = visual.cutPlane.constant + (goal - visual.cutPlane.constant) * 0.22;
      visual.cutPlane.constant = Math.abs(eased - goal) < 0.02 ? goal : eased;
    }

    // Voxel buildings are many walls thick; whatever the hole and cutaway
    // don't reveal, the x-ray silhouette does.
    this.setPlayerXray(occluded);

    // NPC / mob / chest ghosts: entities hidden behind trees or buildings
    // glow through as tinted silhouettes. Occluders are the same tree
    // bounding boxes plus the fade groups; entities far away stay dark.
    const occluderBoxes: THREE.Box3[] = [];
    for (const v of this.nodeViews.values()) {
      if (!v.activeGroup.visible) continue;
      const dx = v.cell.x - playerPos.x;
      const dz = v.cell.z - playerPos.z;
      if (dx * dx + dz * dz > 50 * 50) continue;
      const b = new THREE.Box3().setFromObject(v.activeGroup);
      if (!b.isEmpty()) occluderBoxes.push(b);
    }
    for (const f of this.objectFadeGroups) {
      const b = new THREE.Box3().setFromObject(f.group);
      if (!b.isEmpty()) occluderBoxes.push(b);
    }
    const ray2 = new THREE.Ray();
    const ghostTarget = new THREE.Vector3();
    const ghostHit = new THREE.Vector3();
    let purge = false;
    for (const g of this.ghostEntities) {
      if (!g.root.parent) {
        purge = true;
        continue;
      }
      g.root.getWorldPosition(ghostTarget);
      ghostTarget.y += 0.8;
      const ddx = ghostTarget.x - playerPos.x;
      const ddz = ghostTarget.z - playerPos.z;
      let show = false;
      if (g.root.visible && ddx * ddx + ddz * ddz < 45 * 45) {
        ray2.origin.copy(camPos);
        ray2.direction.copy(ghostTarget).sub(camPos).normalize();
        const maxDist = camPos.distanceTo(ghostTarget) - 1.2;
        for (const box of occluderBoxes) {
          const hit = ray2.intersectBox(box, ghostHit);
          if (hit && camPos.distanceTo(hit) < maxDist) {
            show = true;
            break;
          }
        }
      }
      for (const m of g.meshes) m.visible = show;
    }
    if (purge) this.ghostEntities = this.ghostEntities.filter((g) => g.root.parent);

    this.updateTerrainFade(playerPos, camPos);
  }

  // ---- Model previews (Models settings panel) ----
  private previewGL: THREE.WebGLRenderer | null = null;
  private previewScene: THREE.Scene | null = null;
  private previewCam: THREE.PerspectiveCamera | null = null;

  /**
   * Render a small turntable snapshot of any baked model and return it as
   * a data URL. Categories: tree | prop | boulder | bb (dragons + NPCs).
   */
  previewModel(kind: "tree" | "prop" | "boulder" | "bb", id: string, opts?: { size?: number; yawDeg?: number }): string | null {
    const px = opts?.size ?? 96;
    if (!this.previewGL) {
      this.previewGL = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
    }
    this.previewGL.setSize(px, px);
    if (!this.previewScene) {
      this.previewScene = new THREE.Scene();
      this.previewCam = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
      const sun = new THREE.DirectionalLight(0xffffff, 1.9);
      sun.position.set(3, 6, 4);
      this.previewScene.add(sun, new THREE.AmbientLight(0xffffff, 1.15));
    }
    const scene = this.previewScene as THREE.Scene;
    const cam = this.previewCam as THREE.PerspectiveCamera;
    let obj: THREE.Object3D | null = null;
    if (kind === "tree") {
      const model = [...Object.values(TREES_BY_SPECIES)].flat().find((m) => m.id === id);
      if (model) {
        const species = model.species;
        const TRUNK_TILES: Record<string, string> = {
          oak: "resource.tree.log.side", birch: "resource.tree.birch.side",
          spruce: "resource.tree.spruce.side", jungle: "resource.tree.jungle.side",
          acacia: "resource.tree.acacia.side", darkoak: "resource.tree.darkoak.side",
        };
        const LEAF_TILES: Record<string, string> = {
          oak: "resource.tree.leaves", birch: "resource.tree.birch.leaves",
          spruce: "resource.tree.spruce.leaves", jungle: "resource.tree.jungle.leaves",
          acacia: "resource.tree.acacia.leaves", darkoak: "resource.tree.darkoak.leaves",
        };
        const geo = treeGeometry(model);
        const g = new THREE.Group();
        g.add(new THREE.Mesh(geo.log, this.lambert(TRUNK_TILES[species] ?? "resource.tree.log.side")));
        g.add(new THREE.Mesh(geo.leaf, this.lambert(LEAF_TILES[species] ?? "resource.tree.leaves")));
        obj = g;
      }
    } else if (kind === "boulder") {
      const model = ROCK_MODELS_ALL.find((m) => m.id === id);
      if (model) {
        const g = new THREE.Group();
        for (const geo of rockGeometry(model)) {
          const m = geo.userData.material as number;
          const mat = this.lambert(ROCK_MATERIAL_TILES[m]);
          const tint = ROCK_MATERIAL_TINTS[m];
          if (tint) mat.color.set(tint);
          g.add(new THREE.Mesh(geo, mat));
        }
        obj = g;
      }
    } else {
      const built = buildBBModel(id);
      if (built) obj = built.group;
    }
    if (!obj) return null;
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) {
      scene.remove(obj);
      return null;
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    // Default: front three-quarter (models face -z, like every rig here).
    const yaw = ((opts?.yawDeg ?? 205) * Math.PI) / 180;
    cam.position.set(
      center.x + Math.sin(yaw) * size * 1.05,
      center.y + size * 0.4,
      center.z + Math.cos(yaw) * size * 1.05,
    );
    cam.lookAt(center);
    this.previewGL!.render(scene, cam);
    const url = this.previewGL!.domElement.toDataURL("image/png");
    scene.remove(obj);
    return url;
  }

  /** Draw the player through occluders (depth test off, late render). */
  private setPlayerXray(on: boolean): void {
    if (this.playerXray === on) return;
    this.playerXray = on;
    this.playerView.group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.Material) {
        // The blob shadow keeps normal depth so it never floats over roofs.
        if ((o.material as THREE.MeshBasicMaterial).map === blobTexture) return;
        // Transparent flag pushes the player into the late blend pass so
        // faded walls can't paint over them; depthTest off sees through.
        o.material.transparent = on;
        o.material.depthTest = !on;
        o.material.depthWrite = !on;
        o.material.needsUpdate = true;
        o.renderOrder = on ? 990 : 0;
      }
    });
  }

  /** March from the player toward the camera; any true wall column the ray
   *  passes through goes translucent (its quads' vertex alpha drops).
   *  Ordinary raised ground (climbable one-step terraces, plateau tops) is
   *  never faded — only walls at least two blocks above the player's feet,
   *  so the ground never seems to disappear. */
  private updateTerrainFade(playerPos: THREE.Vector3, camPos: THREE.Vector3): void {
    const region = this.sim.world.region;
    const feetY = this.playerWorldPos().y;
    const wallMin = feetY + 1.99; // walls only: 2+ blocks over the feet
    const dir = camPos.clone().sub(playerPos);
    // Only nearby walls fade: distant ramparts along the sightline stay solid.
    const len = Math.min(dir.length(), 14);
    dir.normalize();
    const faded = new Set<string>();
    for (let t = 0.7; t < len; t += 0.35) {
      const px = playerPos.x + dir.x * t;
      const py = playerPos.y + dir.y * t;
      const pz = playerPos.z + dir.z * t;
      if (py > this.terrainMaxHeight + 1) break; // above everything
      const cx = Math.floor(px);
      const cz = Math.floor(pz);
      if (cx < 0 || cz < 0 || cx >= region.width || cz >= region.depth) break;
      const h = this.sim.world.heightAt({ x: cx, z: cz });
      if (h > py && h >= wallMin) {
        // Fade a 3x3 patch of wall so the reveal reads as a window, not a
        // slit — but only cells that are themselves wall-height.
        for (let ox = -1; ox <= 1; ox++) {
          for (let oz = -1; oz <= 1; oz++) {
            const nx = cx + ox;
            const nz = cz + oz;
            if (nx < 0 || nz < 0 || nx >= region.width || nz >= region.depth) continue;
            if (this.sim.world.heightAt({ x: nx, z: nz }) >= wallMin) faded.add(`${nx},${nz}`);
          }
        }
      }
    }

    // Cheap set-equality: skip the attribute write when nothing changed.
    if (faded.size === this.terrainFaded.size && [...faded].every((k) => this.terrainFaded.has(k))) {
      return;
    }
    const setAlpha = (key: string, alpha: number) => {
      const [cellX, cellZ] = key.split(",").map(Number);
      const chunk = this.terrainChunks.get(this.chunkKeyFor(cellX, cellZ));
      if (!chunk) return;
      const colorAttr = chunk.mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
      for (const base of chunk.quadRanges.get(key) ?? []) {
        for (let i = 0; i < 4; i++) colorAttr.setW(base + i, alpha);
      }
      colorAttr.needsUpdate = true;
    };
    for (const key of this.terrainFaded) if (!faded.has(key)) setAlpha(key, 1);
    for (const key of faded) if (!this.terrainFaded.has(key)) setAlpha(key, 0.3);
    this.terrainFaded = faded;
  }

  // ---------- picking ----------

  pick(clientX: number, clientY: number): PickResult {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.rig.camera);

    const entityHits = ray.intersectObjects(this.pickables, true).filter((h) => h.object.visible);
    if (entityHits.length > 0) {
      const id = entityHits[0].object.userData.instanceId as string | undefined;
      if (id) return { kind: "entity", instanceId: id };
    }

    const groundHits = ray.intersectObjects(
      [...this.terrainChunks.values()].map((c) => c.mesh),
      false,
    );
    const groundDist = groundHits.length > 0 ? groundHits[0].distance : Infinity;

    // Roof/wall of a building: resolve the click to the floor cell beneath the
    // hit point and peek the roof away, but only when the building is actually
    // in front of the ground (a hill between us and the house wins).
    const structVisuals = [...this.structureVisuals.values()];
    if (structVisuals.length > 0) {
      const structHits = ray
        .intersectObjects(structVisuals.map((s) => s.group), true)
        .filter((h) => h.object.visible);
      if (structHits.length > 0 && structHits[0].distance < groundDist) {
        let node: THREE.Object3D | null = structHits[0].object;
        let visual = structVisuals.find((s) => s.group === node);
        while (node && !visual) {
          node = node.parent;
          visual = structVisuals.find((s) => s.group === node);
        }
        if (visual) {
          // A house: clicking anywhere on it walks you to the yard and enters
          // its interior (the sim's "enter" flow). No door object needed.
          if (!visual.structureId.startsWith("lobby.")) {
            return { kind: "entity", instanceId: visual.instanceId };
          }
          // A lobby-hub tile is walkable ground — resolve the click to the floor
          // cell under the ray so you simply walk there.
          const b = visual.bounds;
          const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -visual.interiorY);
          const hit = new THREE.Vector3();
          const onFloor = ray.ray.intersectPlane(floorPlane, hit);
          const raw = onFloor
            ? { x: Math.floor(hit.x), z: Math.floor(hit.z) }
            : { x: Math.min(b.x1, Math.max(b.x0, Math.floor(structHits[0].point.x))), z: Math.min(b.z1, Math.max(b.z0, Math.floor(structHits[0].point.z))) };
          return { kind: "ground", cell: this.sim.world.nearestWalkable(raw, 12) ?? raw };
        }
      }
    }

    if (groundHits.length > 0) {
      const p = groundHits[0].point;
      const cell = { x: Math.floor(p.x + ray.ray.direction.x * 0.001), z: Math.floor(p.z + ray.ray.direction.z * 0.001) };
      // Fat-finger assist: prefer a nearby interactable over bare ground.
      const assist = this.nearestEntityOnScreen(clientX, clientY, 26);
      if (assist) return { kind: "entity", instanceId: assist };
      // A click that lands inside a building's footprint enters it: a solid
      // landmark routes to its door-portal; a walk-in build routes to the
      // middle of its interior floor. Either way, "click the house → go in".
      for (const visual of structVisuals) {
        const b = visual.bounds;
        if (cell.x >= b.x0 && cell.x <= b.x1 && cell.z >= b.z0 && cell.z <= b.z1) {
          // A house footprint: click enters it. Lobby tiles just walk there.
          if (!visual.structureId.startsWith("lobby.")) {
            return { kind: "entity", instanceId: visual.instanceId };
          }
          break;
        }
      }
      // Snap onto a walkable cell (a click at the foot of a wall still moves).
      return { kind: "ground", cell: this.sim.world.nearestWalkable(cell, 4) ?? cell };
    }
    return null;
  }

  private nearestEntityOnScreen(clientX: number, clientY: number, radiusPx: number): string | null {
    let bestId: string | null = null;
    let bestDist = radiusPx;
    const consider = (id: string, world: THREE.Vector3) => {
      const s = this.worldToScreen(world);
      const d = Math.hypot(s.x - clientX, s.y - clientY);
      if (d < bestDist) {
        bestDist = d;
        bestId = id;
      }
    };
    for (const view of this.nodeViews.values()) {
      const anchor = new THREE.Vector3(view.cell.x + 0.5, view.baseY + 1, view.cell.z + 0.5);
      consider(view.instanceId, anchor);
    }
    for (const obj of this.sim.world.region.objects) {
      if (OBJECTS[obj.defId].scenery) continue; // furniture isn't a target
      const h = this.sim.world.heightAt(obj.cell);
      consider(obj.instanceId, new THREE.Vector3(obj.cell.x + 0.5, h + 0.4, obj.cell.z + 0.5));
    }
    for (const [id, view] of this.npcViews) {
      consider(id, view.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
    }
    for (const [id, view] of this.enemyViews) {
      if (view.group.visible) consider(id, view.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
    }
    return bestId;
  }

  worldToScreen(world: THREE.Vector3): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = world.clone().project(this.rig.camera);
    return {
      x: rect.left + ((p.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - p.y) / 2) * rect.height,
    };
  }

  resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.rig.setAspect(w / h);
  }
}
