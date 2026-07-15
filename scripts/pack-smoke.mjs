// Texture-pack importer end-to-end: build a tiny resource pack ZIP with
// distinctive colors, feed it through the real HUD file input, verify the
// world reskins, persists across reload, and resets cleanly.
import { chromium } from "@playwright/test";
import { zipSync } from "fflate";

const OUT = ".";
const shot = (name) => `${OUT}/pack-smoke-${name}.png`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 420 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto("http://127.0.0.1:8080/game/");
await page.waitForFunction(() => window.__stoneleaf !== undefined);
await page.waitForTimeout(600);

// Synthesize solid-color 16x16 PNGs in the real browser (no node canvas needed).
const pngs = await page.evaluate(() => {
  const make = (color) => {
    const c = document.createElement("canvas");
    c.width = 16; c.height = 16;
    const ctx = c.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 16, 16);
    return c.toDataURL("image/png").split(",")[1];
  };
  return {
    grassTop: make("#e6e6e6"),   // grayscale like vanilla -> should come out tinted green
    dirt: make("#ff2d78"),       // loud pink dirt: unmistakable in screenshots
    stone: make("#3535ff"),      // loud blue stone
    log: make("#ffa500"),
    leaves: make("#dddddd"),     // grayscale -> tinted
  };
});
const b = (s) => new Uint8Array(Buffer.from(s, "base64"));
const zip = zipSync({
  "pack.mcmeta": new TextEncoder().encode('{"pack":{"pack_format":15}}'),
  "assets/minecraft/textures/block/grass_block_top.png": b(pngs.grassTop),
  "assets/minecraft/textures/block/dirt.png": b(pngs.dirt),
  "assets/minecraft/textures/block/stone.png": b(pngs.stone),
  "assets/minecraft/textures/block/oak_log.png": b(pngs.log),
  "assets/minecraft/textures/block/oak_leaves.png": b(pngs.leaves),
  "assets/minecraft/models/block/junk.json": new TextEncoder().encode("{}"),
});

await page.screenshot({ path: shot("01-builtin") });

// Open the pack panel through the real button, import through the real input.
await page.click('[data-testid="pack-toggle"]');
const statusBefore = await page.textContent('[data-testid="pack-status"]');
await page.setInputFiles(".pack-file", {
  name: "Smoke Test Pack.zip",
  mimeType: "application/zip",
  buffer: Buffer.from(zip),
});
await page.waitForFunction(() =>
  document.querySelector('[data-testid="pack-status"]').textContent.includes("Smoke Test Pack"),
);
await page.waitForTimeout(700);
const statusAfter = await page.textContent('[data-testid="pack-status"]');
await page.screenshot({ path: shot("02-pack-applied") });

// Persistence: reload and the pack should re-apply from localStorage.
await page.reload();
await page.waitForFunction(() => window.__stoneleaf !== undefined);
await page.waitForTimeout(900);
await page.click('[data-testid="pack-toggle"]');
const statusReload = await page.textContent('[data-testid="pack-status"]');
await page.screenshot({ path: shot("03-after-reload") });

// Reset to built-in art.
await page.click('[data-testid="pack-reset"]');
await page.waitForTimeout(700);
const statusReset = await page.textContent('[data-testid="pack-status"]');
await page.screenshot({ path: shot("04-reset") });

// Hostile input: garbage bytes should toast an error, not break anything.
await page.setInputFiles(".pack-file", {
  name: "garbage.zip",
  mimeType: "application/zip",
  buffer: Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]),
});
await page.waitForTimeout(600);
await page.screenshot({ path: shot("05-garbage-toast") });
const stillPlays = await page.evaluate(() => {
  const sim = window.__stoneleaf.sim;
  sim.enqueue({ type: "moveTo", cell: { x: 12, z: 12 } });
  return sim.tickCount > 0;
});

console.log(JSON.stringify({ statusBefore, statusAfter, statusReload, statusReset, stillPlays, errors }, null, 2));
await browser.close();
if (errors.length) process.exit(1);
