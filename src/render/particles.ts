// Tiny pooled particle bursts (wood chips + leaves on chop cycles).

import * as THREE from "three";

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

const POOL_SIZE = 48;
const LIFE_S = 0.7;

export class ParticleBursts {
  private pool: Particle[] = [];
  private cursor = 0;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(0.09, 0.09, 0.09);
    const materials = [
      new THREE.MeshBasicMaterial({ color: "#7a5230" }),
      new THREE.MeshBasicMaterial({ color: "#59a83b" }),
      new THREE.MeshBasicMaterial({ color: "#a5793f" }),
    ];
    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(geo, materials[i % materials.length]);
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, vel: new THREE.Vector3(), life: 0 });
    }
  }

  burst(pos: THREE.Vector3, count = 10): void {
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % POOL_SIZE;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.position.x += (Math.random() - 0.5) * 0.4;
      p.mesh.position.y += Math.random() * 0.8;
      p.mesh.position.z += (Math.random() - 0.5) * 0.4;
      p.vel.set((Math.random() - 0.5) * 2.4, 1.5 + Math.random() * 2, (Math.random() - 0.5) * 2.4);
      p.life = LIFE_S;
    }
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= 9 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const s = Math.max(0.1, p.life / LIFE_S);
      p.mesh.scale.setScalar(s);
      p.mesh.rotation.x += dt * 7;
      p.mesh.rotation.z += dt * 5;
    }
  }
}
