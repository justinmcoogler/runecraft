/** Exact RuneCraft livestock and regional ungulate silhouettes. */

export const UNGULATE_ENEMY_IDS = [
  "enemy.cow",
  "enemy.pig",
  "enemy.sheep",
  "enemy.boar",
  "enemy.prairie_bull",
  "enemy.mooshroom",
] as const;

export type UngulateEnemyId = (typeof UNGULATE_ENEMY_IDS)[number];
export type UngulateFeature = "cow" | "pig" | "sheep" | "boar" | "bull" | "mooshroom";

export interface UngulateStyle {
  feature: UngulateFeature;
  hide: string;
  dark: string;
  coat: string;
  accent: string;
  eye: string;
  bodyWidth: number;
  bodyHeight: number;
  bodyLength: number;
  limbWidth: number;
  headWidth: number;
}

export const UNGULATE_STYLES: Record<UngulateEnemyId, UngulateStyle> = {
  "enemy.cow": {
    feature: "cow",
    hide: "#d8d1c3", dark: "#3d3935", coat: "#eee8dc", accent: "#b99582", eye: "#33251e",
    bodyWidth: 9.2, bodyHeight: 8.2, bodyLength: 16, limbWidth: 3, headWidth: 7,
  },
  "enemy.pig": {
    feature: "pig",
    hide: "#d9959e", dark: "#9f626c", coat: "#edb0b5", accent: "#bd7480", eye: "#3a2527",
    bodyWidth: 9.4, bodyHeight: 7.3, bodyLength: 13.2, limbWidth: 3, headWidth: 7.2,
  },
  "enemy.sheep": {
    feature: "sheep",
    hide: "#a88f7f", dark: "#5d5149", coat: "#e5dfd2", accent: "#c7bca9", eye: "#302923",
    bodyWidth: 10.2, bodyHeight: 9.2, bodyLength: 14.2, limbWidth: 3.1, headWidth: 6.4,
  },
  "enemy.boar": {
    feature: "boar",
    hide: "#684936", dark: "#342a24", coat: "#816047", accent: "#9b7857", eye: "#df9f48",
    bodyWidth: 10.3, bodyHeight: 8.4, bodyLength: 15, limbWidth: 3.5, headWidth: 7.6,
  },
  "enemy.prairie_bull": {
    feature: "bull",
    hide: "#765438", dark: "#332820", coat: "#947054", accent: "#c1a273", eye: "#dfb65a",
    bodyWidth: 12, bodyHeight: 10.2, bodyLength: 17.2, limbWidth: 4, headWidth: 8.2,
  },
  "enemy.mooshroom": {
    feature: "mooshroom",
    hide: "#8e3f3d", dark: "#3c2928", coat: "#d7c5aa", accent: "#b25b4b", eye: "#efc263",
    bodyWidth: 10.5, bodyHeight: 9.2, bodyLength: 16.3, limbWidth: 3.35, headWidth: 7.5,
  },
};

export function ungulateStyleFor(defId: string | undefined): UngulateStyle | undefined {
  if (!defId || !(defId in UNGULATE_STYLES)) return undefined;
  return UNGULATE_STYLES[defId as UngulateEnemyId];
}
