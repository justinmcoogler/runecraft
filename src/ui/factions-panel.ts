// Factions panel: your renown and rank with each great faction, with a bar to
// the next rank. Toggle with `G`. Pure presentation over sim.reputation.

import { FACTIONS, REP_RANKS, type GameSimulation } from "../sim/simulation";

export class FactionsPanel {
  private panel: HTMLElement;
  private list: HTMLElement;
  private open = false;

  constructor(hudRoot: HTMLElement, private getSim: () => GameSimulation) {
    this.injectStyles();
    this.panel = document.createElement("div");
    this.panel.className = "fac-panel";
    this.panel.style.display = "none";
    const bar = document.createElement("div");
    bar.className = "fac-bar";
    const title = document.createElement("span");
    title.textContent = "Standing";
    const close = document.createElement("button");
    close.className = "fac-x";
    close.textContent = "✕";
    close.addEventListener("click", () => this.setOpen(false));
    bar.append(title, close);
    this.list = document.createElement("div");
    this.list.className = "fac-list";
    this.panel.append(bar, this.list);
    hudRoot.append(this.panel);

    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyG" && !e.repeat && !this.typing(e)) this.setOpen(!this.open);
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
    for (const id of Object.keys(FACTIONS)) {
      const fac = FACTIONS[id];
      const standing = Math.round(sim.reputation[id] ?? 0);
      const rank = sim.factionRank(id);
      const rankName = REP_RANKS[rank].name;
      const next = REP_RANKS[rank + 1];
      // Fraction toward the next rank (full when at the top).
      const frac = next ? (standing - REP_RANKS[rank].at) / (next.at - REP_RANKS[rank].at) : 1;

      const row = document.createElement("div");
      row.className = "fac-row";
      const head = document.createElement("div");
      head.className = "fac-head";
      const name = document.createElement("span");
      name.className = "fac-name";
      name.textContent = fac.name;
      const rankEl = document.createElement("span");
      rankEl.className = "fac-rank";
      rankEl.textContent = rankName;
      head.append(name, rankEl);

      const blurb = document.createElement("div");
      blurb.className = "fac-blurb";
      blurb.textContent = fac.blurb;

      const track = document.createElement("div");
      track.className = "fac-track";
      const fill = document.createElement("div");
      fill.className = "fac-fill";
      fill.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
      track.append(fill);

      const meta = document.createElement("div");
      meta.className = "fac-meta";
      meta.textContent = next ? `${standing} · next: ${next.name} at ${next.at}` : `${standing} · max rank`;

      row.append(head, blurb, track, meta);
      this.list.append(row);
    }
  }

  private injectStyles(): void {
    if (document.getElementById("fac-styles")) return;
    const s = document.createElement("style");
    s.id = "fac-styles";
    s.textContent = `
      .fac-panel { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        width:300px; max-height:66vh; flex-direction:column; background:rgba(18,20,26,0.96);
        border:1px solid #3a4150; border-radius:8px; color:#e8eef4; font:16px/1.4 var(--font-body, "VT323", monospace);
        box-shadow:0 8px 32px rgba(0,0,0,0.5); z-index:40; overflow:hidden; }
      .fac-bar { display:flex; justify-content:space-between; align-items:center; padding:8px 12px;
        background:#232936; border-bottom:1px solid #3a4150; font-weight:600; }
      .fac-x { background:none; border:none; color:#9aa4b2; cursor:pointer; font-size:14px; }
      .fac-x:hover { color:#e8eef4; }
      .fac-list { overflow-y:auto; padding:8px; display:flex; flex-direction:column; gap:8px; }
      .fac-row { padding:8px 10px; background:#1c212b; border-radius:6px; display:flex; flex-direction:column; gap:5px; }
      .fac-head { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
      .fac-name { font-weight:600; }
      .fac-rank { color:#d9b45a; font-size:12px; font-weight:600; }
      .fac-blurb { color:#9aa4b2; font-size:11px; }
      .fac-track { height:6px; background:#2a3140; border-radius:3px; overflow:hidden; }
      .fac-fill { height:100%; background:linear-gradient(90deg,#4a8b4f,#8ecb6a); }
      .fac-meta { color:#7f8a99; font-size:11px; font-variant-numeric:tabular-nums; }
    `;
    document.head.append(s);
  }
}
