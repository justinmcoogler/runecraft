// Authoritative actor movement along grid paths. Position is continuous (cell units,
// cell center = x + 0.5), advanced at a fixed speed per simulation tick.

import type { Cell } from "./types";

export type MovementResult = "idle" | "moving" | "arrived" | "blocked";

export class MovementController {
  pos = { x: 0, z: 0 }; // continuous, in cell units
  facing = 0; // radians, around +Y; 0 faces +Z
  speedCellsPerS = 3.5;
  private path: Cell[] = [];
  private justArrived = false;

  setCellPosition(cell: Cell): void {
    this.pos.x = cell.x + 0.5;
    this.pos.z = cell.z + 0.5;
    this.path = [];
  }

  currentCell(): Cell {
    return { x: Math.floor(this.pos.x), z: Math.floor(this.pos.z) };
  }

  isMoving(): boolean {
    return this.path.length > 0;
  }

  /** The cells still queued to walk (the live remaining path). Used by the sim
   *  to re-validate against blockers that stream in after the path was set. */
  remainingPath(): readonly Cell[] {
    return this.path;
  }

  setPath(path: Cell[]): void {
    this.path = path.slice();
    this.justArrived = path.length === 0;
  }

  stop(): void {
    this.path = [];
    this.justArrived = false;
  }

  faceToward(cell: Cell): void {
    const dx = cell.x + 0.5 - this.pos.x;
    const dz = cell.z + 0.5 - this.pos.z;
    if (dx !== 0 || dz !== 0) this.facing = Math.atan2(dx, dz);
  }

  tick(dtSeconds: number): MovementResult {
    if (this.justArrived) {
      this.justArrived = false;
      return "arrived";
    }
    if (this.path.length === 0) return "idle";
    let budget = this.speedCellsPerS * dtSeconds;
    while (budget > 0 && this.path.length > 0) {
      const target = this.path[0];
      const tx = target.x + 0.5;
      const tz = target.z + 0.5;
      const dx = tx - this.pos.x;
      const dz = tz - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= budget) {
        this.pos.x = tx;
        this.pos.z = tz;
        budget -= dist;
        this.path.shift();
      } else {
        this.pos.x += (dx / dist) * budget;
        this.pos.z += (dz / dist) * budget;
        this.facing = Math.atan2(dx, dz);
        budget = 0;
      }
    }
    return this.path.length === 0 ? "arrived" : "moving";
  }
}
