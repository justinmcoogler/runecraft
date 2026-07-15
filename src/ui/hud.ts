// HUD: DOM overlay. Subscribes to SimEvents and reads sim state; every button
// emits a Command. The UI never mutates simulation state directly.

import { ALCHEMY, ALCH_VALUES, CURVES, ENEMIES, ITEMS, NODES, OBJECTS, QUESTS, RECIPES, SHOPS, SKILLS, xpToReachLevel } from "../content/content";
import { skillActivities, skillCeiling } from "../content/skill-guide";
import { BLOCKS } from "../content/blocks";
import type { GameRenderer } from "../render/renderer";
import type { GameSimulation } from "../sim/simulation";
import { DAY_LENGTH_S } from "../sim/simulation";
import { activeQuestTarget, questLog } from "./quest-helper";
import { treeTapLabel } from "../render/tree-models";
import type { SimEvent } from "../sim/types";
import type { ImportedPack } from "../texturepacks/importer";
import { itemIconHtml, skillIconHtml, uiIconHtml } from "./icons";

export interface HudCallbacks {
  onSkinFile?(file: File): void;
  onSkinReset?(): void;
  onPackFile?(file: File): void;
  onPackReset?(): void;
}

const NPC_LINES = [
  "Fine axe-work out there, traveler.",
  "Left a pickaxe and a fishing rod in that chest — help yourself.",
  "Copper in the rocks up on the plateau, fish in the shallows. This vale provides.",
  "Cook your catch at the campfire — mind you don't burn it.",
  "Bitten up? Eat a cooked fish from your pack — berries will do in a pinch.",
  "The furnace draws well. Two ores make a bar — and the anvil turns bars into blades, if you've a hammer.",
  "The cows and pigs hereabouts are placid — but they'll defend themselves if you raise a blade.",
  "Cowhides hammer into decent leather on the anvil. Bars make better plate, mind.",
  "Spiders in the hollow below, webs full of miners' copper. A sword helps.",
  "There's a cave mouth atop the plateau. Old Gnasher spins her web down there — and more copper than you can carry.",
  "Follow the east path past the lake and you'll reach the iron hills. Iron takes a practiced pick — Mining 4, I'd say.",
  "There's a second cave up in the iron hills — the Delve. Meaner spiders down there, and richer ore.",
  "Seen the castle east along the road? Walls, moat, banners and all. That's your keep now.",
  "I once chopped a hundred logs before breakfast. Long ago, mind.",
];

const SKILL_VERBS: Record<string, string> = {
  "skill.woodcutting": "Chopping",
  "skill.mining": "Mining",
  "skill.foraging": "Picking",
  "skill.fishing": "Fishing",
  "skill.cooking": "Cooking at",
  "skill.smelting": "Smelting at",
  "skill.smithing": "Forging at",
  "skill.farming": "Harvesting",
  "skill.herblore": "Gathering",
  "skill.crafting": "Crafting at",
  "skill.brewing": "Brewing at",
  "skill.enchanting": "Enchanting at",
  "skill.archaeology": "Excavating",
};

const TOOL_NAMES: Record<string, string> = {
  axe: "an axe",
  pickaxe: "a pickaxe",
  fishing_tool: "a fishing rod",
  hammer: "a smithing hammer",
};

function npcName(npcId: string, sim: GameSimulation): string {
  return sim.npcs.get(npcId)?.name ?? "???";
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const TOOL_USES: Record<string, string> = {
  axe: "chops trees",
  pickaxe: "mines rock",
  fishing_tool: "catches fish",
  hammer: "works the anvil",
  weapon: "fights in combat",
};

/** One-line "what is this" derived from an item's gameplay properties. */
function describeItem(item: (typeof ITEMS)[string]): string {
  if (item.buff) {
    const what =
      item.buff.kind === "speed" ? "move faster" : item.buff.kind === "strength" ? "hit harder" : "shrug off blows";
    return `Potion — drink to ${what} for ${item.buff.durationS}s`;
  }
  if (item.healAmount) return `Food — eat to restore ${item.healAmount} HP`;
  if (item.armorSlot) {
    const pct = Math.round((item.protection ?? 0) * 100);
    return `Armor (${item.armorSlot}) — blocks ${pct}% of damage while worn`;
  }
  if (item.toolTags?.length) {
    const use = TOOL_USES[item.toolTags[0]] ?? "a tool";
    const bonus = item.damageBonus
      ? ` (+${item.damageBonus} damage)`
      : item.successBonus
        ? ` (+${Math.round(item.successBonus * 100)}% success)`
        : "";
    return `Tool — ${use}${bonus}`;
  }
  if (item.firemaking) return `Log — light it (Firemaking ${item.firemaking.level}) for ${item.firemaking.xp} XP`;
  if (item.prayer) return `Bones — bury them (Prayer ${item.prayer.level}) for ${item.prayer.xp} XP`;
  if (item.id === "item.essence.rune") return "Arcane essence — bind it into runes at an Arcane Altar";
  if (item.id.startsWith("item.rune.")) return "A rune — spent casting Magic";
  if (item.id.startsWith("item.arrow.")) return "Ammunition — fletched at the workbench";
  if (item.id.startsWith("item.pouch.")) return `Familiar pouch — call it to ${item.buff?.kind === "gathering" ? "gather faster" : item.buff?.kind === "strength" ? "hit harder" : "shrug off blows"} for ${item.buff?.durationS}s`;
  if (item.id === "item.component.parts") return "Salvaged parts — build gizmos with Invention";
  if (item.id.startsWith("item.gizmo.")) return `Gizmo — activate to ${item.buff?.kind === "speed" ? "move faster" : "aim truer"} for ${item.buff?.durationS}s`;
  if (ALCH_VALUES[item.id] !== undefined) return "Alchemise it (Magic) to turn it to coins";
  if (item.id === "item.gem.emberstone") return "A gem warm to the touch — Old Alder wants to see this";
  if (item.id.startsWith("item.gem.")) return "A cut gem — set it in jewellery at the workbench";
  if (item.id.startsWith("item.ring.") || item.id.startsWith("item.amulet.")) return "Fine jewellery — sells well";
  if (item.id.startsWith("item.bar.")) return "Smelted metal — smith it at the anvil";
  if (item.id.startsWith("item.ore.")) return "Raw ore — smelt it at the furnace";
  if (item.id.includes("burnt")) return "Ruined by the fire — worthless, but a lesson";
  if (item.id.endsWith(".raw")) return "Raw food — cook it at the campfire";
  // Fish and game caught with noun-first ids (trout, eel, rabbit…) are raw
  // food too, not crafting mats — point the player at the campfire.
  if (item.id.startsWith("item.fish.") && !item.id.includes("cooked")) return "Raw fish — cook it at the campfire";
  if (item.id.startsWith("item.game.")) return "Raw game — cook it at the campfire";
  if (item.id === "item.hide.cow") return "Sturdy hide — hammer into leather armor at the anvil";
  if (item.id === "item.coin") return "Coins — spend them at shops";
  if (item.id.startsWith("item.seed.")) return "Seed — plant it in a farm plot to grow a crop";
  if (item.id.startsWith("item.relic.") || item.id.startsWith("item.trinket.")) return "An old relic — donate it to the curator's collection";
  if (item.id.startsWith("item.herb.")) return "A herb — brew it into potions at a cauldron";
  return "Material — used in crafting";
}

export class Hud {
  private root: HTMLElement;
  private sim: GameSimulation;
  private renderer: GameRenderer;
  callbacks: HudCallbacks = {};
  private npcLineIndex = 0;
  private shownSkillId = "skill.woodcutting";
  private currentVerb = "Working on";
  private openStationId: string | null = null;
  private skillLevelEl!: HTMLElement;
  private xpFillEl!: HTMLElement;
  private xpTextEl!: HTMLElement;
  private targetPlateEl!: HTMLElement;
  private targetNameEl!: HTMLElement;
  private progressFillEl!: HTMLElement;
  private toastStackEl!: HTMLElement;
  private inventoryPanelEl!: HTMLElement;
  private inventoryGridEl!: HTMLElement;
  private equipRowEl!: HTMLElement;
  private chestPanelEl!: HTMLElement;
  private chestGridEl!: HTMLElement;
  private saveDotEl!: HTMLElement;
  private currentTargetName = "";
  private selectedSlot: number | null = null;

  constructor(root: HTMLElement, sim: GameSimulation, renderer: GameRenderer) {
    this.root = root;
    this.sim = sim;
    this.renderer = renderer;
    this.build();
    this.refreshSkill();
    this.refreshInventory();
    this.refreshHealth(sim.hp, sim.maxHp());
    this.setPackStatus(null);
  }

  private build(): void {
    this.root.innerHTML = `
      <div class="hud-top-right">
        <div class="skill-chip" data-cmd="skills" title="All skills">
          <span class="skill-icon"></span>
          <span class="skill-name">Woodcutting</span>
          <span class="skill-level" data-testid="skill-level">1</span>
          <div class="xp-bar"><div class="xp-fill"></div></div>
          <span class="xp-text"></span>
        </div>
        <div class="health-chip" data-testid="health-chip">
          <span class="hp-heart">${uiIconHtml("heart", 18)}</span>
          <div class="hp-bar"><div class="hp-fill"></div></div>
          <span class="hp-text">20/20</span>
        </div>
        <div class="skills-panel hidden" data-testid="skills-panel">
          <div class="panel-header">Skills <button class="btn small" data-cmd="skills">✕</button></div>
          <div class="skills-hint">Tap a skill to see what it trains and the level each unlocks at.</div>
          <div class="skills-list"></div>
          <div class="skill-detail hidden" data-testid="skill-detail"></div>
        </div>
      </div>
      <div class="hud-top-center toast-stack"></div>
      <div class="tutorial-banner hidden" data-testid="tutorial-banner">
        <div class="tut-head"><span class="tut-step"></span><span class="tut-title"></span></div>
        <div class="tut-blurb"></div>
      </div>
      <div class="hud-top-left">
        <div><span class="save-dot" title="Saved">●</span> <span class="game-title">Runecraft</span></div>
        <div class="clock-chip" data-testid="clock"><span class="clock-text"></span></div>
        <div class="quest-tracker hidden" data-cmd="questlog" data-testid="quest-tracker" title="Quest log (J)">
          <span class="quest-mark">${uiIconHtml("quest", 14)}</span>
          <span class="quest-name"></span>
          <span class="quest-objective"></span>
          <span class="quest-pointer" title="Objective direction">➤</span>
        </div>
      </div>
      <div class="target-plate hidden">
        <span class="target-name"></span>
        <div class="action-progress"><div class="action-fill"></div></div>
        <button class="btn cancel-btn" data-testid="cancel">✕ Cancel</button>
      </div>
      <div class="hud-bottom-left"></div>
      <div class="hud-bottom-right">
        <button class="btn" data-cmd="rotl" title="Rotate left (Q)">${uiIconHtml("rotl")}</button>
        <button class="btn" data-cmd="rotr" title="Rotate right (E)">${uiIconHtml("rotr")}</button>
        <button class="btn" data-cmd="center" title="Center camera (Space)">${uiIconHtml("center")}</button>
        <button class="btn" data-cmd="settings" title="Settings" data-testid="settings-toggle">⚙</button>
        <button class="btn" data-cmd="questlog" title="Quest log (J)" data-testid="questlog-toggle">${uiIconHtml("quest")}</button>
        <button class="btn" data-cmd="inv" title="Inventory (I)" data-testid="inv-toggle">${uiIconHtml("inv")}</button>
      </div>
      <div class="questlog-panel hidden" data-testid="questlog-panel">
        <div class="panel-header">Quests <button class="btn small" data-cmd="questlog">✕</button></div>
        <div class="questlog-list"></div>
        <div class="panel-hint">! ready to start · ✦ in progress · ? ready to turn in · ✓ done</div>
      </div>
      <div class="settings-panel hidden" data-testid="settings-panel">
        <div class="panel-header">Settings <button class="btn small" data-cmd="settings">✕</button></div>
        <div class="settings-actions">
          <button class="btn small" data-cmd="skin" data-testid="skin-toggle">${uiIconHtml("skin")} Character skin…</button>
          <button class="btn small" data-cmd="packs" data-testid="pack-toggle">${uiIconHtml("pack")} Texture pack…</button>
          <button class="btn small" data-cmd="debug" data-testid="debug-toggle">🐞 Debug…</button>
        </div>
        <div class="help-text">
          <b>How to play:</b> tap the ground to walk; tap trees, rocks and
          pools to work them; tap monsters to fight; tap folk to talk and take
          quests. <b>I</b> pack · <b>Q/E</b> turn · <b>Space</b> center. The
          chip up top opens all your skills. Craft at benches, fires, furnaces
          and anvils. If you fall in battle you wake at camp — nothing lost.
        </div>
      </div>
      <div class="debug-panel hidden" data-testid="debug-panel">
        <div class="panel-header">Debug <button class="btn small" data-cmd="debug">✕</button></div>
        <div class="debug-row"><span class="debug-label">Time</span>
          <button class="btn small" data-cmd="dbgTime" data-h="6">Dawn</button>
          <button class="btn small" data-cmd="dbgTime" data-h="12">Noon</button>
          <button class="btn small" data-cmd="dbgTime" data-h="18">Dusk</button>
          <button class="btn small" data-cmd="dbgTime" data-h="0">Night</button>
        </div>
        <div class="debug-row"><span class="debug-label">Weather</span>
          <button class="btn small" data-cmd="dbgWeather" data-w="">Auto</button>
          <button class="btn small" data-cmd="dbgWeather" data-w="clear">Clear</button>
          <button class="btn small" data-cmd="dbgWeather" data-w="overcast">Cloud</button>
          <button class="btn small" data-cmd="dbgWeather" data-w="rain">Rain</button>
          <button class="btn small" data-cmd="dbgWeather" data-w="storm">Storm</button>
        </div>
        <div class="debug-row"><span class="debug-label">Toggles</span>
          <button class="btn small" data-cmd="dbgCollision" data-testid="dbg-collision">Show collision</button>
          <button class="btn small" data-cmd="dbgNoclip" data-testid="dbg-noclip">Walk anywhere</button>
          <button class="btn small" data-cmd="dbgInspect" data-testid="dbg-inspect">Inspect blocks</button>
          <button class="btn small" data-cmd="dbgTorch" data-testid="dbg-torch">Hold torch</button>
        </div>
      </div>
      <div class="block-inspect hidden" data-testid="block-inspect"></div>
      <div class="skin-panel hidden" data-testid="skin-panel">
        <div class="panel-header">Character Skin <button class="btn small" data-cmd="skin">✕</button></div>
        <p class="panel-text">
          Upload any standard 64×64 (or legacy 64×32) Minecraft-format skin PNG from your device.
          Skins are cosmetic only and never leave your device. The game ships with its own original skin.
        </p>
        <div class="skin-actions">
          <button class="btn small" data-cmd="skinUpload" data-testid="skin-upload">Upload skin PNG…</button>
          <button class="btn small" data-cmd="skinDefault">Use default</button>
        </div>
        <input type="file" class="skin-file" accept="image/png" hidden />
      </div>
      <div class="pack-panel hidden" data-testid="pack-panel">
        <div class="panel-header">Texture Pack <button class="btn small" data-cmd="packs">✕</button></div>
        <p class="panel-text">
          Import a Minecraft-Java-format resource pack ZIP you own — recognized block and
          item textures reskin the vale. Packs are cosmetic only, stay on your device, and
          are never bundled or redistributed. Anything a pack doesn't cover keeps the
          game's own original art.
        </p>
        <div class="skin-actions">
          <button class="btn small" data-cmd="packUpload" data-testid="pack-upload">Import pack ZIP…</button>
          <button class="btn small" data-cmd="packDefault" data-testid="pack-reset">Use built-in art</button>
        </div>
        <div class="pack-status" data-testid="pack-status"></div>
        <input type="file" class="pack-file" accept=".zip,application/zip" hidden />
      </div>
      <div class="inventory-panel hidden" data-testid="inventory-panel">
        <div class="panel-header">Inventory <button class="btn small" data-cmd="inv">✕</button></div>
        <div class="equip-row"></div>
        <div class="inv-grid"></div>
        <div class="item-info hidden" data-testid="item-info"></div>
      </div>
      <div class="recipe-panel hidden" data-testid="recipe-panel">
        <div class="panel-header"><span class="station-name">Workstation</span>
          <button class="btn small" data-cmd="closeStation">✕</button>
        </div>
        <div class="recipe-list"></div>
        <div class="panel-hint">Tap a recipe to work until you run out of ingredients · walk away to stop</div>
      </div>
      <div class="shop-panel hidden" data-testid="shop-panel">
        <div class="panel-header"><span class="shop-name">Store</span>
          <span><span class="shop-coins" data-testid="shop-coins"></span>
          <button class="btn small" data-cmd="closeShop">✕</button></span>
        </div>
        <div class="shop-stock"></div>
        <div class="panel-hint">Tap a pack item to sell it · prices shown on your items</div>
      </div>
      <div class="chest-panel hidden" data-testid="chest-panel">
        <div class="panel-header">Storage Chest
          <span>
            <button class="btn small" data-cmd="depositAll" data-testid="deposit-all">Deposit all</button>
            <button class="btn small" data-cmd="closeChest">✕</button>
          </span>
        </div>
        <div class="chest-grid"></div>
        <div class="panel-hint">Tap a pack item to deposit it · tap a chest item to withdraw</div>
      </div>
    `;
    this.skillLevelEl = this.q(".skill-level");
    this.xpFillEl = this.q(".xp-fill");
    this.xpTextEl = this.q(".xp-text");
    this.targetPlateEl = this.q(".target-plate");
    this.targetNameEl = this.q(".target-name");
    this.progressFillEl = this.q(".action-fill");
    this.toastStackEl = this.q(".toast-stack");
    this.inventoryPanelEl = this.q(".inventory-panel");
    this.inventoryGridEl = this.q(".inv-grid");
    this.equipRowEl = this.q(".equip-row");
    this.chestPanelEl = this.q(".chest-panel");
    this.chestGridEl = this.q(".chest-grid");
    this.saveDotEl = this.q(".save-dot");

    this.root.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-cmd]") as HTMLElement | null;
      if (!btn) return;
      switch (btn.dataset.cmd) {
        case "rotl": this.renderer.rig.rotate(-1); break;
        case "rotr": this.renderer.rig.rotate(1); break;
        case "center": this.renderer.rig.center(); break;
        case "inv": this.inventoryPanelEl.classList.toggle("hidden"); break;
        case "settings": this.q(".settings-panel").classList.toggle("hidden"); break;
        case "debug":
          this.q(".debug-panel").classList.toggle("hidden");
          this.q(".settings-panel").classList.add("hidden");
          break;
        case "dbgTime": {
          const h = Number(btn.dataset.h ?? "12");
          const day = Math.floor(this.sim.timeS / DAY_LENGTH_S);
          this.sim.timeS = day * DAY_LENGTH_S + (h / 24) * DAY_LENGTH_S;
          break;
        }
        case "dbgWeather":
          this.sim.weatherOverride = (btn.dataset.w || null) as typeof this.sim.weatherOverride;
          break;
        case "dbgCollision": {
          const on = !btn.classList.contains("btn-on");
          btn.classList.toggle("btn-on", on);
          this.renderer.setDebugCollision(on);
          break;
        }
        case "dbgNoclip": {
          const on = !btn.classList.contains("btn-on");
          btn.classList.toggle("btn-on", on);
          this.sim.world.noclip = on;
          break;
        }
        case "dbgInspect": {
          const on = !btn.classList.contains("btn-on");
          btn.classList.toggle("btn-on", on);
          this.setBlockInspect(on);
          break;
        }
        case "dbgTorch": {
          const on = !btn.classList.contains("btn-on");
          btn.classList.toggle("btn-on", on);
          this.renderer.setHoldTorch(on);
          break;
        }
        case "questlog": {
          const panel = this.q(".questlog-panel");
          panel.classList.toggle("hidden");
          if (!panel.classList.contains("hidden")) this.refreshQuestLog();
          break;
        }
        case "depositAll": this.sim.enqueue({ type: "depositAll" }); break;
        case "closeChest": this.sim.enqueue({ type: "closeContainer" }); break;
        case "skin":
          this.q(".skin-panel").classList.toggle("hidden");
          this.q(".settings-panel").classList.add("hidden");
          break;
        case "skills": {
          const panel = this.q(".skills-panel");
          panel.classList.toggle("hidden");
          if (!panel.classList.contains("hidden")) this.refreshSkillsPanel();
          break;
        }
        case "closeStation": this.sim.enqueue({ type: "closeContainer" }); break;
        case "closeShop": this.sim.enqueue({ type: "closeContainer" }); break;
        case "skinUpload": (this.q(".skin-file") as HTMLInputElement).click(); break;
        case "skinDefault":
          this.callbacks.onSkinReset?.();
          this.q(".skin-panel").classList.add("hidden");
          break;
        case "packs":
          this.q(".pack-panel").classList.toggle("hidden");
          this.q(".settings-panel").classList.add("hidden");
          break;
        case "packUpload": (this.q(".pack-file") as HTMLInputElement).click(); break;
        case "packDefault": this.callbacks.onPackReset?.(); break;
      }
    });
    this.q(".skin-file").addEventListener("change", (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) this.callbacks.onSkinFile?.(file);
      input.value = "";
      this.q(".skin-panel").classList.add("hidden");
    });
    this.q(".pack-file").addEventListener("change", (e) => {
      const input = e.target as HTMLInputElement;
      const file = input.files?.[0];
      if (file) this.callbacks.onPackFile?.(file);
      input.value = "";
    });
    this.q(".cancel-btn").addEventListener("click", () => this.sim.enqueue({ type: "cancel" }));
    window.addEventListener("keydown", (e) => {
      if (e.key === "i" || e.key === "I") this.inventoryPanelEl.classList.toggle("hidden");
      else if (e.key === "j" || e.key === "J") {
        const panel = this.q(".questlog-panel");
        panel.classList.toggle("hidden");
        if (!panel.classList.contains("hidden")) this.refreshQuestLog();
      }
    });
  }

  private q(selector: string): HTMLElement {
    return this.root.querySelector(selector) as HTMLElement;
  }

  /** Show/update the persistent tutorial objective banner. */
  private showTutorialObjective(step: number, total: number, title: string, blurb: string): void {
    const banner = this.root.querySelector(".tutorial-banner") as HTMLElement | null;
    if (!banner) return;
    (banner.querySelector(".tut-step") as HTMLElement).textContent = `Lesson ${step}/${total}`;
    (banner.querySelector(".tut-title") as HTMLElement).textContent = title;
    (banner.querySelector(".tut-blurb") as HTMLElement).textContent = blurb;
    banner.classList.remove("hidden", "done");
  }

  /** Final state: all lessons done, the gateway is open. */
  private setTutorialComplete(): void {
    const banner = this.root.querySelector(".tutorial-banner") as HTMLElement | null;
    if (!banner) return;
    (banner.querySelector(".tut-step") as HTMLElement).textContent = "✓ Done";
    (banner.querySelector(".tut-title") as HTMLElement).textContent = "You're ready for the wild";
    (banner.querySelector(".tut-blurb") as HTMLElement).textContent = "Step through the gateway to enter your own random world.";
    banner.classList.remove("hidden");
    banner.classList.add("done");
  }

  handleEvents(events: SimEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case "targetSelected": {
          const node = this.sim.nodes.get(ev.targetId);
          const npc = this.sim.npcs.get(ev.targetId);
          if (node) {
            const def = NODES[node.defId];
            this.currentTargetName = def.name;
            this.currentVerb = SKILL_VERBS[def.skillId] ?? "Working on";
          } else if (npc) {
            this.currentTargetName = npc.name;
            this.currentVerb = "Greeting";
          } else if (this.sim.enemies.get(ev.targetId)) {
            const enemy = this.sim.enemies.get(ev.targetId)!;
            this.currentTargetName = ENEMIES[enemy.defId].name;
            this.currentVerb = "Fighting";
          } else {
            const placement = this.sim.world.region.objects.find((o) => o.instanceId === ev.targetId);
            this.currentTargetName = placement ? OBJECTS[placement.defId].name : "Object";
            if (!this.currentVerb || this.sim.actions.phase === "idle") this.currentVerb = "Opening";
          }
          break;
        }
        case "actionRejected":
          this.toast(this.rejectText(ev.reason, ev.targetId), "warn");
          break;
        case "tutorialObjective":
          this.showTutorialObjective(ev.index + 1, ev.total, ev.title, ev.blurb);
          this.toast(`New task — ${ev.title}`, "info");
          break;
        case "tutorialLessonDone":
          this.toast(`Lesson complete: ${ev.title}!`, "level", uiIconHtml("quest", 20));
          break;
        case "tutorialComplete":
          this.setTutorialComplete();
          this.toast("Tutorial complete — step through the gateway to the wild!", "level", uiIconHtml("quest", 20));
          break;
        case "poiDiscovered":
          this.toast(`Discovered ${ev.name}! +${ev.reward} coins · ${ev.total} found`, "level", uiIconHtml("quest", 20));
          break;
        case "dungeonCleared":
          this.toast(`Conquered ${ev.name}! +${ev.reward} coins · ${ev.total} cleared`, "level", uiIconHtml("heart", 22));
          break;
        case "worldEvent":
          this.toast(`${ev.title} — ${ev.blurb}`, ev.kind === "cache" ? "level" : "warn", uiIconHtml("quest", 20));
          break;
        case "fastTraveled":
          this.toast(`Travelled to ${ev.name}.`, "info", uiIconHtml("quest", 18));
          break;
        case "treasureHuntBegan":
          this.toast(`🗺️ ${ev.hint}`, "info", uiIconHtml("quest", 20));
          break;
        case "treasureFound":
          this.toast(
            ev.chain ? `You unearth the cache — +${ev.reward} coins, and another map!`
              : `You unearth the cache — +${ev.reward} coins!`,
            "level", uiIconHtml("quest", 22),
          );
          break;
        case "itemGained":
          this.floatText(
            `+${ev.qty} ${ITEMS[ev.itemId].name} ${itemIconHtml(ev.itemId, ITEMS[ev.itemId].icon, 18)}`,
          );
          break;
        case "gemFound":
          this.toast(`You struck a ${ITEMS[ev.itemId].name}!`, "level", itemIconHtml(ev.itemId, ITEMS[ev.itemId].icon, 22));
          break;
        case "logBurned":
          this.floatText(`${ITEMS[ev.itemId].name} burns away ${itemIconHtml(ev.itemId, ITEMS[ev.itemId].icon, 18)}`, 16);
          break;
        case "bonesBuried":
          this.floatText(`${ITEMS[ev.itemId].name} laid to rest ${itemIconHtml(ev.itemId, ITEMS[ev.itemId].icon, 18)}`, 16);
          break;
        case "spellCast":
          this.floatText(`Alchemy → +${ev.coins} ${itemIconHtml("item.coin", "\u{1FA99}", 18)}`, 18);
          break;
        case "xpGained":
          this.floatText(`+${ev.amount} XP`, 18);
          this.shownSkillId = ev.skillId;
          this.refreshSkill();
          // Refresh the list only when it's the visible view — don't yank the
          // player out of an open skill-detail breakdown mid-read.
          if (
            !this.q(".skills-panel").classList.contains("hidden") &&
            this.q(".skill-detail").classList.contains("hidden")
          ) this.refreshSkillsPanel();
          break;
        case "levelUp":
          this.toast(`${SKILLS[ev.skillId].name} level ${ev.level}!`, "level", skillIconHtml(ev.skillId, 22));
          this.shownSkillId = ev.skillId;
          this.refreshSkill();
          break;
        case "inventoryChanged":
        case "equipmentChanged":
          this.refreshInventory();
          if (!this.chestPanelEl.classList.contains("hidden")) this.refreshChest();
          {
            const shop = this.sim.openShop();
            if (shop) this.refreshShop(shop.id);
          }
          if (this.openStationId && !this.q(".recipe-panel").classList.contains("hidden")) {
            this.refreshRecipes(this.openStationId);
          }
          break;
        case "inventoryFull":
          this.toast("Your pack is full.", "warn");
          break;
        case "nodeDepleted": {
          // The same event fires for every gatherable — branch the message on
          // the node kind so mining a rock dry doesn't read "The tree is felled."
          const dd = this.sim.nodes.get(ev.instanceId)?.defId ?? "";
          const msg = dd.startsWith("resource.tree") ? "The tree is felled."
            : dd.startsWith("resource.rock") ? "The rock is spent."
            : dd.startsWith("resource.bush") ? "The bush is picked bare."
            : dd.startsWith("resource.fishing") ? "The shoal moves on."
            : dd.startsWith("resource.herb") ? "The patch is picked clean."
            : dd.startsWith("resource.digsite") ? "The dig site is exhausted."
            : dd.startsWith("resource.plot") || dd.startsWith("resource.crop") ? "The crop is harvested."
            : "Nothing left to gather here.";
          this.toast(msg, "info");
          break;
        }
        case "containerOpened":
          this.chestPanelEl.classList.remove("hidden");
          this.inventoryPanelEl.classList.remove("hidden");
          this.refreshChest();
          this.refreshInventory();
          break;
        case "containerClosed":
          this.chestPanelEl.classList.add("hidden");
          break;
        case "workstationOpened":
          this.refreshRecipes(ev.instanceId);
          this.q(".recipe-panel").classList.remove("hidden");
          break;
        case "workstationClosed":
          this.q(".recipe-panel").classList.add("hidden");
          this.openStationId = null;
          break;
        case "shopOpened":
          this.refreshShop(ev.shopId);
          this.q(".shop-panel").classList.remove("hidden");
          this.inventoryPanelEl.classList.remove("hidden");
          this.refreshInventory();
          break;
        case "shopClosed":
          this.q(".shop-panel").classList.add("hidden");
          this.refreshInventory();
          break;
        case "npcChat": {
          // Quest dialogue wins over small talk; the QuestService already
          // processed this conversation, so its events arrive in this batch.
          const questSpokeThisBatch = events.some(
            (e) => e.type === "questStarted" || e.type === "questCompleted",
          );
          if (questSpokeThisBatch) break;
          const reminder = this.sim.quests.reminderFor(ev.instanceId);
          const own = this.sim.npcs.get(ev.instanceId)?.lines;
          const pool = own ?? NPC_LINES;
          const line = reminder ?? pool[this.npcLineIndex++ % pool.length];
          this.toast(`${ev.name}: “${line}”`, "speech");
          break;
        }
        case "questStarted": {
          const quest = QUESTS[ev.questId];
          this.toast(`Quest started: ${ev.name}`, "level", uiIconHtml("quest", 20));
          this.toast(`${npcName(quest.giverNpcId, this.sim)}: “${quest.intro}”`, "speech");
          break;
        }
        case "questCompleted": {
          const quest = QUESTS[ev.questId];
          this.toast(`${npcName(quest.giverNpcId, this.sim)}: “${quest.outro}”`, "speech");
          this.toast(`Quest complete: ${ev.name}!`, "level", uiIconHtml("quest", 20));
          break;
        }
        case "questAdvanced":
          // A small beat when a multi-step objective ticks off.
          this.toast(`✓ ${ev.label}`, "info");
          break;
        case "healthChanged":
          this.refreshHealth(ev.hp, ev.maxHp);
          break;
        case "buffApplied": {
          const BUFF_LINES: Record<string, string> = {
            speed: "Your legs feel light — swiftness flows through you!",
            strength: "Your arms surge with strength!",
            stoneskin: "Your skin sets like stone!",
            gathering: "Your hands find the sure grip — nothing slips away!",
            focus: "The world sharpens — your aim is true!",
            regen: "Warmth spreads through you; wounds begin to knit.",
          };
          this.toast(BUFF_LINES[ev.kind] ?? "You feel the brew take hold.", "info");
          break;
        }
        case "planted":
          this.toast(`Planted ${ITEMS[ev.seedItemId]?.name ?? "a seed"} — give it time to grow.`, "info");
          break;
        case "shortcutUsed":
          this.toast("You nip across the shortcut.", "info");
          break;
        case "thieveryCaught":
          this.toast(`Caught red-handed! You take ${ev.damage} damage scrambling away.`, "warn");
          break;
        case "slayerTaskAssigned":
          this.toast(`Warden Brusk: “Cull ${ev.count} × ${ev.enemyName}. Off you go.”`, "speech");
          break;
        case "slayerTaskProgress":
          this.toast(
            ev.remaining > 0
              ? `Slaying task: ${ev.remaining} × ${ev.enemyName} to go.`
              : "Slaying task done — report to Warden Brusk!",
            "info",
          );
          break;
        case "slayerTaskComplete":
          this.toast(`Warden Brusk pays out: +${ev.xp} Slaying xp, ${ev.coins} coins.`, "level", uiIconHtml("quest", 20));
          break;
        case "relicDonated":
          this.toast(
            ev.firstOfKind
              ? `Curator Fenwick beams: a ${ITEMS[ev.itemId]?.name ?? "relic"} for the collection! +${ev.xp} Archaeology xp.`
              : `Donated ${ev.qty} × ${ITEMS[ev.itemId]?.name ?? "relic"} (+${ev.xp} Archaeology xp).`,
            "info",
          );
          break;
        case "zoneEntered":
          this.toast(`— ${ev.name} —`, "level");
          this.toast(ev.blurb, "info");
          break;
        case "relicCollectionComplete":
          this.toast(`The village collection is complete! Fenwick presses ${ev.coins} coins on you.`, "level", uiIconHtml("quest", 20));
          break;
        case "ateFood":
          this.floatText(
            `${itemIconHtml(ev.itemId, ITEMS[ev.itemId].icon, 18)} +${ev.healed} ${uiIconHtml("heart", 16)}`,
            16,
            "#69f0ae",
          );
          break;
        case "playerAttack": {
          const pos = this.enemyScreenPos(ev.instanceId);
          this.floatAt(pos, ev.damage === null ? "miss" : `-${ev.damage}`, ev.damage === null ? "#c9ccd1" : "#ffd54a");
          break;
        }
        case "enemyAttack": {
          if (ev.damage !== null) this.floatText(`-${ev.damage}`, 17, "#ff7043");
          break;
        }
        case "enemyDied": {
          const enemy = this.sim.enemies.get(ev.instanceId);
          if (enemy) this.toast(`${ENEMIES[enemy.defId].name} defeated!`, "info");
          break;
        }
        case "playerDied":
          this.toast("You black out… and wake at camp.", "warn");
          break;
        default:
          break;
      }
    }
  }

  private rejectText(reason: string, targetId?: string): string {
    if (reason === "missing_inputs" && this.sim.actions.openShopId) return "Not enough coins.";
    const def = targetId ? NODES[this.sim.nodes.get(targetId)?.defId ?? ""] : undefined;
    switch (reason) {
      case "missing_tool": {
        const toolName = def ? TOOL_NAMES[def.toolTagsAny[0]] : undefined;
        return toolName ? `You need ${toolName} for that.` : "You're missing the right tool.";
      }
      case "level_too_low":
        return def ? `Your ${SKILLS[def.skillId].name} level is too low.` : "Your level is too low.";
      case "node_unavailable": return "There is nothing left to gather here.";
      case "missing_inputs": return "You don't have the ingredients for that.";
      case "unreachable": return "You can't reach that.";
      default: return "You can't do that.";
    }
  }

  /** The quest log: every quest, its status, giver and whereabouts. */
  private refreshQuestLog(): void {
    const list = this.q(".questlog-list");
    const MARKS: Record<string, [string, string]> = {
      ready: ["?", "#7cc243"],
      active: ["✦", "#ffd166"],
      available: ["!", "#ffd166"],
      locked: ["—", "#5d6773"],
      completed: ["✓", "#69f0ae"],
    };
    list.innerHTML = "";
    for (const entry of questLog(this.sim)) {
      const [mark, color] = MARKS[entry.status];
      const row = document.createElement("div");
      row.className = `questlog-row questlog-${entry.status}`;
      const sub =
        entry.status === "active" || entry.status === "ready"
          ? `${entry.objective ?? ""}${entry.progress ? ` (${entry.progress})` : ""}`
          : entry.status === "available"
            ? `See ${entry.where}`
            : entry.status === "locked"
              ? "Locked — finish earlier work first"
              : entry.where;
      row.innerHTML = `
        <span class="questlog-mark" style="color:${color}">${mark}</span>
        <span class="questlog-name">${entry.name}</span>
        <span class="questlog-sub">${sub}</span>`;
      list.append(row);
    }
  }

  /** Rotate the tracker's arrow toward the active objective. */
  updateQuestPointer(): void {
    const pointer = this.q(".quest-pointer") as HTMLElement;
    const target = activeQuestTarget(this.sim);
    if (!target) {
      pointer.style.visibility = "hidden";
      return;
    }
    const p = this.sim.movement.pos;
    const dx = target.cell.x + 0.5 - p.x;
    const dz = target.cell.z + 0.5 - p.z;
    if (Math.hypot(dx, dz) < 4 || (target.overworld && this.sim.world.region.id !== "region.vale_clearing")) {
      pointer.style.visibility = "hidden";
      return;
    }
    pointer.style.visibility = "visible";
    const yaw = (this.renderer.rig.yawDeg() * Math.PI) / 180;
    // Project the world delta into screen space (camera right / forward).
    const sx = dx * Math.cos(yaw) - dz * Math.sin(yaw);
    const sy = -dx * Math.sin(yaw) - dz * Math.cos(yaw);
    const deg = (Math.atan2(sx, sy) * 180) / Math.PI;
    // The glyph ➤ points right at rest; -90° brings it to "up".
    pointer.style.transform = `rotate(${deg - 90}deg)`;
  }

  private updateQuestTracker(): void {
    const tracker = this.q(".quest-tracker");
    for (const [questId, quest] of Object.entries(QUESTS)) {
      const state = this.sim.quests.states[questId];
      if (state?.status !== "active") continue;
      const objective = quest.objectives[state.objectiveIndex];
      if (!objective) continue;
      const countable = objective.type === "gather" || objective.type === "slay";
      const progress =
        countable && (objective.qty ?? 0) > 1
          ? ` (${Math.min(state.progress, objective.qty!)}/${objective.qty})`
          : "";
      this.q(".quest-name").textContent = quest.name;
      this.q(".quest-objective").textContent = `— ${objective.label}${progress}`;
      tracker.classList.remove("hidden");
      return;
    }
    tracker.classList.add("hidden");
  }

  /** Every skill ladder at a glance; tap a row for its activity breakdown. */
  private refreshSkillsPanel(): void {
    // Returning to the list view (e.g. on re-open) clears any open detail.
    this.q(".skill-detail").classList.add("hidden");
    const list = this.q(".skills-list");
    list.classList.remove("hidden");
    list.innerHTML = "";
    for (const skill of Object.values(SKILLS)) {
      const level = this.sim.skills.levelOf(skill.id);
      const xp = this.sim.skills.xp[skill.id] ?? 0;
      const curve = CURVES[skill.curveId];
      const cur = xpToReachLevel(curve, level);
      const next = xpToReachLevel(curve, level + 1);
      const frac = next > cur ? Math.min(1, (xp - cur) / (next - cur)) : 1;
      const row = document.createElement("button");
      row.className = "skills-row";
      row.setAttribute("data-testid", `skill-${skill.id}`);
      row.title = `${skill.name} — level ${level}/${skill.maxLevel}, ${xp} xp`;
      row.innerHTML = `
        <span class="skills-row-icon">${skillIconHtml(skill.id, 16)}</span>
        <span class="skills-row-name">${skill.name}</span>
        <span class="skills-row-level">${level}</span>
        <div class="xp-bar"><div class="xp-fill" style="width:${Math.round(frac * 100)}%"></div></div>`;
      row.addEventListener("click", () => this.showSkillDetail(skill.id));
      list.appendChild(row);
    }
  }

  /** The activity breakdown for one skill: what trains it, at what level. */
  private showSkillDetail(skillId: string): void {
    const skill = SKILLS[skillId];
    const level = this.sim.skills.levelOf(skillId);
    const acts = skillActivities(skillId);
    const ceiling = skillCeiling(skillId);
    const detail = this.q(".skill-detail");
    this.q(".skills-list").classList.add("hidden");
    detail.classList.remove("hidden");

    const rows = acts.length
      ? acts
          .map((a) => {
            const locked = level < a.level;
            const xp = a.xp > 0 ? `${a.xp} xp` : "varies";
            return `<div class="act-row${locked ? " act-locked" : ""}">
              <span class="act-lv">Lv ${a.level}</span>
              <span class="act-name">${a.verb} ${a.name}</span>
              <span class="act-where">${a.where}</span>
              <span class="act-xp">${xp}</span>
            </div>`;
          })
          .join("")
      : `<div class="act-empty">No trainable activities are placed in the world yet.</div>`;

    // A ceiling well below the cap is a content gap worth flagging to the player.
    const gap = ceiling > 0 && ceiling < skill.maxLevel - 10
      ? `<div class="act-note">Highest activity unlocks at Lv ${ceiling} — training past it needs higher-tier content.</div>`
      : "";

    detail.innerHTML = `
      <div class="skill-detail-head">
        <button class="btn small skill-back">‹ Skills</button>
        <span class="skills-row-icon">${skillIconHtml(skillId, 20)}</span>
        <span class="skill-detail-name">${skill.name}</span>
        <span class="skill-detail-lv">Lv ${level}/${skill.maxLevel}</span>
      </div>
      <div class="act-list">${rows}</div>
      ${gap}`;
    detail.querySelector(".skill-back")?.addEventListener("click", () => {
      detail.classList.add("hidden");
      this.q(".skills-list").classList.remove("hidden");
    });
  }

  /** Populate the workstation recipe sheet. */
  private refreshRecipes(stationId: string): void {
    this.openStationId = stationId;
    const placement = this.sim.world.region.objects.find((o) => o.instanceId === stationId);
    if (!placement) return;
    const def = OBJECTS[placement.defId];
    this.q(".station-name").textContent = def.name;
    const list = this.q(".recipe-list");
    list.innerHTML = "";
    for (const recipeId of def.workstationRecipeIds ?? []) {
      const recipe = RECIPES[recipeId];
      const levelOk = this.sim.skills.levelOf(recipe.skillId) >= recipe.requiredLevel;
      const hasIngredients = recipe.inputs.every((i) => this.sim.inventory.count(i.itemId) >= i.qty);
      const craftable = levelOk && hasIngredients;
      const row = document.createElement("button");
      row.className = "recipe-row" + (craftable ? "" : " uncraftable");
      row.setAttribute("data-testid", `recipe-${recipeId}`);
      const inputs = recipe.inputs
        .map((i) => `${i.qty}×${itemIconHtml(i.itemId, ITEMS[i.itemId].icon, 16)}`)
        .join(" + ");
      const output = recipe.outputs
        .map((o) => itemIconHtml(o.itemId, ITEMS[o.itemId].icon, 26))
        .join("");
      const requirement = levelOk
        ? ""
        : `<span class="recipe-req">${SKILLS[recipe.skillId].name} ${recipe.requiredLevel}</span>`;
      row.innerHTML = `<span class="recipe-out">${output}</span>
        <span class="recipe-name">${recipe.name}</span>
        ${requirement}
        <span class="recipe-inputs">${inputs}</span>`;
      row.addEventListener("click", () => {
        this.currentTargetName = def.name;
        this.currentVerb = SKILL_VERBS[recipe.skillId] ?? "Working at";
        this.sim.enqueue({ type: "craft", stationId, recipeId });
      });
      list.appendChild(row);
    }
  }

  /** Rebind to a new simulation after a region transition. */
  setSim(sim: GameSimulation): void {
    this.sim = sim;
    this.openStationId = null;
    this.chestPanelEl.classList.add("hidden");
    this.q(".recipe-panel").classList.add("hidden");
    this.refreshInventory();
    this.refreshSkill();
    this.refreshHealth(sim.hp, sim.maxHp());
  }

  /** Called every render frame for continuously-changing widgets. */
  update(): void {
    this.updateQuestPointer();
    this.updateQuestTracker();
    this.updateClock();
    const pipelineLive = this.sim.actions.phase !== "idle";
    this.targetPlateEl.classList.toggle("hidden", !pipelineLive);
    if (pipelineLive) {
      const phase = this.sim.actions.phase;
      const verb = phase === "movingToTarget" ? "Walking to" : this.currentVerb;
      this.targetNameEl.textContent = `${verb} ${this.currentTargetName}`;
      this.progressFillEl.style.width = `${Math.round(this.sim.actions.cycleProgress() * 100)}%`;
    }
  }

  /** World clock + weather in the corner: "☀ 09:40 · Day 2". */
  /** Debug: while on, a tooltip follows the cursor naming the block under it. */
  private inspectMove: ((e: PointerEvent) => void) | null = null;
  private setBlockInspect(on: boolean): void {
    const el = this.q(".block-inspect");
    if (this.inspectMove) {
      window.removeEventListener("pointermove", this.inspectMove);
      this.inspectMove = null;
    }
    if (!on) { el.classList.add("hidden"); return; }
    this.inspectMove = (e: PointerEvent) => {
      const cell = this.renderer.groundCellFromClient(e.clientX, e.clientY);
      if (!cell) { el.classList.add("hidden"); return; }
      const block = this.sim.world.blockAt(cell);
      const name = BLOCKS[block]?.name ?? block;
      el.textContent = `${name}  ·  ${block}  ·  ${cell.x},${cell.z}  ·  h${this.sim.world.heightAt(cell)}`;
      el.style.left = `${Math.min(e.clientX + 14, window.innerWidth - 240)}px`;
      el.style.top = `${e.clientY + 16}px`;
      el.classList.remove("hidden");
    };
    window.addEventListener("pointermove", this.inspectMove);
  }

  private updateClock(): void {
    const el = this.root.querySelector(".clock-text");
    if (!el) return;
    const mins = Math.floor(this.sim.dayFrac() * 24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    const w = this.sim.weather();
    const icon =
      w === "storm" ? "⛈" : w === "rain" ? "🌧" : w === "overcast" ? "☁" : this.sim.daylight() > 0 ? "☀" : "🌙";
    const text = `${icon} ${hh}:${mm} · Day ${this.sim.dayCount()}`;
    if (el.textContent !== text) el.textContent = text;
  }

  /** The chip shows the most recently trained skill. */
  private refreshSkill(): void {
    const skillId = this.shownSkillId;
    const level = this.sim.skills.levelOf(skillId);
    const xp = this.sim.skills.xp[skillId];
    const curve = CURVES[SKILLS[skillId].curveId];
    const cur = xpToReachLevel(curve, level);
    const next = xpToReachLevel(curve, level + 1);
    const frac = next > cur ? (xp - cur) / (next - cur) : 1;
    this.q(".skill-icon").innerHTML = skillIconHtml(skillId, 20);
    this.q(".skill-name").textContent = SKILLS[skillId].name;
    this.skillLevelEl.textContent = String(level);
    this.xpFillEl.style.width = `${Math.round(frac * 100)}%`;
    this.xpTextEl.textContent = `${xp} xp`;
  }

  private refreshInventory(): void {
    this.equipRowEl.innerHTML = "";
    const addCell = (
      label: string,
      itemId: string | null,
      onUnequip: () => void,
      testid?: string,
    ) => {
      const cell = document.createElement("div");
      cell.className = "equip-cell" + (itemId ? " filled" : "");
      if (testid && itemId) cell.setAttribute("data-testid", testid);
      if (itemId) {
        const item = ITEMS[itemId];
        const prot = item.protection ? ` (blocks ${Math.round(item.protection * 100)}%)` : "";
        cell.innerHTML = itemIconHtml(itemId, item.icon, 26);
        cell.title = `${item.name}${prot} — tap to unequip`;
        cell.addEventListener("click", onUnequip);
      } else {
        cell.textContent = label;
        cell.title = `${label}: empty`;
      }
      this.equipRowEl.appendChild(cell);
    };
    addCell("Tool", this.sim.equippedTool, () => this.sim.enqueue({ type: "unequip" }), "equipped");
    addCell("Head", this.sim.equippedArmor.head, () =>
      this.sim.enqueue({ type: "unequipArmor", slot: "head" }), "equipped-head");
    addCell("Body", this.sim.equippedArmor.body, () =>
      this.sim.enqueue({ type: "unequipArmor", slot: "body" }), "equipped-body");
    addCell("Feet", this.sim.equippedArmor.feet, () =>
      this.sim.enqueue({ type: "unequipArmor", slot: "feet" }),
    );
    addCell("Legs", this.sim.equippedArmor.legs, () =>
      this.sim.enqueue({ type: "unequipArmor", slot: "legs" }), "equipped-legs");
    const prot = this.sim.protection();
    if (prot > 0) {
      const badge = document.createElement("span");
      badge.className = "protection-badge";
      badge.textContent = `-${Math.round(prot * 100)}% dmg`;
      badge.title = "Total damage blocked by your armor";
      this.equipRowEl.appendChild(badge);
    }

    this.inventoryGridEl.innerHTML = "";
    const chestOpen = this.sim.actions.openContainerId !== null;
    // Keep the selection only while the same item is still in that slot.
    if (this.selectedSlot !== null && !this.sim.inventory.slots[this.selectedSlot]) {
      this.selectedSlot = null;
    }
    this.sim.inventory.slots.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "slot" + (this.selectedSlot === i ? " selected" : "");
      if (s) {
        const item = ITEMS[s.itemId];
        el.innerHTML = `${itemIconHtml(s.itemId, item.icon, 28)}${s.qty > 1 ? `<span class="qty">${s.qty}</span>` : ""}`;
        const shopOpen = this.sim.actions.openShopId !== null;
        const sellPrice = shopOpen ? this.sim.openShop()?.buys[s.itemId] : undefined;
        el.title = sellPrice ? `${item.name} — sells for ${sellPrice} coins` : item.name;
        if (shopOpen && sellPrice) el.classList.add("sellable");
        el.addEventListener("click", () => {
          if (chestOpen) {
            this.sim.enqueue({ type: "deposit", slot: i });
            return;
          }
          if (shopOpen) {
            if (sellPrice) this.sim.enqueue({ type: "shopSell", slot: i });
            else this.toast(`Mara has no use for ${item.name}.`, "info");
            return;
          }
          // Tap to inspect: show what it is, with an explicit action button.
          this.selectedSlot = this.selectedSlot === i ? null : i;
          this.refreshInventory();
        });
      } else if (this.selectedSlot === i) {
        this.selectedSlot = null;
      }
      this.inventoryGridEl.appendChild(el);
    });
    this.refreshItemInfo();
  }

  /** Info strip under the pack grid: name, what it does, and its action. */
  private refreshItemInfo(): void {
    const info = this.q(".item-info");
    const slot = this.selectedSlot !== null ? this.sim.inventory.slots[this.selectedSlot] : null;
    if (this.selectedSlot === null || !slot) {
      info.classList.add("hidden");
      info.innerHTML = "";
      return;
    }
    const item = ITEMS[slot.itemId];
    let action: { label: string; run: () => void } | null = null;
    if (item.buff) {
      const label = slot.itemId.startsWith("item.pouch.") ? "Summon"
        : slot.itemId.startsWith("item.gizmo.") ? "Activate" : "Drink";
      action = {
        label,
        run: () => this.sim.enqueue({ type: "eatSlot", slot: this.selectedSlot! }),
      };
    } else if (item.healAmount) {
      action = {
        label: `Eat (+${item.healAmount} HP)`,
        run: () => {
          if (this.sim.hp >= this.sim.maxHp()) this.toast("You're already at full health.", "info");
          else this.sim.enqueue({ type: "eatSlot", slot: this.selectedSlot! });
        },
      };
    } else if (item.toolTags || item.armorSlot) {
      action = {
        label: item.armorSlot ? "Wear" : "Equip",
        run: () => this.sim.enqueue({ type: "equipSlot", slot: this.selectedSlot! }),
      };
    } else if (item.firemaking) {
      const canLight = this.sim.skills.levelOf("skill.firemaking") >= item.firemaking.level;
      action = {
        label: canLight ? "Light" : `Light (Firemaking ${item.firemaking.level})`,
        run: () => {
          if (!canLight) this.toast(`Firemaking ${item.firemaking!.level} needed to light that.`, "info");
          else this.sim.enqueue({ type: "burnSlot", slot: this.selectedSlot! });
        },
      };
    } else if (item.prayer) {
      const canBury = this.sim.skills.levelOf("skill.prayer") >= item.prayer.level;
      action = {
        label: canBury ? "Bury" : `Bury (Prayer ${item.prayer.level})`,
        run: () => {
          if (!canBury) this.toast(`Prayer ${item.prayer!.level} needed to bury those.`, "info");
          else this.sim.enqueue({ type: "burySlot", slot: this.selectedSlot! });
        },
      };
    } else if (ALCH_VALUES[slot.itemId] !== undefined) {
      const magic = this.sim.skills.levelOf("skill.magic");
      const high = magic >= ALCHEMY.high.level && this.sim.inventory.count(ALCHEMY.high.rune) > 0;
      const low = magic >= ALCHEMY.low.level && this.sim.inventory.count(ALCHEMY.low.rune) > 0;
      const factor = high ? ALCHEMY.high.factor : ALCHEMY.low.factor;
      const coins = Math.max(1, Math.round(ALCH_VALUES[slot.itemId] * factor));
      action = {
        label: high ? `High Alch (+${coins})` : low ? `Low Alch (+${coins})` : "Alchemise",
        run: () => {
          if (!high && !low) {
            this.toast(magic < ALCHEMY.low.level ? "You need Magic to alchemise." : "You need a Blaze Rune or Wart Rune to cast that.", "info");
          } else this.sim.enqueue({ type: "alchSlot", slot: this.selectedSlot!, high });
        },
      };
    }
    info.innerHTML = `
      ${itemIconHtml(slot.itemId, item.icon, 30)}
      <span class="item-info-text">
        <span class="item-info-name">${item.name}${slot.qty > 1 ? ` ×${slot.qty}` : ""}</span>
        <span class="item-info-desc">${describeItem(item)}</span>
      </span>
      ${action ? `<button class="btn small item-action" data-testid="item-action"></button>` : ""}`;
    if (action) {
      const btn = info.querySelector(".item-action") as HTMLButtonElement;
      btn.textContent = action.label;
      btn.addEventListener("click", action.run);
    }
    info.classList.remove("hidden");
  }

  /** Populate the store: coin balance and the buy list. */
  private refreshShop(shopId: string): void {
    const shop = SHOPS[shopId];
    if (!shop) return;
    this.q(".shop-name").textContent = shop.name;
    this.q(".shop-coins").innerHTML =
      `${itemIconHtml("item.coin", "\u{1FA99}", 18)} ${this.sim.inventory.count("item.coin")}`;
    const stock = this.q(".shop-stock");
    stock.innerHTML = "";
    for (const offer of shop.sells) {
      const item = ITEMS[offer.itemId];
      const row = document.createElement("button");
      row.className = "recipe-row shop-row";
      row.setAttribute("data-testid", `shop-${offer.itemId}`);
      row.innerHTML = `<span class="recipe-out">${itemIconHtml(offer.itemId, item.icon, 24)}</span>
        <span class="recipe-name">${item.name}</span>
        <span class="shop-price">${itemIconHtml("item.coin", "\u{1FA99}", 15)} ${offer.price}</span>`;
      row.addEventListener("click", () => this.sim.enqueue({ type: "shopBuy", itemId: offer.itemId }));
      stock.appendChild(row);
    }
  }

  private refreshChest(): void {
    const chest = this.sim.openContainer();
    if (!chest) return;
    this.chestGridEl.innerHTML = "";
    chest.slots.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "slot";
      if (s) {
        const item = ITEMS[s.itemId];
        el.innerHTML = `${itemIconHtml(s.itemId, item.icon, 24)}${s.qty > 1 ? `<span class="qty">${s.qty}</span>` : ""}`;
        el.title = item.name;
        el.addEventListener("click", () => this.sim.enqueue({ type: "withdraw", slot: i }));
      }
      this.chestGridEl.appendChild(el);
    });
  }

  /** Click-to-identify: name the tree the player just tapped. */
  announceEntityTap(instanceId: string): void {
    const node = this.sim.nodes.instances.get(instanceId);
    if (!node) return;
    const def = NODES[node.defId];
    if (!def || !def.view.startsWith("tree")) return;
    const label = treeTapLabel(def.view, def.viewMaterial, def.name, instanceId);
    if (label !== this.lastTreeToast) {
      this.lastTreeToast = label;
      this.toast(label, "info", skillIconHtml("skill.woodcutting", 20));
    }
  }
  private lastTreeToast = "";

  toast(text: string, kind: "info" | "warn" | "level" | "speech" = "info", iconHtml?: string): void {
    const el = document.createElement("div");
    el.className = `toast toast-${kind}`;
    if (iconHtml) {
      el.innerHTML = `${iconHtml}<span></span>`;
      (el.lastElementChild as HTMLElement).textContent = text;
    } else {
      el.textContent = text;
    }
    this.toastStackEl.appendChild(el);
    const holdMs = kind === "speech" ? 4200 : 2200;
    setTimeout(() => el.classList.add("fade"), holdMs);
    setTimeout(() => el.remove(), holdMs + 800);
  }

  /** Show which texture pack is active plus its compatibility report. */
  setPackStatus(pack: ImportedPack | null): void {
    const el = this.q(".pack-status");
    if (!pack) {
      el.innerHTML = `<div class="pack-active">Active: <b>Built-in original art</b></div>`;
      return;
    }
    const { report } = pack;
    const missing = report.missing.length
      ? `<div class="pack-missing">Not covered (built-in art kept): ${report.missing
          .map((id) => id.split(".").slice(1).join(" "))
          .join(", ")}</div>`
      : "";
    const notes = report.notes.length
      ? `<div class="pack-notes">${report.notes.join(" · ")}</div>`
      : "";
    el.innerHTML = `
      <div class="pack-active">Active: <b>${escapeHtml(pack.name)}</b></div>
      <div class="pack-recognized">${report.recognized.length} texture(s) applied</div>
      ${missing}${notes}`;
  }

  markSaved(ok: boolean): void {
    this.saveDotEl.style.color = ok ? "#69f0ae" : "#ff8a65";
    this.saveDotEl.classList.remove("blip");
    void this.saveDotEl.offsetWidth; // restart animation
    this.saveDotEl.classList.add("blip");
  }

  private floatText(text: string, size = 15, color?: string): void {
    const pos = this.renderer.worldToScreen(this.renderer.playerWorldPos().add({ x: 0, y: 1.4, z: 0 } as never));
    this.floatAt(pos, text, color, size);
  }

  /** Text may contain icon <img> markup; all other content is static strings. */
  private floatAt(pos: { x: number; y: number }, text: string, color?: string, size = 15): void {
    const el = document.createElement("div");
    el.className = "float-text";
    el.style.left = `${pos.x + (Math.random() * 30 - 15)}px`;
    el.style.top = `${pos.y}px`;
    el.style.fontSize = `${size}px`;
    if (color) el.style.color = color;
    el.innerHTML = text;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  private enemyScreenPos(instanceId: string): { x: number; y: number } {
    const enemy = this.sim.enemies.get(instanceId);
    if (!enemy) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const h = this.sim.world.heightAt(enemy.movement.currentCell());
    return this.renderer.worldPointToScreen(enemy.movement.pos.x, h + 1, enemy.movement.pos.z);
  }

  private refreshHealth(hp: number, maxHp: number): void {
    const fill = this.q(".hp-fill");
    fill.style.width = `${Math.round((hp / maxHp) * 100)}%`;
    fill.classList.toggle("low", hp / maxHp <= 0.3);
    this.q(".hp-text").textContent = `${hp}/${maxHp}`;
  }
}
