import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "leak");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(2500);
const out = await page.evaluate(async () => {
  const { sim, renderer } = window.__stoneleaf;
  const mem = () => ({ ...renderer.renderer.info.memory });
  const before = mem();
  for (let i = 0; i < 10; i++) {
    renderer.bindSim(sim);
    await new Promise((r) => setTimeout(r, 250));
  }
  return { before, after: mem() };
});
console.log(JSON.stringify({ ...out, errors: errors.slice(0, 3) }));
await browser.close();
