// Build game/src/structures/texture-colors.ts from a Minecraft resource
// pack: one average color per block texture. Only computed hex values are
// written — no third-party pixels are stored or shipped. Re-run when the
// reference pack updates.
//
//   node game/scripts/extract-pack-colors.mjs <pack.zip>

import { execFileSync } from "child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { averagePngColor } from "./png-color.mjs";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , packZip] = process.argv;
if (!packZip) {
  console.error("usage: node game/scripts/extract-pack-colors.mjs <pack.zip>");
  process.exit(1);
}

// Vanilla leaves/grass/water textures are grayscale and tinted at runtime;
// multiply their averages by the game's standard tints.
const TINTS = {
  grass_block_top: "#79c05a",
  water_still: "#3f76c9",
  water_flow: "#3f76c9",
  oak_leaves: "#59ae30", jungle_leaves: "#59ae30", acacia_leaves: "#59ae30",
  dark_oak_leaves: "#59ae30", mangrove_leaves: "#59ae30", vine: "#59ae30",
  birch_leaves: "#6fa839", spruce_leaves: "#4e7a4e",
};
const applyTint = (hex, tint) => {
  const c = (s, i) => parseInt(s.slice(i, i + 2), 16);
  const mul = (a, b) => Math.round((a * b) / 255).toString(16).padStart(2, "0");
  return `#${mul(c(hex, 1), c(tint, 1))}${mul(c(hex, 3), c(tint, 3))}${mul(c(hex, 5), c(tint, 5))}`;
};

const tmp = mkdtempSync(join(tmpdir(), "pack-colors-"));
try {
  execFileSync("unzip", ["-qo", packZip, "assets/minecraft/textures/block/*", "-d", tmp]);
  const blockDir = join(tmp, "assets/minecraft/textures/block");
  const entries = [];
  for (const file of readdirSync(blockDir).sort()) {
    if (!file.endsWith(".png")) continue;
    const color = averagePngColor(readFileSync(join(blockDir, file)));
    if (!color) continue;
    const key = file.slice(0, -4);
    entries.push([key, TINTS[key] ? applyTint(color, TINTS[key]) : color]);
  }
  if (entries.length < 100) throw new Error(`only ${entries.length} textures decoded — wrong pack layout?`);

  const out = join(gameDir, "src/structures/texture-colors.ts");
  writeFileSync(
    out,
    `// Average block-texture colors extracted by extract-pack-colors.mjs from a
// reference resource pack (only computed hex values — no third-party pixels).
// Keys are texture file basenames. Used to auto-recognize any block the
// explicit mapping doesn't cover. Do not hand-edit; re-run the script.

export const BLOCK_TEXTURE_COLORS: Record<string, string> = {
${entries.map(([k, v]) => `  "${k}": "${v}",`).join("\n")}
};
`,
  );
  console.log(`wrote ${out} (${entries.length} textures from ${basename(packZip)})`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
