import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "bosses");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  const p = sim.movement.currentCell();
  const rng = { next: () => 0.5, intBetween: (a) => a };
  const spawns = [
    ["enemy.dragon.fire", -9, -5],
    ["enemy.dragon.ice", 0, -8],
    ["enemy.dragon.hydra", 9, -4],
    ["enemy.dragon.twoheaded", -7, 6],
    ["enemy.warden", 8, 6],
  ];
  for (const [defId, dx, dz] of spawns) {
    sim.enemies.addPlacement({ instanceId: `probe.${defId}`, defId, cell: { x: Math.round(p.x + dx), z: Math.round(p.z + dz) } }, rng);
  }
  sim.trackingMuted = true;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  renderer.rig.setZoomHalfHeight(9);
});
await page.waitForTimeout(1800);
await page.screenshot({ path: "/workspace/runecraft/bosses.png" });
console.log(JSON.stringify({ errors: errors.slice(0, 3) }));
await browser.close();
