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
await page.fill(".start-input", "batchprobe");
// Skip tutorial: straight into the wild world where the starter bank lives.
await page.getByText("Skip").click().catch(() => page.getByText("Head into the Wild").click());
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(2000);
const out = await page.evaluate(() => {
  const { sim } = window.__stoneleaf;
  const bankObj = sim.world.region.objects.find((o) => o.defId === "object.chest.bank");
  const bankInv = bankObj ? sim.containers.get(bankObj.instanceId) : null;
  const shared = bankInv === sim.bankInventory;
  sim.bankInventory.add("item.log.basic", 3);
  return {
    bankPlaced: !!bankObj,
    bankShared: shared,
    bankHasDeposit: sim.bankInventory.slots.some((s) => s?.itemId === "item.log.basic"),
  };
});
await page.screenshot({ path: "/workspace/runecraft/batch.png" });
console.log(JSON.stringify({ ...out, errors: errors.slice(0, 3) }));
await browser.close();
