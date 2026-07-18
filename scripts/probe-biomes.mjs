// Teleport across the first ~1500 cells of a wild world and screenshot each
// stop, to eyeball the new biome variety along an ordinary walking line.
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
await page.fill(".start-input", "biomes");
await page.getByText("Straight to the Wild").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  sim.trackingMuted = true;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  renderer.rig.setZoomHalfHeight(14);
});
const stops = [[0, 0], [350, 120], [700, 240], [1050, 360], [1400, 480], [900, -700]];
let i = 0;
for (const [dx, dz] of stops) {
  await page.evaluate(([ox, oz]) => {
    const { sim } = window.__stoneleaf;
    const c = { x: 32768 + ox, z: 32768 + oz };
    sim.chunks?.update(c);
    const land = sim.landingNear?.(c) ?? c;
    sim.movement.setCellPosition(land);
    sim.chunks?.update(land);
  }, [dx, dz]);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `/workspace/runecraft/biome-stop-${i}.png` });
  i++;
}
console.log(JSON.stringify({ errors: errors.slice(0, 3) }));
await browser.close();
