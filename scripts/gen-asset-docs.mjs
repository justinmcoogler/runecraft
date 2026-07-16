// Generate TEXTURE_PACK.md + SKILL_PLANS.md and append to ART_RUNESCAPE.md
// from the asset-plan workflow journal. Pure transform — no invention.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const JOURNAL = process.argv[2];
const results = readFileSync(JOURNAL, "utf8")
  .split("\n").filter(Boolean)
  .map((l) => { try { return JSON.parse(l); } catch { return null; } })
  .filter((o) => o && o.type === "result")
  .map((o) => o.value ?? o.result ?? o.output)
  .filter((v) => v && typeof v === "object");

const byCat = {};
for (const v of results) byCat[v.category ?? v.cluster] = v;

const cell = (s) => String(s ?? "").replace(/\r?\n+/g, " ").replace(/\|/g, "\\|").trim();
const esc = (s) => cell(s);

// ---------------------------------------------------------------------------
// TEXTURE_PACK.md
// ---------------------------------------------------------------------------
const mat = byCat["materials-catalog"];
const ent = byCat["entities"];
const items = byCat["items"];
const uifx = byCat["ui-fx"];
const bf = byCat["blocks-foliage"];

const groupBy = (entries, key = "group") => {
  const m = new Map();
  for (const e of entries ?? []) {
    const g = e[key] ?? "misc";
    if (!m.has(g)) m.set(g, []);
    m.get(g).push(e);
  }
  return m;
};

const table = (rows, cols) =>
  [`| ${cols.map((c) => c.h).join(" | ")} |`,
   `|${cols.map(() => "---").join("|")}|`,
   ...rows.map((r) => `| ${cols.map((c) => cell(c.get(r))).join(" | ")} |`)].join("\n");

const texCols = [
  { h: "Material ID", get: (e) => `\`${e.id}\`` },
  { h: "Name", get: (e) => e.name },
  { h: "Size", get: (e) => e.size },
  { h: "Currently", get: (e) => e.source },
  { h: "RuneScape art direction", get: (e) => e.rsStyle },
];

let tp = `# Runecraft — Full Custom Texture Pack (RuneScape re-skin)

**Goal:** recreate EVERY texture in the game with an original RuneScape fill, so
Runecraft ships its own custom pack instead of aliasing Minecraft art.

**Style bible (applies to every tile):** classic RuneScape — muted earthy
palettes (moss greens, umber browns, cold greys), 2–3 tone chunky dither, low
detail that reads at a glance, gold/rune accents only where fitting. Pixel art,
no anti-aliasing. Nothing shrill; textures are seen thousands of times.

**How the pack works (technical):** the game resolves art through *logical
material IDs* (see \`src/texturepacks/importer.ts\` \`ALIASES\`, and
\`src/render/textures.ts\`). Deliver one PNG per material ID below. Block/prop/
item tiles are **16×16** (larger square sizes accepted, kept native). Entity/
character skins are **box-UV sheets** (64×64 / 64×32) laid out like Minecraft
entity textures. Some grayscale tiles are biome-tinted at runtime (noted with a
tint hex) — paint those **grayscale** and let the engine tint. A handful of
water/leaf tiles ship pre-coloured (noted).

**Counts:** ${mat?.reportedCount ?? "?"} block/prop/foliage/item materials · ${ent?.reportedCount ?? ent?.entries?.length ?? "?"} entity & character skins · ${items?.reportedCount ?? items?.entries?.length ?? "?"} item icons · ${uifx?.entries?.length ?? "?"} UI/FX sprites. Everything below is a real ID pulled from the codebase.

---
`;

// Materials grouped
tp += `\n## 1. Blocks, terrain, props & foliage materials (\`ALIASES\` table)\n\n`;
tp += `> ${esc(mat?.summary ?? "")}\n`;
const GROUP_ORDER = ["terrain", "liquid", "tree/foliage", "tree-species", "leaf", "rock/ore", "roof", "prop-surface", "prop-voxel", "block-tile", "plant/crop", "misc"];
const matGroups = groupBy(mat?.entries);
const orderedGroups = [
  ...GROUP_ORDER.filter((g) => matGroups.has(g)),
  ...[...matGroups.keys()].filter((g) => !GROUP_ORDER.includes(g)),
];
for (const g of orderedGroups) {
  const rows = matGroups.get(g);
  tp += `\n### ${g} (${rows.length})\n\n${table(rows, texCols)}\n`;
}

// Entities
tp += `\n---\n\n## 2. Entity & character skins (box-UV)\n\n> ${esc(ent?.summary ?? "")}\n`;
for (const [g, rows] of groupBy(ent?.entries)) {
  tp += `\n### ${g} (${rows.length})\n\n${table(rows, texCols)}\n`;
}

// Items
tp += `\n---\n\n## 3. Item icons (16×16)\n\n> ${esc(items?.summary ?? "")}\n`;
for (const [g, rows] of groupBy(items?.entries)) {
  tp += `\n### ${g} (${rows.length})\n\n${table(rows, texCols)}\n`;
}

// UI/FX
tp += `\n---\n\n## 4. UI icons, skill badges & effects\n\n> ${esc(uifx?.summary ?? "")}\n`;
for (const [g, rows] of groupBy(uifx?.entries)) {
  tp += `\n### ${g} (${rows.length})\n\n${table(rows, texCols)}\n`;
}

// Blocks-foliage gaps
if (bf?.entries?.length) {
  tp += `\n---\n\n## 5. Block/foliage detail & gaps\n\n> ${esc(bf?.summary ?? "")} — entries whose name flags "GAP" have no alias yet and need a material added in code as well as art.\n\n`;
  tp += table(bf.entries, texCols) + "\n";
}

writeFileSync("TEXTURE_PACK.md", tp);
console.log("TEXTURE_PACK.md:", tp.length, "chars");

// ---------------------------------------------------------------------------
// SKILL_PLANS.md
// ---------------------------------------------------------------------------
const clusters = ["gathering", "urban", "crafting", "construction", "combat-economy"];
const current = {};
for (const e of byCat["skill-current"]?.entries ?? []) current[(e.name || e.id || "").toLowerCase()] = e;

const addCols = [
  { h: "Add", get: (a) => a.kind },
  { h: "ID / Name", get: (a) => `${a.id ? "`" + a.id + "` " : ""}${a.name}` },
  { h: "Lvl", get: (a) => (a.level ?? "") },
  { h: "Detail (xp · inputs → outputs · drops)", get: (a) => a.detail },
  { h: "Where / file", get: (a) => a.placement },
  { h: "Art needed", get: (a) => a.art },
];

let sp = `# Runecraft — Skill Expansion Plans

Concrete build plans for the under-developed skills flagged in the alpha audit:
current gap → proposed level ladder → every new node/recipe/item/object with its
ID, level, XP, **where it goes in worldgen**, and the **art it needs**. Art rows
are mirrored into \`ART_RUNESCAPE.md\`; textures into \`TEXTURE_PACK.md\`.

Design targets: ladders reach ~L90+, no dead zones > ~15 levels, every product
has a sink, every station is reachable in the *endless* world (not just the
tutorial). XP curve reference: ~2.7k XP to L10, ~59k to L30, ~258k to L50.

`;

const clusterTitle = {
  gathering: "Gathering — Foraging, Hunting, Archaeology",
  urban: "Urban — Thieving, Agility",
  crafting: "Crafting — Brewing, Runecrafting, Herblore",
  construction: "Construction — repeatable training + claim-a-plot housing",
  "combat-economy": "Combat & Economy — armor/rod/arrow ladders + ceiling fixes",
};

for (const c of clusters) {
  const cl = byCat[c];
  if (!cl) continue;
  sp += `\n## ${clusterTitle[c] ?? c}\n`;
  for (const s of cl.skills ?? []) {
    const cur = current[(s.skill || "").toLowerCase()];
    sp += `\n### ${s.skill}\n\n`;
    sp += `**Problem now:** ${esc(s.problemNow)}\n\n`;
    if (cur) sp += `**Current content (from code):** ${esc(cur.source)}\n\n`;
    if (s.ladder) sp += `**Proposed ladder:** ${esc(s.ladder)}\n\n`;
    if (s.additions?.length) sp += table(s.additions, addCols) + "\n";
  }
}

writeFileSync("SKILL_PLANS.md", sp);
console.log("SKILL_PLANS.md:", sp.length, "chars");

// ---------------------------------------------------------------------------
// ART_RUNESCAPE.md — append skill-expansion art
// ---------------------------------------------------------------------------
const artRows = [];
for (const c of clusters) {
  for (const s of byCat[c]?.skills ?? []) {
    for (const a of s.additions ?? []) {
      if (a.art && a.art.trim() && a.art.toLowerCase() !== "none" && a.art.toLowerCase() !== "n/a") {
        artRows.push({ skill: s.skill, item: `${a.name}${a.id ? " (`" + a.id + "`)" : ""}`, art: a.art });
      }
    }
  }
}
let art = `\n\n---\n\n## 8. Skill-expansion art (from SKILL_PLANS.md)\n\nProps, stations, mobs and icons the skill build-outs need. Same RuneScape\nstyle bible as above. Full per-texture spec for the world re-skin lives in\n**TEXTURE_PACK.md**.\n\n`;
art += table(artRows, [
  { h: "Skill", get: (r) => r.skill },
  { h: "New asset", get: (r) => r.item },
  { h: "Art direction", get: (r) => r.art },
]) + "\n";
appendFileSync("ART_RUNESCAPE.md", art);
console.log("ART_RUNESCAPE.md: +", art.length, "chars,", artRows.length, "art rows");
