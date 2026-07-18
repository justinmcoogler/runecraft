/** Native voxel-undead identities and proportions used by the renderer. */

export const HUSK_UNDEAD_ENEMY_IDS = [
  "enemy.grave_shambler",
  "enemy.hollow_wight",
  "enemy.mire_husk",
  "enemy.dune_husk",
  "enemy.spore_shambler",
  "enemy.glacial_wight",
] as const;

export const BASE_UNDEAD_ENEMY_IDS = [
  "enemy.zombie",
  "enemy.skeleton",
  "enemy.drowned",
  "enemy.stray",
] as const;

export const NATIVE_UNDEAD_ENEMY_IDS = [
  ...BASE_UNDEAD_ENEMY_IDS,
  ...HUSK_UNDEAD_ENEMY_IDS,
  "enemy.barrow_lord",
] as const;

export type NativeUndeadEnemyId = (typeof NATIVE_UNDEAD_ENEMY_IDS)[number];

export type UndeadFeature =
  | "zombie"
  | "skeleton"
  | "drowned"
  | "stray"
  | "grave"
  | "hollow"
  | "mire"
  | "dune"
  | "spore"
  | "glacial"
  | "barrow";

export interface UndeadStyle {
  feature: UndeadFeature;
  bone: string;
  flesh: string;
  cloth: string;
  shadow: string;
  accent: string;
  eye: string;
  torsoWidth: number;
  shoulderWidth: number;
  armWidth: number;
  legWidth: number;
  /** Forward hunch in model pixels; front is negative z. */
  hunch: number;
}

export const NATIVE_UNDEAD_STYLES: Record<NativeUndeadEnemyId, UndeadStyle> = {
  "enemy.zombie": {
    feature: "zombie",
    bone: "#a39b7d", flesh: "#557447", cloth: "#36577a", shadow: "#18241a",
    accent: "#6c4a67", eye: "#b5e36a",
    torsoWidth: 8.3, shoulderWidth: 10.8, armWidth: 3.7, legWidth: 3.8, hunch: 1.1,
  },
  "enemy.skeleton": {
    feature: "skeleton",
    bone: "#d7d2bc", flesh: "#aaa58f", cloth: "#47443d", shadow: "#24231f",
    accent: "#8d8269", eye: "#e5bc63",
    torsoWidth: 7.2, shoulderWidth: 9.4, armWidth: 2.1, legWidth: 2.25, hunch: 0.2,
  },
  "enemy.drowned": {
    feature: "drowned",
    bone: "#8aa7a0", flesh: "#3f7770", cloth: "#31565d", shadow: "#162d32",
    accent: "#b28d53", eye: "#69e6d6",
    torsoWidth: 9.4, shoulderWidth: 12.1, armWidth: 4.15, legWidth: 4, hunch: 1.45,
  },
  "enemy.stray": {
    feature: "stray",
    bone: "#d3e0df", flesh: "#95a9ad", cloth: "#3d5665", shadow: "#17262f",
    accent: "#7fa6b2", eye: "#75e8ff",
    torsoWidth: 7.8, shoulderWidth: 10.4, armWidth: 2.45, legWidth: 2.65, hunch: 0.35,
  },
  "enemy.grave_shambler": {
    feature: "grave",
    bone: "#aaa28c", flesh: "#4a5548", cloth: "#302e2c", shadow: "#171916",
    accent: "#687745", eye: "#b7ef62",
    torsoWidth: 8.5, shoulderWidth: 10.5, armWidth: 3, legWidth: 3.4, hunch: 1.2,
  },
  "enemy.hollow_wight": {
    feature: "hollow",
    bone: "#d8dbd5", flesh: "#758895", cloth: "#405667", shadow: "#10171e",
    accent: "#789bad", eye: "#70dfff",
    torsoWidth: 7.4, shoulderWidth: 9.2, armWidth: 2.35, legWidth: 2.7, hunch: 0.7,
  },
  "enemy.mire_husk": {
    feature: "mire",
    bone: "#92977a", flesh: "#5f7355", cloth: "#303830", shadow: "#182019",
    accent: "#674f39", eye: "#d2ec65",
    torsoWidth: 10.5, shoulderWidth: 13, armWidth: 4.8, legWidth: 4.7, hunch: 1.8,
  },
  "enemy.dune_husk": {
    feature: "dune",
    bone: "#c8aa73", flesh: "#9a7952", cloth: "#8d5636", shadow: "#35261e",
    accent: "#d0a15e", eye: "#ff9a35",
    torsoWidth: 8.2, shoulderWidth: 10.2, armWidth: 2.9, legWidth: 3.25, hunch: 0.8,
  },
  "enemy.spore_shambler": {
    feature: "spore",
    bone: "#b7acb7", flesh: "#66546b", cloth: "#343038", shadow: "#211b25",
    accent: "#9c6398", eye: "#ef68ff",
    torsoWidth: 8.7, shoulderWidth: 11.4, armWidth: 3.15, legWidth: 3.4, hunch: 1.4,
  },
  "enemy.glacial_wight": {
    feature: "glacial",
    bone: "#d8edf2", flesh: "#84a9bb", cloth: "#26394f", shadow: "#12212e",
    accent: "#67c2e8", eye: "#65f0ff",
    torsoWidth: 10.2, shoulderWidth: 13.2, armWidth: 4, legWidth: 4.2, hunch: 0.4,
  },
  "enemy.barrow_lord": {
    feature: "barrow",
    bone: "#d5d2c6", flesh: "#66636c", cloth: "#302741", shadow: "#17131d",
    accent: "#b8954e", eye: "#83d9ff",
    torsoWidth: 9.2, shoulderWidth: 12.2, armWidth: 3.15, legWidth: 3.3, hunch: 0.2,
  },
};

export function undeadStyleFor(defId: string | undefined): UndeadStyle | undefined {
  if (!defId || !(defId in NATIVE_UNDEAD_STYLES)) return undefined;
  return NATIVE_UNDEAD_STYLES[defId as NativeUndeadEnemyId];
}
