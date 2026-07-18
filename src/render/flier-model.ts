/** Exact RuneCraft airborne and aquatic silhouettes. */

export const FLIER_ENEMY_IDS = [
  "enemy.bat",
  "enemy.allay",
  "enemy.bee",
  "enemy.ghast",

] as const;

export type FlierEnemyId = (typeof FLIER_ENEMY_IDS)[number];
export type FlierFeature = "cave_bat" | "rune_allay" | "honey_bee" | "storm_ghast" | "reef_squid";
export type FlierMotion = "fly" | "hover" | "drift" | "swim";

export interface FlierStyle {
  feature: FlierFeature;
  motion: FlierMotion;
  body: string;
  dark: string;
  membrane: string;
  accent: string;
  glow: string;
  bodyWidth: number;
  bodyHeight: number;
  bodyLength: number;
  wingPairs: number;
  appendageCount: number;
}

export const FLIER_STYLES: Record<FlierEnemyId, FlierStyle> = {
  "enemy.bat": {
    feature: "cave_bat", motion: "fly",
    body: "#594452", dark: "#201d29", membrane: "#776174", accent: "#a37f6f", glow: "#e3a35a",
    bodyWidth: 5.8, bodyHeight: 6.8, bodyLength: 7.8, wingPairs: 1, appendageCount: 2,
  },
  "enemy.allay": {
    feature: "rune_allay", motion: "hover",
    body: "#5fa8bb", dark: "#23536c", membrane: "#a8e4e7", accent: "#d7f0df", glow: "#76f3e6",
    bodyWidth: 5.6, bodyHeight: 10.4, bodyLength: 4.8, wingPairs: 2, appendageCount: 2,
  },
  "enemy.bee": {
    feature: "honey_bee", motion: "hover",
    body: "#d9a83f", dark: "#342a24", membrane: "#d8edf0", accent: "#f1cb5a", glow: "#f4e6a1",
    bodyWidth: 7.4, bodyHeight: 6.1, bodyLength: 10.8, wingPairs: 2, appendageCount: 6,
  },
  "enemy.ghast": {
    feature: "storm_ghast", motion: "drift",
    body: "#c9ccd1", dark: "#3d414b", membrane: "#8994a3", accent: "#726779", glow: "#e9675e",
    bodyWidth: 18.5, bodyHeight: 14.2, bodyLength: 17.2, wingPairs: 0, appendageCount: 9,
  },
};

export function flierStyleFor(defId: string | undefined): FlierStyle | undefined {
  if (!defId || !(defId in FLIER_STYLES)) return undefined;
  return FLIER_STYLES[defId as FlierEnemyId];
}
