// Soak the tutorial island: walk the whole trail, poke every station/NPC,
// watch for page errors, frozen frames, or exploding memory.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 400)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "soak");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1000);

// Frame-health probe: rAF ticks per second, sampled while we play.
await page.evaluate(() => {
  window.__frames = 0;
  const count = () => { window.__frames++; requestAnimationFrame(count); };
  requestAnimationFrame(count);
});

const report = [];
// Walk stop to stop by teleporting near each master and interacting.
const stops = await page.evaluate(() => {
  const sim = window.__stoneleaf.sim;
  return sim.world.region.npcs.map((n) => ({ id: n.instanceId, cell: n.cell, name: n.name }));
});
for (const s of stops) {
  const f0 = await page.evaluate(() => window.__frames);
  await page.evaluate(({ s }) => {
    const sim = window.__stoneleaf.sim;
    const near = sim.world.nearestWalkable({ x: s.cell.x + 1, z: s.cell.z + 1 }, 6);
    if (near) sim.movement.setCellPosition(near);
    sim.enqueue({ type: "interact", targetId: s.id });
  }, { s });
  await page.waitForTimeout(650);
  const f1 = await page.evaluate(() => window.__frames);
  const fps = Math.round((f1 - f0) / 0.65);
  if (fps < 20) report.push(`${s.id} (${s.name}): ${fps} fps`);
  if (errors.length) { report.push(`ERRORS after ${s.id}: ${errors.join(" | ")}`); break; }
}
console.log(JSON.stringify({ visited: stops.length, slow: report, errors: errors.slice(0, 6) }, null, 1));
await browser.close();
