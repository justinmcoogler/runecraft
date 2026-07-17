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
  const api = window.__stoneleaf;
  const hud = api.hud;
  const t = { hud: 0, minimap: 0, n: 0, raf: 0, lastRaf: performance.now(), longTasks: [] };
  if (hud) {
    const orig = hud.update.bind(hud);
    hud.update = () => { const a = performance.now(); orig(); t.hud += performance.now() - a; t.n++; };
  }
  const mm = api.minimap ?? hud?.minimap;
  if (mm?.update) { const om = mm.update.bind(mm); mm.update = (...args) => { const a = performance.now(); om(...args); t.minimap += performance.now() - a; }; }
  // long task observer
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) t.longTasks.push(Math.round(e.duration));
    }).observe({ entryTypes: ["longtask"] });
  } catch (e) {}
  const tick = () => { const now = performance.now(); t.raf++; t.lastRaf = now; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  setTimeout(() => resolve({
    hudPerFrame: t.n ? +(t.hud / t.n).toFixed(1) : "no-hud-handle",
    minimapTotal: +t.minimap.toFixed(0),
    frames: t.raf,
    longTasks: t.longTasks.slice(0, 20),
    keys: Object.keys(api),
  }), 4000);
}));
console.log(JSON.stringify(prof));
await browser.close();
