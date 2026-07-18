import { SHOPS, RECIPES, ITEMS, NODES, ENEMIES } from "/workspace/runecraft/src/content/content.ts";

// (a) Money-loop exploit: an item purchasable anywhere below what ANY shop pays.
const bestBuy = {};   // cheapest player-buy price per item
const bestSell = {};  // highest shop-pays price per item
for (const shop of Object.values(SHOPS)) {
  for (const s of shop.sells) if (bestBuy[s.itemId] === undefined || s.price < bestBuy[s.itemId]) bestBuy[s.itemId] = s.price;
  for (const [id, p] of Object.entries(shop.buys)) if (bestSell[id] === undefined || p > bestSell[id]) bestSell[id] = p;
}
const loops = [];
for (const [id, buy] of Object.entries(bestBuy)) {
  const sell = bestSell[id];
  if (sell !== undefined && sell >= buy) loops.push(`${id}: buy ${buy} -> sell ${sell} (${sell - buy >= 0 ? "+" : ""}${sell - buy}/ea)`);
}

// (b) Recipe economics: output shop value vs input cost (using bestSell for
// outputs the player can fence, bestBuy for inputs they could just purchase).
const craftProfit = [];
for (const r of Object.values(RECIPES)) {
  let outVal = 0;
  for (const o of r.outputs ?? []) outVal += (bestSell[o.itemId] ?? 0) * o.qty;
  const succ = Math.min(r.successMax ?? 1, (r.successBase ?? 1) + 10 * (r.successPerLevel ?? 0));
  outVal *= succ;
  let inCost = 0, purchasable = true;
  for (const inp of r.inputs ?? []) {
    const c = bestBuy[inp.itemId];
    if (c === undefined) { purchasable = false; break; }
    inCost += c * inp.qty;
  }
  if (purchasable && outVal > inCost && outVal - inCost > 5) {
    craftProfit.push(`${r.id}: buy inputs ${inCost} -> craft -> sell ${outVal} (+${outVal - inCost})`);
  }
}

// (c) Enemy loot near spawn: high shop-value drops from low-tier enemies.
const richDrops = [];
for (const e of Object.values(ENEMIES)) {
  for (const d of e.loot ?? []) {
    const v = bestSell[d.itemId] ?? 0;
    const ev = v * (d.chance ?? 1) * ((d.qtyMin ?? d.min ?? 1) + (d.qtyMax ?? d.max ?? 1)) / 2;
    if (ev > 40 && (e.level ?? 1) <= 5) richDrops.push(`${e.id} (lvl ${e.level}): ${d.itemId} EV ${Math.round(ev)}/kill`);
  }
}

// (d) XP sanity: xp-per-action spread across gathering nodes by level band.
const nodeXp = [];
for (const n of Object.values(NODES)) {
  if (!n.skillId || !n.xpPerCycle) continue;
  nodeXp.push({ skill: n.skillId, level: n.requiredLevel ?? n.levelRequired ?? 1, xp: n.xpPerCycle, id: n.id });
}
const bySkill = {};
for (const n of nodeXp) (bySkill[n.skill] ??= []).push(n);
const xpNotes = [];
for (const [skill, arr] of Object.entries(bySkill)) {
  arr.sort((a, b) => a.level - b.level);
  const low = arr.filter((n) => n.level <= 10);
  const highLowXp = low.filter((n) => n.xp > 3 * Math.min(...low.map((m) => m.xp)));
  for (const n of highLowXp) xpNotes.push(`${skill}: ${n.id} lvl ${n.level} gives ${n.xp}xp (low-band outlier)`);
}

console.log(JSON.stringify({ loops, craftProfit: craftProfit.slice(0, 15), richDrops: richDrops.slice(0, 15), xpNotes: xpNotes.slice(0, 15) }, null, 1));

// Sanity: how much data did each check actually see, and the nearest misses?
const margins = [];
for (const [id, buy] of Object.entries(bestBuy)) {
  const sell = bestSell[id];
  if (sell !== undefined) margins.push([id, buy, sell, sell - buy]);
}
margins.sort((a, b) => b[3] - a[3]);
let purchasableRecipes = 0;
for (const r of Object.values(RECIPES)) {
  if ((r.inputs ?? []).every((i) => bestBuy[i.itemId] !== undefined)) purchasableRecipes++;
}
console.log(JSON.stringify({
  itemsSold: Object.keys(bestBuy).length,
  itemsBought: Object.keys(bestSell).length,
  overlap: margins.length,
  worstMargins: margins.slice(0, 5),
  purchasableRecipes,
  totalRecipes: Object.keys(RECIPES).length,
  enemies: Object.keys(ENEMIES).length,
}, null, 1));
