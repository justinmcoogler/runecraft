// Registry of imported Minecraft structures — the starter town is built from a
// cohesive farmhouse/medieval schematic pack (baked by import-structure.mjs),
// placed as solid landmarks whose doors are portals into reconstructed interiors.

import type { StructureAsset } from "../../structures/types";
// The imported schematic town builds (inn/blacksmith/bakery/…) have been
// removed — towns and wild homes are drawn in code now (object.house.small/.big
// and the code-drawn shrine). Only these three baked builds remain, registered
// solely as fixtures for the interior-reconstruction tests (never placed).
import { testhouse } from "./testhouse";
import { v1house } from "./v1house";
import { z6house } from "./z6house";
// The lobby hub — the (currently disabled) walled starter vale, one big
// walkable structure. Lazily decoded from its packed blob.
import { lobbyPack } from "./lobby";

export const STRUCTURES: Record<string, StructureAsset> = {
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
