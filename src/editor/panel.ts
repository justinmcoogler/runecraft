// The in-game world editor: a palette of every imported structure (trees
// by species and size, buildings), a ghost preview that follows the mouse,
// click-to-place, a remove tool, and undo. Every edit applies to the live
// world immediately and persists locally — no export step.

import { getStructure, structureIds } from "../content/structures";
import type { EditorInputTarget } from "../input/input";
import type { GameRenderer, PickResult } from "../render/renderer";
import type { GameSimulation } from "../sim/simulation";
import type { Cell } from "../sim/types";
import { ENEMIES, NODES, OBJECTS } from "../content/content";
import { isModelEnabled, setModelEnabled } from "../render/model-prefs";
import {
  applyLayerToSim,
  emptyLayer,
  findEditableAt,
  isValidPlacement,
  parseLayer,
  treeDefForSpecies,
  type EditorEntityPlacement,
  type EditorLayer,
  type EditorStructurePlacement,
  type EditorTreePlacement,
} from "./layer";

/** Dev mode unlocks owner-only tooling (the world editor with its
 *  delete-asset-from-game switch). Playtesters never see it: enable with
 *  ?dev in the URL, or localStorage.setItem("runecraft.dev", "1"). */
export function isDevMode(): boolean {
  try {
    if (/[?&#]dev(?:[=&#]|$)/.test(window.location.search + window.location.hash)) return true;
    return window.localStorage.getItem("runecraft.dev") === "1";
  } catch {
    return false;
  }
}

interface PaletteEntry {
  label: string;
  kind: "tree" | "structure" | "node" | "object" | "enemy";
  /** Candidate structure/def ids; a random one is drawn per placement. */
  pool: string[];
}

/** One reversible edit; the stack lives in memory for the session. */
type EditAction =
  | { op: "place-tree"; placement: EditorTreePlacement }
  | { op: "place-structure"; placement: EditorStructurePlacement }
  | { op: "remove-tree"; placement: EditorTreePlacement; authored: boolean }
  | { op: "remove-structure"; placement: EditorStructurePlacement; authored: boolean }
  | { op: "place-entity"; kind: "node" | "object" | "enemy"; placement: EditorEntityPlacement }
  | { op: "remove-entity"; kind: "node" | "object" | "enemy"; placement: EditorEntityPlacement; authored: boolean };

interface EditorDeps {
  hudRoot: HTMLElement;
  renderer: GameRenderer;
  getSim: () => GameSimulation;
  loadLayer: () => EditorLayer;
  saveLayer: (layer: EditorLayer) => void;
  toast: (message: string) => void;
}

/** Regions the editor may reshape: the authored vale and any endless world. */
const EDITABLE_REGIONS = new Set(["region.vale_clearing", "region.endless"]);

const SPECIES_LABELS: Record<string, string> = {
  oak: "Oak", spruce: "Spruce", birch: "Birch", jungle: "Jungle",
  acacia: "Acacia", dark_oak: "Dark Oak", blossom: "Blossom",
  ember: "Ember", glow: "Lanternwood", dusk: "Duskglass",
};

// Friendly names for the common defs; anything not listed is prettified from
// its id, so newly added content shows up in the editor without a code change.
const DEF_LABELS: Record<string, string> = {
  "resource.tree.basic": "Wild Oak", "resource.tree.birch": "Wild Birch",
  "resource.tree.spruce": "Wild Spruce", "resource.tree.jungle": "Wild Jungle",
  "resource.tree.acacia": "Wild Acacia", "resource.tree.darkoak": "Wild Dark Oak",
  "resource.rock.tin": "Tin Rock", "resource.rock.copper": "Copper Rock",
  "resource.rock.coal": "Coal Rock", "resource.rock.iron": "Iron Rock",
  "resource.rock.gold": "Gold Rock", "resource.rock.diamond": "Diamond Rock",
  "resource.rock.redstone": "Redstone Rock", "resource.rock.lapis": "Lapis Rock",
  "resource.rock.emerald": "Emerald Rock", "resource.rock.quartz": "Quartz Rock",
  "resource.rock.essence": "Rune Essence", "resource.rock.netherite": "Netherite Rock",
  "resource.bush.berry": "Berry Bush", "resource.digsite.basic": "Dig Site",
  "resource.digsite.old": "Old Dig Site", "resource.strongbox.old": "Old Strongbox",
  "resource.trail.rabbit": "Rabbit Trail", "resource.trail.moor": "Moor Trail",
  "resource.stall.market": "Market Stall",
  "resource.fishing.pond": "Pond Fishing", "resource.fishing.river": "River Fishing",
  "resource.fishing.sea": "Sea Fishing", "resource.fishing.marsh": "Marsh Fishing",
  "resource.fishing.ice": "Ice Fishing", "resource.fishing.deep": "Deep Fishing",
  "object.storage_chest.basic": "Storage Chest", "object.campfire.basic": "Campfire",
  "object.furnace.basic": "Furnace", "object.anvil.basic": "Anvil",
  "object.workbench.basic": "Workbench", "object.cauldron.basic": "Cauldron",
  "object.enchanter.basic": "Enchanter", "object.altar.rune": "Rune Altar",
  "object.obelisk.summon": "Summoning Obelisk", "object.well.basic": "Well",
  "object.bed.basic": "Bed", "object.table.basic": "Table", "object.bench.wood": "Bench",
  "object.lamp.post": "Lamp Post", "object.crate.wood": "Crate", "object.barrel.wood": "Barrel",
  "object.fence.wood": "Fence", "object.signpost": "Signpost", "object.banner.red": "Banner",
  "object.reeds.water": "Water Reeds", "object.boulder.stone": "Boulder",
  "object.spire.small": "Small Spire", "object.spire.large": "Large Spire",
  "object.stairs.down": "Stairs Down", "object.stairs.up": "Stairs Up",
  "object.store.basic": "General Store", "object.counter.shop": "Shop Counter",
  "object.portal.cave": "Cave Portal", "object.portal.exit": "Exit Portal",
  "object.keep.grand": "Grand Keep",
};
const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
/** A readable label from a def id: drop the domain prefix, title-case the rest. */
function prettyDef(id: string): string {
  return id.split(".").slice(1).map((s) => s.split("_").map(titleCase).join(" ")).join(" ");
}
function labelFor(id: string): string {
  return DEF_LABELS[id] ?? prettyDef(id);
}
/** The short label a drill-down variant button shows (the id minus its domain). */
function variantLabel(id: string): string {
  return id.split(".").slice(1).join(".") || id;
}

export class WorldEditor implements EditorInputTarget {
  private active = false;
  private selected: PaletteEntry | null = null;
  private pendingStructureId: string | null = null;
  /** When set, a specific variant chosen from a group's drill-down: placements
   *  keep using this exact id instead of drawing a fresh random one. */
  private lockedId: string | null = null;
  private removeMode = false;
  private hoverCell: Cell | null = null;
  private layer: EditorLayer;
  private undoStack: EditAction[] = [];
  private undoButton!: HTMLButtonElement;
  private panel: HTMLElement;
  private banner: HTMLElement;
  private toggleButton: HTMLButtonElement;

  constructor(private deps: EditorDeps) {
    this.layer = deps.loadLayer();
    this.injectStyles();
    this.toggleButton = document.createElement("button");
    this.toggleButton.className = "editor-toggle";
    this.toggleButton.innerHTML = `\u{1F9F1} <span class="tlabel">Edit</span>`;
    this.toggleButton.addEventListener("click", () => this.setActive(!this.active));
    this.banner = document.createElement("div");
    this.banner.className = "editor-banner";
    this.banner.style.display = "none";
    this.panel = document.createElement("div");
    this.panel.className = "editor-panel";
    this.panel.style.display = "none";
    this.buildPanel();
    // The world editor (including the delete-asset-from-game tool) is a dev
    // tool: its toggle only appears in dev mode, so playtesters can't reach
    // it. Turn it on with ?dev in the URL, or from the console with
    // localStorage.setItem("runecraft.dev", "1") and a refresh.
    if (isDevMode()) {
      (deps.hudRoot.querySelector(".settings-actions") ?? deps.hudRoot).append(this.toggleButton);
    }
    deps.hudRoot.append(this.banner, this.panel);
  }

  private injectStyles(): void {
    if (document.getElementById("editor-styles")) return;
    const style = document.createElement("style");
    style.id = "editor-styles";
    style.textContent = `
      .editor-toggle {
        background: #1d232b; color: #cfd8e3; border: 2px solid #3c4654;
        border-radius: 8px; padding: 8px 12px; font: inherit; cursor: pointer;
        pointer-events: auto;
      }
      .editor-toggle-on { background: #2c4a2f; border-color: #5f9e63; color: #dff3de; }
      .editor-banner {
        position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
        z-index: 30; background: rgba(20, 26, 33, 0.92); color: #ffd166;
        border: 1px solid #3c4654; border-radius: 8px; padding: 6px 14px;
        pointer-events: none; white-space: nowrap;
      }
      .editor-panel {
        position: absolute; left: 12px; top: 60px; bottom: 64px; width: 240px;
        z-index: 30; display: flex; flex-direction: column; gap: 8px;
        background: rgba(20, 26, 33, 0.94); border: 2px solid #3c4654;
        border-radius: 10px; padding: 10px; pointer-events: auto;
      }
      .editor-title { font-weight: bold; color: #e8eef6; }
      .editor-tools button, .editor-footer button {
        background: #262e38; color: #cfd8e3; border: 1px solid #3c4654;
        border-radius: 6px; padding: 6px 8px; font: inherit; cursor: pointer;
      }
      .editor-footer button:disabled { opacity: 0.45; cursor: default; }
      .editor-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 3px; }
      .editor-group { color: #8fa3b8; margin-top: 6px; font-size: 12px; text-transform: uppercase; }
      .editor-entry {
        text-align: left; background: #232a33; color: #d7e0ea;
        border: 1px solid #333d49; border-radius: 6px; padding: 6px 8px;
        font: inherit; cursor: pointer;
      }
      .editor-entry:hover { border-color: #5b6b7e; }
      .editor-entry-on { background: #2c4a2f !important; border-color: #5f9e63 !important; }
      .editor-row { display: flex; gap: 3px; align-items: stretch; }
      .editor-row .editor-entry { flex: 1; }
      .editor-spawn {
        background: #232a33; border: 1px solid #333d49; border-radius: 6px;
        width: 30px; cursor: pointer; font-size: 14px; line-height: 1;
      }
      .editor-spawn:hover { border-color: #5b6b7e; }
      .editor-spawn-off { background: #3a2626; border-color: #6b3a3a; opacity: 0.85; }
      .editor-row-deleted .editor-entry { opacity: 0.4; text-decoration: line-through; }
      .editor-footer { display: flex; gap: 6px; }
      .editor-search {
        background: #1b222b; color: #d7e0ea; border: 1px solid #333d49;
        border-radius: 6px; padding: 6px 8px; font: inherit; width: 100%; box-sizing: border-box;
      }
      .editor-expand {
        background: #232a33; border: 1px solid #333d49; border-radius: 6px;
        width: 26px; cursor: pointer; font-size: 12px; line-height: 1; color: #cfd8e3;
      }
      .editor-expand:hover { border-color: #5b6b7e; }
      .editor-sublist {
        display: flex; flex-direction: column; gap: 2px; margin: 1px 0 3px 10px;
        max-height: 220px; overflow-y: auto;
        border-left: 2px solid #333d49; padding-left: 6px;
      }
      .editor-variant {
        text-align: left; background: #1e252e; color: #c3ccd7;
        border: 1px solid #2c3540; border-radius: 5px; padding: 4px 7px;
        font: inherit; font-size: 12px; cursor: pointer;
      }
      .editor-variant:hover { border-color: #5b6b7e; }
      .editor-variant-on { background: #2c4a2f !important; border-color: #5f9e63 !important; }
    `;
    document.head.append(style);
  }

  // ---------- EditorInputTarget ----------

  isActive(): boolean {
    return this.active;
  }

  onHover(cell: Cell | null): void {
    this.hoverCell = cell;
    if (this.selected && this.selected.kind !== "tree" && this.selected.kind !== "structure") return;
    if (!this.pendingStructureId || !cell) {
      this.deps.renderer.moveGhost(cell, false);
      return;
    }
    const valid = isValidPlacement(
      this.deps.getSim(), this.pendingStructureId, cell, this.selected?.kind === "tree",
    );
    this.deps.renderer.moveGhost(cell, valid);
  }

  onTap(hit: PickResult, cell: Cell | null): boolean {
    const target = cell ?? (hit?.kind === "ground" ? hit.cell : null);
    if (!target) return true; // editor swallows taps outside the ground
    if (this.removeMode) {
      this.removeAt(target);
      return true;
    }
    if (this.selected && this.pendingStructureId) {
      this.placeAt(target);
      return true;
    }
    return false; // nothing selected: let normal movement through
  }

  onKey(key: string): boolean {
    if (key === "Escape") {
      if (this.selected || this.removeMode) {
        this.select(null);
        return true;
      }
      this.setActive(false);
      return true;
    }
    if (key === "z" || key === "Z") {
      this.undo();
      return true;
    }
    return false;
  }

  // ---------- mode + selection ----------

  setActive(active: boolean): void {
    if (active && !EDITABLE_REGIONS.has(this.deps.getSim().world.region.id)) {
      this.deps.toast("The world editor works out in the open world.");
      return;
    }
    this.active = active;
    this.panel.style.display = active ? "flex" : "none";
    this.banner.style.display = active ? "block" : "none";
    this.toggleButton.classList.toggle("editor-toggle-on", active);
    if (!active) this.select(null);
    this.updateBanner();
  }

  private select(entry: PaletteEntry | null): void {
    this.selected = entry;
    this.removeMode = false;
    this.pendingStructureId = null;
    this.lockedId = null; // a group pick reverts to random-from-pool
    this.deps.renderer.hideGhost();
    if (entry) {
      this.rollPending();
    }
    this.refreshSelectionUi();
    this.updateBanner();
  }

  /** Pick one exact variant out of a group's pool (the drill-down), and keep
   *  placing that same one until another palette choice is made. */
  private selectSpecific(entry: PaletteEntry, id: string): void {
    this.selected = entry;
    this.removeMode = false;
    this.lockedId = id;
    this.pendingStructureId = id;
    if (entry.kind === "tree" || entry.kind === "structure") {
      this.deps.renderer.showGhost(id, entry.kind === "tree");
      if (this.hoverCell) this.onHover(this.hoverCell);
    } else {
      this.deps.renderer.hideGhost();
    }
    this.refreshSelectionUi();
    this.updateBanner();
  }

  private selectRemove(): void {
    this.selected = null;
    this.pendingStructureId = null;
    this.lockedId = null;
    this.removeMode = true;
    this.deps.renderer.hideGhost();
    this.refreshSelectionUi();
    this.updateBanner();
  }

  /** Draw the concrete structure this click will place: the locked variant if
   *  one was chosen from a group's drill-down, else a random pick from the pool. */
  private rollPending(): void {
    if (!this.selected) return;
    const pool = this.selected.pool;
    this.pendingStructureId = this.lockedId ?? pool[Math.floor(Math.random() * pool.length)];
    if (this.selected.kind === "tree" || this.selected.kind === "structure") {
      this.deps.renderer.showGhost(this.pendingStructureId, this.selected.kind === "tree");
      if (this.hoverCell) this.onHover(this.hoverCell);
    } else {
      this.deps.renderer.hideGhost();
    }
  }

  // ---------- placement ----------

  private placeAt(cell: Cell): void {
    if (!this.selected || !this.pendingStructureId) return;
    const sim = this.deps.getSim();
    if (this.selected.kind === "node" || this.selected.kind === "object" || this.selected.kind === "enemy") {
      this.placeEntityAt(this.selected.kind, this.pendingStructureId, cell);
      return;
    }
    const isTree = this.selected.kind === "tree";
    if (!isValidPlacement(sim, this.pendingStructureId, cell, isTree)) {
      this.deps.toast("Can't place there — water or something in the way.");
      return;
    }
    this.layer.counter += 1;
    if (isTree) {
      const placement = {
        instanceId: `edit.t.${this.layer.counter}`,
        defId: treeDefForSpecies(getStructure(this.pendingStructureId)?.species),
        structureId: this.pendingStructureId,
        cell,
      };
      this.layer.trees.push(placement);
      sim.addEditorTree(placement);
      this.deps.renderer.addNodeVisual(sim.nodes.get(placement.instanceId)!);
      this.pushUndo({ op: "place-tree", placement });
    } else {
      const placement = {
        instanceId: `edit.s.${this.layer.counter}`,
        structureId: this.pendingStructureId,
        cell,
      };
      this.layer.structures.push(placement);
      sim.addEditorStructure(placement);
      this.deps.renderer.addStructureVisual(placement);
      this.pushUndo({ op: "place-structure", placement });
    }
    this.deps.saveLayer(this.layer);
    this.rollPending(); // next click places a fresh random pick
  }

  /** Nodes, objects and creatures place on a single free cell; fishing
   *  spots insist on water, everything else insists on dry land. */
  private placeEntityAt(kind: "node" | "object" | "enemy", defId: string, cell: Cell): void {
    const sim = this.deps.getSim();
    const wantsWater = defId.startsWith("resource.fishing");
    const isWater = sim.world.blockAt(cell) === "water";
    const player = sim.movement.currentCell();
    const free =
      sim.world.inBounds(cell) &&
      sim.world.blockerAt(cell) === undefined &&
      !(cell.x === player.x && cell.z === player.z) &&
      (wantsWater ? isWater : !isWater);
    if (!free) {
      this.deps.toast(wantsWater ? "Fishing spots need open water." : "Can't place there.");
      return;
    }
    this.layer.counter += 1;
    const prefix = kind === "node" ? "n" : kind === "object" ? "o" : "e";
    const placement = { instanceId: `edit.${prefix}.${this.layer.counter}`, defId, cell };
    if (kind === "node") {
      this.layer.nodes.push(placement);
      sim.addEditorNodePlain(placement);
      this.deps.renderer.addNodeVisual(sim.nodes.get(placement.instanceId)!);
    } else if (kind === "object") {
      this.layer.objects.push(placement);
      sim.addEditorObject(placement);
      this.deps.renderer.addObjectVisual(placement);
    } else {
      this.layer.enemies.push(placement);
      sim.addEditorEnemy(placement);
      this.deps.renderer.addEnemyVisual(placement);
    }
    this.pushUndo({ op: "place-entity", kind, placement });
    this.deps.saveLayer(this.layer);
    this.rollPending();
  }

  private removeAt(cell: Cell): void {
    const sim = this.deps.getSim();
    const found = findEditableAt(sim, cell);
    if (!found) {
      this.deps.toast("Nothing removable there.");
      return;
    }
    const authored = !found.instanceId.startsWith("edit.");
    if (found.kind === "node" || found.kind === "object" || found.kind === "enemy") {
      const sim2 = this.deps.getSim();
      let placement: EditorEntityPlacement;
      if (found.kind === "node") {
        const node = sim2.nodes.get(found.instanceId);
        placement = { instanceId: found.instanceId, defId: node?.defId ?? "", cell: node?.cell ?? cell };
        sim2.removeEditorNode(found.instanceId);
        this.deps.renderer.removeNodeVisual(found.instanceId);
        this.layer.nodes = this.layer.nodes.filter((n) => n.instanceId !== found.instanceId);
      } else if (found.kind === "object") {
        const obj = sim2.world.region.objects.find((o) => o.instanceId === found.instanceId);
        placement = { instanceId: found.instanceId, defId: obj?.defId ?? "", cell: obj?.cell ?? cell };
        sim2.removeEditorObject(found.instanceId);
        this.deps.renderer.removeObjectVisual(found.instanceId);
        this.layer.objects = this.layer.objects.filter((o) => o.instanceId !== found.instanceId);
      } else {
        const foe = (sim2.world.region.enemies ?? []).find((e) => e.instanceId === found.instanceId);
        placement = { instanceId: found.instanceId, defId: foe?.defId ?? "", cell: foe?.cell ?? cell };
        sim2.removeEditorEnemy(found.instanceId);
        this.deps.renderer.removeEnemyVisual(found.instanceId);
        this.layer.enemies = this.layer.enemies.filter((e) => e.instanceId !== found.instanceId);
      }
      if (authored) this.layer.removed.push(found.instanceId);
      this.pushUndo({ op: "remove-entity", kind: found.kind, placement, authored });
      this.deps.saveLayer(this.layer);
      this.deps.toast("Removed.");
      return;
    }
    if (found.kind === "tree") {
      // Capture the node before it goes so undo can bring it back.
      const node = sim.nodes.get(found.instanceId);
      const placement: EditorTreePlacement = {
        instanceId: found.instanceId,
        defId: node?.defId ?? "resource.tree.grand.oak",
        structureId: node?.structureId ?? "",
        cell: node?.cell ?? cell,
      };
      sim.removeEditorNode(found.instanceId);
      this.deps.renderer.removeNodeVisual(found.instanceId);
      this.pushUndo({ op: "remove-tree", placement, authored });
    } else {
      const existing = (sim.world.region.structures ?? []).find(
        (s) => s.instanceId === found.instanceId,
      );
      const placement: EditorStructurePlacement = {
        instanceId: found.instanceId,
        structureId: existing?.structureId ?? "",
        cell: existing?.cell ?? cell,
      };
      sim.removeEditorStructure(found.instanceId);
      this.deps.renderer.removeStructureVisual(found.instanceId);
      this.pushUndo({ op: "remove-structure", placement, authored });
    }
    if (authored) {
      this.layer.removed.push(found.instanceId);
    } else {
      this.layer.trees = this.layer.trees.filter((t) => t.instanceId !== found.instanceId);
      this.layer.structures = this.layer.structures.filter((s) => s.instanceId !== found.instanceId);
    }
    this.deps.saveLayer(this.layer);
    this.deps.toast("Removed.");
  }

  // ---------- undo ----------

  private pushUndo(action: EditAction): void {
    this.undoStack.push(action);
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.refreshUndoUi();
  }

  private refreshUndoUi(): void {
    if (this.undoButton) this.undoButton.disabled = this.undoStack.length === 0;
  }

  undo(): void {
    const action = this.undoStack.pop();
    if (!action) return;
    const sim = this.deps.getSim();
    switch (action.op) {
      case "place-tree":
        sim.removeEditorNode(action.placement.instanceId);
        this.deps.renderer.removeNodeVisual(action.placement.instanceId);
        this.layer.trees = this.layer.trees.filter(
          (t) => t.instanceId !== action.placement.instanceId,
        );
        break;
      case "place-structure":
        sim.removeEditorStructure(action.placement.instanceId);
        this.deps.renderer.removeStructureVisual(action.placement.instanceId);
        this.layer.structures = this.layer.structures.filter(
          (s) => s.instanceId !== action.placement.instanceId,
        );
        break;
      case "remove-tree":
        sim.addEditorTree(action.placement);
        this.deps.renderer.addNodeVisual(sim.nodes.get(action.placement.instanceId)!);
        if (action.authored) {
          this.layer.removed = this.layer.removed.filter(
            (id) => id !== action.placement.instanceId,
          );
        } else {
          this.layer.trees.push(action.placement);
        }
        break;
      case "place-entity":
        if (action.kind === "node") {
          sim.removeEditorNode(action.placement.instanceId);
          this.deps.renderer.removeNodeVisual(action.placement.instanceId);
          this.layer.nodes = this.layer.nodes.filter((n) => n.instanceId !== action.placement.instanceId);
        } else if (action.kind === "object") {
          sim.removeEditorObject(action.placement.instanceId);
          this.deps.renderer.removeObjectVisual(action.placement.instanceId);
          this.layer.objects = this.layer.objects.filter((o) => o.instanceId !== action.placement.instanceId);
        } else {
          sim.removeEditorEnemy(action.placement.instanceId);
          this.deps.renderer.removeEnemyVisual(action.placement.instanceId);
          this.layer.enemies = this.layer.enemies.filter((e) => e.instanceId !== action.placement.instanceId);
        }
        break;
      case "remove-entity":
        if (action.kind === "node") {
          sim.addEditorNodePlain(action.placement);
          this.deps.renderer.addNodeVisual(sim.nodes.get(action.placement.instanceId)!);
          if (!action.authored) this.layer.nodes.push(action.placement);
        } else if (action.kind === "object") {
          sim.addEditorObject(action.placement);
          this.deps.renderer.addObjectVisual(action.placement);
          if (!action.authored) this.layer.objects.push(action.placement);
        } else {
          sim.addEditorEnemy(action.placement);
          this.deps.renderer.addEnemyVisual(action.placement);
          if (!action.authored) this.layer.enemies.push(action.placement);
        }
        if (action.authored) {
          this.layer.removed = this.layer.removed.filter((id) => id !== action.placement.instanceId);
        }
        break;
      case "remove-structure":
        sim.addEditorStructure(action.placement);
        this.deps.renderer.addStructureVisual(action.placement);
        if (action.authored) {
          this.layer.removed = this.layer.removed.filter(
            (id) => id !== action.placement.instanceId,
          );
        } else {
          this.layer.structures.push(action.placement);
        }
        break;
    }
    this.deps.saveLayer(this.layer);
    this.refreshUndoUi();
    this.deps.toast("Undone.");
  }

  // ---------- panel ----------

  private buildPanel(): void {
    const title = document.createElement("div");
    title.className = "editor-title";
    title.textContent = "World Editor";
    this.panel.append(title);

    const tools = document.createElement("div");
    tools.className = "editor-tools";
    const removeButton = document.createElement("button");
    removeButton.textContent = "\u{1F5D1} Remove tool";
    removeButton.dataset.editorRemove = "1";
    removeButton.addEventListener("click", () => this.selectRemove());
    tools.append(removeButton);
    this.panel.append(tools);

    // A search box filters the (now complete) palette down to what you type.
    const search = document.createElement("input");
    search.className = "editor-search";
    search.placeholder = "\u{1F50D} Search props, nodes, mobs…";
    this.panel.append(search);

    const list = document.createElement("div");
    list.className = "editor-list";
    // Track rows (and any drill-down sublist) per group so the search can hide
    // empty groups.
    const groups: Array<{ header: HTMLElement; rows: Array<{ el: HTMLElement; sub?: HTMLElement; label: string }> }> = [];
    for (const group of this.buildPalette()) {
      if (group.entries.length === 0) continue;
      const header = document.createElement("div");
      header.className = "editor-group";
      header.textContent = group.name;
      list.append(header);
      const rows: Array<{ el: HTMLElement; sub?: HTMLElement; label: string }> = [];
      for (const entry of group.entries) {
        const row = document.createElement("div");
        row.className = "editor-row";
        const pick = document.createElement("button");
        pick.className = "editor-entry";
        pick.textContent = entry.label;
        pick.addEventListener("click", () => this.select(entry));
        (pick as HTMLElement & { __entry?: PaletteEntry }).__entry = entry;
        row.append(pick);
        // Delete / restore: a dev tool to take an asset out of the game so it
        // stops spawning anywhere in the wild (endless chunks skip any disabled
        // node / prop / creature / building). Deletion is global and persists
        // on-device; click ↩ to bring the asset back before release. Works on a
        // single def or a whole pool (a tree species, the home library, …).
        {
          const del = document.createElement("button");
          del.className = "editor-spawn";
          const isDeleted = () => entry.pool.every((id) => !isModelEnabled(id));
          const refresh = () => {
            const gone = isDeleted();
            del.textContent = gone ? "↩" : "\u{1F5D1}";
            del.title = gone
              ? "Deleted — won't spawn in the game. Click to restore."
              : "Delete from the game (stops it spawning). Placing by hand still works.";
            del.classList.toggle("editor-spawn-off", gone);
            row.classList.toggle("editor-row-deleted", gone);
          };
          refresh();
          del.addEventListener("click", (e) => {
            e.stopPropagation();
            const restore = isDeleted();
            for (const id of entry.pool) setModelEnabled(id, restore);
            refresh();
          });
          row.append(del);
        }
        // Drill-down: a group of many variants (tree buckets, the interiored
        // home library) gets an expander to pick one exact model instead of a
        // random draw. Built lazily on first open.
        let sub: HTMLElement | undefined;
        if (entry.pool.length > 1) {
          const expand = document.createElement("button");
          expand.className = "editor-expand";
          expand.textContent = "▸";
          expand.title = "Choose a specific one";
          const panel = document.createElement("div");
          panel.className = "editor-sublist";
          panel.style.display = "none";
          sub = panel;
          let built = false;
          expand.addEventListener("click", (e) => {
            e.stopPropagation();
            const open = panel.style.display === "none";
            panel.style.display = open ? "flex" : "none";
            expand.textContent = open ? "▾" : "▸";
            if (open && !built) {
              built = true;
              for (const id of entry.pool) {
                const b = document.createElement("button");
                b.className = "editor-variant";
                b.textContent = variantLabel(id);
                b.addEventListener("click", (ev) => { ev.stopPropagation(); this.selectSpecific(entry, id); });
                panel.append(b);
              }
            }
          });
          row.append(expand);
        }
        list.append(row);
        if (sub) list.append(sub);
        rows.push({ el: row, sub, label: entry.label.toLowerCase() });
      }
      groups.push({ header, rows });
    }
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      for (const g of groups) {
        let any = false;
        for (const r of g.rows) {
          const show = !q || r.label.includes(q);
          r.el.style.display = show ? "flex" : "none";
          if (r.sub && !show) r.sub.style.display = "none";
          if (show) any = true;
        }
        g.header.style.display = any ? "block" : "none";
      }
    });
    this.panel.append(list);

    const footer = document.createElement("div");
    footer.className = "editor-footer";
    this.undoButton = document.createElement("button");
    this.undoButton.textContent = "↶ Undo";
    this.undoButton.disabled = true;
    this.undoButton.addEventListener("click", () => this.undo());
    const clearButton = document.createElement("button");
    clearButton.textContent = "Reset edits";
    clearButton.addEventListener("click", () => this.clearLayer());
    footer.append(this.undoButton, clearButton);
    this.panel.append(footer);
  }

  private buildPalette(): Array<{ name: string; entries: PaletteEntry[] }> {
    const bySpecies = new Map<string, string[]>();
    const buildings: string[] = [];
    // The imported voxel-house library has been removed; the palette now lists
    // only our own baked builds (and the code-drawn houses live as objects).
    for (const id of structureIds()) {
      const asset = getStructure(id);
      if (!asset) continue;
      if (id.startsWith("tree.")) {
        const species = asset.species ?? "oak";
        if (!bySpecies.has(species)) bySpecies.set(species, []);
        bySpecies.get(species)!.push(id);
      } else if (id.startsWith("house.")) {
        continue;
      } else if (id !== "castle.overgrowncastle") {
        buildings.push(id);
      }
    }
    const treeGroups: PaletteEntry[] = [];
    const size = (id: string) => {
      const a = getStructure(id)!;
      return Math.max(a.sx, a.sz);
    };
    for (const [species, ids] of [...bySpecies.entries()].sort()) {
      const label = SPECIES_LABELS[species] ?? "Wild";
      const buckets: Array<[string, (n: number) => boolean]> = [
        ["small", (n) => n < 12],
        ["medium", (n) => n >= 12 && n < 24],
        ["large", (n) => n >= 24],
      ];
      for (const [bucketName, test] of buckets) {
        const pool = ids.filter((id) => test(size(id)));
        if (pool.length === 0) continue;
        treeGroups.push({
          label: `${label} — ${bucketName} (${pool.length})`,
          kind: "tree",
          pool,
        });
      }
    }
    const buildingEntries: PaletteEntry[] = buildings.map((id) => {
      const asset = getStructure(id)!;
      const [group, name] = id.split(".");
      const title = group.charAt(0).toUpperCase() + group.slice(1);
      return {
        label: `${title}${name ? ` ${name}` : ""} (${asset.sx}×${asset.sz})`,
        kind: "structure" as const,
        pool: [id],
      };
    });
    // Every registered node, object and creature is placeable — not a curated
    // handful. Known ids get a friendly label; the rest are prettified from the
    // def id, so a brand-new content def turns up in the editor automatically.
    const one = (id: string, kind: PaletteEntry["kind"]): PaletteEntry => ({ label: labelFor(id), kind, pool: [id] });
    const nodeKeys = Object.keys(NODES);
    const isFishing = (id: string) => id.startsWith("resource.fishing");
    const isTree = (id: string) => id.startsWith("resource.tree");
    const isRock = (id: string) => id.startsWith("resource.rock");
    const isGrow = (id: string) => /^resource\.(herb|bush|crop|plot)\./.test(id);
    const nodesIn = (pred: (id: string) => boolean) =>
      nodeKeys.filter(pred).sort().map((id) => one(id, "node"));
    const wildTrees = nodesIn(isTree);
    const mining = nodesIn(isRock);
    const growing = nodesIn(isGrow);
    const gathering = nodesIn((id) => !isFishing(id) && !isTree(id) && !isRock(id) && !isGrow(id));
    const fishingEntries = nodesIn(isFishing);
    const creatureEntries = Object.keys(ENEMIES).sort().map((id) => one(id, "enemy"));
    const objKeys = Object.keys(OBJECTS);
    const isProtectedObj = (id: string) => /^object\.(portal|stairs|keep|spire|store|counter)\./.test(id);
    const propEntries = objKeys.filter((id) => !isProtectedObj(id)).sort().map((id) => one(id, "object"));
    const protectedEntries = objKeys.filter(isProtectedObj).sort().map((id) => one(id, "object"));
    return [
      { name: "Trees (choppable)", entries: treeGroups },
      { name: "Wild Trees (varied models)", entries: wildTrees },
      { name: "Mining — rocks & ores", entries: mining },
      { name: "Farming & Foraging", entries: growing },
      { name: "Gathering — digs, trails, stalls", entries: gathering },
      { name: "Fishing Spots", entries: fishingEntries },
      { name: "Creatures & Spawns", entries: creatureEntries },
      { name: "Props & Stations", entries: propEntries },
      { name: "Special — portals, stairs, shops", entries: protectedEntries },
      { name: "Buildings", entries: buildingEntries },
    ];
  }

  private refreshSelectionUi(): void {
    for (const el of this.panel.querySelectorAll<HTMLElement>(".editor-entry")) {
      const entry = (el as HTMLElement & { __entry?: PaletteEntry }).__entry;
      el.classList.toggle("editor-entry-on", entry === this.selected);
    }
    const removeButton = this.panel.querySelector<HTMLElement>("[data-editor-remove]");
    removeButton?.classList.toggle("editor-entry-on", this.removeMode);
  }

  private updateBanner(): void {
    if (this.removeMode) this.banner.textContent = "EDIT — click anything (tree, rock, spawn, prop, building) to remove it";
    else if (this.selected) this.banner.textContent = `EDIT — click to place: ${this.selected.label} (Esc to stop)`;
    else this.banner.textContent = "EDIT MODE — pick something from the palette (Z undoes)";
  }

  // ---------- layer persistence ----------

  private clearLayer(): void {
    this.layer = emptyLayer();
    this.deps.saveLayer(this.layer);
    window.location.reload();
  }
}

export { applyLayerToSim, emptyLayer, parseLayer };
