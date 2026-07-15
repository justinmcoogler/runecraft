// Fast-travel panel for the endless world. Lists the landmarks the player has
// discovered (persisted waypoints) and jumps to any of them. Toggle with `T`.
// Pure presentation over sim.waypoints / sim.fastTravelTo.

import type { GameSimulation } from "../sim/simulation";

export class WaypointsPanel {
  private panel: HTMLElement;
  private list: HTMLElement;
  private open = false;

  constructor(hudRoot: HTMLElement, private getSim: () => GameSimulation) {
    this.injectStyles();
    this.panel = document.createElement("div");
    this.panel.className = "wp-panel";
    this.panel.style.display = "none";
    const bar = document.createElement("div");
    bar.className = "wp-bar";
    const title = document.createElement("span");
    title.textContent = "Fast Travel";
    const close = document.createElement("button");
    close.className = "wp-x";
    close.textContent = "✕";
    close.addEventListener("click", () => this.setOpen(false));
    bar.append(title, close);
    this.list = document.createElement("div");
    this.list.className = "wp-list";
    this.panel.append(bar, this.list);
    hudRoot.append(this.panel);

    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyT" && !e.repeat && !this.typing(e)) this.setOpen(!this.open);
      else if (e.code === "Escape" && this.open) this.setOpen(false);
    });
  }

  private typing(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  setOpen(v: boolean): void {
    this.open = v;
    this.panel.style.display = v ? "flex" : "none";
    if (v) this.render();
  }

  private render(): void {
    const sim = this.getSim();
    this.list.textContent = "";
    const inWild = sim.world.region.id === "region.endless";
    const points = [...sim.waypoints];
    if (points.length === 0) {
      const empty = document.createElement("div");
      empty.className = "wp-empty";
      empty.textContent = "No landmarks discovered yet. Explore the wild to find some.";
      this.list.append(empty);
      return;
    }
    const p = sim.movement.currentCell();
    // Nearest first.
    points.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    for (const w of points) {
      const row = document.createElement("div");
      row.className = "wp-row";
      const label = document.createElement("span");
      label.className = "wp-name";
      const dist = Math.round(Math.hypot(w.x - p.x, w.z - p.z));
      label.textContent = `${w.name} · ${dist} paces`;
      const go = document.createElement("button");
      go.className = "wp-go";
      go.textContent = "Travel";
      go.disabled = !inWild;
      go.title = inWild ? "" : "Return to the open world to fast-travel.";
      go.addEventListener("click", () => {
        if (sim.fastTravelTo(w.id)) this.setOpen(false);
      });
      row.append(label, go);
      this.list.append(row);
    }
    if (!inWild) {
      const note = document.createElement("div");
      note.className = "wp-empty";
      note.textContent = "Fast travel is only available out in the open world.";
      this.list.append(note);
    }
  }

  private injectStyles(): void {
    if (document.getElementById("wp-styles")) return;
    const s = document.createElement("style");
    s.id = "wp-styles";
    s.textContent = `
      .wp-panel { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        width:280px; max-height:60vh; flex-direction:column; background:rgba(18,20,26,0.96);
        border:1px solid #3a4150; border-radius:8px; color:#e8eef4; font:13px/1.4 system-ui,sans-serif;
        box-shadow:0 8px 32px rgba(0,0,0,0.5); z-index:40; overflow:hidden; }
      .wp-bar { display:flex; justify-content:space-between; align-items:center; padding:8px 12px;
        background:#232936; border-bottom:1px solid #3a4150; font-weight:600; }
      .wp-x { background:none; border:none; color:#9aa4b2; cursor:pointer; font-size:14px; }
      .wp-x:hover { color:#e8eef4; }
      .wp-list { overflow-y:auto; padding:6px; display:flex; flex-direction:column; gap:4px; }
      .wp-row { display:flex; justify-content:space-between; align-items:center; gap:8px;
        padding:6px 8px; background:#1c212b; border-radius:5px; }
      .wp-name { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .wp-go { background:#3a6b3f; border:none; color:#e8f4e8; padding:4px 10px; border-radius:4px;
        cursor:pointer; font-size:12px; }
      .wp-go:hover:not(:disabled) { background:#4a8b4f; }
      .wp-go:disabled { background:#31363f; color:#6a7180; cursor:default; }
      .wp-empty { padding:10px 12px; color:#9aa4b2; font-size:12px; text-align:center; }
    `;
    document.head.append(s);
  }
}
