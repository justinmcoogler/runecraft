// MaterialResolver: gameplay/world code references logical material IDs only;
// this module turns those IDs into textures/atlas regions. Resolution order:
// user-imported pack (on-device) > DEFAULT_TEXTURES (the project's own baked
// pack art) > procedural 16x16 tiles (the original fallback).

import * as THREE from "three";
import { DYE_COLORS } from "../content/blocks";
import { decodePngBase64 } from "../texturepacks/png";
import { DEFAULT_ENTITY_TEXTURES, DEFAULT_TEXTURES } from "./default-textures";

const TILE = 16;

/**
 * Baked default art decoded synchronously (base64 PNG -> ImageData) at its
 * native size, so high-resolution bakes (e.g. a 64x pack) keep their detail.
 */
const defaultTileCache = new Map<string, ImageData | null>();
function defaultTile(materialId: string): ImageData | null {
  let cached = defaultTileCache.get(materialId);
  if (cached !== undefined) return cached;
  const b64 = DEFAULT_TEXTURES[materialId];
  const png = b64 ? decodePngBase64(b64) : null;
  cached = png ? new ImageData(png.rgba, png.width, png.height) : null;
  defaultTileCache.set(materialId, cached);
  return cached;
}

/** ImageData -> canvas (putImageData cannot scale; drawImage of this can). */
function imageDataCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  c.getContext("2d")!.putImageData(img, 0, 0);
  return c;
}

interface TileSpec {
  base: string; // css color
  speckle: string;
  speckleDensity: number; // 0..1
  border?: string;
}

// Logical material ID -> procedural tile recipe (the built-in original pack).
const TILE_SPECS: Record<string, TileSpec> = {
  "terrain.grass.top": { base: "#59a83b", speckle: "#4c9330", speckleDensity: 0.35 },
  "terrain.grass.side": { base: "#7a5230", speckle: "#59a83b", speckleDensity: 0.2 },
  "terrain.dirt": { base: "#7a5230", speckle: "#684526", speckleDensity: 0.3 },
  "terrain.stone": { base: "#8a8d90", speckle: "#77797c", speckleDensity: 0.3 },
  "terrain.sand": { base: "#dcc981", speckle: "#cdb96e", speckleDensity: 0.3 },
  "terrain.water": { base: "#3f76c9", speckle: "#4f86d9", speckleDensity: 0.25 },
  "terrain.plank": { base: "#a5793f", speckle: "#8a6332", speckleDensity: 0.2, border: "#6e4620" },
  "terrain.snow": { base: "#eef3f7", speckle: "#dde7ee", speckleDensity: 0.25 },
  "terrain.ice": { base: "#a9cbe8", speckle: "#c2ddf2", speckleDensity: 0.3 },
  "terrain.mud": { base: "#5d4a33", speckle: "#4c3c28", speckleDensity: 0.35 },
  "terrain.redsand": { base: "#c46f35", speckle: "#b25e28", speckleDensity: 0.3 },
  "terrain.mycelium": { base: "#7d6f8a", speckle: "#93829f", speckleDensity: 0.35 },
  "terrain.drygrass": { base: "#b0a052", speckle: "#9c8c44", speckleDensity: 0.35 },
  "resource.tree.birch.side": { base: "#e7e2d4", speckle: "#3c3a33", speckleDensity: 0.12 },
  "terrain.stonebrick": { base: "#84878c", speckle: "#6f7277", speckleDensity: 0.25, border: "#63666b" },
  "wall.plaster": { base: "#e8e0cf", speckle: "#d8cfbc", speckleDensity: 0.2 },
  "roof.shingle": { base: "#7a4a33", speckle: "#68402c", speckleDensity: 0.3, border: "#573523" },
  "roof.darkoak": { base: "#4a3526", speckle: "#3e2c1f", speckleDensity: 0.3, border: "#33241a" },
  "roof.slate": { base: "#666c73", speckle: "#575d64", speckleDensity: 0.3, border: "#4c5258" },
  "resource.tree.log.side": { base: "#6b4a2a", speckle: "#59391e", speckleDensity: 0.35 },
  "resource.tree.spruce.side": { base: "#4a3320", speckle: "#3a2717", speckleDensity: 0.35 },
  "resource.tree.jungle.side": { base: "#6a5030", speckle: "#584023", speckleDensity: 0.35 },
  "resource.tree.acacia.side": { base: "#6e5540", speckle: "#5a4432", speckleDensity: 0.35 },
  "resource.tree.darkoak.side": { base: "#3b2a1a", speckle: "#2e2013", speckleDensity: 0.35 },
  "resource.tree.blossom.side": { base: "#4d3038", speckle: "#3d242b", speckleDensity: 0.3 },
  "resource.tree.birch.leaves": { base: "#80a755", speckle: "#6e9445", speckleDensity: 0.4 },
  "resource.tree.spruce.leaves": { base: "#619961", speckle: "#528552", speckleDensity: 0.4 },
  "resource.tree.jungle.leaves": { base: "#48b518", speckle: "#3b9d12", speckleDensity: 0.4 },
  "resource.tree.acacia.leaves": { base: "#a3a23c", speckle: "#8e8d30", speckleDensity: 0.4 },
  "resource.tree.darkoak.leaves": { base: "#4e7a28", speckle: "#40691f", speckleDensity: 0.4 },
  "resource.tree.blossom.leaves": { base: "#e8a7c8", speckle: "#d891b6", speckleDensity: 0.4 },
  // New hand-authored species — Minecraft-toned bark + foliage tiles.
  "resource.tree.pine.side": { base: "#3f2d1c", speckle: "#2f2013", speckleDensity: 0.35 },
  "resource.tree.pine.leaves": { base: "#3f6146", speckle: "#33513a", speckleDensity: 0.4 },
  "resource.tree.willow.side": { base: "#5a4a34", speckle: "#493b28", speckleDensity: 0.35 },
  "resource.tree.willow.leaves": { base: "#88a86a", speckle: "#75955a", speckleDensity: 0.4 },
  "resource.tree.maple.side": { base: "#6e4a2c", speckle: "#59391e", speckleDensity: 0.35 },
  "resource.tree.maple.leaves": { base: "#d2652a", speckle: "#bd551f", speckleDensity: 0.42 },
  "resource.tree.palm.side": { base: "#8a6a3f", speckle: "#725636", speckleDensity: 0.35 },
  "resource.tree.palm.leaves": { base: "#4fae2e", speckle: "#419522", speckleDensity: 0.4 },
  "resource.tree.dead.side": { base: "#6a5f52", speckle: "#544a3f", speckleDensity: 0.4 },
  "resource.tree.ember.side": { base: "#2a2018", speckle: "#1d1610", speckleDensity: 0.4 },
  "resource.tree.ember.leaves": { base: "#7a2a12", speckle: "#5f1e0c", speckleDensity: 0.42 },
  "resource.tree.glow.side": { base: "#586a58", speckle: "#47563f", speckleDensity: 0.3 },
  "resource.tree.glow.leaves": { base: "#57e0c0", speckle: "#43c6a8", speckleDensity: 0.35 },
  "resource.tree.dusk.side": { base: "#34283a", speckle: "#271d2d", speckleDensity: 0.35 },
  "resource.tree.dusk.leaves": { base: "#9a7fd0", speckle: "#8168bd", speckleDensity: 0.4 },
  "resource.tree.log.top": { base: "#a5793f", speckle: "#8a6332", speckleDensity: 0.2 },
  "resource.tree.leaves": { base: "#3e8a2f", speckle: "#347526", speckleDensity: 0.4 },
  "resource.tree.stump.top": { base: "#a5793f", speckle: "#6b4a2a", speckleDensity: 0.25 },
  "resource.rock.stone": { base: "#8a8d90", speckle: "#77797c", speckleDensity: 0.3 },
  "resource.rock.coal": { base: "#8a8d90", speckle: "#26262a", speckleDensity: 0.3 },
  "resource.rock.gold": { base: "#8a8d90", speckle: "#e8c33a", speckleDensity: 0.28 },
  "resource.rock.diamond": { base: "#8a8d90", speckle: "#6fdbe0", speckleDensity: 0.25 },
  "resource.rock.essence": { base: "#b9b2c6", speckle: "#d7d1e4", speckleDensity: 0.4 },
  "object.melon.side": { base: "#6f9636", speckle: "#8fba4a", speckleDensity: 0.3, border: "#557428" },
  "object.melon.top": { base: "#7ba23e", speckle: "#95c052", speckleDensity: 0.3 },
  // Plank finishes per wood species (oak/spruce/dark-oak already map onto
  // terrain.plank / roof.shingle / roof.darkoak). A board-grain look: base
  // colour, a slightly darker speckle, and a seam border.
  "terrain.plank.birch": { base: "#d7cba4", speckle: "#c3b388", speckleDensity: 0.2, border: "#a89468" },
  "terrain.plank.jungle": { base: "#a5744a", speckle: "#8c5f39", speckleDensity: 0.22, border: "#6a4529" },
  "terrain.plank.acacia": { base: "#b06437", speckle: "#97501f", speckleDensity: 0.24, border: "#6e3a18" },
  "terrain.plank.mangrove": { base: "#813f39", speckle: "#6b322d", speckleDensity: 0.24, border: "#4e211d" },
  "terrain.plank.cherry": { base: "#e0b3ab", speckle: "#d09a90", speckleDensity: 0.2, border: "#b57d74" },
  "terrain.plank.crimson": { base: "#7e3a56", speckle: "#682f47", speckleDensity: 0.22, border: "#4d2234" },
  "terrain.plank.warped": { base: "#3a8382", speckle: "#2f6d6c", speckleDensity: 0.22, border: "#245150" },
  "terrain.plank.bamboo": { base: "#c9ad55", speckle: "#b39641", speckleDensity: 0.26, border: "#8c7330" },
  "terrain.plank.paleoak": { base: "#cbc4b9", speckle: "#b7b0a4", speckleDensity: 0.2, border: "#98917f" },
  // Stone / brick finishes for families that had no logical material and were
  // reading as flat swatches.
  "terrain.diorite": { base: "#dcdcd8", speckle: "#c2c2be", speckleDensity: 0.3, border: "#b2b2ae" },
  "terrain.granite": { base: "#9a6250", speckle: "#845140", speckleDensity: 0.3, border: "#6e4234" },
  "terrain.quartz": { base: "#ece6df", speckle: "#ddd6c9", speckleDensity: 0.22, border: "#d0c8b9" },
  "terrain.calcite": { base: "#dfe0dc", speckle: "#cccdc7", speckleDensity: 0.25 },
  // Cobblestone: mottled grey cobbles set in darker mortar — chunky and rough,
  // for the castle wall around the starter vale.
  "terrain.cobble": { base: "#8a8a8f", speckle: "#666670", speckleDensity: 0.5, border: "#54545c" },
  "terrain.basalt": { base: "#4a4a4f", speckle: "#3c3c41", speckleDensity: 0.3, border: "#303035" },
  "terrain.netherbrick": { base: "#2f171b", speckle: "#241114", speckleDensity: 0.3, border: "#180b0d" },
  "terrain.prismarine": { base: "#66a196", speckle: "#57907f", speckleDensity: 0.3, border: "#477a6b" },
  "terrain.darkprismarine": { base: "#3a5b4c", speckle: "#2f4b3f", speckleDensity: 0.3, border: "#243a2f" },
  "terrain.purpur": { base: "#a97ba9", speckle: "#966a96", speckleDensity: 0.25, border: "#7d557d" },
  "terrain.endstone": { base: "#dbde9e", speckle: "#cbce8c", speckleDensity: 0.3 },
  // Richer ground blocks (Faithful overrides these procedural fallbacks).
  "terrain.gravel": { base: "#7f7b78", speckle: "#95908c", speckleDensity: 0.45 },
  "terrain.coarsedirt": { base: "#6e4f34", speckle: "#583e28", speckleDensity: 0.4 },
  "terrain.podzol": { base: "#5c4327", speckle: "#6f5433", speckleDensity: 0.4 },
  "terrain.clay": { base: "#9aa2ad", speckle: "#8b93a0", speckleDensity: 0.3 },
  "terrain.moss": { base: "#5a7229", speckle: "#4a6020", speckleDensity: 0.4 },
  "terrain.andesite": { base: "#8a8b8c", speckle: "#79797b", speckleDensity: 0.35 },
  "terrain.terracotta": { base: "#96604a", speckle: "#82503c", speckleDensity: 0.3 },
  "terrain.redterracotta": { base: "#8f3d2f", speckle: "#7a3227", speckleDensity: 0.3 },
  "terrain.orangeterracotta": { base: "#a15325", speckle: "#8c451d", speckleDensity: 0.3 },
  "terrain.whiteterracotta": { base: "#d1b1a1", speckle: "#c19e8d", speckleDensity: 0.3 },
};

// Tiles too structured for base+speckle: drawn pixel-by-pixel. All are 16x16,
// matching standard block-texture dimensions so imported packs can map 1:1.
const CUSTOM_DRAW: Record<string, (ctx: CanvasRenderingContext2D) => void> = {
  // Normal ore block: stone base with chunky embedded copper clusters.
  "resource.rock.copper": (ctx) => {
    drawTile(ctx, 0, 0, TILE_SPECS["resource.rock.stone"], 401);
    const clusters: Array<[number, number]> = [
      [2, 2], [10, 3], [4, 8], [11, 10], [7, 13],
    ];
    for (const [x, y] of clusters) {
      ctx.fillStyle = "#8a5230"; // dark copper rim
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillStyle = "#c47a3d"; // body
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#e39a5f"; // glint
      ctx.fillRect(x, y, 1, 1);
    }
  },
  // Tin ore block: stone with pale silvery clusters.
  "resource.rock.tin": (ctx) => {
    drawTile(ctx, 0, 0, TILE_SPECS["resource.rock.stone"], 401);
    const clusters: Array<[number, number]> = [
      [3, 3], [11, 2], [5, 9], [12, 11], [8, 13],
    ];
    for (const [x, y] of clusters) {
      ctx.fillStyle = "#8f959c";
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillStyle = "#c3c9d0";
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#e8edf2";
      ctx.fillRect(x, y, 1, 1);
    }
  },
  // Iron ore block: stone with warm tan flecks.
  "resource.rock.iron": (ctx) => {
    drawTile(ctx, 0, 0, TILE_SPECS["resource.rock.stone"], 401);
    const clusters: Array<[number, number]> = [
      [2, 3], [10, 2], [4, 9], [11, 11], [7, 12],
    ];
    for (const [x, y] of clusters) {
      ctx.fillStyle = "#a87c5a";
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillStyle = "#d8b89a";
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#f0d8c0";
      ctx.fillRect(x, y, 1, 1);
    }
  },
  // Redstone ore: stone with glowing red clusters.
  "resource.rock.redstone": (ctx) => {
    drawTile(ctx, 0, 0, TILE_SPECS["resource.rock.stone"], 401);
    for (const [x, y] of [[2, 2], [10, 3], [4, 9], [12, 10], [7, 13]] as Array<[number, number]>) {
      ctx.fillStyle = "#8a1408";
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillStyle = "#dc2a1a";
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#ff5a44";
      ctx.fillRect(x, y, 1, 1);
    }
  },
  // Lapis ore: stone with deep-blue speckled clusters.
  "resource.rock.lapis": (ctx) => {
    drawTile(ctx, 0, 0, TILE_SPECS["resource.rock.stone"], 401);
    for (const [x, y] of [[3, 3], [11, 2], [5, 10], [12, 11], [8, 13]] as Array<[number, number]>) {
      ctx.fillStyle = "#13286e";
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillStyle = "#2350c0";
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#4f80e6";
      ctx.fillRect(x, y, 1, 1);
    }
  },
  // Emerald ore: stone with bright green crystals.
  "resource.rock.emerald": (ctx) => {
    drawTile(ctx, 0, 0, TILE_SPECS["resource.rock.stone"], 401);
    for (const [x, y] of [[3, 2], [10, 4], [5, 10], [12, 9], [7, 13]] as Array<[number, number]>) {
      ctx.fillStyle = "#0d7a34";
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillStyle = "#18bd57";
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#5be58c";
      ctx.fillRect(x, y, 1, 1);
    }
  },
  // Nether quartz ore: stone with pale crystalline clusters.
  "resource.rock.quartz": (ctx) => {
    drawTile(ctx, 0, 0, TILE_SPECS["resource.rock.stone"], 401);
    for (const [x, y] of [[2, 3], [11, 2], [4, 10], [12, 11], [8, 12]] as Array<[number, number]>) {
      ctx.fillStyle = "#b3a798";
      ctx.fillRect(x, y + 1, 3, 1);
      ctx.fillRect(x + 1, y, 1, 3);
      ctx.fillStyle = "#e6ddcf";
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = "#fbf6ec";
      ctx.fillRect(x, y, 1, 1);
    }
  },
  // Ancient debris: a scorched brown block, not stone — dark base with
  // charred tan blotches, the way it surfaces from the deep.
  "resource.rock.netherite": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#5a4034", speckle: "#4a332a", speckleDensity: 0.4 }, 733);
    for (const [x, y] of [[2, 2], [9, 3], [5, 9], [11, 10], [7, 13]] as Array<[number, number]>) {
      ctx.fillStyle = "#33241c";
      ctx.fillRect(x, y, 4, 3);
      ctx.fillStyle = "#8a6f5a";
      ctx.fillRect(x + 1, y, 2, 2);
      ctx.fillStyle = "#c49a6a";
      ctx.fillRect(x + 1, y, 1, 1);
    }
  },
  "object.chest.front": (ctx) => drawChestFace(ctx, true),
  "object.chest.side": (ctx) => drawChestFace(ctx, false),
  "object.chest.top": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#9a6733", speckle: "#7d5326", speckleDensity: 0.25, border: "#5d3a16" }, 91);
  },
  // Workbench side: planks with an apron seam and a leaning saw.
  "object.workbench.side": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#a5793f", speckle: "#8a6332", speckleDensity: 0.2, border: "#6e4620" }, 829);
    ctx.fillStyle = "#6e4620";
    ctx.fillRect(0, 0, 16, 2);
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(3, 6, 2, 8);
  },
  // Barrel: staved sides bound by iron hoops, a coopered lid on top.
  "object.barrel.side": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#8a6332", speckle: "#7a5230", speckleDensity: 0.25 }, 613);
    ctx.fillStyle = "#6e4620";
    for (const x of [4, 8, 12]) ctx.fillRect(x, 0, 1, 16);
    ctx.fillStyle = "#3a3d42";
    ctx.fillRect(0, 2, 16, 2);
    ctx.fillRect(0, 12, 16, 2);
  },
  "object.barrel.top": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#a5793f", speckle: "#8a6332", speckleDensity: 0.2, border: "#3a3d42" }, 617);
    ctx.fillStyle = "#6e4620";
    for (const y of [5, 10]) ctx.fillRect(1, y, 14, 1);
  },
  // Cauldron shell: dark iron with a heavy rim.
  "object.cauldron.side": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#3a3d42", speckle: "#2f3237", speckleDensity: 0.25, border: "#24272c" }, 619);
    ctx.fillStyle = "#24272c";
    ctx.fillRect(0, 0, 16, 2);
  },
  // Hay bale: straw with twine bands / a spiral-bound end.
  "object.haybale.side": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#d9b03f", speckle: "#c39a2e", speckleDensity: 0.4 }, 631);
    ctx.fillStyle = "#8a6332";
    ctx.fillRect(0, 3, 16, 1);
    ctx.fillRect(0, 11, 16, 1);
  },
  "object.haybale.top": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#c39a2e", speckle: "#d9b03f", speckleDensity: 0.45 }, 633);
    ctx.fillStyle = "#a8841f";
    ctx.fillRect(4, 4, 8, 1);
    ctx.fillRect(4, 11, 8, 1);
    ctx.fillRect(4, 4, 1, 8);
    ctx.fillRect(11, 4, 1, 8);
  },
  // Lantern sheet (vanilla block-texture layout): body side with the iron
  // cage over the glow at (0,2,6,7), body top plate at (0,9,6,6).
  "object.lantern.sheet": (ctx) => {
    ctx.fillStyle = "#3a3d42"; // side frame
    ctx.fillRect(0, 2, 6, 7);
    ctx.fillStyle = "#ffd873"; // glow panes
    ctx.fillRect(1, 3, 4, 4);
    ctx.fillStyle = "#3a3d42"; // cage cross
    ctx.fillRect(2, 3, 1, 4);
    ctx.fillRect(1, 5, 4, 1);
    ctx.fillStyle = "#24272c"; // top plate
    ctx.fillRect(0, 9, 6, 6);
    ctx.fillStyle = "#4a4e54";
    ctx.fillRect(1, 10, 4, 4);
  },
  // Door halves: grooved planks below, a four-pane window above.
  "object.door.bottom": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#a5793f", speckle: "#8a6332", speckleDensity: 0.2, border: "#6e4620" }, 641);
    ctx.fillStyle = "#6e4620";
    ctx.fillRect(3, 2, 1, 12);
    ctx.fillRect(12, 2, 1, 12);
  },
  "object.door.top": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#a5793f", speckle: "#8a6332", speckleDensity: 0.2, border: "#6e4620" }, 643);
    ctx.fillStyle = "#1d2a38";
    ctx.fillRect(3, 3, 4, 4);
    ctx.fillRect(9, 3, 4, 4);
    ctx.fillStyle = "#3d5a78";
    ctx.fillRect(4, 4, 2, 2);
    ctx.fillRect(10, 4, 2, 2);
  },
  // Plant sprites (alpha-transparent, rendered as crossed planes like standard plants).
  "sprite.bush.berry.full": (ctx) => drawBushSprite(ctx, true),
  "sprite.bush.berry.bare": (ctx) => drawBushSprite(ctx, false),
  // Crops and wildflowers render as crossed planes, exactly like standard
  // Minecraft plants (wheat_stage7-style stalks, flower sprites).
  "sprite.crop.wheat.full": (ctx) => {
    const stalks = [2, 5, 8, 11, 14];
    for (const x of stalks) {
      ctx.fillStyle = "#c9a94a";
      ctx.fillRect(x, 5, 1, 11);
      ctx.fillStyle = "#e3c968";
      ctx.fillRect(x - 1, 2, 2, 4);
      ctx.fillRect(x, 1, 1, 2);
    }
  },
  "sprite.crop.wheat.sprout": (ctx) => {
    for (const x of [3, 7, 11, 14]) {
      ctx.fillStyle = "#6fae4a";
      ctx.fillRect(x, 12, 1, 4);
      ctx.fillRect(x - 1, 11, 1, 2);
    }
  },
  "sprite.herb.full": (ctx) => {
    for (const [x, top] of [[3, 5], [8, 3], [12, 6]]) {
      ctx.fillStyle = "#4d7030";
      ctx.fillRect(x, top + 2, 1, 14 - top);
      ctx.fillStyle = "#5a7f52";
      ctx.fillRect(x - 1, top + 3, 3, 2);
      ctx.fillRect(x - 1, top + 7, 3, 2);
      ctx.fillStyle = "#b9a6c4";
      ctx.fillRect(x - 1, top, 3, 2);
    }
  },
  "sprite.herb.bare": (ctx) => {
    for (const x of [4, 9, 13]) {
      ctx.fillStyle = "#5a7f52";
      ctx.fillRect(x, 13, 1, 3);
    }
  },
  "sprite.flowers.wild": (ctx) => {
    const blooms: Array<[number, string]> = [[3, "#d0484f"], [8, "#e6c94e"], [13, "#efe3ef"]];
    for (const [x, color] of blooms) {
      ctx.fillStyle = "#4d7030";
      ctx.fillRect(x, 9, 1, 7);
      ctx.fillRect(x - 1, 11, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(x - 1, 6, 3, 3);
      ctx.fillStyle = "#f6e6b0";
      ctx.fillRect(x, 7, 1, 1);
    }
  },
  "sprite.grass.tuft": (ctx) => {
    // Sparse wild-grass blades, taller in the middle of the clump.
    for (const [x, top] of [[2, 9], [4, 6], [6, 8], [8, 5], [10, 7], [12, 9], [14, 8]] as const) {
      ctx.fillStyle = "#5d9c3f";
      ctx.fillRect(x, top, 1, 16 - top);
      ctx.fillStyle = "#79b855";
      ctx.fillRect(x, top, 1, 2);
    }
  },
  "sprite.reeds": (ctx) => {
    // Bank reeds: tall jointed stalks with leaning blade leaves.
    for (const [x, top] of [[2, 1], [5, 3], [8, 0], [11, 2], [14, 4]] as const) {
      ctx.fillStyle = "#87b25a";
      ctx.fillRect(x, top, 1, 16 - top);
      ctx.fillStyle = "#6e9648";
      for (let y = top + 3; y < 16; y += 4) ctx.fillRect(x, y, 1, 1);
      ctx.fillStyle = "#9cc46b";
      ctx.fillRect(x - 1, top + 2, 1, 1);
      ctx.fillRect(x + 1, top + 5, 1, 1);
    }
  },
  // Pumpkin: a full Minecraft block (16x16x16) with ribbed sides.
  "object.pumpkin.side": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#d1782a", speckle: "#c06a22", speckleDensity: 0.2 }, 733);
    ctx.fillStyle = "#b96420";
    for (const x of [2, 7, 12]) ctx.fillRect(x, 0, 2, 16);
  },
  // Dig site: disturbed earth with shards and old bone poking through.
  "resource.digsite.face": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#7a5230", speckle: "#684526", speckleDensity: 0.35 }, 811);
    ctx.fillStyle = "#c46f35"; // pottery
    ctx.fillRect(3, 4, 3, 2);
    ctx.fillRect(10, 9, 2, 3);
    ctx.fillStyle = "#e8e2d4"; // bone
    ctx.fillRect(6, 11, 4, 1);
    ctx.fillRect(12, 3, 1, 3);
    ctx.fillStyle = "#4c3c28"; // dug hollows
    ctx.fillRect(2, 9, 3, 3);
    ctx.fillRect(9, 2, 3, 3);
  },
  // Workbench: plank block with a tool-scarred top.
  "object.workbench.top": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#a5793f", speckle: "#8a6332", speckleDensity: 0.2, border: "#6e4620" }, 823);
    ctx.fillStyle = "#8a8d90"; // saw + hammer heads
    ctx.fillRect(3, 3, 5, 2);
    ctx.fillRect(10, 9, 3, 3);
    ctx.fillStyle = "#5d3a16";
    ctx.fillRect(4, 10, 4, 1);
    ctx.fillRect(11, 4, 1, 4);
  },
  "object.pumpkin.top": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#c06a22", speckle: "#b05e1e", speckleDensity: 0.25 }, 737);
    ctx.fillStyle = "#4d7030"; // the curled stem
    ctx.fillRect(7, 6, 3, 3);
    ctx.fillRect(9, 5, 2, 2);
  },
  "object.furnace.side": (ctx) => {
    drawTile(ctx, 0, 0, { base: "#7d8083", speckle: "#6a6d70", speckleDensity: 0.25, border: "#5a5d60" }, 57);
    ctx.fillStyle = "#5a5d60"; // brick joints
    ctx.fillRect(0, 5, 16, 1);
    ctx.fillRect(0, 10, 16, 1);
    ctx.fillRect(8, 0, 1, 5);
    ctx.fillRect(4, 5, 1, 5);
    ctx.fillRect(11, 10, 1, 6);
  },
  "object.furnace.front": (ctx) => {
    CUSTOM_DRAW["object.furnace.side"](ctx);
    ctx.fillStyle = "#1c1c1c"; // firebox opening
    ctx.fillRect(4, 8, 8, 6);
    ctx.fillStyle = "#e2903a"; // glow
    ctx.fillRect(5, 11, 6, 3);
    ctx.fillStyle = "#f6c65a";
    ctx.fillRect(6, 12, 2, 2);
    ctx.fillRect(9, 12, 1, 2);
  },
  // Flame sprite (alpha cutout, crossed planes, flickers in the renderer).
  "sprite.flame": (ctx) => {
    const rand = tileRng(313);
    for (let y = 4; y < 15; y++) {
      const width = Math.max(2, Math.round((y - 3) * 0.9));
      for (let x = 8 - width; x < 8 + width; x++) {
        if (rand() < 0.85) {
          const inner = Math.abs(x - 7.5) < width * 0.5 && y > 8;
          ctx.fillStyle = inner ? "#f6c65a" : "#e2903a";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  },
  // Worn-armor plate tiles (mapped onto character armor boxes).
  "armor.plate.leather": (ctx) => drawArmorPlate(ctx, "#8a5a2b", "#a5793f", "#59391e"),
  "armor.plate.copper": (ctx) => drawArmorPlate(ctx, "#c47a3d", "#e39a5f", "#8a5230"),
  "armor.plate.bronze": (ctx) => drawArmorPlate(ctx, "#b08d57", "#d4b06a", "#7d6138"),
  "armor.plate.iron": (ctx) => drawArmorPlate(ctx, "#b8bfc8", "#dde3ea", "#7f868f"),
  // Player locator (shown through dungeon walls).
  "sprite.player.arrow": (ctx) => {
    ctx.fillStyle = "#2a2a1a";
    for (let i = 0; i < 6; i++) ctx.fillRect(2 + i, 4 + i, 12 - i * 2, 2);
    ctx.fillStyle = "#ffd54a";
    for (let i = 0; i < 5; i++) ctx.fillRect(3 + i, 5 + i, 10 - i * 2, 1);
  },
  // Quest markers over NPC heads.
  "sprite.quest.give": (ctx) => drawQuestMark(ctx, "!"),
  "sprite.quest.ready": (ctx) => drawQuestMark(ctx, "?"),
  // Held-tool item sprites (16x16, diagonal-handle item-art convention).
  "sprite.item.axe": (ctx) => {
    drawToolHandle(ctx);
    ctx.fillStyle = "#9a9da0"; // blade
    ctx.fillRect(6, 2, 5, 2);
    ctx.fillRect(5, 4, 7, 3);
    ctx.fillRect(6, 7, 4, 1);
    ctx.fillStyle = "#c6c9cc"; // edge highlight
    ctx.fillRect(5, 4, 1, 3);
    ctx.fillRect(6, 2, 1, 2);
  },
  "sprite.item.pickaxe": (ctx) => {
    drawToolHandle(ctx);
    ctx.fillStyle = "#8a8d90"; // head arc
    ctx.fillRect(3, 3, 10, 2);
    ctx.fillRect(2, 5, 2, 3);
    ctx.fillRect(12, 5, 2, 3);
    ctx.fillStyle = "#b9bcbf";
    ctx.fillRect(3, 3, 10, 1);
  },
  // A standing/wall torch (Minecraft block-model art): a 2px wooden stick
  // rising from the bottom with a glowing tip, transparent elsewhere so a pair
  // of crossed planes reads as a torch. A loaded pack's torch.png overrides it.
  "sprite.torch": (ctx) => {
    ctx.fillStyle = "#6b4a2a"; // stick
    ctx.fillRect(7, 6, 2, 10);
    ctx.fillStyle = "#8a5e34"; // lit face
    ctx.fillRect(7, 6, 1, 10);
    ctx.fillStyle = "#b5611f"; // ember base
    ctx.fillRect(7, 4, 2, 2);
    ctx.fillStyle = "#ffb648"; // flame
    ctx.fillRect(6, 3, 4, 2);
    ctx.fillStyle = "#ffe9a6"; // hot centre
    ctx.fillRect(7, 3, 2, 1);
  },
  // A torch item, drawn on the diagonal-handle convention so it grips in the
  // fist exactly like the axe/pickaxe. Wooden shaft rising bottom-left to
  // top-right, a charred coal wrap, then a bright flame at the tip. Alpha bg,
  // so a loaded texture pack's torch art overrides it wholesale.
  "sprite.item.torch": (ctx) => {
    drawToolHandle(ctx); // 2px wooden shaft, bottom-left -> top-right
    ctx.fillStyle = "#3a2a18"; // charred coal wrap at the head
    ctx.fillRect(11, 3, 3, 3);
    ctx.fillStyle = "#b5611f"; // ember base
    ctx.fillRect(11, 2, 3, 3);
    ctx.fillStyle = "#ffb648"; // flame
    ctx.fillRect(11, 1, 3, 2);
    ctx.fillStyle = "#ffe9a6"; // hot centre
    ctx.fillRect(12, 1, 1, 2);
  },
  "sprite.item.sword": (ctx) => {
    ctx.fillStyle = "#6b4a2a"; // grip
    ctx.fillRect(3, 12, 2, 2);
    ctx.fillRect(4, 11, 2, 2);
    ctx.fillStyle = "#c9a227"; // crossguard
    ctx.fillRect(4, 9, 3, 3);
    ctx.fillStyle = "#b9bcbf"; // blade
    for (let i = 0; i < 7; i++) ctx.fillRect(6 + i, 9 - i, 2, 2);
    ctx.fillStyle = "#e6e9ec"; // edge highlight
    for (let i = 0; i < 7; i++) ctx.fillRect(7 + i, 8 - i, 1, 1);
  },
  "sprite.item.hammer": (ctx) => {
    drawToolHandle(ctx);
    ctx.fillStyle = "#5a5d60"; // head
    ctx.fillRect(6, 2, 7, 5);
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(6, 2, 7, 2);
  },
  "sprite.item.rod": (ctx) => {
    ctx.fillStyle = "#6b4a2a"; // long diagonal rod
    for (let i = 0; i < 11; i++) ctx.fillRect(3 + i, 14 - i, 1, 2);
    ctx.fillStyle = "#8a8d90"; // line + hook
    ctx.fillRect(14, 2, 1, 6);
    ctx.fillRect(13, 8, 1, 1);
    ctx.fillRect(12, 9, 1, 1);
  },
};

function drawQuestMark(ctx: CanvasRenderingContext2D, glyph: "!" | "?"): void {
  ctx.fillStyle = "#2a2a1a"; // outline
  ctx.fillRect(5, 1, 6, 12);
  ctx.fillRect(5, 13, 6, 3);
  ctx.fillStyle = "#ffd54a";
  if (glyph === "!") {
    ctx.fillRect(6, 2, 4, 8);
    ctx.fillRect(6, 12, 4, 3);
  } else {
    ctx.fillRect(6, 2, 4, 2);
    ctx.fillRect(8, 4, 2, 2);
    ctx.fillRect(7, 6, 2, 4);
    ctx.fillRect(7, 12, 2, 3);
  }
}

function drawArmorPlate(
  ctx: CanvasRenderingContext2D,
  base: string,
  light: string,
  dark: string,
): void {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TILE, TILE);
  ctx.fillStyle = light; // top sheen
  ctx.fillRect(1, 1, 14, 3);
  ctx.fillStyle = dark; // border
  ctx.fillRect(0, 0, TILE, 1);
  ctx.fillRect(0, TILE - 1, TILE, 1);
  ctx.fillRect(0, 0, 1, TILE);
  ctx.fillRect(TILE - 1, 0, 1, TILE);
  ctx.fillRect(0, 11, TILE, 1); // lower seam
  for (const [x, y] of [[3, 6], [12, 6], [3, 13], [12, 13]] as const) {
    ctx.fillStyle = dark; // rivets
    ctx.fillRect(x, y, 2, 2);
    ctx.fillStyle = light;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawToolHandle(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#6b4a2a";
  for (let i = 0; i < 9; i++) ctx.fillRect(3 + i, 13 - i, 2, 2);
}

function drawChestFace(ctx: CanvasRenderingContext2D, latch: boolean): void {
  drawTile(ctx, 0, 0, { base: "#8a5a2b", speckle: "#734a20", speckleDensity: 0.25, border: "#5d3a16" }, 83);
  ctx.fillStyle = "#5d3a16"; // lid seam
  ctx.fillRect(1, 4, 14, 1);
  if (latch) {
    ctx.fillStyle = "#3a3a3a";
    ctx.fillRect(6, 2, 4, 5);
    ctx.fillStyle = "#9a9a9a";
    ctx.fillRect(7, 3, 2, 3);
  }
}

function drawBushSprite(ctx: CanvasRenderingContext2D, berries: boolean): void {
  const rand = tileRng(berries ? 191 : 193);
  const density = berries ? 0.85 : 0.55;
  // Stem.
  ctx.fillStyle = "#5d4326";
  ctx.fillRect(7, 11, 2, 5);
  // Leafy blob (transparent background — this is a cutout sprite).
  for (let y = 2; y < 13; y++) {
    for (let x = 1; x < 15; x++) {
      const dx = (x - 7.5) / 7;
      const dy = (y - 7) / 5.5;
      if (dx * dx + dy * dy <= 1 && rand() < density) {
        ctx.fillStyle = rand() < 0.5 ? "#3e7a2f" : "#347026";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  if (berries) {
    ctx.fillStyle = "#c0455a";
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(2 + Math.floor(rand() * 12), 3 + Math.floor(rand() * 8), 1, 1);
    }
  }
}

// Deterministic tiny RNG so tiles look identical every boot.
function tileRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function drawTile(ctx: CanvasRenderingContext2D, ox: number, oy: number, spec: TileSpec, seed: number): void {
  const rand = tileRng(seed);
  ctx.fillStyle = spec.base;
  ctx.fillRect(ox, oy, TILE, TILE);
  ctx.fillStyle = spec.speckle;
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (rand() < spec.speckleDensity) ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  }
  if (spec.border) {
    ctx.fillStyle = spec.border;
    ctx.fillRect(ox, oy, TILE, 1);
    ctx.fillRect(ox, oy + TILE - 1, TILE, 1);
    ctx.fillRect(ox, oy, 1, TILE);
    ctx.fillRect(ox + TILE - 1, oy, 1, TILE);
  }
}

// Missing-texture fallback: magenta/black checker, always available.
function drawMissing(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 2; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#ff00ff" : "#000000";
      ctx.fillRect(ox + x * (TILE / 2), oy + y * (TILE / 2), TILE / 2, TILE / 2);
    }
  }
}

/** Terrain atlas: fixed tile order so chunk geometry can compute UVs. */
export const TERRAIN_ATLAS_ORDER = [
  "terrain.grass.top",
  "terrain.grass.side",
  "terrain.dirt",
  "terrain.stone",
  "terrain.sand",
  "terrain.water",
  "terrain.plank",
  "terrain.snow",
  "terrain.ice",
  "terrain.mud",
  "terrain.redsand",
  "terrain.mycelium",
  "terrain.drygrass",
  "terrain.stonebrick",
  // Appended (order fixed: existing tiles keep their column index).
  "terrain.gravel",
  "terrain.coarsedirt",
  "terrain.podzol",
  "terrain.clay",
  "terrain.moss",
  "terrain.andesite",
  "terrain.calcite",
  "terrain.terracotta",
  "terrain.redterracotta",
  "terrain.orangeterracotta",
  "terrain.whiteterracotta",
  // Block-registry additions (content/blocks.ts). Order stays append-only so
  // existing tiles keep their column index; every id is a baked Faithful tile.
  "terrain.basalt",
  "terrain.diorite",
  "terrain.granite",
  "terrain.endstone",
  "terrain.netherbrick",
  "terrain.prismarine",
  "terrain.darkprismarine",
  "terrain.purpur",
  "terrain.quartz",
  "terrain.blackstone",
  "terrain.deepslate",
  "terrain.cobble",
  ...DYE_COLORS.map((c) => `block.wool.${c}`),
  ...DYE_COLORS.map((c) => `block.concrete.${c}`),
];

/** A resolved entity texture (mob skin / chest atlas) at native size. */
export interface EntitySkin {
  texture: THREE.CanvasTexture;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class MaterialResolver {
  readonly terrainAtlas: THREE.CanvasTexture;
  private iconUrlCache = new Map<string, string | null>();
  private readonly atlasCols = TERRAIN_ATLAS_ORDER.length;
  private cache = new Map<string, THREE.CanvasTexture>();
  private entityCache = new Map<string, EntitySkin | null>();
  private atlasCanvas: HTMLCanvasElement;
  /** Imported-pack overrides: materialId -> decoded native-size image. Cosmetic only. */
  private packImages = new Map<string, HTMLImageElement>();

  /**
   * Icon-sized data URL for a material: the active pack's art when it
   * covers the id, else the baked licensed default. Null when neither does.
   */
  iconDataUrl(materialId: string): string | null {
    const hit = this.iconUrlCache.get(materialId);
    if (hit !== undefined) return hit;
    const src = this.packImages.get(materialId) ?? defaultTile(materialId) ?? undefined;
    let url: string | null = null;
    if (src) {
      const c = document.createElement("canvas");
      c.width = src.width;
      c.height = src.height;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        if (src instanceof ImageData) ctx.putImageData(src, 0, 0);
        else ctx.drawImage(src, 0, 0);
        url = c.toDataURL();
      }
    }
    this.iconUrlCache.set(materialId, url);
    return url;
  }

  /** Atlas tile pixel size: grows to match the largest baked terrain art. */
  private readonly atlasTile = Math.max(
    TILE,
    ...TERRAIN_ATLAS_ORDER.map((id) => defaultTile(id)?.width ?? TILE),
  );

  constructor() {
    this.atlasCanvas = document.createElement("canvas");
    this.atlasCanvas.width = this.atlasTile * this.atlasCols;
    this.atlasCanvas.height = this.atlasTile;
    this.terrainAtlas = new THREE.CanvasTexture(this.atlasCanvas);
    this.terrainAtlas.magFilter = THREE.NearestFilter;
    this.terrainAtlas.minFilter = THREE.NearestFilter;
    this.terrainAtlas.colorSpace = THREE.SRGBColorSpace;
    this.redrawAtlas();
  }

  private redrawAtlas(): void {
    const ctx = this.atlasCanvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.atlasCanvas.width, this.atlasCanvas.height);
    const at = this.atlasTile;
    TERRAIN_ATLAS_ORDER.forEach((id, i) => {
      const pack = this.packImages.get(id);
      const fallback = defaultTile(id);
      const spec = TILE_SPECS[id];
      if (pack) ctx.drawImage(pack, i * at, 0, at, at);
      else if (fallback) ctx.drawImage(imageDataCanvas(fallback), i * at, 0, at, at);
      else {
        // Procedural tiles draw in 16px space; scale them up to the slot.
        ctx.save();
        ctx.translate(i * at, 0);
        ctx.scale(at / TILE, at / TILE);
        if (spec) drawTile(ctx, 0, 0, spec, 7 + i * 131);
        else drawMissing(ctx, 0, 0);
        ctx.restore();
      }
    });
    this.terrainAtlas.needsUpdate = true;
  }

  /**
   * Apply an imported texture pack (materialId -> 16x16 PNG data URL) or
   * restore built-in art with null. Purely visual: any ID the pack does not
   * cover keeps the built-in procedural tile. Caller must rebuild the scene
   * afterwards so cached standalone textures are re-resolved.
   */
  async setPack(textures: Record<string, string> | null): Promise<void> {
    const images = new Map<string, HTMLImageElement>();
    if (textures) {
      await Promise.all(
        Object.entries(textures).map(
          (entry) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                images.set(entry[0], img);
                resolve();
              };
              img.onerror = () => resolve(); // undecodable: keep built-in art
              img.src = entry[1];
            }),
        ),
      );
    }
    this.packImages = images;
    this.cache.clear();
    this.entityCache.clear();
    this.redrawAtlas();
  }

  /**
   * Entity texture (mob skin, chest atlas) at native pixel size: imported
   * pack first, then the baked defaults, else null (the renderer keeps its
   * built-in original art). Classic layouts are 64 base px wide, so a
   * texture's scale factor is width / 64.
   */
  entitySkin(key: string): EntitySkin | null {
    const cached = this.entityCache.get(key);
    if (cached !== undefined) return cached;
    let canvas: HTMLCanvasElement | null = null;
    const packImg = this.packImages.get(key);
    if (packImg) {
      canvas = document.createElement("canvas");
      canvas.width = packImg.naturalWidth || packImg.width;
      canvas.height = packImg.naturalHeight || packImg.height;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(packImg, 0, 0);
    } else {
      const b64 = DEFAULT_ENTITY_TEXTURES[key];
      const png = b64 ? decodePngBase64(b64) : null;
      if (png) canvas = imageDataCanvas(new ImageData(png.rgba, png.width, png.height));
    }
    if (!canvas || canvas.width < 32) {
      this.entityCache.set(key, null);
      return null;
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const skin: EntitySkin = { texture, canvas, width: canvas.width, height: canvas.height };
    this.entityCache.set(key, skin);
    return skin;
  }

  /**
   * The chest prop's square face tiles, composited from the pack's chest
   * atlas (lid strip above base strip, latch on the front) when one is
   * available; null keeps the built-in drawn faces.
   */
  private composeChestFace(materialId: string): HTMLCanvasElement | null {
    const chest = this.entitySkin("entity.chest");
    if (!chest) return null;
    const k = chest.width / 64;
    if (chest.height < 43 * k) return null;
    const side = Math.max(16, Math.round(16 * k));
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const draw = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number) =>
      ctx.drawImage(chest.canvas, sx * k, sy * k, sw * k, sh * k, dx, dy, dw, dh);
    if (materialId === "object.chest.top") {
      draw(14, 0, 14, 14, 0, 0, side, side); // lid top
      return canvas;
    }
    const u = materialId === "object.chest.front" ? 14 : 0; // front vs left strip
    const lidH = Math.round((side * 5) / 15);
    draw(u, 14, 14, 5, 0, 0, side, lidH); // lid band
    draw(u, 33, 14, 10, 0, lidH, side, side - lidH); // base band
    if (materialId === "object.chest.front") {
      const lw = Math.max(2, Math.round((side * 2) / 16));
      const lh = Math.max(4, Math.round((side * 4) / 16));
      draw(1, 1, 2, 4, Math.round(side / 2 - lw / 2), Math.max(0, lidH - Math.round(lh / 2)), lw, lh);
    }
    return canvas;
  }

  /** UV rect [u0, v0, u1, v1] of a logical terrain material in the atlas (with a small inset against bleed). */
  atlasUv(materialId: string): [number, number, number, number] {
    let index = (TERRAIN_ATLAS_ORDER as readonly string[]).indexOf(materialId);
    if (index < 0) index = 0;
    const inset = 0.02 / this.atlasCols;
    return [index / this.atlasCols + inset, 0.02, (index + 1) / this.atlasCols - inset, 0.98];
  }

  /**
   * Standalone 16x16 texture for entity materials (trees, chest, sprites, ...).
   * RepeatWrapping so multi-block faces tile at one texture per block —
   * keeping texel density identical to standard block art. Cached per ID.
   */
  texture(materialId: string): THREE.CanvasTexture {
    const cached = this.cache.get(materialId);
    if (cached) return cached;
    const pack = this.packImages.get(materialId);
    // Chest faces have no direct block texture in standard packs; they are
    // composited from the entity chest atlas when one is available.
    const composed =
      !pack && materialId.startsWith("object.chest.") ? this.composeChestFace(materialId) : null;
    const fallback = composed ? null : defaultTile(materialId);
    const custom = CUSTOM_DRAW[materialId];
    const spec = TILE_SPECS[materialId];
    const canvas = document.createElement("canvas");
    // The canvas matches the art's native size; UVs are normalized, so
    // consumers see finer texels, not different geometry.
    const side = pack
      ? Math.max(TILE, pack.naturalWidth || TILE)
      : composed?.width ?? fallback?.width ?? TILE;
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d")!;
    if (pack) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pack, 0, 0, side, side);
    } else if (composed) ctx.drawImage(composed, 0, 0);
    else if (fallback) ctx.putImageData(fallback, 0, 0);
    else if (custom) custom(ctx);
    else if (spec) drawTile(ctx, 0, 0, spec, materialId.length * 977 + 13);
    else drawMissing(ctx, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.cache.set(materialId, tex);
    return tex;
  }
}
