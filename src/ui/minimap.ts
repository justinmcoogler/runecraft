// Always-on minimap for the open world (tutorial vale + endless wild). Samples
// terrainAt around the player and paints a small top-down map with a player dot
// and the active quest marker. Click it to enlarge to a full map; click a spot
// on that map to walk there, zoom with the +/− buttons or the mouse wheel, and
// drop 📍 markers to remember places. The wild map only paints ground you have
// actually explored — everything else stays parchment-dark.

import { terrainAt } from "../sim/worldgen/endless";
import type { GameSimulation } from "../sim/simulation";
import { activeQuestTarget } from "./quest-helper";
import { uiIconHtml } from "./icons";

// A compact terrain palette keyed by surface block (fallback mid-grey).
const BLOCK_COLORS: Record<string, string> = {
  water: "#2a5a86", ice: "#bfe0ec", snow: "#e8eef4", sand: "#d9c98a", redsand: "#b06a44",
  grass: "#5f9a48", drygrass: "#9aa45a", dirt: "#7a5a3a", coarsedirt: "#6a4f34", podzol: "#4a3826",
  stone: "#7f8489", andesite: "#8a8f93", calcite: "#dce3e6", gravel: "#8a8d90", cobblestone: "#71767b",
  stonebrick: "#7a7f84", basalt: "#3a3a40", blackstone: "#2a2730", deepslate: "#40444c",
  moss: "#5a8a48", mycelium: "#8a6f9f", mud: "#5a4a38", clay: "#9a9aa0", terracotta: "#a5643f",
  plank: "#9a7a4a", bridge: "#9a7a4a", gatearch: "#8a8f94", farmland: "#6a4a30",
};

const UNEXPLORED = "#191c23";

interface Marker { x: number; z: number }

export class MiniMap {
  private root: HTMLElement;
  private mini: HTMLCanvasElement;
  private expanded: HTMLElement;
  private big: HTMLCanvasElement;
  private title: HTMLSpanElement;
  private markerBtn: HTMLButtonElement;
  private open = false;
  private timer: number | null = null;
  /** Big-map zoom: world cells per canvas sample. Smaller = closer. */
  private zoom = 3.2;
  private markerMode = false;
  private markers: Marker[] = [];
  private markersSeed: number | null = null;

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
    this.title = document.createElement("span");
    this.title.textContent = "Map — click a spot to travel there";
    const tools = document.createElement("div");
    tools.className = "mm-tools";
    const zoomIn = document.createElement("button");
    zoomIn.className = "mm-tool";
    zoomIn.textContent = "＋";
    zoomIn.title = "Zoom in";
    zoomIn.addEventListener("click", (e) => { e.stopPropagation(); this.setZoom(this.zoom / 1.45); });
    const zoomOut = document.createElement("button");
    zoomOut.className = "mm-tool";
    zoomOut.textContent = "－";
    zoomOut.title = "Zoom out";
    zoomOut.addEventListener("click", (e) => { e.stopPropagation(); this.setZoom(this.zoom * 1.45); });
    this.markerBtn = document.createElement("button");
    this.markerBtn.className = "mm-tool";
    this.markerBtn.innerHTML = uiIconHtml("pin", 14);
    this.markerBtn.title = "Marker mode: click the map to drop or remove a marker";
    this.markerBtn.addEventListener("click", (e) => { e.stopPropagation(); this.setMarkerMode(!this.markerMode); });
    const close = document.createElement("button");
    close.className = "mm-x";
    close.textContent = "✕";
    close.addEventListener("click", (e) => { e.stopPropagation(); this.setOpen(false); });
    tools.append(zoomIn, zoomOut, this.markerBtn, close);
    bar.append(this.title, tools);
    this.big = document.createElement("canvas");
    this.big.width = this.big.height = 560;
    this.big.className = "mm-big";
    this.big.addEventListener("click", (e) => this.clickBig(e));
    this.big.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.setZoom(e.deltaY > 0 ? this.zoom * 1.2 : this.zoom / 1.2);
    }, { passive: false });
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

  /** Surface maps: the endless wild and the finite tutorial island. Caves and
   *  dungeons have no surface, so the map shows an "underground" state instead. */
  private active(sim: GameSimulation): boolean {
    const id = sim.world.region.id;
    return id === "region.endless" || id === "region.tutorial";
  }

  // ---- user markers, persisted per world seed -------------------------------

  private loadMarkers(seed: number): void {
    if (this.markersSeed === seed) return;
    this.markersSeed = seed;
    try {
      this.markers = JSON.parse(localStorage.getItem(`runecraft.markers.${seed}`) ?? "[]");
    } catch {
      this.markers = [];
    }
  }

  private saveMarkers(): void {
    if (this.markersSeed === null) return;
    try {
      localStorage.setItem(`runecraft.markers.${this.markersSeed}`, JSON.stringify(this.markers));
    } catch { /* storage full — markers just won't persist */ }
  }

  private setMarkerMode(on: boolean): void {
    this.markerMode = on;
    this.markerBtn.classList.toggle("mm-tool-on", on);
    this.title.textContent = on
      ? "Marker mode — click to drop or remove a 📍"
      : "Map — click a spot to travel there";
  }

  private setZoom(z: number): void {
    this.zoom = Math.max(1.2, Math.min(10, z));
    if (this.open) this.draw(this.big, this.zoom, 3);
  }

  private setOpen(v: boolean): void {
    // No full map underground — there's no surface to enlarge.
    if (v && !this.active(this.getSim())) return;
    this.open = v;
    this.expanded.style.display = v ? "flex" : "none";
    if (!v) this.setMarkerMode(false);
    if (v) this.draw(this.big, this.zoom, 3);
  }

  private tick(): void {
    const sim = this.getSim();
    const on = this.active(sim);
    this.root.style.display = "block";
    this.root.classList.toggle("mm-underground", !on);
    if (!on) {
      if (this.open) this.setOpen(false);
      this.drawUnderground(this.mini);
      return;
    }
    this.loadMarkers(sim.seed);
    this.draw(this.mini, 1.1, 4);
    if (this.open) this.draw(this.big, this.zoom, 3);
  }

  /** A muted "you're underground" panel: dark stone with a downward chevron. */
  private drawUnderground(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = canvas.width;
    ctx.fillStyle = "#26242c";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#33313b";
    for (let i = 0; i < 60; i++) {
      const x = (i * 53) % s, y = (i * 97) % s;
      ctx.fillRect(x, y, 3, 3);
    }
    ctx.strokeStyle = "#8a8f98";
    ctx.lineWidth = Math.max(3, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(s * 0.34, s * 0.4);
    ctx.lineTo(s * 0.5, s * 0.58);
    ctx.lineTo(s * 0.66, s * 0.4);
    ctx.stroke();
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
    const region = sim.world.region;
    const finite = region.id === "region.tutorial";
    // Fog of war: the wild map paints only ground the player has explored.
    // (The tutorial island is small and guided — it stays fully visible.)
    const fog = !finite;
    for (let sy = 0; sy < n; sy++) {
      for (let sx = 0; sx < n; sx++) {
        const wx = Math.round(p.x + (sx - half) * step);
        const wz = Math.round(p.z + (sy - half) * step);
        if (fog && !sim.explored.has((wx >> 4) * 131072 + (wz >> 4))) {
          ctx.fillStyle = UNEXPLORED;
          ctx.fillRect(sx * px, sy * px, px, px);
          continue;
        }
        let block: string;
        let height: number;
        let water: boolean;
        if (finite) {
          if (wx < 0 || wz < 0 || wx >= region.width || wz >= region.depth) {
            ctx.fillStyle = "#12141a"; // off-island void
            ctx.fillRect(sx * px, sy * px, px, px);
            continue;
          }
          block = sim.world.blockAt({ x: wx, z: wz });
          height = sim.world.heightAt({ x: wx, z: wz });
          water = block === "water";
        } else {
          const t = terrainAt(seed, wx, wz);
          block = t.block;
          height = t.h;
          water = t.water;
        }
        let col = water ? BLOCK_COLORS.water : (BLOCK_COLORS[block] ?? "#6a6f74");
        if (!water) {
          const shade = Math.max(-0.18, Math.min(0.18, (height - 6) * 0.012));
          col = shadeHex(col, shade);
        }
        ctx.fillStyle = col;
        ctx.fillRect(sx * px, sy * px, px, px);
      }
    }
    // Overlay pins. Helpers translate world → canvas and clamp to the edge.
    const toCanvas = (cell: { x: number; z: number }, clamp: boolean) => {
      const gx = half + (cell.x - p.x) / step;
      const gy = half + (cell.z - p.z) / step;
      if (!clamp && (gx < 0 || gy < 0 || gx > n || gy > n)) return null;
      return { cx: Math.max(3, Math.min(n - 3, gx)) * px, cy: Math.max(3, Math.min(n - 3, gy)) * px };
    };
    // User markers: cyan pins (drawn un-clamped on the mini so they don't pile
    // at the edge; clamped on the big map so far ones still point the way).
    for (const m of this.markers) {
      const pos = toCanvas(m, canvas === this.big);
      if (!pos) continue;
      ctx.fillStyle = "#4fd8e8";
      ctx.strokeStyle = "#10151b";
      ctx.lineWidth = 1.5;
      const r = px * 1.8;
      ctx.beginPath();
      ctx.moveTo(pos.cx, pos.cy);
      ctx.lineTo(pos.cx - r * 0.7, pos.cy - r * 1.6);
      ctx.lineTo(pos.cx + r * 0.7, pos.cy - r * 1.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Buried-treasure hunt: a red ✕ marks the spot (persisted with the save,
    // so a reload never dead-ends the chain).
    if (sim.treasureHunt) {
      const pos = toCanvas(sim.treasureHunt, true);
      if (pos) {
        ctx.strokeStyle = "#e84f4f";
        ctx.lineWidth = Math.max(2, px * 0.8);
        const r = px * 1.8;
        ctx.beginPath();
        ctx.moveTo(pos.cx - r, pos.cy - r);
        ctx.lineTo(pos.cx + r, pos.cy + r);
        ctx.moveTo(pos.cx + r, pos.cy - r);
        ctx.lineTo(pos.cx - r, pos.cy + r);
        ctx.stroke();
      }
    }
    // Active quest marker (gold diamond), clamped to the map edge if off-range.
    const target = activeQuestTarget(sim);
    if (target) {
      const pos = toCanvas(target.cell, true)!;
      ctx.save();
      ctx.translate(pos.cx, pos.cy);
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
    const c = half * px;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#10151b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c, c, Math.max(2.5, px), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /** Big-map click → world cell at the current zoom. */
  private cellFromClick(e: MouseEvent): { x: number; z: number } {
    const sim = this.getSim();
    const rect = this.big.getBoundingClientRect();
    const px = 3;
    const size = this.big.width;
    const n = Math.floor(size / px);
    const half = n / 2;
    const mx = ((e.clientX - rect.left) / rect.width) * size;
    const my = ((e.clientY - rect.top) / rect.height) * size;
    const p = sim.movement.currentCell();
    return {
      x: Math.round(p.x + (mx / px - half) * this.zoom),
      z: Math.round(p.z + (my / px - half) * this.zoom),
    };
  }

  /** A click on the enlarged map: walk there — or in marker mode, toggle a 📍. */
  private clickBig(e: MouseEvent): void {
    const sim = this.getSim();
    if (!this.active(sim)) return;
    const cell = this.cellFromClick(e);
    if (this.markerMode) {
      // Clicking near an existing marker removes it; anywhere else drops one.
      const near = this.markers.findIndex((m) => Math.hypot(m.x - cell.x, m.z - cell.z) < this.zoom * 6);
      if (near >= 0) this.markers.splice(near, 1);
      else this.markers.push(cell);
      this.saveMarkers();
      this.draw(this.big, this.zoom, 3);
      return;
    }
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
      .mm-bar { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 10px;
        background:#232936; border-bottom:1px solid #3a4150; color:#e8eef4; font:15px/1.4 var(--font-body, "VT323", monospace); font-weight:600; }
      .mm-tools { display:flex; align-items:center; gap:4px; }
      .mm-tool { background:#2c3442; border:1px solid #3a4150; border-radius:6px; color:#c8d2de;
        cursor:pointer; font-size:15px; width:30px; height:28px; line-height:1; }
      .mm-tool:hover { border-color:#5a6472; color:#fff; }
      .mm-tool-on { background:#3d5a74; border-color:#5f8db4; color:#fff; }
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
