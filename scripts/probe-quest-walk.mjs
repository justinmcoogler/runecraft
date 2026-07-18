// #124 pass 2: drive the tutorial quest chain for the first three lessons.
// Talks to the guide, then for woodcutting/firemaking/mining: accept the
// lesson, perform the real skill action at the station, report back.
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
await page.fill(".start-input", "questwalk");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1800);
await page.evaluate(() => {
  const { sim, renderer } = window.__stoneleaf;
  sim.trackingMuted = true;
  sim.timeS = 1200 * 0.5;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  renderer.rig.setZoomHalfHeight(7);
  window.__npc = (id) => sim.world.region.npcs.find((n) => n.defId === id || n.instanceId === id)?.instanceId;
  window.__near = (defPrefix, cell) => {
    let best = null, bd = 1e9;
    for (const n of sim.world.region.nodes) {
      if (!n.defId.startsWith(defPrefix)) continue;
      const d = Math.hypot(n.cell.x - cell.x, n.cell.z - cell.z);
      if (d < bd) { bd = d; best = n; }
    }
    return best?.instanceId;
  };
  window.__npcCell = (id) => sim.world.region.npcs.find((n) => n.defId === id || n.instanceId === id)?.cell;
  window.__q = (id) => sim.quests.states[id]?.status + ":" + (sim.quests.states[id]?.objectiveIndex ?? "-");
});
const log = [];
const request = async (id) => {
  await page.evaluate((t) => window.__stoneleaf.sim.actions.request(t), id);
};
const waitQ = async (qid, status, timeout = 45000) => {
  try {
    await page.waitForFunction(
      ([q, s]) => window.__stoneleaf.sim.quests.states[q]?.status === s,
      [qid, status], { timeout },
    );
    return true;
  } catch { return false; }
};
const jump = async (defId) => {
  await page.evaluate((d) => {
    const { sim } = window.__stoneleaf;
    const c = sim.world.region.npcs.find((n) => n.defId === d || n.instanceId === d)?.cell;
    if (c) sim.movement.setCellPosition(sim.landingNear?.({ x: c.x + 1, z: c.z + 1 }) ?? c);
  }, defId);
};
// 1. Guide.
await request(await page.evaluate(() => window.__npc("tutorial.guide")));
log.push(["welcome active", await waitQ("quest.tut_welcome", "active")]);
await page.screenshot({ path: "/workspace/runecraft/quest-leg0.png" });
// 2-4. First three lessons: talk, act, report.
const LESSONS = [
  ["woodcutting", "tutorial.master.woodcutting", "resource.tree."],
  ["firemaking", "tutorial.master.firemaking", null],
  ["mining", "tutorial.master.mining", "resource.rock."],
];
for (const [short, npcDef, nodePrefix] of LESSONS) {
  const qid = `quest.tut_${short}`;
  await jump(npcDef);
  await page.waitForTimeout(400);
  await request(await page.evaluate((d) => window.__npc(d), npcDef));
  await page.waitForTimeout(2500);
  await request(await page.evaluate((d) => window.__npc(d), npcDef)); // accept (second talk when needed)
  log.push([`${short} active`, await waitQ(qid, "active", 20000)]);
  // Perform the deed near the master.
  const state0 = await page.evaluate((q) => window.__q(q), qid);
  if (nodePrefix) {
    const nodeId = await page.evaluate(([p, d]) => window.__near(p, window.__npcCell(d)), [nodePrefix, npcDef]);
    if (nodeId) { await request(nodeId); await page.waitForTimeout(9000); }
  } else if (short === "firemaking") {
    // Burn a log from the inventory — the same enqueue the HUD button sends.
    await page.evaluate(() => {
      const { sim } = window.__stoneleaf;
      const slot = sim.inventory.slots.findIndex((s) => s && s.itemId.startsWith("item.log"));
      if (slot >= 0) sim.enqueue({ type: "burnSlot", slot });
    });
    await page.waitForTimeout(8000);
  }
  // Report back.
  await jump(npcDef);
  await page.waitForTimeout(400);
  await request(await page.evaluate((d) => window.__npc(d), npcDef));
  const done = await waitQ(qid, "completed", 20000);
  log.push([`${short} completed`, done, "state was", state0, "now", await page.evaluate((q) => window.__q(q), qid)]);
  await page.screenshot({ path: `/workspace/runecraft/quest-${short}.png` });
}
console.log(JSON.stringify({ log, errors: errors.slice(0, 4) }));
await browser.close();
