import * as THREE from "three";
import { GridPosition } from "../game/types";
import { WorldLayout } from "./coords";

interface EffectItem {
  object: THREE.Object3D;
  age: number;
  life: number;
  update: (object: THREE.Object3D, t: number) => void;
  dispose: () => void;
}

/**
 * Short-lived cosmetic effects: shrine afterimages, arrival rings, exit and
 * hazard bursts. Nothing here affects simulation.
 */
export class Effects {
  readonly group = new THREE.Group();

  constructor(private layout: WorldLayout) {
    this.group.name = "Effects";
  }

  setLayout(layout: WorldLayout): void {
    this.layout = layout;
  }

  private toWorld(position: GridPosition): { x: number; z: number } {
    return {
      x: (position.x - (this.layout.width - 1) / 2),
      z: (position.y - (this.layout.height - 1) / 2),
    };
  }

  shrineGhost(position: GridPosition, color: number): void {
    const world = this.toWorld(position);
    const geometry = new THREE.RingGeometry(0.24, 0.32, 24);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(world.x, 0.05, world.z);
    this.group.add(ring);
    this.add({
      object: ring,
      life: 0.9,
      update: (object, t) => {
        const mesh = object as THREE.Mesh;
        mesh.scale.setScalar(1 + t * 0.5);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  stepPuff(position: GridPosition, color: number): void {
    const world = this.toWorld(position);
    const geometry = new THREE.RingGeometry(0.1, 0.2, 16);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(world.x, 0.06, world.z);
    this.group.add(ring);
    this.add({
      object: ring,
      life: 0.35,
      update: (object, t) => {
        const mesh = object as THREE.Mesh;
        mesh.scale.setScalar(1 + t * 1.4);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t);
      },
      dispose: () => {
        geometry.dispose();
        material.dispose();
      },
    });
  }

  burst(
    position: GridPosition,
    color: number,
    opts: { count?: number; height?: number; life?: number; size?: number } = {},
  ): void {
    const world = this.toWorld(position);
    const count = opts.count ?? 10;
    const life = opts.life ?? 0.7;
    const height = opts.height ?? 1.4;
    const size = opts.size ?? 0.05;
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(size, 8, 6);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const spark = new THREE.Mesh(geometry, material);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = 0.12 + Math.random() * 0.28;
      spark.position.set(world.x, 0.1, world.z);
      const drift = {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        y: height * (0.5 + Math.random() * 0.6),
      };
      this.group.add(spark);
      this.add({
        object: spark,
        life,
        update: (object, t) => {
          const mesh = object as THREE.Mesh;
          mesh.position.set(
            world.x + drift.x * t,
            0.1 + drift.y * t - 1.2 * t * t,
            world.z + drift.z * t,
          );
          (mesh.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
          mesh.scale.setScalar(1 - t * 0.5);
        },
        dispose: () => {
          geometry.dispose();
          material.dispose();
        },
      });
    }
  }

  private add(
    item: Omit<EffectItem, "age"> & { age?: number },
  ): void {
    this.items.push({ ...item, age: item.age ?? 0 });
  }

  private items: EffectItem[] = [];

  update(dt: number): void {
    const remaining: EffectItem[] = [];
    for (const item of this.items) {
      item.age += dt;
      const t = Math.min(item.age / item.life, 1);
      item.update(item.object, t);
      if (item.age >= item.life) {
        this.group.remove(item.object);
        item.dispose();
      } else {
        remaining.push(item);
      }
    }
    this.items = remaining;
  }

  clear(): void {
    for (const item of this.items) {
      this.group.remove(item.object);
      item.dispose();
    }
    this.items = [];
  }
}
