// Unified input: raw pointer/wheel/key events -> gestures -> shared game commands.
// Gameplay never learns whether a command came from mouse, touch, or keyboard.
// A gesture is classified exactly once; multi-touch suppresses world taps.

import type { GameRenderer, PickResult } from "../render/renderer";
import type { GameSimulation } from "../sim/simulation";
import type { Cell } from "../sim/types";

/** The world editor plugs in here; while active it owns taps and hover. */
export interface EditorInputTarget {
  isActive(): boolean;
  onHover(cell: Cell | null): void;
  /** Return true when the tap was consumed by the editor. */
  onTap(hit: PickResult, cell: Cell | null): boolean;
  /** Return true when the key was consumed by the editor. */
  onKey(key: string): boolean;
}

const TAP_MAX_MS = 350;
const TAP_MAX_MOVE_PX = 12;
const MULTITOUCH_COOLDOWN_MS = 150;

interface PointerRecord {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  startTime: number;
  mode: "pending" | "drag" | "orbit";
  button: number;
}

export class InputController {
  editor: EditorInputTarget | null = null;
  /** Optional observer: fires after a world-entity tap is dispatched. */
  onEntityTapped: ((instanceId: string) => void) | null = null;
  private pointers = new Map<number, PointerRecord>();
  private lastMultiTouchEnd = 0;
  private pinchStartDist = 0;
  private pinchStartApplied = false;

  /** Rebind to a new simulation after a region transition. */
  setSim(sim: GameSimulation): void {
    this.sim = sim;
  }

  constructor(
    private canvas: HTMLCanvasElement,
    private sim: GameSimulation,
    private renderer: GameRenderer,
  ) {
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onCancel);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private onDown = (e: PointerEvent): void => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      startTime: performance.now(),
      mode: "pending",
      button: e.button,
    });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStartDist = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
      this.pinchStartApplied = false;
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (this.editor?.isActive() && this.pointers.size === 0) {
      // Mouse hover (no button): drive the editor's ghost preview.
      this.editor.onHover(this.renderer.groundCellFromClient(e.clientX, e.clientY));
    }
    const rec = this.pointers.get(e.pointerId);
    if (!rec) return;
    const dx = e.clientX - rec.lastX;
    const dy = e.clientY - rec.lastY;
    rec.lastX = e.clientX;
    rec.lastY = e.clientY;

    if (this.pointers.size >= 2) {
      // Pinch zoom: world taps are suppressed while (and shortly after) multi-touch.
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.lastX - b.lastX, a.lastY - b.lastY);
      if (this.pinchStartDist > 0 && Math.abs(dist - this.pinchStartDist) > 8) {
        this.pinchStartApplied = true;
        this.renderer.rig.zoomBy(this.pinchStartDist / dist);
        this.pinchStartDist = dist;
      }
      return;
    }

    const movedFromStart = Math.hypot(e.clientX - rec.startX, e.clientY - rec.startY);
    if (rec.mode === "pending" && movedFromStart > TAP_MAX_MOVE_PX) {
      // Classified once; can never become a tap again. Right-button (or
      // ctrl-held) drags orbit the camera instead of panning.
      rec.mode = rec.button === 2 || e.ctrlKey ? "orbit" : "drag";
    }
    // Screen-drag panning is disabled: the camera always stays on the player
    // (right-drag still orbits). Roaming the camera let players stare at
    // streaming chunk edges and get lost from their character.
    if (rec.mode === "orbit") {
      this.renderer.rig.orbitBy(dx * -0.006, dy * 0.004);
    }
  };

  private onUp = (e: PointerEvent): void => {
    const rec = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size >= 1) {
      this.lastMultiTouchEnd = performance.now();
      return;
    }
    if (!rec) return;

    const wasMultiTouch =
      this.pinchStartApplied ||
      performance.now() - this.lastMultiTouchEnd < MULTITOUCH_COOLDOWN_MS;
    const duration = performance.now() - rec.startTime;

    if (rec.mode === "pending" && duration <= TAP_MAX_MS && !wasMultiTouch) {
      this.handleTap(e.clientX, e.clientY);
    }
    this.pinchStartApplied = false;
  };

  private onCancel = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
  };

  private handleTap(clientX: number, clientY: number): void {
    const hit = this.renderer.pick(clientX, clientY);
    if (this.editor?.isActive()) {
      const cell = this.renderer.groundCellFromClient(clientX, clientY);
      if (this.editor.onTap(hit, cell)) return;
    }
    if (!hit) return;
    if (hit.kind === "entity") {
      this.sim.enqueue({ type: "interact", targetId: hit.instanceId });
      this.onEntityTapped?.(hit.instanceId);
    } else {
      this.sim.enqueue({ type: "moveTo", cell: hit.cell });
    }
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.renderer.rig.zoomBy(e.deltaY > 0 ? 1.1 : 1 / 1.1);
  };

  private onKey = (e: KeyboardEvent): void => {
    if (this.editor?.isActive() && this.editor.onKey(e.key)) return;
    switch (e.key) {
      case "q":
      case "Q":
        this.renderer.rig.rotate(-1);
        break;
      case "e":
      case "E":
        this.renderer.rig.rotate(1);
        break;
      case " ":
        this.renderer.rig.center();
        break;
      // R belongs to the HUD's run/walk toggle. Camera tilt lives in the
      // camera popup (and V), so the two no longer fight over one key.
      case "v":
      case "V":
        this.renderer.rig.orbitBy(0, 0.06); // tilt toward top-down
        break;
      case "f":
      case "F":
        this.renderer.rig.orbitBy(0, -0.06); // flatten toward the horizon
        break;
      case "Escape":
        this.sim.enqueue({ type: "cancel" });
        break;
      default:
        break;
    }
  };
}
