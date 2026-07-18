/** Exact identities and authored proportions for RuneCraft's native constructs. */

export const CONSTRUCT_ENEMY_IDS = [
  "enemy.canyon_construct",
  "enemy.rust_construct",
  "enemy.rootbound_warden",
  "enemy.liftworks_overseer",
  "enemy.moss_golem",
  "enemy.stone_sentinel",
] as const;

/** This boss deliberately keeps its attributed CC BY-SA Blockbench model. */
export const RETAINED_LICENSED_RIG_IDS = ["enemy.warden"] as const;

export type ConstructEnemyId = (typeof CONSTRUCT_ENEMY_IDS)[number];

export type ConstructFeature =
  | "canyon"
  | "rust"
  | "rootbound"
  | "liftworks"
  | "moss"
  | "sentinel";

export interface ConstructStyle {
  feature: ConstructFeature;
  body: string;
  slab: string;
  joint: string;
  metal: string;
  accent: string;
  core: string;
  torsoWidth: number;
  shoulderWidth: number;
  limbWidth: number;
  torsoHeight: number;
  headWidth: number;
}

export const CONSTRUCT_STYLES: Record<ConstructEnemyId, ConstructStyle> = {
  "enemy.canyon_construct": {
    feature: "canyon",
    body: "#8b654a", slab: "#5b4638", joint: "#403832", metal: "#78604f",
    accent: "#bd8152", core: "#71dfca",
    torsoWidth: 11, shoulderWidth: 15, limbWidth: 4.2, torsoHeight: 10.5, headWidth: 6.5,
  },
  "enemy.rust_construct": {
    feature: "rust",
    body: "#665b52", slab: "#3e4140", joint: "#252b2c", metal: "#74797a",
    accent: "#a85732", core: "#f09a45",
    torsoWidth: 10.5, shoulderWidth: 14, limbWidth: 4, torsoHeight: 10, headWidth: 6,
  },
  "enemy.rootbound_warden": {
    feature: "rootbound",
    body: "#58634a", slab: "#373f32", joint: "#2b3028", metal: "#69503a",
    accent: "#758f4f", core: "#99e35f",
    torsoWidth: 12, shoulderWidth: 16, limbWidth: 4.7, torsoHeight: 11.5, headWidth: 7,
  },
  "enemy.liftworks_overseer": {
    feature: "liftworks",
    body: "#59676d", slab: "#323d42", joint: "#20292d", metal: "#879296",
    accent: "#b98242", core: "#78e4df",
    torsoWidth: 13, shoulderWidth: 17, limbWidth: 4.8, torsoHeight: 12, headWidth: 7,
  },
  "enemy.moss_golem": {
    feature: "moss",
    body: "#66705b", slab: "#41483d", joint: "#30362e", metal: "#786b54",
    accent: "#5f8b45", core: "#8fe36d",
    torsoWidth: 12.5, shoulderWidth: 16.5, limbWidth: 5, torsoHeight: 11.5, headWidth: 7.2,
  },
  "enemy.stone_sentinel": {
    feature: "sentinel",
    body: "#7a7d7d", slab: "#4c5355", joint: "#303638", metal: "#8f9695",
    accent: "#b2a982", core: "#6fe3df",
    torsoWidth: 11.5, shoulderWidth: 16, limbWidth: 4.5, torsoHeight: 11, headWidth: 6.6,
  },
};

export function constructStyleFor(defId: string | undefined): ConstructStyle | undefined {
  if (!defId || !(defId in CONSTRUCT_STYLES)) return undefined;
  return CONSTRUCT_STYLES[defId as ConstructEnemyId];
}
