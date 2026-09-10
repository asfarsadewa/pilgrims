import * as THREE from "three";

/**
 * A persistent marker on the tile the Shrine just left. Doubters walk toward
 * this tile, so it must stay visible while the player plans rather than only
 * flashing during the move. Deliberately wordless (spec §44).
 */
export class MemoryMarker {
  readonly group = new THREE.Group();
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly disc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly light: THREE.PointLight;
  private readonly disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private enabled = false;

  constructor() {
    this.group.name = "MemoryMarker";
    this.group.visible = false;

    const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x9db4ff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(ringGeometry, ringMaterial);
    this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;
    this.group.add(this.ring);

    const discGeometry = new THREE.CircleGeometry(0.42, 32);
    const discMaterial = new THREE.MeshBasicMaterial({
      color: 0x6f86c9,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.disposables.push(discGeometry, discMaterial);
    this.disc = new THREE.Mesh(discGeometry, discMaterial);
    this.disc.rotation.x = -Math.PI / 2;
    this.disc.position.y = -0.01;
    this.group.add(this.disc);

    this.light = new THREE.PointLight(0x9db4ff, 1.4, 3.2, 2);
    this.light.position.y = 0.45;
    this.group.add(this.light);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.group.visible = enabled;
  }

  setWorld(x: number, z: number): void {
    this.group.position.set(x, 0.02, z);
  }

  update(time: number): void {
    if (!this.enabled) return;
    const pulse = Math.sin(time * 1.6);
    this.ring.rotation.z = time * 0.35;
    this.ring.material.opacity = 0.26 + pulse * 0.09;
    this.disc.material.opacity = 0.06 + pulse * 0.03;
    this.light.intensity = 1.2 + pulse * 0.5;
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables.length = 0;
  }
}
