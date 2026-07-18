/**
 * Data shared by the native arachnid voxel rig and its focused coverage test.
 * Geometry stays in renderer.ts because it needs the active entity-skin
 * resolver, but variant identity and the eight-leg gait are explicit here.
 */

export const ARACHNID_ENEMY_IDS = [
  "enemy.spider",
  "enemy.cave_spider",
  "enemy.old_gnasher",
  "enemy.gloom_spinner",
  "enemy.dust_scuttler",
  "enemy.vine_stalker",
  "enemy.thornback",
  "enemy.ember_crawler",
] as const;

export type ArachnidEnemyId = (typeof ARACHNID_ENEMY_IDS)[number];

export type ArachnidFeature =
  | "bristles"
  | "venom"
  | "ore"
  | "gloom"
  | "dust"
  | "vine"
  | "thorn"
  | "ember";

export interface ArachnidStyle {
  body: string;
  shell: string;
  leg: string;
  accent: string;
  eye: string;
  feature: ArachnidFeature;
  /** Abdomen dimensions in model pixels (16 px = one world block). */
  abdomen: readonly [number, number, number];
}

export const ARACHNID_STYLES: Record<ArachnidEnemyId, ArachnidStyle> = {
  "enemy.spider": {
    body: "#3d3630", shell: "#292421", leg: "#332d28",
    accent: "#5a4a40", eye: "#d43b2f", feature: "bristles", abdomen: [10, 8, 12],
  },
  "enemy.cave_spider": {
    body: "#234f55", shell: "#18383d", leg: "#1e454a",
    accent: "#4f8d86", eye: "#ef4058", feature: "venom", abdomen: [9, 7, 11],
  },
  "enemy.old_gnasher": {
    body: "#3a2f26", shell: "#241e1a", leg: "#2e2620",
    accent: "#8a7763", eye: "#ff5a2a", feature: "ore", abdomen: [12, 9, 14],
  },
  "enemy.gloom_spinner": {
    body: "#332a3d", shell: "#211b29", leg: "#2b2434",
    accent: "#7f4fa8", eye: "#c86cff", feature: "gloom", abdomen: [12, 9, 14],
  },
  "enemy.dust_scuttler": {
    body: "#806947", shell: "#51442f", leg: "#6a563c",
    accent: "#c0a06b", eye: "#e65d36", feature: "dust", abdomen: [10, 7, 12],
  },
  "enemy.vine_stalker": {
    body: "#30472b", shell: "#1f3020", leg: "#293d26",
    accent: "#66884b", eye: "#e04d3f", feature: "vine", abdomen: [11, 8, 13],
  },
  "enemy.thornback": {
    body: "#4b3d2b", shell: "#30271d", leg: "#403323",
    accent: "#8a7045", eye: "#e54732", feature: "thorn", abdomen: [11, 8, 13],
  },
  "enemy.ember_crawler": {
    body: "#322725", shell: "#1d1919", leg: "#292120",
    accent: "#8d3828", eye: "#ff6a2e", feature: "ember", abdomen: [11, 8, 13],
  },
};

/** One attachment row on each side of the thorax. */
const LEG_ROWS = [
  { attachZ: -2.6, yaw: 0.62 },
  { attachZ: -0.8, yaw: 0.22 },
  { attachZ: 1.2, yaw: -0.2 },
  { attachZ: 3.1, yaw: -0.58 },
] as const;

export interface ArachnidLegSpec {
  side: -1 | 1;
  slot: number;
  attachZ: number;
  yaw: number;
  phase: number;
}

/**
 * Four mirrored rows make eight independently articulated legs. Phase is a
 * diagonal tetrapod gait: four feet support while the other four advance.
 */
export const ARACHNID_LEGS: readonly ArachnidLegSpec[] = ([-1, 1] as const).flatMap((side) =>
  LEG_ROWS.map((row, slot) => ({
    side,
    slot,
    attachZ: row.attachZ,
    yaw: side * row.yaw,
    phase: ((slot + (side === 1 ? 1 : 0)) % 2) * Math.PI,
  })),
);

export function arachnidStyleFor(defId: string | undefined, boss = false): ArachnidStyle {
  if (defId && defId in ARACHNID_STYLES) return ARACHNID_STYLES[defId as ArachnidEnemyId];
  return boss ? ARACHNID_STYLES["enemy.old_gnasher"] : ARACHNID_STYLES["enemy.spider"];
}
