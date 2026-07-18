// #124 tutorial-island audit: reachability of every NPC/object/node from
// spawn, quest-chain integrity, and overview screenshots.
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
await page.fill(".start-input", "tutaudit");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(2000);
const audit = await page.evaluate(() => {
  const { sim } = window.__stoneleaf;
  sim.trackingMuted = true;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  const region = sim.world.region;
  const spawn = sim.movement.currentCell();
  // Flood-fill the walkable region from spawn (steps allowed like walking):
  // a target is reachable when any of its 8 neighbours (or itself) floods.
  const W = region.width, D = region.depth;
  const seen = new Uint8Array(W * D);
  const queue = [spawn];
  seen[spawn.z * W + spawn.x] = 1;
  while (queue.length) {
    const c = queue.pop();
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n = { x: c.x + dx, z: c.z + dz };
      if (n.x < 0 || n.z < 0 || n.x >= W || n.z >= D) continue;
      const i = n.z * W + n.x;
      if (seen[i]) continue;
      if (!sim.world.walkable(n)) continue;
      if (!sim.world.stepOk?.(c, n) ?? false) { /* keep if stepOk absent */ }
      seen[i] = 1;
      queue.push(n);
    }
  }
  const reach = (target) => {
    for (const [dx, dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) {
      const x = target.x + dx, z = target.z + dz;
      if (x < 0 || z < 0 || x >= W || z >= D) continue;
      if (seen[z * W + x]) return true;
    }
    return false;
  };
  const unreachableNpcs = (region.npcs ?? []).filter((n) => !reach(n.cell)).map((n) => n.defId ?? n.instanceId);
  const unreachableObjs = (region.objects ?? []).filter((o) => !reach(o.cell)).map((o) => `${o.defId}@${o.cell.x},${o.cell.z}`);
  const unreachableNodes = (region.nodes ?? []).filter((o) => !reach(o.cell)).map((o) => `${o.defId}@${o.cell.x},${o.cell.z}`);
  const questDefs = sim.quests?.defs ? Object.keys(sim.quests.defs).length : (sim.quests?.all?.().length ?? -1);
  return {
    regionId: region.id,
    spawn,
    npcCount: (region.npcs ?? []).length,
    objCount: (region.objects ?? []).length,
    nodeCount: (region.nodes ?? []).length,
    questDefs,
    unreachableNpcs,
    unreachableObjs: unreachableObjs.slice(0, 20),
    unreachableNodes: unreachableNodes.slice(0, 20),
  };
});
await page.evaluate(() => { window.__stoneleaf.renderer.rig.setZoomHalfHeight(24); });
await page.waitForTimeout(1500);
await page.screenshot({ path: "/workspace/runecraft/tut-overview.png" });
console.log(JSON.stringify({ audit, errors: errors.slice(0, 3) }));
await browser.close();
