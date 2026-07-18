// Presentation layer: three.js scene built from sim state, updated by SimEvents.
// Nothing here is authoritative — it can be rebuilt from the simulation at any time.

import * as THREE from "three";
import { blockBase, blockShape, blockTint, isTranslucent, sideTile, surfaceOffset, topTile } from "../content/blocks";
import { ENEMIES, ITEMS, NODES, OBJECTS, type EnemyViewKind, type NodeViewKind } from "../content/content";
import { getStructure } from "../content/structures";
import type { StructureAsset, StructureBlock } from "../structures/types";
import { effectiveSink, groundFloorTop } from "../structures/types";
import type { GameSimulation } from "../sim/simulation";
import type { SimEvent, Cell, ActionAnim } from "../sim/types";
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
import { paintedMats } from "./painted-skins";
import { isModelEnabled } from "./model-prefs";
import { ARACHNID_LEGS, arachnidStyleFor } from "./arachnid-model";
import { undeadStyleFor } from "./undead-model";
import { constructStyleFor } from "./construct-model";
import { oozeStyleFor } from "./ooze-model";
import { canidStyleFor } from "./canid-model";
import { ungulateStyleFor } from "./ungulate-model";
import { raiderStyleFor, type RaiderRole } from "./raider-model";
import { flierStyleFor, type FlierFeature, type FlierMotion } from "./flier-model";
import { signatureStyleFor, type SignatureFeature, type SignatureMotion } from "./signature-model";
import { bossStyleFor, type BossFeature } from "./boss-model";
import { itemIconUrl } from "../ui/icons";

// Lower ambient relative to sun so faces facing away from the sun read as
// shaded — that gap is what gives blocks their sense of depth. The colours
// below (warm sun, cool sky-fill) are applied to the lights themselves.
const DEFAULT_THEME = { sky: "#8fc4e8", sun: 1.65, ambient: 0.72 };
const SUN_COLOR = 0xfff1d4; // warm midday sunlight
const SKY_FILL_COLOR = 0x9fb8d8; // cool ambient bounce from the sky

interface ArachnidJoint {
  obj: THREE.Group;
  restX: number;
  restY: number;
  restZ: number;
}

interface ArachnidLegAnim {
  side: -1 | 1;
  slot: number;
  phase: number;
  hip: ArachnidJoint;
  knee: ArachnidJoint;
  ankle: ArachnidJoint;
}

interface ArachnidAnim {
  legs: ArachnidLegAnim[];
  abdomen: THREE.Group;
  mandibles: Array<{ obj: THREE.Group; side: -1 | 1; restY: number }>;
  pedipalps: Array<{ obj: THREE.Group; side: -1 | 1; restX: number; restY: number }>;
}

interface UndeadLimbAnim {
  side: -1 | 1;
  phase: number;
  upper: THREE.Group;
  lower: THREE.Group;
  restUpperX: number;
  restUpperZ: number;
  restLowerX: number;
}

interface UndeadAnim {
  legs: UndeadLimbAnim[];
  arms: UndeadLimbAnim[];
  torso: THREE.Group;
  head: THREE.Group;
  headRestX: number;
  headRestZ: number;
  hangers: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

interface ConstructLimbAnim {
  side: -1 | 1;
  phase: number;
  upper: THREE.Group;
  lower: THREE.Group;
  restUpperX: number;
  restUpperZ: number;
  restLowerX: number;
}

interface ConstructAnim {
  legs: ConstructLimbAnim[];
  arms: ConstructLimbAnim[];
  torso: THREE.Group;
  head: THREE.Group;
  core: THREE.Object3D;
  headRestX: number;
  headRestZ: number;
  panels: Array<{ obj: THREE.Group; restY: number; sign: number }>;
  gears: Array<{ obj: THREE.Object3D; speed: number }>;
  details: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

interface OozeSegmentAnim {
  obj: THREE.Group;
  baseY: number;
  phase: number;
  squash: number;
}

interface OozeAnim {
  segments: OozeSegmentAnim[];
  core: THREE.Group;
  mouth: THREE.Object3D;
  eyes: THREE.Object3D[];
  details: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

interface CanidLegAnim {
  side: -1 | 1;
  front: boolean;
  phase: number;
  upper: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
  restUpperX: number;
  restUpperZ: number;
  restKneeX: number;
  restAnkleX: number;
}

interface CanidAnim {
  legs: CanidLegAnim[];
  trunk: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  headRestX: number;
  headRestZ: number;
  tail: Array<{ obj: THREE.Group; restX: number; restY: number; restZ: number; phase: number }>;
  details: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

interface UngulateLegAnim {
  side: -1 | 1;
  front: boolean;
  phase: number;
  upper: THREE.Group;
  knee: THREE.Group;
  ankle: THREE.Group;
  restUpperX: number;
  restUpperZ: number;
  restKneeX: number;
  restAnkleX: number;
}

interface UngulateAnim {
  legs: UngulateLegAnim[];
  trunk: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  headRestX: number;
  headRestY: number;
  headRestZ: number;
  neckRestX: number;
  tail: Array<{ obj: THREE.Group; restX: number; restY: number; restZ: number; phase: number }>;
  details: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

interface RaiderLegAnim {
  side: -1 | 1;
  phase: number;
  hip: THREE.Group;
  knee: THREE.Group;
  foot: THREE.Group;
  restHipX: number;
  restHipZ: number;
  restKneeX: number;
  restFootX: number;
}

interface RaiderArmAnim {
  side: -1 | 1;
  phase: number;
  shoulder: THREE.Group;
  elbow: THREE.Group;
  hand: THREE.Group;
  restShoulderX: number;
  restShoulderZ: number;
  restElbowX: number;
  restElbowZ: number;
}

interface RaiderPropAnim {
  obj: THREE.Group;
  kind: "weapon" | "focus" | "cloth";
  phase: number;
  restX: number;
  restY: number;
  restZ: number;
}

interface RaiderAnim {
  role: RaiderRole;
  legs: RaiderLegAnim[];
  arms: RaiderArmAnim[];
  torso: THREE.Group;
  head: THREE.Group;
  headRestX: number;
  headRestZ: number;
  props: RaiderPropAnim[];
  focus: THREE.Object3D | null;
  dummyPivot: THREE.Group | null;
  details: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

interface FlierWingAnim {
  side: -1 | 1;
  pair: number;
  phase: number;
  root: THREE.Group;
  mid: THREE.Group;
  tip: THREE.Group;
  restRootX: number;
  restRootY: number;
  restRootZ: number;
  restMidX: number;
  restMidY: number;
  restMidZ: number;
  restTipX: number;
  restTipY: number;
  restTipZ: number;
}

interface FlierAppendageAnim {
  index: number;
  root: THREE.Group;
  mid: THREE.Group;
  tip: THREE.Group;
  restRootX: number;
  restRootZ: number;
  restMidX: number;
  restMidZ: number;
  restTipX: number;
  restTipZ: number;
}

interface FlierFinAnim {
  side: -1 | 1;
  root: THREE.Group;
  restX: number;
  restY: number;
  restZ: number;
}

interface FlierAnim {
  feature: FlierFeature;
  motion: FlierMotion;
  core: THREE.Group;
  coreRestY: number;
  head: THREE.Group;
  mouth: THREE.Group | null;
  headRestX: number;
  headRestZ: number;
  wings: FlierWingAnim[];
  appendages: FlierAppendageAnim[];
  fins: FlierFinAnim[];
  details: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

interface SignatureLegAnim {
  side: -1 | 1;
  front: boolean;
  phase: number;
  hip: THREE.Group;
  knee: THREE.Group;
  foot: THREE.Group;
  restHipX: number;
  restHipZ: number;
  restKneeX: number;
  restFootX: number;
}

interface SignatureWingAnim {
  side: -1 | 1;
  root: THREE.Group;
  tip: THREE.Group;
  restRootX: number;
  restRootZ: number;
  restTipX: number;
  restTipZ: number;
}

interface SignatureTailAnim {
  obj: THREE.Group;
  restX: number;
  restY: number;
  restZ: number;
  phase: number;
}

interface SignatureAnim {
  feature: SignatureFeature;
  motion: SignatureMotion;
  core: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group | null;
  headRestX: number;
  headRestY: number;
  headRestZ: number;
  legs: SignatureLegAnim[];
  wings: SignatureWingAnim[];
  tail: SignatureTailAnim[];
  details: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

interface BossAnim {
  feature: BossFeature;
  core: THREE.Group;
  heads: Array<{ root: THREE.Group; jaw: THREE.Group; restX: number; restY: number; phase: number }>;
  legs: Array<{ root: THREE.Group; knee: THREE.Group; side: -1 | 1; phase: number; restX: number; restZ: number }>;
  wings: Array<{ root: THREE.Group; tip: THREE.Group; side: -1 | 1; pair: number; restZ: number }>;
  tail: Array<{ obj: THREE.Group; restY: number; phase: number }>;
  details: Array<{ obj: THREE.Group; restX: number; restZ: number; phase: number }>;
}

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
  /** Native voxel arachnids use three joints per leg plus attack face parts. */
  arachnid?: ArachnidAnim;
  /** Native layered undead use elbow/knee chains and loose cloth details. */
  undead?: UndeadAnim;
  /** RuneCraft constructs expose joints, core shutters and machinery. */
  construct?: ConstructAnim;
  /** Layered RuneCraft oozes squash independently around an internal core. */
  ooze?: OozeAnim;
  /** RuneCraft combat canids use articulated quadruped joints and jaws. */
  canid?: CanidAnim;
  /** Original livestock and regional ungulates share articulated hoof rigs. */
  ungulate?: UngulateAnim;
  /** RuneCraft raiders, casters and training effigies use native humanoid rigs. */
  raider?: RaiderAnim;
  /** Native airborne and aquatic creatures expose segmented flight/swim parts. */
  flier?: FlierAnim;
  /** Remaining signature fauna use exact-ID articulated native silhouettes. */
  signature?: SignatureAnim;
  /** Original RuneCraft dragons and Deep Warden use boss-scale articulated rigs. */
  boss?: BossAnim;
  /** Rabbits and frogs travel in hop arcs: the body lifts on the walk phase
   *  instead of legs striding. */
  hopper?: boolean;
  /** Ghost-lights: the whole rig floats and bobs above the ground, no legs. */
  floater?: boolean;
}

const WATER_SURFACE_Y = -0.35;

// World streaming: terrain builds in CHUNK-sized tiles around the player and
// entity visuals build inside ENTITY_RADIUS; both retire as the player moves
// on. The simulation always holds the whole region — streaming is purely a
// presentation window onto it.
const CHUNK = 50;
// Radius 2 keeps a 5x5 ring of 50-cell chunks resident (250x250 cells) — the
// camera at max zoom-out sees ~110 cells from center, so the resident ring
// ends just past the screen edge and loading chunks are never on screen.
// Entity visuals follow inside a slightly tighter circle.
const TERRAIN_CHUNK_RADIUS = 2;
// Entities render out to roughly the terrain edge (3 chunks ≈ 150 cells).
// Beyond that they're too small to matter and just cost draw calls.
const ENTITY_RADIUS = 110;
/** Small ground cover (grass/flower sprites) renders only this close — a full
 *  ENTITY_RADIUS of tufts is thousands of needless draw calls. */
const DETAIL_RADIUS = 60;
const DETAIL_DEFS = new Set(["object.grass.tuft", "object.flowers.wild"]);
/** New entity visuals built per frame, so first load streams in smoothly. */
const STREAM_ADD_BUDGET = 24;

/** Ripple color + surface marker per fishing water, so each tier of spot
 *  reads at a glance (crab pool ≠ marlin run ≠ storm rise). */
const FISHING_SPOT_STYLES: Record<string, { ring: string; marker?: "shells" | "crab" | "buoy" | "fin" | "glow" | "storm" }> = {
  "resource.fishing.pond": { ring: "#dbeeff" },
  "resource.fishing.river": { ring: "#bfe3ff" },
  "resource.fishing.marsh": { ring: "#a8bd8a" },
  "resource.fishing.ice": { ring: "#eaffff" },
  "resource.fishing.sea": { ring: "#8fd8d2" },
  "resource.fishing.deep": { ring: "#7fa8ff" },
  "resource.fishing.shrimp": { ring: "#ffc9c9", marker: "shells" },
  "resource.fishing.crab": { ring: "#ffb075", marker: "crab" },
  "resource.fishing.lobster": { ring: "#ff8563", marker: "buoy" },
  "resource.fishing.marlin": { ring: "#c8dcf2", marker: "fin" },
  "resource.fishing.abyss": { ring: "#b48cff", marker: "glow" },
  "resource.fishing.storm": { ring: "#ffe066", marker: "storm" },
};

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
  /** Farm plots: the soil slab under the crop (dirt until plowed, furrows after). */
  soilPad?: THREE.Mesh;
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
  "tool.sword.diamond": "sprite.item.sword",
  "tool.sword.netherite": "sprite.item.sword",
  "tool.sword.magma": "sprite.item.sword",
  "tool.axe.diamond": "sprite.item.axe",
  "tool.axe.netherite": "sprite.item.axe",
  "tool.pickaxe.diamond": "sprite.item.pickaxe",
  "tool.pickaxe.netherite": "sprite.item.pickaxe",
  "tool.hoe.basic": "sprite.item.hoe",
};

let blobTexture: THREE.CanvasTexture | null = null;

/** Soft radial-gradient disc used to ground characters and objects. */

/**
 * Which pack entity texture skins each enemy. Variants sharing one texture
 * keep their def tint as a color multiply; original creatures (constructs,
 * the archery dummy) have no vanilla-layout equivalent and stay painted.
 */
// Each enemy resolves its skin by `key` first; when a variant's dedicated
// texture hasn't been delivered yet, `fallback` names the base-mob skin it
// borrows, recoloured by the enemy tint (`tinted`). Once real art lands for a
// variant key (see ASSETS_NEEDED.md §2b for the exact file names), it wins
// automatically and the tint recolor stops applying — no code change needed.
// Per-biome ground-colour multipliers for grass-family top faces (index =
// CellSample.biome). Undefined / identity entries keep the raw tile art.
const BIOME_GROUND_TINTS: Record<number, readonly [number, number, number]> = {
  1: [0.92, 1.0, 0.88],   // forest: richer green
  2: [0.82, 0.95, 0.92],  // taiga: cool blue-green
  4: [0.76, 0.85, 0.6],   // swamp: murky olive
  6: [1.18, 1.06, 0.6],   // savanna: sun-bleached gold
  7: [0.7, 1.04, 0.6],    // jungle: deep saturated green
  8: [1.0, 1.05, 0.8],    // birch grove: light yellow-green
  9: [0.7, 0.8, 0.68],    // dark forest: gloomy
  10: [0.95, 1.08, 0.76], // flower meadow: vivid
  12: [1.04, 0.94, 0.74], // moorland: dry heath
  13: [0.8, 1.0, 0.85],   // elder grove: silvered green
  14: [1.15, 0.92, 0.68], // badlands: scorched
  15: [0.84, 0.9, 0.66],  // fen: sedge
  16: [0.8, 0.82, 0.76],  // gravemoor: ashen
  17: [0.78, 0.68, 0.9],  // blightwood: sickly violet
  18: [0.85, 0.72, 0.66], // volcanic wastes: scorched red-grey
  20: [0.85, 1.0, 0.9],   // alpine pines: crisp
  21: [1.06, 0.98, 0.9],  // cherry orchard: warm blush
  22: [0.84, 0.94, 0.74], // redwood: shaded loam
  23: [1.1, 1.1, 0.66],   // sunflower prairie: golden green
  24: [1.22, 0.96, 0.58], // autumn woods: turning leaves
  25: [0.74, 0.85, 0.95], // glowshroom hollow: cold spectral
  26: [0.8, 1.1, 0.62],   // bamboo: bright stalk green
  27: [0.78, 0.94, 0.7],  // mangrove: brackish green
  28: [0.88, 0.95, 1.05], // ice spikes: frost sheen
  29: [1.1, 1.08, 1.0],   // salt flats: bleached
  30: [1.12, 0.94, 0.7],  // mesa highlands: red-gold
  31: [0.95, 1.1, 0.74],  // flower meadow: vivid
  32: [1.02, 0.9, 0.98],  // highland heath: heather purple
  33: [0.84, 0.8, 0.76],  // ashland: cinder grey
  34: [0.9, 0.95, 1.06],  // crystal barrens: pale shimmer
  35: [1.1, 0.95, 0.6],   // amber marsh: peaty gold
};

const ENEMY_SKINS: Record<string, { key: string; fallback?: string; wool?: string; tinted?: boolean }> = {
  "enemy.cow": { key: "entity.cow" },
  "enemy.pig": { key: "entity.pig" },
  "enemy.chicken": { key: "entity.chicken" },
  "enemy.sheep": { key: "entity.sheep.skin", wool: "entity.sheep.wool" },
  "enemy.spider": { key: "entity.spider" },
  "enemy.cave_spider": { key: "entity.cave_spider", fallback: "entity.spider", tinted: true },
  "enemy.old_gnasher": { key: "entity.old_gnasher", fallback: "entity.gnasher" },
  "enemy.creeper": { key: "entity.creeper" },
  "enemy.skeleton": { key: "entity.skeleton" },
  "enemy.stray": { key: "entity.stray", fallback: "entity.skeleton", tinted: true },
  "enemy.barrow_lord": { key: "entity.barrow_lord", fallback: "entity.skeleton", tinted: true },
  "enemy.squid": { key: "entity.squid" },
  "enemy.ghast": { key: "entity.ghast" },
  "enemy.prairie_bull": { key: "entity.prairie_bull", fallback: "entity.cow", tinted: true },
  "enemy.target_dummy": { key: "entity.dummy" },
  "enemy.canyon_construct": { key: "entity.canyon_construct", fallback: "entity.construct", tinted: true },
  "enemy.rust_construct": { key: "entity.rust_construct", fallback: "entity.construct", tinted: true },
  "enemy.rootbound_warden": { key: "entity.rootbound_warden", fallback: "entity.construct", tinted: true },
  "enemy.liftworks_overseer": { key: "entity.liftworks_overseer", fallback: "entity.construct", tinted: true },
  "enemy.moss_golem": { key: "entity.moss_golem", fallback: "entity.construct", tinted: true },
  "enemy.stone_sentinel": { key: "entity.stone_sentinel", fallback: "entity.construct" },
  "enemy.timber_wolf": { key: "entity.wolf" },
  "enemy.frost_wolf": { key: "entity.frost_wolf", fallback: "entity.wolf", tinted: true },
  "enemy.dire_wolf": { key: "entity.dire_wolf", fallback: "entity.wolf", tinted: true },
  "enemy.ash_hound": { key: "entity.ash_hound", fallback: "entity.wolf", tinted: true },
  "enemy.bog_slime": { key: "entity.bog_slime", fallback: "entity.slime" },
  "enemy.silt_king": { key: "entity.silt_king", fallback: "entity.slime", tinted: true },
  "enemy.blight_slime": { key: "entity.blight_slime", fallback: "entity.slime", tinted: true },
  "enemy.bramble_slime": { key: "entity.bramble_slime", fallback: "entity.slime", tinted: true },
  "enemy.marsh_lurker": { key: "entity.marsh_lurker", fallback: "entity.slime", tinted: true },
  "enemy.mire_husk": { key: "entity.mire_husk", fallback: "entity.zombie" },
  "enemy.dune_husk": { key: "entity.dune_husk", fallback: "entity.husk" },
  "enemy.glacial_wight": { key: "entity.glacial_wight", fallback: "entity.husk", tinted: true },
  "enemy.grave_shambler": { key: "entity.grave_shambler", fallback: "entity.zombie", tinted: true },
  "enemy.hollow_wight": { key: "entity.hollow_wight", fallback: "entity.zombie", tinted: true },
  "enemy.spore_shambler": { key: "entity.spore_shambler", fallback: "entity.zombie", tinted: true },
  "enemy.gloom_spinner": { key: "entity.gloom_spinner", fallback: "entity.cave_spider", tinted: true },
  "enemy.dust_scuttler": { key: "entity.dust_scuttler", fallback: "entity.spider", tinted: true },
  "enemy.vine_stalker": { key: "entity.vine_stalker", fallback: "entity.spider", tinted: true },
  "enemy.thornback": { key: "entity.thornback", fallback: "entity.spider", tinted: true },
  "enemy.ember_crawler": { key: "entity.ember_crawler", fallback: "entity.spider", tinted: true },
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

type EntityFaceRects = Record<"right" | "left" | "top" | "bottom" | "back" | "front", [number, number, number, number]>;

/** Map a project-specific per-face atlas whose coordinates use its base size. */
function setEntityFaceUVs(
  geo: THREE.BoxGeometry,
  atlasWidth: number,
  atlasHeight: number,
  rects: EntityFaceRects,
): void {
  const order: Array<keyof EntityFaceRects> = ["right", "left", "top", "bottom", "back", "front"];
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  order.forEach((name, face) => {
    const [x, y, fw, fh] = rects[name];
    const u0 = x / atlasWidth;
    const u1 = (x + fw) / atlasWidth;
    const v1 = 1 - y / atlasHeight;
    const v0 = 1 - (y + fh) / atlasHeight;
    const rotate = name === "top";
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
  /** region.objects length at the last fence-cell sweep (streamed chunks add
   *  fences after bind; the set refreshes whenever the object count moves). */
  private fenceCellCount = -1;

  /** Every fence and gate cell — rails reach toward these, and gates read
   *  them to orient themselves along the fence line they sit in. Kept fresh
   *  against the live region so streamed-in pens connect up correctly. */
  private syncFenceCells(): void {
    const objects = this.sim.world.region.objects;
    if (objects.length === this.fenceCellCount) return;
    this.fenceCellCount = objects.length;
    this.fenceCells = new Set(
      objects
        .filter((o) => o.defId === "object.fence.wood" || o.defId === "object.gate.oak")
        .map((o) => `${o.cell.x},${o.cell.z}`),
    );
  }
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
  /** The raised minion's rig (a necrotic-tinted undead beside the player). */
  private familiarView: { itemId: string; group: THREE.Group } | null = null;
  /** The ridden mount's rig (drawn under the player while riding). */
  private mountView: { itemId: string; group: THREE.Group } | null = null;
  /** A short player gesture played for slot rites (bury bones, light a fire). */
  private oneShotAnim: { kind: ActionAnim; remainS: number } | null = null;
  /** Fires struck on the spot by Firemaking — burn out after a minute. */
  private tempFires: Array<{ group: THREE.Group; flame: THREE.Group; remainS: number }> = [];
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
    // The dot trail re-paths only when the player or goal cell changes (never
    // per-frame) and runs on a tight A* budget — guidance must never be able
    // to freeze the game chasing an objective across half the world. A FAR
    // target still gets dots: they path toward a waypoint ~120 cells along
    // the way, so the trail always shows the direction to set out in.
    const targetDist = Math.max(Math.abs(goal.x - player.x), Math.abs(goal.z - player.z));
    const guideKey = `${player.x},${player.z}>${goal.x},${goal.z}`;
    let path: Cell[] | null;
    if (guideKey === this.guidePathKey) {
      path = this.guidePath;
    } else {
      let aim = goal;
      if (targetDist > 150) {
        const dx = goal.x - player.x, dz = goal.z - player.z;
        const len = Math.hypot(dx, dz) || 1;
        aim = { x: Math.round(player.x + (dx / len) * 120), z: Math.round(player.z + (dz / len) * 120) };
      }
      const approach = this.walkableNear(aim) ?? this.sim.world.nearestWalkable?.(aim, 8) ?? null;
      path = approach ? findPath(this.guideWorld!, player, approach, 12_000) : null;
      this.guidePathKey = guideKey;
      this.guidePath = path;
    }
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

  private guidePathKey = "";
  private guidePath: Cell[] | null = null;

  /** The cell itself if walkable, else a walkable neighbour, else null. */
  private walkableNear(cell: { x: number; z: number }): { x: number; z: number } | null {
    if (this.sim.world.walkable(cell)) return cell;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      const c = { x: cell.x + dx, z: cell.z + dz };
      if (this.sim.world.walkable(c)) return c;
    }
    return null;
  }

  /** Species rig behind each set of spirit-mount reins. */
  private static readonly MOUNT_SPECIES: Record<string, string> = {
    "item.pouch.wolf": "enemy.timber_wolf",
    "item.pouch.ox": "enemy.prairie_bull",
    "item.pouch.tortoise": "enemy.armadillo",
    "item.pouch.lynx": "enemy.dire_wolf",
    "item.pouch.drake": "enemy.dragon.fire",
  };

  /** Build a companion rig from an enemy species, restyled by a glow color. */
  private buildCompanionRig(defId: string, glow: string, opacity: number): THREE.Group {
    const def = ENEMIES[defId];
    const group = new THREE.Group();
    this.buildEnemyBody(group, def.view, def.tint, defId);
    group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!(mesh as { isMesh?: boolean }).isMesh) return;
      const restyle = (m: THREE.Material): THREE.Material => {
        const c = m.clone();
        c.transparent = true;
        c.opacity = opacity;
        const lam = c as THREE.MeshLambertMaterial;
        if (lam.emissive) {
          lam.emissive = new THREE.Color(glow);
          lam.emissiveIntensity = 0.5;
        }
        return c;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(restyle) : restyle(mesh.material);
    });
    group.scale.setScalar(def.view === "dragon" ? 0.3 : Math.min(def.scale ?? 1, 1) * 0.8);
    return group;
  }

  /** Keep the raised minion at the player's side (necrotic green undead that
   *  follows and worries the player's target) and the ridden mount under the
   *  player's feet. Both fade out when their sim state clears. */
  private updateCompanions(dt: number): void {
    // --- minion (Necromancy) ---
    const minion = this.sim.minion;
    if (!minion) {
      if (this.familiarView) {
        this.scene.remove(this.familiarView.group);
        this.disposeGroupResources(this.familiarView.group, false);
        this.familiarView = null;
      }
    } else {
      if (!this.familiarView || this.familiarView.itemId !== minion.itemId) {
        if (this.familiarView) {
          this.scene.remove(this.familiarView.group);
          this.disposeGroupResources(this.familiarView.group, false);
        }
        const group = this.buildCompanionRig(minion.defId, "#3fd67c", 0.85);
        const p0 = this.sim.movement.pos;
        group.position.set(p0.x + 1.2, this.sim.world.surfaceY(this.sim.movement.currentCell()), p0.z + 1.2);
        this.scene.add(group);
        this.familiarView = { itemId: minion.itemId, group };
      }
      const p = this.sim.movement.pos;
      const target = { x: p.x + 0.5 - 1.1, z: p.z + 0.5 + 0.8 };
      const g = this.familiarView.group.position;
      const dx = target.x - g.x, dz = target.z - g.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.02) {
        const step = Math.min(1, dt * (dist > 3 ? 6 : 3));
        g.x += dx * step;
        g.z += dz * step;
        this.familiarView.group.rotation.y = Math.atan2(dx, dz);
      }
      const groundY = this.sim.world.surfaceY({ x: Math.floor(g.x), z: Math.floor(g.z) });
      g.y = groundY + 0.06 + Math.sin(this.elapsed * 3) * 0.05;
    }

    // --- mount (Summoning) ---
    const mountId = this.sim.activeMount() ? this.sim.activeMountItemId : null;
    const species = mountId ? GameRenderer.MOUNT_SPECIES[mountId] : undefined;
    if (!mountId || !species) {
      if (this.mountView) {
        this.scene.remove(this.mountView.group);
        this.disposeGroupResources(this.mountView.group, false);
        this.mountView = null;
      }
      return;
    }
    if (!this.mountView || this.mountView.itemId !== mountId) {
      if (this.mountView) {
        this.scene.remove(this.mountView.group);
        this.disposeGroupResources(this.mountView.group, false);
      }
      const group = this.buildCompanionRig(species, "#4f74ff", 0.9);
      this.scene.add(group);
      this.mountView = { itemId: mountId, group };
    }
    // The mount sits exactly under the player, facing the way they face.
    const p = this.sim.movement.pos;
    const facing = this.sim.movement.facing;
    this.mountView.group.position.set(
      p.x + 0.5,
      this.sim.world.surfaceY(this.sim.movement.currentCell()),
      p.z + 0.5,
    );
    this.mountView.group.rotation.y =
      facing === "north" ? Math.PI : facing === "east" ? -Math.PI / 2 : facing === "west" ? Math.PI / 2 : 0;
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
    // Free the GPU resources of everything the scene.clear() below is about
    // to orphan. Rebinds happen repeatedly in one session (world repairs,
    // texture packs, region switches) — without disposal every rebind leaked
    // the full terrain + entity geometry, which slowly starved WebGL on
    // low-memory devices until the page died.
    for (const view of this.enemyViews.values()) {
      this.disposeGroupResources(view.group, false);
      this.disposeGroupResources(view.barGroup, true);
    }
    for (const group of this.objectViews.values()) this.disposeGroupResources(group, false);
    for (const view of this.nodeViews.values()) this.disposeGroupResources(view.activeGroup, false);
    for (const view of this.groundItemViews.values()) this.disposeGroupResources(view.group, false);
    for (const chunk of this.terrainChunks.values()) {
      chunk.mesh.geometry.dispose();
      chunk.water?.geometry.dispose();
      chunk.trans?.geometry.dispose();
    }
    this.groundItemViews.clear();
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
    // Quest-guidance visuals live in the scene that was just cleared — drop
    // the handles too, or the beacon and dot trail keep pointing at orphaned
    // meshes and the trail never shows again after a rebind (the construction
    // repair's worldFlagSet rebind used to kill the trail for good).
    if (this.tutorialBeacon) (this.tutorialBeacon.material as THREE.Material).dispose();
    this.tutorialBeacon = null;
    for (const d of this.questDots) (d.material as THREE.Material).dispose();
    this.questDots = [];
    this.guidePathKey = "";
    this.guidePath = null;
    this.guideWorld = null;
    this.guideWorldFor = null;
    this.familiarView = null;
    this.mountView = null;
    this.oneShotAnim = null;
    this.tempFires = [];

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

    // Fence rails only reach toward neighboring fence (or gate) cells.
    this.fenceCellCount = -1;
    this.syncFenceCells();
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
    // Streamed chunks may have added fences/gates since the last pass; the
    // connection set must be complete before any of this batch builds.
    this.syncFenceCells();
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

    // Stream enemy visuals from the LIVE system, not the build-time placement
    // list — runtime spawns (hunt packs, world events, editor drops) must
    // appear the moment they exist, not stay simulated-but-invisible.
    for (const [id, enemy] of this.sim.enemies.enemies) {
      if (budget <= 0) break;
      if (this.enemyViews.has(id)) continue;
      const cell = enemy.movement.currentCell();
      if (near(cell, ENTITY_RADIUS)) {
        this.addEnemyVisual({ instanceId: id, defId: enemy.defId, cell });
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
      tint?: readonly [number, number, number],
    ) => {
      const base = positions.length / 3;
      const [u0, v0, u1, v1] = this.materials.atlasUv(materialId);
      const quadUv: Array<[number, number]> = [
        [u0, v0], [u1, v0], [u1, v1], [u0, v1],
      ];
      corners.forEach((c, i) => {
        positions.push(...c);
        uvs.push(...quadUv[i]);
        if (tint) colors.push(shade * tint[0], shade * tint[1], shade * tint[2], 1);
        else colors.push(shade, shade, shade, 1);
      });
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      if (cellX !== undefined && cellZ !== undefined) {
        const key = `${cellX},${cellZ}`;
        const list = quadRanges.get(key) ?? [];
        list.push(base);
        quadRanges.set(key, list);
      }
    };

    // Biome ground tint: grass-family top faces take the biome's colour so
    // savanna reads golden, jungle deep green, blight sickly violet — the
    // single strongest at-a-glance biome cue, exactly like Minecraft's
    // grass colormap. Only the endless world reports biomes (0 elsewhere,
    // and plains' tint is identity, so handcrafted regions are untouched).
    const groundTint = (block: string, x: number, z: number): readonly [number, number, number] | undefined => {
      if (block !== "grass" && block !== "drygrass" && block !== "moss" && block !== "podzol") return undefined;
      return BIOME_GROUND_TINTS[this.sim.world.biomeAt({ x, z })];
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
          groundTint(faceBlock, x, z),
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
          // A pier every few cells: a full 1×1 oak-plank column from the bed
          // to the deck — one Minecraft block thick, stacked cubes, matching
          // the wooden deck it carries.
          if (((x * 2 + z * 3) & 3) === 0) {
            pushBox(x, x + 1, z, z + 1, BED_Y, deckBot, "resource.tree.log.side", x, z);
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
    if (view.soilPad) {
      this.scene.remove(view.soilPad);
      view.soilPad.geometry.dispose();
    }
    this.pickables = this.pickables.filter((p) => p !== view.activeGroup && p !== view.depletedMesh && p !== view.soilPad);
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
      // No baked pixel icon yet: draw the item's emoji on a canvas sprite so
      // the drop still looks like the item, never an anonymous floating cube.
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "52px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ITEMS[item.itemId]?.icon ?? "❔", 32, 36);
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.66, 0.66, 0.66);
      visual = sprite;
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

      const built = this.buildNodeVisual(kind, variety, NODES[node.defId].viewMaterial, node.defId);
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
      // Farm plots get a soil slab under the crop that reads plow state:
      // plain dirt until hoed, furrowed farmland after.
      let soilPad: THREE.Mesh | undefined;
      if (NODES[node.defId]?.plantable) {
        soilPad = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 0.96), this.lambert("terrain.dirt"));
        soilPad.position.set(cx, baseY + 0.04, cz);
        soilPad.userData.instanceId = node.instanceId;
        this.scene.add(soilPad);
        this.pickables.push(soilPad);
      }
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
        soilPad,
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
    defId?: string,
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
          leavesMat.color.setHSL(0.045 + variety * 0.055, 0.95, 0.62 + variety * 0.07);
          leavesMat.emissive = new THREE.Color().setHSL(0.045 + variety * 0.05, 0.9, 0.3);
          leavesMat.emissiveIntensity = 0.25;
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
        // Each fishing water has its own ripple color + floating marker, so
        // a Crab Pool reads differently from a Storm Rise at a glance.
        const style = (defId && FISHING_SPOT_STYLES[defId]) || { ring: "#dbeeff" };
        const ringMat = new THREE.MeshBasicMaterial({
          color: style.ring,
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
        const solid = (color: string) => new THREE.MeshBasicMaterial({ color });
        switch (style.marker) {
          case "shells": {
            // Little pink backs bobbing on the ring: a shoal of shrimp.
            for (const [mx, mz] of [[0.24, 0.1], [-0.18, 0.2], [-0.05, -0.26]] as const) {
              const shell = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.06), solid("#ff9d9d"));
              shell.position.set(mx, 0.03, mz);
              activeGroup.add(shell);
            }
            break;
          }
          case "crab": {
            // An orange shell with two claw nubs poking above the surface.
            const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.16), solid("#e06a2b"));
            body.position.y = 0.04;
            for (const side of [-1, 1]) {
              const claw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), solid("#c9531d"));
              claw.position.set(0.13 * side, 0.05, 0.1);
              activeGroup.add(claw);
            }
            activeGroup.add(body);
            break;
          }
          case "buoy": {
            // A red-and-white lobster buoy bobbing over the pots below.
            const float = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), solid("#d43d2a"));
            float.position.y = 0.1;
            const band = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.045, 0.125), solid("#f5f0e6"));
            band.position.y = 0.1;
            const mast = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.03), solid("#6b4a2f"));
            mast.position.y = 0.24;
            activeGroup.add(float, band, mast);
            break;
          }
          case "fin": {
            // A grey dorsal fin slicing the surface — something big runs here.
            const fin = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), solid("#9fb4c4"));
            fin.position.set(0.08, 0.12, 0);
            fin.rotation.z = -0.35;
            activeGroup.add(fin);
            break;
          }
          case "glow": {
            // A sunken violet gleam: the abyss looking back up at you.
            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), solid("#b48cff"));
            orb.position.y = 0.02;
            const halo = new THREE.Mesh(new THREE.RingGeometry(0.14, 0.2, 16),
              new THREE.MeshBasicMaterial({ color: "#8f5bff", transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
            halo.rotation.x = -Math.PI / 2;
            halo.position.y = 0.01;
            activeGroup.add(orb, halo);
            break;
          }
          case "storm": {
            // Gold spray crowns the rise; the rarest waters crackle.
            const crest = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 5), solid("#ffe066"));
            crest.position.y = 0.14;
            const crest2 = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 5), solid("#fff3b0"));
            crest2.position.set(-0.16, 0.1, 0.12);
            activeGroup.add(crest, crest2);
            break;
          }
        }

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
        case "object.ladder.down": {
          // A ladder into the floor: dark pit mouth with a stone rim and the
          // top of a wooden ladder poking out — descent, not another doorway.
          const pit = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.05, 0.8),
            new THREE.MeshBasicMaterial({ color: "#07080c" }),
          );
          pit.position.y = 0.03;
          group.add(pit);
          const rim = this.lambert("terrain.stone");
          for (const [rx, rz, rw, rd] of [[0, -0.45, 1, 0.14], [0, 0.45, 1, 0.14], [-0.45, 0, 0.14, 0.76], [0.45, 0, 0.14, 0.76]] as const) {
            const edge = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.12, rd), rim);
            edge.position.set(rx, 0.06, rz);
            group.add(edge);
          }
          const wood = this.lambert("resource.tree.log.side");
          for (const s of [-0.22, 0.22]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.55, 0.07), wood);
            rail.position.set(s, 0.24, -0.1);
            group.add(rail);
          }
          for (let r = 0; r < 2; r++) {
            const rung = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), wood);
            rung.position.set(0, 0.16 + r * 0.22, -0.1);
            group.add(rung);
          }
          break;
        }
        case "object.chest.bank": {
          // The bank vault: the familiar chest silhouette (same baked model as
          // loot chests) wrapped in bright gold bands with a gold latch, so it
          // reads as "chest, but special" instead of a black strongbox slab.
          const goldMat = new THREE.MeshLambertMaterial({ color: "#e8bc3a" });
          const built = buildBBModel("mob.chest");
          if (built) group.add(built.group);
          else {
            const side = this.lambert("object.chest.side");
            const chest = new THREE.Mesh(new THREE.BoxGeometry(0.875, 0.875, 0.875), [
              side, side, this.lambert("object.chest.top"), side, side, this.lambert("object.chest.front"),
            ]);
            chest.position.y = 0.4375;
            group.add(chest);
          }
          for (const bx of [-0.24, 0.24]) {
            const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.92, 0.9), goldMat);
            band.position.set(bx, 0.44, 0);
            group.add(band);
          }
          const latch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.07), goldMat);
          latch.position.set(0, 0.55, -0.46);
          group.add(latch, makeBlobShadow(0.65));
          break;
        }
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
          // A collapsed structure to repair: a low wreck — tilted fallen
          // planks over a spill of stone-brick rubble, with a short marker
          // stake — instead of the old two-storey scaffold arch that towered
          // over everything and read as a weird gateway.
          const plankMat = this.lambert("terrain.plank");
          const brickMat = this.lambert("terrain.stonebrick");
          // Rubble spill: offset brick chunks at jumbled angles.
          for (const [bx, bz, s, ry] of [
            [-0.25, 0.2, 0.42, 0.3], [0.3, -0.1, 0.36, 1.1], [0.05, 0.35, 0.3, 0.7],
            [-0.35, -0.3, 0.3, 1.9], [0.4, 0.3, 0.26, 0.5],
          ] as const) {
            const chunk = this.tiledBox(s, s * 0.7, s, brickMat);
            chunk.position.set(bx, s * 0.35, bz);
            chunk.rotation.y = ry;
            group.add(chunk);
          }
          // Fallen planks leaning across the rubble.
          const plankA = this.tiledBox(1.1, 0.09, 0.3, plankMat);
          plankA.position.set(-0.1, 0.42, -0.05);
          plankA.rotation.set(0, 0.5, -0.35);
          const plankB = this.tiledBox(0.9, 0.09, 0.28, plankMat);
          plankB.position.set(0.25, 0.3, 0.25);
          plankB.rotation.set(0.15, -0.8, 0.2);
          group.add(plankA, plankB);
          // A short work stake with a plank marker — clickable, human-scale.
          const pole = this.lambert("resource.tree.log.side");
          const stake = this.tiledBox(0.16, 1.0, 0.16, pole);
          stake.position.set(-0.55, 0.5, -0.45);
          const marker = this.tiledBox(0.5, 0.22, 0.06, plankMat);
          marker.position.set(-0.55, 0.85, -0.38);
          group.add(stake, marker);
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
            crossWing: w >= 8 && roll(7) < 0.6,
            // The odd all-masonry house breaks up rows of timber frames.
            stoneWalls: roll(8) < 0.12,
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
        case "object.shrine.stone": {
          // A code-drawn roadside shrine: a stepped stone plinth, a short
          // pillar, and a small pitched cap sheltering a warm votive glow.
          const stone = this.lambert("terrain.stonebrick");
          const base = this.tiledBox(1.1, 0.3, 1.1, stone);
          base.position.y = 0.15;
          const plinth = this.tiledBox(0.7, 0.35, 0.7, stone);
          plinth.position.y = 0.47;
          const pillar = this.tiledBox(0.4, 0.7, 0.4, stone);
          pillar.position.y = 1.0;
          // A votive niche: an emissive amber block under a little roof.
          const flame = new THREE.Mesh(
            new THREE.BoxGeometry(0.22, 0.28, 0.22),
            new THREE.MeshLambertMaterial({ color: "#000000", emissive: "#e8a13a" }),
          );
          flame.position.y = 1.5;
          const cap = this.tiledBox(0.6, 0.18, 0.6, this.lambert("roof.slate"));
          cap.position.y = 1.78;
          group.add(base, plinth, pillar, flame, cap, makeBlobShadow(0.7));
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
          // A fence gate: the swinging leaf — two rails and vertical slats
          // spanning the full cell — hung between the posts of the fences on
          // either side (which supply the posts, so we add none of our own).
          // Same log wood as object.fence.wood, so the fence line reads as one
          // build. The leaf is a doorLeaf so click-to-open/close rotates it.
          // Same pale plank as the oak_fence terrain blocks, and rails at the
          // terrain fence's own band heights (0.5–0.7 / 1.05–1.25), so the
          // gate reads as one build with the run it hangs in.
          const wood = this.lambert("terrain.plank");
          const leaf = new THREE.Group();
          leaf.position.set(-0.5, 0, 0); // hinge at the left fence post
          for (const py of [0.6, 1.15]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 0.16), wood);
            rail.position.set(0.5, py, 0); // spans post to post
            leaf.add(rail);
          }
          for (const sx of [0.15, 0.5, 0.85]) {
            const slat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.75, 0.13), wood);
            slat.position.set(sx, 0.875, 0);
            leaf.add(slat);
          }
          leaf.userData.doorLeaf = true;
          this.doorLeaves.set(obj.instanceId, leaf);
          group.add(leaf, makeBlobShadow(0.5));
          // A fence neighbour is an object fence/gate OR a terrain fence/wall
          // block (the tutorial pens are built from oak_fence terrain).
          const fenceAt = (x: number, z: number): boolean => {
            if (fenceCells.has(`${x},${z}`)) return true;
            const shape = blockShape(this.sim.world.blockAt({ x, z }));
            return shape === "fence" || shape === "wall";
          };
          if (obj.facing) {
            group.rotation.y = obj.facing === "south" ? Math.PI
              : obj.facing === "east" ? -Math.PI / 2
              : obj.facing === "west" ? Math.PI / 2
              : 0;
          } else {
            // No authored facing (worldgen pens): hang the leaf along the
            // fence line it sits in — fences north/south mean the run goes
            // that way, so the gate spans z instead of the default x.
            const ns = fenceAt(obj.cell.x, obj.cell.z - 1) || fenceAt(obj.cell.x, obj.cell.z + 1);
            const ew = fenceAt(obj.cell.x - 1, obj.cell.z) || fenceAt(obj.cell.x + 1, obj.cell.z);
            if (ns && !ew) group.rotation.y = Math.PI / 2;
          }
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
          // A dungeon gateway built as a BLOCK PORTAL: two pillars and a
          // lintel of the dungeon style's own material, with a color-coded
          // glowing core — mineshafts read timber-and-gold, crypts bone-pale,
          // seacaves teal, foundries ember-red — so you can tell what kind of
          // crawl a gate drops into before you step through.
          const style = /^dyn_([a-z]+)_/.exec(obj.portal?.targetRegionId ?? "")?.[1] ?? "crypt";
          const PORTAL_STYLES: Record<string, { frame: string; core: string }> = {
            mine: { frame: "resource.tree.log.side", core: "#ffb238" },
            foundry: { frame: "terrain.netherbrick", core: "#ff5a2a" },
            vault: { frame: "terrain.stonebrick", core: "#ffd84a" },
            crypt: { frame: "terrain.calcite", core: "#cfe8ef" },
            catacomb: { frame: "terrain.calcite", core: "#9fb8c9" },
            warren: { frame: "terrain.coarsedirt", core: "#8ad251" },
            hive: { frame: "terrain.terracotta", core: "#e8a13a" },
            sanctum: { frame: "terrain.prismarine", core: "#c451ff" },
            seacave: { frame: "terrain.prismarine", core: "#3fd6c4" },
            frostwarren: { frame: "terrain.ice", core: "#9fd8ff" },
          };
          const ps = PORTAL_STYLES[style] ?? PORTAL_STYLES.crypt;
          const frameMat = this.lambert(ps.frame);
          for (const px of [-0.85, 0.85]) {
            const pillar = this.tiledBox(0.7, 3, 0.7, frameMat);
            pillar.position.set(px, 1.5, 0);
            group.add(pillar);
          }
          const lintel = this.tiledBox(2.4, 0.7, 0.7, frameMat);
          lintel.position.y = 3.3;
          group.add(lintel);
          const void_ = new THREE.Mesh(
            new THREE.BoxGeometry(1.0, 2.9, 0.5),
            new THREE.MeshBasicMaterial({ color: "#04060a" }),
          );
          void_.position.y = 1.45;
          group.add(void_);
          // A glowing portal membrane fills the mouth so the gate reads as
          // an active, lit entrance (not a dead dark hole). MeshBasic ignores
          // scene lighting → always full-bright, i.e. self-illuminated.
          const glowMat = new THREE.MeshBasicMaterial({
            color: ps.core,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const membrane = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.95, 0.9), glowMat);
          membrane.position.set(0, 1.0, 0);
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
  };

  /**
   * Mob surface tiles arrive dark (16-34% average luminance; the material
   * colour is meant to carry the hue). Because textures decode sRGB→linear
   * before the Lambert multiply, that darkness compounds and crushed every
   * rig toward black. Bake a luminance-normalised copy of each tile once,
   * so the tile contributes grain while the palette sets the brightness.
   */
  private mobSurfaceCache = new Map<string, THREE.CanvasTexture>();
  private mobSurfaceTexture(id: string): THREE.CanvasTexture {
    const cached = this.mobSurfaceCache.get(id);
    if (cached) return cached;
    // Painted 16px surface tiles, replacing the ImageGen noise tiles: those
    // multiplied uniform speckle over every face, so fur, chitin and bone all
    // read as the same granite. These are coarse Minecraft-scale texels,
    // low-contrast so the rig's palette carries the colour, with a deliberate
    // per-material motif drawn in shade steps.
    const S = 16;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d")!;
    // Seeded LCG so tiles are stable frame-to-frame and across sessions.
    let seed = 7;
    for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    const kind = id.replace("mob.surface.", "");
    const shade = (v: number) => {
      const c = Math.round(Math.min(255, Math.max(0, v * 255)));
      return `rgb(${c},${c},${c})`;
    };
    const px = (x: number, z: number, v: number) => {
      ctx.fillStyle = shade(v);
      ctx.fillRect(((x % S) + S) % S, ((z % S) + S) % S, 1, 1);
    };
    // Base: gentle top-lit vertical gradient with quantised jitter.
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const grad = 0.98 - (y / S) * 0.1;
        const jitter = (Math.floor(rnd() * 3) - 1) * 0.03;
        px(x, y, grad + jitter);
      }
    }
    if (kind === "fur") {
      // Short vertical strokes, like combed pelt.
      for (let n = 0; n < 26; n++) {
        const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
        const v = 0.78 + rnd() * 0.08;
        px(x, y, v); px(x, y + 1, v + 0.04);
      }
    } else if (kind === "scale") {
      // Offset brick rows of scales, each with a darker keel pixel.
      for (let y = 0; y < S; y += 3) {
        for (let x = ((y / 3) % 2) * 2; x < S; x += 4) {
          px(x, y, 0.8); px(x + 1, y, 0.86);
          px(x, y + 1, 0.9); px(x + 1, y + 1, 0.96);
        }
      }
    } else if (kind === "chitin") {
      // Glossy plates: broad bands with a bright specular row.
      for (let y = 0; y < S; y++) {
        const band = y % 5;
        const v = band === 0 ? 0.74 : band === 2 ? 1.0 : 0.88;
        for (let x = 0; x < S; x++) px(x, y, v + (Math.floor(rnd() * 2)) * 0.02);
      }
    } else if (kind === "bone") {
      // Pale with faint meandering cracks.
      for (let n = 0; n < 3; n++) {
        let x = Math.floor(rnd() * S), y = 0;
        while (y < S) { px(x, y, 0.74); y += 1 + Math.floor(rnd() * 2); x += Math.floor(rnd() * 3) - 1; }
      }
    } else if (kind === "stone") {
      // Blotches and a few chipped highlights.
      for (let n = 0; n < 9; n++) {
        const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
        const v = rnd() < 0.5 ? 0.78 : 1.0;
        px(x, y, v); px(x + 1, y, v); px(x, y + 1, v - 0.03);
      }
    } else if (kind === "ooze") {
      // Soft round blobs, lighter at their centres.
      for (let n = 0; n < 5; n++) {
        const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S);
        px(x, y, 1.02); px(x + 1, y, 0.94); px(x - 1, y, 0.94); px(x, y + 1, 0.94); px(x, y - 1, 0.94);
      }
    } else if (kind === "spectral") {
      // Faint diagonal wisps.
      for (let d0 = 0; d0 < S * 2; d0 += 5) {
        for (let k = 0; k < S; k++) px(d0 - k, k, 0.92 + ((d0 / 5) % 2) * 0.08);
      }
    } else if (kind === "metal") {
      // Horizontal plate bands with rivets.
      for (let y = 0; y < S; y++) {
        const v = y % 6 === 0 ? 0.72 : y % 6 === 1 ? 1.0 : 0.9;
        for (let x = 0; x < S; x++) px(x, y, v);
      }
      for (let x = 2; x < S; x += 5) { px(x, 1, 0.7); px(x, 7, 0.7); px(x, 13, 0.7); }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.mobSurfaceCache.set(id, tex);
    return tex;
  }

  private buildEnemyBody(
    group: THREE.Group,
    kind: EnemyViewKind,
    tint?: string,
    defId?: string,
  ): { barHeight: number; anim: EnemyAnim } {
    // Livestock rigs are built in exact Minecraft model pixels (16 px = 1
    // block, the same PX unit as the player), converted here to world units.
    const P = PX;
    const surfaceId = (() => {
      const id = defId ?? "";
      if (kind === "dragon") return "mob.surface.scale";
      if (kind === "warden" || id.includes("construct") || id.includes("golem") || id.includes("sentinel") || id.includes("overseer")) return "mob.surface.stone";
      if (id.includes("spider") || id.includes("crawler") || id.includes("spinner") || id.includes("scuttler") || id.includes("thornback")) return "mob.surface.chitin";
      if (id.includes("slime") || id.includes("silt_king")) return "mob.surface.ooze";
      if (kind === "skeleton" || id.includes("wight") || id.includes("barrow")) return "mob.surface.bone";
      if (["ghast", "allay", "evoker", "illusioner", "witch"].includes(kind)) return "mob.surface.spectral";
      if (["pillager", "vindicator", "dummy", "creeper", "ravager"].includes(kind)) return "mob.surface.metal";
      if (["wolf", "gnasher", "cow", "pig", "sheep", "chicken", "armadillo", "sniffer", "mooshroom"].includes(kind)) return "mob.surface.fur";
      if (["bat", "bee", "squid"].includes(kind)) return kind === "bee" ? "mob.surface.chitin" : kind === "squid" ? "mob.surface.scale" : "mob.surface.fur";
      return "mob.surface.bone";
    })();
    const surfaceMaterials = new Map<string, THREE.MeshLambertMaterial>();
    const box = (w: number, h: number, d: number, color: string) => {
      const key = `${surfaceId}:${color}`;
      let material = surfaceMaterials.get(key);
      if (!material) {
        const softened = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.1);
        material = new THREE.MeshLambertMaterial({ map: this.mobSurfaceTexture(surfaceId), color: softened });
        surfaceMaterials.set(key, material);
      }
      return new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), material);
    };
    // Entity-skin resolution: when the active texture set carries this
    // mob's texture, boxes UV-map onto it and painted detail boxes (eyes,
    // patches) drop out; otherwise the rig keeps its original painted art.
    const skinDef = ENEMY_SKINS[defId ?? ""];
    const bindSkin = (entity: EntitySkin | null, applyTint: boolean): RigSkin | null => {
      if (!entity) return null;
      const material = new THREE.MeshLambertMaterial({
        map: entity.texture,
        alphaTest: 0.05,
      });
      if (applyTint && tint) material.color.set(tint);
      return { material, width: entity.width, height: entity.height, k: entity.width / 64 };
    };
    // Dedicated variant art wins clean; while it's missing, the base-mob skin
    // fills in with the variant's tint recolor (the pre-art placeholder look).
    const primarySkin = skinDef ? this.materials.entitySkin(skinDef.key) : null;
    const fallbackSkin = !primarySkin && skinDef?.fallback ? this.materials.entitySkin(skinDef.fallback) : null;
    const rigSkin = bindSkin(primarySkin ?? fallbackSkin, !primarySkin && !!skinDef?.tinted);
    const woolSkin = skinDef?.wool ? bindSkin(this.materials.entitySkin(skinDef.wool), !!skinDef?.tinted) : null;
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
      goblin: 0.5, yeti: 0.9, rattlesnake: 0.55, werewolf: 0.65,
    }[kind] ?? 0.5;
    group.add(body, makeBlobShadow(shadowSize));
    const anim: EnemyAnim = { body, legs: [], head: null, headRestZ: 0, segments: [], walkPhase: 0, lungeT: 0, groundBird: kind === "chicken" };
    const undeadStyle = undeadStyleFor(defId);
    const constructStyle = constructStyleFor(defId);
    const oozeStyle = oozeStyleFor(defId);
    const canidStyle = canidStyleFor(defId);
    const ungulateStyle = ungulateStyleFor(defId);
    const raiderStyle = raiderStyleFor(defId);
    const flierStyle = flierStyleFor(defId);
    const signatureStyle = signatureStyleFor(defId);
    const bossStyle = bossStyleFor(defId);
    // BetaSharp vanilla mob models: exact box-UV geometry skinned with the
    // Faithful entity textures baked in. Static for now (the source files carry
    // no keyframe animation), but a clear upgrade over the approximate rigs.
    const mobModelId = undeadStyle || constructStyle || oozeStyle || canidStyle || ungulateStyle
      || raiderStyle || flierStyle
      || signatureStyle || bossStyle
      ? undefined
      : GameRenderer.MOB_VIEW_MODEL[kind];
    if (mobModelId) {
      // NOTE: never feed pack/original rig skins into baked BB models — their
      // UV islands are baked for their own texture layout, and an override
      // atlas garbles them (the skeleton turned into white noise).
      const built = buildBBModel(mobModelId);
      if (built) {
        // The baked sheep model carries only the shorn-skin texture, so its
        // wool-overlay cubes (baked with the same UVs as the body underneath)
        // sampled bare skin — the sheep looked shorn. Rebind exactly those
        // cubes (identified by their unique wool-shell dimensions) to the real
        // sheep_wool texture: same layout, so the baked UVs land on the fleece.
        if (mobModelId === "mob.sheep") {
          const wool = this.materials.entitySkin("entity.sheep.wool");
          if (wool) {
            const woolMat = new THREE.MeshLambertMaterial({ map: wool.texture, alphaTest: 0.05 });
            const WOOL_DIMS = new Set(["12x20x9", "7x6.5x7", "5x6x5"]);
            built.group.traverse((o) => {
              const mesh = o as THREE.Mesh;
              const geo = mesh.geometry as THREE.BoxGeometry | undefined;
              if (!mesh.isMesh || !geo?.parameters) return;
              const px = [geo.parameters.width, geo.parameters.height, geo.parameters.depth]
                .map((v) => Math.round((v / P) * 2) / 2).join("x");
              if (WOOL_DIMS.has(px)) mesh.material = woolMat;
            });
            built.materials.push(woolMat); // variant tints recolor the fleece too
          }
        }
        // When a variant's own skin has been delivered (an `entity.<name>`
        // texture — see ASSETS_NEEDED.md §2b), lay it over the model instead
        // of tint-recoloring the base mob's baked art.
        const dedicated = defId ? this.materials.entitySkin(`entity.${defId.slice("enemy.".length)}`) : null;
        if (dedicated) {
          for (const m of built.materials) { m.map = dedicated.texture; m.color.set("#ffffff"); }
        } else if (tint) for (const m of built.materials) m.color.set(tint); // pre-art variant recolor (multiplies the skin)
        // A few bb-models are authored facing the opposite way to the rest of
        // the pack: the sheep's head-bone cubes sit at +z (HeadGroup z 6.5..15)
        // while cow/pig/chicken snouts point -z like every other rig. Spin only
        // the sheep 180° so it walks forwards — the cow already faces -z and
        // flipping it made it walk rear-first.
        if (mobModelId === "mob.sheep") built.group.rotation.y += Math.PI;
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
    if (undeadStyle) {
      const style = undeadStyle;
      const feature = style.feature;
      const skeletal = feature === "hollow" || feature === "dune"
        || feature === "glacial" || feature === "barrow"
        || feature === "skeleton" || feature === "stray";
      const limbColor = skeletal ? style.bone : style.flesh;
      const undead: UndeadAnim = {
        legs: [],
        arms: [],
        torso: new THREE.Group(),
        head: new THREE.Group(),
        headRestX: 0,
        headRestZ: 0,
        hangers: [],
      };
      anim.undead = undead;

      const voxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = box(w, h, d, color);
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glowVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshBasicMaterial({ color }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const hangingStrip = (
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: string,
        phase: number,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        const strip = voxel(root, w, h, d, color);
        strip.geometry.translate(0, -h * 0.5 * P, 0);
        body.add(root);
        undead.hangers.push({ obj: root, restX: 0, restZ: 0, phase });
        return root;
      };
      const layeredSpike = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        height: number,
        color = style.accent,
        tipColor = style.eye,
      ): void => {
        voxel(parent, 1.8, height * 0.62, 1.8, color, x, y + height * 0.31, z);
        voxel(parent, 0.8, height * 0.38, 0.8, tipColor, x, y + height * 0.81, z);
      };

      // Pelvis and articulated legs: every lower leg is a separate knee chain,
      // with block feet and exposed joint caps instead of one swinging prism.
      const pelvis = new THREE.Group();
      pelvis.position.set(0, 13.2 * P, 0);
      voxel(pelvis, style.torsoWidth, 3.2, 5.2, style.cloth);
      voxel(pelvis, style.torsoWidth + 0.9, 1.1, 5.8, style.accent, 0, 1.35, 0);
      body.add(pelvis);
      const upperLegLength = feature === "mire" ? 6.4 : 7;
      const lowerLegLength = feature === "mire" ? 6.2 : 6;
      for (const side of [-1, 1] as const) {
        const hip = new THREE.Group();
        hip.position.set(side * style.torsoWidth * 0.26 * P, 13 * P, 0);
        const upperLeg = skinned(
          rigSkin, style.legWidth, upperLegLength, style.legWidth, limbColor,
          0, 16, [4, 12, 4],
        );
        upperLeg.geometry.translate(0, -upperLegLength * 0.5 * P, 0);
        hip.add(upperLeg);
        voxel(hip, style.legWidth + 0.7, 1.3, style.legWidth + 0.7, style.accent, 0, -1.2, 0);

        const knee = new THREE.Group();
        knee.position.y = -upperLegLength * P;
        const lowerLeg = skinned(
          rigSkin, style.legWidth * 0.88, lowerLegLength, style.legWidth * 0.88,
          limbColor, 0, 16, [4, 12, 4],
        );
        lowerLeg.geometry.translate(0, -lowerLegLength * 0.5 * P, 0);
        knee.add(lowerLeg);
        voxel(knee, style.legWidth + 0.9, 2, style.legWidth + 0.8, style.bone, 0, 0, -0.2);
        voxel(
          knee, style.legWidth + 1.1, 1.45, style.legWidth + 2.2, style.shadow,
          0, -lowerLegLength + 0.75, -1.05,
        );
        voxel(
          knee, style.legWidth * 0.72, 0.75, 1.7, style.bone,
          side * style.legWidth * 0.22, -lowerLegLength + 0.4, -2.4,
        );
        hip.add(knee);
        body.add(hip);
        undead.legs.push({
          side,
          phase: side === -1 ? 0 : Math.PI,
          upper: hip,
          lower: knee,
          restUpperX: 0,
          restUpperZ: side * (feature === "mire" ? 0.05 : 0.025),
          restLowerX: 0,
        });
      }

      // A deep chest backing, offset ribs, sternum, collar and layered pelvis
      // keep the torso readable even when the active texture pack is dark.
      const torso = undead.torso;
      torso.position.set(0, 19.2 * P, -style.hunch * 0.18 * P);
      torso.add(skinned(rigSkin, style.torsoWidth, 11, 5, style.cloth, 16, 16, [8, 12, 4]));
      voxel(torso, style.torsoWidth - 1.5, 7.4, 0.7, style.shadow, 0, 0.4, -2.65);
      voxel(torso, 1.15, 8.2, 0.9, style.bone, 0, 0.4, -3.05);
      for (const y of [-2.4, -0.4, 1.6, 3.35]) {
        voxel(torso, style.torsoWidth * 0.39, 0.75, 0.9, style.bone, -style.torsoWidth * 0.23, y, -3.08);
        voxel(torso, style.torsoWidth * 0.39, 0.75, 0.9, style.bone, style.torsoWidth * 0.23, y, -3.08);
      }
      voxel(torso, style.shoulderWidth, 1.6, 5.8, style.cloth, 0, 5, 0);
      voxel(torso, style.shoulderWidth - 1, 1.05, 6.3, style.accent, 0, 5.85, 0);
      body.add(torso);

      // Elbows and hands articulate independently. The common rest pose hangs
      // low like the turnarounds; the attack pulse brings both hands forward.
      const upperArmLength = feature === "mire" ? 7.2 : 6.5;
      const lowerArmLength = feature === "mire" ? 7.1 : 6.3;
      for (const side of [-1, 1] as const) {
        const shoulder = new THREE.Group();
        shoulder.position.set(
          side * style.shoulderWidth * 0.5 * P,
          24.2 * P,
          -style.hunch * 0.18 * P,
        );
        const upperArm = skinned(
          rigSkin, style.armWidth, upperArmLength, style.armWidth, limbColor,
          40, 16, [4, 12, 4],
        );
        upperArm.geometry.translate(0, -upperArmLength * 0.5 * P, 0);
        shoulder.add(upperArm);
        voxel(shoulder, style.armWidth + 1.4, 2.2, style.armWidth + 1.3, style.cloth, 0, -0.4, 0);

        const elbow = new THREE.Group();
        elbow.position.y = -upperArmLength * P;
        const forearm = skinned(
          rigSkin, style.armWidth * 0.88, lowerArmLength, style.armWidth * 0.88,
          limbColor, 40, 16, [4, 12, 4],
        );
        forearm.geometry.translate(0, -lowerArmLength * 0.5 * P, 0);
        elbow.add(forearm);
        voxel(elbow, style.armWidth + 0.8, 1.8, style.armWidth + 0.8, style.bone, 0, 0, -0.15);
        voxel(
          elbow, style.armWidth + 0.7, 1.7, style.armWidth + 0.5, limbColor,
          0, -lowerArmLength - 0.55, -0.35,
        );
        for (const finger of [-1, 0, 1]) {
          voxel(
            elbow, 0.55, 2.3 + Math.abs(finger) * 0.2, 0.55, style.bone,
            finger * 0.78, -lowerArmLength - 2.15, -0.8,
          );
        }
        shoulder.add(elbow);
        body.add(shoulder);
        const restUpperZ = side * (feature === "spore" ? 0.09 : feature === "grave" ? -0.06 : 0.025);
        shoulder.rotation.z = restUpperZ;
        undead.arms.push({
          side,
          phase: side === -1 ? Math.PI : 0,
          upper: shoulder,
          lower: elbow,
          restUpperX: feature === "mire" ? 0.12 : 0.04,
          restUpperZ,
          restLowerX: feature === "grave" ? -0.1 : 0.04,
        });
      }

      // Layered skull with jaw, cheekbones and visible eye lights. The head
      // retains the existing renderer's lunge translation hook.
      const head = undead.head;
      head.position.set(0, 24.3 * P, -style.hunch * P);
      const skull = skinned(rigSkin, 8, 8, 8, skeletal ? style.bone : style.flesh, 0, 0);
      skull.position.y = 4 * P;
      head.add(skull);
      voxel(head, 7.2, 1.4, 1.3, style.bone, 0, 7.2, -3.75);
      voxel(head, 2.1, 3, 1, style.bone, -3, 3.2, -4.05);
      voxel(head, 2.1, 3, 1, style.bone, 3, 3.2, -4.05);
      voxel(head, 5.7, 2.1, 1.6, style.bone, 0, 0.65, -3.5);
      voxel(head, 4.5, 0.55, 0.5, style.shadow, 0, 1, -4.38);
      for (const side of [-1, 1] as const) {
        voxel(head, 2.15, 2.15, 0.55, style.shadow, side * 2, 4.7, -4.28);
        glowVoxel(head, 0.8, 0.8, 0.62, style.eye, side * 2, 4.65, -4.63);
      }
      head.rotation.x = feature === "grave" || feature === "spore" ? 0.09 : 0;
      undead.headRestX = head.rotation.x;
      undead.headRestZ = head.rotation.z;
      anim.head = head;
      anim.headRestZ = head.position.z;
      body.add(head);

      // Ragged waist strips are separate pivots so the silhouette never
      // freezes. Their lengths are intentionally uneven.
      const stripCount = feature === "hollow" ? 5 : feature === "glacial" ? 7 : 8;
      for (let i = 0; i < stripCount; i++) {
        const x = (i - (stripCount - 1) / 2) * (style.torsoWidth / Math.max(5, stripCount - 1));
        const height = 3.6 + ((i * 7 + stripCount) % 4) * 0.85;
        hangingStrip(x, 13.9, i % 2 === 0 ? -2.4 : 2.35, 1.15, height, 0.7, style.cloth, i * 0.7);
      }

      switch (feature) {
        case "zombie": {
          // Torn work-clothes, exposed rot and an uneven scalp turn the base
          // zombie into an authored RuneCraft corpse rather than a skin cube.
          voxel(torso, style.torsoWidth + 0.9, 4.8, 1.05, style.cloth, 0, 2.2, -3.05);
          voxel(torso, 3.1, 3.4, 0.85, style.flesh, -2.4, -1.8, -3.45);
          voxel(torso, 2.2, 4.2, 0.85, style.shadow, 2.7, 0.1, -3.42);
          voxel(head, 8.7, 2, 8.5, style.shadow, 0, 7.9, 0.2);
          voxel(head, 3.8, 2.5, 1, style.flesh, -2.1, 6.2, -4.2);
          for (const arm of undead.arms) {
            voxel(arm.upper, style.armWidth + 0.9, 2.2, style.armWidth + 0.8, style.cloth, 0, -1, 0);
            voxel(arm.lower, style.armWidth + 0.65, 1.1, style.armWidth + 0.65, style.bone, 0, -4.8, 0);
          }
          for (const x of [-3.5, -1.2, 1.4, 3.6]) {
            hangingStrip(x, 18.2, -2.7, 1.2, 4.5 + Math.abs(x) * 0.3, 0.7, style.cloth, x);
          }
          break;
        }
        case "skeleton": {
          // Deep negative rib spaces, stepped clavicles and cracked brow keep
          // the unarmored skeleton readable beside the crowned Barrow Lord.
          voxel(torso, style.torsoWidth - 2.8, 8.8, 1, style.shadow, 0, 0.4, -3.25);
          for (const y of [-3, -1.1, 0.8, 2.7, 4.2]) {
            voxel(torso, style.torsoWidth + 0.5, 0.7, 1, style.bone, 0, y, -3.55);
          }
          voxel(torso, style.shoulderWidth + 0.9, 1.2, 1.2, style.bone, 0, 5.2, -3);
          voxel(head, 3.1, 1.1, 0.75, style.shadow, -1.9, 6.7, -4.25).rotation.z = -0.22;
          voxel(head, 1.1, 3.5, 0.8, style.shadow, 0.7, 6.2, -4.2).rotation.z = 0.18;
          voxel(pelvis, style.torsoWidth + 0.8, 1, 5.8, style.bone, 0, -0.8, 0);
          break;
        }
        case "drowned": {
          // Waterlogged shoulder mass, barnacle chips and kelp streamers give
          // this corpse a broad tidal outline without changing movement rules.
          voxel(torso, style.shoulderWidth + 1.8, 3.2, 6.8, style.flesh, -0.6, 5.3, 0.4);
          voxel(torso, style.torsoWidth + 1.2, 5.4, 1, style.cloth, 0, 0.2, -3.1);
          for (const [x, y, z] of [[-5.3, 5.8, -1], [4.7, 4.9, 1.3], [-2.8, 2.8, -2.8], [2.9, -1.6, -2.7]] as const) {
            voxel(torso, 1.5, 1.2, 1.4, style.accent, x, y, z);
            glowVoxel(torso, 0.45, 0.45, 1.55, style.eye, x, y, z - 0.3);
          }
          for (const x of [-4.3, -2.4, 1.7, 4]) {
            hangingStrip(x, 24, 1.8, 0.9, 6 + Math.abs(x) * 0.35, 0.65, "#466c55", x * 0.8);
          }
          voxel(head, 9, 2.2, 8.7, style.cloth, 0, 8, 0.2);
          voxel(head, 2.1, 3.5, 1.1, style.accent, 3.2, 5.8, -3.8);
          break;
        }
        case "stray": {
          // Layered frost hood, narrow bone plates and icicle hangers define
          // the archer even without relying on the vanilla stray texture.
          voxel(head, 9.4, 2.1, 9, style.cloth, 0, 8, 0.35);
          voxel(head, 2.1, 7.2, 8.3, style.cloth, -4.2, 4.4, 0.5);
          voxel(head, 2.1, 6.2, 8.3, style.cloth, 4.2, 4.9, 0.5);
          voxel(torso, style.shoulderWidth + 1.7, 2.7, 6.7, style.cloth, 0, 5.5, 0.4);
          for (const [x, h] of [[-4.5, 4.8], [-2.3, 6.2], [2.1, 5.6], [4.4, 4.3]] as const) {
            hangingStrip(x, 24.2, 1.8, 0.9, h, 0.7, style.accent, x);
            layeredSpike(torso, x * 0.72, 6.4, 1.2, 2.4, style.accent, style.eye);
          }
          for (const limb of [...undead.arms, ...undead.legs]) {
            voxel(limb.lower, 1.1, 3.5, 0.9, style.accent, 0, -3.8, -2);
          }
          break;
        }
        case "grave": {
          // Heavy hood, rotten mantle, moss and the broken grave stakes from
          // the back view establish a crooked, scavenged silhouette.
          voxel(head, 9, 2, 8.8, style.cloth, 0, 8.2, 0.3);
          voxel(head, 2, 7.5, 8, style.cloth, -4.25, 4.2, 0.6);
          voxel(head, 2, 6.2, 8, style.cloth, 4.25, 4.8, 0.6);
          voxel(torso, style.shoulderWidth + 1.4, 2.2, 6.5, style.shadow, 0, 5.9, 0.5);
          for (const x of [-4.4, -2.7, 2.4, 4.1]) {
            hangingStrip(x, 24.4, 1.8, 1.3, 5 + Math.abs(x) * 0.35, 0.8, style.cloth, x);
          }
          for (const [x, h, z] of [[-3.5, 12, 2.6], [3.2, 10, 3.1]] as const) {
            const stake = voxel(body, 1.15, h, 1.15, "#66513a", x, 21, z);
            stake.rotation.z = x < 0 ? -0.13 : 0.16;
          }
          voxel(torso, 3.3, 1, 1, style.accent, -2.2, 2.8, -3.65);
          break;
        }
        case "hollow":
          voxel(torso, style.torsoWidth - 2.2, 8.3, 1.2, style.shadow, 0, 0, -2.7);
          voxel(torso, 1, 8.8, 0.9, style.bone, 0, 0, -3.5);
          for (const y of [-2.6, -0.4, 1.8, 3.8]) {
            voxel(torso, style.torsoWidth - 1.7, 0.65, 0.85, style.bone, 0, y, -3.45);
          }
          for (const x of [-4.1, -2.7, 2.7, 4.1]) {
            hangingStrip(x, 24.3, 0.9, 1.05, 4.5 + Math.abs(x) * 0.35, 0.65, style.accent, x * 0.8);
          }
          voxel(head, 5.5, 1.1, 6.2, style.accent, 0.8, 8.25, 0.5);
          break;
        case "mire":
          // Knotted root cuffs, moss slabs, reeds and an asymmetric shoulder
          // mass make the bog corpse much broader than the skeletal wights.
          for (const arm of undead.arms) {
            voxel(arm.upper, style.armWidth + 1.3, 1.3, style.armWidth + 1.3, style.accent, 0, -3.8, 0);
            voxel(arm.lower, style.armWidth + 1, 2.1, style.armWidth + 1, "#4a3b2d", 0, -4.2, 0);
          }
          voxel(torso, style.shoulderWidth + 2.2, 3.4, 6.7, style.flesh, -0.8, 5.4, 0.4);
          voxel(torso, 5.5, 1.2, 2, style.accent, -2.6, 6.8, -1.6);
          for (const [x, y, h] of [[-5.7, 6.2, 5], [4.9, 5.8, 3.7], [-3.1, 4, 3]] as const) {
            layeredSpike(torso, x, y, 1.5, h, "#624a34", "#8b6d48");
          }
          for (const x of [-4, -2.1, 2.3, 4.2]) {
            hangingStrip(x, 23.8, 2.6, 1.3, 5.5 + Math.abs(x) * 0.35, 0.9, style.flesh, x);
          }
          break;
        case "dune": {
          // Layered mummy wraps and a burnt-orange sash read from every angle.
          for (const y of [1.8, 3.5, 5.3, 7.1]) {
            voxel(head, 8.8, 1.05, 8.7, style.accent, (y % 2) * 0.25 - 0.2, y, 0);
          }
          for (const y of [-4.2, -1.8, 0.8, 3.3]) {
            voxel(torso, style.torsoWidth + 0.7, 0.85, 5.7, style.bone, 0, y, 0);
          }
          const sash = voxel(torso, 2.2, 15, 0.8, style.cloth, 0.5, 0.2, -3.35);
          sash.rotation.z = -0.56;
          for (const limb of [...undead.arms, ...undead.legs]) {
            voxel(limb.upper, (limb === undead.arms[0] || limb === undead.arms[1] ? style.armWidth : style.legWidth) + 0.7, 1, 0.8, style.accent, 0, -3.1, -2);
          }
          for (const x of [-3.7, -1.8, 0.2, 2.2, 4]) {
            hangingStrip(x, 14.2, -2.65, 1.1, 5.5 + ((x + 4) % 2), 0.6, style.cloth, x);
          }
          break;
        }
        case "spore": {
          const mushroom = (parent: THREE.Object3D, x: number, y: number, z: number, size: number): void => {
            voxel(parent, size * 0.45, size, size * 0.45, "#c9b4a0", x, y + size * 0.5, z);
            voxel(parent, size * 1.8, size * 0.42, size * 1.55, style.accent, x, y + size * 1.06, z);
            voxel(parent, size, size * 0.28, size * 0.9, "#c28ab6", x, y + size * 1.4, z);
          };
          for (const [x, y, z, size] of [
            [-5.2, 5.4, 0, 2.5], [-3.3, 7, 1.5, 1.8], [4.6, 5.6, 1, 1.5],
            [2.6, 4, 2.6, 1.25],
          ] as const) mushroom(torso, x, y, z, size);
          mushroom(head, 1.6, 8, 1.1, 2.2);
          mushroom(head, -1.1, 8.2, 1.8, 1.35);
          for (const x of [-4.4, -2.9, 2.7, 4.2]) {
            hangingStrip(x, 24.2, 2.2, 1.05, 5.6 + Math.abs(x) * 0.25, 0.65, style.flesh, x);
          }
          break;
        }
        case "glacial":
          // Deep-blue plate masses with stepped ice spires create the widest
          // silhouette in this family and echo the authored turnaround armor.
          voxel(torso, style.shoulderWidth + 2.4, 3.1, 7.2, style.cloth, 0, 5.5, 0.4);
          voxel(torso, style.torsoWidth + 1.5, 3.2, 6.1, style.cloth, 0, 2.2, 0.2);
          for (const [x, y, z, h] of [
            [-6.1, 6.7, 0, 5.2], [-4.2, 7.2, 1.7, 3.7], [6.1, 6.7, 0, 5.2],
            [4.2, 7.2, 1.7, 3.7], [-2.6, 6.5, 2.5, 4.5], [2.6, 6.5, 2.5, 4.5],
          ] as const) layeredSpike(torso, x, y, z, h);
          for (const [x, h] of [[-2.6, 4.3], [0, 6], [2.6, 4.3]] as const) {
            layeredSpike(head, x, 8, 0.8, h);
          }
          for (const limb of [...undead.arms, ...undead.legs]) {
            layeredSpike(limb.lower, 0, -3.8, 0.5, 2.7);
          }
          for (const x of [-3.6, -1.8, 0, 1.8, 3.6]) {
            hangingStrip(x, 14, -2.7, 1.1, 4.2 + Math.abs(x) * 0.25, 0.65, style.cloth, x);
          }
          break;
        case "barrow":
          // Crown, gold-trimmed pauldrons and a split royal cape distinguish
          // the boss even when it shares the base skeleton skin.
          voxel(torso, style.shoulderWidth + 1.8, 3, 7, style.cloth, 0, 5.5, 0.5);
          voxel(torso, style.shoulderWidth + 2.4, 0.75, 7.4, style.accent, 0, 6.8, 0.5);
          voxel(torso, style.torsoWidth + 1, 0.8, 0.7, style.accent, 0, 3.6, -3.55);
          voxel(head, 8.8, 1.2, 8.6, style.accent, 0, 8.1, 0);
          for (const [x, h] of [[-3.4, 3.4], [-1.7, 4.4], [0, 5.2], [1.7, 4.4], [3.4, 3.4]] as const) {
            voxel(head, 1.25, h, 1.25, style.accent, x, 8.4 + h * 0.5, 0);
            glowVoxel(head, 0.65, 0.65, 0.65, style.eye, x, 8.6 + h, -0.5);
          }
          for (const x of [-4.5, -3, 3, 4.5]) {
            hangingStrip(x, 24.2, 2.4, 1.35, 8.5 - Math.abs(x) * 0.4, 0.8, style.cloth, x);
          }
          voxel(pelvis, style.torsoWidth + 1.2, 0.8, 6, style.accent, 0, -1, 0);
          break;
      }

      const barPixels = feature === "glacial" ? 40 : feature === "barrow" ? 39
        : feature === "spore" ? 37 : feature === "mire" ? 36 : 35;
      return { barHeight: barPixels * P + 0.24, anim };
    }
    if (constructStyle) {
      const style = constructStyle;
      const feature = style.feature;
      const construct: ConstructAnim = {
        legs: [],
        arms: [],
        torso: new THREE.Group(),
        head: new THREE.Group(),
        core: new THREE.Group(),
        headRestX: 0,
        headRestZ: 0,
        panels: [],
        gears: [],
        details: [],
      };
      anim.construct = construct;

      const voxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = box(w, h, d, color);
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glowVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshBasicMaterial({ color }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const swayingDetail = (
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: string,
        phase: number,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        const mesh = voxel(root, w, h, d, color);
        mesh.geometry.translate(0, -h * 0.5 * P, 0);
        body.add(root);
        construct.details.push({ obj: root, restX: 0, restZ: 0, phase });
        return root;
      };
      const gear = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        radius: number,
        color: string,
        speed: number,
        phase = 0,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        voxel(root, radius * 1.45, radius * 1.45, 1.3, style.joint);
        glowVoxel(root, radius * 0.45, radius * 0.45, 1.55, style.core);
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const tooth = voxel(
            root, 1.15, 2.1, 1.2, color,
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0,
          );
          tooth.rotation.z = angle;
        }
        root.rotation.z = phase;
        parent.add(root);
        construct.gears.push({ obj: root, speed });
        return root;
      };

      // Hip/knee chains form broad, planted legs with inset piston joints.
      const pelvis = new THREE.Group();
      pelvis.position.set(0, 9.3 * P, 0);
      voxel(pelvis, style.torsoWidth - 1, 3.3, 6.8, style.slab);
      voxel(pelvis, style.torsoWidth, 1.1, 7.2, style.metal, 0, 1.45, 0);
      glowVoxel(pelvis, style.torsoWidth - 3, 0.45, 0.5, style.core, 0, 0.2, -3.65);
      body.add(pelvis);
      const upperLegLength = feature === "liftworks" ? 5.8 : 5.2;
      const lowerLegLength = feature === "moss" || feature === "rootbound" ? 4.8 : 4.4;
      for (const side of [-1, 1] as const) {
        const hip = new THREE.Group();
        hip.position.set(
          side * style.torsoWidth * 0.27 * P,
          (upperLegLength + lowerLegLength + 0.35) * P,
          0,
        );
        const thigh = skinned(
          rigSkin, style.limbWidth, upperLegLength, style.limbWidth, style.body,
          0, 0, [4, 8, 4],
        );
        thigh.geometry.translate(0, -upperLegLength * 0.5 * P, 0);
        hip.add(thigh);
        voxel(hip, style.limbWidth + 1.5, 2, style.limbWidth + 1.3, style.slab, 0, -0.5, 0);
        glowVoxel(hip, 1.1, 1.1, style.limbWidth + 1.6, style.core, 0, -1.1, 0);

        const knee = new THREE.Group();
        knee.position.y = -upperLegLength * P;
        const shin = skinned(
          rigSkin, style.limbWidth * 0.92, lowerLegLength, style.limbWidth * 0.92,
          style.slab, 0, 0, [4, 8, 4],
        );
        shin.geometry.translate(0, -lowerLegLength * 0.5 * P, 0);
        knee.add(shin);
        voxel(knee, style.limbWidth + 1.2, 2, style.limbWidth + 1.5, style.metal, 0, 0, -0.25);
        voxel(
          knee, style.limbWidth + 1.8, 1.5, style.limbWidth + 2.5, style.joint,
          0, -lowerLegLength + 0.75, -0.9,
        );
        voxel(
          knee, style.limbWidth + 0.8, 0.7, 2.2, style.accent,
          0, -lowerLegLength + 0.4, -2.75,
        );
        hip.add(knee);
        body.add(hip);
        construct.legs.push({
          side,
          phase: side === -1 ? 0 : Math.PI,
          upper: hip,
          lower: knee,
          restUpperX: 0,
          restUpperZ: side * 0.025,
          restLowerX: 0,
        });
      }

      // The chest has a recessed rune core and two independently hinged
      // shutters. Their animation makes attacks read before the body lunge.
      const torso = construct.torso;
      torso.position.set(0, 14.5 * P, 0);
      const torsoDepth = feature === "liftworks" ? 8 : 7;
      torso.add(skinned(
        rigSkin, style.torsoWidth, style.torsoHeight, torsoDepth,
        style.body, 0, 16, [10, 10, 6],
      ));
      voxel(torso, style.torsoWidth + 1.3, 1.4, torsoDepth + 0.6, style.slab, 0, style.torsoHeight * 0.38, 0);
      voxel(torso, style.torsoWidth - 1.5, 6.2, 0.9, style.joint, 0, -0.1, -torsoDepth * 0.52);
      voxel(torso, style.torsoWidth - 4, 5, 0.75, "#171f20", 0, 0, -torsoDepth * 0.59);
      const core = new THREE.Group();
      core.position.set(0, 0, -torsoDepth * 0.65 * P);
      glowVoxel(core, 3.5, 4, 0.75, style.core);
      glowVoxel(core, 5.4, 0.7, 0.9, style.core);
      glowVoxel(core, 0.7, 5.6, 0.9, style.core);
      voxel(core, 1.3, 1.3, 1.15, style.accent, 0, 0, -0.2);
      torso.add(core);
      construct.core = core;
      for (const side of [-1, 1] as const) {
        const panel = new THREE.Group();
        const panelWidth = (style.torsoWidth - 3.6) * 0.5;
        panel.position.set(side * 1.7 * P, 0, -torsoDepth * 0.67 * P);
        voxel(panel, panelWidth, 5.7, 1.1, style.slab, side * panelWidth * 0.5, 0, 0);
        voxel(panel, panelWidth - 0.8, 0.65, 1.35, style.metal, side * panelWidth * 0.5, 1.85, 0);
        voxel(panel, panelWidth - 0.8, 0.65, 1.35, style.metal, side * panelWidth * 0.5, -1.85, 0);
        torso.add(panel);
        construct.panels.push({ obj: panel, restY: 0, sign: side });
      }
      body.add(torso);

      // Shoulder and elbow pivots make the heavy slam distinct from the old
      // one-piece arms. Each hand is a layered masonry clamp.
      const upperArmLength = feature === "liftworks" ? 6.8 : 6.1;
      const lowerArmLength = feature === "rootbound" || feature === "moss" ? 6.2 : 5.6;
      for (const side of [-1, 1] as const) {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * style.shoulderWidth * 0.5 * P, 20.2 * P, 0);
        const upperArm = skinned(
          rigSkin, style.limbWidth, upperArmLength, style.limbWidth, style.body,
          0, 44, [4, 12, 4],
        );
        upperArm.geometry.translate(0, -upperArmLength * 0.5 * P, 0);
        shoulder.add(upperArm);
        voxel(shoulder, style.limbWidth + 2.2, 3.3, style.limbWidth + 2, style.slab, 0, -0.6, 0);
        voxel(shoulder, style.limbWidth + 2.6, 0.7, style.limbWidth + 2.4, style.accent, 0, 0.8, 0);

        const elbow = new THREE.Group();
        elbow.position.y = -upperArmLength * P;
        const forearm = skinned(
          rigSkin, style.limbWidth * 0.92, lowerArmLength, style.limbWidth * 0.92,
          style.slab, 0, 44, [4, 12, 4],
        );
        forearm.geometry.translate(0, -lowerArmLength * 0.5 * P, 0);
        elbow.add(forearm);
        voxel(elbow, style.limbWidth + 1.5, 2, style.limbWidth + 1.6, style.metal, 0, 0, -0.2);
        glowVoxel(elbow, 1.05, 1.05, style.limbWidth + 1.9, style.core, 0, -0.1, 0);
        voxel(
          elbow, style.limbWidth + 1.8, 2.3, style.limbWidth + 2.1, style.joint,
          0, -lowerArmLength - 0.5, -0.4,
        );
        for (const finger of [-1, 0, 1]) {
          voxel(
            elbow, 0.8, 1.8, 1, style.accent,
            finger * 1.15, -lowerArmLength - 2, -1.4,
          );
        }
        shoulder.add(elbow);
        body.add(shoulder);
        construct.arms.push({
          side,
          phase: side === -1 ? Math.PI : 0,
          upper: shoulder,
          lower: elbow,
          restUpperX: 0.04,
          restUpperZ: side * 0.035,
          restLowerX: 0.05,
        });
      }

      // A separately animated helm with cheek slabs and a permanent rune eye.
      const head = construct.head;
      head.position.set(0, 20.5 * P, -0.3 * P);
      const skull = skinned(rigSkin, style.headWidth, 5.8, 6.2, style.body, 40, 0, [6, 5, 6]);
      skull.position.y = 2.9 * P;
      head.add(skull);
      voxel(head, style.headWidth + 1.3, 1.4, 6.9, style.slab, 0, 5.4, 0);
      voxel(head, 1.5, 3.8, 1.2, style.metal, -style.headWidth * 0.45, 2.7, -3.15);
      voxel(head, 1.5, 3.8, 1.2, style.metal, style.headWidth * 0.45, 2.7, -3.15);
      glowVoxel(head, style.headWidth - 2, 0.85, 0.75, style.core, 0, 3.35, -3.55);
      voxel(head, style.headWidth - 1.5, 1.2, 1.3, style.joint, 0, 0.3, -2.8);
      anim.head = head;
      anim.headRestZ = head.position.z;
      construct.headRestX = head.rotation.x;
      construct.headRestZ = head.rotation.z;
      body.add(head);

      switch (feature) {
        case "canyon":
          // Sandstone strata, chipped brick corners and a carved core frame.
          for (const y of [-3.6, -1.5, 1.8, 4]) {
            voxel(torso, style.torsoWidth + 0.9, 0.8, torsoDepth + 0.8, style.accent, 0, y, 0);
          }
          for (const [x, y, z] of [[-5.5, 3, -3], [4.8, -3.2, -3.4], [-3.8, -4, 3.2], [5.1, 4.2, 2.7]] as const) {
            voxel(torso, 2.2, 1.7, 1.2, "#c28b5c", x, y, z);
          }
          for (const arm of construct.arms) {
            voxel(arm.upper, style.limbWidth + 1, 0.8, style.limbWidth + 1, style.accent, 0, -3.1, 0);
          }
          break;
        case "rust":
          // Riveted iron, asymmetric corrosion, exhaust stacks and a live cog.
          voxel(torso, style.torsoWidth + 1.4, 3.4, torsoDepth + 0.9, style.metal, -1, 2.9, 0.3);
          for (const [x, y] of [[-4.7, 4], [4.7, 4], [-4.7, -3.8], [4.7, -3.8]] as const) {
            voxel(torso, 0.8, 0.8, 0.8, style.accent, x, y, -4);
          }
          gear(torso, 3.2, -1.1, -4.2, 2.2, style.metal, 1.15, 0.4);
          for (const [x, h] of [[-4.1, 7], [-2.4, 5.2]] as const) {
            voxel(torso, 1.4, h, 1.4, style.joint, x, 5 + h * 0.5, 2.7);
            voxel(torso, 1.8, 1, 1.8, style.accent, x, 5 + h, 2.7);
          }
          for (const limb of [...construct.arms, ...construct.legs]) {
            voxel(limb.lower, style.limbWidth + 0.9, 1, style.limbWidth + 0.9, style.accent, 0, -3, 0);
          }
          break;
        case "rootbound":
          // Root cage over the core, woody wraps, moss and branch antlers.
          for (const x of [-4.2, -2.1, 2.1, 4.2]) {
            const root = voxel(torso, 1.05, style.torsoHeight + 3, 1.1, style.metal, x, 0, -4.2);
            root.rotation.z = x * 0.035;
          }
          for (const limb of [...construct.arms, ...construct.legs]) {
            voxel(limb.upper, style.limbWidth + 1, 1.05, style.limbWidth + 1, style.metal, 0, -2.1, 0);
            voxel(limb.lower, style.limbWidth + 0.7, 1.05, style.limbWidth + 0.7, style.accent, 0, -3.2, 0);
          }
          voxel(torso, style.shoulderWidth + 1.5, 1.5, 7.8, style.accent, 0, 5.5, 0.6);
          for (const [x, h] of [[-3, 6], [-1.4, 4], [2, 5], [3.7, 3.5]] as const) {
            voxel(head, 1.2, h, 1.2, style.metal, x, 6 + h * 0.5, 1.7);
          }
          for (const [x, h] of [[-6.5, 6], [-4.8, 4.5], [4.9, 5.5], [6.4, 4]] as const) {
            swayingDetail(x, 21.2, 2.3, 1, h, 0.9, style.accent, x);
          }
          break;
        case "liftworks":
          // Lift rails, twin shoulder cogs, piston boxes and cable counterweight.
          voxel(torso, 2, style.torsoHeight + 4, torsoDepth + 1, style.metal, -5.1, 0, 0);
          voxel(torso, 2, style.torsoHeight + 4, torsoDepth + 1, style.metal, 5.1, 0, 0);
          for (const side of [-1, 1] as const) {
            gear(torso, side * 5.5, 4.7, -4.4, 2.5, style.accent, side * 1.35, side * 0.5);
            voxel(torso, 2.2, 8, 2.2, style.joint, side * 5.2, -2.2, 3.8);
            glowVoxel(torso, 0.8, 5.5, 0.8, style.core, side * 5.2, -2.2, 5);
          }
          voxel(torso, 7.2, 7.2, 3.3, style.slab, 0, 0.5, 4.4);
          gear(torso, 0, 0.5, 6.2, 2.35, style.metal, -0.9, 1.1);
          for (const arm of construct.arms) {
            voxel(arm.lower, style.limbWidth + 1.4, 4, style.limbWidth + 1.4, style.metal, 0, -3, 0);
          }
          break;
        case "moss":
          // Overgrown capstones, hanging vines, leaf clumps and sprouting twigs.
          voxel(torso, style.shoulderWidth + 1.8, 2.4, 8.1, style.slab, 0, 5.4, 0.5);
          voxel(torso, style.shoulderWidth - 1, 1.1, 7.4, style.accent, -1, 6.9, -0.3);
          for (const [x, y, z, w] of [[-4, 2.5, -4, 3], [3.6, -2, -4, 2.6], [-3, -4, 3.5, 2.2], [4.5, 4, 2.8, 2.5]] as const) {
            voxel(torso, w, 1, 1.3, style.accent, x, y, z);
          }
          for (const [x, h] of [[-6.7, 6], [-5.1, 4], [4.9, 5.2], [6.6, 6.8]] as const) {
            swayingDetail(x, 21.4, 2.8, 1.15, h, 0.8, style.accent, x * 0.7);
          }
          for (const [x, h] of [[-2.7, 3.4], [0.2, 4.5], [2.5, 2.8]] as const) {
            voxel(head, 0.9, h, 0.9, style.metal, x, 5.8 + h * 0.5, 1.2);
            voxel(head, 2, 0.8, 1.6, style.accent, x, 5.8 + h, 1.2);
          }
          break;
        case "sentinel":
          // Formal symmetric armor, crest, rune bands and framed core panels.
          voxel(torso, style.shoulderWidth + 2, 3.5, 7.8, style.slab, 0, 5, 0.4);
          voxel(torso, style.shoulderWidth + 2.5, 0.75, 8.1, style.accent, 0, 6.7, 0.4);
          for (const y of [-3.7, 3.4]) {
            glowVoxel(torso, style.torsoWidth - 1.2, 0.45, 0.55, style.core, 0, y, -4.1);
          }
          voxel(head, 2.2, 4.8, 6.8, style.slab, 0, 7.3, 0);
          voxel(head, 0.8, 5.6, 7.1, style.accent, 0, 7.8, 0);
          for (const limb of [...construct.arms, ...construct.legs]) {
            voxel(limb.upper, style.limbWidth + 1, 0.75, style.limbWidth + 1, style.accent, 0, -2.4, 0);
          }
          break;
      }

      const barPixels = feature === "liftworks" ? 35 : feature === "rootbound" || feature === "moss" ? 34 : 32;
      return { barHeight: barPixels * P + 0.28, anim };
    }
    if (oozeStyle) {
      const style = oozeStyle;
      const feature = style.feature;
      const ooze: OozeAnim = {
        segments: [],
        core: new THREE.Group(),
        mouth: new THREE.Group(),
        eyes: [],
        details: [],
      };
      anim.ooze = ooze;

      const voxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = box(w, h, d, color);
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const gelVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        opacity: number,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshLambertMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
          }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glowVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshBasicMaterial({ color }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const segment = (
        w: number,
        h: number,
        d: number,
        y: number,
        phase: number,
        squash: number,
        x = 0,
        z = 0,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        gelVoxel(root, w, h, d, style.outer, style.opacity);
        voxel(root, w * 0.8, 0.55, d * 0.75, style.crust, 0, h * 0.33, 0);
        body.add(root);
        ooze.segments.push({ obj: root, baseY: root.position.y, phase, squash });
        return root;
      };
      const swayingDetail = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: string,
        phase: number,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        const mesh = voxel(root, w, h, d, color);
        mesh.geometry.translate(0, h * 0.5 * P, 0);
        parent.add(root);
        ooze.details.push({ obj: root, restX: 0, restZ: 0, phase });
        return root;
      };

      // Four overlapping gel layers deform independently. The wider foot and
      // stepped cap give these oozes an authored silhouette instead of one cube.
      const base = segment(style.width * 1.1, 3.2, style.depth * 1.1, 1.6, 0, 0.65);
      const lower = segment(style.width, style.height * 0.55, style.depth, style.height * 0.43, 1.2, 0.5);
      const upper = segment(style.width * 0.8, style.height * 0.45, style.depth * 0.82, style.height * 0.72, 2.4, 0.38);
      const cap = segment(style.width * 0.58, style.height * 0.25, style.depth * 0.6, style.height * 0.96, 3.1, 0.28);
      voxel(base, style.width * 0.75, 0.8, style.depth * 0.8, style.inner, 0, -1, 0);

      // A solid internal knot remains visible through the translucent layers.
      const core = ooze.core;
      core.position.set(0, style.height * 0.52 * P, 0);
      voxel(core, style.width * 0.34, style.height * 0.42, style.depth * 0.32, style.inner);
      glowVoxel(core, style.width * 0.19, style.height * 0.28, style.depth * 0.34, style.accent);
      glowVoxel(core, style.width * 0.3, 0.65, style.depth * 0.36, style.eye);
      body.add(core);

      // Eyes and mouth live on the upper deforming layer so expression follows
      // the bounce rather than floating in front of the creature.
      const faceZ = -style.depth * 0.43;
      const faceY = -style.height * 0.06;
      for (const side of [-1, 1] as const) {
        const eye = glowVoxel(
          upper, 1.7, 1.7, 0.7, style.eye,
          side * style.width * 0.2, faceY + 1.3, faceZ,
        );
        voxel(upper, 2.4, 2.4, 0.45, style.inner, side * style.width * 0.2, faceY + 1.3, faceZ + 0.25);
        upper.remove(eye);
        upper.add(eye); // keep the glow in front of its dark socket
        ooze.eyes.push(eye);
      }
      const mouth = new THREE.Group();
      mouth.position.set(0, (faceY - 1.8) * P, (faceZ - 0.05) * P);
      voxel(mouth, 4.8, 1.15, 0.75, "#151a15");
      voxel(mouth, 2.4, 0.45, 0.85, style.accent, 0, -0.65, -0.05);
      upper.add(mouth);
      ooze.mouth = mouth;

      switch (feature) {
        case "bog":
          // Muck shelf, peat clods, bubbles and half-swallowed old bones.
          voxel(base, style.width + 1.8, 1.1, style.depth + 1.4, style.crust, 0, 0.1, 0);
          for (const [x, y, z, size] of [
            [-5.2, 2.2, -3, 1.7], [4.8, 1.8, 2.5, 2], [-2, 1.6, 5.3, 1.4],
          ] as const) gelVoxel(lower, size, size, size, "#8ca35a", 0.62, x, y, z);
          for (const [x, y, z] of [[-4, 1.6, -5], [3.4, -1.8, -5.7], [5, 0.8, 2]] as const) {
            voxel(lower, 2.4, 1, 1.2, style.accent, x, y, z);
          }
          voxel(upper, 4.8, 0.8, 0.9, "#c5c0a2", -1, -1.5, -6.5).rotation.z = -0.25;
          break;
        case "blight": {
          const crystal = (parent: THREE.Object3D, x: number, y: number, z: number, h: number): void => {
            voxel(parent, 1.9, h * 0.65, 1.9, style.accent, x, y + h * 0.325, z);
            glowVoxel(parent, 0.8, h * 0.35, 0.8, style.eye, x, y + h * 0.825, z);
          };
          for (const [x, y, z, h] of [
            [-3.2, 1.3, 0, 5.2], [2.4, 1.3, 1.2, 4], [0, 1.3, -1.8, 3.5],
          ] as const) crystal(cap, x, y, z, h);
          for (const [x, y, z] of [[-4.8, 0.5, -5], [4.2, -1.5, -4.7], [-3, -2, 5]] as const) {
            voxel(lower, 3, 2.2, 0.75, "#241c2b", x, y, z);
            glowVoxel(lower, 1.2, 0.45, 0.9, style.eye, x, y, z - 0.4);
          }
          break;
        }
        case "bramble":
          // Root cage, woody shelf and stepped thorns break the low silhouette.
          for (const [x, z, h] of [[-5.8, -2, 4.5], [-3.5, 4, 3.5], [4.8, 2.7, 5], [5.7, -3.2, 3.8]] as const) {
            voxel(lower, 1.1, h, 1.1, style.crust, x, 0, z).rotation.z = x < 0 ? -0.2 : 0.2;
            voxel(lower, 0.65, 2, 0.65, style.accent, x, h * 0.55, z);
          }
          for (const z of [-4.8, 0, 4.8]) {
            voxel(base, style.width + 1.8, 0.9, 1.1, style.crust, 0, 1.3, z);
          }
          for (const [x, h] of [[-5.8, 4], [-3.8, 5.2], [4.1, 4.5], [5.9, 3.6]] as const) {
            swayingDetail(body, x, style.height * 0.72, 2.5, 0.8, h, 0.8, style.accent, x);
          }
          break;
        case "marsh":
          // Waterlogged skirt, side lobes, reeds and cattail heads.
          gelVoxel(base, style.width + 3, 1.3, style.depth + 3, "#4d8a78", 0.48, 0, -0.2, 0);
          segment(6.5, 4.5, 7, 2.5, 1.7, 0.7, -6.8, 1.8);
          segment(5.8, 3.8, 6.2, 2, 2.7, 0.65, 6.7, -1.5);
          for (const [x, z, h] of [
            [-6, 2, 7], [-4.2, 4.5, 9], [4.5, 3.5, 8], [6.2, -1, 6.5], [1.5, 5, 7.5],
          ] as const) {
            const reed = swayingDetail(body, x, 4.8, z, 0.7, h, 0.7, "#809052", x + z);
            voxel(reed, 1.4, 2.4, 1.4, "#6a4b32", 0, h + 1.2, 0);
          }
          break;
        case "silt":
          // Sediment bands, embedded relics and a block crown for the boss.
          for (const y of [-1.6, 0.2, 2]) {
            voxel(lower, style.width + 0.8, 0.8, style.depth + 0.8, style.crust, 0, y, 0);
          }
          voxel(upper, 3.5, 2.8, 0.9, "#b8ae88", -3.8, -1.2, -6);
          voxel(cap, 9.5, 1.5, 8.7, style.accent, 0, 1.6, 0);
          for (const [x, h] of [[-4, 3.2], [-2, 4.4], [0, 5.2], [2, 4.4], [4, 3.2]] as const) {
            voxel(cap, 1.4, h, 1.4, style.accent, x, 2 + h * 0.5, 0);
            glowVoxel(cap, 0.65, 0.65, 0.75, style.eye, x, 2 + h, -0.8);
          }
          for (const [x, y, z] of [[-5, 0.5, 4], [4.7, -1, 3.8], [2.5, 1.5, -5.5]] as const) {
            voxel(lower, 2.2, 1.4, 1.5, style.accent, x, y, z);
          }
          break;
      }

      const featureHeight = feature === "blight" ? 6 : feature === "silt" ? 5.5
        : feature === "marsh" ? 9 : feature === "bramble" ? 4 : 1.5;
      return { barHeight: (style.height + featureHeight) * P + 0.25, anim };
    }
    if (canidStyle) {
      const style = canidStyle;
      const feature = style.feature;
      const canid: CanidAnim = {
        legs: [],
        trunk: new THREE.Group(),
        neck: new THREE.Group(),
        head: new THREE.Group(),
        jaw: new THREE.Group(),
        headRestX: 0,
        headRestZ: 0,
        tail: [],
        details: [],
      };
      anim.canid = canid;

      const voxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = box(w, h, d, color);
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glowVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshBasicMaterial({ color }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const swayingDetail = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: string,
        phase: number,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        const mesh = voxel(root, w, h, d, color);
        mesh.geometry.translate(0, h * 0.5 * P, 0);
        parent.add(root);
        canid.details.push({ obj: root, restX: 0, restZ: 0, phase });
        return root;
      };
      const layeredSpike = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        h: number,
        color = style.accent,
        tipColor = style.eye,
      ): void => {
        voxel(parent, 1.5, h * 0.62, 1.5, color, x, y + h * 0.31, z);
        voxel(parent, 0.65, h * 0.38, 0.65, tipColor, x, y + h * 0.81, z);
      };

      // Long, layered torso with separate shoulder ruff and rump armor.
      const trunk = canid.trunk;
      trunk.position.set(0, 10.2 * P, 1.5 * P);
      trunk.add(skinned(
        rigSkin,
        style.bodyWidth,
        style.bodyHeight,
        style.bodyLength,
        style.fur,
        18,
        14,
        [6, 9, 6],
      ));
      voxel(
        trunk,
        style.bodyWidth * 0.78,
        1.25,
        style.bodyLength * 0.75,
        style.dark,
        0,
        style.bodyHeight * 0.5,
        0.7,
      );
      voxel(
        trunk,
        style.bodyWidth + 0.9,
        style.bodyHeight * 0.48,
        2.5,
        style.ruff,
        0,
        0.4,
        -style.bodyLength * 0.35,
      );
      voxel(
        trunk,
        style.bodyWidth + 0.5,
        style.bodyHeight * 0.4,
        2.2,
        style.dark,
        0,
        0,
        style.bodyLength * 0.38,
      );
      body.add(trunk);

      // Four three-joint limbs: shoulder/hip, elbow/knee and ankle/paw.
      const upperLength = feature === "dire" ? 4 : 3.6;
      const lowerLength = feature === "dire" ? 3.2 : 2.9;
      const legRootY = upperLength + lowerLength + 1.8;
      for (const front of [true, false]) {
        const z = 1.5 + (front ? -style.bodyLength * 0.34 : style.bodyLength * 0.34);
        for (const side of [-1, 1] as const) {
          const upper = new THREE.Group();
          upper.position.set(side * style.bodyWidth * 0.37 * P, legRootY * P, z * P);
          const upperMesh = skinned(
            rigSkin, style.limbWidth, upperLength, style.limbWidth, style.fur,
            0, 18, [2, 8, 2],
          );
          upperMesh.geometry.translate(0, -upperLength * 0.5 * P, 0);
          upper.add(upperMesh);
          voxel(upper, style.limbWidth + 1.1, 1.6, style.limbWidth + 1, style.ruff, 0, -0.6, 0);

          const knee = new THREE.Group();
          knee.position.y = -upperLength * P;
          const lowerMesh = skinned(
            rigSkin, style.limbWidth * 0.84, lowerLength, style.limbWidth * 0.84,
            style.dark, 0, 18, [2, 8, 2],
          );
          lowerMesh.geometry.translate(0, -lowerLength * 0.5 * P, 0);
          knee.add(lowerMesh);
          voxel(knee, style.limbWidth + 0.8, 1.5, style.limbWidth + 0.9, style.accent, 0, -0.1, -0.2);

          const ankle = new THREE.Group();
          ankle.position.y = -lowerLength * P;
          voxel(ankle, style.limbWidth * 0.78, 1.5, style.limbWidth * 0.8, style.dark, 0, -0.55, -0.15);
          voxel(ankle, style.limbWidth + 1.25, 1.3, style.limbWidth + 2.1, style.ruff, 0, -1.05, -1.05);
          for (const toe of [-1, 0, 1]) {
            voxel(ankle, 0.55, 0.5, 1.35, style.accent, toe * 0.78, -1.45, -2.2);
          }
          knee.add(ankle);
          upper.add(knee);
          body.add(upper);

          const diagonal = front ? (side === -1 ? 0 : Math.PI) : (side === -1 ? Math.PI : 0);
          const restKneeX = front ? 0.12 : -0.28;
          const restAnkleX = front ? -0.06 : 0.18;
          knee.rotation.x = restKneeX;
          ankle.rotation.x = restAnkleX;
          canid.legs.push({
            side,
            front,
            phase: diagonal,
            upper,
            knee,
            ankle,
            restUpperX: front ? 0.02 : -0.03,
            restUpperZ: side * 0.02,
            restKneeX,
            restAnkleX,
          });
        }
      }

      // Neck bridge and mane connect the trunk to a low hunting head.
      const neck = canid.neck;
      neck.position.set(0, 10.8 * P, (1.5 - style.bodyLength * 0.45) * P);
      neck.rotation.x = -0.12;
      neck.userData.baseX = neck.rotation.x;
      voxel(neck, style.bodyWidth * 0.72, 6, 6, style.fur);
      voxel(neck, style.bodyWidth + 2, 5.4, 6.8, style.ruff, 0, 0.5, 0.6);
      voxel(neck, style.bodyWidth + 0.6, 1.1, 7.4, style.dark, 0, 3.1, 0.5);
      body.add(neck);

      const head = canid.head;
      head.position.set(0, 11.1 * P, (-style.bodyLength * 0.5 - 1.25) * P);
      const skull = skinned(
        rigSkin, style.headWidth, 5.8, 5.6, style.fur,
        0, 0, [6, 6, 4],
      );
      skull.position.z = -2.1 * P;
      head.add(skull);
      voxel(head, style.headWidth + 0.8, 1.25, 5.8, style.dark, 0, 2.8, -2.1);
      voxel(head, style.headWidth * 0.58, 2.8, 4.8, style.dark, 0, -0.9, -5.1);
      voxel(head, style.headWidth * 0.38, 1.2, 1.2, "#181719", 0, -0.7, -7.7);
      for (const side of [-1, 1] as const) {
        const ear = new THREE.Group();
        ear.position.set(side * style.headWidth * 0.34 * P, 3.2 * P, -1.2 * P);
        ear.rotation.z = side * -0.12;
        voxel(ear, 1.7, 3.4, 1.4, style.dark, 0, 1.5, 0);
        voxel(ear, 0.75, 2, 0.8, style.accent, 0, 1.5, -0.45);
        head.add(ear);
        glowVoxel(head, 1.05, 1.05, 0.6, style.eye, side * style.headWidth * 0.28, 0.8, -5);
      }
      const jaw = canid.jaw;
      jaw.position.set(0, -1.45 * P, -4.8 * P);
      voxel(jaw, style.headWidth * 0.55, 1.35, 4.5, style.ruff, 0, -0.6, -1.2);
      voxel(jaw, style.headWidth * 0.42, 0.55, 3.8, "#191719", 0, 0.2, -1.3);
      for (const side of [-1, 1] as const) {
        voxel(jaw, 0.6, 1.3, 0.65, "#ded5bd", side * 1.35, 0.15, -2.8);
      }
      head.add(jaw);
      anim.head = head;
      anim.headRestZ = head.position.z;
      canid.headRestX = head.rotation.x;
      canid.headRestZ = head.rotation.z;
      body.add(head);

      // Three tail pivots provide idle wag, run balance and attack bracing.
      let tailParent: THREE.Object3D = body;
      let tailZ = 1.5 + style.bodyLength * 0.5;
      for (let i = 0; i < 3; i++) {
        const tail = new THREE.Group();
        const length = 4.2 - i * 0.65;
        const width = Math.max(1.4, 3 - i * 0.55);
        if (i === 0) tail.position.set(0, 11.1 * P, tailZ * P);
        else tail.position.z = tailZ * P;
        const segmentMesh = skinned(rigSkin, width, width, length, style.fur, 9, 18, [2, 8, 2]);
        segmentMesh.geometry.translate(0, 0, length * 0.5 * P);
        tail.add(segmentMesh);
        voxel(tail, width + 0.7, width * 0.75, 1.2, i === 0 ? style.ruff : style.dark, 0, 0, 0.6);
        const restX = -0.22 + i * 0.14;
        tail.rotation.x = restX;
        tailParent.add(tail);
        canid.tail.push({ obj: tail, restX, restY: 0, restZ: 0, phase: i * 0.8 });
        tailParent = tail;
        tailZ = length;
      }

      switch (feature) {
        case "timber":
          // Bark-like flank plates, coarse mane tufts and woodland moss chips.
          for (const z of [-4.4, -1.3, 2, 5]) {
            voxel(trunk, style.bodyWidth + 0.8, 1.1, 2, style.accent, 0, style.bodyHeight * 0.36, z);
          }
          for (const [x, y, z] of [[-3.6, 1.6, -2], [3.5, -0.6, 2.8], [-2.8, 0.4, 5]] as const) {
            voxel(trunk, 2.1, 1.3, 1.5, "#62734a", x, y, z);
          }
          for (const x of [-3.6, -1.8, 1.8, 3.6]) {
            swayingDetail(neck, x, 1.4, 2.8, 0.75, 3.4 + Math.abs(x) * 0.2, 0.8, style.ruff, x);
          }
          break;
        case "frost":
          // Ice ruff, dorsal shards, frozen cuffs and crystal tail armor.
          voxel(neck, style.bodyWidth + 3.4, 6.4, 7.5, style.ruff, 0, 0.6, 0.8);
          for (const [x, z, h] of [[-2.8, -4, 3.8], [2.7, -1, 4.6], [-2.2, 2.2, 3.4], [2.1, 5, 4]] as const) {
            layeredSpike(trunk, x, style.bodyHeight * 0.5, z, h);
          }
          for (const leg of canid.legs) {
            voxel(leg.ankle, style.limbWidth + 1.6, 1.5, style.limbWidth + 1.8, style.accent, 0, -0.2, 0);
          }
          for (const side of [-1, 1] as const) {
            layeredSpike(head, side * 2.2, 2.8, -0.2, 2.8);
          }
          break;
        case "dire":
          // Massive shoulder armor, rib plates, brow blocks and bone spikes.
          voxel(neck, style.bodyWidth + 4, 6.5, 8, style.dark, 0, 0.5, 1);
          voxel(neck, style.bodyWidth + 4.8, 2.2, 8.5, style.ruff, 0, 2.7, 1);
          for (const z of [-4.8, -1.6, 1.8, 5.2]) {
            voxel(trunk, style.bodyWidth + 1.8, 1.4, 2, style.accent, 0, style.bodyHeight * 0.3, z);
          }
          for (const [x, z, h] of [[-3.8, -3.2, 3.2], [3.8, -0.5, 3.8], [-3.4, 3.2, 3.4], [3.5, 5.5, 3]] as const) {
            layeredSpike(trunk, x, style.bodyHeight * 0.5, z, h, "#6b6258", "#c4b8a2");
          }
          voxel(head, style.headWidth + 1.5, 2, 5.9, style.dark, 0, 2, -2.2);
          voxel(jaw, style.headWidth * 0.7, 1.7, 4.8, style.dark, 0, -0.8, -1.1);
          break;
        case "ash":
          // Basalt plates and emissive ember seams run through body and limbs.
          for (const z of [-4.8, -1.5, 1.8, 5]) {
            voxel(trunk, style.bodyWidth + 0.9, 1.5, 2, style.dark, 0, style.bodyHeight * 0.3, z);
            glowVoxel(trunk, style.bodyWidth * 0.65, 0.4, 0.55, style.eye, 0, style.bodyHeight * 0.56, z - 0.4);
          }
          for (const leg of canid.legs) {
            glowVoxel(leg.upper, 0.45, 2.8, style.limbWidth + 0.4, style.eye, 0, -2.1, -0.3);
            voxel(leg.ankle, style.limbWidth + 1.3, 1.3, style.limbWidth + 1.4, style.dark, 0, -0.2, 0);
          }
          glowVoxel(head, style.headWidth - 1.8, 0.45, 0.6, style.eye, 0, 1.8, -5);
          for (const tail of canid.tail) {
            glowVoxel(tail.obj, 0.45, 0.45, 2.3, style.eye, 0, 0.4, 1.8);
          }
          break;
      }

      const barPixels = feature === "frost" || feature === "dire" ? 20 : 18;
      return { barHeight: barPixels * P + 0.28, anim };
    }
    if (ungulateStyle) {
      const style = ungulateStyle;
      const feature = style.feature;
      const ungulate: UngulateAnim = {
        legs: [],
        trunk: new THREE.Group(),
        neck: new THREE.Group(),
        head: new THREE.Group(),
        jaw: new THREE.Group(),
        headRestX: 0,
        headRestY: 0,
        headRestZ: 0,
        neckRestX: 0,
        tail: [],
        details: [],
      };
      anim.ungulate = ungulate;

      const voxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = box(w, h, d, color);
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glowVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshBasicMaterial({ color }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const swayingDetail = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: string,
        phase: number,
        restZ = 0,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        root.rotation.z = restZ;
        const mesh = voxel(root, w, h, d, color);
        mesh.geometry.translate(0, h * 0.5 * P, 0);
        parent.add(root);
        ungulate.details.push({ obj: root, restX: 0, restZ, phase });
        return root;
      };

      const trunkY = feature === "bull" ? 11.8
        : feature === "pig" ? 9.4
          : feature === "boar" ? 10.2
            : 10.8;
      const trunk = ungulate.trunk;
      trunk.position.set(0, trunkY * P, 1.5 * P);
      const coreSkin = feature === "sheep" ? (woolSkin ?? rigSkin) : rigSkin;
      const bodyRegion: [number, number, number] = feature === "pig"
        ? [10, 8, 16]
        : feature === "sheep" ? [8, 6, 16] : [12, 10, 18];
      const core = skinned(
        coreSkin,
        style.bodyWidth,
        style.bodyHeight,
        style.bodyLength,
        feature === "sheep" ? style.coat : style.hide,
        feature === "pig" || feature === "sheep" ? 28 : 18,
        feature === "pig" || feature === "sheep" ? 8 : 4,
        bodyRegion,
      );
      trunk.add(core);
      // The core carries atlas texture where available; offset voxel plates make
      // the silhouette read as RuneCraft art instead of a stretched vanilla box.
      voxel(
        trunk,
        style.bodyWidth * 0.82,
        1.15,
        style.bodyLength * 0.8,
        style.coat,
        0,
        style.bodyHeight * 0.5,
        0,
      );
      voxel(
        trunk,
        style.bodyWidth + 0.8,
        style.bodyHeight * 0.54,
        2.7,
        feature === "bull" || feature === "boar" ? style.dark : style.coat,
        0,
        0.35,
        -style.bodyLength * 0.35,
      );
      voxel(
        trunk,
        style.bodyWidth + 0.35,
        style.bodyHeight * 0.42,
        2.4,
        style.accent,
        0,
        -0.25,
        style.bodyLength * 0.38,
      );
      body.add(trunk);

      // Four articulated hoof chains. Every leg has a hip, knee and ankle;
      // paired cloven toes remain planted while the joints stride and compress.
      const upperLength = feature === "bull" ? 4.8
        : feature === "cow" || feature === "sheep" || feature === "mooshroom" ? 4.35 : 3.75;
      const lowerLength = feature === "bull" ? 3.6
        : feature === "cow" || feature === "sheep" || feature === "mooshroom" ? 3.25 : 2.85;
      const legRootY = upperLength + lowerLength + 1.4;
      for (const front of [true, false]) {
        const z = 1.5 + (front ? -style.bodyLength * 0.34 : style.bodyLength * 0.34);
        for (const side of [-1, 1] as const) {
          const upper = new THREE.Group();
          upper.position.set(side * style.bodyWidth * 0.37 * P, legRootY * P, z * P);
          const upperMesh = voxel(
            upper,
            style.limbWidth,
            upperLength,
            style.limbWidth,
            front && (feature === "bull" || feature === "boar") ? style.dark : style.hide,
          );
          upperMesh.geometry.translate(0, -upperLength * 0.5 * P, 0);
          voxel(
            upper,
            style.limbWidth + 0.9,
            1.25,
            style.limbWidth + 0.8,
            style.coat,
            0,
            -0.55,
            0,
          );

          const knee = new THREE.Group();
          knee.position.y = -upperLength * P;
          const lowerMesh = voxel(
            knee,
            style.limbWidth * 0.82,
            lowerLength,
            style.limbWidth * 0.82,
            style.accent,
          );
          lowerMesh.geometry.translate(0, -lowerLength * 0.5 * P, 0);
          voxel(
            knee,
            style.limbWidth + 0.55,
            1.15,
            style.limbWidth + 0.45,
            style.hide,
            0,
            -0.2,
            0,
          );

          const ankle = new THREE.Group();
          ankle.position.y = -lowerLength * P;
          voxel(ankle, style.limbWidth * 0.78, 1.2, style.limbWidth * 0.8, style.dark, 0, -0.45, 0);
          voxel(ankle, style.limbWidth + 0.5, 0.9, style.limbWidth + 1, style.dark, 0, -1.05, -0.45);
          for (const toe of [-1, 1] as const) {
            voxel(
              ankle,
              style.limbWidth * 0.34,
              0.65,
              1.7,
              feature === "sheep" ? "#3d3732" : "#282421",
              toe * style.limbWidth * 0.22,
              -1.4,
              -1.15,
            );
          }
          knee.add(ankle);
          upper.add(knee);
          body.add(upper);

          const diagonal = front
            ? (side === -1 ? 0 : Math.PI)
            : (side === -1 ? Math.PI : 0);
          const restUpperX = front ? 0.035 : -0.045;
          const restKneeX = front ? 0.1 : -0.2;
          const restAnkleX = front ? -0.05 : 0.14;
          upper.rotation.x = restUpperX;
          upper.rotation.z = side * 0.012;
          knee.rotation.x = restKneeX;
          ankle.rotation.x = restAnkleX;
          ungulate.legs.push({
            side,
            front,
            phase: diagonal,
            upper,
            knee,
            ankle,
            restUpperX,
            restUpperZ: side * 0.012,
            restKneeX,
            restAnkleX,
          });
        }
      }

      // A real neck bridge keeps the face attached through grazing and charge
      // poses; the separate jaw supports chewing as well as attack animation.
      const neck = ungulate.neck;
      neck.position.set(0, (trunkY + 0.15) * P, (1.5 - style.bodyLength * 0.43) * P);
      const neckRestX = feature === "pig" || feature === "boar" ? -0.2 : -0.1;
      neck.rotation.x = neckRestX;
      ungulate.neckRestX = neckRestX;
      voxel(
        neck,
        style.bodyWidth * (feature === "bull" ? 0.92 : 0.7),
        feature === "bull" ? 7.5 : 5.8,
        feature === "bull" ? 7 : 5.5,
        feature === "sheep" ? style.coat : style.hide,
      );
      voxel(
        neck,
        style.bodyWidth * (feature === "bull" ? 1.02 : 0.78),
        1.2,
        feature === "bull" ? 7.4 : 6,
        style.coat,
        0,
        feature === "bull" ? 3.75 : 2.95,
        0.2,
      );
      body.add(neck);

      const head = ungulate.head;
      const headY = trunkY + (feature === "bull" ? 0.15 : feature === "pig" || feature === "boar" ? -0.55 : 0.05);
      const headZ = 1.5 - style.bodyLength * 0.5 - (feature === "boar" ? 1.2 : 1.35);
      head.position.set(0, headY * P, headZ * P);
      const headHeight = feature === "bull" ? 6.8 : feature === "pig" ? 5.4 : 6;
      const skullDepth = feature === "boar" ? 7 : feature === "pig" ? 5.8 : 6.2;
      const skull = skinned(
        rigSkin,
        style.headWidth,
        headHeight,
        skullDepth,
        style.hide,
        0,
        0,
        [feature === "sheep" ? 6 : 8, feature === "pig" ? 8 : 8, feature === "pig" ? 8 : 6],
      );
      skull.position.z = -2.2 * P;
      head.add(skull);
      voxel(head, style.headWidth + 0.55, 1.15, skullDepth * 0.82, style.coat, 0, headHeight * 0.47, -2.25);
      const eyeZ = -2.2 - skullDepth * 0.5 - 0.18;
      for (const side of [-1, 1] as const) {
        glowVoxel(head, 0.9, 0.9, 0.55, style.eye, side * style.headWidth * 0.29, 0.75, eyeZ);
        voxel(head, 1.7, 0.55, 0.6, style.dark, side * style.headWidth * 0.29, 1.45, eyeZ + 0.05);
        const ear = new THREE.Group();
        ear.position.set(side * style.headWidth * 0.49 * P, 2.25 * P, -1.55 * P);
        ear.rotation.z = side * (feature === "pig" ? -0.42 : feature === "boar" ? -0.22 : 0.12);
        const earW = feature === "sheep" || feature === "cow" ? 2.7 : 2.15;
        voxel(ear, earW, feature === "pig" ? 2.5 : 1.8, 1.25, style.hide, side * earW * 0.34, 0, 0);
        voxel(ear, earW * 0.56, 0.65, 0.75, style.accent, side * earW * 0.36, -0.2, -0.4);
        head.add(ear);
      }

      const jaw = ungulate.jaw;
      jaw.position.set(0, -1.45 * P, (-2.35 - skullDepth * 0.35) * P);
      const muzzleLength = feature === "boar" ? 5.6 : feature === "pig" ? 3.7 : 3.3;
      const muzzleWidth = feature === "boar" ? style.headWidth * 0.68
        : feature === "pig" ? style.headWidth * 0.82 : style.headWidth * 0.7;
      voxel(jaw, muzzleWidth, feature === "pig" ? 2.5 : 2.2, muzzleLength, style.accent, 0, -0.65, -muzzleLength * 0.48);
      voxel(jaw, muzzleWidth * 0.88, 0.6, muzzleLength * 0.75, style.dark, 0, -1.7, -muzzleLength * 0.55);
      if (feature === "pig" || feature === "boar") {
        voxel(jaw, muzzleWidth + 0.5, 2.2, 0.8, style.coat, 0, -0.45, -muzzleLength - 0.15);
        for (const side of [-1, 1] as const) {
          voxel(jaw, 0.65, 0.65, 0.45, style.dark, side * muzzleWidth * 0.23, -0.45, -muzzleLength - 0.62);
        }
      }
      head.add(jaw);
      ungulate.headRestX = head.rotation.x;
      ungulate.headRestY = head.position.y;
      ungulate.headRestZ = head.position.z;
      anim.head = head;
      anim.headRestZ = head.position.z;
      body.add(head);

      const buildTail = (
        lengths: number[],
        widths: number[],
        restXs: number[],
        colors: string[],
        tuft?: { w: number; h: number; d: number; color: string },
      ): void => {
        let parent: THREE.Object3D = body;
        for (let i = 0; i < lengths.length; i++) {
          const tail = new THREE.Group();
          if (i === 0) {
            tail.position.set(0, (trunkY + 0.6) * P, (1.5 + style.bodyLength * 0.49) * P);
          } else {
            tail.position.z = lengths[i - 1] * P;
          }
          const mesh = voxel(tail, widths[i], widths[i], lengths[i], colors[i] ?? style.hide);
          mesh.geometry.translate(0, 0, lengths[i] * 0.5 * P);
          const restX = restXs[i] ?? 0;
          tail.rotation.x = restX;
          parent.add(tail);
          ungulate.tail.push({ obj: tail, restX, restY: 0, restZ: 0, phase: i * 0.85 });
          parent = tail;
        }
        if (tuft && ungulate.tail.length > 0) {
          const last = ungulate.tail[ungulate.tail.length - 1].obj;
          voxel(last, tuft.w, tuft.h, tuft.d, tuft.color, 0, 0, lengths[lengths.length - 1] + tuft.d * 0.2);
        }
      };

      switch (feature) {
        case "cow": {
          // Broken hide patches, udder, dewlap, stepped horns and tufted tail.
          for (const [x, y, z, w, h, d] of [
            [-4.45, 0.6, -2.7, 0.75, 4.2, 4.8],
            [4.45, -0.8, 2.6, 0.75, 3.8, 5],
            [-2.4, 4.45, 3.6, 3.7, 0.7, 3],
            [2.1, 4.45, -4.8, 3.2, 0.7, 2.4],
          ] as const) voxel(trunk, w, h, d, style.dark, x, y, z);
          voxel(trunk, 4.5, 1.7, 5, "#d6a4a2", 0, -style.bodyHeight * 0.52, 2.2);
          for (const x of [-1.4, 1.4]) voxel(trunk, 0.75, 1.5, 0.75, "#b97f83", x, -style.bodyHeight * 0.66, 2.6);
          voxel(neck, 4.4, 3.2, 1.5, style.accent, 0, -2.3, -2.5);
          for (const side of [-1, 1] as const) {
            const horn = new THREE.Group();
            horn.position.set(side * style.headWidth * 0.45 * P, 3.1 * P, -1.7 * P);
            horn.rotation.z = side * -0.18;
            voxel(horn, 2.8, 1.2, 1.35, "#c8b891", side * 1.15, 0, 0);
            voxel(horn, 1.1, 2.3, 1, "#e0d4b7", side * 2.25, 0.8, -0.15).rotation.z = side * -0.2;
            head.add(horn);
          }
          buildTail([3.4, 3], [1.35, 1], [0.18, 0.22], [style.hide, style.accent], {
            w: 2.7, h: 2.8, d: 2.2, color: style.dark,
          });
          break;
        }
        case "pig": {
          // Rounded haunch layers and a compact voxel curl distinguish the pig.
          for (const z of [-4.4, -1.6, 1.6, 4.3]) {
            voxel(trunk, style.bodyWidth + 0.65, 1.05, 1.5, z < 0 ? style.coat : style.accent, 0, 1.2, z);
          }
          voxel(trunk, style.bodyWidth + 1.1, 4.7, 3.5, style.coat, 0, 0.2, 4.6);
          voxel(head, style.headWidth + 0.7, 1.25, 4.8, style.coat, 0, 2.1, -2.1);
          buildTail(
            [1.65, 1.45, 1.25, 1],
            [1.2, 1.05, 0.9, 0.75],
            [-0.65, -0.82, -0.82, -0.55],
            [style.accent, style.accent, style.coat, style.coat],
          );
          break;
        }
        case "sheep": {
          // A clustered fleece shell creates a shaggy outline rather than one
          // oversized white cube; the narrow hide face stays plainly visible.
          for (const z of [-5.2, -2.2, 0.8, 3.8, 5.5]) {
            voxel(trunk, style.bodyWidth + 1.7, 2.25, 2.8, style.coat, 0, style.bodyHeight * 0.48, z);
            for (const side of [-1, 1] as const) {
              voxel(trunk, 2.2, 3, 2.6, style.coat, side * (style.bodyWidth * 0.5 + 0.45), 0.5, z);
            }
          }
          for (const [x, z, phase] of [[-3.7, -4.4, 0], [0, -3, 1], [3.7, -0.7, 2], [-2.8, 2.5, 3], [2.8, 4.2, 4]] as const) {
            swayingDetail(trunk, x, style.bodyHeight * 0.5 + 0.2, z, 2.2, 1.8, 2.2, style.coat, phase);
          }
          voxel(head, style.headWidth + 1.4, 2.5, 5.3, style.coat, 0, 2.6, -1.7);
          voxel(neck, style.bodyWidth + 1.1, 5.4, 6.2, style.coat, 0, 0.3, 0.4);
          buildTail([2.4], [2.2], [0.3], [style.coat], {
            w: 3.2, h: 3, d: 2.4, color: style.coat,
          });
          break;
        }
        case "boar": {
          // Low shoulder armor, coarse ridge bristles and paired tusks make the
          // wild boar a separate combat silhouette, not a brown pig recolor.
          voxel(trunk, style.bodyWidth + 2, style.bodyHeight * 0.75, 5.5, style.dark, 0, 1.05, -4.7);
          voxel(trunk, style.bodyWidth + 1.1, 2.1, 8, style.coat, 0, 3.7, -1.4);
          for (let i = 0; i < 7; i++) {
            const z = -5.7 + i * 1.8;
            swayingDetail(trunk, 0, style.bodyHeight * 0.5, z, 0.8, 3.2 - i * 0.16, 1, style.dark, i * 0.55);
          }
          voxel(head, style.headWidth + 1, 2, 5.8, style.dark, 0, 1.9, -2.2);
          for (const side of [-1, 1] as const) {
            const tusk = voxel(jaw, 0.9, 3.4, 0.9, "#ded1ad", side * muzzleWidth * 0.48, -0.15, -muzzleLength * 0.72);
            tusk.rotation.z = side * -0.38;
            voxel(jaw, 0.65, 1.8, 0.65, "#f0e5c9", side * (muzzleWidth * 0.48 + 0.5), 1.05, -muzzleLength * 0.78).rotation.z = side * -0.55;
          }
          buildTail([2.5, 1.8], [1.45, 1.05], [0.25, 0.28], [style.hide, style.dark], {
            w: 2.2, h: 2, d: 1.8, color: style.dark,
          });
          break;
        }
        case "bull": {
          // Monumental shoulder hump, chest mane and wide stepped horns carry
          // the prairie bull's boss weight without scaling up the cow rig.
          voxel(trunk, style.bodyWidth + 2.5, style.bodyHeight * 0.88, 6.6, style.dark, 0, 1.8, -4.7);
          voxel(trunk, style.bodyWidth + 1.4, 3.6, 8, style.coat, 0, 5, -3.3);
          voxel(neck, style.bodyWidth + 3.1, 7.8, 7.4, style.dark, 0, -0.2, 0.5);
          for (const x of [-4.2, -2.1, 0, 2.1, 4.2]) {
            swayingDetail(neck, x, -3.4, -2, 1.25, 4.6 - Math.abs(x) * 0.22, 1.2, style.coat, x * 0.4);
          }
          voxel(head, style.headWidth + 1.8, 2.2, 6.4, style.dark, 0, 2.15, -2.2);
          voxel(head, 3.5, 3, 0.85, style.accent, 0, 0.4, eyeZ - 0.2);
          for (const side of [-1, 1] as const) {
            const hornRoot = new THREE.Group();
            hornRoot.position.set(side * style.headWidth * 0.43 * P, 3.05 * P, -1.55 * P);
            hornRoot.rotation.z = side * 0.12;
            voxel(hornRoot, 4.1, 1.9, 1.8, "#a98d62", side * 1.85, 0, 0);
            const mid = new THREE.Group();
            mid.position.set(side * 3.7 * P, 0, -0.25 * P);
            mid.rotation.z = side * -0.27;
            voxel(mid, 3.3, 1.35, 1.35, "#c9b17f", side * 1.4, 0.2, -0.15);
            const tip = new THREE.Group();
            tip.position.set(side * 2.75 * P, 0.45 * P, -0.15 * P);
            tip.rotation.z = side * -0.38;
            voxel(tip, 2.25, 0.8, 0.85, "#eadcb7", side * 0.95, 0.35, -0.2);
            mid.add(tip);
            hornRoot.add(mid);
            head.add(hornRoot);
          }
          for (const leg of ungulate.legs) {
            voxel(leg.ankle, style.limbWidth + 1.3, 1.3, style.limbWidth + 1.8, style.dark, 0, -0.25, 0);
          }
          buildTail([3.8, 3.1], [1.65, 1.15], [0.18, 0.23], [style.hide, style.accent], {
            w: 3.1, h: 3.4, d: 2.5, color: style.dark,
          });
          break;
        }
        case "mooshroom": {
          // Layered fungal hide, shelf caps and crown growths make this a
          // RuneCraft spore-beast rather than a red cow with mushrooms pasted on.
          for (const [x, y, z, w, h, d] of [
            [-5.1, 0.5, -3.7, 0.8, 4.5, 4.2],
            [5.1, -0.7, 2.5, 0.8, 4.1, 5],
            [-2.6, 4.8, 3.2, 3.4, 0.8, 3.1],
            [2.5, 4.8, -4.2, 3.8, 0.8, 2.8],
          ] as const) voxel(trunk, w, h, d, style.coat, x, y, z);
          const mushroom = (
            parent: THREE.Object3D,
            x: number,
            y: number,
            z: number,
            size: number,
            phase: number,
          ): void => {
            const stem = swayingDetail(parent, x, y, z, size * 0.42, size, size * 0.42, style.coat, phase);
            voxel(stem, size * 1.9, size * 0.48, size * 1.65, style.accent, 0, size * 1.05, 0);
            voxel(stem, size * 1.2, size * 0.3, size * 1.05, "#d98568", 0, size * 1.42, 0);
          };
          mushroom(trunk, -3.2, style.bodyHeight * 0.5, -3.6, 2.7, 0);
          mushroom(trunk, 2.7, style.bodyHeight * 0.5, 0.1, 3.2, 1.2);
          mushroom(trunk, -1.4, style.bodyHeight * 0.5, 4.4, 2.2, 2.4);
          mushroom(head, 1.4, 3.1, -0.8, 2.4, 3.1);
          for (const side of [-1, 1] as const) {
            const horn = new THREE.Group();
            horn.position.set(side * style.headWidth * 0.44 * P, 3 * P, -1.6 * P);
            horn.rotation.z = side * -0.16;
            voxel(horn, 2.6, 1.25, 1.3, style.coat, side * 1.05, 0, 0);
            voxel(horn, 1, 2.1, 1, "#eadbb8", side * 2.05, 0.7, -0.1).rotation.z = side * -0.22;
            head.add(horn);
          }
          voxel(neck, 5, 3.4, 1.5, style.dark, 0, -2.2, -2.5);
          buildTail([3.5, 2.8], [1.4, 1], [0.18, 0.24], [style.hide, style.accent], {
            w: 2.8, h: 3, d: 2.2, color: style.coat,
          });
          break;
        }
      }

      const barPixels = feature === "bull" ? 26
        : feature === "mooshroom" ? 24
          : feature === "cow" || feature === "sheep" ? 22
          : feature === "boar" ? 21 : 19;
      return { barHeight: barPixels * P + 0.3, anim };
    }
    if (raiderStyle) {
      const style = raiderStyle;
      const feature = style.feature;
      const raider: RaiderAnim = {
        role: style.role,
        legs: [],
        arms: [],
        torso: new THREE.Group(),
        head: new THREE.Group(),
        headRestX: 0,
        headRestZ: 0,
        props: [],
        focus: null,
        dummyPivot: null,
        details: [],
      };
      anim.raider = raider;

      const voxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = box(w, h, d, color);
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glowVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshBasicMaterial({ color }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const swayingDetail = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: string,
        phase: number,
        restZ = 0,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        root.rotation.z = restZ;
        const mesh = voxel(root, w, h, d, color);
        mesh.geometry.translate(0, h * 0.5 * P, 0);
        parent.add(root);
        raider.details.push({ obj: root, restX: 0, restZ, phase });
        return root;
      };
      const heldProp = (
        parent: THREE.Object3D,
        kind: RaiderPropAnim["kind"],
        phase: number,
        restX = 0,
        restY = 0,
        restZ = 0,
      ): THREE.Group => {
        const prop = new THREE.Group();
        prop.rotation.set(restX, restY, restZ);
        parent.add(prop);
        raider.props.push({ obj: prop, kind, phase, restX, restY, restZ });
        return prop;
      };

      const upperLegLength = feature === "reaver" || feature === "effigy" ? 6.5 : 6.1;
      const lowerLegLength = feature === "reaver" ? 5.5 : 5.2;
      const legRootY = upperLegLength + lowerLegLength + 1.65;
      const torsoY = legRootY + style.torsoHeight * 0.48;

      // Split hip/knee/foot chains give the raiders grounded strides and let
      // the training effigy flex on its lashings instead of sliding as a cube.
      for (const side of [-1, 1] as const) {
        const hip = new THREE.Group();
        hip.position.set(side * style.torsoWidth * 0.24 * P, legRootY * P, 0.6 * P);
        const thigh = voxel(
          hip,
          style.legWidth,
          upperLegLength,
          style.legWidth + 0.25,
          feature === "effigy" ? style.skin : style.cloth,
        );
        thigh.geometry.translate(0, -upperLegLength * 0.5 * P, 0);
        voxel(hip, style.legWidth + 0.7, 1.25, style.legWidth + 0.65, style.dark, 0, -0.55, 0);

        const knee = new THREE.Group();
        knee.position.y = -upperLegLength * P;
        const shin = voxel(
          knee,
          style.legWidth * 0.9,
          lowerLegLength,
          style.legWidth * 0.92,
          feature === "effigy" ? style.cloth : style.dark,
        );
        shin.geometry.translate(0, -lowerLegLength * 0.5 * P, 0);
        voxel(knee, style.legWidth + 0.55, 1.4, style.legWidth + 0.6, style.metal, 0, -0.25, -0.2);

        const foot = new THREE.Group();
        foot.position.y = -lowerLegLength * P;
        voxel(foot, style.legWidth + 0.8, 1.7, style.legWidth + 2.2, style.dark, 0, -0.7, -0.95);
        voxel(foot, style.legWidth + 0.45, 0.6, style.legWidth + 1.4, style.metal, 0, -1.45, -1.35);
        knee.add(foot);
        hip.add(knee);
        body.add(hip);

        const restHipX = side === -1 ? 0.025 : -0.025;
        const restHipZ = side * 0.012;
        const restKneeX = -0.08;
        const restFootX = 0.06;
        hip.rotation.x = restHipX;
        hip.rotation.z = restHipZ;
        knee.rotation.x = restKneeX;
        foot.rotation.x = restFootX;
        raider.legs.push({
          side,
          phase: side === -1 ? 0 : Math.PI,
          hip,
          knee,
          foot,
          restHipX,
          restHipZ,
          restKneeX,
          restFootX,
        });
      }

      const torso = raider.torso;
      torso.position.set(0, torsoY * P, 0.55 * P);
      voxel(torso, style.torsoWidth, style.torsoHeight, 5.2, style.cloth);
      voxel(torso, style.shoulderWidth, 2.3, 6, style.dark, 0, style.torsoHeight * 0.38, 0);
      voxel(torso, style.torsoWidth + 0.7, 2, 5.8, style.accent, 0, -style.torsoHeight * 0.38, 0.1);
      voxel(torso, style.torsoWidth + 1.2, 1.2, 6.1, style.metal, 0, -style.torsoHeight * 0.15, 0);
      voxel(torso, style.torsoWidth * 0.62, style.torsoHeight * 0.48, 0.75, style.dark, 0, 0.6, -2.95);
      body.add(torso);

      const upperArmLength = feature === "reaver" ? 6 : 5.5;
      const lowerArmLength = feature === "reaver" ? 5 : 4.7;
      for (const side of [-1, 1] as const) {
        const shoulder = new THREE.Group();
        shoulder.position.set(
          side * style.shoulderWidth * 0.49 * P,
          (torsoY + style.torsoHeight * 0.4) * P,
          0.4 * P,
        );
        const sleeve = voxel(
          shoulder,
          feature === "reaver" ? 4.4 : 3.7,
          upperArmLength,
          feature === "reaver" ? 4.2 : 3.6,
          feature === "effigy" ? style.skin : style.cloth,
        );
        sleeve.geometry.translate(0, -upperArmLength * 0.5 * P, 0);
        voxel(
          shoulder,
          feature === "reaver" ? 5.3 : 4.5,
          2,
          4.6,
          feature === "effigy" ? style.dark : style.metal,
          0,
          -0.6,
          0,
        );

        const elbow = new THREE.Group();
        elbow.position.y = -upperArmLength * P;
        const forearm = voxel(
          elbow,
          feature === "reaver" ? 3.8 : 3.25,
          lowerArmLength,
          feature === "reaver" ? 3.7 : 3.2,
          feature === "effigy" ? style.cloth : style.dark,
        );
        forearm.geometry.translate(0, -lowerArmLength * 0.5 * P, 0);
        voxel(elbow, 4, 1.35, 3.9, style.accent, 0, -0.25, -0.15);

        const hand = new THREE.Group();
        hand.position.y = -lowerArmLength * P;
        voxel(hand, 3.1, 2.7, 3, feature === "effigy" ? style.skin : style.skin, 0, -1, -0.15);
        voxel(hand, 3.4, 0.7, 3.3, style.dark, 0, -0.05, 0);
        elbow.add(hand);
        shoulder.add(elbow);
        body.add(shoulder);

        const restShoulderX = style.role === "ranged" ? 0.15 : style.role === "caster" ? 0.08 : 0.02;
        const restShoulderZ = feature === "effigy" ? side * 1.28 : side * 0.035;
        const restElbowX = style.role === "ranged" ? 0.35 : -0.08;
        const restElbowZ = feature === "effigy" ? side * 0.08 : 0;
        shoulder.rotation.x = restShoulderX;
        shoulder.rotation.z = restShoulderZ;
        elbow.rotation.x = restElbowX;
        elbow.rotation.z = restElbowZ;
        raider.arms.push({
          side,
          phase: side === -1 ? Math.PI : 0,
          shoulder,
          elbow,
          hand,
          restShoulderX,
          restShoulderZ,
          restElbowX,
          restElbowZ,
        });
      }

      const head = raider.head;
      const headY = torsoY + style.torsoHeight * 0.5 + 3.9;
      head.position.set(0, headY * P, -0.25 * P);
      voxel(head, style.headWidth, 6.7, 6.1, feature === "effigy" ? style.skin : style.skin);
      voxel(head, style.headWidth + 0.5, 1.2, 6.5, style.dark, 0, 2.8, 0);
      voxel(head, style.headWidth * 0.72, 1.7, 0.75, style.accent, 0, -1.85, -3.35);
      if (feature !== "effigy") {
        for (const side of [-1, 1] as const) {
          glowVoxel(head, 0.85, 0.7, 0.5, style.glow, side * style.headWidth * 0.22, 0.65, -3.35);
          voxel(head, 1.45, 0.45, 0.55, style.dark, side * style.headWidth * 0.22, 1.25, -3.32);
        }
      }
      voxel(head, 1.5, 2.3, 1.25, style.skin, 0, -0.25, -3.45);
      raider.headRestX = head.rotation.x;
      raider.headRestZ = head.rotation.z;
      anim.head = head;
      anim.headRestZ = head.position.z;
      body.add(head);

      const leftHand = raider.arms.find((arm) => arm.side === -1)!.hand;
      const rightHand = raider.arms.find((arm) => arm.side === 1)!.hand;

      switch (feature) {
        case "marksman": {
          // Hooded scout armor and a stock/limb/string crossbow held on its own
          // pivot, allowing aim, recoil and walk-settle poses.
          voxel(torso, style.torsoWidth + 1.4, 7.2, 1.1, style.accent, 0, 0.8, -3.1);
          voxel(torso, 2.1, 8.5, 1, style.metal, -style.torsoWidth * 0.28, 0.5, -3.7).rotation.z = -0.2;
          voxel(head, style.headWidth + 1.5, 3.6, 6.9, style.cloth, 0, 2.45, 0.25);
          voxel(head, style.headWidth + 0.7, 2.1, 0.9, style.dark, 0, -1.2, -3.55);
          for (const side of [-1, 1] as const) {
            voxel(head, 2, 2.3, 1.7, style.metal, side * style.headWidth * 0.48, 0.2, -0.25);
          }
          const crossbow = heldProp(rightHand, "weapon", 0, -0.08, 0, 0.05);
          crossbow.position.set(-3.6 * P, -0.4 * P, -0.5 * P);
          voxel(crossbow, 1.4, 1.5, 8, style.accent, 0, 0, -3.1);
          voxel(crossbow, 9.2, 1.25, 1.3, style.metal, 0, 0.2, -6.2);
          voxel(crossbow, 6.8, 0.55, 0.65, style.glow, 0, 0.2, -5.75);
          for (const side of [-1, 1] as const) {
            const limb = voxel(crossbow, 1.2, 1, 4.1, style.accent, side * 4.2, 0.2, -4.7);
            limb.rotation.y = side * 0.52;
            voxel(crossbow, 0.45, 0.45, 6.4, style.glow, side * 2, 0.45, -4.9).rotation.y = side * -0.34;
          }
          voxel(crossbow, 0.55, 0.55, 5.8, style.glow, 0, 0.55, -8.2);
          break;
        }
        case "reaver": {
          // Broad plate shoulders, a tusked mask and oversized two-step axe.
          voxel(torso, style.torsoWidth + 2.2, 7.4, 1.2, style.metal, 0, 1, -3.15);
          for (const side of [-1, 1] as const) {
            voxel(torso, 3.4, 5.4, 6.7, style.dark, side * style.torsoWidth * 0.52, 2.6, 0);
            const spike = voxel(torso, 1.1, 3.4, 1.2, style.metal, side * style.torsoWidth * 0.64, 6.2, 0);
            spike.rotation.z = side * -0.35;
          }
          voxel(head, style.headWidth + 1.4, 4.2, 1.1, style.metal, 0, -0.1, -3.55);
          voxel(head, 5.4, 1.3, 0.7, style.dark, 0, 1.15, -4.15);
          for (const side of [-1, 1] as const) {
            voxel(head, 0.85, 2.7, 0.85, "#d6c7a5", side * 2.8, -2, -3.75).rotation.z = side * -0.3;
          }
          const axe = heldProp(rightHand, "weapon", 0, 0.04, 0, -0.08);
          axe.position.set(0, -0.6 * P, 0);
          voxel(axe, 1.25, 10.5, 1.25, style.accent, 0, 4.3, 0);
          voxel(axe, 7.8, 4.6, 1.8, style.metal, -2.4, 9.1, -0.2);
          voxel(axe, 4.5, 2.7, 2.1, style.dark, 2.2, 9.2, -0.2);
          voxel(axe, 1, 5.5, 0.9, style.glow, -5.5, 9.1, -1.2).rotation.z = 0.18;
          break;
        }
        case "runecaller": {
          // Split ceremonial robe, rune crown, floating tome and paired foci.
          voxel(torso, style.torsoWidth + 2, 7.8, 1.1, style.cloth, 0, 0.3, -3.1);
          for (const side of [-1, 1] as const) {
            const skirt = swayingDetail(
              torso,
              side * style.torsoWidth * 0.28,
              -style.torsoHeight * 0.48,
              0.2,
              style.torsoWidth * 0.48,
              6.3,
              5.7,
              side === -1 ? style.cloth : style.accent,
              side,
              side * 0.025,
            );
            voxel(skirt, 1.1, 4.8, 0.7, style.glow, 0, 3.3, -3.2);
          }
          voxel(head, style.headWidth + 1.1, 2.7, 6.9, style.dark, 0, 2.5, 0);
          for (const [x, h] of [[-2.6, 3.1], [0, 4.4], [2.6, 3.1]] as const) {
            voxel(head, 1.25, h, 1.25, style.metal, x, 4 + h * 0.5, 0);
            glowVoxel(head, 0.65, 0.65, 1.35, style.glow, x, 4 + h, -0.2);
          }
          for (const [hand, side] of [[leftHand, -1], [rightHand, 1]] as const) {
            const focus = heldProp(hand, "focus", side, -0.12, 0, side * 0.08);
            focus.position.set(0, -2.6 * P, -1.2 * P);
            voxel(focus, 4.2, 0.65, 4.2, style.metal);
            voxel(focus, 0.65, 4.2, 4.2, style.metal);
            const core = glowVoxel(focus, 1.8, 1.8, 1.8, style.glow, 0, 0, -0.2);
            if (!raider.focus) raider.focus = core;
          }
          const tome = heldProp(torso, "focus", 2.4, -0.16, 0, 0);
          tome.position.set(0, -0.5 * P, -5.2 * P);
          voxel(tome, 5.8, 0.9, 4.4, style.dark);
          voxel(tome, 2.55, 0.55, 3.7, style.cloth, -1.55, -0.65, 0);
          voxel(tome, 2.55, 0.55, 3.7, style.cloth, 1.55, -0.65, 0);
          glowVoxel(tome, 0.55, 0.65, 2.6, style.glow, 0, -1, -0.25);
          break;
        }
        case "mirage": {
          // Deep stepped hood, faceted mask, asymmetrical mantle and prism staff.
          voxel(torso, style.torsoWidth + 2.5, 5.6, 1.05, style.accent, 0, 2.1, -3.1);
          voxel(torso, 3.2, 10, 6.2, style.dark, -style.torsoWidth * 0.42, 0, 0.2);
          for (const side of [-1, 1] as const) {
            swayingDetail(torso, side * 4.3, -3.8, 1, 2.8, 6.2, 0.8, style.cloth, side * 1.7, side * 0.05);
          }
          voxel(head, style.headWidth + 2.2, 4.8, 7.2, style.dark, 0, 2.2, 0.4);
          voxel(head, style.headWidth - 0.8, 4.7, 0.9, style.accent, 0, -0.2, -3.65);
          glowVoxel(head, style.headWidth - 2.1, 0.7, 0.55, style.glow, 0, 0.85, -4.2);
          for (const side of [-1, 1] as const) {
            const prism = swayingDetail(head, side * 4.7, 1.8, 0, 1.1, 2.8, 1.1, style.glow, side * 2.3);
            prism.rotation.y = side * 0.35;
          }
          const staff = heldProp(rightHand, "weapon", 0.5, -0.04, 0, 0.06);
          staff.position.set(0, -1.2 * P, 0.2 * P);
          voxel(staff, 1.1, 12.5, 1.1, style.metal, 0, 4.7, 0);
          voxel(staff, 4.2, 1.1, 1.1, style.accent, 0, 10.5, 0);
          glowVoxel(staff, 2.8, 3.6, 2.8, style.glow, 0, 12.4, 0);
          voxel(staff, 1.1, 4.8, 1.1, style.dark, 0, 12.6, 0).rotation.z = Math.PI / 4;
          raider.focus = glowVoxel(staff, 1.25, 1.25, 3.6, "#d8f5ff", 0, 12.4, 0);
          const cards = heldProp(leftHand, "focus", 2.1, 0, 0, -0.15);
          for (const [x, y, z] of [[-1.8, -1.5, -1], [0, -2.6, -2], [1.8, -1.4, -1]] as const) {
            const card = voxel(cards, 1.8, 2.8, 0.45, style.glow, x, y, z);
            card.rotation.z = x * 0.14;
          }
          break;
        }
        case "hedgewitch": {
          // Layered herb robe, crooked broad hat, potion hand and root staff.
          voxel(torso, style.torsoWidth + 2.1, 8.4, 1.1, style.cloth, 0, -0.2, -3.1);
          for (const side of [-1, 1] as const) {
            const skirt = swayingDetail(
              torso,
              side * style.torsoWidth * 0.27,
              -style.torsoHeight * 0.5,
              0.2,
              style.torsoWidth * 0.54,
              6.8,
              6,
              side === -1 ? style.dark : style.cloth,
              side * 1.3,
              side * 0.04,
            );
            voxel(skirt, 1, 3.8, 0.75, style.accent, 0, 3.1, -3.4);
          }
          voxel(head, 13.5, 1.5, 11.2, style.dark, 0, 3.55, 0);
          voxel(head, 8.4, 4.3, 7.1, style.cloth, 0, 5.5, 0.25);
          const hatTop = voxel(head, 5.7, 5.2, 5.2, style.dark, 1, 9.2, 0.35);
          hatTop.rotation.z = -0.2;
          voxel(head, 3.2, 3.4, 3.4, style.cloth, 2.1, 12.8, 0.5).rotation.z = -0.38;
          for (const x of [-4.5, 0, 4.5]) {
            swayingDetail(head, x, 3.8, 1.6, 0.65, 3.2 + Math.abs(x) * 0.12, 0.65, style.accent, x);
          }
          const staff = heldProp(rightHand, "weapon", 0.2, 0, 0, 0.08);
          staff.position.set(0, -1.3 * P, 0.2 * P);
          voxel(staff, 1.25, 12.8, 1.25, style.accent, 0, 4.9, 0);
          voxel(staff, 5.2, 1.25, 1.25, style.dark, 1.7, 10.7, 0).rotation.z = -0.3;
          voxel(staff, 1.2, 4.8, 1.2, style.accent, 4, 12.1, 0).rotation.z = -0.55;
          glowVoxel(staff, 2.4, 2.4, 2.4, style.glow, 4.7, 14.3, 0);
          const vial = heldProp(leftHand, "focus", 1.8, 0, 0, -0.1);
          vial.position.set(0, -2.4 * P, -1 * P);
          voxel(vial, 1.4, 1.6, 1.4, style.metal, 0, 1.7, 0);
          const brew = glowVoxel(vial, 3.1, 3.4, 2.8, style.glow, 0, -0.7, 0);
          voxel(vial, 3.7, 0.7, 3.4, style.dark, 0, -2.5, 0);
          raider.focus = brew;
          break;
        }
        case "effigy": {
          // Humanoid straw construction with lashings, sack head and concentric
          // target plates. It bends at the post and limb knots when struck.
          raider.dummyPivot = torso;
          voxel(torso, style.torsoWidth + 2.4, style.torsoHeight + 1.3, 6.3, style.skin);
          for (const y of [-3.8, 0, 3.8]) {
            voxel(torso, style.torsoWidth + 3, 0.8, 6.8, style.dark, 0, y, 0);
          }
          for (const [size, color, z] of [
            [8.8, "#eee0b7", -3.4],
            [6.2, style.accent, -3.85],
            [3.7, "#eee0b7", -4.3],
            [1.6, style.accent, -4.75],
          ] as const) voxel(torso, size, size, 0.65, color, 0, 0.3, z);
          voxel(head, style.headWidth + 1.4, 7.4, 6.8, style.skin);
          voxel(head, style.headWidth + 2, 1, 7.2, style.dark, 0, -2.9, 0);
          for (const side of [-1, 1] as const) {
            voxel(head, 1.5, 0.65, 0.6, style.dark, side * 1.8, 0.9, -3.7).rotation.z = side * 0.22;
          }
          voxel(head, 3.8, 0.55, 0.6, style.dark, 0, -1.1, -3.72);
          for (const x of [-2.7, -0.9, 0.9, 2.7]) {
            swayingDetail(head, x, 3.4, 0, 0.7, 3.6 + Math.abs(x) * 0.2, 0.7, style.glow, x);
          }
          voxel(body, 3.4, 13.5, 3.4, style.dark, 0, 6.6, 2.7);
          voxel(body, 10.5, 1.3, 8.5, style.metal, 0, 0.65, 2.7);
          break;
        }
      }

      const barPixels = feature === "hedgewitch" ? 46
        : feature === "runecaller" || feature === "mirage" ? 35
          : feature === "effigy" ? 33 : 32;
      return { barHeight: barPixels * P + 0.3, anim };
    }
    if (flierStyle) {
      const style = flierStyle;
      const feature = style.feature;
      const coreY = feature === "rune_allay" ? 13.5
        : feature === "storm_ghast" ? 11
          : feature === "reef_squid" ? 8 : 10.5;
      const flier: FlierAnim = {
        feature,
        motion: style.motion,
        core: new THREE.Group(),
        coreRestY: coreY * P,
        head: new THREE.Group(),
        mouth: null,
        headRestX: 0,
        headRestZ: 0,
        wings: [],
        appendages: [],
        fins: [],
        details: [],
      };
      anim.flier = flier;

      const voxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = box(w, h, d, color);
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glowVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshBasicMaterial({ color }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glassVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        opacity: number,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: false }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const swayingDetail = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: string,
        phase: number,
        restZ = 0,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        root.rotation.z = restZ;
        const mesh = voxel(root, w, h, d, color);
        mesh.geometry.translate(0, h * 0.5 * P, 0);
        parent.add(root);
        flier.details.push({ obj: root, restX: 0, restZ, phase });
        return root;
      };
      const buildWing = (
        parent: THREE.Object3D,
        side: -1 | 1,
        pair: number,
        y: number,
        z: number,
        lengths: [number, number, number],
        heights: [number, number, number],
        translucent: boolean,
        restX: number,
        restY: number,
        restZ: number,
      ): void => {
        const root = new THREE.Group();
        root.position.set(side * style.bodyWidth * 0.43 * P, y * P, z * P);
        root.rotation.set(restX, restY, restZ);
        if (translucent) {
          glassVoxel(root, lengths[0], heights[0], 0.75, style.membrane, 0.62, side * lengths[0] * 0.5, 0, 0);
        } else {
          voxel(root, lengths[0], heights[0], 0.9, style.membrane, side * lengths[0] * 0.5, 0, 0);
        }
        voxel(root, lengths[0] + 0.4, 0.7, 0.8, style.dark, side * lengths[0] * 0.5, heights[0] * 0.42, 0);

        const mid = new THREE.Group();
        mid.position.x = side * lengths[0] * P;
        const restMidX = pair === 0 ? -0.02 : 0.04;
        const restMidY = side * (pair === 0 ? -0.08 : 0.06);
        const restMidZ = side * (translucent ? -0.08 : 0.12);
        mid.rotation.set(restMidX, restMidY, restMidZ);
        if (translucent) {
          glassVoxel(mid, lengths[1], heights[1], 0.65, style.membrane, 0.55, side * lengths[1] * 0.5, -0.15, 0);
        } else {
          voxel(mid, lengths[1], heights[1], 0.8, style.membrane, side * lengths[1] * 0.5, -0.15, 0);
        }
        voxel(mid, lengths[1] + 0.3, 0.6, 0.7, style.dark, side * lengths[1] * 0.5, heights[1] * 0.38, 0);

        const tip = new THREE.Group();
        tip.position.x = side * lengths[1] * P;
        const restTipX = pair === 0 ? 0.03 : -0.04;
        const restTipY = side * (pair === 0 ? -0.12 : 0.1);
        const restTipZ = side * (translucent ? -0.1 : 0.16);
        tip.rotation.set(restTipX, restTipY, restTipZ);
        if (translucent) {
          glassVoxel(tip, lengths[2], heights[2], 0.55, style.membrane, 0.48, side * lengths[2] * 0.5, -0.25, 0);
        } else {
          voxel(tip, lengths[2], heights[2], 0.7, style.membrane, side * lengths[2] * 0.5, -0.25, 0);
        }
        voxel(tip, lengths[2] + 0.2, 0.5, 0.65, style.dark, side * lengths[2] * 0.5, heights[2] * 0.34, 0);
        mid.add(tip);
        root.add(mid);
        parent.add(root);
        flier.wings.push({
          side,
          pair,
          phase: pair * 0.75,
          root,
          mid,
          tip,
          restRootX: restX,
          restRootY: restY,
          restRootZ: restZ,
          restMidX,
          restMidY,
          restMidZ,
          restTipX,
          restTipY,
          restTipZ,
        });
      };
      const buildAppendage = (
        parent: THREE.Object3D,
        index: number,
        x: number,
        y: number,
        z: number,
        lengths: [number, number, number],
        width: number,
        color: string,
        restRootX: number,
        restRootZ: number,
      ): void => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        root.rotation.set(restRootX, 0, restRootZ);
        const upper = voxel(root, width, lengths[0], width, color, 0, -lengths[0] * 0.5, 0);
        upper.rotation.y = (index % 2 === 0 ? 1 : -1) * 0.04;
        voxel(root, width + 0.65, 0.8, width + 0.65, style.accent, 0, -0.2, 0);

        const mid = new THREE.Group();
        mid.position.y = -lengths[0] * P;
        const restMidX = Math.sin(index * 1.7) * 0.08;
        const restMidZ = Math.cos(index * 1.3) * 0.07;
        mid.rotation.set(restMidX, 0, restMidZ);
        voxel(mid, width * 0.82, lengths[1], width * 0.82, style.membrane, 0, -lengths[1] * 0.5, 0);
        voxel(mid, width + 0.35, 0.65, width + 0.35, style.dark, 0, -0.15, 0);

        const tip = new THREE.Group();
        tip.position.y = -lengths[1] * P;
        const restTipX = Math.cos(index * 1.15) * 0.11;
        const restTipZ = Math.sin(index * 1.45) * 0.1;
        tip.rotation.set(restTipX, 0, restTipZ);
        voxel(tip, width * 0.62, lengths[2], width * 0.62, color, 0, -lengths[2] * 0.5, 0);
        voxel(tip, width * 0.9, 0.55, width * 0.9, style.dark, 0, -lengths[2], 0);
        mid.add(tip);
        root.add(mid);
        parent.add(root);
        flier.appendages.push({
          index,
          root,
          mid,
          tip,
          restRootX,
          restRootZ,
          restMidX,
          restMidZ,
          restTipX,
          restTipZ,
        });
      };
      const buildFin = (
        parent: THREE.Object3D,
        side: -1 | 1,
        x: number,
        y: number,
        z: number,
        length: number,
        height: number,
        restX: number,
        restY: number,
        restZ: number,
      ): void => {
        const root = new THREE.Group();
        root.position.set(side * x * P, y * P, z * P);
        root.rotation.set(restX, restY, restZ);
        voxel(root, length, height, 1, style.membrane, side * length * 0.5, 0, 0);
        voxel(root, length + 0.4, 0.65, 1.2, style.dark, side * length * 0.5, height * 0.4, 0);
        parent.add(root);
        flier.fins.push({ side, root, restX, restY, restZ });
      };

      const core = flier.core;
      core.position.y = flier.coreRestY;
      body.add(core);
      const head = flier.head;

      switch (feature) {
        case "cave_bat": {
          // Layered ribbed body, broad three-section wings, talons and a fanged face.
          voxel(core, style.bodyWidth, style.bodyHeight, style.bodyLength, style.body);
          voxel(core, style.bodyWidth + 1.1, 2.2, style.bodyLength * 0.74, style.dark, 0, 1.6, 0.2);
          voxel(core, style.bodyWidth * 0.68, 1.1, style.bodyLength + 1, style.accent, 0, -2.3, 0.3);
          for (const z of [-2.5, 0, 2.5]) {
            voxel(core, style.bodyWidth + 0.8, 0.65, 1, style.dark, 0, 0, z);
          }
          head.position.set(0, 0.5 * P, -5.1 * P);
          voxel(head, 5.4, 4.8, 4.4, style.body);
          voxel(head, 4.6, 1.2, 0.8, style.dark, 0, 1.4, -2.55);
          for (const side of [-1, 1] as const) {
            const ear = new THREE.Group();
            ear.position.set(side * 1.9 * P, 2.1 * P, 0);
            ear.rotation.z = side * -0.18;
            voxel(ear, 1.8, 4.4, 1.5, style.dark, side * 0.45, 1.5, 0);
            voxel(ear, 0.75, 2.8, 0.8, style.accent, side * 0.45, 1.5, -0.5);
            head.add(ear);
            glowVoxel(head, 0.8, 0.8, 0.5, style.glow, side * 1.45, 0.55, -2.45);
            voxel(head, 0.55, 1.5, 0.55, "#e8dfc6", side * 0.9, -2, -2.5);
          }
          const jaw = new THREE.Group();
          jaw.position.set(0, -1.2 * P, -2.1 * P);
          voxel(jaw, 3.8, 1.3, 2.3, style.dark, 0, -0.45, -0.7);
          head.add(jaw);
          flier.mouth = jaw;
          for (const side of [-1, 1] as const) {
            buildWing(core, side, 0, 1, -0.2, [4.8, 4.1, 3.2], [4.2, 3.5, 2.7], false, 0, side * 0.08, side * 0.1);
            buildAppendage(core, side === -1 ? 0 : 1, side * 1.7, -3, 2.4, [2, 1.5, 1.1], 0.9, style.dark, 0.18, side * 0.22);
          }
          break;
        }
        case "rune_allay": {
          // Rune-sprite anatomy with a layered mantle, four glassy wings and
          // twin articulated light ribbons instead of a tiny vanilla fairy box.
          voxel(core, style.bodyWidth, 8.8, style.bodyLength, style.body);
          voxel(core, style.bodyWidth + 1.4, 2.4, style.bodyLength + 1, style.dark, 0, 2.5, 0);
          voxel(core, style.bodyWidth + 2, 1.2, style.bodyLength + 1.2, style.accent, 0, -3.8, 0);
          voxel(core, 2.2, 5.6, 0.7, style.dark, 0, -0.4, -2.75);
          glowVoxel(core, 1.35, 2.8, 0.85, style.glow, 0, -0.2, -3.2);
          head.position.set(0, 7.2 * P, -0.5 * P);
          voxel(head, 6.6, 6, 5.8, style.body);
          voxel(head, 7.5, 1.4, 6.4, style.accent, 0, 2.5, 0);
          voxel(head, 5.5, 1.3, 0.7, style.dark, 0, -1.8, -3.25);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 1, 1, 0.5, style.glow, side * 1.65, 0.5, -3.2);
            voxel(head, 0.8, 2.7, 0.8, style.accent, side * 2.6, 3.7, 0);
            for (const pair of [0, 1] as const) {
              buildWing(
                core,
                side,
                pair,
                pair === 0 ? 2.2 : -0.8,
                pair === 0 ? 1.1 : 1.8,
                pair === 0 ? [4.6, 3.7, 2.8] : [4, 3.2, 2.4],
                pair === 0 ? [2.8, 2.3, 1.8] : [2.5, 2, 1.5],
                true,
                pair === 0 ? -0.08 : 0.1,
                side * (pair === 0 ? 0.25 : -0.22),
                side * (pair === 0 ? 0.08 : -0.04),
              );
            }
            buildAppendage(core, side === -1 ? 0 : 1, side * 1.55, -4.2, 0.7, [3.1, 2.5, 1.8], 0.8, style.body, 0.05, side * 0.05);
          }
          break;
        }
        case "honey_bee": {
          // Segmented abdomen, plated thorax, four jointed wings, six dangling
          // legs, antennae and a proper block stinger.
          voxel(core, style.bodyWidth, style.bodyHeight, style.bodyLength, style.body, 0, 0, 1.2);
          voxel(core, style.bodyWidth + 1.1, style.bodyHeight + 1.2, 4.4, style.dark, 0, 0.2, -2.5);
          for (const [index, z] of [-2.7, 0, 2.8, 5.4].entries()) {
            voxel(core, style.bodyWidth + 0.45, style.bodyHeight + 0.5, 1.3, index % 2 === 0 ? style.accent : style.dark, 0, 0, z);
          }
          voxel(core, 1.4, 1.4, 3.8, style.dark, 0, -0.2, style.bodyLength * 0.63);
          voxel(core, 0.75, 0.75, 2.4, style.glow, 0, -0.2, style.bodyLength * 0.88);
          head.position.set(0, 0.2 * P, -6.2 * P);
          voxel(head, 6.7, 5.5, 5.4, style.dark);
          voxel(head, 5.2, 1.2, 0.75, style.body, 0, -1.6, -3.05);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 1.45, 1.8, 0.6, style.glow, side * 1.8, 0.4, -3);
            const antenna = swayingDetail(head, side * 1.8, 2.6, -1.2, 0.55, 3.7, 0.55, style.dark, side * 1.5, side * -0.16);
            glowVoxel(antenna, 1.1, 1.1, 1.1, style.glow, 0, 3.9, 0);
            for (const pair of [0, 1] as const) {
              buildWing(
                core,
                side,
                pair,
                3,
                pair === 0 ? -1.8 : 2.1,
                pair === 0 ? [4.3, 3.2, 2.1] : [3.7, 2.8, 1.8],
                pair === 0 ? [2.4, 2, 1.5] : [2.1, 1.7, 1.25],
                true,
                pair === 0 ? -0.12 : 0.08,
                side * (pair === 0 ? 0.18 : -0.2),
                side * 0.05,
              );
            }
          }
          let legIndex = 0;
          for (const z of [-3, 0.2, 3.5]) {
            for (const side of [-1, 1] as const) {
              buildAppendage(core, legIndex++, side * 2.8, -2.4, z, [2.2, 1.7, 1.1], 0.75, style.dark, z * 0.035, side * 0.32);
            }
          }
          break;
        }
        case "storm_ghast": {
          // Layered storm-lantern body and mask plates replace the plain cube;
          // nine independently jointed tendrils trail from its underside.
          voxel(core, style.bodyWidth, 10.5, style.bodyLength, style.body, 0, 0.5, 0);
          voxel(core, style.bodyWidth - 3, 4.2, style.bodyLength - 2.5, style.membrane, 0, 7, 0.4);
          voxel(core, style.bodyWidth - 6, 2.4, style.bodyLength - 5, style.dark, 0, 10.1, 0.8);
          voxel(core, style.bodyWidth + 1.2, 2.2, style.bodyLength - 3, style.accent, 0, 3.5, 0);
          for (const side of [-1, 1] as const) {
            voxel(core, 3.5, 8.7, style.bodyLength + 1, style.dark, side * style.bodyWidth * 0.48, 0.9, 0);
            glowVoxel(core, 0.75, 6.5, style.bodyLength * 0.5, style.glow, side * style.bodyWidth * 0.5, 0.8, -2.5);
          }
          head.position.set(0, 1.2 * P, (-style.bodyLength * 0.5 - 0.3) * P);
          voxel(head, 12.5, 8.8, 1.5, style.dark);
          voxel(head, 9.5, 6.7, 1, style.body, 0, 0.2, -1.1);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 2.1, 1.6, 0.7, style.glow, side * 3.1, 1.3, -1.9);
            voxel(head, 3.4, 0.7, 0.8, style.accent, side * 3.1, 2.35, -1.85);
          }
          const mouth = new THREE.Group();
          mouth.position.set(0, -2.3 * P, -1.3 * P);
          voxel(mouth, 4.8, 2.4, 1.1, style.glow, 0, -0.8, -0.6);
          voxel(mouth, 6.2, 0.75, 1.3, style.dark, 0, 0.3, -0.5);
          voxel(mouth, 6.2, 0.75, 1.3, style.dark, 0, -2, -0.5);
          head.add(mouth);
          flier.mouth = mouth;
          const grid: Array<[number, number]> = [
            [-5.6, -5], [0, -5], [5.6, -5],
            [-5.6, 0], [0, 0], [5.6, 0],
            [-5.6, 5], [0, 5], [5.6, 5],
          ];
          grid.forEach(([x, z], index) => {
            const long = 4.2 + (index % 3) * 0.8 + (index % 2) * 0.5;
            buildAppendage(core, index, x, -4.6, z, [long, long * 0.72, long * 0.52], 1.45, style.body, Math.sin(index) * 0.06, Math.cos(index) * 0.08);
          });
          break;
        }
        case "reef_squid": {
          // Tapered mantle, side fins, eye collar and eight three-link arms make
          // a directional swimmer rather than a vertical vanilla mantle box.
          voxel(core, 10.8, 11.8, 9.5, style.body, 0, 2.2, 1.5);
          voxel(core, 8.6, 5.2, 8, style.membrane, 0, 9.5, 2.1);
          voxel(core, 5.8, 2.5, 6, style.accent, 0, 13, 2.4);
          voxel(core, style.bodyWidth, 5.3, style.bodyLength, style.dark, 0, -4, -0.2);
          voxel(core, style.bodyWidth - 1.4, 2.2, style.bodyLength + 0.9, style.membrane, 0, -1.6, 0);
          head.position.set(0, -3.4 * P, (-style.bodyLength * 0.5 - 0.25) * P);
          voxel(head, 9.6, 4.8, 2.2, style.body);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 2.1, 1.8, 0.75, style.glow, side * 3, 0.8, -1.5);
            voxel(head, 3.2, 0.6, 0.8, style.dark, side * 3, 1.9, -1.35);
            buildFin(core, side, 5.1, 6.5, 3.6, 5.8, 4.3, -0.04, side * 0.18, side * 0.08);
          }
          const beak = new THREE.Group();
          beak.position.set(0, -2.3 * P, -0.8 * P);
          voxel(beak, 2.5, 1.8, 2.8, style.dark, 0, -0.7, -0.9);
          voxel(beak, 1.2, 0.9, 1.5, style.glow, 0, -1.8, -2.1);
          head.add(beak);
          flier.mouth = beak;
          for (let index = 0; index < 8; index++) {
            const angle = (index / 8) * Math.PI * 2;
            const x = Math.cos(angle) * 4.7;
            const z = Math.sin(angle) * 4.3;
            buildAppendage(
              core,
              index,
              x,
              -6.1,
              z,
              [4.2 + (index % 2) * 0.8, 3.4 + (index % 3) * 0.35, 2.6],
              1.15,
              index % 2 === 0 ? style.body : style.accent,
              Math.sin(angle) * 0.18,
              Math.cos(angle) * 0.18,
            );
          }
          break;
        }
      }

      flier.headRestX = head.rotation.x;
      flier.headRestZ = head.position.z;
      anim.head = head;
      anim.headRestZ = head.position.z;
      core.add(head);
      const barPixels = feature === "storm_ghast" ? 24
        : feature === "reef_squid" ? 25
          : feature === "rune_allay" ? 27 : 20;
      return { barHeight: barPixels * P + (feature === "storm_ghast" ? 0.55 : 0.32), anim };
    }
    if (signatureStyle) {
      const style = signatureStyle;
      const feature = style.feature;
      const signature: SignatureAnim = {
        feature,
        motion: style.motion,
        core: new THREE.Group(),
        head: new THREE.Group(),
        jaw: null,
        headRestX: 0,
        headRestY: 0,
        headRestZ: 0,
        legs: [],
        wings: [],
        tail: [],
        details: [],
      };
      anim.signature = signature;

      const voxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = box(w, h, d, color);
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const glowVoxel = (
        parent: THREE.Object3D,
        w: number,
        h: number,
        d: number,
        color: string,
        x = 0,
        y = 0,
        z = 0,
      ): THREE.Mesh => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(w * P, h * P, d * P),
          new THREE.MeshBasicMaterial({ color }),
        );
        mesh.position.set(x * P, y * P, z * P);
        parent.add(mesh);
        return mesh;
      };
      const swayingDetail = (
        parent: THREE.Object3D,
        x: number,
        y: number,
        z: number,
        w: number,
        h: number,
        d: number,
        color: string,
        phase: number,
        restZ = 0,
      ): THREE.Group => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        root.rotation.z = restZ;
        const mesh = voxel(root, w, h, d, color);
        mesh.geometry.translate(0, h * 0.5 * P, 0);
        parent.add(root);
        signature.details.push({ obj: root, restX: 0, restZ, phase });
        return root;
      };
      const buildLeg = (
        side: -1 | 1,
        front: boolean,
        x: number,
        y: number,
        z: number,
        upperLength: number,
        lowerLength: number,
        width: number,
        upperColor: string,
      ): void => {
        const hip = new THREE.Group();
        hip.position.set(side * x * P, y * P, z * P);
        const upper = voxel(hip, width, upperLength, width, upperColor);
        upper.geometry.translate(0, -upperLength * 0.5 * P, 0);
        voxel(hip, width + 0.8, 1.2, width + 0.75, style.plate, 0, -0.45, 0);

        const knee = new THREE.Group();
        knee.position.y = -upperLength * P;
        const lower = voxel(knee, width * 0.86, lowerLength, width * 0.88, style.dark);
        lower.geometry.translate(0, -lowerLength * 0.5 * P, 0);
        voxel(knee, width + 0.6, 1.25, width + 0.7, style.accent, 0, -0.15, -0.15);

        const foot = new THREE.Group();
        foot.position.y = -lowerLength * P;
        voxel(foot, width + 0.8, 1.2, width + (feature === "roosthen" ? 2.2 : 1.8), style.dark, 0, -0.55, -0.75);
        if (feature === "roosthen") {
          for (const toe of [-1, 0, 1]) {
            voxel(foot, 0.45, 0.45, 2.1, style.glow, toe * 0.75, -1, -1.8);
          }
        } else {
          voxel(foot, width + 0.25, 0.55, width + 1.2, style.accent, 0, -1.15, -1.15);
        }
        knee.add(foot);
        hip.add(knee);
        body.add(hip);
        const restHipX = front ? 0.04 : -0.05;
        const restHipZ = side * 0.015;
        const restKneeX = front ? 0.09 : -0.16;
        const restFootX = front ? -0.04 : 0.1;
        hip.rotation.x = restHipX;
        hip.rotation.z = restHipZ;
        knee.rotation.x = restKneeX;
        foot.rotation.x = restFootX;
        signature.legs.push({
          side,
          front,
          phase: front ? (side === -1 ? 0 : Math.PI) : (side === -1 ? Math.PI : 0),
          hip,
          knee,
          foot,
          restHipX,
          restHipZ,
          restKneeX,
          restFootX,
        });
      };
      const buildWing = (
        parent: THREE.Object3D,
        side: -1 | 1,
        x: number,
        y: number,
        z: number,
        length: number,
        height: number,
      ): void => {
        const root = new THREE.Group();
        root.position.set(side * x * P, y * P, z * P);
        const restRootX = -0.08;
        const restRootZ = side * 0.18;
        root.rotation.set(restRootX, 0, restRootZ);
        voxel(root, 1.4, height, length, style.plate, side * 0.4, -height * 0.2, 0);
        voxel(root, 0.7, height + 0.8, length + 0.5, style.dark, side * 0.7, 0, 0);
        const tip = new THREE.Group();
        tip.position.set(side * 0.8 * P, -height * 0.75 * P, length * 0.35 * P);
        const restTipX = 0.12;
        const restTipZ = side * 0.1;
        tip.rotation.set(restTipX, 0, restTipZ);
        voxel(tip, 1.1, height * 0.72, length * 0.72, style.body, side * 0.3, -height * 0.3, 0);
        root.add(tip);
        parent.add(root);
        signature.wings.push({ side, root, tip, restRootX, restRootZ, restTipX, restTipZ });
      };
      const buildTail = (
        parent: THREE.Object3D,
        startY: number,
        startZ: number,
        lengths: number[],
        widths: number[],
        restXs: number[],
        colors: string[],
      ): void => {
        let tailParent = parent;
        for (let i = 0; i < lengths.length; i++) {
          const tail = new THREE.Group();
          if (i === 0) tail.position.set(0, startY * P, startZ * P);
          else tail.position.z = lengths[i - 1] * P;
          const segment = voxel(tail, widths[i], widths[i], lengths[i], colors[i] ?? style.body);
          segment.geometry.translate(0, 0, lengths[i] * 0.5 * P);
          const restX = restXs[i] ?? 0;
          tail.rotation.x = restX;
          tailParent.add(tail);
          signature.tail.push({ obj: tail, restX, restY: 0, restZ: 0, phase: i * 0.75 });
          tailParent = tail;
        }
      };

      const core = signature.core;
      const head = signature.head;
      body.add(core);

      switch (feature) {
        case "roosthen": {
          core.position.set(0, 8.4 * P, 0.5 * P);
          voxel(core, style.bodyWidth, style.bodyHeight, style.bodyLength, style.body);
          voxel(core, style.bodyWidth + 1, 4.6, style.bodyLength * 0.72, style.plate, 0, -0.8, -0.5);
          voxel(core, 4.5, 3.5, 1.1, style.accent, 0, -2, -4.1);
          for (const side of [-1, 1] as const) {
            buildLeg(side, true, 1.55, 5.2, 1.2, 2.4, 1.9, style.limbWidth, style.glow);
            buildWing(core, side, style.bodyWidth * 0.5, 1.4, 0, 6.2, 5.3);
          }
          head.position.set(0, 5.4 * P, -4.3 * P);
          voxel(head, 5.7, 5.6, 5, style.plate);
          voxel(head, 5.2, 1.2, 0.75, style.dark, 0, -1.4, -2.85);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 0.75, 0.75, 0.5, style.dark, side * 1.45, 0.7, -2.8);
          }
          const jaw = new THREE.Group();
          jaw.position.set(0, -0.6 * P, -2.5 * P);
          voxel(jaw, 4.2, 1.4, 3.1, style.glow, 0, -0.5, -1.1);
          head.add(jaw);
          signature.jaw = jaw;
          for (const [x, h] of [[-1.6, 2.8], [0, 4], [1.6, 3.1]] as const) {
            swayingDetail(head, x, 2.8, 0, 1.1, h, 1, style.accent, x);
          }
          for (const side of [-1, 1] as const) {
            const feather = swayingDetail(core, side * 1.8, 2.2, 3.7, 1.5, 5.5, 1.2, side === -1 ? style.dark : style.accent, side);
            feather.rotation.x = -0.5;
          }
          break;
        }
        case "moss_stalker": {
          core.position.set(0, 13.4 * P, 0);
          voxel(core, style.bodyWidth, style.bodyHeight, style.bodyLength, style.body);
          voxel(core, style.bodyWidth + 1.4, 2.4, style.bodyLength + 1, style.plate, 0, 4.4, 0);
          voxel(core, style.bodyWidth - 1.3, 8.3, 0.9, style.dark, 0, 0, -4.05);
          glowVoxel(core, style.bodyWidth - 3, 0.65, 1, style.glow, 0, 1.8, -4.6);
          for (const [x, y, z] of [[-3.7, 2.8, -2], [3.8, -2.2, 1.8], [-2.8, -3.8, 2.2]] as const) {
            voxel(core, 2.1, 2.8, 1.2, style.accent, x, y, z);
          }
          for (const front of [true, false]) {
            for (const side of [-1, 1] as const) {
              buildLeg(side, front, 2.5, 7.5, front ? -2.6 : 3, 3.5, 3, style.limbWidth, style.body);
            }
          }
          head.position.set(0, 10.5 * P, -0.45 * P);
          voxel(head, 9.2, 8.8, 8.8, style.plate);
          voxel(head, 8.1, 2, 1, style.dark, 0, 2.3, -4.9);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 1.5, 1.5, 0.65, style.glow, side * 2.3, 1.7, -4.9);
          }
          const jaw = new THREE.Group();
          jaw.position.set(0, -1.1 * P, -4.25 * P);
          voxel(jaw, 5.4, 3.9, 1, style.dark, 0, -1.3, -0.8);
          for (const [x, y] of [[-1.8, -0.3], [0, -1.7], [1.8, -0.3]] as const) {
            glowVoxel(jaw, 1.1, 1.1, 0.6, style.glow, x, y, -1.4);
          }
          head.add(jaw);
          signature.jaw = jaw;
          for (const x of [-3.1, -1, 1.2, 3.2]) {
            swayingDetail(head, x, 4.2, 1.2, 0.65, 4.2 + Math.abs(x) * 0.2, 0.7, style.accent, x);
          }
          break;
        }
        case "ironback": {
          core.position.set(0, 7.6 * P, 1 * P);
          voxel(core, style.bodyWidth, style.bodyHeight, style.bodyLength, style.body);
          for (const z of [-5.5, -3, -0.5, 2, 4.5, 6]) {
            voxel(core, style.bodyWidth + 1.6, style.bodyHeight + 1.2, 1.7, style.plate, 0, 1, z);
            voxel(core, style.bodyWidth + 2.2, 0.7, 1.9, style.accent, 0, 5.2, z);
          }
          for (const front of [true, false]) {
            for (const side of [-1, 1] as const) {
              buildLeg(side, front, 3.7, 5.4, 1 + (front ? -4.2 : 4.2), 2.35, 2, style.limbWidth, style.body);
            }
          }
          head.position.set(0, -0.3 * P, -8.1 * P);
          voxel(head, 7.8, 5.7, 6.4, style.body);
          voxel(head, 8.5, 2, 5.8, style.plate, 0, 2.4, 0.4);
          voxel(head, 5.8, 2.6, 3.5, style.accent, 0, -1.1, -4.1);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 0.8, 0.8, 0.5, style.glow, side * 2.2, 0.5, -3.45);
            voxel(head, 1.5, 2.6, 1.2, style.dark, side * 3.4, 2.4, 0);
          }
          const jaw = new THREE.Group();
          jaw.position.set(0, -1.6 * P, -3.1 * P);
          voxel(jaw, 4.8, 1.6, 3.4, style.dark, 0, -0.5, -1.1);
          head.add(jaw);
          signature.jaw = jaw;
          buildTail(core, 0.4, 7, [3.2, 2.7, 2.2], [2.4, 1.8, 1.2], [0.15, 0.2, 0.24], [style.plate, style.body, style.dark]);
          break;
        }
        case "siege_beast": {
          core.position.set(0, 12 * P, 0.5 * P);
          voxel(core, style.bodyWidth, style.bodyHeight, style.bodyLength, style.body);
          voxel(core, style.bodyWidth + 3, style.bodyHeight * 0.78, 7.2, style.dark, 0, 1, -6.2);
          voxel(core, style.bodyWidth + 2, 3.4, style.bodyLength - 2, style.plate, 0, 5.5, 0.5);
          for (const z of [-6.5, -2.2, 2.2, 6.5]) {
            voxel(core, style.bodyWidth + 1.4, 1.2, 2.2, style.accent, 0, 3.6, z);
          }
          for (const front of [true, false]) {
            for (const side of [-1, 1] as const) {
              buildLeg(side, front, 5.2, 10.3, 0.5 + (front ? -6.2 : 6.2), 5.1, 4, style.limbWidth, front ? style.dark : style.body);
            }
          }
          head.position.set(0, 0.6 * P, -11.2 * P);
          voxel(head, 13.5, 9.4, 8.6, style.dark);
          voxel(head, 14.8, 3.1, 8.1, style.plate, 0, 3.7, 0.4);
          voxel(head, 10.5, 3.8, 5.2, style.body, 0, -1.2, -6);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 1.4, 1.2, 0.65, style.glow, side * 3.5, 1.2, -4.8);
            const horn = new THREE.Group();
            horn.position.set(side * 6.2 * P, 3.8 * P, -1.2 * P);
            horn.rotation.z = side * -0.2;
            voxel(horn, 4.2, 2.1, 2.1, style.accent, side * 1.7, 0, 0);
            voxel(horn, 2.8, 1.2, 1.25, "#c9b895", side * 4.5, 0.9, -0.2).rotation.z = side * -0.24;
            head.add(horn);
          }
          const jaw = new THREE.Group();
          jaw.position.set(0, -2.2 * P, -5.2 * P);
          voxel(jaw, 10.2, 2.8, 5.7, style.accent, 0, -1, -2.2);
          voxel(jaw, 8.8, 0.8, 4.9, style.dark, 0, -2.6, -2.3);
          head.add(jaw);
          signature.jaw = jaw;
          buildTail(core, 0.6, 9.5, [3.3, 2.5], [2.1, 1.4], [0.18, 0.25], [style.body, style.dark]);
          break;
        }
        case "root_sniffer": {
          core.position.set(0, 10.8 * P, 1 * P);
          voxel(core, style.bodyWidth, style.bodyHeight, style.bodyLength, style.body);
          voxel(core, style.bodyWidth + 1.8, 3.2, style.bodyLength - 1.5, style.plate, 0, 4.8, 0.4);
          voxel(core, style.bodyWidth + 2.2, 4.8, 6.8, style.dark, 0, 0.8, -7);
          for (const z of [-7, -3.5, 0, 3.5, 7]) {
            voxel(core, style.bodyWidth + 1.1, 1, 2.2, style.accent, 0, 3.5, z);
          }
          for (const [x, z, h] of [[-5, -5.8, 3.2], [-2, -2, 4.5], [2.2, 1.5, 3.8], [5, 5, 4.2], [-4, 7.2, 2.8]] as const) {
            const shoot = swayingDetail(core, x, 5.4, z, 0.75, h, 0.75, style.glow, x + z);
            voxel(shoot, 2.3, 1.1, 2.3, style.plate, 0, h + 0.4, 0);
          }
          for (const front of [true, false]) {
            for (const side of [-1, 1] as const) {
              buildLeg(side, front, 5, 8.9, 1 + (front ? -6.8 : 6.8), 4.35, 3.25, style.limbWidth, style.body);
            }
          }
          head.position.set(0, -0.9 * P, -12.1 * P);
          voxel(head, 12.8, 7.4, 8.5, style.dark);
          voxel(head, 13.8, 2.7, 7.8, style.plate, 0, 3.1, 0.5);
          voxel(head, 11.4, 4.2, 8.2, style.accent, 0, -1.2, -7.1);
          voxel(head, 9.7, 2.3, 1.1, style.dark, 0, -1.4, -11.5);
          for (const side of [-1, 1] as const) {
            glowVoxel(head, 1.3, 1.1, 0.65, style.glow, side * 3.5, 1.1, -4.6);
            voxel(head, 2.5, 3.3, 1.5, style.plate, side * 5.8, 2.3, -0.3);
            voxel(head, 1, 0.9, 0.55, style.dark, side * 2.7, -1.2, -12.15);
          }
          const jaw = new THREE.Group();
          jaw.position.set(0, -2.6 * P, -6.8 * P);
          voxel(jaw, 9.5, 2.2, 7.5, style.dark, 0, -0.8, -3.4);
          head.add(jaw);
          signature.jaw = jaw;
          buildTail(core, 0.7, 10, [4.2, 3.4, 2.7], [2.7, 2, 1.35], [0.16, 0.22, 0.28], [style.body, style.accent, style.dark]);
          break;
        }
      }

      signature.headRestX = head.rotation.x;
      signature.headRestY = head.position.y;
      signature.headRestZ = head.position.z;
      anim.head = head;
      anim.headRestZ = head.position.z;
      core.add(head);
      const barPixels = feature === "siege_beast" ? 31
        : feature === "root_sniffer" ? 29
          : feature === "moss_stalker" ? 29
            : feature === "ironback" ? 22 : 21;
      return { barHeight: barPixels * P + 0.34, anim };
    }
    if (bossStyle) {
      const style = bossStyle;
      const boss: BossAnim = { feature: style.feature, core: new THREE.Group(), heads: [], legs: [], wings: [], tail: [], details: [] };
      anim.boss = boss;
      body.add(boss.core);
      const voxel = (parent: THREE.Object3D, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) => {
        const cube = box(w, h, d, color);
        cube.position.set(x * P, y * P, z * P);
        parent.add(cube);
        return cube;
      };
      const glow = (parent: THREE.Object3D, w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0) => {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), new THREE.MeshBasicMaterial({ color }));
        cube.position.set(x * P, y * P, z * P);
        parent.add(cube);
        return cube;
      };
      const jointedLeg = (side: -1 | 1, front: boolean, x: number, y: number, z: number, thick: number, height: number) => {
        const root = new THREE.Group();
        root.position.set(x * P, y * P, z * P);
        const upper = voxel(root, thick, height * 0.52, thick + 1, style.body, 0, -height * 0.26, 0);
        upper.rotation.z = side * 0.05;
        voxel(root, thick + 1.2, 2.2, thick + 2.2, style.plate, 0, -1, 0);
        const knee = new THREE.Group();
        knee.position.y = -height * 0.5 * P;
        voxel(knee, thick * 0.82, height * 0.48, thick * 0.82, style.dark, 0, -height * 0.24, front ? -0.7 : 0.7);
        voxel(knee, thick * 1.25, 2.4, thick * 2, style.plate, 0, -height * 0.5, -1.2);
        root.add(knee);
        boss.legs.push({ root, knee, side, phase: (front ? 0 : Math.PI) + (side > 0 ? Math.PI : 0), restX: 0, restZ: root.rotation.z });
        boss.core.add(root);
      };

      if (style.feature === "deep_warden") {
        boss.core.position.y = 23 * P;
        voxel(boss.core, 23, 22, 14, style.body);
        voxel(boss.core, 27, 8, 16, style.plate, 0, 3, 0);
        voxel(boss.core, 17, 14, 15.5, style.dark, 0, 0, -0.4);
        // Rib cage and pulsing soul aperture.
        for (const side of [-1, 1] as const) {
          for (let rib = 0; rib < 4; rib++) {
            const ribRoot = new THREE.Group();
            ribRoot.position.set(side * (4.5 + rib * 0.7) * P, (5 - rib * 2.3) * P, -8.2 * P);
            ribRoot.rotation.z = side * (0.12 + rib * 0.04);
            voxel(ribRoot, 1.5, 7.5 - rib * 0.7, 1.3, style.accent);
            boss.core.add(ribRoot);
            boss.details.push({ obj: ribRoot, restX: 0, restZ: ribRoot.rotation.z, phase: rib + (side > 0 ? 0.5 : 0) });
          }
          const arm = new THREE.Group();
          arm.position.set(side * 14 * P, 7 * P, 0);
          arm.rotation.z = side * -0.08;
          voxel(arm, 7, 19, 8, style.body, 0, -8, 0);
          voxel(arm, 8.5, 7, 9, style.dark, 0, -19, -0.5);
          for (let claw = -1; claw <= 1; claw++) voxel(arm, 1.7, 6, 1.7, style.plate, claw * 2.4, -24, -2);
          boss.core.add(arm);
          boss.details.push({ obj: arm, restX: 0, restZ: arm.rotation.z, phase: side });
          jointedLeg(side, side < 0, side * 7, -10, 0, 7, style.legHeight);
        }
        const head = new THREE.Group();
        head.position.set(0, 15 * P, -2 * P);
        voxel(head, 15, 12, 13, style.dark, 0, 0, -4);
        voxel(head, 17, 4, 14, style.plate, 0, 4, -3.5);
        for (const side of [-1, 1] as const) {
          glow(head, 2.2, 1.3, 0.8, style.glow, side * 3.6, 1, -10.8);
          for (let n = 0; n < 3; n++) {
            const horn = new THREE.Group();
            horn.position.set(side * (7.5 + n * 2.2) * P, (3 - n * 2.1) * P, -1 * P);
            horn.rotation.z = side * (0.35 + n * 0.08);
            voxel(horn, 1.5, 8 - n, 1.5, n === 2 ? style.glow : style.accent);
            head.add(horn);
            boss.details.push({ obj: horn, restX: 0, restZ: horn.rotation.z, phase: n + side });
          }
        }
        const jaw = new THREE.Group();
        jaw.position.set(0, -4 * P, -8 * P);
        voxel(jaw, 11, 3, 7, style.body, 0, -1, -1.5);
        head.add(jaw);
        boss.core.add(head);
        boss.heads.push({ root: head, jaw, restX: 0, restY: 0, phase: 0 });
        glow(boss.core, 6, 8, 1.3, style.glow, 0, 1, -8.2);
        return { barHeight: 3.75, anim };
      }

      // Dragon bodies: every exact ID below changes head count, wing count,
      // proportions and surface ornament, while sharing only joint mechanics.
      const bodyY = style.legHeight + style.bodyHeight * 0.45;
      boss.core.position.y = bodyY * P;
      voxel(boss.core, style.bodyWidth, style.bodyHeight, style.bodyLength, style.body);
      voxel(boss.core, style.bodyWidth + 2.5, style.bodyHeight * 0.42, style.bodyLength * 0.72, style.plate, 0, style.bodyHeight * 0.43, 1);
      voxel(boss.core, style.bodyWidth * 0.72, style.bodyHeight * 0.45, style.bodyLength + 3, style.dark, 0, -style.bodyHeight * 0.32, 0);
      // Layered scale plates and silhouette-breaking spines.
      const plateCount = style.feature === "ice_drake" ? 9 : style.feature === "hydra" ? 5 : 7;
      for (let i = 0; i < plateCount; i++) {
        const z = -style.bodyLength * 0.38 + i * (style.bodyLength * 0.76 / Math.max(1, plateCount - 1));
        voxel(boss.core, style.bodyWidth + 3 - (i % 2), 1.4, 3.2, i % 2 ? style.accent : style.plate, 0, style.bodyHeight * 0.56, z);
        const spine = new THREE.Group();
        spine.position.set(0, style.bodyHeight * 0.62 * P, z * P);
        spine.rotation.x = -0.18;
        voxel(spine, style.feature === "ice_drake" ? 2.2 : 2.8, 4 + (i % 3) * 1.8, 1.8, style.accent, 0, 2, 0);
        boss.core.add(spine);
        boss.details.push({ obj: spine, restX: spine.rotation.x, restZ: 0, phase: i * 0.7 });
      }
      for (const side of [-1, 1] as const) {
        jointedLeg(side, true, side * style.bodyWidth * 0.38, -style.bodyHeight * 0.2, -style.bodyLength * 0.3, 5.2, style.legHeight);
        jointedLeg(side, false, side * style.bodyWidth * 0.38, -style.bodyHeight * 0.2, style.bodyLength * 0.29, 5.8, style.legHeight);
      }

      const neckSpread = style.feature === "hydra" ? 7.5 : 8.5;
      for (let n = 0; n < style.necks; n++) {
        const lateral = (n - (style.necks - 1) / 2) * neckSpread;
        const neck = new THREE.Group();
        neck.position.set(lateral * P, style.bodyHeight * 0.18 * P, -style.bodyLength * 0.48 * P);
        neck.rotation.x = style.feature === "hydra" ? -0.28 : -0.18;
        neck.rotation.y = lateral * -0.018;
        const neckLength = style.feature === "hydra" ? 25 + (n === 1 ? 4 : 0) : style.feature === "ice_drake" ? 30 : 22;
        const neckSegments = style.feature === "ice_drake" ? 5 : 4;
        for (let s = 0; s < neckSegments; s++) {
          const taper = 1 - s * 0.11;
          voxel(neck, 7.5 * taper, 7 * taper, neckLength / neckSegments + 1, s % 2 ? style.dark : style.body,
            lateral * 0.07 * s, s * 2.2, -(s + 0.5) * neckLength / neckSegments);
          voxel(neck, 8.3 * taper, 1.2, 2, style.plate, lateral * 0.07 * s, s * 2.2 + 3.3 * taper, -(s + 0.5) * neckLength / neckSegments);
        }
        const head = new THREE.Group();
        head.position.set(lateral * 0.07 * neckSegments * P, neckSegments * 2.2 * P, -neckLength * P);
        const headW = style.feature === "hydra" ? 10 : style.feature === "storm_twin" ? 11.5 : 13;
        voxel(head, headW, 9, 14, style.dark, 0, 0, -5);
        voxel(head, headW + 2, 3, 12, style.plate, 0, 3.6, -4);
        voxel(head, headW * 0.75, 4, 10, style.body, 0, -1.6, -12);
        for (const side of [-1, 1] as const) {
          glow(head, 1.5, 1.25, 0.75, style.glow, side * headW * 0.27, 1.1, -12.1);
          const horn = new THREE.Group();
          horn.position.set(side * headW * 0.35 * P, 4 * P, -2 * P);
          horn.rotation.z = side * -0.28;
          voxel(horn, 1.7, style.feature === "ice_drake" ? 9 : 6.5, 1.7, style.accent, 0, 3, 0);
          head.add(horn);
        }
        const jaw = new THREE.Group();
        jaw.position.set(0, -3.2 * P, -7.5 * P);
        voxel(jaw, headW * 0.8, 3.2, 10, style.body, 0, -0.8, -3.5);
        for (const side of [-1, 1] as const) for (let fang = 0; fang < 2; fang++) {
          voxel(jaw, 0.9, 2.1, 0.9, "#e8ddba", side * (2.2 + fang * 1.4), -2, -6.8 + fang * 2.4);
        }
        head.add(jaw);
        neck.add(head);
        boss.core.add(neck);
        boss.heads.push({ root: neck, jaw, restX: neck.rotation.x, restY: neck.rotation.y, phase: n * 1.7 });
      }

      for (const side of [-1, 1] as const) for (let pair = 0; pair < style.wingPairs; pair++) {
        const root = new THREE.Group();
        root.position.set(side * style.bodyWidth * 0.4 * P, style.bodyHeight * (0.2 - pair * 0.12) * P, (-2 + pair * 8) * P);
        root.rotation.z = side * (style.feature === "fire_wyvern" ? -0.23 : -0.12);
        root.rotation.y = side * 0.08;
        const span = (style.feature === "fire_wyvern" ? 35 : style.feature === "storm_twin" ? 30 : 20) - pair * 5;
        voxel(root, span, 2.7, 4, style.dark, side * span * 0.5, 0, 0);
        const tip = new THREE.Group();
        tip.position.set(side * span * P, 0, 0);
        tip.rotation.z = side * -0.2;
        voxel(tip, span * 0.75, 2.1, 3, style.plate, side * span * 0.37, 0, 0);
        // Stepped solid membranes preserve the chunky reference silhouette.
        for (let rib = 0; rib < 4; rib++) {
          voxel(root, Math.max(4, span - rib * span * 0.2), 0.8, 5.5,
            rib % 2 ? style.body : style.accent, side * (span - rib * span * 0.2) * 0.5, -2.2 - rib * 2.5, 2 + rib * 3.2);
        }
        root.add(tip);
        boss.core.add(root);
        boss.wings.push({ root, tip, side, pair, restZ: root.rotation.z });
      }

      let tailParent = boss.core;
      let z = style.bodyLength * 0.47;
      for (let i = 0; i < style.tailSegments; i++) {
        const segment = new THREE.Group();
        segment.position.set(0, (i === 0 ? -1 : 0) * P, z * P);
        const length = Math.max(5, 10 - i * 0.7);
        const thick = Math.max(2.2, 7 - i * 0.65);
        voxel(segment, thick, thick, length, i % 3 === 0 ? style.plate : style.body, 0, 0, length * 0.5);
        tailParent.add(segment);
        boss.tail.push({ obj: segment, restY: 0, phase: i * 0.55 });
        tailParent = segment;
        z = length;
      }
      if (style.feature === "fire_wyvern") {
        voxel(tailParent, 7, 9, 7, style.glow, 0, 2, 8);
        voxel(tailParent, 3, 13, 3, style.accent, 0, 5, 8);
      } else if (style.feature === "ice_drake") {
        for (const side of [-1, 0, 1]) voxel(tailParent, 3, 10 - Math.abs(side) * 2, 3, style.glow, side * 2.5, 3, 7);
      } else if (style.feature === "storm_twin") {
        glow(tailParent, 5, 5, 9, style.glow, 0, 0, 8);
      }
      return { barHeight: (bodyY + style.bodyHeight * 0.9 + (style.feature === "hydra" ? 22 : 16)) * P + 0.7, anim };
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
        const baleGeo = new THREE.BoxGeometry(16 * P, 16 * P, 16 * P);
        let bale: THREE.Mesh;
        if (rigSkin) {
          // Original per-face art paints the straw + target rings itself.
          setEntityFaceUVs(baleGeo, 32, 32, {
            right: [0, 0, 16, 16], left: [0, 0, 16, 16],
            top: [16, 0, 16, 16], bottom: [16, 0, 16, 16],
            back: [16, 16, 16, 16], front: [0, 16, 16, 16],
          });
          bale = new THREE.Mesh(baleGeo, rigSkin.material);
        } else {
          const hay = new THREE.MeshLambertMaterial({ map: this.materials.texture("object.haybale.side") });
          const hayTop = new THREE.MeshLambertMaterial({ map: this.materials.texture("object.haybale.top") });
          bale = new THREE.Mesh(baleGeo, [hay, hay, hayTop, hayTop, hay, hay]);
        }
        bale.position.y = 16 * P;
        if (!rigSkin) {
          for (const [size, color, dz] of [
            [10, "#efe6d5", 8.2], [6, "#c0455a", 8.5], [2, "#efe6d5", 8.8],
          ] as const) {
            const ring = box(size, size, 0.4, color);
            ring.position.set(0, 16 * P, -dz * P);
            body.add(ring);
          }
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
        // Magma hound rides the exact same wolf rig with a painted magma skin:
        // ember-crack hide, furnace eyes, obsidian snout, flame-gradient tail.
        const pm = defId === "enemy.magma_hound" && !rigSkin ? paintedMats("magma_hound") : null;
        // Exact vanilla ModelWolf boxes: legs 2x8x2 at x±1.5, back pair z7,
        // front pair z-4; feet at y=0.
        for (const [x, z] of [[-1.5, -4], [1.5, -4], [-1.5, 7], [1.5, 7]] as const) {
          const leg = skinned(rigSkin, 2, 8, 2, fur, 0, 18);
          if (pm) leg.material = pm.leg;
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
        if (pm) trunk.material = pm.body;
        trunk.rotation.x = -Math.PI / 2;
        trunk.position.set(0, 11 * P, 3.5 * P);
        const mane = skinned(rigSkin, 8, 6, 7, fur, 21, 0);
        if (pm) mane.material = pm.mane;
        mane.rotation.x = -Math.PI / 2;
        mane.position.set(0, 11 * P, -2 * P);
        // Neck: fills the ruff-to-skull gap so the head isn't a floating box.
        const neck = skinned(rigSkin, 4, 5, 5, fur, 0, 0, [6, 6, 4]);
        if (pm) neck.material = pm.coal;
        neck.position.set(0, 11 * P, -4 * P);
        // Head sits level with the back (centre y=10.5), not up on a giraffe
        // neck — the vanilla wolf holds its head low.
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 6, 6, 4, fur, 0, 0);
        if (pm) skull.material = [pm.coal, pm.coal, pm.coal, pm.coal, pm.coal, pm.face];
        head.add(skull);
        const snout = skinned(rigSkin, 3, 3, 4, dark, 0, 10);
        if (pm) snout.material = [pm.obsidian, pm.obsidian, pm.obsidian, pm.obsidian, pm.obsidian, pm.snout];
        snout.position.set(0, -1.5 * P, -3 * P);
        head.add(snout);
        for (const side of [-1, 1]) {
          const ear = skinned(rigSkin, 2, 2, 1, dark, 16, 14);
          if (pm) ear.material = pm.obsidian;
          ear.position.set(side * 2 * P, 4 * P, 0.5 * P);
          head.add(ear);
          if (!rigSkin && !pm) {
            // (magma hound's furnace eyes are painted into its face texture)
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
        if (pm) tail.material = pm.tail; // flame gradient down the drooping tail
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
          const leg = skinned(rigSkin, 4, 8, 4, dark, 0, 0);
          leg.geometry.translate(0, -4 * P, 0);
          leg.position.set(side * 3 * P, 8 * P, 0);
          anim.legs.push(leg);
          body.add(leg);
        }
        const torso = skinned(rigSkin, 10, 10, 6, stone, 0, 16);
        torso.position.y = 13 * P;
        const seam = new THREE.Mesh(
          new THREE.BoxGeometry(6 * P, 2 * P, 6.4 * P),
          new THREE.MeshBasicMaterial({ color: "#7fe0c3" }),
        );
        seam.position.y = 13 * P;
        const shoulders = skinned(rigSkin, 14, 4, 6, dark, 0, 32);
        shoulders.position.y = 20 * P;
        for (const side of [-1, 1]) {
          const arm = skinned(rigSkin, 4, 12, 4, stone, 0, 44);
          arm.geometry.translate(0, -6 * P, 0);
          arm.position.set(side * 9 * P, 20 * P, 0);
          anim.legs.push(arm); // arms swing with the lumbering gait
          body.add(arm);
        }
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 6, 5, 6, stone, 40, 0);
        skull.position.y = 2.5 * P;
        head.add(skull);
        if (!rigSkin) {
          const eye = new THREE.Mesh(
            new THREE.BoxGeometry(4 * P, 1 * P, 0.5 * P),
            new THREE.MeshBasicMaterial({ color: "#7fe0c3" }),
          );
          eye.position.set(0, 3 * P, -3.2 * P);
          head.add(eye);
        }
        head.position.set(0, 22 * P, 0);
        anim.head = head;
        anim.headRestZ = 0;
        body.add(torso, seam, shoulders, head);
        return { barHeight: 28 * P + 0.22, anim };
      }
      case "fox": {
        // Russet fox: lithe wolf-family silhouette with a white muzzle and a
        // white-tipped brush tail that sways as it trots.
        const coat = tint ?? "#c25a28";
        const darkc = "#8a3a18";
        for (const [sx, sz] of [[-1.4, -3], [1.4, -3], [-1.4, 3], [1.4, 3]] as const) {
          const leg = box(1.2, 3, 1.2, darkc);
          leg.geometry.translate(0, -1.5 * P, 0);
          leg.position.set(sx * P, 3 * P, sz * P);
          anim.legs.push(leg);
          body.add(leg);
        }
        const trunk = box(4, 4, 9, coat);
        trunk.position.y = 5 * P;
        const head = new THREE.Group();
        head.add(box(4, 3.5, 4, coat));
        const muzzle = box(2, 1.6, 2.5, "#efe6d5");
        muzzle.position.set(0, -1 * P, -2.5 * P);
        head.add(muzzle);
        for (const sx of [-1.4, 1.4]) {
          const ear = box(1.2, 1.6, 0.8, darkc);
          ear.position.set(sx * P, 2.4 * P, 0.5 * P);
          head.add(ear);
        }
        head.position.set(0, 7 * P, -5.5 * P);
        anim.head = head;
        anim.headRestZ = -5.5 * P;
        const tail = box(2.2, 2.2, 6, coat);
        tail.position.set(0, 6 * P, 7 * P);
        const tip = box(2.3, 2.3, 1.6, "#efe6d5");
        tip.position.set(0, 6 * P, 10.2 * P);
        anim.sway = [{ obj: tail, baseX: 0, baseZ: 0, sign: 1 }, { obj: tip, baseX: 0, baseZ: 0, sign: 1 }];
        body.add(trunk, head, tail, tip);
        return { barHeight: 10 * P + 0.2, anim };
      }
      case "rabbit": {
        // Cottontail: round body, tall ears, hop-arc travel (anim.hopper).
        const fur = tint ?? "#b9977a";
        const light = "#c4a488";
        const trunk = box(5, 4, 6, fur);
        trunk.position.y = 4 * P;
        const head = new THREE.Group();
        head.add(box(4, 4, 4, light));
        for (const sx of [-1.2, 1.2]) {
          const ear = box(1.2, 4, 1.8, light);
          ear.position.set(sx * P, 4 * P, 0);
          head.add(ear);
        }
        head.position.set(0, 7 * P, -4 * P);
        anim.head = head;
        anim.headRestZ = -4 * P;
        const tailPuff = box(2, 2, 2, "#efe6d5");
        tailPuff.position.set(0, 4 * P, 3.6 * P);
        for (const sx of [-1.5, 1.5]) {
          const haunch = box(1.5, 2, 2, "#a8876a");
          haunch.position.set(sx * P, 1 * P, 1.5 * P);
          body.add(haunch);
        }
        anim.hopper = true;
        body.add(trunk, head, tailPuff);
        return { barHeight: 9 * P + 0.18, anim };
      }
      case "stag": {
        // Forest stag: slender legs, long neck, pale antlers. The doe shares
        // the rig (viewMaterial "doe") without antlers, in a softer coat.
        const isDoe = defId === "enemy.doe";
        const coat = tint ?? (isDoe ? "#a08258" : "#8a6844");
        const darkc = "#7a5a3a";
        for (const [sx, sz] of [[-2, -4], [2, -4], [-2, 4], [2, 4]] as const) {
          const leg = box(1.5, 6, 1.5, darkc);
          leg.geometry.translate(0, -3 * P, 0);
          leg.position.set(sx * P, 6 * P, sz * P);
          anim.legs.push(leg);
          body.add(leg);
        }
        const trunk = box(6, 6, 12, coat);
        trunk.position.y = 9 * P;
        const neck = box(3, 5, 3, coat);
        neck.position.set(0, 14 * P, -6 * P);
        const head = new THREE.Group();
        head.add(box(4, 4, 5, isDoe ? "#ab8d63" : "#94724c"));
        if (!isDoe) {
          for (const sx of [-1.8, 1.8]) {
            const stem = box(0.8, 4, 0.8, "#e8dcc8");
            stem.position.set(sx * P, 4 * P, 0.5 * P);
            head.add(stem);
            const branch = box(3, 0.8, 0.8, "#e8dcc8");
            branch.position.set(sx * P, 5.5 * P, 0.5 * P);
            head.add(branch);
          }
        }
        head.position.set(0, 18 * P, -7.5 * P);
        anim.head = head;
        anim.headRestZ = -7.5 * P;
        const tail = box(1.5, 2, 1.2, "#efe6d5");
        tail.position.set(0, 10 * P, 6.4 * P);
        body.add(trunk, neck, head, tail);
        return { barHeight: 22 * P + 0.2, anim };
      }
      case "crab": {
        // Shore crab: low wide shell, claws forward, eye stalks. It scuttles
        // sideways — the rig is built rotated 90° so walking reads as a
        // side-step — and raises its claws (sway) as it moves.
        const shellC = tint ?? "#c0455a";
        const darkc = "#8a2f3e";
        const shell = box(8, 3, 6, shellC);
        shell.position.y = 3 * P;
        for (const sgn of [-1, 1]) {
          const arm = box(2.4, 2, 3, "#a83a4c");
          arm.position.set(sgn * 5.4 * P, 3 * P, -2 * P);
          const claw = box(3, 2.6, 2, shellC);
          claw.position.set(sgn * 5.4 * P, 3 * P, -4.4 * P);
          (anim.sway ??= []).push({ obj: claw, baseX: 0, baseZ: 0, sign: sgn });
          body.add(arm, claw);
        }
        for (let i = 0; i < 3; i++) {
          for (const sgn of [-1, 1]) {
            const leg = box(1, 2.2, 1, darkc);
            leg.geometry.translate(0, -1.1 * P, 0);
            leg.position.set(sgn * (3 + i * 1.4) * P, 2.2 * P, (1 + i * 1.2) * P);
            anim.legs.push(leg);
            body.add(leg);
          }
        }
        for (const sx of [-1.2, 1.2]) {
          const stalk = box(0.8, 1.6, 0.8, "#2b2b33");
          stalk.position.set(sx * P, 5.4 * P, -2.6 * P);
          body.add(stalk);
        }
        body.rotation.y = Math.PI / 2; // built sideways: walking = side-scuttle
        body.add(shell);
        return { barHeight: 7 * P + 0.18, anim };
      }
      case "goat": {
        // Mountain goat: shaggy sheep-scale body, back-swept horns, chin tuft.
        const woolC = tint ?? "#d9d2c4";
        const darkc = "#8a8072";
        for (const [sx, sz] of [[-2, -3], [2, -3], [-2, 3], [2, 3]] as const) {
          const leg = box(1.6, 5, 1.6, darkc);
          leg.geometry.translate(0, -2.5 * P, 0);
          leg.position.set(sx * P, 5 * P, sz * P);
          anim.legs.push(leg);
          body.add(leg);
        }
        const trunk = box(6, 6, 10, woolC);
        trunk.position.y = 8 * P;
        const head = new THREE.Group();
        head.add(box(4, 5, 4, woolC));
        for (const sx of [-1.6, 1.6]) {
          const horn = box(1, 1, 3.2, "#b9a888");
          horn.position.set(sx * P, 2.6 * P, 1.4 * P);
          horn.rotation.x = 0.5;
          head.add(horn);
        }
        const beard = box(1.4, 1.8, 1, "#c9c0ae");
        beard.position.set(0, -3 * P, -1.4 * P);
        head.add(beard);
        head.position.set(0, 11 * P, -6 * P);
        anim.head = head;
        anim.headRestZ = -6 * P;
        body.add(trunk, head);
        return { barHeight: 14 * P + 0.2, anim };
      }
      case "frog": {
        // Pond frog: squat hopper with bulging eyes and a pale throat.
        const skinC = tint ?? "#5d8c3a";
        const trunk = box(4, 2.5, 5, skinC);
        trunk.position.y = 1.6 * P;
        for (const sx of [-2.4, 2.4]) {
          const haunch = box(1.6, 2, 2.4, "#4a7230");
          haunch.position.set(sx * P, 1.2 * P, 1 * P);
          body.add(haunch);
        }
        for (const sx of [-1.2, 1.2]) {
          const eye = box(1.2, 1.2, 1.2, "#e8e4c8");
          eye.position.set(sx * P, 3.2 * P, -1.6 * P);
          body.add(eye);
        }
        const throat = box(2.4, 1, 0.8, "#e8e4c8");
        throat.position.set(0, 1 * P, -2.6 * P);
        anim.hopper = true;
        body.add(trunk, throat);
        return { barHeight: 5 * P + 0.15, anim };
      }
      case "squirrel": {
        // Tree squirrel: tiny darting body under a huge curled tail.
        const coat = tint ?? "#9a5a30";
        const trunk = box(2.4, 2.4, 4, coat);
        trunk.position.y = 2 * P;
        const head = new THREE.Group();
        head.add(box(2.2, 2.2, 2.2, "#a8683c"));
        for (const sx of [-0.8, 0.8]) {
          const ear = box(0.7, 1, 0.5, coat);
          ear.position.set(sx * P, 1.5 * P, 0.3 * P);
          head.add(ear);
        }
        head.position.set(0, 3.2 * P, -2.6 * P);
        anim.head = head;
        anim.headRestZ = -2.6 * P;
        const tailLow = box(1.8, 2.2, 1.6, coat);
        tailLow.position.set(0, 2.6 * P, 2.6 * P);
        const tailHigh = box(2, 3.4, 1.8, "#b06a3a");
        tailHigh.position.set(0, 5 * P, 3 * P);
        anim.sway = [{ obj: tailHigh, baseX: 0, baseZ: 0, sign: 1 }];
        body.add(trunk, head, tailLow, tailHigh);
        return { barHeight: 8 * P + 0.14, anim };
      }
      case "rat": {
        // Giant rat: low grey rodent, naked pink tail, bared teeth.
        const coat = tint ?? "#6f6a66";
        for (const [sx, sz] of [[-1.6, -2.5], [1.6, -2.5], [-1.6, 2.5], [1.6, 2.5]] as const) {
          const leg = box(1, 2, 1, "#57534f");
          leg.geometry.translate(0, -1 * P, 0);
          leg.position.set(sx * P, 2 * P, sz * P);
          anim.legs.push(leg);
          body.add(leg);
        }
        const trunk = box(5, 4, 9, coat);
        trunk.position.y = 4 * P;
        const head = new THREE.Group();
        head.add(box(3.6, 3, 4, coat));
        const teeth = box(1, 1, 0.6, "#efe6d5");
        teeth.position.set(0, -1.2 * P, -2.2 * P);
        head.add(teeth);
        for (const sx of [-1.4, 1.4]) {
          const ear = box(1.2, 1.2, 0.5, "#8a7f7a");
          ear.position.set(sx * P, 1.8 * P, 0.8 * P);
          head.add(ear);
        }
        head.position.set(0, 4.5 * P, -6 * P);
        anim.head = head;
        anim.headRestZ = -6 * P;
        const tail = box(0.8, 0.8, 7, "#c98f96");
        tail.position.set(0, 3 * P, 7.5 * P);
        anim.sway = [{ obj: tail, baseX: 0, baseZ: 0, sign: 1 }];
        body.add(trunk, head, tail);
        return { barHeight: 8 * P + 0.2, anim };
      }
      case "wisp": {
        // Will-o'-wisp: a floating knot of pale flame — full-bright cores
        // inside a translucent shroud, bobbing above the mire (anim.floater).
        const core = new THREE.Mesh(
          new THREE.BoxGeometry(4 * P, 4 * P, 4 * P),
          new THREE.MeshBasicMaterial({ color: tint ?? "#bfe8ff" }),
        );
        core.position.y = 10 * P;
        const inner = new THREE.Mesh(
          new THREE.BoxGeometry(2 * P, 2 * P, 2 * P),
          new THREE.MeshBasicMaterial({ color: "#ffffff" }),
        );
        inner.position.y = 10 * P;
        const shroud = new THREE.Mesh(
          new THREE.BoxGeometry(6.5 * P, 6.5 * P, 6.5 * P),
          new THREE.MeshBasicMaterial({ color: "#7fd0ff", transparent: true, opacity: 0.35, depthWrite: false }),
        );
        shroud.position.y = 10 * P;
        for (const [dx, dy] of [[-4, 7], [4, 8], [0, 14]] as const) {
          const mote = new THREE.Mesh(
            new THREE.BoxGeometry(1.2 * P, 1.2 * P, 1.2 * P),
            new THREE.MeshBasicMaterial({ color: "#dff2ff" }),
          );
          mote.position.set(dx * P, dy * P, 0);
          (anim.sway ??= []).push({ obj: mote, baseX: 0, baseZ: 0, sign: dx >= 0 ? 1 : -1 });
          body.add(mote);
        }
        anim.floater = true;
        body.add(core, inner, shroud);
        return { barHeight: 16 * P + 0.2, anim };
      }
      case "mimic": {
        // Mimic: a treasure chest gone wrong — lid agape on fangs, a red eye
        // in the dark. Sits dead still until something comes close.
        const wood = this.lambert("terrain.plank");
        const chest = this.tiledBox(0.9, 0.55, 0.7, wood);
        chest.position.y = 0.28;
        const lid = this.tiledBox(0.9, 0.2, 0.7, wood);
        lid.position.set(0, 0.72, 0.18);
        lid.rotation.x = 0.7; // yawning open
        const maw = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.22, 0.55),
          new THREE.MeshBasicMaterial({ color: "#1a060a" }),
        );
        maw.position.set(0, 0.6, -0.02);
        for (let i = 0; i < 4; i++) {
          const fang = box(1, 2, 1, "#efe6d5");
          fang.position.set((-4.8 + i * 3.2) * P, 0.52, -0.28);
          body.add(fang);
        }
        const eye = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12, 0.12),
          new THREE.MeshBasicMaterial({ color: "#ff3b30" }),
        );
        eye.position.set(0, 0.62, 0.05);
        const clasp = box(1.4, 2, 0.6, "#c8a54a");
        clasp.position.set(0, 0.42, -0.36);
        body.add(chest, lid, maw, eye, clasp);
        return { barHeight: 1.0, anim };
      }
      case "goblin": {
        // Goblin warband (grunt/shaman/chief share the rig): a hunched green
        // raider in a stitched hide vest with a painted pixel face and big
        // angled ears. The grunt raises a studded club, the shaman carries a
        // totem staff, the chief adds iron pauldrons and a heavier club (his
        // def scale makes him tower over the grunts).
        const pm = paintedMats("goblin");
        const variant = defId === "enemy.goblin_shaman" ? "shaman" : defId === "enemy.goblin_chief" ? "chief" : "grunt";
        const matOr = (key: string, color: string): THREE.Material =>
          pm?.[key] ?? new THREE.MeshLambertMaterial({ color });
        const tbox = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[]): THREE.Mesh =>
          new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), m);
        const skinM = matOr("skin", "#5d8c3a");
        const vestM = matOr("vest", "#6b4a2a");
        const bodyM = matOr(variant === "shaman" ? "bodyShaman" : variant === "chief" ? "bodyChief" : "body", "#6b4a2a");
        const woodM = matOr("wood", "#8a6844");
        for (const s of [-1.4, 1.4]) {
          // Wrapped feet are painted into the leg texture's bottom rows so the
          // stride carries them along.
          const leg = tbox(1.8, 4.4, 1.8, matOr("leg", "#5d8c3a"));
          leg.geometry.translate(0, -2.2 * P, 0);
          leg.position.set(s * P, 4.4 * P, 0);
          anim.legs.push(leg);
          body.add(leg);
        }
        const torso = tbox(5.4, 5.6, 3.2, [vestM, vestM, vestM, vestM, vestM, bodyM]);
        torso.rotation.x = 0.15; // hunched
        torso.position.y = 7.2 * P;
        body.add(torso);
        const armL = tbox(1.6, 4.8, 1.6, skinM); // off arm swings with the stride
        armL.geometry.translate(0, -2.4 * P, 0);
        armL.position.set(-3.6 * P, 9.2 * P, 0);
        anim.legs.push(armL);
        body.add(armL);
        if (variant === "shaman") {
          const armR = tbox(1.6, 4.8, 1.6, skinM);
          armR.position.set(3.6 * P, 6.8 * P, 0);
          const staff = tbox(1, 8, 1, woodM);
          staff.position.set(3.6 * P, 6.5 * P, -1.6 * P);
          const orb = new THREE.Mesh(
            new THREE.BoxGeometry(1.6 * P, 1.6 * P, 1.6 * P),
            new THREE.MeshBasicMaterial({ color: "#7cd65a" }), // fetish glow
          );
          orb.position.set(3.6 * P, 10.8 * P, -1.6 * P);
          body.add(armR, staff, orb);
        } else {
          const armR = tbox(1.6, 4.8, 1.6, skinM); // club arm frozen mid-raise
          armR.position.set(3.6 * P, 8 * P, -1.1 * P);
          armR.rotation.x = -0.9;
          const club = tbox(1.3, 5.2, 1.3, woodM);
          club.position.set(3.6 * P, 10.4 * P, -3.8 * P);
          club.rotation.x = -0.9;
          const big = variant === "chief" ? 3.4 : 2.8;
          const clubHead = tbox(big, big - 0.2, big, matOr("clubHead", "#7a5a3a"));
          clubHead.position.set(3.6 * P, 12.6 * P, -5.4 * P);
          body.add(armR, club, clubHead);
        }
        if (variant === "chief") {
          for (const s of [-3.6, 3.6]) {
            const pauldron = tbox(2.8, 1.5, 3, matOr("pauldron", "#4a5560"));
            pauldron.position.set(s * P, 10.4 * P, 0);
            body.add(pauldron);
          }
        }
        const head = new THREE.Group();
        head.add(tbox(5, 4.6, 4.6, [skinM, skinM, skinM, skinM, skinM, matOr("face", "#5d8c3a")]));
        for (const s of [-3.6, 3.6]) {
          const ear = tbox(2.7, 1.6, 0.6, [skinM, skinM, skinM, skinM, skinM, matOr("ear", "#5d8c3a")]);
          ear.position.set(s * P, 1 * P, 0.2 * P);
          ear.rotation.z = s > 0 ? -0.45 : 0.45;
          head.add(ear);
        }
        if (variant === "grunt") {
          const knot = tbox(1.2, 1.4, 1.2, matOr("vest", "#2f333a"));
          knot.position.set(0, 2.9 * P, 0.2 * P);
          head.add(knot);
        } else if (variant === "shaman") {
          for (const s of [-1.4, 1.4]) {
            const horn = box(0.8, 1.8, 0.8, "#e8dcc8"); // bone headdress
            horn.position.set(s * P, 2.9 * P, 0.2 * P);
            head.add(horn);
          }
        } else {
          const band = tbox(5.2, 1, 4.8, matOr("pauldron", "#4a5560")); // iron brow band
          band.position.set(0, 2 * P, 0);
          head.add(band);
        }
        head.position.set(0, 12.4 * P, -1.2 * P);
        anim.head = head;
        anim.headRestZ = -1.2 * P;
        body.add(head);
        return { barHeight: 16 * P + 0.2, anim };
      }
      case "yeti": {
        // Yeti: hulking shag-furred giant — knuckle-dragger arms, dark face
        // painted with ice-blue eyes and upturned tusks, crown fur ridge.
        const pm = paintedMats("yeti");
        const matOr = (key: string, color: string): THREE.Material =>
          pm?.[key] ?? new THREE.MeshLambertMaterial({ color });
        const tbox = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[]): THREE.Mesh =>
          new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), m);
        const furM = matOr("fur", "#e4ebf0");
        const furDM = matOr("furD", "#cfd6da");
        for (const s of [-2.7, 2.7]) {
          const leg = tbox(3.6, 6.6, 3.8, matOr("leg", "#cfd6da")); // dark feet painted in
          leg.geometry.translate(0, -3.3 * P, 0);
          leg.position.set(s * P, 6.6 * P, 0);
          anim.legs.push(leg);
          body.add(leg);
        }
        const torso = tbox(10.5, 10, 6.5, [furM, furM, furM, furM, furM, matOr("chest", "#e4ebf0")]);
        torso.position.y = 11.8 * P;
        const shag = tbox(12.6, 3, 7, furDM);
        shag.position.y = 17.4 * P;
        body.add(torso, shag);
        for (const s of [-7.2, 7.2]) {
          // Long arms swing on the same beat as the legs; dark fists are the
          // leg texture's painted bottom rows.
          const arm = tbox(3.2, 11, 3.6, matOr("leg", "#dfe6ea"));
          arm.geometry.translate(0, -5.5 * P, 0);
          arm.position.set(s * P, 14.6 * P, 0);
          anim.legs.push(arm);
          body.add(arm);
        }
        const head = new THREE.Group();
        head.add(tbox(6, 5.6, 5.2, [furM, furM, furM, furM, furM, matOr("face", "#e8eef2")]));
        const crown = tbox(6.4, 1.2, 5.6, furDM);
        crown.position.y = 3.4 * P;
        head.add(crown);
        head.position.set(0, 21.6 * P, -0.6 * P);
        anim.head = head;
        anim.headRestZ = -0.6 * P;
        body.add(head);
        return { barHeight: 27 * P + 0.2, anim };
      }
      case "rattlesnake": {
        // Rattlesnake: a double-stacked coil with a painted diamond back,
        // level viper head raised off the top, and a rattle held up behind.
        // Low to the ground on purpose — a floor hazard you spot too late.
        const pm = paintedMats("rattlesnake");
        const matOr = (key: string, color: string): THREE.Material =>
          pm?.[key] ?? new THREE.MeshLambertMaterial({ color });
        const seg = (w: number, h: number, d: number): THREE.Mesh => {
          const side = matOr("side", "#a08153");
          return new THREE.Mesh(
            new THREE.BoxGeometry(w * P, h * P, d * P),
            [side, side, matOr("top", "#a08153"), matOr("belly", "#c9b98a"), side, side],
          );
        };
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const s = seg(2.6, 1.9, 2.6);
          s.position.set(Math.cos(a) * 2.9 * P, 1 * P, Math.sin(a) * 2.9 * P);
          body.add(s);
        }
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          const s = seg(2.2, 1.7, 2.2);
          s.position.set(Math.cos(a) * 1.7 * P, 2.6 * P, Math.sin(a) * 1.7 * P);
          body.add(s);
        }
        const neck1 = seg(2, 2.2, 2);
        neck1.position.set(0, 4.1 * P, 0.3 * P);
        const neck2 = seg(1.8, 2.4, 1.8);
        neck2.position.set(0, 6 * P, -0.2 * P);
        const scaleM = matOr("scale", "#a08153");
        const head = new THREE.Group();
        head.add(new THREE.Mesh(
          new THREE.BoxGeometry(3 * P, 1.9 * P, 3.6 * P),
          [scaleM, scaleM, matOr("headTop", "#a08153"), matOr("belly", "#c9b98a"), scaleM, matOr("face", "#8a6844")],
        ));
        const tongue = box(0.35, 0.35, 1.7, "#c94a4a");
        tongue.position.set(0, -0.5 * P, -2.4 * P);
        head.add(tongue);
        for (const s of [-0.35, 0.35]) {
          const fork = box(0.25, 0.25, 0.9, "#c94a4a");
          fork.position.set(s * P, -0.5 * P, -3.5 * P);
          head.add(fork);
        }
        head.position.set(0, 7.9 * P, -1 * P);
        anim.head = head;
        anim.headRestZ = -1 * P;
        body.add(neck1, neck2, head);
        for (const [x, y, z, w, h] of [[2.6, 3.6, 2.6, 1.3, 2.8], [3.2, 5.6, 2.9, 0.9, 2]] as const) {
          const rattle = new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, w * P), matOr("rattle", "#d8c9a0"));
          rattle.position.set(x * P, y * P, z * P);
          rattle.rotation.z = -0.25;
          (anim.sway ??= []).push({ obj: rattle, baseX: 0, baseZ: -0.25, sign: 1 });
          body.add(rattle);
        }
        return { barHeight: 10 * P + 0.2, anim };
      }
      case "werewolf": {
        // Werewolf: upright digitigrade wolf-man — torn trousers painted on
        // the thighs (the cursed-human tell), hunched chest, heavy shoulders,
        // bone claws, and a painted snarl on the muzzle. Night hunter.
        const pm = paintedMats("werewolf");
        const matOr = (key: string, color: string): THREE.Material =>
          pm?.[key] ?? new THREE.MeshLambertMaterial({ color });
        const tbox = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[]): THREE.Mesh =>
          new THREE.Mesh(new THREE.BoxGeometry(w * P, h * P, d * P), m);
        const furM = matOr("fur", "#3a3f47");
        const furDM = matOr("furD", "#2f333a");
        for (const s of [-1.9, 1.9]) {
          // Whole digitigrade leg (thigh + back-set hock + paw) is one group
          // pivoted at the hip so the stride swings the entire limb.
          const leg = new THREE.Group();
          const thigh = tbox(2.5, 4.4, 2.8, matOr("leg", "#3a3f47"));
          thigh.position.y = -2.2 * P;
          const hock = tbox(1.9, 3, 1.9, furDM);
          hock.position.set(0, -5.4 * P, 1.1 * P);
          const paw = tbox(1.9, 1.5, 2.7, furDM);
          paw.position.set(0, -7.4 * P, -0.1 * P);
          leg.add(thigh, hock, paw);
          leg.position.set(s * P, 8.2 * P, 0.4 * P);
          anim.legs.push(leg);
          body.add(leg);
        }
        const tailRoot = tbox(1.7, 1.7, 3.2, furDM);
        tailRoot.position.set(0, 6.8 * P, 3.2 * P);
        const tailTip = tbox(2.3, 2.3, 2.8, furM);
        tailTip.position.set(0, 6 * P, 5.6 * P);
        (anim.sway ??= []).push({ obj: tailTip, baseX: 0, baseZ: 0, sign: 1 });
        body.add(tailRoot, tailTip);
        const torso = tbox(7.2, 7.8, 4.2, [furM, furM, furM, furM, furM, matOr("chest", "#3a3f47")]);
        torso.rotation.x = 0.2; // hunched
        torso.position.y = 12 * P;
        const shoulders = tbox(9, 2.8, 4.8, furDM);
        shoulders.position.set(0, 15.8 * P, -0.6 * P);
        const ruff = tbox(5.8, 1.8, 4.2, furM);
        ruff.position.set(0, 16.8 * P, -1.5 * P);
        body.add(torso, shoulders, ruff);
        for (const s of [-5.6, 5.6]) {
          // Arm + oversized hand + bone claws swing as one limb.
          const limb = new THREE.Group();
          const arm = tbox(2.4, 8.2, 2.6, furM);
          arm.position.y = -4.1 * P;
          const hand = tbox(2.6, 2.1, 2.6, furDM);
          hand.position.set(0, -8.6 * P, -0.9 * P);
          limb.add(arm, hand);
          for (let cl = 0; cl < 3; cl++) {
            const claw = box(0.5, 1.8, 0.5, "#e8dcc8");
            claw.position.set((cl - 1) * 0.85 * P, -10 * P, -1.2 * P);
            limb.add(claw);
          }
          limb.position.set(s * P, 15 * P, -1.2 * P);
          anim.legs.push(limb);
          body.add(limb);
        }
        const head = new THREE.Group();
        head.add(tbox(4.8, 4.4, 4.4, [furM, furM, furM, furM, furM, matOr("face", "#3a3f47")]));
        const muzzle = tbox(2.6, 1.9, 3, [furDM, furDM, furDM, furDM, furDM, matOr("muzzle", "#2f333a")]);
        muzzle.position.set(0, -0.9 * P, -3.4 * P);
        head.add(muzzle);
        for (const s of [-1.6, 1.6]) {
          const ear = tbox(1.2, 2.1, 0.8, [furDM, furDM, furDM, furDM, furDM, matOr("ear", "#2f333a")]);
          ear.position.set(s * P, 3 * P, 0.6 * P);
          ear.rotation.z = s > 0 ? -0.15 : 0.15;
          head.add(ear);
        }
        head.position.set(0, 18 * P, -2.1 * P);
        head.rotation.x = 0.12;
        anim.head = head;
        anim.headRestZ = -2.1 * P;
        body.add(head);
        return { barHeight: 21 * P + 0.24, anim };
      }
      case "spider":
      case "gnasher": {
        const boss = kind === "gnasher";
        const style = arachnidStyleFor(defId, boss);
        const [abdomenW, abdomenH, abdomenD] = style.abdomen;
        const arachnid: ArachnidAnim = {
          legs: [],
          abdomen: new THREE.Group(),
          mandibles: [],
          pedipalps: [],
        };
        anim.arachnid = arachnid;

        const voxel = (
          parent: THREE.Object3D,
          w: number,
          h: number,
          d: number,
          color: string,
          x = 0,
          y = 0,
          z = 0,
        ): THREE.Mesh => {
          const mesh = box(w, h, d, color);
          mesh.position.set(x * P, y * P, z * P);
          parent.add(mesh);
          return mesh;
        };
        const glowVoxel = (
          parent: THREE.Object3D,
          w: number,
          h: number,
          d: number,
          color: string,
          x = 0,
          y = 0,
          z = 0,
        ): THREE.Mesh => {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w * P, h * P, d * P),
            new THREE.MeshBasicMaterial({ color }),
          );
          mesh.position.set(x * P, y * P, z * P);
          parent.add(mesh);
          return mesh;
        };

        // Three overlapping masses give the silhouette the chunky, assembled
        // voxel depth of the concept sheet instead of a single vanilla box.
        const thorax = new THREE.Group();
        thorax.position.set(0, 9 * P, 0);
        thorax.add(skinned(rigSkin, 6, 6, 6, style.body, 0, 0));
        voxel(thorax, 6.8, 1.5, 6.4, style.shell, 0, 3.15, 0);
        voxel(thorax, 7.2, 3.5, 2.2, style.shell, 0, 0.4, 1.9);
        voxel(thorax, 1.2, 4.4, 5.5, style.accent, -3.25, -0.2, 0);
        voxel(thorax, 1.2, 4.4, 5.5, style.accent, 3.25, -0.2, 0);

        const abdomen = arachnid.abdomen;
        abdomen.position.set(0, 9.2 * P, 9 * P);
        const abdomenCore = skinned(
          rigSkin,
          abdomenW,
          abdomenH,
          abdomenD,
          style.body,
          0,
          12,
          [10, 8, 12],
        );
        abdomen.add(abdomenCore);
        voxel(abdomen, abdomenW - 1, 1.5, abdomenD - 2, style.shell, 0, abdomenH / 2 + 0.35, 0);
        voxel(abdomen, abdomenW - 1.6, abdomenH - 1.4, 1.25, style.shell, 0, 0, abdomenD / 2 + 0.2);
        for (const z of [-abdomenD * 0.23, abdomenD * 0.18]) {
          voxel(abdomen, abdomenW + 0.5, 1.1, 1.5, style.accent, 0, abdomenH / 2 + 0.6, z);
        }
        for (const side of [-1, 1] as const) {
          voxel(abdomen, 1, abdomenH - 2, 2.8, style.shell, side * (abdomenW / 2 + 0.2), 0, 1.2);
        }
        abdomen.userData.baseY = abdomen.position.y;
        anim.segments.push(abdomen);

        // Broad armored head, brows, cheek blocks, and six always-visible
        // emissive eyes. Texture-pack skins still cover the underlying skull.
        const head = new THREE.Group();
        const skull = skinned(rigSkin, 8, 8, 8, style.body, 32, 4);
        skull.position.z = -4 * P;
        head.add(skull);
        voxel(head, 7.4, 1.4, 2, style.shell, 0, 3.4, -5.5);
        voxel(head, 2.2, 3.8, 1.3, style.accent, -3.25, -0.5, -7.55);
        voxel(head, 2.2, 3.8, 1.3, style.accent, 3.25, -0.5, -7.55);
        for (const [x, y, w] of [
          [-2.55, 1.45, 1.4], [2.55, 1.45, 1.4],
          [-1.15, 0.2, 1.05], [1.15, 0.2, 1.05],
          [-2.05, -1.05, 0.75], [2.05, -1.05, 0.75],
        ] as const) {
          glowVoxel(head, w, w, 0.55, style.eye, x, y, -8.25);
        }
        head.position.set(0, 9 * P, -3 * P); // vanilla head pivot
        anim.head = head;
        anim.headRestZ = -3 * P;

        // Paired jaw hinges and two-joint pedipalps make the lunge read in the
        // face, not only as translation of the whole creature.
        for (const side of [-1, 1] as const) {
          const jaw = new THREE.Group();
          jaw.position.set(side * 2.05 * P, -2.5 * P, -7.6 * P);
          jaw.rotation.y = side * 0.08;
          voxel(jaw, 1.65, 3.1, 1.8, style.shell, 0, -1.1, -0.55);
          voxel(jaw, 0.9, 2.3, 0.9, style.accent, side * 0.35, -3, -1.2);
          head.add(jaw);
          arachnid.mandibles.push({ obj: jaw, side, restY: jaw.rotation.y });

          const palp = new THREE.Group();
          palp.position.set(side * 3.1 * P, -1.8 * P, -6.7 * P);
          palp.rotation.set(-0.15, side * 0.2, side * -0.42);
          const upper = skinned(rigSkin, 3.8, 1.5, 1.5, style.leg, 18, 0, [16, 2, 2]);
          upper.geometry.translate(side * 1.9 * P, 0, 0);
          palp.add(upper);
          const palpTip = new THREE.Group();
          palpTip.position.x = side * 3.6 * P;
          palpTip.rotation.z = side * 0.55;
          const tip = voxel(palpTip, 2.8, 1.4, 1.4, style.accent);
          tip.geometry.translate(side * 1.25 * P, 0, 0);
          palp.add(palpTip);
          head.add(palp);
          arachnid.pedipalps.push({ obj: palp, side, restX: palp.rotation.x, restY: palp.rotation.y });
        }

        // Eight real three-joint legs. Each row has its own yaw, and each
        // segment carries a cap so the bends stay legible at game scale.
        for (const spec of ARACHNID_LEGS) {
          const upperLen = boss ? 6 : 5.4;
          const middleLen = boss ? 6.4 : 5.8;
          const lowerLen = boss ? 5.7 : 5.2;
          const hip = new THREE.Group();
          hip.position.set(spec.side * 2.8 * P, 8.1 * P, spec.attachZ * P);
          hip.rotation.set(0, spec.yaw, spec.side * 0.22);
          voxel(hip, 2.5, 2.7, 2.5, style.shell);
          const upper = skinned(rigSkin, upperLen, 2.1, 2.1, style.leg, 18, 0, [16, 2, 2]);
          upper.geometry.translate(spec.side * upperLen * 0.5 * P, 0, 0);
          hip.add(upper);

          const knee = new THREE.Group();
          knee.position.x = spec.side * upperLen * P;
          knee.rotation.z = spec.side * -0.8;
          voxel(knee, 2.45, 2.55, 2.45, style.accent);
          const middle = skinned(rigSkin, middleLen, 1.8, 1.8, style.leg, 18, 0, [16, 2, 2]);
          middle.geometry.translate(spec.side * middleLen * 0.5 * P, 0, 0);
          knee.add(middle);

          const ankle = new THREE.Group();
          ankle.position.x = spec.side * middleLen * P;
          ankle.rotation.z = spec.side * -0.13;
          voxel(ankle, 1.9, 2, 1.9, style.shell);
          const lower = skinned(rigSkin, lowerLen, 1.45, 1.45, style.leg, 18, 0, [16, 2, 2]);
          lower.geometry.translate(spec.side * lowerLen * 0.5 * P, 0, 0);
          ankle.add(lower);
          voxel(ankle, 2.1, 1.05, 2.5, style.shell, spec.side * (lowerLen + 0.4), -0.15, 0);
          voxel(ankle, 1.2, 0.8, 1, style.accent, spec.side * (lowerLen + 1.75), -0.25, -0.6);
          voxel(ankle, 1.2, 0.8, 1, style.accent, spec.side * (lowerLen + 1.75), -0.25, 0.6);

          knee.add(ankle);
          hip.add(knee);
          body.add(hip);
          arachnid.legs.push({
            side: spec.side,
            slot: spec.slot,
            phase: spec.phase,
            hip: { obj: hip, restX: 0, restY: spec.yaw, restZ: spec.side * 0.22 },
            knee: { obj: knee, restX: 0, restY: 0, restZ: spec.side * -0.8 },
            ankle: { obj: ankle, restX: 0, restY: 0, restZ: spec.side * -0.13 },
          });
        }

        // Every live arachnid gets authored geometry, rather than tinting the
        // same mesh. Features deliberately exaggerate their bestiary read.
        switch (style.feature) {
          case "bristles":
            for (const [x, z, h] of [[-3, -3.2, 2.2], [2.8, -2.2, 1.8], [-3.2, 1.2, 1.7], [2.7, 2.8, 2.1], [0, 3.8, 1.6]] as const) {
              const bristle = voxel(abdomen, 0.65, h, 0.65, style.accent, x, abdomenH / 2 + h / 2, z);
              bristle.rotation.z = x < 0 ? -0.18 : 0.18;
            }
            break;
          case "venom":
            for (const side of [-1, 1] as const) {
              voxel(abdomen, 3.2, 3, 4.1, style.accent, side * 2.35, -abdomenH / 2 + 0.4, 2.4);
              glowVoxel(abdomen, 1.7, 0.5, 2.5, "#67d9bb", side * 2.35, -abdomenH / 2 - 1.15, 1.8);
            }
            break;
          case "ore": {
            const ore = new THREE.MeshLambertMaterial({
              map: this.materials.texture("resource.rock.tin"),
            });
            for (const [x, y, z, sz] of [[-2.8, 4.9, -2.8, 3.7], [2.8, 5, 2, 3], [0.2, 5.5, 0, 3.4]] as const) {
              const nub = new THREE.Mesh(new THREE.BoxGeometry(sz * P, sz * 0.7 * P, sz * P), ore);
              nub.position.set(x * P, y * P, z * P);
              abdomen.add(nub);
            }
            for (const z of [-4.5, 0, 4]) voxel(abdomen, 1.7, 4.2, 1.7, style.shell, 0, abdomenH / 2 + 2.1, z);
            break;
          }
          case "gloom":
            for (const [x, z, h] of [[-2.8, -2.5, 3.8], [2.5, 1.5, 3], [0, 4, 2.4]] as const) {
              const crystal = voxel(abdomen, 1.8, h, 1.8, style.accent, x, abdomenH / 2 + h / 2, z);
              crystal.rotation.y = Math.PI / 4;
              glowVoxel(abdomen, 0.55, h * 0.75, 0.6, "#c06cff", x, abdomenH / 2 + h / 2, z - 0.95);
            }
            break;
          case "dust":
            for (const z of [-4, 0, 4]) voxel(abdomen, abdomenW + 1.1, 1.25, 2.2, style.accent, 0, abdomenH / 2 + 0.9, z);
            for (const side of [-1, 1] as const) {
              voxel(abdomen, 1.4, 2.5, 5.5, "#d0b77c", side * (abdomenW / 2 + 0.6), 0.4, 1.5);
            }
            break;
          case "vine":
            voxel(abdomen, 1.1, 0.75, abdomenD + 1, "#86a957", -2.4, abdomenH / 2 + 1.25, 0);
            voxel(abdomen, 1, abdomenH + 0.5, 0.8, "#557a3e", 3.1, 0, 0.8);
            for (const [x, y, z] of [[-3.4, 4.9, -3], [2.4, 5, 2.5], [-1.7, 4.8, 4.2]] as const) {
              voxel(abdomen, 2.2, 0.7, 1.5, style.accent, x, y, z);
            }
            break;
          case "thorn":
            for (const [x, z, h] of [[-2.8, -3.5, 3.5], [2.8, -1.2, 4.2], [-2.3, 2, 4], [2.1, 4, 3.3]] as const) {
              voxel(abdomen, 1.8, h * 0.58, 1.8, style.accent, x, abdomenH / 2 + h * 0.29, z);
              voxel(abdomen, 0.8, h * 0.42, 0.8, "#b08c56", x, abdomenH / 2 + h * 0.79, z);
            }
            break;
          case "ember":
            for (const [x, z, w] of [[-2.8, -3, 3], [2.6, 0, 2.6], [-1.4, 3.5, 3.4]] as const) {
              voxel(abdomen, w + 1, 1.1, 2.3, "#171616", x, abdomenH / 2 + 1, z);
              glowVoxel(abdomen, w, 0.42, 0.65, "#ff6428", x, abdomenH / 2 + 1.58, z - 0.35);
            }
            for (const side of [-1, 1] as const) {
              glowVoxel(thorax, 0.45, 2.5, 0.5, "#ff6428", side * 3.9, 0, -0.7);
            }
            break;
        }

        body.add(head, thorax, abdomen);
        return { barHeight: (boss ? 17 : 15) * P + 0.25, anim };
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
      // Night hunters (werewolves) hide while dormant in daylight — they
      // "appear" as the sun sets and vanish at dawn.
      const dormant = !!ENEMIES[enemy.defId]?.nightOnly && this.sim.daylight() > 0.25;
      view.group.visible = alive && !dormant;
      view.barGroup.visible = false;
      if (!alive || dormant) continue;

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
      const attackPulse = anim.lungeT > 0
        ? Math.sin((1 - Math.max(0, anim.lungeT) / 0.35) * Math.PI)
        : 0;
      if (anim.arachnid) {
        for (const leg of anim.arachnid.legs) {
          const gait = anim.walkPhase + leg.phase;
          const stride = moving
            ? Math.sin(gait)
            : Math.sin(this.elapsed * 1.6 + leg.slot * 0.8 + leg.side) * 0.035;
          const lift = moving ? Math.max(0, Math.cos(gait)) : 0;
          const frontStrike = leg.slot === 0 ? attackPulse : leg.slot === 1 ? attackPulse * 0.35 : 0;
          leg.hip.obj.rotation.x = leg.hip.restX + Math.sin(gait) * (moving ? 0.045 : 0.008);
          leg.hip.obj.rotation.y = leg.hip.restY + leg.side * stride * 0.16 + leg.side * frontStrike * 0.18;
          leg.hip.obj.rotation.z = leg.hip.restZ + leg.side * lift * 0.17 - leg.side * frontStrike * 0.12;
          leg.knee.obj.rotation.x = leg.knee.restX;
          leg.knee.obj.rotation.y = leg.knee.restY - leg.side * stride * 0.04;
          leg.knee.obj.rotation.z = leg.knee.restZ + leg.side * lift * 0.2 + leg.side * frontStrike * 0.16;
          leg.ankle.obj.rotation.x = leg.ankle.restX;
          leg.ankle.obj.rotation.y = leg.ankle.restY;
          leg.ankle.obj.rotation.z = leg.ankle.restZ - leg.side * lift * 0.1 - leg.side * frontStrike * 0.1;
        }
        for (const jaw of anim.arachnid.mandibles) {
          const idleGnash = Math.sin(this.elapsed * 2.3 + jaw.side) * 0.025;
          jaw.obj.rotation.y = jaw.restY + jaw.side * (attackPulse * 0.42 + idleGnash);
        }
        for (const palp of anim.arachnid.pedipalps) {
          palp.obj.rotation.x = palp.restX - attackPulse * 0.62
            + Math.sin(this.elapsed * 2 + palp.side) * 0.025;
          palp.obj.rotation.y = palp.restY + palp.side * attackPulse * 0.2;
        }
        anim.arachnid.abdomen.rotation.x = Math.sin(this.elapsed * 2.1) * 0.035 + attackPulse * 0.06;
        anim.arachnid.abdomen.rotation.z = Math.sin(this.elapsed * 1.35) * 0.018;
      } else if (anim.undead) {
        const idle = Math.sin(this.elapsed * 1.55);
        for (const leg of anim.undead.legs) {
          const step = moving
            ? Math.sin(anim.walkPhase + leg.phase)
            : Math.sin(this.elapsed * 1.25 + leg.phase) * 0.025;
          const kneeLift = moving ? Math.max(0, -step) : 0;
          leg.upper.rotation.x = leg.restUpperX + step * (moving ? 0.55 : 0.12);
          leg.upper.rotation.z = leg.restUpperZ + leg.side * Math.abs(step) * (moving ? 0.035 : 0.008);
          leg.lower.rotation.x = leg.restLowerX + kneeLift * 0.48;
          leg.lower.rotation.z = -leg.side * kneeLift * 0.025;
        }
        for (const arm of anim.undead.arms) {
          const counterStep = moving ? Math.sin(anim.walkPhase + arm.phase) : idle * 0.08;
          const unevenStrike = attackPulse * (arm.side === -1 ? 1 : 0.88);
          arm.upper.rotation.x = arm.restUpperX - counterStep * 0.24 + unevenStrike * 1.05;
          arm.upper.rotation.z = arm.restUpperZ + arm.side * (idle * 0.018 - unevenStrike * 0.08);
          arm.lower.rotation.x = arm.restLowerX + Math.max(0, counterStep) * 0.13 + unevenStrike * 0.62;
        }
        anim.undead.torso.rotation.y = moving ? Math.sin(anim.walkPhase) * 0.045 : idle * 0.018;
        anim.undead.torso.rotation.z = Math.sin(this.elapsed * 1.1) * 0.018;
        anim.undead.head.rotation.x = anim.undead.headRestX
          + Math.sin(this.elapsed * 1.7) * 0.025 - attackPulse * 0.11;
        anim.undead.head.rotation.z = anim.undead.headRestZ
          + Math.sin(this.elapsed * 1.25) * 0.025 + attackPulse * 0.045;
        for (const hanger of anim.undead.hangers) {
          const flutter = Math.sin(this.elapsed * (moving ? 6.2 : 1.8) + hanger.phase);
          hanger.obj.rotation.x = hanger.restX + flutter * (moving ? 0.13 : 0.035) - attackPulse * 0.08;
          hanger.obj.rotation.z = hanger.restZ + Math.sin(this.elapsed * 1.5 + hanger.phase) * 0.035;
        }
      } else if (anim.construct) {
        const idle = Math.sin(this.elapsed * 1.35);
        for (const leg of anim.construct.legs) {
          const step = moving
            ? Math.sin(anim.walkPhase + leg.phase)
            : Math.sin(this.elapsed * 1.05 + leg.phase) * 0.015;
          const compression = moving ? Math.max(0, -step) : 0;
          leg.upper.rotation.x = leg.restUpperX + step * (moving ? 0.38 : 0.08);
          leg.upper.rotation.z = leg.restUpperZ + leg.side * compression * 0.025;
          leg.lower.rotation.x = leg.restLowerX + compression * 0.32;
          leg.lower.rotation.z = -leg.side * compression * 0.018;
        }
        for (const arm of anim.construct.arms) {
          const counterStep = moving ? Math.sin(anim.walkPhase + arm.phase) : idle * 0.035;
          const slam = attackPulse * (arm.side === -1 ? 1 : 0.92);
          arm.upper.rotation.x = arm.restUpperX - counterStep * 0.2 + slam * 0.92;
          arm.upper.rotation.z = arm.restUpperZ - arm.side * slam * 0.075;
          arm.lower.rotation.x = arm.restLowerX + Math.max(0, counterStep) * 0.08 + slam * 0.56;
        }
        anim.construct.torso.rotation.y = moving ? Math.sin(anim.walkPhase) * 0.035 : idle * 0.012;
        anim.construct.torso.rotation.z = Math.sin(this.elapsed * 0.9) * 0.012;
        anim.construct.head.rotation.x = anim.construct.headRestX
          + Math.sin(this.elapsed * 1.15) * 0.018 - attackPulse * 0.08;
        anim.construct.head.rotation.z = anim.construct.headRestZ
          + Math.sin(this.elapsed * 0.8) * 0.015 + attackPulse * 0.035;
        for (const panel of anim.construct.panels) {
          panel.obj.rotation.y = panel.restY + panel.sign * attackPulse * 0.62;
        }
        const corePulse = 1 + Math.sin(this.elapsed * 3.2) * 0.035 + attackPulse * 0.16;
        anim.construct.core.scale.setScalar(corePulse);
        for (const gear of anim.construct.gears) {
          gear.obj.rotation.z += dt * gear.speed * ((moving ? 1.7 : 0.65) + attackPulse * 2.2);
        }
        for (const detail of anim.construct.details) {
          detail.obj.rotation.x = detail.restX
            + Math.sin(this.elapsed * (moving ? 4.5 : 1.4) + detail.phase) * (moving ? 0.1 : 0.03);
          detail.obj.rotation.z = detail.restZ
            + Math.sin(this.elapsed * 1.1 + detail.phase) * 0.035;
        }
      } else if (anim.ooze) {
        const bounce = moving ? Math.abs(Math.sin(anim.walkPhase * 0.65)) : 0;
        for (const segment of anim.ooze.segments) {
          const ripple = Math.sin(this.elapsed * 2.1 + segment.phase);
          const squash = bounce * 0.13 * segment.squash + ripple * 0.025 * segment.squash;
          segment.obj.position.y = segment.baseY
            + (bounce * 0.28 + ripple * 0.055 + attackPulse * 0.08) * PX;
          segment.obj.scale.set(
            1 + squash + attackPulse * 0.055,
            1 - squash * 1.25 - attackPulse * 0.08,
            1 + squash * 0.72 + attackPulse * 0.17,
          );
          segment.obj.rotation.z = ripple * 0.012 * segment.squash;
        }
        const corePulse = 1 + Math.sin(this.elapsed * 3.4) * 0.045 + attackPulse * 0.14;
        anim.ooze.core.scale.set(corePulse, corePulse * (1 - attackPulse * 0.08), corePulse);
        anim.ooze.core.rotation.y += dt * (moving ? 0.85 : 0.28);
        anim.ooze.mouth.scale.y = 1 + attackPulse * 2.1 + Math.max(0, Math.sin(this.elapsed * 1.7)) * 0.08;
        anim.ooze.mouth.scale.x = 1 - attackPulse * 0.1;
        for (let i = 0; i < anim.ooze.eyes.length; i++) {
          const eyePulse = 1 + Math.sin(this.elapsed * 3.2 + i) * 0.07 + attackPulse * 0.18;
          anim.ooze.eyes[i].scale.setScalar(eyePulse);
        }
        for (const detail of anim.ooze.details) {
          detail.obj.rotation.x = detail.restX
            + Math.sin(this.elapsed * (moving ? 4.2 : 1.25) + detail.phase) * (moving ? 0.12 : 0.035);
          detail.obj.rotation.z = detail.restZ
            + Math.sin(this.elapsed * 1.15 + detail.phase) * 0.045;
        }
      } else if (anim.canid) {
        const running = moving && enemy.engaged;
        const strideAmp = running ? 0.66 : moving ? 0.48 : 0.025;
        for (const leg of anim.canid.legs) {
          const step = moving
            ? Math.sin(anim.walkPhase + leg.phase)
            : Math.sin(this.elapsed * 1.3 + leg.phase) * 0.04;
          const lift = moving ? Math.max(0, -step) : 0;
          const foreStrike = leg.front ? attackPulse : 0;
          leg.upper.rotation.x = leg.restUpperX + step * strideAmp + foreStrike * 0.42;
          leg.upper.rotation.z = leg.restUpperZ + leg.side * lift * (running ? 0.045 : 0.025);
          leg.knee.rotation.x = leg.restKneeX + lift * (running ? 0.58 : 0.42) + foreStrike * 0.24;
          leg.ankle.rotation.x = leg.restAnkleX - lift * 0.28 - foreStrike * 0.18;
        }
        const breathing = Math.sin(this.elapsed * 1.9);
        anim.canid.trunk.rotation.x = moving ? Math.sin(anim.walkPhase * 2) * 0.022 : breathing * 0.012;
        anim.canid.trunk.rotation.z = moving ? Math.sin(anim.walkPhase) * 0.018 : breathing * 0.008;
        const neckBaseX = anim.canid.neck.userData.baseX as number;
        anim.canid.neck.rotation.x = neckBaseX + (running ? 0.08 : 0)
          + breathing * 0.018 - attackPulse * 0.1;
        anim.canid.head.rotation.x = anim.canid.headRestX
          + (running ? 0.045 : 0) + breathing * 0.018 - attackPulse * 0.13;
        anim.canid.head.rotation.z = anim.canid.headRestZ
          + Math.sin(this.elapsed * 1.15) * 0.018 + attackPulse * 0.035;
        anim.canid.jaw.rotation.x = attackPulse * 0.48
          + Math.max(0, Math.sin(this.elapsed * 1.6)) * (moving ? 0.045 : 0.02);
        for (const tail of anim.canid.tail) {
          const wagSpeed = running ? 8 : moving ? 5 : 2.3;
          const wagAmp = attackPulse > 0 ? 0.05 : running ? 0.18 : moving ? 0.28 : 0.36;
          tail.obj.rotation.x = tail.restX + Math.sin(this.elapsed * 1.7 + tail.phase) * 0.045
            + (running ? -0.08 : 0);
          tail.obj.rotation.y = tail.restY + Math.sin(this.elapsed * wagSpeed + tail.phase) * wagAmp;
          tail.obj.rotation.z = tail.restZ + Math.sin(this.elapsed * 1.4 + tail.phase) * 0.025;
        }
        for (const detail of anim.canid.details) {
          detail.obj.rotation.x = detail.restX
            + Math.sin(this.elapsed * (running ? 6 : 2) + detail.phase) * (running ? 0.08 : 0.035);
          detail.obj.rotation.z = detail.restZ
            + Math.sin(this.elapsed * 1.35 + detail.phase) * 0.035;
        }
      } else if (anim.ungulate) {
        const charging = moving && enemy.engaged;
        const strideAmp = charging ? 0.58 : moving ? 0.42 : 0.018;
        for (const leg of anim.ungulate.legs) {
          const step = moving
            ? Math.sin(anim.walkPhase + leg.phase)
            : Math.sin(this.elapsed * 1.05 + leg.phase) * 0.025;
          const lift = moving ? Math.max(0, -step) : 0;
          const foreStrike = leg.front ? attackPulse : 0;
          leg.upper.rotation.x = leg.restUpperX + step * strideAmp + foreStrike * 0.28;
          leg.upper.rotation.z = leg.restUpperZ
            + leg.side * lift * (charging ? 0.038 : 0.022);
          leg.knee.rotation.x = leg.restKneeX + lift * (charging ? 0.5 : 0.36)
            + foreStrike * 0.18;
          leg.ankle.rotation.x = leg.restAnkleX - lift * 0.24 - foreStrike * 0.13;
        }

        const breathing = Math.sin(this.elapsed * 1.45);
        const graze = !moving && !enemy.engaged
          ? Math.max(0, Math.sin(this.elapsed * 0.52))
          : 0;
        anim.ungulate.trunk.rotation.x = moving
          ? Math.sin(anim.walkPhase * 2) * (charging ? 0.026 : 0.018)
          : breathing * 0.01;
        anim.ungulate.trunk.rotation.z = moving
          ? Math.sin(anim.walkPhase) * 0.014
          : breathing * 0.006;
        anim.ungulate.neck.rotation.x = anim.ungulate.neckRestX
          + graze * 0.46 + (charging ? 0.06 : 0)
          - attackPulse * 0.13;
        anim.ungulate.head.position.y = anim.ungulate.headRestY - graze * 2.7 * PX;
        anim.ungulate.head.rotation.x = anim.ungulate.headRestX
          + graze * 0.34 + (charging ? 0.04 : 0)
          - attackPulse * 0.18;
        anim.ungulate.head.rotation.z = Math.sin(this.elapsed * 1.05) * 0.014
          + attackPulse * 0.028;
        anim.ungulate.jaw.rotation.x = attackPulse * 0.34
          + Math.max(0, Math.sin(this.elapsed * (graze > 0 ? 3.8 : 1.5)))
          * (graze > 0 ? 0.12 : 0.018);

        for (const tail of anim.ungulate.tail) {
          const swishSpeed = charging ? 6.5 : moving ? 4.2 : 1.65;
          const swishAmp = attackPulse > 0 ? 0.08 : charging ? 0.12 : moving ? 0.2 : 0.28;
          tail.obj.rotation.x = tail.restX
            + Math.sin(this.elapsed * 1.25 + tail.phase) * 0.035
            - (charging ? 0.04 : 0);
          tail.obj.rotation.y = tail.restY
            + Math.sin(this.elapsed * swishSpeed + tail.phase) * swishAmp;
          tail.obj.rotation.z = tail.restZ
            + Math.sin(this.elapsed * 1.1 + tail.phase) * 0.02;
        }
        for (const detail of anim.ungulate.details) {
          detail.obj.rotation.x = detail.restX
            + Math.sin(this.elapsed * (charging ? 5.4 : moving ? 3.6 : 1.3) + detail.phase)
            * (charging ? 0.085 : moving ? 0.055 : 0.025);
          detail.obj.rotation.z = detail.restZ
            + Math.sin(this.elapsed * 1.15 + detail.phase) * 0.025;
        }
      } else if (anim.raider) {
        const role = anim.raider.role;
        const brisk = moving && enemy.engaged;
        for (const leg of anim.raider.legs) {
          const step = moving
            ? Math.sin(anim.walkPhase + leg.phase)
            : Math.sin(this.elapsed * 1.15 + leg.phase) * 0.018;
          const lift = moving ? Math.max(0, -step) : 0;
          leg.hip.rotation.x = leg.restHipX + step * (brisk ? 0.55 : moving ? 0.42 : 0.06);
          leg.hip.rotation.z = leg.restHipZ + leg.side * lift * (brisk ? 0.035 : 0.02);
          leg.knee.rotation.x = leg.restKneeX + lift * (brisk ? 0.52 : 0.38);
          leg.foot.rotation.x = leg.restFootX - lift * 0.24;
        }

        const idle = Math.sin(this.elapsed * 1.35);
        const dummyWobble = role === "dummy" && view.shakeT > 0
          ? Math.sin(view.shakeT * 42) * view.shakeT * 0.8
          : 0;
        for (const arm of anim.raider.arms) {
          const counter = moving ? Math.sin(anim.walkPhase + arm.phase) : idle * 0.035;
          let attackShoulder = 0;
          let attackElbow = 0;
          let attackSpread = 0;
          if (role === "melee") {
            const primary = arm.side === 1 ? 1 : 0.45;
            attackShoulder = attackPulse * 1.35 * primary;
            attackElbow = attackPulse * 0.62 * primary;
            attackSpread = -arm.side * attackPulse * 0.12;
          } else if (role === "ranged") {
            const aim = enemy.engaged ? 0.28 : 0;
            attackShoulder = aim + attackPulse * (arm.side === 1 ? 0.9 : 0.72);
            attackElbow = aim * 0.85 + attackPulse * (arm.side === 1 ? 0.48 : 0.7);
            attackSpread = -arm.side * (aim * 0.2 + attackPulse * 0.08);
          } else if (role === "caster") {
            attackShoulder = attackPulse * 1.05;
            attackElbow = attackPulse * 0.72;
            attackSpread = -arm.side * attackPulse * 0.48;
          } else if (role === "trickster") {
            attackShoulder = attackPulse * (arm.side === -1 ? 1.2 : 0.82);
            attackElbow = attackPulse * (arm.side === -1 ? 0.75 : 0.38);
            attackSpread = arm.side * attackPulse * (arm.side === -1 ? 0.34 : -0.16);
          } else if (role === "alchemist") {
            attackShoulder = attackPulse * (arm.side === -1 ? 1.24 : 0.46);
            attackElbow = attackPulse * (arm.side === -1 ? 0.86 : 0.2);
            attackSpread = -arm.side * attackPulse * (arm.side === -1 ? 0.25 : 0.08);
          }
          arm.shoulder.rotation.x = arm.restShoulderX
            - counter * (role === "dummy" ? 0 : 0.22) + attackShoulder;
          arm.shoulder.rotation.z = arm.restShoulderZ + attackSpread
            + (role === "dummy" ? arm.side * dummyWobble * 0.16 : 0);
          arm.elbow.rotation.x = arm.restElbowX
            + Math.max(0, counter) * 0.16 + attackElbow;
          arm.elbow.rotation.z = arm.restElbowZ
            + (role === "dummy" ? -arm.side * dummyWobble * 0.08 : 0);
          arm.hand.rotation.y = role === "caster" || role === "trickster"
            ? arm.side * (idle * 0.025 + attackPulse * 0.18)
            : 0;
        }

        anim.raider.torso.rotation.y = role === "dummy"
          ? dummyWobble * 0.16
          : moving ? Math.sin(anim.walkPhase) * 0.045 : idle * 0.012;
        anim.raider.torso.rotation.z = role === "dummy"
          ? dummyWobble * 0.22
          : Math.sin(this.elapsed * 1.05) * 0.012 + attackPulse * (role === "melee" ? -0.045 : 0.018);
        anim.raider.torso.rotation.x = role === "dummy"
          ? -Math.abs(dummyWobble) * 0.08
          : moving ? Math.sin(anim.walkPhase * 2) * 0.012 : 0;
        anim.raider.head.rotation.x = anim.raider.headRestX
          + Math.sin(this.elapsed * 1.55) * (role === "dummy" ? 0.012 : 0.022)
          - attackPulse * (role === "ranged" ? 0.04 : 0.09)
          + dummyWobble * 0.18;
        anim.raider.head.rotation.z = anim.raider.headRestZ
          + Math.sin(this.elapsed * 1.1) * 0.015
          - dummyWobble * 0.25;

        for (const prop of anim.raider.props) {
          const focusMotion = prop.kind === "focus"
            ? Math.sin(this.elapsed * 2.2 + prop.phase) * 0.07
            : 0;
          const weaponStrike = prop.kind === "weapon"
            ? attackPulse * (role === "melee" ? -0.42 : role === "ranged" ? 0.08 : 0.12)
            : 0;
          prop.obj.rotation.x = prop.restX + weaponStrike
            + (prop.kind === "focus" ? attackPulse * 0.14 : 0);
          prop.obj.rotation.y = prop.restY + focusMotion
            + (prop.kind === "focus" ? attackPulse * (role === "trickster" ? 0.45 : 0.22) : 0);
          prop.obj.rotation.z = prop.restZ
            + Math.sin(this.elapsed * 1.4 + prop.phase) * (prop.kind === "cloth" ? 0.04 : 0.012)
            + (role === "ranged" && prop.kind === "weapon" ? attackPulse * -0.06 : 0);
        }
        if (anim.raider.focus) {
          const focusPulse = 1 + Math.sin(this.elapsed * 3.6) * 0.07 + attackPulse * 0.24;
          anim.raider.focus.scale.setScalar(focusPulse);
          anim.raider.focus.rotation.y += dt * (role === "trickster" ? 2.8 : 1.5);
        }
        for (const detail of anim.raider.details) {
          detail.obj.rotation.x = detail.restX
            + Math.sin(this.elapsed * (moving ? 4 : 1.45) + detail.phase) * (moving ? 0.08 : 0.035)
            - attackPulse * 0.045;
          detail.obj.rotation.z = detail.restZ
            + Math.sin(this.elapsed * 1.2 + detail.phase) * 0.035
            + dummyWobble * 0.1;
        }
      } else if (anim.flier) {
        const flier = anim.flier;
        const feature = flier.feature;
        const flightSpeed = feature === "honey_bee" ? 20
          : feature === "cave_bat" ? 12.5
            : feature === "rune_allay" ? 7.5 : 2.1;
        const flapAmp = feature === "cave_bat" ? 0.68
          : feature === "rune_allay" ? 0.43
            : feature === "honey_bee" ? 0.3 : 0;
        const hover = Math.sin(this.elapsed * (flier.motion === "swim" ? 2.2 : 2.8));
        const bobAmp = feature === "storm_ghast" ? 0.75
          : feature === "reef_squid" ? 0.42 : 0.62;
        flier.core.position.y = flier.coreRestY
          + (hover * bobAmp + attackPulse * 0.45) * PX;
        flier.core.rotation.x = flier.motion === "swim"
          ? Math.sin(this.elapsed * 1.5) * 0.055 - (moving ? 0.08 : 0)
          : moving ? Math.sin(anim.walkPhase * 0.55) * 0.035 : hover * 0.012;
        flier.core.rotation.z = feature === "storm_ghast"
          ? Math.sin(this.elapsed * 0.65) * 0.022
          : Math.sin(this.elapsed * 1.1) * (flier.motion === "swim" ? 0.04 : 0.018);
        flier.core.rotation.y = flier.motion === "swim"
          ? Math.sin(this.elapsed * 0.9) * 0.035
          : Math.sin(this.elapsed * 0.55) * 0.012;

        for (const wing of flier.wings) {
          const flap = Math.sin(this.elapsed * flightSpeed + wing.phase);
          const pairScale = wing.pair === 0 ? 1 : 0.78;
          const attackTuck = attackPulse * (feature === "honey_bee" ? 0.2 : 0.32);
          wing.root.rotation.x = wing.restRootX
            + Math.cos(this.elapsed * flightSpeed + wing.phase) * flapAmp * 0.12;
          wing.root.rotation.y = wing.restRootY
            + wing.side * attackTuck * 0.22;
          wing.root.rotation.z = wing.restRootZ
            + wing.side * flap * flapAmp * pairScale
            - wing.side * attackTuck;
          wing.mid.rotation.x = wing.restMidX
            - Math.cos(this.elapsed * flightSpeed + wing.phase) * flapAmp * 0.08;
          wing.mid.rotation.y = wing.restMidY
            + wing.side * flap * flapAmp * 0.08;
          wing.mid.rotation.z = wing.restMidZ
            - wing.side * flap * flapAmp * 0.42 * pairScale
            + wing.side * attackTuck * 0.24;
          wing.tip.rotation.x = wing.restTipX
            + Math.sin(this.elapsed * flightSpeed + wing.phase + 0.6) * flapAmp * 0.06;
          wing.tip.rotation.y = wing.restTipY;
          wing.tip.rotation.z = wing.restTipZ
            - wing.side * flap * flapAmp * 0.28 * pairScale;
        }

        for (const appendage of flier.appendages) {
          const swimSpeed = flier.motion === "swim" ? (moving ? 5.4 : 2.8)
            : feature === "honey_bee" ? 7.5
              : feature === "storm_ghast" ? 1.35 : 2.2;
          const wave = Math.sin(this.elapsed * swimSpeed + appendage.index * 0.78);
          const secondary = Math.cos(this.elapsed * swimSpeed * 0.72 + appendage.index * 0.9);
          const waveAmp = feature === "reef_squid" ? (moving ? 0.27 : 0.16)
            : feature === "storm_ghast" ? 0.11
              : feature === "honey_bee" ? 0.1 : 0.08;
          const attackFlare = attackPulse * (feature === "storm_ghast" ? 0.24 : 0.14);
          appendage.root.rotation.x = appendage.restRootX + wave * waveAmp + attackFlare;
          appendage.root.rotation.z = appendage.restRootZ
            + secondary * waveAmp * 0.75
            + Math.sign(appendage.restRootZ || (appendage.index % 2 === 0 ? 1 : -1)) * attackFlare * 0.4;
          appendage.mid.rotation.x = appendage.restMidX - wave * waveAmp * 0.8;
          appendage.mid.rotation.z = appendage.restMidZ + secondary * waveAmp * 0.85;
          appendage.tip.rotation.x = appendage.restTipX
            + Math.sin(this.elapsed * swimSpeed + appendage.index * 0.78 + 1.2) * waveAmp;
          appendage.tip.rotation.z = appendage.restTipZ - secondary * waveAmp * 0.65;
        }

        for (const fin of flier.fins) {
          const finStroke = Math.sin(this.elapsed * (moving ? 5.2 : 2.4) + fin.side * 0.7);
          fin.root.rotation.x = fin.restX + finStroke * 0.12;
          fin.root.rotation.y = fin.restY + fin.side * finStroke * (moving ? 0.24 : 0.13);
          fin.root.rotation.z = fin.restZ + fin.side * finStroke * 0.16
            + fin.side * attackPulse * 0.12;
        }

        flier.head.rotation.x = flier.headRestX
          + Math.sin(this.elapsed * 1.35) * 0.025
          - attackPulse * (feature === "storm_ghast" ? 0.12 : 0.08);
        flier.head.rotation.z = Math.sin(this.elapsed * 0.95) * 0.018
          + attackPulse * 0.025;
        if (flier.mouth) {
          flier.mouth.rotation.x = attackPulse * (feature === "cave_bat" ? 0.42 : 0.3)
            + Math.max(0, Math.sin(this.elapsed * 1.7)) * 0.025;
          flier.mouth.scale.y = 1 + attackPulse * (feature === "storm_ghast" ? 1.15 : 0.35);
          flier.mouth.scale.x = 1 - attackPulse * 0.08;
        }
        for (const detail of flier.details) {
          detail.obj.rotation.x = detail.restX
            + Math.sin(this.elapsed * (moving ? 5 : 1.8) + detail.phase) * (moving ? 0.11 : 0.055)
            - attackPulse * 0.06;
          detail.obj.rotation.z = detail.restZ
            + Math.sin(this.elapsed * 1.4 + detail.phase) * 0.06;
        }
      } else if (anim.boss) {
        const boss = anim.boss;
        const breathing = Math.sin(this.elapsed * 1.15);
        const charging = moving && enemy.engaged;
        boss.core.rotation.x = moving ? Math.sin(anim.walkPhase * 2) * 0.018 : breathing * 0.009;
        boss.core.rotation.z = moving ? Math.sin(anim.walkPhase) * 0.014 : breathing * 0.006;
        for (const leg of boss.legs) {
          const step = moving ? Math.sin(anim.walkPhase * 0.72 + leg.phase) : Math.sin(this.elapsed + leg.phase) * 0.025;
          const lift = moving ? Math.max(0, -step) : 0;
          leg.root.rotation.x = leg.restX + step * (charging ? 0.48 : moving ? 0.34 : 0.04) + attackPulse * 0.08;
          leg.root.rotation.z = leg.restZ + leg.side * lift * 0.035;
          leg.knee.rotation.x = lift * 0.45 - attackPulse * 0.08;
        }
        for (const [index, head] of boss.heads.entries()) {
          head.root.rotation.x = head.restX + Math.sin(this.elapsed * 1.05 + head.phase) * 0.035 - attackPulse * (0.16 + index * 0.02);
          head.root.rotation.y = head.restY + Math.sin(this.elapsed * 0.72 + head.phase) * 0.08 + attackPulse * ((index - (boss.heads.length - 1) / 2) * 0.06);
          head.jaw.rotation.x = attackPulse * 0.52 + Math.max(0, Math.sin(this.elapsed * 1.3 + head.phase)) * 0.035;
        }
        for (const wing of boss.wings) {
          const speed = moving ? 7.5 : 2.35;
          const amplitude = boss.feature === "fire_wyvern" ? 0.42 : boss.feature === "storm_twin" ? 0.36 : 0.25;
          const flap = Math.sin(this.elapsed * speed + wing.pair * 0.8);
          wing.root.rotation.z = wing.restZ + wing.side * flap * amplitude - wing.side * attackPulse * 0.18;
          wing.tip.rotation.z = wing.side * (-0.2 - flap * amplitude * 0.55 + attackPulse * 0.12);
          wing.root.rotation.x = Math.cos(this.elapsed * speed + wing.pair) * 0.055;
        }
        for (const tail of boss.tail) {
          const wave = Math.sin(this.elapsed * (moving ? 3.4 : 1.35) + tail.phase);
          tail.obj.rotation.y = tail.restY + wave * (moving ? 0.13 : 0.2) - attackPulse * 0.045;
          tail.obj.rotation.x = Math.cos(this.elapsed * 1.1 + tail.phase) * 0.025;
        }
        for (const detail of boss.details) {
          detail.obj.rotation.x = detail.restX + Math.sin(this.elapsed * 1.45 + detail.phase) * 0.025 - attackPulse * 0.025;
          detail.obj.rotation.z = detail.restZ + Math.sin(this.elapsed * 1.15 + detail.phase) * 0.028;
        }
        if (boss.feature === "deep_warden") {
          const pulse = 1 + Math.sin(this.elapsed * 2.8) * 0.018 + attackPulse * 0.055;
          boss.core.scale.set(pulse, 1 - (pulse - 1) * 0.45, pulse);
        }
      } else if (anim.signature) {
        const signature = anim.signature;
        const feature = signature.feature;
        const strideAmp = feature === "roosthen" ? (moving ? 0.62 : 0.03)
          : feature === "ironback" ? (moving ? 0.42 : 0.02)
            : feature === "siege_beast" ? (moving ? 0.4 : 0.015)
              : moving ? 0.48 : 0.02;
        for (const leg of signature.legs) {
          const step = moving
            ? Math.sin(anim.walkPhase + leg.phase)
            : Math.sin(this.elapsed * 1.1 + leg.phase) * 0.02;
          const lift = moving ? Math.max(0, -step) : 0;
          const foreStrike = leg.front ? attackPulse : 0;
          leg.hip.rotation.x = leg.restHipX + step * strideAmp
            + foreStrike * (feature === "siege_beast" ? 0.32 : 0.18);
          leg.hip.rotation.z = leg.restHipZ + leg.side * lift * 0.025;
          leg.knee.rotation.x = leg.restKneeX + lift * (feature === "roosthen" ? 0.58 : 0.4)
            + foreStrike * 0.16;
          leg.foot.rotation.x = leg.restFootX - lift * 0.25 - foreStrike * 0.1;
        }

        const breathing = Math.sin(this.elapsed * 1.45);
        const sniff = feature === "root_sniffer" && !moving && !enemy.engaged
          ? Math.max(0, Math.sin(this.elapsed * 0.72))
          : 0;
        signature.core.rotation.x = moving
          ? Math.sin(anim.walkPhase * 2) * (feature === "siege_beast" ? 0.018 : 0.025)
          : breathing * 0.009;
        signature.core.rotation.z = moving
          ? Math.sin(anim.walkPhase) * (feature === "ironback" ? 0.025 : 0.014)
          : breathing * 0.006;
        signature.core.rotation.y = feature === "moss_stalker"
          ? Math.sin(this.elapsed * 0.8) * 0.018
          : 0;
        const swell = feature === "moss_stalker" ? 1 + attackPulse * 0.075 : 1;
        signature.core.scale.set(swell, feature === "moss_stalker" ? 1 - attackPulse * 0.035 : 1, swell);

        signature.head.position.y = signature.headRestY - sniff * 2.8 * PX;
        signature.head.rotation.x = signature.headRestX
          + sniff * 0.38
          + Math.sin(this.elapsed * 1.2) * 0.018
          - attackPulse * (feature === "siege_beast" ? 0.2 : 0.11);
        signature.head.rotation.z = Math.sin(this.elapsed * 0.9) * 0.012
          + attackPulse * 0.025;
        if (signature.jaw) {
          signature.jaw.rotation.x = attackPulse * (feature === "siege_beast" ? 0.42 : 0.3)
            + sniff * Math.max(0, Math.sin(this.elapsed * 4.2)) * 0.08;
          signature.jaw.scale.y = 1 + attackPulse * (feature === "moss_stalker" ? 0.5 : 0.15);
        }

        for (const wing of signature.wings) {
          const wingSpeed = moving ? 9.5 : 2.8;
          const flap = Math.abs(Math.sin(this.elapsed * wingSpeed));
          wing.root.rotation.x = wing.restRootX + flap * (moving ? 0.48 : 0.12)
            + attackPulse * 0.35;
          wing.root.rotation.z = wing.restRootZ + wing.side * flap * (moving ? 0.22 : 0.08);
          wing.tip.rotation.x = wing.restTipX - flap * (moving ? 0.28 : 0.08);
          wing.tip.rotation.z = wing.restTipZ - wing.side * flap * 0.1;
        }
        for (const tail of signature.tail) {
          const wag = Math.sin(this.elapsed * (moving ? 4.5 : 1.7) + tail.phase);
          tail.obj.rotation.x = tail.restX + wag * (moving ? 0.07 : 0.035);
          tail.obj.rotation.y = tail.restY + wag * (moving ? 0.16 : 0.22)
            - attackPulse * 0.08;
          tail.obj.rotation.z = tail.restZ + Math.sin(this.elapsed * 1.2 + tail.phase) * 0.025;
        }
        for (const detail of signature.details) {
          detail.obj.rotation.x = detail.restX
            + Math.sin(this.elapsed * (moving ? 4.2 : 1.5) + detail.phase) * (moving ? 0.09 : 0.035)
            - attackPulse * 0.045;
          detail.obj.rotation.z = detail.restZ
            + Math.sin(this.elapsed * 1.2 + detail.phase) * 0.04;
        }
      } else {
        anim.legs.forEach((leg, i) => {
          leg.rotation.x = moving ? (i % 2 === 0 ? swing : -swing) : leg.rotation.x * 0.8;
        });
      }
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
      // Rabbits and frogs travel in hop arcs: airborne on the stride beat.
      if (anim.hopper) {
        anim.body.position.y = moving ? Math.abs(Math.sin(anim.walkPhase * 1.4)) * 0.28 : 0;
      }
      // Ghost-lights drift: a slow bob well above the ground, never walking.
      if (anim.floater) {
        anim.body.position.y = 0.35 + Math.sin(this.elapsed * 1.8) * 0.12;
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
  /** Sprite of the tool the current skill action wields, if any. */
  private actionToolSprite: string | null = null;

  private syncHeldItem(): void {
    const itemId = this.sim.equippedTool;
    const spriteId = this.holdTorch
      ? "sprite.item.torch"
      : this.actionToolSprite
        ?? (itemId ? HELD_SPRITES[itemId] : undefined);
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
        case "logBurned": {
          // Kindling gesture + a real fire left burning at your feet.
          this.oneShotAnim = { kind: "gather", remainS: 1.1 };
          const at = ev.cell ?? this.sim.movement.currentCell();
          const fireGroup = new THREE.Group();
          const logMat = this.lambert("resource.tree.log.side");
          for (const angle of [Math.PI / 4, -Math.PI / 4]) {
            const log = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.2), logMat);
            log.rotation.y = angle;
            log.position.y = 0.07;
            fireGroup.add(log);
          }
          const flame = this.crossSprite("sprite.flame");
          flame.group.position.y = 0.1;
          fireGroup.add(flame.group);
          fireGroup.position.set(at.x + 0.5, this.sim.world.surfaceY(at), at.z + 0.5);
          this.scene.add(fireGroup);
          this.flameGroups.push(flame.group);
          this.tempFires.push({ group: fireGroup, flame: flame.group, remainS: 60 });
          break;
        }
        case "bonesBuried":
          this.oneShotAnim = { kind: "dig", remainS: 1.1 };
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
      // In the saddle the player sits on the mount's back.
      targetY: cellH + (this.sim.activeMount() ? 0.55 : 0),
      facing: this.sim.movement.facing,
      moving: this.sim.movement.isMoving() && !boating, // sitting, not walking
      action: this.sim.actions.currentActionAnim() ?? this.oneShotAnim?.kind ?? null,
    });
    // Tool-in-hand: while a skill action plays, the matching tool appears in
    // the swing hand (axe to chop, pick to mine, rod to fish, hammer to
    // smith, hoe to dig) and the equipped weapon returns when it ends.
    {
      const act = this.sim.actions.currentActionAnim() ?? this.oneShotAnim?.kind ?? null;
      const sprite = act === "chop" ? "sprite.item.axe"
        : act === "mine" ? "sprite.item.pickaxe"
        : act === "fish" || act === "cast" ? "sprite.item.rod"
        : act === "hammer" ? "sprite.item.hammer"
        : act === "dig" ? "sprite.item.hoe"
        : null;
      if (sprite !== this.actionToolSprite) {
        this.actionToolSprite = sprite;
        this.syncHeldItem();
      }
    }
    this.updatePlayerBoat(boating ? this.sim.bestBoat()!.itemId : null, pos, this.playerView.group.position.y);

    // Portal membranes breathe so an active gate visibly shimmers.
    if (this.portalGlows.length > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.4);
      for (const g of this.portalGlows) g.mat.opacity = g.base + g.amp * pulse;
    }

    this.updateQuestGuidance();
    this.updateCompanions(dt);
    if (this.oneShotAnim) {
      this.oneShotAnim.remainS -= dt;
      if (this.oneShotAnim.remainS <= 0) this.oneShotAnim = null;
    }
    // Struck fires burn down and wink out.
    for (let i = this.tempFires.length - 1; i >= 0; i--) {
      const fire = this.tempFires[i];
      fire.remainS -= dt;
      if (fire.remainS < 6) fire.group.scale.setScalar(Math.max(0.25, fire.remainS / 6));
      if (fire.remainS <= 0) {
        this.scene.remove(fire.group);
        this.disposeGroupResources(fire.group, false);
        this.flameGroups = this.flameGroups.filter((g) => g !== fire.flame);
        this.tempFires.splice(i, 1);
      }
    }

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
        // Unplowed ground shows bare soil, no sprout at all.
        view.depletedMesh.scale.setScalar(node.plowed ? 0.2 + progress * 0.8 : 0.001);
      }
      if (node && grow && view.soilPad) {
        view.soilPad.material = this.lambert(node.plowed ? "terrain.farmland" : "terrain.dirt");
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
