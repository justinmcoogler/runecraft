// Burn a log -> a real campfire appears -> open it as a cooking station ->
// it expires after its TTL.
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
await page.fill(".start-input", "firecook");
await page.getByText("Straight to the Wild").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1800);
const out = await page.evaluate(async () => {
  const { sim } = window.__stoneleaf;
  sim.trackingMuted = true;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  sim.inventory.add("item.log.basic", 2);
  sim.inventory.add("item.fish.raw", 1);
  const slot = sim.inventory.slots.findIndex((s) => s && s.itemId === "item.log.basic");
  sim.enqueue({ type: "burnSlot", slot });
  await sleep(1200);
  const p = sim.movement.currentCell();
  const fire = sim.world.region.objects.find((o) => o.instanceId.startsWith("litfire."));
  if (!fire) return { fire: null };
  // Open it like a player click.
  sim.actions.request(fire.instanceId);
  for (let i = 0; i < 40 && sim.actions.openWorkstationId === null; i++) await sleep(150);
  const opened = sim.actions.openWorkstationId === fire.instanceId;
  // Fast-forward past the TTL.
  sim.timeS += 200;
  await sleep(800);
  const gone = !sim.world.region.objects.some((o) => o.instanceId === fire.instanceId);
  const closed = sim.actions.openWorkstationId === null;
  return { fire: fire.instanceId, dist: Math.abs(fire.cell.x - p.x) + Math.abs(fire.cell.z - p.z), opened, gone, closed };
});
await page.screenshot({ path: "/workspace/runecraft/firecook.png" });
console.log(JSON.stringify({ out, errors: errors.slice(0, 3) }));
await browser.close();
