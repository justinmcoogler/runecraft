// Verify wave-2 mobs render through the real pipeline: spawn each near the
// player via the live enemy system and screenshot.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "wave2probe");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  const p = sim.movement.currentCell();
  const rng = { next: () => 0.5, intBetween: (a) => a };
  const spawns = [
    ["enemy.goblin", -4, -2], ["enemy.goblin_shaman", -2, -3], ["enemy.goblin_chief", -4, 1],
    ["enemy.yeti", -1, 2], ["enemy.rattlesnake", 1, -2.5], ["enemy.werewolf", 3, -1],
    ["enemy.magma_hound", 4, 2], ["enemy.poacher", 1, 4],
  ];
  for (const [defId, dx, dz] of spawns) {
    sim.enemies.addPlacement(
      { instanceId: `probe.${defId}`, defId, cell: { x: Math.round(p.x + dx), z: Math.round(p.z + dz) } },
      rng,
    );
  }
  // Force night so the werewolf is visible + active.
  sim.timeS = Math.floor(sim.timeS / 1200) * 1200 + 1200 * 0.05; // ~01:12
  sim.trackingMuted = true;
  renderer.rig.setZoomHalfHeight(5);
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100); // don't die during the photo
  return { daylight: sim.daylight() };
});
await page.waitForTimeout(1200);
const counts = await page.evaluate(() => {
  const { renderer, sim } = window.__stoneleaf;
  let views = 0;
  for (const id of ["enemy.goblin", "enemy.goblin_shaman", "enemy.goblin_chief", "enemy.yeti", "enemy.rattlesnake", "enemy.werewolf", "enemy.magma_hound", "enemy.poacher"]) {
    if (renderer.enemyViews?.has?.(`probe.${id}`)) views++;
  }
  return { views, simCount: sim.enemies.enemies.size };
});
await page.screenshot({ path: "/workspace/runecraft/wave2-ingame.png" });
// Day-hide check: at noon the werewolf's view goes invisible (dormant).
const nightHide = await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  const view = renderer.enemyViews.get("probe.enemy.werewolf");
  const visibleAtNight = view?.group.visible ?? null;
  sim.timeS = Math.floor(sim.timeS / 1200) * 1200 + 1200 * 0.5; // noon
  return { visibleAtNight, daylightNoon: sim.daylight() };
});
await page.waitForTimeout(400);
const dayCheck = await page.evaluate(() => {
  const { renderer } = window.__stoneleaf;
  return { visibleAtNoon: renderer.enemyViews.get("probe.enemy.werewolf")?.group.visible ?? null };
});
console.log(JSON.stringify({ ...out, ...counts, ...nightHide, ...dayCheck, errors: errors.slice(0, 3) }));
await browser.close();
