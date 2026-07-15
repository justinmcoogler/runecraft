// Endless-world debug overlay. Samples terrainAt / danger around the player and
// paints a color-coded minimap — biome, elevation, danger, or water+roads —
// with chunk borders and streamed POI markers. Toggle with `~` (Backquote),
// cycle modes with the on-panel button or `[`/`]`. Pure presentation.

import { ECHUNK, remoteness01, roadDist, terrainAt } from "../sim/worldgen/endless";
import type { GameSimulation } from "../sim/simulation";

type Mode = "biome" | "height" | "danger" | "features";
const MODES: Mode[] = ["biome", "height", "danger", "features"];

// A distinct-ish hue per biome id (0..25).
const BIOME_COLORS = [
  "#6db24a", "#3f7a34", "#2f5f3a", "#d9c063", "#4a6b4a", "#e8eef4", "#b3a55a", "#2f8a3a",
  "#8fbf5f", "#26401f", "#7fbf6a", "#9a7fb0", "#7a7f5a", "#3f6a44", "#5a7f8a", "#c98a4a",
  "#5a4658", "#4a5a30", "#8a6f9f", "#a0c8d8", "#4a5f4a", "#c86a4a", "#6a8a9a", "#c0a86a",
  "#7a9f6a", "#57e0a0",
];

export class DebugMap {
  private canvas: HTMLCanvasElement;
  private panel: HTMLElement;
  private open = false;
  private mode: Mode = "biome";
  private timer: number | null = null;
  private readonly R = 64; // cells sampled each way from the player
  private readonly PX = 3; // pixels per sampled cell (step 2 → 96px * ... )
  private readonly STEP = 2;

  constructor(hudRoot: HTMLElement, private getSim: () => GameSimulation) {
    this.injectStyles();
    this.panel = document.createElement("div");
    this.panel.className = "dbg-panel";
    this.panel.style.display = "none";
    const bar = document.createElement("div");
    bar.className = "dbg-bar";
    const label = document.createElement("span");
    label.className = "dbg-mode";
    const cycle = document.createElement("button");
    cycle.className = "dbg-btn";
    cycle.textContent = "mode ▸";
    cycle.addEventListener("click", () => this.setMode(1));
    bar.append(label, cycle);
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = this.R * 2 * this.PX / this.STEP;
    this.canvas.className = "dbg-canvas";
    const legend = document.createElement("div");
    legend.className = "dbg-legend";
    this.panel.append(bar, this.canvas, legend);
    hudRoot.append(this.panel);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Backquote") this.setOpen(!this.open);
      else if (this.open && (e.key === "[" || e.key === "]")) this.setMode(e.key === "]" ? 1 : -1);
    });
  }

  private setMode(delta: number): void {
    const i = (MODES.indexOf(this.mode) + delta + MODES.length) % MODES.length;
    this.mode = MODES[i];
    this.draw();
  }

  private setOpen(open: boolean): void {
    if (open && this.getSim().world.region.id !== "region.endless") return;
    this.open = open;
    this.panel.style.display = open ? "flex" : "none";
    if (open) {
      this.draw();
      this.timer = window.setInterval(() => this.draw(), 400);
    } else if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private draw(): void {
    const sim = this.getSim();
    if (sim.world.region.id !== "region.endless") { this.setOpen(false); return; }
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const seed = sim.seed;
    const p = sim.movement.currentCell();
    const size = this.canvas.width;
    const img = ctx.createImageData(size, size);
    const put = (px: number, py: number, hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      for (let dy = 0; dy < this.PX; dy++) {
        for (let dx = 0; dx < this.PX; dx++) {
          const o = ((py * this.PX + dy) * size + (px * this.PX + dx)) * 4;
          img.data[o] = (n >> 16) & 255; img.data[o + 1] = (n >> 8) & 255; img.data[o + 2] = n & 255; img.data[o + 3] = 255;
        }
      }
    };
    const cells = (this.R * 2) / this.STEP;
    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const wx = p.x - this.R + gx * this.STEP;
        const wz = p.z - this.R + gy * this.STEP;
        const s = terrainAt(seed, wx, wz);
        let hex = "#000000";
        if (this.mode === "biome") hex = s.water ? "#25507f" : (BIOME_COLORS[s.biome] ?? "#808080");
        else if (this.mode === "height") { const v = Math.max(0, Math.min(255, s.water ? 40 : 60 + s.h * 4)); hex = `#${((v << 16) | (v << 8) | v).toString(16).padStart(6, "0")}`; }
        else if (this.mode === "danger") { const r = remoteness01(wx, wz); const rr = Math.round(60 + r * 195), gg = Math.round(200 - r * 180); hex = `#${((rr << 16) | (gg << 8) | 60).toString(16).padStart(6, "0")}`; }
        else { hex = s.water ? "#2f6fbf" : roadDist(seed, wx, wz) < 2 ? "#8a6a3a" : s.h > 44 ? "#c8c8d0" : "#3f6a3a"; }
        // Chunk borders inked faint.
        if (((wx % ECHUNK) + ECHUNK) % ECHUNK < this.STEP || ((wz % ECHUNK) + ECHUNK) % ECHUNK < this.STEP) hex = "#1b1f26";
        put(gx, gy, hex);
      }
    }
    ctx.putImageData(img, 0, 0);
    // Streamed POI markers + player.
    const toPx = (wx: number, wz: number) => [((wx - (p.x - this.R)) / this.STEP) * this.PX, ((wz - (p.z - this.R)) / this.STEP) * this.PX] as const;
    for (const o of sim.world.region.objects) {
      let col: string | null = null;
      if (o.defId.includes("portal.cave")) col = "#e0483f"; // dungeon
      else if (o.defId.includes("signpost")) col = "#d8c060"; // road junction
      if (!col) continue;
      const [mx, my] = toPx(o.cell.x, o.cell.z);
      if (mx < 0 || my < 0 || mx > size || my > size) continue;
      ctx.fillStyle = col; ctx.fillRect(mx - 2, my - 2, 5, 5);
    }
    ctx.fillStyle = "#ffffff"; ctx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4);
    ctx.strokeStyle = "#ffdc55"; ctx.strokeRect(size / 2 - 3, size / 2 - 3, 6, 6);

    (this.panel.querySelector(".dbg-mode") as HTMLElement).textContent =
      `debug: ${this.mode}  (danger ${(remoteness01(p.x, p.z) * 100 | 0)}%, biome ${terrainAt(seed, p.x, p.z).biome})`;
    (this.panel.querySelector(".dbg-legend") as HTMLElement).textContent =
      this.mode === "danger" ? "green = safe · red = deadly"
        : this.mode === "features" ? "blue water · brown roads · grey peaks · red dungeons"
          : this.mode === "height" ? "dark = low · light = high" : "colour = biome · blue = water";
  }

  private injectStyles(): void {
    if (document.getElementById("dbg-map-styles")) return;
    const s = document.createElement("style");
    s.id = "dbg-map-styles";
    s.textContent = `
      .dbg-panel { position:absolute; top:64px; right:12px; z-index:14; display:flex; flex-direction:column; gap:6px;
        background:rgba(16,20,26,0.92); border:1px solid #3c4654; border-radius:10px; padding:8px; color:#cfd8e3; }
      .dbg-bar { display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:12px; }
      .dbg-mode { font-weight:700; letter-spacing:0.02em; }
      .dbg-btn { background:#27384d; border:1px solid #5d86b5; color:#e2eefc; border-radius:6px; padding:2px 8px; cursor:pointer; font-size:11px; }
      .dbg-canvas { image-rendering:pixelated; border:1px solid #2a323c; border-radius:4px; }
      .dbg-legend { font-size:11px; color:#8a97a5; text-align:center; }
    `;
    document.head.append(s);
  }
}
