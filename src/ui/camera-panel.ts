// Camera panel: live sliders for rotation, tilt and zoom, plus a reset.
// The same rig also answers right-mouse drag (orbit), Q/E (snap turns),
// R/F (tilt) and the wheel (zoom); sliders re-sync while the panel is open.

import type { CameraRig } from "../render/camera";

export class CameraPanel {
  private panel: HTMLElement;
  private button: HTMLButtonElement;
  private open = false;
  private syncTimer: number | null = null;
  private rotation!: HTMLInputElement;
  private tilt!: HTMLInputElement;
  private zoom!: HTMLInputElement;

  constructor(hudRoot: HTMLElement, private rig: CameraRig) {
    this.injectStyles();
    this.button = document.createElement("button");
    this.button.className = "camera-toggle";
    this.button.innerHTML = `\u{1F4F7} <span class="tlabel">Camera</span>`;
    this.button.addEventListener("click", () => this.setOpen(!this.open));

    this.panel = document.createElement("div");
    this.panel.className = "camera-panel";
    this.panel.style.display = "none";
    this.buildPanel();

    (hudRoot.querySelector(".settings-actions") ?? hudRoot).append(this.button);
    hudRoot.append(this.panel);
  }

  private setOpen(open: boolean): void {
    this.open = open;
    this.panel.style.display = open ? "flex" : "none";
    this.button.classList.toggle("camera-toggle-on", open);
    if (open) {
      this.syncFromRig();
      this.syncTimer = window.setInterval(() => this.syncFromRig(), 250);
    } else if (this.syncTimer !== null) {
      window.clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  private slider(
    label: string,
    min: number,
    max: number,
    step: number,
    onInput: (value: number) => void,
  ): { row: HTMLElement; input: HTMLInputElement } {
    const row = document.createElement("label");
    row.className = "camera-row";
    const text = document.createElement("span");
    text.textContent = label;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.addEventListener("input", () => onInput(Number(input.value)));
    row.append(text, input);
    return { row, input };
  }

  private buildPanel(): void {
    const title = document.createElement("div");
    title.className = "camera-title";
    title.textContent = "Camera";
    this.panel.append(title);

    const rotation = this.slider("Rotation", 0, 359, 1, (v) => this.rig.setYawDeg(v));
    const tilt = this.slider("Tilt", 15, 80, 1, (v) => this.rig.setPitchDeg(v));
    const zoom = this.slider("Zoom out", 4, 48, 1, (v) => this.rig.setZoomHalfHeight(v));
    this.rotation = rotation.input;
    this.tilt = tilt.input;
    this.zoom = zoom.input;
    this.panel.append(rotation.row, tilt.row, zoom.row);

    const reset = document.createElement("button");
    reset.className = "camera-reset";
    reset.textContent = "Reset view";
    reset.addEventListener("click", () => {
      this.rig.resetView();
      this.syncFromRig();
    });
    this.panel.append(reset);

    const hint = document.createElement("div");
    hint.className = "camera-hint";
    hint.textContent = "Right-drag to orbit · Q/E turn · R/F tilt · wheel zoom · Space re-centers";
    this.panel.append(hint);
  }

  private syncFromRig(): void {
    if (document.activeElement !== this.rotation) this.rotation.value = String(Math.round(this.rig.yawDeg()));
    if (document.activeElement !== this.tilt) this.tilt.value = String(Math.round(this.rig.pitchDeg()));
    if (document.activeElement !== this.zoom) this.zoom.value = String(Math.round(this.rig.zoomHalf()));
  }

  private injectStyles(): void {
    if (document.getElementById("camera-styles")) return;
    const style = document.createElement("style");
    style.id = "camera-styles";
    style.textContent = `
      .camera-toggle {
        background: #1d232b; color: #cfd8e3; border: 2px solid #3c4654;
        border-radius: 8px; padding: 8px 12px; font: inherit; cursor: pointer;
        pointer-events: auto;
      }
      .camera-toggle-on { background: #27384d; border-color: #5d86b5; color: #e2eefc; }
      .camera-panel {
        position: absolute; left: 12px; bottom: 104px; width: 240px; z-index: 30;
        display: flex; flex-direction: column; gap: 10px;
        background: rgba(20, 26, 33, 0.94); border: 2px solid #3c4654;
        border-radius: 10px; padding: 12px; pointer-events: auto;
      }
      .camera-title { font-weight: bold; color: #e8eef6; }
      .camera-row { display: flex; flex-direction: column; gap: 4px; color: #9fb2c5; font-size: 13px; }
      .camera-row input { width: 100%; accent-color: #5d86b5; }
      .camera-reset {
        background: #262e38; color: #cfd8e3; border: 1px solid #3c4654;
        border-radius: 6px; padding: 6px 8px; font: inherit; cursor: pointer;
      }
      .camera-hint { color: #71818f; font-size: 11px; line-height: 1.5; }
    `;
    document.head.append(style);
  }
}
