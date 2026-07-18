import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "iconprobe");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const { sim } = window.__stoneleaf;
  for (const id of ["item.pelt.fox", "item.pelt.werewolf", "item.fur.yeti", "item.shell.crab", "item.core.magma", "item.totem.goblin", "tool.sword.magma", "armor.boots.yetifur", "armor.cloak.nocturne"]) {
    sim.inventory.add(id, 1);
  }
  sim.trackingMuted = true;
});
await page.click('[data-testid="inv-toggle"]');
await page.waitForTimeout(600);
const emojiSlots = await page.evaluate(() => {
  const spans = [...document.querySelectorAll(".inventory-panel .slot .icon")];
  return spans.map((s) => s.textContent).filter(Boolean);
});
await page.screenshot({ path: "/workspace/runecraft/icons.png" });
console.log(JSON.stringify({ emojiSlots, errors: errors.slice(0, 3) }));
await browser.close();
