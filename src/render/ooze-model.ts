/** Exact RuneCraft ooze identities and authored voxel silhouettes. */

export const OOZE_ENEMY_IDS = [
  "enemy.bog_slime",
  "enemy.blight_slime",
  "enemy.bramble_slime",
  "enemy.marsh_lurker",
  "enemy.silt_king",
] as const;

export type OozeEnemyId = (typeof OOZE_ENEMY_IDS)[number];

export type OozeFeature = "bog" | "blight" | "bramble" | "marsh" | "silt";

export interface OozeStyle {
  feature: OozeFeature;
  outer: string;
  inner: string;
  crust: string;
  accent: string;
  eye: string;
  width: number;
  height: number;
  depth: number;
  opacity: number;
}

export const OOZE_STYLES: Record<OozeEnemyId, OozeStyle> = {
  "enemy.bog_slime": {
    feature: "bog",
    outer: "#5d783b", inner: "#35482b", crust: "#423b2a", accent: "#78934d", eye: "#d8eb67",
    width: 14, height: 11, depth: 15, opacity: 0.78,
  },
  "enemy.blight_slime": {
    feature: "blight",
    outer: "#76508e", inner: "#30253a", crust: "#4c3858", accent: "#a762bd", eye: "#f083ff",
    width: 13, height: 13, depth: 13, opacity: 0.74,
  },
  "enemy.bramble_slime": {
    feature: "bramble",
    outer: "#617c38", inner: "#314426", crust: "#59452f", accent: "#879b4c", eye: "#e7df62",
    width: 15, height: 9, depth: 14, opacity: 0.76,
  },
  "enemy.marsh_lurker": {
    feature: "marsh",
    outer: "#435f46", inner: "#263d36", crust: "#4a4430", accent: "#668462", eye: "#8ee8b8",
    width: 16, height: 10, depth: 15, opacity: 0.72,
  },
  "enemy.silt_king": {
    feature: "silt",
    outer: "#756a43", inner: "#443d2b", crust: "#54452f", accent: "#c09a4e", eye: "#ffe06b",
    width: 14, height: 12, depth: 14, opacity: 0.8,
  },
};

export function oozeStyleFor(defId: string | undefined): OozeStyle | undefined {
  if (!defId || !(defId in OOZE_STYLES)) return undefined;
  return OOZE_STYLES[defId as OozeEnemyId];
}
