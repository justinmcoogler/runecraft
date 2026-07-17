import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "soak");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(3000); // let streaming settle
await page.evaluate(() => {
  window.__frames = 0;
  const count = () => { window.__frames++; requestAnimationFrame(count); };
  requestAnimationFrame(count);
});
await page.waitForTimeout(4000);
const tutFps = await page.evaluate(() => window.__frames / 4);
// Also profile: how many draw calls / scene children?
const stats = await page.evaluate(() => {
  const r = window.__stoneleaf.renderer;
  const info = r.renderer?.info;
  return {
    sceneChildren: r.scene.children.length,
    drawCalls: info?.render?.calls,
    triangles: info?.render?.triangles,
    geometries: info?.memory?.geometries,
    textures: info?.memory?.textures,
  };
});
console.log(JSON.stringify({ tutFps, stats, errors }, null, 1));
await browser.close();
