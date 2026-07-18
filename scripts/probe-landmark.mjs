// Find the nearest crystal-garden landmark in the live world and screenshot it.
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
await page.fill(".start-input", "landmarks");
await page.getByText("Straight to the Wild").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(2000);
const found = await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  sim.trackingMuted = true;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  renderer.rig.setZoomHalfHeight(10);
  const terrain = sim.chunks.terrain;
  const p = sim.movement.currentCell();
  const pcx = Math.floor(p.x / 64), pcz = Math.floor(p.z / 64);
  let fallback = null;
  for (let r = 1; r < 11; r++) {
    for (let cz = pcz - r; cz <= pcz + r; cz++) for (let cx = pcx - r; cx <= pcx + r; cx++) {
      if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) !== r) continue;
      const c = terrain.chunk(cx, cz);
      const gem = c.nodes.find((n) => n.instanceId.endsWith(".gemgarden"));
      if (gem) return gem.cell;
      if (!fallback) {
        const mark = c.objects.find((o) => o.defId === "object.altar.rune" || o.defId === "object.shrine.stone");
        if (mark) fallback = mark.cell;
      }
    }
  }
  return fallback;
});
if (found) {
  await page.evaluate((cell) => {
    const { sim } = window.__stoneleaf;
    sim.chunks?.update(cell);
    const land = sim.landingNear?.(cell) ?? cell;
    sim.movement.setCellPosition(land);
    sim.chunks?.update(land);
  }, found);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "/workspace/runecraft/landmark.png" });
}
console.log(JSON.stringify({ found, errors: errors.slice(0, 3) }));
await browser.close();
