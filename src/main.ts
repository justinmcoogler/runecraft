// Boot + game loop. Fixed-tick simulation (10 Hz) driven by an accumulator;
// rendering runs at display rate and interpolates. Autosave + background save.

import "./ui/hud.css";
import { NODES } from "./content/content";
import { applyLayerToSim, emptyLayer, parseLayer, WorldEditor } from "./editor/panel";
import { serializeLayer, type EditorLayer } from "./editor/layer";
import { InputController } from "./input/input";
import { CameraPanel } from "./ui/camera-panel";
import { MapPanel } from "./ui/map-panel";
import { Sfx, type SfxName } from "./render/audio";
import { GameRenderer } from "./render/renderer";
import { isModelEnabled, loadModelPrefs } from "./render/model-prefs";
import { setPackIconProvider } from "./ui/icons";
import {
  applyRegionState,
  applySharedState,
  captureRegionState,
  captureSharedState,
  deleteEndlessWorld,
  listEndlessWorlds,
  loadEndlessFromStorage,
  loadFromStorage,
  peekEndlessSeed,
  peekRegionId,
  saveEndlessToStorage,
  saveToStorage,
  type RegionSnapshot,
} from "./save/save";
import { showStartScreen } from "./ui/start-screen";
import { GameSimulation } from "./sim/simulation";
import { TUTORIAL_SEED } from "./sim/worldgen/endless";
import { TICK_DT, type SimEvent } from "./sim/types";
import { buildRegion } from "./sim/world";
import { importPackFile, type ImportedPack } from "./texturepacks/importer";
import { Hud } from "./ui/hud";

const AUTOSAVE_INTERVAL_S = 30;
const SKIN_STORAGE_KEY = "stoneleaf.skin.player";
const PACK_STORAGE_KEY = "stoneleaf.texturepack.active";
const EDITOR_LAYER_KEY = "stoneleaf.editor.layer";

function loadEditorLayer(key: string = EDITOR_LAYER_KEY): EditorLayer {
  try {
    const json = localStorage.getItem(key);
    if (json) return parseLayer(json) ?? emptyLayer();
  } catch {
    // fall through to a clean layer
  }
  return emptyLayer();
}

const GATHER_SFX: Record<string, SfxName> = {
  "skill.woodcutting": "chop",
  "skill.mining": "clink",
  "skill.foraging": "rustle",
  "skill.fishing": "splash",
  "skill.farming": "rustle",
  "skill.herblore": "rustle",
  "skill.archaeology": "clink",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

async function boot(): Promise<void> {
  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const hudRoot = document.getElementById("hud") as HTMLElement;

  // Multi-region: the sim owns one region at a time; other regions' world
  // state is kept in a snapshot store (world time pauses while away).
  let currentRegionId = peekRegionId() ?? "region.vale_clearing";
  const regionStore: Record<string, RegionSnapshot> = {};
  const seed = () => Date.now() % 2147483647;
  // Tutorial graduation: once the player steps through the vale's gateway into
  // the wild, they never see the tutorial again (New World goes straight to a
  // random world). Persisted so it survives reloads.
  const TUTORIAL_DONE_KEY = "runecraft.tutorial.done";
  const tutorialDone = (): boolean => {
    try { return localStorage.getItem(TUTORIAL_DONE_KEY) === "1"; } catch { return false; }
  };
  const markTutorialDone = (): void => {
    try { localStorage.setItem(TUTORIAL_DONE_KEY, "1"); } catch { /* ignore */ }
  };
  // The endless world's seed, so we can rebuild it when returning from a
  // dungeon (the endless region isn't a static REGION_BUILDERS entry).
  let endlessSeed = 0;
  const params = new URLSearchParams(window.location.search);

  // World selection. The seeded endless world is the default now; the
  // authored province is "story mode" behind ?province (its own save still
  // loads there). ?seed=N picks a specific endless world; otherwise we keep
  // playing the last endless seed, or roll a fresh one for a new player.
  const savedEndlessSeed = peekEndlessSeed();
  const endlessMode = !params.has("province");

  // Start screen: choose New World / Continue unless a seed is deep-linked
  // (?seed=N, used by tests and shared-world links) or we're in authored
  // "story" mode (?province). A chosen seed with fresh=true skips restore.
  let chosenSeed: number | null =
    params.get("seed") !== null ? Math.abs(Number(params.get("seed"))) % 2147483647 || 1 : null;
  let freshWorld = false;
  if (endlessMode && chosenSeed === null) {
    const choice = await showStartScreen({
      worlds: listEndlessWorlds(),
      onDelete: (s) => deleteEndlessWorld(s),
    });
    chosenSeed = choice.seed;
    freshWorld = choice.fresh;
  }

  let sim: GameSimulation;
  let restored = false;
  // Editor placements are saved per world: one layer for the authored vale,
  // one per endless seed (so edits follow their own world, not each other's).
  let editorLayerKey = EDITOR_LAYER_KEY;
  if (endlessMode) {
    const chosen = chosenSeed ?? savedEndlessSeed ?? seed();
    // First-ever New World starts in the TUTORIAL vale; stepping through its
    // gateway later graduates the player into `chosen` (their own random world).
    if (freshWorld && !tutorialDone() && params.get("seed") === null) {
      currentRegionId = "region.tutorial";
      endlessSeed = chosen; // the world they'll graduate into
      sim = GameSimulation.createTutorial(TUTORIAL_SEED);
      editorLayerKey = `${EDITOR_LAYER_KEY}.tutorial`;
      restored = false;
    } else {
      currentRegionId = "region.endless";
      sim = GameSimulation.createEndless(chosen);
      endlessSeed = sim.seed;
      editorLayerKey = `${EDITOR_LAYER_KEY}.e.${sim.seed}`;
      // Editor edits apply before the save restores player state and the scene builds.
      applyLayerToSim(sim, loadEditorLayer(editorLayerKey));
      restored = freshWorld ? false : loadEndlessFromStorage(sim);
    }
  } else {
    sim = new GameSimulation(buildRegion(currentRegionId), seed());
    applyLayerToSim(sim, loadEditorLayer(editorLayerKey));
    restored = loadFromStorage(sim, regionStore);
  }

  loadModelPrefs();
  // Disabled dragons (Models settings) never stream into endless chunks.
  sim.spawnFilter = (defId) => isModelEnabled(defId);
  const renderer = new GameRenderer(canvas, sim);
  setPackIconProvider((materialId) => renderer.materials.iconDataUrl(materialId));
  const hud = new Hud(hudRoot, sim, renderer);
  const input = new InputController(canvas, sim, renderer);
  input.onEntityTapped = (id) => hud.announceEntityTap(id);

  if (currentRegionId === "region.tutorial") {
    hud.toast("Welcome to Runecraft! Learn the ropes in the vale, then step through the glowing gateway to enter your own world.", "info");
  } else if (restored) hud.toast("Welcome back — progress restored.", "info");
  else if (endlessMode) hud.toast("Grab the tools from the camp chest, then explore the wilds!", "info");
  else hud.toast("Tap a tree to start chopping!", "info");

  // The world editor: place and remove imported structures live.
  const editor = new WorldEditor({
    hudRoot,
    renderer,
    getSim: () => sim,
    loadLayer: () => loadEditorLayer(editorLayerKey),
    saveLayer: (layer) => {
      try {
        localStorage.setItem(editorLayerKey, serializeLayer(layer));
      } catch {
        hud.toast("Couldn't save world edits (storage full?)", "warn");
      }
    },
    toast: (message) => hud.toast(message, "info"),
  });
  input.editor = editor;
  new CameraPanel(hudRoot, renderer.rig);
  if (!endlessMode) new MapPanel(hudRoot, () => sim);

  // Character skins: apply a persisted skin, and handle uploads from the HUD.
  const applySkinDataUrl = async (dataUrl: string, persist: boolean): Promise<void> => {
    const img = await loadImage(dataUrl);
    renderer.setPlayerSkin(img); // throws on unsupported sizes
    if (persist) localStorage.setItem(SKIN_STORAGE_KEY, dataUrl);
  };
  const persisted = localStorage.getItem(SKIN_STORAGE_KEY);
  if (persisted) {
    applySkinDataUrl(persisted, false).catch(() => localStorage.removeItem(SKIN_STORAGE_KEY));
  }
  hud.callbacks.onSkinFile = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      applySkinDataUrl(String(reader.result), true)
        .then(() => hud.toast("Skin applied.", "info"))
        .catch((err: Error) => hud.toast(err.message, "warn"));
    };
    reader.readAsDataURL(file);
  };
  hud.callbacks.onSkinReset = () => {
    localStorage.removeItem(SKIN_STORAGE_KEY);
    renderer.setPlayerSkin(null);
    hud.toast("Default skin restored.", "info");
  };

  // Texture packs: user-supplied resource-pack ZIPs reskin recognized materials.
  // Strictly cosmetic; the pack never leaves this device and nothing ships with it.
  const applyPack = async (pack: ImportedPack | null): Promise<void> => {
    await renderer.applyTexturePack(pack ? pack.textures : null);
    hud.setPackStatus(pack);
  };
  const persistedPack = localStorage.getItem(PACK_STORAGE_KEY);
  if (persistedPack) {
    try {
      const pack = JSON.parse(persistedPack) as ImportedPack;
      if (!pack || typeof pack.textures !== "object") throw new Error("bad pack");
      void applyPack(pack);
    } catch {
      localStorage.removeItem(PACK_STORAGE_KEY);
    }
  }
  hud.callbacks.onPackFile = (file) => {
    importPackFile(file).then(({ pack, error }) => {
      if (!pack) {
        hud.toast(error ?? "Could not import that pack.", "warn");
        return;
      }
      applyPack(pack).then(() => {
        try {
          localStorage.setItem(PACK_STORAGE_KEY, JSON.stringify(pack));
        } catch {
          hud.toast("Pack applied, but too large to remember between sessions.", "warn");
        }
        hud.toast(`Texture pack "${pack.name}" applied — ${pack.report.recognized.length} texture(s).`, "info");
      });
    });
  };
  hud.callbacks.onPackReset = () => {
    localStorage.removeItem(PACK_STORAGE_KEY);
    void applyPack(null);
    hud.toast("Built-in art restored.", "info");
  };

  // Procedural sound effects, unlocked by the first user gesture.
  const sfx = new Sfx();
  const gatherSfx = (targetId: string): SfxName => {
    const node = sim.nodes.get(targetId);
    if (node) return GATHER_SFX[NODES[node.defId].skillId] ?? "chop";
    const obj = sim.world.region.objects.find((o) => o.instanceId === targetId);
    if (obj?.defId === "object.campfire.basic") return "sizzle";
    if (obj?.defId === "object.furnace.basic") return "forge";
    if (obj?.defId === "object.anvil.basic") return "anvil";
    if (obj?.defId === "object.workbench.basic") return "chop";
    if (obj?.defId === "object.cauldron.basic") return "sizzle";
    if (obj?.defId === "object.enchanter.basic") return "level";
    return "chop";
  };
  window.addEventListener("pointerdown", () => sfx.unlock(), { once: true });
  window.addEventListener("keydown", () => sfx.unlock(), { once: true });

  window.addEventListener("resize", () => renderer.resize());

  // Persist: the endless world stores seed + player state (chunks regrow on
  // reload until per-chunk diffs land); the province stores everything.
  const doSave = () => {
    if (endlessMode) {
      // Only the boundless overworld persists; dungeon floors are transient
      // (their loot lands in the shared inventory, saved on the way out).
      if (currentRegionId === "region.endless") hud.markSaved(saveEndlessToStorage(sim));
    } else {
      hud.markSaved(saveToStorage(sim, regionStore));
    }
  };

  /** Travel through a portal: park this region's state, wake the target's. */
  function enterRegion(targetRegionId: string, targetCell: { x: number; z: number }): void {
    const shared = captureSharedState(sim);
    // Graduation: stepping from the tutorial vale into the wild finishes the
    // tutorial for good and drops the player into their own random world.
    const graduating = currentRegionId === "region.tutorial" && targetRegionId === "region.endless";
    if (graduating) markTutorialDone();
    // Endless / tutorial worlds regenerate around the player, so their state is
    // never parked or restored; only finite regions snapshot.
    if (currentRegionId !== "region.endless" && currentRegionId !== "region.tutorial") {
      regionStore[currentRegionId] = captureRegionState(sim);
    }
    currentRegionId = targetRegionId;
    if (targetRegionId === "region.endless") {
      // Rebuild the boundless world (not a static region builder) and let it
      // stream around the arrival cell; edits reapply per seed.
      sim = GameSimulation.createEndless(endlessSeed);
      editorLayerKey = `${EDITOR_LAYER_KEY}.e.${endlessSeed}`;
      applyLayerToSim(sim, loadEditorLayer(editorLayerKey));
    } else if (targetRegionId === "region.tutorial") {
      sim = GameSimulation.createTutorial(TUTORIAL_SEED);
    } else {
      sim = new GameSimulation(buildRegion(targetRegionId), seed());
      if (targetRegionId === "region.vale_clearing") applyLayerToSim(sim, loadEditorLayer());
    }
    // Every fresh sim needs the model-preference spawn veto re-attached.
    sim.spawnFilter = (defId) => isModelEnabled(defId);
    applySharedState(sim, shared);
    const snapshot = targetRegionId === "region.endless" ? undefined : regionStore[targetRegionId];
    if (snapshot) applyRegionState(sim, snapshot);
    // Graduating: the tutorial's cell has no meaning in the new random world \u2014
    // drop the player on that world's own chosen spawn instead.
    sim.movement.setCellPosition(graduating ? sim.world.region.spawn : targetCell);
    renderer.bindSim(sim);
    input.setSim(sim);
    hud.setSim(sim);
    editor.setActive(false);
    if (graduating) {
      hud.toast("You step through the gateway into the wild \u2014 your world awaits!", "info");
    } else {
      const TRAVEL_TOASTS: Record<string, string> = {
        "region.copper_hollow": "You squeeze through the cave mouth into Copper Hollow\u2026",
        "region.town_store": "You step into Mara's General Store.",
        "region.town_inn": "You step into the warm inn.",
        "region.vale_clearing": "You step back outside.",
      };
      hud.toast(TRAVEL_TOASTS[targetRegionId] ?? "You step through.", "info");
    }
    doSave();
    publishHooks();
  }

  // A staircase prompt: click stairs to pick up or down (a landing can serve
  // both floors), rather than travelling on the first tap.
  let stairsPopup: HTMLElement | null = null;
  function showStairsChoice(options: Array<{ dir: "up" | "down"; targetRegionId: string; targetCell: { x: number; z: number } }>): void {
    if (!document.getElementById("stairs-choice-styles")) {
      const style = document.createElement("style");
      style.id = "stairs-choice-styles";
      style.textContent = `
        .stairs-choice {
          position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%);
          z-index: 40; background: rgba(20, 26, 33, 0.96); border: 2px solid #3c4654;
          border-radius: 12px; padding: 14px 16px; pointer-events: auto;
          display: flex; flex-direction: column; gap: 10px; min-width: 200px;
        }
        .stairs-choice-title { color: #e8eef6; font-weight: bold; text-align: center; }
        .stairs-choice-row { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
        .stairs-choice-row button {
          background: #2c3a4a; color: #dfe8f2; border: 1px solid #4a5a6c;
          border-radius: 8px; padding: 8px 14px; font: inherit; cursor: pointer;
        }
        .stairs-choice-row button:hover { border-color: #6f8398; background: #34465a; }
        .stairs-choice-cancel { background: #2a2f37 !important; color: #a9b4c0 !important; }
      `;
      document.head.append(style);
    }
    stairsPopup?.remove();
    const box = document.createElement("div");
    box.className = "stairs-choice";
    const title = document.createElement("div");
    title.className = "stairs-choice-title";
    title.textContent = "Take the stairs…";
    box.append(title);
    const row = document.createElement("div");
    row.className = "stairs-choice-row";
    const close = () => { box.remove(); stairsPopup = null; };
    for (const opt of options) {
      const btn = document.createElement("button");
      btn.textContent = opt.dir === "up" ? "⬆️ Go up" : "⬇️ Go down";
      btn.addEventListener("click", () => { close(); enterRegion(opt.targetRegionId, opt.targetCell); });
      row.append(btn);
    }
    const cancel = document.createElement("button");
    cancel.className = "stairs-choice-cancel";
    cancel.textContent = "Stay";
    cancel.addEventListener("click", close);
    row.append(cancel);
    box.append(row);
    hudRoot.append(box);
    stairsPopup = box;
  }

  // Background/lifecycle saves: assume the OS may kill the tab/app at any time.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") doSave();
  });
  window.addEventListener("pagehide", doSave);

  let autosaveTimer = 0;
  let accumulator = 0;
  let last = performance.now();

  function frame(now: number): void {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;

    accumulator += dt;
    let pendingPortal: { targetRegionId: string; targetCell: { x: number; z: number } } | null = null;
    const frameEvents: SimEvent[] = [];
    while (accumulator >= TICK_DT) {
      accumulator -= TICK_DT;
      const events = sim.tick();
      renderer.handleEvents(events);
      hud.handleEvents(events);
      frameEvents.push(...events);
      for (const ev of events) {
        if (ev.type === "portalEntered") {
          // The graduation gateway stays shut until the required lessons are
          // done; stepping into it early just nudges the player back to work.
          if (
            currentRegionId === "region.tutorial" &&
            ev.targetRegionId === "region.endless" &&
            sim.tutorial &&
            !sim.tutorial.complete
          ) {
            hud.toast("The gateway isn't open yet — finish your lessons first.", "warn");
          } else {
            pendingPortal = ev;
          }
        }
        // Died far from home: travel back to the bed's region (province only).
        else if (ev.type === "respawnTravel") pendingPortal = ev;
        else if (ev.type === "stairsChoice") showStairsChoice(ev.options);
      }
      for (const ev of events) {
        if (ev.type === "actionCycle") sfx.play(ev.success ? gatherSfx(ev.targetId) : "chopMiss");
        else if (ev.type === "itemGained") sfx.play("item");
        else if (ev.type === "levelUp") sfx.play("level");
        else if (ev.type === "nodeDepleted") sfx.play("deplete");
        else if (ev.type === "nodeRespawned") sfx.play("respawn");
        else if (ev.type === "actionRejected" || ev.type === "inventoryFull") sfx.play("reject");
        else if (ev.type === "containerOpened") sfx.play("chest");
        else if (ev.type === "ateFood") sfx.play("eat");
        else if (ev.type === "playerAttack") sfx.play(ev.damage === null ? "whiff" : "hit");
        else if (ev.type === "enemyAttack" && ev.damage !== null) sfx.play("hurt");
        else if (ev.type === "enemyDied") sfx.play("slain");
        else if (ev.type === "playerDied") sfx.play("died");
        else if (ev.type === "playerSlept") {
          hud.toast(
            ev.restedTillDawn
              ? "You sleep until dawn. Your bed is now your respawn point."
              : "You rest a moment. Your bed is now your respawn point.",
            "info",
          );
          doSave();
        }
      }
      // Checkpoint saves on meaningful progress moments.
      if (events.some((e) => e.type === "levelUp" || e.type === "containerClosed")) doSave();
    }
    if (pendingPortal) {
      enterRegion(pendingPortal.targetRegionId, pendingPortal.targetCell);
      pendingPortal = null;
    }
    // World repairs (quest flags) change terrain: rebuild the presentation.
    for (const ev of frameEvents) {
      if (ev.type !== "worldFlagSet") continue;
      renderer.bindSim(sim);
      const FLAG_TOASTS: Record<string, string> = {
        "worldstate.jetty_built": "The jetty stands — new waters to fish!",
        "worldstate.footbridge_built": "The footbridge is rebuilt — a shortcut over the river!",
      };
      hud.toast(FLAG_TOASTS[ev.flag] ?? "The world has changed.", "info");
      doSave();
    }
    frameEvents.length = 0;

    autosaveTimer += dt;
    if (autosaveTimer >= AUTOSAVE_INTERVAL_S) {
      autosaveTimer = 0;
      doSave();
    }

    hud.update();
    renderer.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  publishHooks();

  // Dev/testing hooks (also used by e2e tests). Refreshed on region change.
  function publishHooks(): void {
    (window as unknown as Record<string, unknown>).__stoneleaf = {
      // Live getter: `sim` is reassigned on every region change, so a fixed
      // reference would go stale after travelling through a portal.
      get sim() { return sim; },
      renderer,
      save: doSave,
      regionId: () => currentRegionId,
      enterRegion,
    };
  }
}

void boot();
