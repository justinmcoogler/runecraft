// Close-up lineup of cow, pig, sheep, squid for the art pass.
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
await page.fill(".start-input", "livestock");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  sim.trackingMuted = true;
  sim.timeS = 1200 * 0.5;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  renderer.rig.setZoomHalfHeight(4);
  const p = sim.movement.currentCell();
  const rng = { next: () => 0.5, intBetween: (a) => a };
  for (const [defId, dx, dz] of [
    ["enemy.cow", -3, -2], ["enemy.pig", 3, -2], ["enemy.sheep", -3, 2], ["enemy.squid", 3, 2],
  ]) sim.enemies.addPlacement({ instanceId: `probe.${defId}`, defId, cell: { x: p.x + dx, z: p.z + dz } }, rng);
});
await page.waitForTimeout(2000);
await page.screenshot({ path: "/workspace/runecraft/livestock-close.png" });
console.log(JSON.stringify({ errors: errors.slice(0, 3) }));
await browser.close();
