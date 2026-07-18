// One-shot: color-correct dark ImageGen terrain tiles toward target averages.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "fs";
const FIXES = [
  ["terrain.grass.top-64.png", [0.33, 0.55, 0.22]],
  ["terrain.moss-64.png", [0.28, 0.45, 0.2]],
];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage();
await page.goto("about:blank");
for (const [f, target] of FIXES) {
  const path = `/workspace/runecraft/src/render/art/materials/tiles/${f}`;
  const b64 = readFileSync(path).toString("base64");
  const out = await page.evaluate(async ([data, tgt]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const im = ctx.getImageData(0, 0, c.width, c.height);
    const d = im.data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    const gain = [tgt[0] * 255 * n / r, tgt[1] * 255 * n / g, tgt[2] * 255 * n / b];
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, d[i] * gain[0]);
      d[i + 1] = Math.min(255, d[i + 1] * gain[1]);
      d[i + 2] = Math.min(255, d[i + 2] * gain[2]);
    }
    ctx.putImageData(im, 0, 0);
    return c.toDataURL("image/png").split(",")[1];
  }, [b64, target]);
  writeFileSync(path, Buffer.from(out, "base64"));
  console.log("fixed", f);
}
await browser.close();
