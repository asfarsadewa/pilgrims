import * as THREE from "three";

function softDotTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.35, "rgba(255,255,255,0.55)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Slow drifting dust/fog motes above the diorama. Subtle by design; it exists
 * to add depth and motion without competing with the puzzle.
 */
export class Particles {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly speeds: Float32Array;
  private readonly count: number;
  private readonly geometry: THREE.BufferGeometry;
  private readonly material: THREE.PointsMaterial;
  private readonly texture: THREE.Texture;
  private extent = 8;

  constructor(count = 220) {
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * this.extent * 2;
      this.positions[i * 3 + 1] = Math.random() * 4.5;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * this.extent * 2;
      this.speeds[i] = 0.06 + Math.random() * 0.16;
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.texture = softDotTexture();
    this.material = new THREE.PointsMaterial({
      color: 0xffe6bb,
      size: 0.09,
      map: this.texture,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  setTheme(color: number, extent: number): void {
    this.material.color.set(color);
    this.extent = Math.max(extent, 4);
  }

  update(dt: number, time: number): void {
    const positions = this.positions;
    for (let i = 0; i < this.count; i++) {
      const iy = i * 3 + 1;
      positions[iy] += this.speeds[i] * dt;
      positions[i * 3] += Math.sin(time * 0.2 + i) * dt * 0.05;
      if (positions[iy] > 4.6) {
        positions[iy] = -0.2;
        positions[i * 3] = (Math.random() - 0.5) * this.extent * 2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * this.extent * 2;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}
