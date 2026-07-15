// Skinned blocky-humanoid character view with walk/idle/chop animation.
// Purely presentational: driven by simulation state each frame.

import * as THREE from "three";
import { applyBoxUVs, partSpecs, skinTexture, PX, type LoadedSkin } from "./skin";

const OVERLAY_INFLATE_PX = 0.55;

export interface CharacterPose {
  x: number;
  z: number;
  targetY: number;
  facing: number;
  moving: boolean;
  chopping: boolean;
}

export class CharacterView {
  readonly group = new THREE.Group();
  private parts = new Map<string, THREE.Group>();
  private displayY: number | null = null;
  private walkPhase = 0;
  private chopPhase = 0;
  private heldItem: THREE.Group | null = null;
  private armorMeshes: THREE.Mesh[] = [];
  private disposables: Array<{ dispose(): void }> = [];

  constructor(skin: LoadedSkin, instanceId?: string) {
    const texture = skinTexture(skin.canvas);
    this.disposables.push(texture);
    const baseMat = new THREE.MeshLambertMaterial({ map: texture });
    const overlayMat = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
    this.disposables.push(baseMat, overlayMat);

    for (const spec of partSpecs(skin.slim)) {
      const pivot = new THREE.Group();
      pivot.position.set(spec.pivot[0] * PX, spec.pivot[1] * PX, spec.pivot[2] * PX);

      const makeBox = (inflatePx: number, material: THREE.Material, rects: "base" | "overlay") => {
        const geo = new THREE.BoxGeometry(
          (spec.size[0] + inflatePx) * PX,
          (spec.size[1] + inflatePx) * PX,
          (spec.size[2] + inflatePx) * PX,
        );
        applyBoxUVs(geo, spec[rects]);
        this.disposables.push(geo);
        const mesh = new THREE.Mesh(geo, material);
        mesh.position.set(
          spec.centerOffset[0] * PX,
          spec.centerOffset[1] * PX,
          spec.centerOffset[2] * PX,
        );
        if (instanceId) mesh.userData.instanceId = instanceId;
        return mesh;
      };

      pivot.add(makeBox(0, baseMat, "base"));
      pivot.add(makeBox(OVERLAY_INFLATE_PX, overlayMat, "overlay"));
      this.parts.set(spec.name, pivot);
      this.group.add(pivot);
    }
    if (instanceId) this.group.userData.instanceId = instanceId;
  }

  update(dt: number, pose: CharacterPose): void {
    if (this.displayY === null) this.displayY = pose.targetY;
    this.displayY += (pose.targetY - this.displayY) * Math.min(1, dt * 10);
    this.group.position.set(pose.x, this.displayY, pose.z);
    // The model's front is -Z; sim facing 0 points +Z.
    this.group.rotation.y = pose.facing + Math.PI;

    const head = this.parts.get("head")!;
    const armR = this.parts.get("armR")!;
    const armL = this.parts.get("armL")!;
    const legR = this.parts.get("legR")!;
    const legL = this.parts.get("legL")!;

    // Sign convention for this rig: positive rotation.x swings a hanging limb
    // toward the model's FRONT; negative swings it behind.
    if (pose.moving) {
      this.walkPhase += dt * 9;
      const swing = Math.sin(this.walkPhase) * 0.65;
      legR.rotation.x = swing;
      legL.rotation.x = -swing;
      armL.rotation.x = swing * 0.8;
      if (!pose.chopping) armR.rotation.x = -swing * 0.8;
    } else {
      const settle = Math.min(1, dt * 12);
      legR.rotation.x += -legR.rotation.x * settle;
      legL.rotation.x += -legL.rotation.x * settle;
      armL.rotation.x += -armL.rotation.x * settle;
      if (!pose.chopping) {
        const idle = Math.sin(performance.now() / 900) * 0.04;
        armR.rotation.x += (idle - armR.rotation.x) * settle;
        armL.rotation.z = -idle * 0.5;
      }
    }

    if (pose.chopping) {
      this.chopPhase += dt * 8;
      // Wind up overhead (forward-up), strike down toward the target in front.
      armR.rotation.x = 2.5 - Math.max(0, Math.sin(this.chopPhase)) * 1.5;
      head.rotation.x = -0.12; // look down at the work
    } else {
      this.chopPhase = 0;
      head.rotation.x += -head.rotation.x * Math.min(1, dt * 10);
      if (!pose.moving) armR.rotation.z = 0;
    }
  }

  /**
   * Attach an item to the swing arm's hand so it moves with every
   * chop/mine/cast. The 16x16 item sprite is extruded one pixel deep into a
   * true 3D voxel item, the way Minecraft renders held items.
   * Pass null to empty the hand.
   */
  setHeldItem(texture: THREE.Texture | null): void {
    if (this.heldItem) {
      this.heldItem.removeFromParent();
      this.heldItem.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.heldItem = null;
    }
    if (!texture) return;
    const canvas = texture.image as HTMLCanvasElement;
    const ctx = canvas.getContext("2d")!;
    const size = 16;
    const data = ctx.getImageData(0, 0, size, size).data;
    const cells: Array<{ x: number; y: number; color: THREE.Color }> = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        if (data[i + 3] > 127) {
          cells.push({
            x,
            y,
            color: new THREE.Color(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255).convertSRGBToLinear(),
          });
        }
      }
    }
    if (cells.length === 0) return;
    const itemSize = 0.62;
    const px = itemSize / size;
    const voxels = new THREE.InstancedMesh(
      new THREE.BoxGeometry(px, px, px), // one pixel deep, like MC item extrusion
      new THREE.MeshLambertMaterial(),
      cells.length,
    );
    // Grip at the handle butt (item art keeps the vanilla convention:
    // handle rising from the bottom-left corner), so the tool head sits
    // up-and-forward of the fist instead of the fist clutching the head.
    const grip = { x: 6, y: 11 }; // a couple of pixels up the shaft, so the fist wraps the handle
    const m = new THREE.Matrix4();
    cells.forEach((cell, i) => {
      m.setPosition((cell.x - grip.x) * px, (grip.y - cell.y) * px, 0);
      voxels.setMatrixAt(i, m);
      voxels.setColorAt(i, cell.color);
    });
    voxels.instanceMatrix.needsUpdate = true;
    if (voxels.instanceColor) voxels.instanceColor.needsUpdate = true;
    const held = new THREE.Group();
    held.add(voxels);
    // Hand sits at the lower end of the arm. Vanilla third-person display
    // pose ([0, -90, 55]): the sprite plane runs along the facing axis and
    // the 55-degree roll stands the handle upright, head on top with the
    // cutting edge toward the front, sweeping edge-first through a chop.
    // Forward pitch leans the tool out over the ground.
    held.position.set(0.02, -0.62, -0.16);
    held.rotation.set(-0.62, -Math.PI / 2, (55 * Math.PI) / 180);
    this.parts.get("armR")!.add(held);
    this.heldItem = held;
  }

  /**
   * Dress the model in worn armor: textured plates that ride each body part
   * through every animation. Values are plate textures per slot (or null).
   */
  setArmor(armor: {
    head?: THREE.Texture | null;
    body?: THREE.Texture | null;
    legs?: THREE.Texture | null;
  }): void {
    for (const mesh of this.armorMeshes) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.armorMeshes = [];

    const plate = (
      part: string,
      texture: THREE.Texture,
      sizePx: [number, number, number],
      offsetPx: [number, number, number],
    ) => {
      const geo = new THREE.BoxGeometry(sizePx[0] * PX, sizePx[1] * PX, sizePx[2] * PX);
      const mat = new THREE.MeshLambertMaterial({ map: texture });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(offsetPx[0] * PX, offsetPx[1] * PX, offsetPx[2] * PX);
      this.parts.get(part)!.add(mesh);
      this.armorMeshes.push(mesh);
    };

    if (armor.head) {
      // Open-faced helm: covers the crown and sides, leaves the face visible.
      plate("head", armor.head, [9.2, 3.6, 9.2], [0, 6.6, 0]);
    }
    if (armor.body) {
      plate("body", armor.body, [9.2, 12.8, 5.2], [0, 0, 0]); // chestplate
      plate("armR", armor.body, [5.2, 5, 5.2], [0, -2, 0]); // pauldrons
      plate("armL", armor.body, [5.2, 5, 5.2], [0, -2, 0]);
    }
    if (armor.legs) {
      plate("legR", armor.legs, [5, 11, 5], [0, -6.4, 0]);
      plate("legL", armor.legs, [5, 11, 5], [0, -6.4, 0]);
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
