// Dump the actual texture image each livestock material samples at runtime.
import { chromium } from "@playwright/test";
import { writeFileSync } from "fs";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "skindump");
await page.getByText("Straight to the Wild").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1500);
const out = await page.evaluate(async () => {
  const { sim, renderer } = window.__stoneleaf;
  sim.trackingMuted = true;
  const p = sim.movement.currentCell();
  const rng = { next: () => 0.5, intBetween: (a) => a };
  sim.enemies.addPlacement({ instanceId: "probe.sheep", defId: "enemy.sheep", cell: { x: p.x + 2, z: p.z } }, rng);
  sim.enemies.addPlacement({ instanceId: "probe.squid", defId: "enemy.squid", cell: { x: p.x - 2, z: p.z } }, rng);
  await new Promise((r) => setTimeout(r, 2500));
  const view = renderer.enemyViews?.get?.("probe.sheep");
  const maps = [];
  const view2 = renderer.enemyViews?.get?.("probe.squid");
  if (view2) view2.group.traverse((o) => {
    if (o.isMesh && o.material?.map?.image) {
      const img = o.material.map.image;
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      const url = c.toDataURL();
      if (!maps.some((m) => m.url === url)) maps.push({ w: img.width, h: img.height, url });
    }
  });
  if (view) view.group.traverse((o) => {
    if (o.isMesh && o.material?.map?.image) {
      const img = o.material.map.image;
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      const url = c.toDataURL();
      if (!maps.some((m) => m.url === url)) maps.push({ w: img.width, h: img.height, url });
    }
  });
  return maps.map((m, i) => ({ i, w: m.w, h: m.h, url: m.url }));
});
out.forEach((m) => writeFileSync(`/workspace/runecraft/skdump-${m.i}.png`, Buffer.from(m.url.split(",")[1], "base64")));
console.log(JSON.stringify(out.map(({ i, w, h }) => ({ i, w, h }))));
await browser.close();
