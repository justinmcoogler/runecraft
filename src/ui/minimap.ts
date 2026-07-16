// Always-on minimap for the open world (tutorial vale + endless wild). Samples
// terrainAt around the player and paints a small top-down map with a player dot
// and the active quest marker. Click it to enlarge to a full map; click a spot
// on that map to walk there.

import { terrainAt } from "../sim/worldgen/endless";
import type { GameSimulation } from "../sim/simulation";
import { activeQuestTarget } from "./quest-helper";

// A compact terrain palette keyed by surface block (fallback mid-grey).
const BLOCK_COLORS: Record<string, string> = {
  water: "#2a5a86", ice: "#bfe0ec", snow: "#e8eef4", sand: "#d9c98a", redsand: "#b06a44",
  grass: "#5f9a48", drygrass: "#9aa45a", dirt: "#7a5a3a", coarsedirt: "#6a4f34", podzol: "#4a3826",
  stone: "#7f8489", andesite: "#8a8f93", calcite: "#dce3e6", gravel: "#8a8d90", cobblestone: "#71767b",
  stonebrick: "#7a7f84", basalt: "#3a3a40", blackstone: "#2a2730", deepslate: "#40444c",
  moss: "#5a8a48", mycelium: "#8a6f9f", mud: "#5a4a38", clay: "#9a9aa0", terracotta: "#a5643f",
  plank: "#9a7a4a", bridge: "#9a7a4a", gatearch: "#8a8f94",
};

export class MiniMap {
  private root: HTMLElement;
  private mini: HTMLCanvasElement;
  private expanded: HTMLElement;
  private big: HTMLCanvasElement;
  private open = false;
  private timer: number | null = null;

  constructor(hudRoot: HTMLElement, private getSim: () => GameSimulation) {
    this.injectStyles();
    this.root = document.createElement("div");
    this.root.className = "mm-mini";
    this.root.title = "Click to enlarge the map";
    this.mini = document.createElement("canvas");
    this.mini.width = this.mini.height = 148;
    this.root.append(this.mini);
    this.root.addEventListener("click", () => this.setOpen(true));
    hudRoot.append(this.root);

    // Full-map overlay.
    this.expanded = document.createElement("div");
    this.expanded.className = "mm-overlay";
    this.expanded.style.display = "none";
    const panel = document.createElement("div");
    panel.className = "mm-panel";
    const bar = document.createElement("div");
    bar.className = "mm-bar";
    const title = document.createElement("span");
    title.textContent = "Map — click a spot to travel there";
    const close = document.createElement("button");
    close.className = "mm-x";
    close.textContent = "✕";
    close.addEventListener("click", (e) => { e.stopPropagation(); this.setOpen(false); });
    bar.append(title, close);
    this.big = document.createElement("canvas");
    this.big.width = this.big.height = 560;
    this.big.className = "mm-big";
    this.big.addEventListener("click", (e) => this.walkFromClick(e));
    panel.append(bar, this.big);
    this.expanded.append(panel);
    this.expanded.addEventListener("click", (e) => { if (e.target === this.expanded) this.setOpen(false); });
    hudRoot.append(this.expanded);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" && this.open) this.setOpen(false);
      else if (e.code === "KeyN" && !e.repeat && !this.typing(e)) this.setOpen(!this.open);
    });

    this.timer = window.setInterval(() => this.tick(), 300);
    this.tick();
  }

  private typing(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  /** Only meaningful in the open streamed world (tutorial vale + endless). */
  private active(sim: GameSimulation): boolean {
    return sim.world.region.id === "region.endless";
  }

  private setOpen(v: boolean): void {
    this.open = v;
    this.expanded.style.display = v ? "flex" : "none";
    if (v) this.draw(this.big, 3.2, 3);
  }

  private tick(): void {
    const sim = this.getSim();
    const on = this.active(sim);
    this.root.style.display = on ? "block" : "none";
    if (!on) { if (this.open) this.setOpen(false); return; }
    this.draw(this.mini, 1.1, 4);
    if (this.open) this.draw(this.big, 3.2, 3);
  }

  /** cellsPerSample × px controls the covered radius; bigger cellsPerSample =
   *  more world per pixel (the enlarged map zooms out). */
  private draw(canvas: HTMLCanvasElement, cellsPerSample: number, px: number): void {
    const sim = this.getSim();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const n = Math.floor(size / px); // samples per side
    const half = n / 2;
    const step = cellsPerSample;
    const p = sim.movement.currentCell();
    const seed = sim.seed;
    for (let sy = 0; sy < n; sy++) {
      for (let sx = 0; sx < n; sx++) {
        const wx = Math.round(p.x + (sx - half) * step);
        const wz = Math.round(p.z + (sy - half) * step);
        const t = terrainAt(seed, wx, wz);
        let col = t.water ? BLOCK_COLORS.water : (BLOCK_COLORS[t.block] ?? "#6a6f74");
        // Subtle height shading so relief reads.
        if (!t.water) {
          const shade = Math.max(-0.18, Math.min(0.18, (t.h - 6) * 0.012));
          col = shadeHex(col, shade);
        }
        ctx.fillStyle = col;
        ctx.fillRect(sx * px, sy * px, px, px);
      }
    }
    // Active quest marker (gold diamond), clamped to the map edge if off-range.
    const target = activeQuestTarget(sim);
    if (target) {
      const gx = half + (target.cell.x - p.x) / step;
      const gy = half + (target.cell.z - p.z) / step;
      const cx = Math.max(3, Math.min(n - 3, gx)) * px;
      const cy = Math.max(3, Math.min(n - 3, gy)) * px;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = "#ffd23f";
      ctx.strokeStyle = "#10151b";
      ctx.lineWidth = 1.5;
      const r = px * 2.4;
      ctx.fillRect(-r / 2, -r / 2, r, r);
      ctx.strokeRect(-r / 2, -r / 2, r, r);
      ctx.restore();
    }
    // Player dot at centre.
    const c = (half) * px;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#10151b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, Math.max(2.5, px), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /** A click on the enlarged map walks the player to that world cell. */
  private walkFromClick(e: MouseEvent): void {
    const sim = this.getSim();
    if (!this.active(sim)) return;
    const rect = this.big.getBoundingClientRect();
    const px = 3, cellsPerSample = 3.2;
    const size = this.big.width;
    const n = Math.floor(size / px);
    const half = n / 2;
    // Client point → canvas sample → world cell.
    const mx = ((e.clientX - rect.left) / rect.width) * size;
    const my = ((e.clientY - rect.top) / rect.height) * size;
    const sx = mx / px, sy = my / px;
    const p = sim.movement.currentCell();
    const cell = {
      x: Math.round(p.x + (sx - half) * cellsPerSample),
      z: Math.round(p.z + (sy - half) * cellsPerSample),
    };
    sim.enqueue({ type: "moveTo", cell });
    this.setOpen(false);
  }

  private injectStyles(): void {
    if (document.getElementById("mm-styles")) return;
    const s = document.createElement("style");
    s.id = "mm-styles";
    s.textContent = `
      .mm-mini { position:absolute; top:max(10px,env(safe-area-inset-top)); right:max(12px,env(safe-area-inset-right));
        width:calc(var(--mm-size,148px) + 8px); height:calc(var(--mm-size,148px) + 8px); padding:2px;
        background:rgba(18,20,26,0.85); border:2px solid #3a4150; border-radius:8px; cursor:pointer;
        box-shadow:0 3px 12px rgba(0,0,0,0.4); z-index:15; pointer-events:auto; }
      .mm-mini:hover { border-color:#5a6472; }
      .mm-mini canvas { display:block; width:var(--mm-size,148px); height:var(--mm-size,148px); border-radius:5px; image-rendering:pixelated; }
      .mm-overlay { position:absolute; inset:0; background:rgba(0,0,0,0.55); display:flex;
        align-items:center; justify-content:center; z-index:45; pointer-events:auto; }
      .mm-panel { display:flex; flex-direction:column; background:rgba(18,20,26,0.97);
        border:1px solid #3a4150; border-radius:10px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.6); }
      .mm-bar { display:flex; justify-content:space-between; align-items:center; padding:8px 12px;
        background:#232936; border-bottom:1px solid #3a4150; color:#e8eef4; font:16px/1.4 var(--font-body, "VT323", monospace); font-weight:600; }
      .mm-x { background:none; border:none; color:#9aa4b2; cursor:pointer; font-size:15px; }
      .mm-x:hover { color:#e8eef4; }
      .mm-big { display:block; cursor:crosshair; image-rendering:pixelated; width:min(84vw,84vh,560px); height:min(84vw,84vh,560px); }
    `;
    document.head.append(s);
  }
}

/** Lighten (t>0) or darken (t<0) a #rrggbb colour by fraction t. */
function shadeHex(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (t > 0 ? (255 - v) * t : v * t))));
  return `#${((f(r) << 16) | (f(g) << 8) | f(b)).toString(16).padStart(6, "0")}`;
}
