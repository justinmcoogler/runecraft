/** Exact RuneCraft combat-canid identities and authored voxel silhouettes. */

export const CANID_ENEMY_IDS = [
  "enemy.timber_wolf",
  "enemy.frost_wolf",
  "enemy.dire_wolf",
  "enemy.ash_hound",
] as const;

export type CanidEnemyId = (typeof CANID_ENEMY_IDS)[number];
export type CanidFeature = "timber" | "frost" | "dire" | "ash";

export interface CanidStyle {
  feature: CanidFeature;
  fur: string;
  dark: string;
  ruff: string;
  accent: string;
  eye: string;
  bodyWidth: number;
  bodyHeight: number;
  bodyLength: number;
  limbWidth: number;
  headWidth: number;
}

export const CANID_STYLES: Record<CanidEnemyId, CanidStyle> = {
  "enemy.timber_wolf": {
    feature: "timber",
    fur: "#81766b", dark: "#4a443e", ruff: "#62584f", accent: "#8b6845", eye: "#d9c36a",
    bodyWidth: 7.2, bodyHeight: 7, bodyLength: 13.2, limbWidth: 2.5, headWidth: 6.4,
  },
  "enemy.frost_wolf": {
    feature: "frost",
    fur: "#dce6ea", dark: "#718594", ruff: "#a9c5d2", accent: "#74c8e8", eye: "#66efff",
    bodyWidth: 8.2, bodyHeight: 8, bodyLength: 14, limbWidth: 2.8, headWidth: 6.8,
  },
  "enemy.dire_wolf": {
    feature: "dire",
    fur: "#383d44", dark: "#20252b", ruff: "#4c535d", accent: "#88765e", eye: "#e4533f",
    bodyWidth: 10, bodyHeight: 9, bodyLength: 15.2, limbWidth: 3.5, headWidth: 7.8,
  },
  "enemy.ash_hound": {
    feature: "ash",
    fur: "#4d3431", dark: "#211f20", ruff: "#352929", accent: "#8b3e2e", eye: "#ff702f",
    bodyWidth: 7.7, bodyHeight: 7.3, bodyLength: 14.6, limbWidth: 2.75, headWidth: 6.7,
  },
};

export function canidStyleFor(defId: string | undefined): CanidStyle | undefined {
  if (!defId || !(defId in CANID_STYLES)) return undefined;
  return CANID_STYLES[defId as CanidEnemyId];
}
