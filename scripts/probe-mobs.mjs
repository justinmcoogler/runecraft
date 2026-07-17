import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "mobs");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(async () => {
  const { sim, renderer } = window.__stoneleaf;
  const p = sim.movement.currentCell();
  const row = ["enemy.zombie", "enemy.skeleton", "enemy.creeper", "enemy.grave_shambler"];
  const placed = [];
  row.forEach((d, i) => {
    const c = sim.world.nearestWalkable({ x: p.x - 4 + i * 2, z: p.z - 3 }, 6);
    if (c) { sim.enemies.addPlacement({ instanceId: `probe.${i}`, defId: d, cell: c }, sim.rng); placed.push(d); }
  });
  await new Promise((r) => setTimeout(r, 1500));
  return {
    placed,
    simEnemies: [...sim.enemies.enemies.keys()].filter((k) => k.startsWith("probe")),
    views: renderer.enemyViews ? [...renderer.enemyViews.keys()].filter((k) => k.startsWith("probe")) : "n/a",
    totalViews: renderer.enemyViews?.size,
  };
});
console.log(JSON.stringify({ ...out, errors: errors.slice(0, 3) }));
await browser.close();
