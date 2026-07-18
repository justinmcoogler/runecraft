/** Original RuneCraft boss silhouettes. These are code-native rigs, not retained imports. */
export type BossFeature = "fire_wyvern" | "ice_drake" | "hydra" | "storm_twin" | "deep_warden";

export interface BossStyle {
  feature: BossFeature;
  body: string;
  dark: string;
  plate: string;
  accent: string;
  glow: string;
  bodyWidth: number;
  bodyHeight: number;
  bodyLength: number;
  legHeight: number;
  necks: number;
  wingPairs: number;
  tailSegments: number;
}

export const BOSS_ENEMY_IDS = [
  "enemy.dragon.fire",
  "enemy.dragon.ice",
  "enemy.dragon.hydra",
  "enemy.dragon.twoheaded",
  "enemy.warden",
] as const;

const STYLES: Record<(typeof BOSS_ENEMY_IDS)[number], BossStyle> = {
  "enemy.dragon.fire": {
    feature: "fire_wyvern", body: "#6e281d", dark: "#251717", plate: "#a54822",
    accent: "#dc792c", glow: "#ffbd43", bodyWidth: 22, bodyHeight: 14, bodyLength: 34,
    legHeight: 19, necks: 1, wingPairs: 1, tailSegments: 7,
  },
  "enemy.dragon.ice": {
    feature: "ice_drake", body: "#7396a9", dark: "#253b4b", plate: "#b8d8df",
    accent: "#d9f4f3", glow: "#73f4ff", bodyWidth: 16, bodyHeight: 12, bodyLength: 42,
    legHeight: 16, necks: 1, wingPairs: 2, tailSegments: 9,
  },
  "enemy.dragon.hydra": {
    feature: "hydra", body: "#48663d", dark: "#1d3023", plate: "#78925a",
    accent: "#9dbb62", glow: "#d6f35c", bodyWidth: 27, bodyHeight: 16, bodyLength: 31,
    legHeight: 15, necks: 3, wingPairs: 0, tailSegments: 5,
  },
  "enemy.dragon.twoheaded": {
    feature: "storm_twin", body: "#394153", dark: "#161c28", plate: "#68758c",
    accent: "#8e70b2", glow: "#5de7ff", bodyWidth: 24, bodyHeight: 15, bodyLength: 35,
    legHeight: 18, necks: 2, wingPairs: 1, tailSegments: 6,
  },
  "enemy.warden": {
    feature: "deep_warden", body: "#25383a", dark: "#111d22", plate: "#415b59",
    accent: "#60775f", glow: "#59eff1", bodyWidth: 24, bodyHeight: 20, bodyLength: 14,
    legHeight: 21, necks: 0, wingPairs: 0, tailSegments: 0,
  },
};

export function bossStyleFor(enemyId?: string): BossStyle | undefined {
  return STYLES[enemyId as keyof typeof STYLES];
}
