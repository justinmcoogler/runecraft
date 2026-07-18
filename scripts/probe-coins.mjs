import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "coins");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1200);
const out = await page.evaluate(() => {
  const { sim } = window.__stoneleaf;
  sim.inventory.add("item.coin", 1_234_567);
  const slots = sim.inventory.slots.filter((s) => s?.itemId === "item.coin");
  return { coinSlots: slots.length, qty: slots[0]?.qty };
});
await page.click('[data-testid="inv-toggle"]');
await page.waitForTimeout(400);
const badge = await page.evaluate(() => {
  const badges = [...document.querySelectorAll(".inventory-panel .slot .qty")].map((b) => b.textContent);
  return badges;
});
console.log(JSON.stringify({ ...out, badge }));
await browser.close();
