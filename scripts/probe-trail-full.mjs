// #124 pass 3: drive the ENTIRE Tutor's Trail to graduation. Talk objectives
// use the real interaction path; train/deliver/slay are satisfied through the
// same sim events the real actions emit (stations were exercised in pass 2).
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
await page.fill(".start-input", "trailfull");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1800);
const result = await page.evaluate(async () => {
  const { sim } = window.__stoneleaf;
  sim.trackingMuted = true;
  sim.timeS = 1200 * 0.5;
  window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const npcId = (id) => sim.world.region.npcs.find((n) => n.defId === id || n.instanceId === id)?.instanceId;
  const jumpTo = (id) => {
    const c = sim.world.region.npcs.find((n) => n.defId === id || n.instanceId === id)?.cell;
    if (c) sim.movement.setCellPosition(sim.landingNear?.({ x: c.x + 1, z: c.z + 1 }) ?? c);
  };
  const talk = async (id) => {
    sim.actions.request(npcId(id));
    for (let i = 0; i < 40 && sim.actions.pipeline !== null; i++) await sleep(150);
    await sleep(400);
  };
  const stuck = [];
  const chain = ["quest.tut_welcome"];
  const order = Object.keys(sim.quests.defs).filter((q) => q.startsWith("quest.tut_") && q !== "quest.tut_welcome" && q !== "quest.tut_graduation");
  // Preserve prereq topology: sort by chain position.
  const pos = (q) => { let d = sim.quests.defs[q], n = 0; while (d?.prereqQuestIds?.length) { d = sim.quests.defs[d.prereqQuestIds[0]]; n++; } return n; };
  order.sort((a, b) => pos(a) - pos(b));
  chain.push(...order, "quest.tut_graduation");
  for (const qid of chain) {
    const def = sim.quests.defs[qid];
    jumpTo(def.giverNpcId);
    await sleep(200);
    await talk(def.giverNpcId);
    for (let guard = 0; guard < 12; guard++) {
      const st = sim.quests.states[qid];
      if (st.status === "completed") break;
      if (st.status === "available") { await talk(def.giverNpcId); continue; }
      const obj = sim.quests.activeObjective(qid);
      if (!obj) { await talk(def.giverNpcId); continue; }
      if (obj.type === "talk") { jumpTo(obj.npcId); await sleep(200); await talk(obj.npcId); }
      else if (obj.type === "train") sim.skills.grantXp(obj.skillId, 5);
      else if (obj.type === "deliver" || obj.type === "gather") {
        sim.inventory.add(obj.itemId, obj.qty ?? 1);
        sim.events.emit({ type: "itemGained", itemId: obj.itemId, qty: obj.qty ?? 1 });
        jumpTo(def.giverNpcId); await sleep(200); await talk(def.giverNpcId);
      } else if (obj.type === "slay") {
        const p = sim.movement.currentCell();
        const rng = { next: () => 0.5, intBetween: (a) => a };
        for (let k = 0; k < (obj.qty ?? 1); k++) {
          const iid = `probe.slay.${qid}.${guard}.${k}`;
          sim.enemies.addPlacement({ instanceId: iid, defId: obj.enemyDefId, cell: { x: p.x + 2 + k, z: p.z + 2 } }, rng);
          sim.enemies.damage(iid, 99999);
        }
        await sleep(400);
      } else if (obj.type === "equip" || obj.type === "equipTag") {
        // Equip the granted gear: find an equippable start item.
        const slot = sim.inventory.slots.findIndex((s) => s && s.itemId.includes("sword"));
        if (slot >= 0) sim.enqueue({ type: "equipSlot", slot });
        await sleep(600);
      } else break;
      await sleep(400);
    }
    const st = sim.quests.states[qid];
    if (st.status !== "completed") stuck.push([qid, st.status, JSON.stringify(sim.quests.activeObjective(qid))]);
  }
  return {
    stuck,
    graduated: !!sim.worldFlags?.["tutorial.graduated"] || sim.quests.states["quest.tut_graduation"]?.status === "completed",
    completed: chain.filter((q) => sim.quests.states[q].status === "completed").length,
    total: chain.length,
  };
});
await page.screenshot({ path: "/workspace/runecraft/trail-final.png" });
console.log(JSON.stringify({ result, errors: errors.slice(0, 4) }));
await browser.close();
