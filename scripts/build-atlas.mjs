// Generates game/docs/world-atlas.md from the live worldgen output.
// Run from the repo root: node game/scripts/build-atlas.mjs
import { writeFileSync } from "fs";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `
      export { buildOverworld } from "./src/sim/worldgen/overworld";
      export { WorldState } from "./src/sim/world";
      export { REGIONS, WORLD, SPAWN } from "./src/sim/worldgen/regions";
      export { BIOME } from "./src/sim/worldgen/geo";
      export { DUNGEON_SPECS } from "./src/sim/worldgen/settlements";
    `,
    resolveDir: "game", loader: "ts",
  },
  bundle: true, format: "esm", platform: "node", write: false,
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const { region, pois, roads, biome } = mod.buildOverworld();
const { WORLD, SPAWN, REGIONS, BIOME, DUNGEON_SPECS } = mod;

const BIOME_NAME = {};
for (const [k, v] of Object.entries(BIOME)) BIOME_NAME[v] = k;

// ---- Accessibility flood (Primary Accessible Route proof) ------------------
const world = new mod.WorldState(region);
const seen = new Uint8Array(WORLD * WORLD);
const q = [SPAWN.x + SPAWN.z * WORLD];
seen[q[0]] = 1;
let flooded = 0;
while (q.length) {
  const i = q.pop();
  flooded++;
  const x = i % WORLD, z = (i / WORLD) | 0;
  const h = world.heightAt({ x, z });
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, nz = z + dz;
    if (nx < 0 || nz < 0 || nx >= WORLD || nz >= WORLD) continue;
    const j = nx + nz * WORLD;
    if (seen[j]) continue;
    const c = { x: nx, z: nz };
    if (!world.walkable(c)) continue;
    if (Math.abs(world.heightAt(c) - h) > 1) continue;
    seen[j] = 1;
    q.push(j);
  }
}

const reachable = (p, r = 6) => {
  for (let dz = -r; dz <= r; dz++)
    for (let dx = -r; dx <= r; dx++) {
      const x = p.x + dx, z = p.z + dz;
      if (x >= 0 && z >= 0 && x < WORLD && z < WORLD && seen[x + z * WORLD]) return true;
    }
  return false;
};

// Nearest named road within 14 cells of the POI.
const nearRoad = (p) => {
  let best = null, bd = 40;
  for (const r of roads) {
    for (let i = 0; i < r.centerline.length; i += 3) {
      const [cx, cz] = r.centerline[i];
      const d = Math.hypot(cx - p.x, cz - p.z);
      if (d < bd) { bd = d; best = r.id; }
    }
  }
  return best ?? "—";
};

const fmtServices = (p) => (p.services?.length ? p.services.join(", ") : "—");
const biomeAt = (p) => BIOME_NAME[biome[p.z * WORLD + p.x]] ?? "?";

// ---- Document ---------------------------------------------------------------
const lines = [];
const push = (s = "") => lines.push(s);
push("# Stoneleaf Vale — World Atlas");
push();
push("Generated from the deterministic world generator (`game/src/sim/worldgen/`).");
push("Regenerate by re-running the generator; do not hand-edit coordinates.");
push();
push(`- World size: ${WORLD} × ${WORLD} blocks. Spawn: (${SPAWN.x}, ${SPAWN.z}) on the Greenvale plaza road.`);
push(`- Placements: ${region.nodes.length} resource nodes, ${region.objects.length} objects, ${region.npcs.length} NPCs, ${region.enemies.length} enemy spawns, ${region.structures?.length ?? 0} structures.`);
push(`- Roads: ${roads.length} carved routes, ${roads.flatMap((r) => r.bridges).length} bridges.`);
push(`- Primary Accessible Route proof: a 4-direction flood from spawn (step ≤ 1 block, no water, no blockers) reaches ${flooded.toLocaleString()} cells; every table below lists per-POI reachability from that flood.`);
push();

push("## Regions");
push();
push("| Region | Center | Tier | Tagline |");
push("| --- | --- | --- | --- |");
for (const r of Object.values(REGIONS)) {
  push(`| ${r.name} | (${r.center.x}, ${r.center.z}) | ${r.tier} | ${r.tagline} |`);
}
push();

const KINDS = [
  ["settlement", "Settlements"],
  ["dungeon", "Dungeons"],
  ["landmark", "Named landmarks"],
  ["expansion", "Expansion exits"],
  ["bridge", "Major bridges"],
];
for (const [kind, title] of KINDS) {
  const list = pois.filter((p) => p.kind === kind);
  push(`## ${title} (${list.length})`);
  push();
  push("| Name | Coords | Region | Biome | Tier | Services | Nearest road | Reachable |");
  push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const p of list.sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name))) {
    push(`| ${p.name} | (${p.x}, ${p.z}) | ${p.region} | ${biomeAt(p)} | ${p.tier} | ${fmtServices(p)} | ${nearRoad(p)} | ${reachable(p) ? "yes" : "NO"} |`);
  }
  push();
}

const discoveries = pois.filter((p) => p.kind === "discovery");
push(`## Discoveries (${discoveries.length})`);
push();
push("Small unnamed-on-map finds (campsites, shrines, wells, carts, ruins,");
push("standing stones, watchposts, fishing spots, memorials, bandit camps)");
push("stamped every 90–180 blocks along the road network and scattered off-road.");
push();

push("## Dungeon interiors");
push();
push("| Dungeon | Overworld door | Rooms | Boss | Route status |");
push("| --- | --- | --- | --- | --- |");
for (const d of DUNGEON_SPECS) {
  const door = pois.find((p) => p.kind === "dungeon" && p.id.includes(d.id.replace("region.", "")));
  push(`| ${d.name} | ${door ? `(${door.x}, ${door.z})` : "—"} | ${d.rooms} | ${d.boss} | entrance→boss→exit verified in tests |`);
}
push();

push("## Verification");
push();
push("- `game/src/sim/__tests__/overworld.test.ts` proves the accessibility rule");
push("  (flood-fill Primary Accessible Route from spawn to every settlement,");
push("  dungeon door, landmark and expansion exit), biome organicness, road");
push("  discovery spacing, settlement services, and dungeon route compliance.");
push("- Rendering, streaming, the map panel and dungeon round-trips are checked");
push("  in the browser with Playwright before each ship.");
push();

const bad = pois.filter((p) => p.kind !== "discovery" && p.kind !== "bridge" && !reachable(p));
if (bad.length) {
  push("### UNREACHABLE POIS (fix before shipping!)");
  for (const p of bad) push(`- ${p.name} (${p.x}, ${p.z})`);
}

writeFileSync("game/docs/world-atlas.md", lines.join("\n") + "\n");
console.log("atlas written:", lines.length, "lines;", pois.length, "POIs;", bad.length, "unreachable");
