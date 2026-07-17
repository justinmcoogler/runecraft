// Play the real tutorial chain in the browser: accept each lesson, do its
// deed via sim events where needed, report back — watching for page errors.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 500)));
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "soak");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const { sim } = window.__stoneleaf;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const talk = (npc) => { sim.events.emit({ type: "npcChat", instanceId: npc, name: npc }); };
  const log = [];
  const QUESTS = sim.quests.defs ?? null;
  const chainIds = sim.quests.allIds().filter((q) => q.startsWith("quest.tut_"));
  talk("tutorial.guide");
  await sleep(120);
  // Lessons unlock strictly in prereq order; walk the list by chain, not id.
  const ordered = [];
  const remaining = new Set(chainIds);
  while (remaining.size) {
    let moved = false;
    for (const qid of [...remaining]) {
      const d = sim.quests.defOf(qid);
      const pre = d?.prereqQuestIds?.[0];
      if (!pre || !remaining.has(pre)) { ordered.push(qid); remaining.delete(qid); moved = true; }
    }
    if (!moved) { ordered.push(...remaining); break; }
  }
  for (const qid of ordered) {
    const def = sim.quests.defOf(qid);
    if (!def) continue;
    talk(def.giverNpcId);
    await sleep(80);
    for (let round = 0; round < 10 && sim.quests.states[qid]?.status !== "completed"; round++) {
      const st = sim.quests.states[qid];
      const obj = def.objectives[st.objectiveIndex];
      if (!obj) break;
      if (obj.type === "train") sim.events.emit({ type: "xpGained", skillId: obj.skillId, amount: 12 });
      else if (obj.type === "slay") {
        const eid = `soak.${qid}.${round}`;
        sim.enemies.addPlacement({ instanceId: eid, defId: obj.enemyDefId, cell: sim.movement.currentCell() }, sim.rng);
        sim.events.emit({ type: "enemyDied", instanceId: eid });
      } else if (obj.type === "deliver") { sim.inventory.add(obj.itemId, obj.qty ?? 1); talk(obj.npcId ?? def.giverNpcId); }
      else if (obj.type === "talk") talk(obj.npcId ?? def.giverNpcId);
      else if (obj.type === "equipTag") { sim.equippedTool = "tool.sword.copper"; sim.events.emit({ type: "equipmentChanged" }); }
      await sleep(60);
    }
    log.push(`${qid}: ${sim.quests.states[qid]?.status}`);
  }
  return log;
});
await page.waitForTimeout(2000);
console.log(JSON.stringify({ done: result.filter((l) => l.includes("completed")).length, total: result.length, notDone: result.filter((l) => !l.includes("completed")), errors: errors.slice(0, 5) }, null, 1));
await browser.close();
