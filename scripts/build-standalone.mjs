// Bundle the game into self-contained HTML (no external requests, no build step
// needed to play). Produces:
//   dist/runecraft.html          — full standalone page (open anywhere)
//   dist/runecraft.fragment.html — head/body-less fragment for hosts
//                                            that wrap content in their own skeleton
// Run from the repo root: node scripts/build-standalone.mjs

import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "fs";

const result = await build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  write: false,
  outdir: "dist",
});

let js = "";
let css = "";
for (const file of result.outputFiles) {
  if (file.path.endsWith(".js")) js = file.text;
  else if (file.path.endsWith(".css")) css = file.text;
}
// Keep inline <script> parseable regardless of bundled string contents.
js = js.replaceAll("</script", "<\\/script").replaceAll("<!--", "<\\!--");

const body = `<title>Stoneleaf Vale</title>
<style>
${css}</style>
<canvas id="game-canvas"></canvas>
<div id="hud"></div>
<script>
${js}</script>
`;

const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
</head>
<body>
${body}</body>
</html>
`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/runecraft.html", full);
writeFileSync("dist/runecraft.fragment.html", body);
console.log(
  `standalone: ${(full.length / 1024).toFixed(0)} KB, fragment: ${(body.length / 1024).toFixed(0)} KB`,
);
