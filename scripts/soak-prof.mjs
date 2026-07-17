import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "soak");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(3000);
const prof = await page.evaluate(() => new Promise((resolve) => {
  const r = window.__stoneleaf.renderer;
  const sim = window.__stoneleaf.sim;
  const t = { update: 0, tick: 0, frames: 0 };
  const origUpdate = r.update.bind(r);
  r.update = (dt) => { const a = performance.now(); origUpdate(dt); t.update += performance.now() - a; t.frames++; };
  const origTick = sim.tick.bind(sim);
  sim.tick = () => { const a = performance.now(); const out = origTick(); t.tick += performance.now() - a; return out; };
  setTimeout(() => resolve({
    frames: t.frames,
    msUpdatePerFrame: +(t.update / t.frames).toFixed(1),
    msTickTotal: +t.tick.toFixed(0),
  }), 4000);
}));
console.log(JSON.stringify(prof));
await browser.close();
