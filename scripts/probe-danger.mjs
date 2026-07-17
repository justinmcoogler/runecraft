import { generateChunk, ENDLESS_CENTER, ECHUNK, remoteness01, dangerTier, setValeActive } from "../src/sim/worldgen/endless.ts";
setValeActive(false);
const cc = Math.floor(ENDLESS_CENTER / ECHUNK);
// Signature mobs per tier (from DANGER_MOBS)
const TIER_OF = {};
[["boar","timber_wolf","spider","pig"],["cave_spider","skeleton","zombie","thornback"],
 ["dire_wolf","stray","marsh_lurker","grave_shambler"],["moss_golem","mire_husk","gloom_spinner","stone_sentinel"],
 ["barrow_lord","silt_king","glacial_wight","canyon_construct"],["warden","dragon.fire","dragon.ice","ravager"]]
 .forEach((pool, t) => pool.forEach((m) => { TIER_OF["enemy." + m] = t; }));

// Walk straight out along +x, one chunk at a time, note first tier-N mob seen.
const firstSeen = {};
for (let step = 0; step < 100; step++) {
  const ch = generateChunk(1234, cc + step, cc);
  const distCells = step * ECHUNK;
  for (const e of ch.enemies) {
    const t = TIER_OF[e.defId];
    if (t === undefined) continue;
    if (firstSeen[t] === undefined) firstSeen[t] = { chunk: step, cells: distCells, mob: e.defId };
  }
}
console.log("Danger dial: remoteness = dist/6000 (cap 1); tier = floor(dist/1000), cap 5");
console.log("Chunk = 64 cells. Spawn at chunk", cc);
console.log("");
console.log("Theoretical tier thresholds (straight-line distance):");
for (let t = 0; t <= 5; t++) {
  const cells = t * 1000;
  console.log(`  Tier ${t}: from ${cells} cells = ~${(cells/64).toFixed(0)} chunks out`);
}
console.log("");
console.log("Empirically (first sighting walking due-east from spawn, seed 1234):");
for (let t = 0; t <= 5; t++) {
  const f = firstSeen[t];
  console.log(`  Tier ${t}: ${f ? `chunk ${f.chunk} (~${f.cells} cells) — ${f.mob}` : "not seen in 100 chunks"}`);
}
// Extra roaming beast count by distance
console.log("");
console.log("Roaming-beast COUNT per chunk = floor(remoteness*5):");
for (const cells of [0, 600, 1200, 2400, 3600, 4800, 6000]) {
  const r = Math.min(1, cells / 6000);
  console.log(`  ${cells} cells (~${(cells/64).toFixed(0)} chunks): remoteness ${r.toFixed(2)}, tier ${Math.min(5,Math.floor(r*6))}, ~${Math.floor(r*5)} extra roamers/chunk`);
}
