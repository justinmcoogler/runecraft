// Shareable gameplay gallery: daylight scenes across the game.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function boot(page, name, tutorial) {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto("file:///workspace/runecraft/dist/runecraft.html");
  await page.waitForSelector(".start-title", { timeout: 20000 });
  await page.click(".start-big");
  await page.waitForSelector(".start-input");
  await page.fill(".start-input", name);
  await page.getByText(tutorial ? "Play the Tutorial" : "Straight to the Wild").click();
  await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const { sim } = window.__stoneleaf;
    sim.trackingMuted = true;
    sim.timeS = 1200 * 0.5 + Math.floor(sim.timeS / 1200) * 1200; // noon today
    window.__keepAlive = setInterval(() => { sim.hp = 20; }, 100);
  });
  await page.waitForTimeout(600);
}

// 1) Tutorial plaza with tutors + bosses lineup (dramatic).
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await boot(page, "gallery1", true);
  await page.evaluate(() => {
    const { sim, renderer } = window.__stoneleaf;
    const p = sim.movement.currentCell();
    const rng = { next: () => 0.5, intBetween: (a) => a };
    for (const [defId, dx, dz] of [
      ["enemy.dragon.fire", -9, -5], ["enemy.dragon.ice", 0, -8], ["enemy.dragon.hydra", 9, -4],
      ["enemy.dragon.twoheaded", -7, 6], ["enemy.warden", 8, 6],
    ]) sim.enemies.addPlacement({ instanceId: `probe.${defId}`, defId, cell: { x: p.x + dx, z: p.z + dz } }, rng);
    renderer.rig.setZoomHalfHeight(9);
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "/workspace/runecraft/shot-bosses.png" });
  await page.close();
}
// 2) Wild: spawn meadow; 3) forest road; 4) landmark; 5) goblin camp fight; 6) savanna.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  await boot(page, "gallery2", false);
  const go = async (dx, dz, zoom, file, extra) => {
    await page.evaluate(([ox, oz, zh]) => {
      const { sim, renderer } = window.__stoneleaf;
      const c = { x: 32768 + ox, z: 32768 + oz };
      sim.chunks?.update(c);
      const land = sim.landingNear?.(c) ?? c;
      sim.movement.setCellPosition(land);
      sim.chunks?.update(land);
      renderer.rig.setZoomHalfHeight(zh);
    }, [dx, dz, zoom]);
    if (extra) await page.evaluate(extra);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `/workspace/runecraft/${file}` });
  };
  await go(0, 0, 11, "shot-spawn.png");
  await go(700, 240, 10, "shot-forest.png");
  await go(900, -700, 12, "shot-winter.png");
  // Combat vignette: goblin war band around the player in the open.
  await go(350, 120, 7, "shot-goblins.png", () => {
    const { sim } = window.__stoneleaf;
    const p = sim.movement.currentCell();
    const rng = { next: () => 0.5, intBetween: (a) => a };
    for (const [defId, dx, dz] of [
      ["enemy.goblin", -3, -2], ["enemy.goblin", 3, -1], ["enemy.goblin_shaman", 0, -4],
      ["enemy.goblin_chief", 4, 2], ["enemy.timber_wolf", -4, 2],
    ]) sim.enemies.addPlacement({ instanceId: `probe.${defId}.${dx}`, defId, cell: { x: p.x + dx, z: p.z + dz } }, rng);
  });
  await go(1400, 480, 12, "shot-far.png");
  await page.close();
}
console.log("done");
await browser.close();
