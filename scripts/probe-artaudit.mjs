// Art audit for #120: close-ups of player, livestock, campfire flame, trees.
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
await page.fill(".start-input", "artaudit");
await page.getByText("Straight to the Wild").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(2000);
// Daylight + close zoom + livestock ring + a lit campfire at the player's feet.
await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  sim.trackingMuted = true;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  sim.clock && (sim.clock.time = 0.35 * (sim.clock.dayLength ?? 24000));
  renderer.rig.setZoomHalfHeight(5);
  const p = sim.movement.currentCell();
  const rng = { next: () => 0.5, intBetween: (a) => a };
  const pets = [["enemy.sheep", -3, -2], ["enemy.cow", 3, -2], ["enemy.chicken", -3, 2], ["enemy.pig", 3, 2]];
  for (const [defId, dx, dz] of pets) {
    sim.enemies.addPlacement({ instanceId: `probe.${defId}`, defId, cell: { x: p.x + dx, z: p.z + dz } }, rng);
  }
});
await page.waitForTimeout(1800);
await page.screenshot({ path: "/workspace/runecraft/audit-livestock.png" });
// Firemaking flame: light a fire via the sim if the action exists, else skip.
const fire = await page.evaluate(() => {
  const { sim } = window.__stoneleaf;
  const p = sim.movement.currentCell();
  try {
    sim.world.region.objects.push({ instanceId: "probe.fire", defId: "object.campfire.basic", cell: { x: p.x + 1, z: p.z } });
    return "placed";
  } catch (e) { return String(e).slice(0, 80); }
});
await page.waitForTimeout(1200);
await page.screenshot({ path: "/workspace/runecraft/audit-fire.png" });
console.log(JSON.stringify({ fire, errors: errors.slice(0, 3) }));
await browser.close();
