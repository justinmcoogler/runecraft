// The world map (M key or the Map button): the whole province drawn
// from its block grid onto a canvas, with zone names, road-visible terrain
// colors, and a live player marker. Pure presentation — reads sim state,
// changes nothing.

import { buildOverworld } from "../sim/worldgen/overworld";
import { QUESTS, ZONES } from "../content/content";
import type { GameSimulation } from "../sim/simulation";
import type { BlockType } from "../sim/world";
import { activeQuestTarget, giverCell } from "./quest-helper";

const BLOCK_COLORS: Record<BlockType, string> = {
  grass: "#4f8a3d",
  dirt: "#8a6a42",
  stone: "#7d7f82",
  sand: "#d8c793",
  water: "#3f6fb5",
  plank: "#a8834f",
  snow: "#e8eef3",
  ice: "#bcd9e8",
  mud: "#5d4a33",
  redsand: "#b5652f",
  mycelium: "#6d5f7a",
  drygrass: "#8a8a4a",
  stonebrick: "#6e6e72",
};

export class MapPanel {
  private panel: HTMLElement;
  private button: HTMLButtonElement;
  private canvas: HTMLCanvasElement;
  private open = false;
  private drawTimer: number | null = null;

  constructor(hudRoot: HTMLElement, private getSim: () => GameSimulation) {
    this.injectStyles();
    this.button = document.createElement("button");
    this.button.className = "map-toggle";
    this.button.innerHTML = `\u{1F5FA} <span class="tlabel">Map</span>`;
    this.button.addEventListener("click", () => this.setOpen(!this.open));

    this.panel = document.createElement("div");
    this.panel.className = "map-panel";
    this.panel.style.display = "none";
    const title = document.createElement("div");
    title.className = "map-title";
    title.textContent = "Runecraft";
    this.canvas = document.createElement("canvas");
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.canvas.className = "map-canvas";
    const hint = document.createElement("div");
    hint.className = "map-hint";
    hint.textContent = "M closes the map";
    this.panel.append(title, this.canvas, hint);
    (hudRoot.querySelector(".hud-bottom-left") ?? hudRoot).append(this.button);
    hudRoot.append(this.panel);

    window.addEventListener("keydown", (e) => {
      if (e.key === "m" || e.key === "M") this.setOpen(!this.open);
      else if (e.key === "Escape" && this.open) this.setOpen(false);
    });
  }

  private setOpen(open: boolean): void {
    // The map only makes sense outdoors on the world region.
    if (open && this.getSim().world.region.id !== "region.vale_clearing") return;
    this.open = open;
    this.panel.style.display = open ? "flex" : "none";
    this.button.classList.toggle("map-toggle-on", open);
    if (open) {
      this.draw();
      this.drawTimer = window.setInterval(() => this.draw(), 500);
    } else if (this.drawTimer !== null) {
      window.clearInterval(this.drawTimer);
      this.drawTimer = null;
    }
  }

  /** Terrain never changes at map scale — rendered once, then reused. */
  private baseLayer: HTMLCanvasElement | null = null;

  private renderBaseLayer(w: number, h: number, S: number): HTMLCanvasElement {
    const region = this.getSim().world.region;
    const base = document.createElement("canvas");
    base.width = w;
    base.height = h;
    const bctx = base.getContext("2d")!;
    const img = bctx.createImageData(w, h);
    for (let gz = 0; gz < h; gz++) {
      for (let gx = 0; gx < w; gx++) {
        const i = Math.min(region.heights.length - 1, (gz * S + (S >> 1)) * region.width + gx * S + (S >> 1));
        const hex = BLOCK_COLORS[region.blocks[i]] ?? "#4f8a3d";
        const n = parseInt(hex.slice(1), 16);
        // Higher ground reads lighter, water darker — cheap relief.
        const ht = region.heights[i];
        const lift = ht > 0 ? Math.min(0.45, ht * 0.02) : 0;
        const o = (gz * w + gx) * 4;
        img.data[o] = Math.min(255, ((n >> 16) & 255) * (1 + lift));
        img.data[o + 1] = Math.min(255, ((n >> 8) & 255) * (1 + lift));
        img.data[o + 2] = Math.min(255, (n & 255) * (1 + lift));
        img.data[o + 3] = 255;
      }
    }
    bctx.putImageData(img, 0, 0);

    // Roads inked over the terrain so routes read at map scale.
    const { roads } = buildOverworld();
    bctx.strokeStyle = "rgba(122, 90, 52, 0.9)";
    bctx.lineWidth = 1.5;
    for (const road of roads) {
      bctx.beginPath();
      for (let k = 0; k < road.centerline.length; k += 4) {
        const [x, z] = road.centerline[k];
        if (k === 0) bctx.moveTo(x / S, z / S);
        else bctx.lineTo(x / S, z / S);
      }
      bctx.stroke();
    }
    return base;
  }

  private draw(): void {
    const sim = this.getSim();
    const region = sim.world.region;
    const ctx = this.canvas.getContext("2d");
    if (!ctx || region.id !== "region.vale_clearing") return;

    // Downsample the province (one pixel per S cells). S=3 keeps hamlets,
    // rivers and roads legible at ~830px.
    const S = Math.max(1, Math.ceil(region.width / 840));
    const w = Math.floor(region.width / S);
    const h = Math.floor(region.depth / S);
    if (this.canvas.width !== w) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.baseLayer = null;
    }
    if (!this.baseLayer) this.baseLayer = this.renderBaseLayer(w, h, S);
    ctx.drawImage(this.baseLayer, 0, 0);

    const { pois } = buildOverworld();
    // Landmarks first (small), then dungeons and settlements on top.
    for (const p of pois) {
      if (p.kind === "landmark") {
        ctx.fillStyle = "rgba(240, 220, 140, 0.9)";
        ctx.fillRect(p.x / S - 1, p.z / S - 1, 3, 3);
      }
    }
    for (const p of pois) {
      if (p.kind === "dungeon") {
        ctx.fillStyle = "#10151b";
        ctx.fillRect(p.x / S - 3, p.z / S - 3, 7, 7);
        ctx.fillStyle = "#e0483f";
        ctx.fillRect(p.x / S - 2, p.z / S - 2, 5, 5);
      } else if (p.kind === "settlement") {
        ctx.fillStyle = "#10151b";
        ctx.fillRect(p.x / S - 3, p.z / S - 3, 7, 7);
        ctx.fillStyle = "#f6f2e4";
        ctx.fillRect(p.x / S - 2, p.z / S - 2, 5, 5);
      }
    }

    // Quest markers: ! where a quest waits, ? where one can be turned in,
    // ◆ on the active objective.
    ctx.textAlign = "center";
    ctx.font = '10px "Press Start 2P", monospace';
    for (const questId of Object.keys(QUESTS)) {
      const status = sim.quests.states[questId]?.status;
      const cell = giverCell(questId);
      if (!cell) continue;
      if (status === "available" && sim.quests.isAvailable(questId)) {
        ctx.fillStyle = "#10151b";
        ctx.fillText("!", cell.x / S + 1, cell.z / S - 4);
        ctx.fillStyle = "#ffd166";
        ctx.fillText("!", cell.x / S, cell.z / S - 5);
      } else if (status === "active" && sim.quests.markFor(QUESTS[questId].giverNpcId) === "ready") {
        ctx.fillStyle = "#10151b";
        ctx.fillText("?", cell.x / S + 1, cell.z / S - 4);
        ctx.fillStyle = "#7cc243";
        ctx.fillText("?", cell.x / S, cell.z / S - 5);
      }
    }
    const target = activeQuestTarget(sim);
    if (target?.overworld) {
      ctx.fillStyle = "#10151b";
      ctx.fillText("◆", target.cell.x / S + 1, target.cell.z / S - 4);
      ctx.fillStyle = "#ffd166";
      ctx.fillText("◆", target.cell.x / S, target.cell.z / S - 5);
    }

    // Region names in pixel type, outlined for contrast.
    ctx.font = '9px "Press Start 2P", monospace';
    for (const zone of ZONES) {
      if (zone.id === "zone.greenvale.town" || zone.id === "zone.willowmere" || zone.id === "zone.ironroot") continue;
      const cx = (zone.x0 + zone.x1) / 2 / S;
      const cz = (zone.z0 + zone.z1) / 2 / S;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(10, 14, 18, 0.85)";
      ctx.strokeText(zone.name, cx, cz);
      ctx.fillStyle = "#f2e9c9";
      ctx.fillText(zone.name, cx, cz);
    }

    // The player: a pulsing ring around a bright dot.
    const cell = sim.movement.currentCell();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cell.x / S, cell.z / S, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cell.x / S, cell.z / S, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  private injectStyles(): void {
    if (document.getElementById("map-styles")) return;
    const style = document.createElement("style");
    style.id = "map-styles";
    style.textContent = `
      .map-toggle {
        background: #1d232b; color: #cfd8e3; border: 2px solid #3c4654;
        border-radius: 8px; padding: 8px 12px; font: inherit; cursor: pointer;
        pointer-events: auto;
      }
      .map-toggle-on { background: #27384d; border-color: #5d86b5; color: #e2eefc; }
      .map-panel {
        position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
        z-index: 40; display: flex; flex-direction: column; gap: 8px;
        background: rgba(16, 20, 26, 0.96); border: 2px solid #3c4654;
        border-radius: 12px; padding: 14px; pointer-events: auto;
        max-width: min(94vw, 760px);
      }
      .map-title { font-weight: bold; color: #e8eef6; text-align: center; }
      .map-canvas {
        width: min(88vw, min(84vh, 700px)); height: min(88vw, min(84vh, 700px));
        image-rendering: pixelated; border-radius: 6px; border: 1px solid #333d49;
      }
      .map-hint { color: #71818f; font-size: 11px; text-align: center; }
    `;
    document.head.append(style);
  }
}
