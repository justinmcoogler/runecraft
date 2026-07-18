/** Remaining exact RuneCraft signature-fauna silhouettes. */

export const SIGNATURE_ENEMY_IDS = [
  "enemy.chicken",
  "enemy.creeper",
  "enemy.armadillo",
  "enemy.ravager",
  "enemy.sniffer",
] as const;

export type SignatureEnemyId = (typeof SIGNATURE_ENEMY_IDS)[number];
export type SignatureFeature = "roosthen" | "moss_stalker" | "ironback" | "siege_beast" | "root_sniffer";
export type SignatureMotion = "bird" | "stalker" | "scuttle" | "brute" | "sniff";

export interface SignatureStyle {
  feature: SignatureFeature;
  motion: SignatureMotion;
  body: string;
  dark: string;
  plate: string;
  accent: string;
  glow: string;
  bodyWidth: number;
  bodyHeight: number;
  bodyLength: number;
  limbWidth: number;
  legCount: number;
  wingCount: number;
}

export const SIGNATURE_STYLES: Record<SignatureEnemyId, SignatureStyle> = {
  "enemy.chicken": {
    feature: "roosthen", motion: "bird",
    body: "#d8cfbb", dark: "#4a3a32", plate: "#eee3c9", accent: "#b85245", glow: "#e6af45",
    bodyWidth: 7, bodyHeight: 8.2, bodyLength: 7.5, limbWidth: 1.5, legCount: 2, wingCount: 2,
  },
  "enemy.creeper": {
    feature: "moss_stalker", motion: "stalker",
    body: "#4f7445", dark: "#1f3326", plate: "#6e8b4e", accent: "#8a6b3f", glow: "#a9e45d",
    bodyWidth: 8.6, bodyHeight: 13, bodyLength: 7.2, limbWidth: 3.2, legCount: 4, wingCount: 0,
  },
  "enemy.armadillo": {
    feature: "ironback", motion: "scuttle",
    body: "#875d47", dark: "#3c302b", plate: "#a27657", accent: "#c09a6e", glow: "#e7bd72",
    bodyWidth: 10.5, bodyHeight: 7.8, bodyLength: 14.5, limbWidth: 2.7, legCount: 4, wingCount: 0,
  },
  "enemy.ravager": {
    feature: "siege_beast", motion: "brute",
    body: "#535a58", dark: "#252b2b", plate: "#737a75", accent: "#8b6749", glow: "#e3644d",
    bodyWidth: 14.2, bodyHeight: 11.8, bodyLength: 19.5, limbWidth: 4.8, legCount: 4, wingCount: 0,
  },
  "enemy.sniffer": {
    feature: "root_sniffer", motion: "sniff",
    body: "#8b4f43", dark: "#303b32", plate: "#547153", accent: "#b88755", glow: "#82cf70",
    bodyWidth: 14.5, bodyHeight: 10.4, bodyLength: 20.5, limbWidth: 4.1, legCount: 4, wingCount: 0,
  },
};

export function signatureStyleFor(defId: string | undefined): SignatureStyle | undefined {
  if (!defId || !(defId in SIGNATURE_STYLES)) return undefined;
  return SIGNATURE_STYLES[defId as SignatureEnemyId];
}
