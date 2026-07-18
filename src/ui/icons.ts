// Original 16x16 pixel-art icons for the HUD, drawn procedurally on canvas
// (same technique as the world's texture tiles) and served as data URLs.
// Icons are purely presentational; item/skill identity stays in content IDs.

const T = 16;

type Draw = (ctx: CanvasRenderingContext2D) => void;

const cache = new Map<string, string>();

function render(key: string, draw: Draw): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = T;
  canvas.height = T;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const url = canvas.toDataURL("image/png");
  cache.set(key, url);
  return url;
}

// ---------- shared parts ----------

const WOOD = "#6b4a2a";
const WOOD_DARK = "#59391e";
const OUTLINE = "#221d16";

function handle(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = WOOD;
  for (let i = 0; i < 9; i++) ctx.fillRect(3 + i, 13 - i, 2, 2);
  ctx.fillStyle = WOOD_DARK;
  for (let i = 0; i < 9; i += 2) ctx.fillRect(3 + i, 14 - i, 1, 1);
}

function axe(head: string, edge: string): Draw {
  return (ctx) => {
    handle(ctx);
    ctx.fillStyle = head;
    ctx.fillRect(6, 2, 5, 2);
    ctx.fillRect(5, 4, 7, 3);
    ctx.fillRect(6, 7, 4, 1);
    ctx.fillStyle = edge;
    ctx.fillRect(5, 4, 1, 3);
    ctx.fillRect(6, 2, 1, 2);
  };
}

function pickaxe(head: string, edge: string): Draw {
  return (ctx) => {
    handle(ctx);
    ctx.fillStyle = head;
    ctx.fillRect(3, 3, 10, 2);
    ctx.fillRect(2, 5, 2, 3);
    ctx.fillRect(12, 5, 2, 3);
    ctx.fillStyle = edge;
    ctx.fillRect(3, 3, 10, 1);
  };
}

function sword(blade: string, edge: string, guard: string): Draw {
  return (ctx) => {
    ctx.fillStyle = WOOD;
    ctx.fillRect(3, 12, 2, 2);
    ctx.fillRect(4, 11, 2, 2);
    ctx.fillStyle = guard;
    ctx.fillRect(4, 9, 3, 3);
    ctx.fillStyle = blade;
    for (let i = 0; i < 7; i++) ctx.fillRect(6 + i, 9 - i, 2, 2);
    ctx.fillStyle = edge;
    for (let i = 0; i < 7; i++) ctx.fillRect(7 + i, 8 - i, 1, 1);
  };
}

const hammer: Draw = (ctx) => {
  handle(ctx);
  ctx.fillStyle = "#5a5d60";
  ctx.fillRect(6, 2, 7, 5);
  ctx.fillStyle = "#8a8d90";
  ctx.fillRect(6, 2, 7, 2);
};

const rod: Draw = (ctx) => {
  ctx.fillStyle = WOOD;
  for (let i = 0; i < 11; i++) ctx.fillRect(3 + i, 14 - i, 1, 2);
  ctx.fillStyle = "#8a8d90";
  ctx.fillRect(14, 2, 1, 6);
  ctx.fillRect(13, 8, 1, 1);
  ctx.fillRect(12, 9, 1, 1);
};

function bar(base: string, light: string, dark: string): Draw {
  return (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(3, 5, 10, 1);
    ctx.fillRect(2, 6, 12, 6);
    ctx.fillStyle = light;
    ctx.fillRect(4, 6, 9, 2);
    ctx.fillStyle = base;
    ctx.fillRect(3, 8, 10, 3);
    ctx.fillStyle = dark;
    ctx.fillRect(3, 10, 10, 1);
    ctx.fillStyle = light;
    ctx.fillRect(5, 7, 3, 1);
  };
}

function rock(nugget?: [string, string]): Draw {
  return (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(3, 4, 10, 10);
    ctx.fillRect(2, 6, 12, 6);
    ctx.fillRect(5, 3, 6, 12);
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(4, 5, 8, 8);
    ctx.fillRect(3, 6, 10, 5);
    ctx.fillRect(5, 4, 6, 10);
    ctx.fillStyle = "#9ea1a4";
    ctx.fillRect(5, 4, 5, 3);
    ctx.fillStyle = "#6f7275";
    ctx.fillRect(4, 11, 8, 2);
    if (nugget) {
      for (const [x, y] of [[4, 5], [9, 7], [5, 10]] as const) {
        ctx.fillStyle = nugget[0];
        ctx.fillRect(x, y, 3, 3);
        ctx.fillStyle = nugget[1];
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x, y, 1, 2);
      }
    }
  };
}

function fish(body: string, belly: string, dark: string): Draw {
  return (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(2, 6, 10, 5);
    ctx.fillRect(3, 5, 8, 7);
    ctx.fillRect(11, 4, 3, 3);
    ctx.fillRect(11, 10, 3, 3);
    ctx.fillRect(12, 7, 2, 3);
    ctx.fillStyle = body;
    ctx.fillRect(3, 6, 8, 4);
    ctx.fillRect(4, 5, 6, 6);
    ctx.fillStyle = belly;
    ctx.fillRect(4, 9, 6, 2);
    ctx.fillStyle = body;
    ctx.fillRect(12, 5, 1, 2);
    ctx.fillRect(12, 10, 1, 2);
    ctx.fillRect(11, 7, 2, 3);
    ctx.fillStyle = dark;
    ctx.fillRect(6, 5, 1, 2); // gill
    ctx.fillStyle = "#10151b";
    ctx.fillRect(4, 7, 1, 1); // eye
  };
}

function meat(flesh: string, sheen: string, boneless = false): Draw {
  return (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(2, 4, 10, 9);
    ctx.fillRect(3, 3, 9, 11);
    ctx.fillStyle = flesh;
    ctx.fillRect(3, 4, 8, 8);
    ctx.fillRect(4, 3, 7, 10);
    ctx.fillStyle = sheen;
    ctx.fillRect(4, 4, 4, 3);
    if (!boneless) {
      ctx.fillStyle = "#e8e2d4"; // bone
      ctx.fillRect(11, 10, 3, 2);
      ctx.fillRect(13, 9, 2, 2);
      ctx.fillRect(13, 12, 2, 2);
    }
  };
}

function helmet(base: string, light: string, dark: string): Draw {
  return (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(2, 4, 12, 8);
    ctx.fillRect(4, 2, 8, 4);
    ctx.fillStyle = base;
    ctx.fillRect(3, 5, 10, 6);
    ctx.fillRect(5, 3, 6, 4);
    ctx.fillStyle = light;
    ctx.fillRect(5, 3, 6, 2);
    ctx.fillRect(3, 5, 2, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(3, 9, 10, 2);
    ctx.fillStyle = "#10151b"; // eye slit
    ctx.fillRect(4, 7, 8, 1);
  };
}

function tunic(base: string, light: string, dark: string): Draw {
  return (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(1, 3, 14, 6);
    ctx.fillRect(4, 2, 8, 12);
    ctx.fillStyle = base;
    ctx.fillRect(2, 4, 3, 4); // left sleeve
    ctx.fillRect(11, 4, 3, 4); // right sleeve
    ctx.fillRect(5, 3, 6, 10); // torso
    ctx.fillStyle = light;
    ctx.fillRect(5, 3, 6, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(5, 11, 6, 2);
    ctx.fillRect(2, 7, 3, 1);
    ctx.fillRect(11, 7, 3, 1);
    ctx.fillStyle = "#10151b"; // collar
    ctx.fillRect(7, 3, 2, 2);
  };
}

function leggings(base: string, light: string, dark: string): Draw {
  return (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(3, 2, 10, 4);
    ctx.fillRect(3, 5, 4, 10);
    ctx.fillRect(9, 5, 4, 10);
    ctx.fillStyle = base;
    ctx.fillRect(4, 3, 8, 3);
    ctx.fillRect(4, 6, 3, 8);
    ctx.fillRect(9, 6, 3, 8);
    ctx.fillStyle = light;
    ctx.fillRect(4, 3, 8, 1);
    ctx.fillStyle = dark;
    ctx.fillRect(4, 12, 3, 2);
    ctx.fillRect(9, 12, 3, 2);
  };
}

const LEATHER = ["#8a5a2b", "#a5793f", "#6e4620"] as const;
const COPPER = ["#c47a3d", "#e39a5f", "#8a5230"] as const;
const BRONZE = ["#b08d57", "#d4b06a", "#7d6138"] as const;
const IRON = ["#b8bfc8", "#dde3ea", "#7f868f"] as const;

// ---------- item icons ----------

const ITEM_DRAWS: Record<string, Draw> = {
  "item.log.basic": (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(1, 4, 14, 8);
    ctx.fillStyle = WOOD;
    ctx.fillRect(2, 5, 12, 6);
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(5, 6, 8, 1);
    ctx.fillRect(6, 9, 7, 1);
    ctx.fillStyle = "#a5793f"; // cut face
    ctx.fillRect(2, 5, 3, 6);
    ctx.fillStyle = "#8a6332";
    ctx.fillRect(3, 6, 1, 4);
    ctx.fillRect(2, 7, 3, 1);
  },
  "item.ore.copper": rock(["#c47a3d", "#e39a5f"]),
  "item.ore.tin": rock(["#c3c9d0", "#e8edf2"]),
  "item.ore.iron": rock(["#d8b89a", "#f0d8c0"]),
  "item.stone.rough": rock(),
  "item.berry.basic": (ctx) => {
    ctx.fillStyle = "#3e7a2f"; // sprig
    ctx.fillRect(7, 2, 2, 3);
    ctx.fillRect(5, 3, 2, 2);
    ctx.fillRect(9, 3, 2, 1);
    const berry = (x: number, y: number) => {
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(x - 1, y, 5, 3);
      ctx.fillRect(x, y - 1, 3, 5);
      ctx.fillStyle = "#5b6ee1";
      ctx.fillRect(x, y, 3, 3);
      ctx.fillStyle = "#8f9df0";
      ctx.fillRect(x, y, 1, 1);
    };
    berry(3, 7);
    berry(9, 6);
    berry(6, 11);
  },
  "item.egg": (ctx) => {
    // A little egg: dark silhouette, cream shell, soft highlight and shade.
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(6, 2, 4, 1);
    ctx.fillRect(5, 3, 6, 1);
    ctx.fillRect(4, 4, 8, 8);
    ctx.fillRect(5, 12, 6, 1);
    ctx.fillRect(6, 13, 4, 1);
    ctx.fillStyle = "#f4ecd4";
    ctx.fillRect(6, 3, 4, 1);
    ctx.fillRect(5, 4, 6, 8);
    ctx.fillRect(6, 12, 4, 1);
    ctx.fillStyle = "#fffdf5";
    ctx.fillRect(6, 5, 2, 2);
    ctx.fillStyle = "#dcd0ac";
    ctx.fillRect(9, 9, 2, 2);
    ctx.fillRect(7, 11, 3, 1);
  },
  "item.fish.raw": fish("#7fa8c9", "#a8c8de", "#5d86a8"),
  "item.fish.cooked": fish("#d98a3f", "#f0b06a", "#a8622a"),
  "item.fish.burnt": fish("#4a4440", "#5f574f", "#332e2a"),
  "item.bar.copper": bar("#c47a3d", "#e39a5f", "#8a5230"),
  "item.bar.tin": bar("#c3c9d0", "#e8edf2", "#8f959c"),
  "item.bar.bronze": bar("#b08d57", "#d4b06a", "#7d6138"),
  "item.bar.iron": bar("#b8bfc8", "#dde3ea", "#7f868f"),
  "item.brick.stone": (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(1, 3, 14, 11);
    ctx.fillStyle = "#8d9093";
    ctx.fillRect(2, 4, 12, 9);
    ctx.fillStyle = "#9ea1a4";
    ctx.fillRect(2, 4, 12, 2);
    ctx.fillStyle = "#5a5d60"; // mortar
    ctx.fillRect(2, 7, 12, 1);
    ctx.fillRect(2, 10, 12, 1);
    ctx.fillRect(7, 4, 1, 3);
    ctx.fillRect(4, 7, 1, 3);
    ctx.fillRect(10, 7, 1, 3);
    ctx.fillRect(7, 10, 1, 3);
  },
  "item.coin": (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(3, 2, 10, 12);
    ctx.fillRect(2, 3, 12, 10);
    ctx.fillStyle = "#c9a227";
    ctx.fillRect(4, 3, 8, 10);
    ctx.fillRect(3, 4, 10, 8);
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(4, 3, 6, 4);
    ctx.fillRect(3, 4, 4, 6);
    ctx.fillStyle = "#8a6d1a"; // stamped mark
    ctx.fillRect(7, 5, 2, 6);
    ctx.fillRect(6, 6, 1, 1);
    ctx.fillRect(9, 9, 1, 1);
  },
  "item.gem.emberstone": (ctx) => {
    ctx.fillStyle = "#7a2d12";
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(7 - i, 3 + i, 2 + i * 2, 1);
      ctx.fillRect(7 - i, 12 - i, 2 + i * 2, 1);
    }
    ctx.fillStyle = "#e2903a";
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(7 - i, 4 + i, 2 + i * 2, 1);
      ctx.fillRect(7 - i, 11 - i, 2 + i * 2, 1);
    }
    ctx.fillStyle = "#f6c65a";
    ctx.fillRect(6, 6, 3, 3);
    ctx.fillRect(7, 5, 1, 1);
    ctx.fillStyle = "#fff2c0";
    ctx.fillRect(6, 6, 1, 1);
  },
  "tool.axe.basic": axe("#9a9da0", "#c6c9cc"),
  "tool.axe.copper": axe("#c47a3d", "#e39a5f"),
  "tool.pickaxe.basic": pickaxe("#8a8d90", "#b9bcbf"),
  "tool.pickaxe.copper": pickaxe("#c47a3d", "#e39a5f"),
  "tool.sword.copper": sword("#c47a3d", "#e39a5f", "#8a5230"),
  "tool.sword.bronze": sword("#b08d57", "#d4b06a", "#7d6138"),
  "tool.sword.iron": sword(...IRON),
  "tool.axe.bronze": axe("#b08d57", "#d4b06a"),
  "tool.axe.iron": axe(IRON[0], IRON[1]),
  "tool.pickaxe.bronze": pickaxe("#b08d57", "#d4b06a"),
  "tool.pickaxe.iron": pickaxe(IRON[0], IRON[1]),
  "tool.fishingrod.basic": rod,
  "tool.hammer.basic": hammer,
  "item.beef.raw": meat("#c0455a", "#e07085"),
  "item.beef.cooked": meat("#9a6733", "#c08a4a"),
  "item.beef.burnt": meat("#4a4440", "#5f574f"),
  "item.pork.raw": meat("#e0808f", "#f0a8b5", true),
  "item.pork.cooked": meat("#c9955a", "#e0b478", true),
  "item.pork.burnt": meat("#544c46", "#6a6058", true),
  "item.hide.cow": (ctx) => {
    // stretched pelt
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(2, 3, 12, 10);
    ctx.fillRect(4, 2, 8, 12);
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(3, 4, 10, 8);
    ctx.fillRect(5, 3, 6, 10);
    ctx.fillStyle = "#a5793f";
    ctx.fillRect(5, 4, 6, 3);
    ctx.fillStyle = "#6e4620"; // spots
    ctx.fillRect(6, 8, 2, 2);
    ctx.fillRect(9, 6, 2, 2);
    ctx.fillRect(4, 10, 2, 1);
  },
  "armor.cap.leather": helmet(...LEATHER),
  "armor.tunic.leather": tunic(...LEATHER),
  "armor.leggings.leather": leggings(...LEATHER),
  "armor.cap.copper": helmet(...COPPER),
  "armor.tunic.copper": tunic(...COPPER),
  "armor.leggings.copper": leggings(...COPPER),
  "armor.cap.bronze": helmet(...BRONZE),
  "armor.tunic.bronze": tunic(...BRONZE),
  "armor.leggings.bronze": leggings(...BRONZE),
  "armor.cap.iron": helmet(...IRON),
  "armor.tunic.iron": tunic(...IRON),
  "armor.leggings.iron": leggings(...IRON),
};

// ---------- skill icons ----------

const SKILL_DRAWS: Record<string, Draw> = {
  "skill.woodcutting": axe("#9a9da0", "#c6c9cc"),
  "skill.mining": pickaxe("#8a8d90", "#b9bcbf"),
  "skill.foraging": ITEM_DRAWS["item.berry.basic"],
  "skill.fishing": rod,
  "skill.cooking": (ctx) => {
    // flame
    ctx.fillStyle = "#b3541e";
    ctx.fillRect(6, 3, 2, 3);
    ctx.fillRect(4, 5, 8, 3);
    ctx.fillRect(3, 8, 10, 5);
    ctx.fillStyle = "#e2903a";
    ctx.fillRect(6, 5, 3, 3);
    ctx.fillRect(4, 8, 8, 4);
    ctx.fillStyle = "#f6c65a";
    ctx.fillRect(6, 9, 4, 3);
    ctx.fillRect(7, 7, 2, 2);
  },
  "skill.smelting": (ctx) => {
    // furnace front
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(1, 2, 14, 12);
    ctx.fillStyle = "#7d8083";
    ctx.fillRect(2, 3, 12, 10);
    ctx.fillStyle = "#5a5d60";
    ctx.fillRect(2, 7, 12, 1);
    ctx.fillRect(7, 3, 1, 4);
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(4, 8, 8, 5);
    ctx.fillStyle = "#e2903a";
    ctx.fillRect(5, 10, 6, 3);
    ctx.fillStyle = "#f6c65a";
    ctx.fillRect(6, 11, 2, 2);
    ctx.fillRect(9, 11, 1, 2);
  },
  "skill.smithing": (ctx) => {
    // anvil
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(1, 3, 14, 5);
    ctx.fillRect(5, 7, 6, 3);
    ctx.fillRect(3, 10, 10, 4);
    ctx.fillStyle = "#5a5d60";
    ctx.fillRect(2, 4, 12, 3);
    ctx.fillRect(6, 7, 4, 3);
    ctx.fillRect(4, 11, 8, 2);
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(2, 4, 12, 1);
    ctx.fillRect(4, 11, 8, 1);
  },
  "skill.attack": sword("#b9bcbf", "#e6e9ec", "#c9a227"),
  "skill.defense": (ctx) => {
    // kite shield
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(3, 2, 10, 8);
    ctx.fillRect(4, 10, 8, 2);
    ctx.fillRect(5, 12, 6, 1);
    ctx.fillRect(6, 13, 4, 1);
    ctx.fillRect(7, 14, 2, 1);
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(4, 3, 8, 7);
    ctx.fillRect(5, 10, 6, 1);
    ctx.fillRect(6, 11, 4, 2);
    ctx.fillRect(7, 13, 2, 1);
    ctx.fillStyle = "#b9bcbf";
    ctx.fillRect(4, 3, 8, 3);
    ctx.fillStyle = "#c9a227"; // boss
    ctx.fillRect(7, 6, 2, 3);
  },
  "skill.farming": (ctx) => {
    // wheat sheaf
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(7, 9, 2, 6);
    ctx.fillStyle = "#d9b03f";
    ctx.fillRect(6, 2, 4, 7);
    ctx.fillRect(4, 4, 2, 4);
    ctx.fillRect(10, 4, 2, 4);
    ctx.fillStyle = "#eece62";
    ctx.fillRect(7, 2, 2, 5);
  },
  "skill.enchanting": (ctx) => {
    // open tome with a rising glint
    ctx.fillStyle = "#5d3a16";
    ctx.fillRect(2, 9, 12, 4);
    ctx.fillStyle = "#efe6d5";
    ctx.fillRect(3, 8, 5, 4);
    ctx.fillRect(8, 8, 5, 4);
    ctx.fillStyle = "#b9a6ff";
    ctx.fillRect(7, 4, 2, 2);
    ctx.fillRect(4, 2, 1, 1);
    ctx.fillRect(11, 3, 1, 1);
  },
  "skill.brewing": (ctx) => {
    // bubbling cauldron
    ctx.fillStyle = "#3a3d42";
    ctx.fillRect(3, 6, 10, 7);
    ctx.fillRect(2, 5, 12, 2);
    ctx.fillRect(4, 13, 2, 2);
    ctx.fillRect(10, 13, 2, 2);
    ctx.fillStyle = "#7fe0c3";
    ctx.fillRect(4, 6, 8, 2);
    ctx.fillStyle = "#b9f0dd";
    ctx.fillRect(5, 3, 2, 2);
    ctx.fillRect(9, 2, 2, 2);
    ctx.fillRect(7, 4, 1, 1);
  },
  "skill.archery": (ctx) => {
    // bow and nocked arrow
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(4, 2, 2, 12);
    ctx.fillRect(6, 2, 2, 2);
    ctx.fillRect(6, 12, 2, 2);
    ctx.fillStyle = "#e6e9ec";
    ctx.fillRect(8, 3, 1, 10);
    ctx.fillStyle = "#d9c48f";
    ctx.fillRect(6, 7, 8, 2);
    ctx.fillStyle = "#8f959c";
    ctx.fillRect(13, 6, 2, 4);
  },
  "skill.construction": (ctx) => {
    // hammer over a half-built wall
    ctx.fillStyle = "#84878c";
    ctx.fillRect(2, 10, 12, 5);
    ctx.fillStyle = "#63666b";
    ctx.fillRect(2, 12, 12, 1);
    ctx.fillRect(6, 10, 1, 5);
    ctx.fillRect(10, 12, 1, 3);
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(4, 2, 6, 4);
    ctx.fillStyle = "#6e4620";
    ctx.fillRect(9, 5, 2, 5);
  },
  "skill.crafting": (ctx) => {
    // saw over plank
    ctx.fillStyle = "#a5793f";
    ctx.fillRect(2, 10, 12, 4);
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(3, 4, 9, 3);
    ctx.fillStyle = "#e6e9ec";
    ctx.fillRect(3, 7, 9, 1);
    ctx.fillStyle = "#6e4620";
    ctx.fillRect(12, 3, 3, 4);
  },
  "skill.archaeology": (ctx) => {
    // brush over a half-buried pot
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(2, 11, 12, 4);
    ctx.fillStyle = "#c46f35";
    ctx.fillRect(5, 6, 6, 5);
    ctx.fillRect(4, 8, 8, 3);
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(6, 5, 4, 1);
    ctx.fillStyle = "#e6c94e";
    ctx.fillRect(11, 2, 3, 2);
    ctx.fillStyle = "#6e4620";
    ctx.fillRect(12, 4, 1, 4);
  },
  "skill.herblore": (ctx) => {
    // sprig of leaves
    ctx.fillStyle = "#3e6b2f";
    ctx.fillRect(7, 4, 2, 10);
    ctx.fillStyle = "#59a83b";
    ctx.fillRect(3, 3, 4, 4);
    ctx.fillRect(9, 6, 4, 4);
    ctx.fillRect(4, 9, 4, 3);
    ctx.fillStyle = "#7cc95c";
    ctx.fillRect(4, 4, 2, 2);
    ctx.fillRect(10, 7, 2, 2);
  },
  "skill.hunting": (ctx) => {
    // snare loop on a stake
    ctx.fillStyle = "#6e4620";
    ctx.fillRect(7, 9, 2, 6);
    ctx.fillStyle = "#c9a86a";
    ctx.fillRect(4, 2, 8, 2);
    ctx.fillRect(3, 4, 2, 4);
    ctx.fillRect(11, 4, 2, 4);
    ctx.fillRect(4, 8, 8, 2);
    ctx.fillStyle = "#8a6a3a";
    ctx.fillRect(7, 1, 2, 2);
  },
  "skill.thieving": (ctx) => {
    // a cinched coin purse
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(4, 6, 8, 8);
    ctx.fillRect(3, 8, 10, 4);
    ctx.fillStyle = "#5c3d22";
    ctx.fillRect(6, 4, 4, 2);
    ctx.fillStyle = "#e6c94e";
    ctx.fillRect(7, 9, 2, 2);
  },
  "skill.agility": (ctx) => {
    // a springing boot with motion dashes
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(6, 4, 3, 7);
    ctx.fillRect(6, 10, 6, 3);
    ctx.fillStyle = "#5c3d22";
    ctx.fillRect(6, 13, 7, 1);
    ctx.fillStyle = "#cfd8e3";
    ctx.fillRect(1, 5, 3, 1);
    ctx.fillRect(2, 8, 3, 1);
    ctx.fillRect(1, 11, 3, 1);
  },
  "skill.slaying": (ctx) => {
    // a marked skull
    ctx.fillStyle = "#dcdcd4";
    ctx.fillRect(4, 3, 8, 7);
    ctx.fillRect(5, 10, 6, 3);
    ctx.fillStyle = "#22252a";
    ctx.fillRect(5, 6, 2, 2);
    ctx.fillRect(9, 6, 2, 2);
    ctx.fillRect(7, 11, 2, 2);
    ctx.fillStyle = "#a4243b";
    ctx.fillRect(11, 2, 3, 1);
    ctx.fillRect(12, 1, 1, 3);
  },
  "skill.firemaking": (ctx) => {
    // a bright bonfire flame
    ctx.fillStyle = "#8a2f12";
    ctx.fillRect(6, 2, 2, 3);
    ctx.fillRect(4, 4, 8, 4);
    ctx.fillRect(3, 7, 10, 6);
    ctx.fillStyle = "#e2903a";
    ctx.fillRect(6, 4, 4, 4);
    ctx.fillRect(4, 7, 8, 5);
    ctx.fillStyle = "#f6c65a";
    ctx.fillRect(6, 8, 4, 4);
    ctx.fillStyle = "#fff0b0";
    ctx.fillRect(7, 10, 2, 2);
  },
  "skill.boating": (ctx) => {
    // a mariner's anchor
    ctx.fillStyle = "#cfd3d6";
    ctx.fillRect(7, 2, 2, 10);
    ctx.fillRect(5, 4, 6, 2); // stock
    ctx.fillRect(3, 10, 2, 2); // left fluke
    ctx.fillRect(11, 10, 2, 2); // right fluke
    ctx.fillRect(3, 11, 10, 2); // arc
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(6, 2, 4, 2); // ring
    ctx.fillStyle = "#22252a";
    ctx.fillRect(7, 3, 2, 1);
  },
  "skill.strength": (ctx) => {
    // a barbell
    ctx.fillStyle = "#4a4d52";
    ctx.fillRect(6, 7, 4, 2); // bar
    ctx.fillStyle = "#2f3236";
    ctx.fillRect(2, 4, 2, 8); // left weights
    ctx.fillRect(4, 5, 2, 6);
    ctx.fillRect(12, 4, 2, 8); // right weights
    ctx.fillRect(10, 5, 2, 6);
    ctx.fillStyle = "#6a6d72";
    ctx.fillRect(2, 4, 2, 2);
    ctx.fillRect(12, 4, 2, 2);
  },
  "skill.prayer": (ctx) => {
    // a haloed candle flame
    ctx.fillStyle = "#e9d27a";
    ctx.fillRect(6, 6, 4, 1); // halo ring
    ctx.fillRect(5, 7, 1, 3);
    ctx.fillRect(10, 7, 1, 3);
    ctx.fillRect(6, 10, 4, 1);
    ctx.fillStyle = "#cfd3d6";
    ctx.fillRect(7, 8, 2, 6); // candle
    ctx.fillStyle = "#f6c65a";
    ctx.fillRect(7, 3, 2, 4); // flame
    ctx.fillStyle = "#fff0b0";
    ctx.fillRect(7, 4, 1, 2);
  },
  "skill.fletching": (ctx) => {
    // a fletched arrow on the diagonal
    ctx.fillStyle = "#a5793f";
    for (let i = 0; i < 10; i++) ctx.fillRect(3 + i, 11 - i, 2, 2); // shaft
    ctx.fillStyle = "#cfd3d6";
    ctx.fillRect(11, 2, 3, 3); // head
    ctx.fillStyle = "#c33b2f";
    ctx.fillRect(3, 10, 3, 2); // fletching
    ctx.fillRect(2, 11, 2, 2);
  },
  "skill.runecrafting": (ctx) => {
    // a glowing rune tablet
    ctx.fillStyle = "#3a3550";
    ctx.fillRect(3, 2, 10, 12);
    ctx.fillStyle = "#5a5378";
    ctx.fillRect(4, 3, 8, 10);
    ctx.fillStyle = "#8fd8ff";
    ctx.fillRect(7, 4, 2, 3);
    ctx.fillRect(6, 7, 4, 2);
    ctx.fillRect(7, 9, 2, 3);
  },
  "skill.magic": (ctx) => {
    // a four-point sparkle star
    ctx.fillStyle = "#b9a6ff";
    ctx.fillRect(7, 1, 2, 14);
    ctx.fillRect(1, 7, 14, 2);
    ctx.fillStyle = "#e6dcff";
    ctx.fillRect(6, 6, 4, 4);
    ctx.fillStyle = "#fff6cc";
    ctx.fillRect(7, 7, 2, 2);
    ctx.fillStyle = "#8fd8ff";
    ctx.fillRect(12, 2, 2, 2); // a smaller glint
  },
  "skill.constitution": (ctx) => {
    // a heart
    ctx.fillStyle = "#c0324a";
    ctx.fillRect(3, 4, 4, 3);
    ctx.fillRect(9, 4, 4, 3);
    ctx.fillRect(2, 6, 12, 3);
    ctx.fillRect(4, 9, 8, 2);
    ctx.fillRect(6, 11, 4, 2);
    ctx.fillRect(7, 13, 2, 1);
    ctx.fillStyle = "#e4657a";
    ctx.fillRect(4, 5, 2, 2);
    ctx.fillRect(10, 5, 2, 2);
  },
  "skill.dungeoneering": (ctx) => {
    // an old key
    ctx.fillStyle = "#d9b03f";
    ctx.fillRect(3, 3, 5, 5); // bow
    ctx.fillStyle = "#2a2f3a";
    ctx.fillRect(5, 5, 1, 1); // hole
    ctx.fillStyle = "#d9b03f";
    ctx.fillRect(7, 7, 2, 7); // shaft (diagonal-ish)
    ctx.fillRect(9, 11, 3, 2); // teeth
    ctx.fillRect(9, 8, 2, 2);
  },
  "skill.summoning": (ctx) => {
    // a paw print
    ctx.fillStyle = "#c9b48a";
    ctx.fillRect(6, 8, 4, 4); // pad
    ctx.fillRect(5, 10, 6, 2);
    ctx.fillRect(3, 4, 2, 3); // toes
    ctx.fillRect(6, 3, 2, 3);
    ctx.fillRect(9, 3, 2, 3);
    ctx.fillRect(12, 4, 2, 3);
  },
  "skill.necromancy": (ctx) => {
    // a skull with a green glow
    ctx.fillStyle = "#5be58c";
    ctx.fillRect(4, 2, 8, 1);
    ctx.fillStyle = "#dcdcd4";
    ctx.fillRect(4, 3, 8, 7);
    ctx.fillRect(5, 10, 6, 3);
    ctx.fillStyle = "#1f6b3a";
    ctx.fillRect(5, 5, 2, 2);
    ctx.fillRect(9, 5, 2, 2);
    ctx.fillRect(7, 8, 2, 2);
    ctx.fillStyle = "#dcdcd4";
    ctx.fillRect(6, 11, 1, 2);
    ctx.fillRect(9, 11, 1, 2);
  },
  "skill.invention": (ctx) => {
    // a cog
    ctx.fillStyle = "#8a8d90";
    ctx.fillRect(6, 1, 4, 14);
    ctx.fillRect(1, 6, 14, 4);
    ctx.fillRect(3, 3, 10, 10);
    ctx.fillStyle = "#5a5d60";
    ctx.fillRect(4, 4, 8, 8);
    ctx.fillStyle = "#c6c9cc";
    ctx.fillRect(6, 6, 4, 4); // hub
    ctx.fillStyle = "#2a2c2f";
    ctx.fillRect(7, 7, 2, 2);
  },
};

// ---------- UI button / widget icons ----------

const UI_DRAWS: Record<string, Draw> = {
  gear: (ctx) => {
    ctx.fillStyle = "#9aa3ad";
    for (const [x, y] of [[7, 1], [7, 13], [1, 7], [13, 7], [3, 3], [11, 3], [3, 11], [11, 11]]) ctx.fillRect(x, y, 2, 2);
    ctx.fillRect(4, 4, 8, 8);
    ctx.fillStyle = "#10151b";
    ctx.fillRect(6, 6, 4, 4);
  },
  compass: (ctx) => {
    ctx.fillStyle = "#d8cfc0";
    ctx.fillRect(4, 2, 8, 12); ctx.fillRect(2, 4, 12, 8);
    ctx.fillStyle = "#c0443a"; // north needle
    ctx.fillRect(7, 3, 2, 5);
    ctx.fillStyle = "#5b6672"; // south needle
    ctx.fillRect(7, 8, 2, 5);
  },
  banner: (ctx) => {
    ctx.fillStyle = "#8a6844";
    ctx.fillRect(4, 1, 2, 14);
    ctx.fillStyle = "#c0443a";
    ctx.fillRect(6, 2, 8, 6);
    ctx.fillStyle = "#8f2f28";
    ctx.fillRect(6, 6, 8, 2);
  },
  walker: (ctx) => {
    ctx.fillStyle = "#aab4c0";
    ctx.fillRect(7, 2, 3, 3);   // head
    ctx.fillRect(6, 5, 4, 5);   // upright torso
    ctx.fillRect(5, 6, 1, 3);   // arms at sides
    ctx.fillRect(10, 6, 1, 3);
    ctx.fillRect(6, 10, 1, 4);  // easy stride
    ctx.fillRect(9, 10, 1, 4);
  },
  pin: (ctx) => {
    ctx.fillStyle = "#c0443a";
    ctx.fillRect(5, 2, 6, 6);
    ctx.fillRect(6, 8, 4, 2);
    ctx.fillRect(7, 10, 2, 3);  // point
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(7, 4, 2, 2);   // pinhole
  },
  spark: (ctx) => {
    ctx.fillStyle = "#c9a9ff";
    ctx.fillRect(7, 1, 2, 14);
    ctx.fillRect(1, 7, 14, 2);
    ctx.fillStyle = "#efe4ff";
    ctx.fillRect(6, 6, 4, 4);
  },
  runner: (ctx) => {
    ctx.fillStyle = "#e8eaec";
    ctx.fillRect(8, 2, 3, 3);   // head
    ctx.fillRect(6, 5, 5, 4);   // torso leaning
    ctx.fillRect(4, 6, 2, 2);   // trailing arm
    ctx.fillRect(11, 5, 2, 2);  // leading arm
    ctx.fillRect(4, 11, 3, 2);  // trailing leg
    ctx.fillRect(10, 9, 2, 4);  // leading leg
    ctx.fillStyle = "#ffd54a";  // dash lines
    ctx.fillRect(1, 4, 2, 1); ctx.fillRect(1, 8, 2, 1);
  },
  bug: (ctx) => {
    ctx.fillStyle = "#7cd65a";
    ctx.fillRect(5, 4, 6, 9);
    ctx.fillRect(6, 2, 4, 3);
    ctx.fillStyle = "#3f7a2e";
    ctx.fillRect(7, 4, 2, 9);   // wing split
    ctx.fillStyle = "#10151b";
    for (const y of [5, 8, 11]) { ctx.fillRect(3, y, 2, 1); ctx.fillRect(11, y, 2, 1); } // legs
  },
  swords: (ctx) => {
    ctx.fillStyle = "#c6c9cc";
    for (let i = 0; i < 8; i++) { ctx.fillRect(2 + i, 2 + i, 2, 2); ctx.fillRect(12 - i, 2 + i, 2, 2); } // crossed blades
    ctx.fillStyle = "#8a6844";
    ctx.fillRect(2, 12, 3, 2); ctx.fillRect(11, 12, 3, 2); // hilts
  },
  bolt: (ctx) => {
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(8, 1, 4, 6);
    ctx.fillRect(5, 6, 6, 4);
    ctx.fillRect(4, 9, 4, 6);
  },
  sun: (ctx) => {
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(5, 5, 6, 6);
    for (const [x, y, w, h] of [[7, 1, 2, 2], [7, 13, 2, 2], [1, 7, 2, 2], [13, 7, 2, 2]]) ctx.fillRect(x, y, w, h);
  },
  moon: (ctx) => {
    ctx.fillStyle = "#cfd6e4";
    ctx.fillRect(5, 2, 6, 12); ctx.fillRect(3, 4, 4, 8);
    ctx.fillStyle = "#10151b";
    ctx.fillRect(8, 4, 5, 8);   // crescent bite
  },
  cloud: (ctx) => {
    ctx.fillStyle = "#aab4c0";
    ctx.fillRect(3, 7, 11, 5);
    ctx.fillRect(5, 4, 5, 4);
    ctx.fillRect(9, 5, 4, 3);
  },
  rain: (ctx) => {
    ctx.fillStyle = "#aab4c0";
    ctx.fillRect(3, 3, 11, 5);
    ctx.fillStyle = "#6fa8e8";
    for (const x of [4, 8, 12]) ctx.fillRect(x, 10, 1, 4);
  },
  storm: (ctx) => {
    ctx.fillStyle = "#7d8896";
    ctx.fillRect(3, 2, 11, 5);
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(8, 7, 3, 4); ctx.fillRect(6, 10, 3, 4);
  },
  rotl: (ctx) => rotateArrow(ctx, true),
  rotr: (ctx) => rotateArrow(ctx, false),
  center: (ctx) => {
    ctx.fillStyle = "#e8eaec";
    ctx.fillRect(7, 1, 2, 4);
    ctx.fillRect(7, 11, 2, 4);
    ctx.fillRect(1, 7, 4, 2);
    ctx.fillRect(11, 7, 4, 2);
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(6, 6, 4, 4);
    ctx.fillStyle = "#10151b";
    ctx.fillRect(7, 7, 2, 2);
  },
  skin: (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(4, 1, 8, 8);
    ctx.fillRect(2, 9, 12, 6);
    ctx.fillStyle = "#d8a374"; // head
    ctx.fillRect(5, 2, 6, 6);
    ctx.fillStyle = "#7a5230"; // hair
    ctx.fillRect(5, 2, 6, 2);
    ctx.fillRect(5, 4, 1, 2);
    ctx.fillStyle = "#10151b";
    ctx.fillRect(7, 5, 1, 1);
    ctx.fillRect(9, 5, 1, 1);
    ctx.fillStyle = "#3f7d8c"; // shirt
    ctx.fillRect(3, 10, 10, 5);
    ctx.fillStyle = "#356a77";
    ctx.fillRect(3, 10, 2, 5);
    ctx.fillRect(11, 10, 2, 5);
  },
  pack: (ctx) => {
    // painter's palette
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(2, 3, 12, 10);
    ctx.fillRect(4, 2, 8, 12);
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(3, 4, 10, 8);
    ctx.fillRect(5, 3, 6, 10);
    ctx.fillStyle = "#a5793f";
    ctx.fillRect(5, 3, 6, 2);
    ctx.fillStyle = "#10151b"; // thumb hole
    ctx.fillRect(9, 8, 3, 3);
    ctx.fillStyle = "#e04040";
    ctx.fillRect(5, 5, 2, 2);
    ctx.fillStyle = "#5b6ee1";
    ctx.fillRect(8, 4, 2, 2);
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(4, 8, 2, 2);
    ctx.fillStyle = "#69f0ae";
    ctx.fillRect(6, 10, 2, 2);
  },
  inv: (ctx) => {
    // backpack
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(2, 3, 12, 12);
    ctx.fillRect(5, 1, 6, 3);
    ctx.fillStyle = "#8a5a2b";
    ctx.fillRect(3, 4, 10, 10);
    ctx.fillStyle = "#6e4620";
    ctx.fillRect(6, 2, 4, 2); // handle
    ctx.fillRect(3, 4, 2, 10); // strap
    ctx.fillRect(11, 4, 2, 10);
    ctx.fillStyle = "#a5793f"; // flap
    ctx.fillRect(4, 4, 8, 4);
    ctx.fillStyle = "#c9a227"; // buckle
    ctx.fillRect(7, 7, 2, 3);
  },
  heart: (ctx) => {
    ctx.fillStyle = "#7a1420";
    ctx.fillRect(2, 3, 5, 3);
    ctx.fillRect(9, 3, 5, 3);
    ctx.fillRect(1, 5, 14, 4);
    ctx.fillRect(3, 9, 10, 2);
    ctx.fillRect(5, 11, 6, 2);
    ctx.fillRect(7, 13, 2, 1);
    ctx.fillStyle = "#e04040";
    ctx.fillRect(3, 4, 3, 2);
    ctx.fillRect(10, 4, 3, 2);
    ctx.fillRect(2, 6, 12, 3);
    ctx.fillRect(4, 9, 8, 1);
    ctx.fillRect(5, 10, 6, 1);
    ctx.fillRect(6, 11, 4, 1);
    ctx.fillRect(7, 12, 2, 1);
    ctx.fillStyle = "#ff8a8a";
    ctx.fillRect(4, 5, 2, 2);
  },
  quest: (ctx) => {
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(5, 1, 6, 12);
    ctx.fillRect(5, 13, 6, 3);
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(6, 2, 4, 8);
    ctx.fillRect(6, 12, 4, 3);
  },
  skills: (ctx) => {
    // three ascending stat bars — the "levels/stats" glyph
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(2, 10, 4, 5);
    ctx.fillRect(6, 6, 4, 9);
    ctx.fillRect(10, 2, 4, 13);
    ctx.fillStyle = "#7cc243";
    ctx.fillRect(3, 11, 2, 3);
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(7, 7, 2, 7);
    ctx.fillStyle = "#5ac2e0";
    ctx.fillRect(11, 3, 2, 11);
  },
};

function rotateArrow(ctx: CanvasRenderingContext2D, left: boolean): void {
  ctx.save();
  if (left) {
    ctx.translate(T, 0);
    ctx.scale(-1, 1);
  }
  ctx.fillStyle = "#e8eaec";
  // three-quarter ring
  ctx.fillRect(4, 3, 8, 2);
  ctx.fillRect(3, 4, 2, 8);
  ctx.fillRect(4, 11, 8, 2);
  ctx.fillRect(11, 8, 2, 4);
  // arrow head pointing up-right
  ctx.fillStyle = "#ffd54a";
  ctx.fillRect(10, 1, 2, 6);
  ctx.fillRect(12, 3, 2, 2);
  ctx.fillRect(8, 3, 2, 2);
  ctx.restore();
}

// ---------- public API ----------

/** Item id -> baked/pack icon material (vanilla-item inventory art). */
const ITEM_ICON_MATERIALS: Record<string, string> = {
  "item.bar.iron": "icon.bar.iron", "item.bar.gold": "icon.bar.gold",
  "item.bar.copper": "icon.bar.copper", "item.bar.tin": "icon.bar.tin",
  "item.bar.bronze": "icon.bar.bronze",
  "item.ore.iron": "icon.ore.iron", "item.ore.gold": "icon.ore.gold",
  "item.ore.copper": "icon.ore.copper", "item.ore.tin": "icon.ore.tin",
  "item.ore.coal": "icon.ore.coal", "item.gem.diamond": "icon.gem.diamond",
  "item.fish.raw": "icon.fish.raw", "item.fish.cooked": "icon.fish.cooked",
  "item.fish.trout": "icon.fish.fancy", "item.trout.cooked": "icon.fish.fancy.cooked",
  "item.fish.seabass": "icon.fish.fancy", "item.seabass.cooked": "icon.fish.fancy.cooked",
  "item.fish.eel": "icon.fish.raw", "item.eel.cooked": "icon.fish.cooked",
  "item.fish.icefin": "icon.fish.fancy", "item.icefin.cooked": "icon.fish.fancy.cooked",
  "item.fish.sunscale": "icon.fish.fancy", "item.sunscale.cooked": "icon.fish.fancy.cooked",
  "item.berry.basic": "icon.berries", "item.bread.basic": "icon.bread",
  "item.wheat": "icon.wheat", "item.carrot": "icon.carrot",
  "item.crop.potato": "icon.potato", "item.potato.baked": "icon.potato.baked",
  "item.melon.slice": "icon.melon",
  "item.beef.raw": "icon.beef.raw", "item.beef.cooked": "icon.beef.cooked",
  "item.pork.raw": "icon.pork.raw", "item.pork.cooked": "icon.pork.cooked",
  "item.chicken.raw": "icon.chicken.raw", "item.chicken.cooked": "icon.chicken.cooked",
  "item.mutton.raw": "icon.mutton.raw", "item.mutton.cooked": "icon.mutton.cooked",
  "item.game.rabbit": "icon.rabbit.raw", "item.rabbit.cooked": "icon.rabbit.cooked",
  "item.bone.old": "icon.bone", "item.glob.slime": "icon.slime",
  "item.venom.sac": "icon.venom", "item.hide.cow": "icon.leather",
  "item.hide.wolf": "icon.hide.wolf", "item.fur": "icon.hide.wolf",
  "item.feather": "icon.feather", "item.coin": "icon.coin",
  "item.wool": "icon.wool", "item.rope": "icon.rope",
  "item.stone.rough": "icon.stone", "item.brick.stone": "icon.brick",
  "item.plank.cut": "icon.plank",
  "item.log.basic": "icon.log", "item.log.birch": "icon.log",
  "item.log.spruce": "icon.log", "item.log.jungle": "icon.log",
  "item.log.acacia": "icon.log", "item.log.darkoak": "icon.log",
  "item.log.blossom": "icon.log", "item.log.ember": "icon.log",
  "item.log.glow": "icon.log", "item.log.dusk": "icon.log",
  "item.seed.wheat": "icon.seeds", "item.seed.carrot": "icon.seeds",
  "item.seed.melon": "icon.seeds", "item.seed.potato": "icon.seeds",
  "item.seed.pumpkin": "icon.seeds",
  "armor.cap.leather": "icon.helmet.leather", "armor.tunic.leather": "icon.chest.leather",
  "armor.leggings.leather": "icon.legs.leather", "armor.boots.leather": "icon.boots.leather",
  "armor.cap.iron": "icon.helmet.iron", "armor.tunic.iron": "icon.chest.iron",
  "armor.leggings.iron": "icon.legs.iron", "armor.boots.iron": "icon.boots.iron",
  "armor.boots.copper": "icon.boots.iron", "armor.boots.bronze": "icon.boots.iron",
  // Original 64x64 inventory art from src/render/art (baked into original-art.ts).
  "armor.cap.steel": "icon.original.steel-helmet",
  "armor.tunic.steel": "icon.original.steel-chestplate",
  "armor.leggings.steel": "icon.original.steel-leggings",
  "armor.boots.steel": "icon.original.steel-boots",
  "armor.cap.mithril": "icon.original.mithril-helmet",
  "armor.tunic.mithril": "icon.original.mithril-chestplate",
  "armor.leggings.mithril": "icon.original.mithril-leggings",
  "armor.boots.mithril": "icon.original.mithril-boots",
  "armor.cap.adamant": "icon.original.adamant-helmet",
  "armor.tunic.adamant": "icon.original.adamant-chestplate",
  "armor.leggings.adamant": "icon.original.adamant-leggings",
  "armor.boots.adamant": "icon.original.adamant-boots",
  "armor.cap.rune": "icon.original.rune-helmet",
  "armor.tunic.rune": "icon.original.rune-chestplate",
  "armor.leggings.rune": "icon.original.rune-leggings",
  "armor.boots.rune": "icon.original.rune-boots",
  "armor.cap.diamond": "icon.original.diamond-helmet",
  "armor.tunic.diamond": "icon.original.diamond-chestplate",
  "armor.leggings.diamond": "icon.original.diamond-leggings",
  "armor.boots.diamond": "icon.original.diamond-boots",
  "armor.cap.netherite": "icon.original.netherite-helmet",
  "armor.tunic.netherite": "icon.original.netherite-chestplate",
  "armor.leggings.netherite": "icon.original.netherite-leggings",
  "armor.boots.netherite": "icon.original.netherite-boots",
  "armor.boots.runed": "icon.original.runed-boots",
  "item.ore.redstone": "icon.original.redstone-dust",
  "item.gem.lapis": "icon.original.lapis-lazuli",
  "item.gem.emerald": "icon.original.emerald",
  "item.gem.quartz": "icon.original.nether-quartz",
  "item.debris.ancient": "icon.original.ancient-debris",
  "item.scrap.netherite": "icon.original.netherite-scrap",
  "item.ingot.netherite": "icon.original.netherite-ingot",
  "item.gem.opal": "icon.original.opal", "item.gem.jade": "icon.original.jade",
  "item.gem.topaz": "icon.original.topaz", "item.gem.sapphire": "icon.original.sapphire",
  "item.gem.ruby": "icon.original.ruby", "item.gem.dragonstone": "icon.original.dragonstone",
  "item.rune.air": "icon.original.air-rune", "item.rune.water": "icon.original.water-rune",
  "item.rune.earth": "icon.original.earth-rune", "item.rune.fire": "icon.original.fire-rune",
  "item.rune.nature": "icon.original.nature-rune", "item.rune.law": "icon.original.law-rune",
  "item.rune.death": "icon.original.death-rune", "item.rune.blood": "icon.original.blood-rune",
  "item.rune.soul": "icon.original.soul-rune", "item.essence.rune": "icon.original.rune-essence",
  "tool.sword.diamond": "icon.original.diamond-sword",
  "tool.axe.diamond": "icon.original.diamond-axe",
  "tool.pickaxe.diamond": "icon.original.diamond-pickaxe",
  "tool.sword.netherite": "icon.original.netherite-sword",
  "tool.axe.netherite": "icon.original.netherite-axe",
  "tool.pickaxe.netherite": "icon.original.netherite-pickaxe",
  "tool.sword.runed": "icon.original.runed-sword", "tool.axe.runed": "icon.original.runed-axe",
  "tool.pickaxe.runed": "icon.original.runed-pickaxe", "tool.bow.runed": "icon.original.runed-longbow",
  "tool.bow.wood": "icon.original.shortbow", "tool.bow.yew": "icon.original.yew-longbow",
  "tool.bow.oak": "icon.original.oak-bow", "tool.bow.spruce": "icon.original.spruce-bow",
  "tool.bow.jungle": "icon.original.jungle-bow", "tool.bow.dark": "icon.original.duskbark-bow",
  "tool.trap.basic": "icon.original.rope-snare", "tool.trap.fine": "icon.original.fine-box-trap",
  "tool.boat.raft": "icon.original.log-raft", "tool.boat.rowboat": "icon.original.rowboat",
  "tool.boat.skiff": "icon.original.swift-skiff",
  "item.arrow.bronze": "icon.original.bronze-arrows", "item.arrow.iron": "icon.original.iron-arrows",
  "item.component.parts": "icon.original.salvaged-parts",
  "item.gizmo.swift": "icon.original.swift-gizmo", "item.gizmo.precise": "icon.original.precise-gizmo",
  "item.pouch.wolf": "icon.original.spirit-wolf-pouch", "item.pouch.ox": "icon.original.pack-ox-pouch",
  "item.pouch.tortoise": "icon.original.war-tortoise-pouch",
  "item.ring.gold": "icon.original.gold-ring", "item.amulet.gold": "icon.original.gold-amulet",
  "item.ring.opal": "icon.original.opal-ring", "item.ring.sapphire": "icon.original.sapphire-ring",
  "item.amulet.emerald": "icon.original.emerald-amulet",
  "item.amulet.ruby": "icon.original.ruby-amulet",
  "item.amulet.dragonstone": "icon.original.dragonstone-amulet",
  "item.herb.sage": "icon.original.wild-sage", "item.herb.mint": "icon.original.river-mint",
  "item.herb.emberleaf": "icon.original.emberleaf", "item.herb.frostbloom": "icon.original.frostbloom",
  "item.herb.duskcap": "icon.original.duskcap",
  "item.salve.healing": "icon.original.healing-salve", "item.tonic.oakblood": "icon.original.oakblood-tonic",
  "item.potion.swift": "icon.original.swiftness-potion",
  "item.potion.strength": "icon.original.strength-potion",
  "item.potion.stoneskin": "icon.original.stoneskin-potion",
  "item.potion.gathering": "icon.original.foragers-brew",
  "item.potion.focus": "icon.original.hunters-focus-potion",
  "item.potion.gathering_keen": "icon.original.potion-gathering-keen",
  "item.tonic.warden": "icon.original.tonic-warden",
  "item.potion.swift_greater": "icon.original.potion-swift-greater",
  "item.potion.gathering_greater": "icon.original.potion-gathering-greater",
  "item.potion.strength_greater": "icon.original.potion-strength-greater",
  "item.potion.stoneskin_greater": "icon.original.potion-stoneskin-greater",
  "item.potion.focus_greater": "icon.original.potion-focus-greater",
  "item.tonic.warden_greater": "icon.original.tonic-warden-greater",
  "item.potion.swift_super": "icon.original.potion-swift-super",
  "item.potion.gathering_super": "icon.original.potion-gathering-super",
  "item.potion.strength_super": "icon.original.potion-strength-super",
  "item.potion.stoneskin_super": "icon.original.potion-stoneskin-super",
  "item.potion.focus_super": "icon.original.potion-focus-super",
  "item.tonic.warden_super": "icon.original.tonic-warden-super",
  "item.potion.swift_grand": "icon.original.potion-swift-grand",
  "item.potion.gathering_grand": "icon.original.potion-gathering-grand",
  "item.potion.strength_grand": "icon.original.potion-strength-grand",
  "item.potion.stoneskin_grand": "icon.original.potion-stoneskin-grand",
  "item.potion.focus_grand": "icon.original.potion-focus-grand",
  "item.tonic.warden_grand": "icon.original.tonic-warden-grand",
  "item.salve.dusk": "icon.original.salve-dusk",
  "item.salve.ember": "icon.original.salve-ember",
  "item.salve.frost": "icon.original.salve-frost",
  "item.salve.kings": "icon.original.salve-kings",
  "item.pumpkin": "icon.original.pumpkin", "item.pumpkin.roast": "icon.original.roast-pumpkin",
  "item.stew.carrot": "icon.original.carrot-stew", "item.chicken.burnt": "icon.original.burnt-chicken",
  "item.mutton.burnt": "icon.original.burnt-mutton",
  "item.bone.big": "icon.original.big-bones", "item.bone.dragon": "icon.original.dragon-bones",
  "item.spore.pale": "icon.original.pale-spores", "item.core.construct": "icon.original.construct-core",
  "item.charm.bone": "icon.original.bone-charm",
  "item.anchor.root": "icon.original.anchor-coil-root", "item.anchor.pump": "icon.original.anchor-coil-pump",
  "item.anchor.lift": "icon.original.anchor-coil-lift",
  "item.relic.shard": "icon.original.pottery-shard", "item.relic.idol": "icon.original.sunburst-idol",
  "item.trinket.jade": "icon.original.jade-trinket", "item.relic.urn": "icon.original.clay-urn",
  "item.relic.coin": "icon.original.ancient-coin", "item.relic.tablet": "icon.original.carved-tablet",
  "item.relic.mask": "icon.original.gilded-mask",
  "item.bone.ancient": "icon.original.bone-ancient",
  "item.bone.warden": "icon.original.bone-warden",
  "item.hide.antelope": "icon.original.hide-antelope",
  "item.hide.kebbit": "icon.original.hide-kebbit",
  "item.forage.redberry": "icon.original.forage-redberry",
  "item.forage.cadava": "icon.original.forage-cadava",
  "item.forage.dwellberry": "icon.original.forage-dwellberry",
  "item.forage.cloudberry": "icon.original.forage-cloudberry",
  "item.forage.jangerberry": "icon.original.forage-jangerberry",
  "item.forage.pricklypear": "icon.original.forage-pricklypear",
  "item.forage.whiteberry": "icon.original.forage-whiteberry",
  "item.forage.poisonivy": "icon.original.forage-poisonivy",
  "item.forage.everlight": "icon.original.forage-everlight",
  "item.arch.samples": "icon.original.arch-samples",
  "item.plank.oak": "icon.original.plank-oak",
  "item.plank.teak": "icon.original.plank-teak",
  "item.plank.mahogany": "icon.original.plank-mahogany",
  "item.bar.steel": "icon.original.bar-steel",
  "item.bar.mithril": "icon.original.bar-mithril",
  "item.bar.adamant": "icon.original.bar-adamant",
  "item.bar.runite": "icon.original.bar-runite",
  "item.ore.mithril": "icon.original.ore-mithril",
  "item.ore.adamant": "icon.original.ore-adamant",
  "item.ore.runite": "icon.original.ore-runite",
  "item.seed.corn": "icon.original.seed-corn",
  "item.crop.corn": "icon.original.crop-corn",
  "item.seed.sunfruit": "icon.original.seed-sunfruit",
  "item.crop.sunfruit": "icon.original.crop-sunfruit",
  "item.flatpack.stool": "icon.original.flatpack-stool",
  "item.flatpack.crate": "icon.original.flatpack-crate",
  "item.flatpack.chair": "icon.original.flatpack-chair",
  "item.flatpack.table": "icon.original.flatpack-table",
  "item.flatpack.bench": "icon.original.flatpack-bench",
  "item.flatpack.bookshelf": "icon.original.flatpack-bookshelf",
  "item.flatpack.bed": "icon.original.flatpack-bed",
  "item.flatpack.dresser": "icon.original.flatpack-dresser",
  "item.flatpack.wardrobe": "icon.original.flatpack-wardrobe",
  "item.flatpack.hearth": "icon.original.flatpack-hearth",
  "item.flatpack.fireplace": "icon.original.flatpack-fireplace",
  "item.flatpack.cabinet": "icon.original.flatpack-cabinet",
  "item.flatpack.shelf": "icon.original.flatpack-shelf",
  "item.flatpack.fourposter": "icon.original.flatpack-fourposter",
  "item.flatpack.throne": "icon.original.flatpack-throne",
  "item.flatpack.altar": "icon.original.flatpack-altar",
  "item.treasure_map": "icon.original.treasure-map",
  "item.rune.body": "icon.original.body-rune",
  "item.rune.chaos": "icon.original.chaos-rune",
  "item.rune.cosmic": "icon.original.cosmic-rune",
  "item.rune.astral": "icon.original.astral-rune",
  "item.relic.astrolabe": "icon.original.relic-astrolabe",
  "item.relic.censer": "icon.original.relic-censer",
  "item.relic.chalice": "icon.original.relic-chalice",
  "item.relic.crown": "icon.original.relic-crown",
  "item.relic.sceptre": "icon.original.relic-sceptre",
  "item.relic.torque": "icon.original.relic-torque",
  "item.arrow.adamant": "icon.original.arrow-adamant",
  "item.arrow.mithril": "icon.original.arrow-mithril",
  "item.arrow.rune": "icon.original.arrow-rune",
  "item.arrow.shaft": "icon.original.arrow-shaft",
  "item.arrow.steel": "icon.original.arrow-steel",
  "tool.boat.cutter": "icon.original.boat-cutter",
  "tool.boat.longship": "icon.original.boat-longship",
  "tool.fishingrod.barbed": "icon.original.fishingrod-barbed",
  "tool.fishingrod.enchanted": "icon.original.fishingrod-enchanted",
  "tool.fishingrod.fly": "icon.original.fishingrod-fly",
  "tool.fishingrod.pearl": "icon.original.fishingrod-pearl",
  "tool.hoe.basic": "icon.original.hoe-basic",
  "tool.mattock.basic": "icon.original.mattock-basic",
  "tool.mattock.crystal": "icon.original.mattock-crystal",
  "tool.mattock.dragon": "icon.original.mattock-dragon",
  "tool.mattock.iron": "icon.original.mattock-iron",
  "tool.secateurs.basic": "icon.original.secateurs-basic",
  "tool.secateurs.magic": "icon.original.secateurs-magic",
  "tool.sword.astral": "icon.original.sword-astral",
  "tool.trap.box": "icon.original.trap-box",
  "tool.trap.magic": "icon.original.trap-magic",
  "item.antler": "icon.original.antler",
  "item.chinchompa": "icon.original.chinchompa",
  "item.spike.grenwall": "icon.original.spike-grenwall",
  "item.tusk": "icon.original.tusk",
  "item.gizmo.bulwark": "icon.original.gizmo-bulwark",
  "item.gizmo.titan": "icon.original.gizmo-titan",
  "item.hide.polar": "icon.original.hide-polar",
  "item.hide.sabre": "icon.original.hide-sabre",
  "item.hide.thick": "icon.original.hide-thick",
  "item.game.antelope": "icon.original.game-antelope",
  "item.game.boar": "icon.original.game-boar",
  "item.game.fowl": "icon.original.game-fowl",
  "item.game.grenwall": "icon.original.game-grenwall",
  "item.antelope.cooked": "icon.original.antelope-cooked",
  "item.boar.cooked": "icon.original.boar-cooked",
  "item.fowl.cooked": "icon.original.fowl-cooked",
  "item.grenwall.cooked": "icon.original.grenwall-cooked",
  "item.fish.crab": "icon.original.fish-crab",
  "item.fish.gloom": "icon.original.fish-gloom",
  "item.fish.lobster": "icon.original.fish-lobster",
  "item.fish.marlin": "icon.original.fish-marlin",
  "item.fish.shrimp": "icon.original.fish-shrimp",
  "item.fish.stormscale": "icon.original.fish-stormscale",
  "item.crab.cooked": "icon.original.crab-cooked",
  "item.gloom.cooked": "icon.original.gloom-cooked",
  "item.lobster.cooked": "icon.original.lobster-cooked",
  "item.marlin.cooked": "icon.original.marlin-cooked",
  "item.shrimp.cooked": "icon.original.shrimp-cooked",
  "item.stormscale.cooked": "icon.original.stormscale-cooked",
  "item.pouch.drake": "icon.original.pouch-drake",
  "item.pouch.lynx": "icon.original.pouch-lynx",
  "item.rite.barrow": "icon.original.rite-barrow",
  "item.rite.drowned": "icon.original.rite-drowned",
  "item.rite.shambler": "icon.original.rite-shambler",
  "item.rite.skeleton": "icon.original.rite-skeleton",
  "item.rite.stray": "icon.original.rite-stray",
  "item.rite.wight": "icon.original.rite-wight",
  // Post-audit trophies + gear: routed onto the closest existing masters
  // until dedicated icons are generated (tracked in IMAGEGEN_ASSET_MANIFEST).
  "item.pelt.fox": "icon.original.hide-kebbit",
  "item.pelt.werewolf": "icon.original.hide-sabre",
  "item.fur.yeti": "icon.original.hide-polar",
  "item.shell.crab": "icon.original.fish-crab",
  "item.core.magma": "icon.original.construct-core",
  "item.totem.goblin": "icon.original.sunburst-idol",
  "tool.sword.magma": "icon.original.runed-sword",
  "armor.boots.yetifur": "icon.boots.leather",
  "armor.cloak.nocturne": "icon.chest.leather",
};

let packIconProvider: ((materialId: string) => string | null) | null = null;
/** The renderer's material resolver serves pack/baked art for item icons. */
export function setPackIconProvider(fn: (materialId: string) => string | null): void {
  packIconProvider = fn;
}

export function itemIconUrl(itemId: string): string | null {
  const materialId = ITEM_ICON_MATERIALS[itemId];
  if (materialId && packIconProvider) {
    const packed = packIconProvider(materialId);
    if (packed) return packed;
  }
  const draw = ITEM_DRAWS[itemId];
  return draw ? render(`item:${itemId}`, draw) : null;
}

export function skillIconUrl(skillId: string): string | null {
  const draw = SKILL_DRAWS[skillId];
  return draw ? render(`skill:${skillId}`, draw) : null;
}

export function uiIconUrl(name: string): string | null {
  const draw = UI_DRAWS[name];
  return draw ? render(`ui:${name}`, draw) : null;
}

/** <img> markup for an item, falling back to the emoji glyph. */
export function itemIconHtml(itemId: string, emoji: string, size = 28): string {
  const url = itemIconUrl(itemId);
  if (!url) return `<span class="icon">${emoji}</span>`;
  return `<img class="pix" src="${url}" width="${size}" height="${size}" alt="" draggable="false">`;
}

export function skillIconHtml(skillId: string, size = 20): string {
  const url = skillIconUrl(skillId);
  return url ? `<img class="pix" src="${url}" width="${size}" height="${size}" alt="" draggable="false">` : "";
}

export function uiIconHtml(name: string, size = 26): string {
  const url = uiIconUrl(name);
  return url ? `<img class="pix" src="${url}" width="${size}" height="${size}" alt="" draggable="false">` : "";
}
