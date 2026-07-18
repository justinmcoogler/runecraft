import { chromium } from "@playwright/test";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await page.goto("file:///workspace/runecraft/dist/runecraft.html");
await page.waitForSelector(".start-title", { timeout: 20000 });
await page.click(".start-big");
await page.waitForSelector(".start-input");
await page.fill(".start-input", "runbtn");
await page.getByText("Play the Tutorial").click();
await page.waitForFunction(() => window.__stoneleaf !== undefined, { timeout: 30000 });
await page.waitForTimeout(1200);
const check = () => page.evaluate(() => {
  const btn = document.querySelector('[data-testid="run-toggle"]');
  const hasImg = !!btn?.querySelector("img");
  const emoji = [...(btn?.textContent ?? "")].filter((c) => c.codePointAt(0) >= 0x1f000);
  // Whole-HUD emoji sweep (excluding typographic marks)
  const all = [...document.querySelector("#hud").innerText].filter((c) => c.codePointAt(0) >= 0x1f000);
  return { hasImg, btnEmoji: emoji.join(""), hudEmoji: [...new Set(all)].join("") };
});
const before = await check();
await page.keyboard.press("r");
await page.waitForTimeout(300);
const after = await check();
console.log(JSON.stringify({ before, after }));
await browser.close();
