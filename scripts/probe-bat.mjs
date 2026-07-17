import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "bat");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(async () => {
  const { sim, renderer } = window.__stoneleaf;
  const p = sim.movement.currentCell();
  sim.enemies.addPlacement({ instanceId: "probe.bat", defId: "enemy.bat", cell: { x: p.x + 2, z: p.z } }, sim.rng);
  await new Promise((r) => setTimeout(r, 1200));
  const view = renderer.enemyViews.get("probe.bat");
  if (!view) return { view: false };
  const THREE_Box = new (Object.getPrototypeOf(view.group).constructor)(); // dummy
  let meshes = 0, withMap = 0, opacitySum = 0;
  const size = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
  view.group.updateMatrixWorld(true);
  view.group.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m.map) withMap++;
    opacitySum += m.opacity;
    o.geometry.computeBoundingBox();
    const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    size.min = size.min.map((v, i) => Math.min(v, b.min.toArray()[i]));
    size.max = size.max.map((v, i) => Math.max(v, b.max.toArray()[i]));
  });
  return { view: true, meshes, withMap, opacitySum,
    span: size.max.map((v, i) => +(v - size.min[i]).toFixed(2)),
    worldY: +view.group.position.y.toFixed(2), minY: +size.min[1].toFixed(2), maxY: +size.max[1].toFixed(2),
    scale: view.group.scale.x, visible: view.group.visible };
});
console.log(JSON.stringify(out));
await browser.close();
