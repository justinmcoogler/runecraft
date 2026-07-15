import { chromium } from "@playwright/test";

const shot = (name) => `game-smoke-${name}.png`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 420 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("http://127.0.0.1:8080/game/");
await page.waitForFunction(() => window.__stoneleaf !== undefined);
await page.waitForTimeout(800);
await page.screenshot({ path: shot("01-boot") });

// Real click on open ground (tap-to-move through the actual input layer).
await page.mouse.click(360, 160);
await page.waitForTimeout(1500);
const movedCell = await page.evaluate(() => window.__stoneleaf.sim.movement.currentCell());

// Interact with a tree via the command system, watch the full loop.
const treeInfo = await page.evaluate(() => {
  const sim = window.__stoneleaf.sim;
  const tree = [...sim.nodes.instances.values()].find((n) => n.phase === "active");
  sim.enqueue({ type: "interact", targetId: tree.instanceId });
  return { id: tree.instanceId, remaining: tree.remaining };
});
await page.waitForTimeout(2500);
await page.screenshot({ path: shot("02-chopping") });

await page.waitForFunction(
  (id) => window.__stoneleaf.sim.nodes.instances.get(id).phase === "depleted",
  treeInfo.id,
  { timeout: 40000 },
);
await page.screenshot({ path: shot("03-depleted") });

const afterChop = await page.evaluate(() => {
  const sim = window.__stoneleaf.sim;
  return {
    logs: sim.inventory.count("item.log.basic"),
    xp: sim.skills.xp["skill.woodcutting"],
    level: sim.skills.levelOf("skill.woodcutting"),
  };
});

// Open inventory panel, then walk to chest and deposit.
await page.getByTestId("inv-toggle").click();
await page.evaluate(() => window.__stoneleaf.sim.enqueue({ type: "interact", targetId: "vale.chest.001" }));
await page.waitForSelector('[data-testid="chest-panel"]:not(.hidden)', { timeout: 15000 });
await page.screenshot({ path: shot("04-chest") });
await page.getByTestId("deposit-all").click();
await page.waitForTimeout(400);
const afterDeposit = await page.evaluate(() => ({
  invLogs: window.__stoneleaf.sim.inventory.count("item.log.basic"),
  chestLogs: window.__stoneleaf.sim.containers.get("vale.chest.001").count("item.log.basic"),
}));

// Save + reload: state must be restored.
await page.evaluate(() => window.__stoneleaf.save());
await page.reload();
await page.waitForFunction(() => window.__stoneleaf !== undefined);
await page.waitForTimeout(600);
const afterReload = await page.evaluate(() => ({
  xp: window.__stoneleaf.sim.skills.xp["skill.woodcutting"],
  chestLogs: window.__stoneleaf.sim.containers.get("vale.chest.001").count("item.log.basic"),
  treePhases: [...window.__stoneleaf.sim.nodes.instances.values()].filter((n) => n.phase === "depleted").length,
}));
await page.screenshot({ path: shot("05-reloaded") });

// Tree respawn check (20s sim).
await page.waitForFunction(
  (id) => window.__stoneleaf.sim.nodes.instances.get(id).phase === "active",
  treeInfo.id,
  { timeout: 30000 },
);
await page.screenshot({ path: shot("06-respawned") });

console.log(JSON.stringify({ movedCell, treeInfo, afterChop, afterDeposit, afterReload, errors }, null, 2));
await browser.close();
