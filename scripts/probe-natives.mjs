import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.screenshot({ path: "/workspace/runecraft/title.png" });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "natives");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  const p = sim.movement.currentCell();
  const rng = { next: () => 0.5, intBetween: (a) => a };
  const spawns = [
    ["enemy.timber_wolf", -4, -2], ["enemy.skeleton", -2, -3], ["enemy.spider", 0, -3],
    ["enemy.pillager", 2, -3], ["enemy.chicken", 4, -2], ["enemy.cow", -4, 2],
    ["enemy.zombie", 4, 2], ["enemy.bog_slime", 0, 4],
  ];
  for (const [defId, dx, dz] of spawns) {
    sim.enemies.addPlacement({ instanceId: `probe.${defId}`, defId, cell: { x: Math.round(p.x + dx), z: Math.round(p.z + dz) } }, rng);
  }
  sim.trackingMuted = true;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  renderer.rig.setZoomHalfHeight(5.5);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: "/workspace/runecraft/natives.png" });
console.log(JSON.stringify({ errors: errors.slice(0, 3) }));
await browser.close();
