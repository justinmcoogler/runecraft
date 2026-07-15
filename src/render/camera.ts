// Orthographic camera rig: follow, pan, zoom, free orbit (yaw + pitch),
// 90-degree snap stepping, re-center. Fully adjustable in-game via the
// camera panel and right-mouse drag.

import * as THREE from "three";

const PITCH_DEFAULT_DEG = 38;
const PITCH_MIN_DEG = 15;
const PITCH_MAX_DEG = 80;
const YAW_DEFAULT_DEG = 45;
const BOOM_DIST = 120;
const ZOOM_MIN = 4;
const ZOOM_MAX = 48;
const ZOOM_DEFAULT = 9;

export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  private target = new THREE.Vector3();
  private yawCurrent = THREE.MathUtils.degToRad(YAW_DEFAULT_DEG);
  /** Snap-tween destination (Q/E steps); null while freely orbited. */
  private yawSnapTarget: number | null = null;
  private pitchRad = THREE.MathUtils.degToRad(PITCH_DEFAULT_DEG);
  private zoomHalfHeight = ZOOM_DEFAULT;
  private following = true;
  private aspect = 1;

  constructor() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 600);
    this.applyFrustum();
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.applyFrustum();
  }

  private applyFrustum(): void {
    const h = this.zoomHalfHeight;
    this.camera.left = -h * this.aspect;
    this.camera.right = h * this.aspect;
    this.camera.top = h;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  /** Q/E: step to the next 45+n*90 orientation from wherever we are. */
  rotate(step: 1 | -1): void {
    const currentDeg = THREE.MathUtils.radToDeg(this.yawSnapTarget ?? this.yawCurrent);
    const index = Math.round((currentDeg - 45) / 90) + step;
    this.yawSnapTarget = THREE.MathUtils.degToRad(45 + index * 90);
  }

  /** Free orbit (right-mouse drag / sliders): yaw spins, pitch tilts. */
  orbitBy(dYawRad: number, dPitchRad: number): void {
    this.yawSnapTarget = null;
    this.yawCurrent += dYawRad;
    this.setPitchDeg(THREE.MathUtils.radToDeg(this.pitchRad) + THREE.MathUtils.radToDeg(dPitchRad));
  }

  setYawDeg(deg: number): void {
    this.yawSnapTarget = null;
    this.yawCurrent = THREE.MathUtils.degToRad(deg);
  }

  setPitchDeg(deg: number): void {
    this.pitchRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(deg, PITCH_MIN_DEG, PITCH_MAX_DEG),
    );
  }

  setZoomHalfHeight(h: number): void {
    this.zoomHalfHeight = THREE.MathUtils.clamp(h, ZOOM_MIN, ZOOM_MAX);
    this.applyFrustum();
  }

  yawDeg(): number {
    const deg = THREE.MathUtils.radToDeg(this.yawSnapTarget ?? this.yawCurrent) % 360;
    return (deg + 360) % 360;
  }

  pitchDeg(): number {
    return THREE.MathUtils.radToDeg(this.pitchRad);
  }

  zoomHalf(): number {
    return this.zoomHalfHeight;
  }

  /** Back to the classic view: 45-degree yaw, default tilt and zoom. */
  resetView(): void {
    this.yawSnapTarget = THREE.MathUtils.degToRad(YAW_DEFAULT_DEG);
    this.pitchRad = THREE.MathUtils.degToRad(PITCH_DEFAULT_DEG);
    this.zoomHalfHeight = ZOOM_DEFAULT;
    this.applyFrustum();
    this.following = true;
  }

  zoomBy(factor: number): void {
    this.zoomHalfHeight = THREE.MathUtils.clamp(this.zoomHalfHeight * factor, ZOOM_MIN, ZOOM_MAX);
    this.applyFrustum();
  }

  /** Pan by screen pixels; disengages follow until center() is pressed. */
  pan(dxPx: number, dyPx: number, viewportHeightPx: number): void {
    this.following = false;
    const worldPerPx = (this.zoomHalfHeight * 2) / viewportHeightPx;
    const right = new THREE.Vector3(Math.cos(this.yawCurrent), 0, -Math.sin(this.yawCurrent));
    const forward = new THREE.Vector3(-Math.sin(this.yawCurrent), 0, -Math.cos(this.yawCurrent));
    this.target.addScaledVector(right, -dxPx * worldPerPx);
    this.target.addScaledVector(forward, (dyPx * worldPerPx) / Math.sin(this.pitchRad));
  }

  center(): void {
    this.following = true;
  }

  isFollowing(): boolean {
    return this.following;
  }

  update(dt: number, playerWorldPos: THREE.Vector3): void {
    // Shortest-arc yaw tween toward the snapped target angle, when snapping.
    if (this.yawSnapTarget !== null) {
      let delta = this.yawSnapTarget - this.yawCurrent;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.yawCurrent += delta * Math.min(1, dt * 8);
      if (Math.abs(delta) < 0.001) {
        this.yawCurrent = this.yawSnapTarget;
        this.yawSnapTarget = null;
      }
    }

    if (this.following) {
      this.target.lerp(playerWorldPos, Math.min(1, dt * 6));
    }

    const horiz = BOOM_DIST * Math.cos(this.pitchRad);
    const eye = new THREE.Vector3(
      this.target.x + Math.sin(this.yawCurrent) * horiz,
      this.target.y + BOOM_DIST * Math.sin(this.pitchRad),
      this.target.z + Math.cos(this.yawCurrent) * horiz,
    );
    this.camera.position.copy(eye);
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
