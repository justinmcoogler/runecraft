// Registry of imported Minecraft structures — the starter town is built from a
// cohesive farmhouse/medieval schematic pack (baked by import-structure.mjs),
// placed as solid landmarks whose doors are portals into reconstructed interiors.

import type { StructureAsset } from "../../structures/types";
import { inn } from "./inn";
import { blacksmith } from "./blacksmith";
import { bakery } from "./bakery";
import { butcher } from "./butcher";
import { library } from "./library";
import { leader_house } from "./leader_house";
import { little_house } from "./little_house";
import { hunters_house } from "./hunters_house";
import { lumberjack_house } from "./lumberjack_house";
import { watch_tower } from "./watch_tower";
import { city_gate } from "./city_gate";
import { church } from "./church";
// Kept registered (not placed) for the interior-reconstruction tests.
import { testhouse } from "./testhouse";
import { v1house } from "./v1house";
import { z6house } from "./z6house";
// The lobby hub — the starter town, one big walkable structure (trees stripped
// to nodes). Lazily decoded from its packed blob.
import { lobbyPack } from "./lobby";

export const STRUCTURES: Record<string, StructureAsset> = {
  inn, blacksmith, bakery, butcher, library, leader_house,
  little_house, hunters_house, lumberjack_house, watch_tower, city_gate, church,
  testhouse, v1house, z6house,
};

/** Look up any structure — an individually baked build or the lobby. */
export function getStructure(structureId: string): StructureAsset | undefined {
  return STRUCTURES[structureId] ?? lobbyPack.decode(structureId);
}

/** Every placeable structure id (the individually baked builds). */
export function structureIds(): string[] {
  return [...Object.keys(STRUCTURES)];
}
