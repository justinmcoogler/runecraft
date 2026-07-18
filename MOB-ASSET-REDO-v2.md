# RuneCraft mob art redo v2

This bundle is laid out against the active game repository. Copy its contents over the repository root without flattening the folders.

## Runtime integration

- `src/render/renderer.ts` selects an ImageGen-derived surface family for every native enemy rig and contains the articulated runtime builders.
- `src/render/boss-model.ts` defines the five original boss silhouettes: Fire Wyvern, Ice Drake, Hydra, Two-Headed Storm Dragon, and Deep Warden.
- The other `src/render/*-model.ts` files define the exact-ID native families for undead, arachnids, constructs, oozes, canids, ungulates, raiders, fliers, and signature creatures.
- `src/render/art/materials/tiles/mob.surface.*-64.png` are the eight game-ready, 64x64 RGBA nearest-neighbor surface tiles.
- `src/render/original-art.ts` is the baked runtime registry and already includes those tiles.

## ImageGen source art

- `src/render/art/mobs/concepts/` contains eight production turnaround sheets used as the visual blueprint.
- `src/render/art/mobs/materials/masters/` contains the eight full-resolution seamless material masters used to make the runtime tiles.

The concept sheets are references, not billboard replacements. The enemies in the game remain real Three.js voxel geometry with jointed runtime animation.

## Test build

Open `dist/runecraft.html` directly in a browser. It is the rebuilt standalone game and has no server dependency.

Verification completed for this bundle:

- standalone build succeeded with 267 baked original textures and 14 entity skins;
- all 61 live enemies are covered by native model families;
- all 465 automated tests passed (9 intentionally skipped).
