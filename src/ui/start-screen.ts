// The title / world-select screen shown before the world boots. Lets the
// player start a fresh world, continue a saved one, or (later) join a
// multiplayer world. Resolves with the chosen seed and whether it's fresh.

import "./start-screen.css";
import type { EndlessWorldInfo } from "../save/save";

export interface StartChoice {
  seed: number;
  fresh: boolean;
}

export interface StartScreenOptions {
  worlds: EndlessWorldInfo[];
  /** Delete a saved world; the screen refreshes its list afterwards. */
  onDelete: (seed: number) => void;
}

const MAX_SEED = 2147483647;

/** A fresh, well-spread pseudo-random seed (no Date in worldgen, but fine here). */
function randomSeed(): number {
  return (Math.floor(Math.random() * MAX_SEED) || 1) % MAX_SEED;
}

/** Coerce free-text into a valid seed: a number if given, else hashed from text. */
function seedFromText(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return randomSeed();
  if (/^-?\d+$/.test(trimmed)) return Math.abs(Number(trimmed)) % MAX_SEED || 1;
  let h = 2166136261;
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % MAX_SEED || 1;
}

function relativeDate(iso: string): string {
  if (!iso) return "";
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function showStartScreen(opts: StartScreenOptions): Promise<StartChoice> {
  return new Promise((resolve) => {
    let worlds = opts.worlds.slice();
    const root = document.createElement("div");
    root.className = "start-screen";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Runecraft — start");
    document.body.appendChild(root);

    const finish = (choice: StartChoice): void => {
      root.remove();
      resolve(choice);
    };

    const render = (view: "menu" | "new" | "continue"): void => {
      root.innerHTML = "";
      const panel = document.createElement("div");
      panel.className = "start-panel";
      root.appendChild(panel);

      const title = document.createElement("h1");
      title.className = "start-title";
      title.textContent = "Runecraft";
      const tag = document.createElement("p");
      tag.className = "start-tagline";
      tag.textContent = "a voxel skilling world";
      panel.append(title, tag);

      if (view === "menu") {
        const menu = document.createElement("div");
        menu.className = "start-menu";

        const newBtn = bigButton("New World", "Roll a fresh, endless world");
        newBtn.onclick = () => render("new");

        const contBtn = bigButton(
          "Continue",
          worlds.length ? `${worlds.length} saved world${worlds.length === 1 ? "" : "s"}` : "No saved worlds yet",
        );
        contBtn.disabled = worlds.length === 0;
        contBtn.onclick = () => render("continue");

        const mpBtn = bigButton("Multiplayer", "Coming soon");
        mpBtn.disabled = true;
        mpBtn.classList.add("soon");

        menu.append(newBtn, contBtn, mpBtn);
        panel.appendChild(menu);
        return;
      }

      if (view === "new") {
        const form = document.createElement("div");
        form.className = "start-form";
        const label = document.createElement("label");
        label.className = "start-label";
        label.textContent = "World seed";
        const input = document.createElement("input");
        input.className = "start-input";
        input.type = "text";
        input.placeholder = "leave blank for a random world";
        input.autocomplete = "off";
        const hint = document.createElement("p");
        hint.className = "start-hint";
        hint.textContent = "The same seed always grows the same world. Words work too.";
        form.append(label, input, hint);

        const row = document.createElement("div");
        row.className = "start-row";
        const back = smallButton("Back");
        back.onclick = () => render("menu");
        const create = smallButton("Create World");
        create.classList.add("primary");
        create.onclick = () => finish({ seed: seedFromText(input.value), fresh: true });
        input.onkeydown = (e) => {
          if (e.key === "Enter") create.click();
        };
        row.append(back, create);
        form.appendChild(row);
        panel.appendChild(form);
        input.focus();
        return;
      }

      // view === "continue": list saved worlds.
      const list = document.createElement("div");
      list.className = "start-list";
      if (worlds.length === 0) {
        const empty = document.createElement("p");
        empty.className = "start-hint";
        empty.textContent = "No saved worlds.";
        list.appendChild(empty);
      }
      for (const w of worlds) {
        const rowEl = document.createElement("div");
        rowEl.className = "start-world";
        const play = document.createElement("button");
        play.className = "start-world-play";
        play.innerHTML =
          `<span class="start-world-name">World #${w.seed}</span>` +
          `<span class="start-world-meta">Day ${w.day}${w.updatedUtc ? " · " + relativeDate(w.updatedUtc) : ""}</span>`;
        play.onclick = () => finish({ seed: w.seed, fresh: false });
        const del = document.createElement("button");
        del.className = "start-world-del";
        del.title = "Delete this world";
        del.setAttribute("aria-label", `Delete World #${w.seed}`);
        del.textContent = "✕";
        del.onclick = () => {
          if (!confirm(`Delete World #${w.seed}? This can't be undone.`)) return;
          opts.onDelete(w.seed);
          worlds = worlds.filter((x) => x.seed !== w.seed);
          render("continue");
        };
        rowEl.append(play, del);
        list.appendChild(rowEl);
      }
      panel.appendChild(list);

      const row = document.createElement("div");
      row.className = "start-row";
      const back = smallButton("Back");
      back.onclick = () => render("menu");
      row.appendChild(back);
      panel.appendChild(row);
    };

    render("menu");
  });
}

function bigButton(label: string, sub: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "start-big";
  btn.innerHTML = `<span class="start-big-label">${label}</span><span class="start-big-sub">${sub}</span>`;
  return btn;
}

function smallButton(label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "start-small";
  btn.textContent = label;
  return btn;
}
