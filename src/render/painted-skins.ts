// Painted pixel skins for the wave-2 original creatures (goblin family, yeti,
// rattlesnake, werewolf, magma hound). These are the shipped placeholder
// skins: tiny canvas textures painted at Minecraft-pixel scale and applied to
// simple chunky rigs, so the detail lives in the texture rather than in
// stacked geometry. When dedicated atlas art lands for these creatures
// (ASSETS_NEEDED.md), the rigs swap to UV-mapped entity skins and these
// painters retire.
import * as THREE from "three";

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
export type PaintedMats = Record<string, THREE.MeshLambertMaterial>;

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

/** Deterministic speckle fill: base coat with dark/light noise pixels.
 *  Seeded (not Math.random) so every rebuilt view paints identically. */
const spk = (base: string, dark: string, light: string, den = 0.25): Painter => (ctx, w, h) => {
  let s = (w * 73856093) ^ (h * 19349663) ^ base.charCodeAt(1);
  const rnd = (): number => {
    s = (s * 1103515245 + 12345) >>> 0;
    return s / 2 ** 32;
  };
  px(ctx, 0, 0, w, h, base);
  for (let i = 0; i < w * h * den; i++) {
    px(ctx, (rnd() * w) | 0, (rnd() * h) | 0, 1, 1, rnd() < 0.5 ? dark : light);
  }
};

const over = (base: Painter, feat: Painter): Painter => (ctx, w, h) => {
  base(ctx, w, h);
  feat(ctx, w, h);
};

function mkMat(paint: Painter, w = 12, h = 12): THREE.MeshLambertMaterial {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  paint(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: t });
}

/** Jagged glowing ember cracks over charcoal hide (magma hound). */
const cracked = (n: number, seedBias = 0): Painter => over(
  spk("#2b2420", "#1d1815", "#3a322c", 0.3),
  (ctx, w, h) => {
    let s = (0x9e3779b9 ^ (n * 2654435761) ^ seedBias) >>> 0;
    const rnd = (): number => {
      s = (s * 1103515245 + 12345) >>> 0;
      return s / 2 ** 32;
    };
    for (let k = 0; k < n; k++) {
      let x = 2 + ((rnd() * (w - 4)) | 0);
      for (let y = 1; y < h - 1; y++) {
        px(ctx, x, y, 1, 1, rnd() < 0.3 ? "#ffb238" : "#ff5a2a");
        if (rnd() < 0.25) px(ctx, x + 1, y, 1, 1, "#ffd23a");
        x = Math.max(1, Math.min(w - 2, x + ((rnd() * 3) | 0) - 1));
      }
    }
  },
);

const BUILDERS: Record<string, () => PaintedMats> = {
  goblin: () => {
    const skin = spk("#5d8c3a", "#4c7530", "#6f9e4c");
    const vest = spk("#6b4a2a", "#59391f", "#7d5a37");
    return {
      skin: mkMat(skin),
      // Wrapped feet painted into the leg's bottom rows so the walking swing
      // carries the feet along.
      leg: mkMat(over(skin, (c) => { px(c, 0, 9, 12, 3, "#6b4a2a"); px(c, 0, 9, 12, 1, "#59391f"); })),
      vest: mkMat(vest),
      face: mkMat(over(skin, (c) => {
        px(c, 1, 3, 10, 1, "#3c5c26");                       // brow
        px(c, 2, 4, 3, 2, "#d8e030"); px(c, 3, 5, 1, 1, "#1c1815"); // left eye
        px(c, 7, 4, 3, 2, "#d8e030"); px(c, 8, 5, 1, 1, "#1c1815"); // right eye
        px(c, 5, 6, 2, 3, "#4c7530"); px(c, 5, 8, 2, 1, "#3c5c26"); // long nose
        px(c, 2, 9, 8, 2, "#2a1e12");                        // wide mouth
        px(c, 3, 9, 1, 1, "#e8dcc8"); px(c, 8, 9, 1, 2, "#e8dcc8"); px(c, 5, 10, 1, 1, "#e8dcc8"); // snaggle teeth
        px(c, 10, 7, 1, 1, "#6f9e4c");                       // wart
      })),
      body: mkMat(over(vest, (c) => {
        px(c, 4, 0, 4, 5, "#5d8c3a");                        // green chest showing
        px(c, 2, 1, 1, 7, "#3a2c1c"); px(c, 9, 1, 1, 7, "#3a2c1c"); // stitching
        px(c, 0, 9, 12, 2, "#3a2c1c"); px(c, 5, 9, 2, 2, "#c9a227"); // belt + buckle
      })),
      // Shaman: bone-fetish robe front in duskcap red.
      bodyShaman: mkMat(over(spk("#7c3a3a", "#66302f", "#8f4a46"), (c) => {
        px(c, 3, 2, 6, 1, "#e8dcc8"); px(c, 4, 3, 1, 2, "#e8dcc8"); px(c, 7, 3, 1, 2, "#e8dcc8"); // bone necklace
        px(c, 0, 9, 12, 2, "#3a2c1c");                       // rope belt
      })),
      // Chief: gold-trimmed war vest.
      bodyChief: mkMat(over(vest, (c) => {
        px(c, 0, 0, 12, 1, "#c9a227"); px(c, 0, 9, 12, 2, "#3a2c1c");
        px(c, 5, 9, 2, 2, "#c9a227");
        px(c, 4, 1, 4, 4, "#5d8c3a");                        // chest showing
        px(c, 1, 1, 1, 8, "#c9a227"); px(c, 10, 1, 1, 8, "#c9a227"); // gold trim
      })),
      wood: mkMat(spk("#8a6844", "#6f5236", "#9c7a52")),
      clubHead: mkMat(over(spk("#8a6844", "#6f5236", "#9c7a52"), (c) => {
        px(c, 1, 1, 2, 2, "#8b95a1"); px(c, 9, 1, 2, 2, "#8b95a1");
        px(c, 1, 9, 2, 2, "#8b95a1"); px(c, 9, 9, 2, 2, "#8b95a1"); // iron studs
      })),
      ear: mkMat(over(skin, (c) => { px(c, 3, 4, 6, 5, "#3f6b2f"); })),
      pauldron: mkMat(spk("#4a5560", "#3a444e", "#5a6570")),
    };
  },
  yeti: () => {
    const fur = spk("#e4ebf0", "#c4ced6", "#f6f9fb", 0.3);
    const furD = spk("#cfd6da", "#b2bcc4", "#e4ebf0", 0.3);
    return {
      fur: mkMat(fur, 14, 14),
      furD: mkMat(furD, 14, 14),
      // Dark feet painted into the leg bottom so the stride carries them.
      leg: mkMat(over(furD, (c) => { px(c, 0, 11, 14, 3, "#4a5560"); }), 14, 14),
      hand: mkMat(spk("#4a5560", "#3a444e", "#5a6570")),
      chest: mkMat(over(fur, (c) => {
        px(c, 3, 4, 6, 7, "#8f9ba3");                        // grey skin chest patch
        px(c, 5, 5, 1, 5, "#77848d"); px(c, 3, 6, 6, 1, "#77848d"); // pec creases
      })),
      face: mkMat(over(fur, (c) => {
        px(c, 2, 4, 8, 7, "#4a5560");                        // dark face patch
        px(c, 1, 3, 10, 1, "#b2bcc4");                       // brow ridge
        px(c, 3, 5, 2, 2, "#9fd8ff"); px(c, 4, 6, 1, 1, "#0d3550"); // left eye
        px(c, 7, 5, 2, 2, "#9fd8ff"); px(c, 7, 6, 1, 1, "#0d3550"); // right eye
        px(c, 5, 7, 2, 1, "#374049");                        // flat nose
        px(c, 3, 9, 6, 1, "#1c2228");                        // open mouth
        px(c, 3, 8, 1, 2, "#e8dcc8"); px(c, 8, 8, 1, 2, "#e8dcc8"); // upturned tusks
      })),
    };
  },
  rattlesnake: () => {
    const scale = spk("#a08153", "#8a6c40", "#b39366");
    return {
      scale: mkMat(scale),
      top: mkMat(over(scale, (c) => {                        // diamond-back pattern
        px(c, 4, 1, 4, 1, "#5d4526"); px(c, 3, 2, 2, 2, "#5d4526"); px(c, 7, 2, 2, 2, "#5d4526");
        px(c, 4, 4, 4, 1, "#5d4526"); px(c, 5, 2, 2, 2, "#c9b98a");
        px(c, 4, 7, 4, 1, "#5d4526"); px(c, 3, 8, 2, 2, "#5d4526"); px(c, 7, 8, 2, 2, "#5d4526");
        px(c, 4, 10, 4, 1, "#5d4526"); px(c, 5, 8, 2, 2, "#c9b98a");
      })),
      side: mkMat(over(scale, (c) => {                       // banded flanks over cream belly
        px(c, 0, 8, 12, 4, "#c9b98a");
        for (let x = 0; x < 12; x += 4) px(c, x, 2, 2, 6, "#8a6c40");
      })),
      belly: mkMat(spk("#c9b98a", "#b5a276", "#d8c9a0")),
      headTop: mkMat(over(scale, (c) => {                    // arrow marking down the skull
        px(c, 4, 2, 4, 3, "#5d4526"); px(c, 3, 5, 6, 2, "#5d4526"); px(c, 5, 7, 2, 3, "#5d4526");
      })),
      face: mkMat(over(scale, (c) => {
        px(c, 0, 0, 12, 2, "#5d4526");                       // brow band
        px(c, 1, 2, 3, 3, "#d8e030"); px(c, 2, 3, 1, 2, "#1c1815"); // left eye + slit pupil
        px(c, 8, 2, 3, 3, "#d8e030"); px(c, 9, 3, 1, 2, "#1c1815"); // right eye + slit pupil
        px(c, 4, 5, 1, 1, "#3a2c1c"); px(c, 7, 5, 1, 1, "#3a2c1c"); // heat pits
        px(c, 1, 8, 10, 1, "#6b5433");                       // mouth line
        px(c, 2, 8, 1, 3, "#f2ead6"); px(c, 9, 8, 1, 3, "#f2ead6"); // fangs
      })),
      rattle: mkMat((c) => {
        for (let y = 0; y < 12; y += 3) {
          px(c, 0, y, 12, 2, "#d8c9a0");
          px(c, 0, y + 2, 12, 1, "#9c8a5e");
        }
      }),
    };
  },
  werewolf: () => {
    const fur = spk("#3a3f47", "#2c3138", "#4a505a", 0.3);
    const furD = spk("#2f333a", "#23272d", "#3d434b", 0.3);
    return {
      fur: mkMat(fur),
      furD: mkMat(furD),
      // Torn trouser remnants on the thigh; digitigrade dark shin below.
      leg: mkMat(over(fur, (c) => {
        px(c, 0, 0, 12, 4, "#2b4a63");
        px(c, 3, 3, 1, 2, "#223c52"); px(c, 8, 2, 1, 3, "#223c52"); // ragged hem
        px(c, 0, 8, 12, 4, "#23272d");                       // dark lower leg
      })),
      chest: mkMat(over(fur, (c) => {
        px(c, 3, 3, 6, 7, "#57534f");                        // grey chest fur
        px(c, 4, 4, 1, 5, "#66625c"); px(c, 7, 4, 1, 5, "#66625c");
      })),
      face: mkMat(over(fur, (c) => {
        px(c, 1, 2, 10, 1, "#23272d");                       // brow
        px(c, 2, 3, 3, 2, "#e8b13a"); px(c, 3, 4, 1, 1, "#1c1815"); // left eye
        px(c, 7, 3, 3, 2, "#e8b13a"); px(c, 8, 4, 1, 1, "#1c1815"); // right eye
        px(c, 2, 0, 1, 3, "#8f959c");                        // scar
      })),
      muzzle: mkMat(over(furD, (c) => {
        px(c, 3, 0, 4, 2, "#14171b");                        // nose
        px(c, 1, 5, 8, 2, "#7c2626");                        // snarling mouth
        px(c, 2, 5, 1, 1, "#e8dcc8"); px(c, 5, 5, 1, 1, "#e8dcc8"); px(c, 7, 5, 1, 1, "#e8dcc8"); // upper teeth
        px(c, 3, 6, 1, 1, "#e8dcc8"); px(c, 6, 6, 1, 1, "#e8dcc8"); // lower teeth
      }), 10, 8),
      ear: mkMat(over(furD, (c) => { px(c, 4, 3, 4, 6, "#57534f"); })),
    };
  },
  magma_hound: () => ({
    body: mkMat(cracked(3), 14, 10),
    mane: mkMat(cracked(2, 7), 12, 10),
    leg: mkMat(cracked(1, 13), 8, 10),
    coal: mkMat(spk("#2b2420", "#1d1815", "#3a322c", 0.3)),
    obsidian: mkMat(spk("#1a1614", "#0f0c0a", "#282320", 0.3)),
    face: mkMat(over(spk("#2b2420", "#1d1815", "#3a322c", 0.3), (c) => {
      px(c, 1, 2, 10, 1, "#0f0c0a");                         // brow plate
      px(c, 1, 3, 4, 3, "#ffb238"); px(c, 2, 4, 2, 1, "#ffe066"); // left furnace eye
      px(c, 7, 3, 4, 3, "#ffb238"); px(c, 8, 4, 2, 1, "#ffe066"); // right furnace eye
      px(c, 10, 7, 1, 3, "#ff5a2a");                         // cheek crack
    })),
    snout: mkMat(over(spk("#1a1614", "#0f0c0a", "#282320", 0.3), (c) => {
      px(c, 3, 0, 4, 2, "#14100d");                          // nose
      px(c, 1, 5, 8, 2, "#ffb238");                          // glowing jaw seam
      px(c, 2, 5, 1, 2, "#1d1815"); px(c, 5, 5, 1, 2, "#1d1815"); px(c, 7, 5, 1, 2, "#1d1815"); // teeth silhouettes
    }), 10, 8),
    tail: mkMat((c) => {                                     // flame gradient down the wolf tail
      let s = 0xa53c9e1 >>> 0;
      const rnd = (): number => {
        s = (s * 1103515245 + 12345) >>> 0;
        return s / 2 ** 32;
      };
      px(c, 0, 0, 12, 4, "#c73a12"); px(c, 0, 4, 12, 4, "#ff5a2a");
      px(c, 0, 8, 12, 2, "#ffb238"); px(c, 0, 10, 12, 2, "#ffe066");
      for (let i = 0; i < 26; i++) px(c, (rnd() * 12) | 0, (rnd() * 12) | 0, 1, 1, rnd() < 0.5 ? "#ffb238" : "#e84a1a");
    }),
  }),
};

const cache = new Map<string, PaintedMats>();

/** Painted-skin material bundle for one creature kind; null outside a DOM
 *  (headless sim tests never touch the renderer). */
export function paintedMats(kind: string): PaintedMats | null {
  if (typeof document === "undefined") return null;
  const hit = cache.get(kind);
  if (hit) return hit;
  const build = BUILDERS[kind];
  if (!build) return null;
  const mats = build();
  cache.set(kind, mats);
  return mats;
}
