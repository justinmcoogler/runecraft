/** Exact RuneCraft raider, caster and training-effigy silhouettes. */

export const RAIDER_ENEMY_IDS = [
  "enemy.pillager",
  "enemy.vindicator",
  "enemy.evoker",
  "enemy.illusioner",
  "enemy.witch",
  "enemy.target_dummy",
] as const;

export type RaiderEnemyId = (typeof RAIDER_ENEMY_IDS)[number];
export type RaiderFeature = "marksman" | "reaver" | "runecaller" | "mirage" | "hedgewitch" | "effigy";
export type RaiderRole = "ranged" | "melee" | "caster" | "trickster" | "alchemist" | "dummy";

export interface RaiderStyle {
  feature: RaiderFeature;
  role: RaiderRole;
  skin: string;
  dark: string;
  cloth: string;
  accent: string;
  metal: string;
  glow: string;
  torsoWidth: number;
  torsoHeight: number;
  shoulderWidth: number;
  headWidth: number;
  legWidth: number;
}

export const RAIDER_STYLES: Record<RaiderEnemyId, RaiderStyle> = {
  "enemy.pillager": {
    feature: "marksman", role: "ranged",
    skin: "#9b8170", dark: "#252a30", cloth: "#41515b", accent: "#8b6340", metal: "#9ca5a8", glow: "#d5a85f",
    torsoWidth: 8.8, torsoHeight: 10.4, shoulderWidth: 12.8, headWidth: 7.1, legWidth: 3.4,
  },
  "enemy.vindicator": {
    feature: "reaver", role: "melee",
    skin: "#a37d68", dark: "#2e2927", cloth: "#65352f", accent: "#a6573d", metal: "#b8b7ad", glow: "#e08b4a",
    torsoWidth: 9.8, torsoHeight: 11.2, shoulderWidth: 14.4, headWidth: 7.5, legWidth: 3.9,
  },
  "enemy.evoker": {
    feature: "runecaller", role: "caster",
    skin: "#8b746c", dark: "#20262c", cloth: "#d5c9ab", accent: "#31756f", metal: "#bcae88", glow: "#61e0c6",
    torsoWidth: 8.4, torsoHeight: 11.8, shoulderWidth: 12.2, headWidth: 6.8, legWidth: 3.2,
  },
  "enemy.illusioner": {
    feature: "mirage", role: "trickster",
    skin: "#7d7180", dark: "#171c31", cloth: "#373b78", accent: "#7861a8", metal: "#91a8be", glow: "#65c9f4",
    torsoWidth: 8.1, torsoHeight: 11.5, shoulderWidth: 11.8, headWidth: 6.6, legWidth: 3.1,
  },
  "enemy.witch": {
    feature: "hedgewitch", role: "alchemist",
    skin: "#8d725e", dark: "#231c2b", cloth: "#493458", accent: "#69733c", metal: "#9a825d", glow: "#b6e66b",
    torsoWidth: 9.1, torsoHeight: 11.9, shoulderWidth: 13.2, headWidth: 7.2, legWidth: 3.3,
  },
  "enemy.target_dummy": {
    feature: "effigy", role: "dummy",
    skin: "#d3ac58", dark: "#5b3a24", cloth: "#b98735", accent: "#9f3434", metal: "#80613c", glow: "#f2d98a",
    torsoWidth: 10.4, torsoHeight: 11.4, shoulderWidth: 15, headWidth: 7.8, legWidth: 4,
  },
};

export function raiderStyleFor(defId: string | undefined): RaiderStyle | undefined {
  if (!defId || !(defId in RAIDER_STYLES)) return undefined;
  return RAIDER_STYLES[defId as RaiderEnemyId];
}
