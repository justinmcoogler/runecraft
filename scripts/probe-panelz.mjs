// Verify chest + inventory close buttons are clickable above the minimap.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } }); // shorter viewport: panels reach the minimap
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "panelz");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1200);
const out = await page.evaluate(() => {
  // Open the chest + inventory panels the interaction way (no menu-top).
  document.querySelector(".chest-panel").classList.remove("hidden");
  document.querySelector(".inventory-panel").classList.remove("hidden");
  const probe = (sel) => {
    const btn = document.querySelector(`${sel} .panel-header .btn`) ?? document.querySelector(`${sel} .btn`);
    if (!btn) return { found: false };
    const r = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { found: true, clickable: btn === hit || btn.contains(hit) };
  };
  const mm = getComputedStyle(document.querySelector(".mm-mini") ?? document.body).zIndex;
  return { chest: probe(".chest-panel"), inv: probe(".inventory-panel"), mmZ: mm };
});
await page.screenshot({ path: "/workspace/runecraft/panelz.png" });
console.log(JSON.stringify({ ...out, errors: errors.slice(0, 3) }));
await browser.close();
