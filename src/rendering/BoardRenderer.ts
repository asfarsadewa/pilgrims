import * as THREE from "three";
import { GameState, TileType } from "../game/types";
import { Theme } from "./themes";
import { gridToWorld, hash2d, TILE_SIZE, WorldLayout } from "./coords";

const TILE_GEOMETRY = new THREE.BoxGeometry(TILE_SIZE * 0.94, 1, TILE_SIZE * 0.94);

/**
 * Builds the static diorama for a board. Rebuilt whenever a level loads.
 * Nothing here mutates game state.
 */
export class BoardRenderer {
  readonly group = new THREE.Group();
  private disposables: Array<THREE.BufferGeometry | THREE.Material> = [];
  private exitRings: THREE.Mesh[] = [];
  private beams: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>[] = [];
  private hazardMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(private layout: WorldLayout) {
    this.group.name = "Board";
  }

  build(state: GameState, theme: Theme): void {
    this.dispose();
    this.group.clear();
    this.layout = { width: state.width, height: state.height };

    this.buildBase(state, theme);
    this.walkTiles(state, theme);
  }

  private buildBase(state: GameState, theme: Theme): void {
    const width = state.width * TILE_SIZE;
    const height = state.height * TILE_SIZE;
    const geometry = new THREE.BoxGeometry(width + 0.6, 1.4, height + 0.6);
    const material = new THREE.MeshStandardMaterial({
      color: theme.base,
      roughness: 0.95,
      metalness: 0,
    });
    this.track(geometry, material);
    const base = new THREE.Mesh(geometry, material);
    base.position.y = -1.05;
    base.receiveShadow = true;
    base.castShadow = false;
    this.group.add(base);

    // A faint tabletop shadow catcher beneath the diorama.
    const groundGeometry = new THREE.PlaneGeometry(width * 6, height * 6);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: theme.ground,
      roughness: 1,
      metalness: 0,
    });
    this.track(groundGeometry, groundMaterial);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.85;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private walkTiles(state: GameState, theme: Theme): void {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.board.tileAt(x, y);
        const world = gridToWorld(this.layout, x, y);
        const variation = hash2d(x, y);
        switch (tile) {
          case TileType.Floor:
            this.addFloor(world.x, world.z, variation, theme);
            break;
          case TileType.Wall:
            this.addWall(world.x, world.z, variation, theme);
            break;
          case TileType.Void:
            this.addVoid(world.x, world.z, variation, theme);
            break;
          case TileType.Exit:
            this.addFloor(world.x, world.z, variation, theme);
            this.addExit(world.x, world.z, theme);
            break;
          case TileType.Hazard:
            this.addFloor(world.x, world.z, variation, theme);
            this.addHazard(world.x, world.z, theme);
            break;
        }
      }
    }
  }

  private addFloor(
    x: number,
    z: number,
    variation: number,
    theme: Theme,
  ): void {
    const height = 0.32 + variation * 0.06;
    const material = new THREE.MeshStandardMaterial({
      color: variation > 0.5 ? theme.floorAlt : theme.floor,
      roughness: 0.95,
      metalness: 0,
    });
    this.track(null, material);
    const mesh = new THREE.Mesh(TILE_GEOMETRY, material);
    mesh.scale.y = height;
    mesh.position.set(x, -height / 2, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.group.add(mesh);
  }

  private addWall(
    x: number,
    z: number,
    variation: number,
    theme: Theme,
  ): void {
    const height = 1.0 + variation * 0.45;
    const material = new THREE.MeshStandardMaterial({
      color: theme.wall,
      roughness: 0.9,
      metalness: 0,
    });
    this.track(null, material);
    const mesh = new THREE.Mesh(TILE_GEOMETRY, material);
    mesh.scale.y = height;
    mesh.position.set(x, -0.32 + height / 2, z);
    mesh.rotation.y = (variation - 0.5) * 0.14;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const capMaterial = new THREE.MeshStandardMaterial({
      color: theme.wallTop,
      roughness: 0.85,
    });
    this.track(null, capMaterial);
    const capGeometry = new THREE.BoxGeometry(
      TILE_SIZE * 0.9,
      0.08,
      TILE_SIZE * 0.9,
    );
    this.track(capGeometry, null);
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.set(x, -0.32 + height + 0.02, z);
    cap.rotation.y = mesh.rotation.y;
    cap.castShadow = true;
    cap.receiveShadow = true;
    this.group.add(cap);
  }

  private addVoid(
    x: number,
    z: number,
    variation: number,
    theme: Theme,
  ): void {
    const material = new THREE.MeshStandardMaterial({
      color: theme.void,
      roughness: 1,
      metalness: 0.1,
      emissive: theme.voidGlow,
      emissiveIntensity: 0.06 + variation * 0.05,
    });
    this.track(null, material);
    const mesh = new THREE.Mesh(TILE_GEOMETRY, material);
    mesh.scale.y = 0.16;
    mesh.position.set(x, -0.62, z);
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private addExit(x: number, z: number, theme: Theme): void {
    const ringGeometry = new THREE.RingGeometry(0.18, 0.34, 28);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: theme.exit,
      emissive: theme.exitGlow,
      emissiveIntensity: 0.9,
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });
    this.track(ringGeometry, ringMaterial);
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.03, z);
    this.group.add(ring);
    this.exitRings.push(ring);

    const beamGeometry = new THREE.CylinderGeometry(0.26, 0.34, 2.2, 20, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: theme.exitGlow,
      transparent: true,
      opacity: 0.09,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.track(beamGeometry, beamMaterial);
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    beam.position.set(x, 1.1, z);
    this.group.add(beam);
    this.beams.push(beam);
  }

  private addHazard(x: number, z: number, theme: Theme): void {
    const pitMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0402,
      roughness: 1,
    });
    this.track(null, pitMaterial);
    const pit = new THREE.Mesh(TILE_GEOMETRY, pitMaterial);
    pit.scale.set(0.86, 0.24, 0.86);
    pit.position.set(x, -0.26, z);
    this.group.add(pit);

    const rimGeometry = new THREE.TorusGeometry(0.36, 0.045, 8, 24);
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: theme.hazard,
      emissive: theme.hazardGlow,
      emissiveIntensity: 0.8,
      roughness: 0.6,
    });
    this.track(rimGeometry, rimMaterial);
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(x, 0.0, z);
    this.group.add(rim);
    this.hazardMaterials.push(rimMaterial);

    const spikeGeometry = new THREE.ConeGeometry(0.09, 0.34, 6);
    this.track(spikeGeometry, null);
    for (let i = 0; i < 3; i++) {
      const spike = new THREE.Mesh(spikeGeometry, rimMaterial);
      const angle = (i / 3) * Math.PI * 2 + 0.4;
      spike.position.set(
        x + Math.cos(angle) * 0.16,
        -0.12,
        z + Math.sin(angle) * 0.16,
      );
      spike.castShadow = false;
      this.group.add(spike);
    }
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    for (let i = 0; i < this.exitRings.length; i++) {
      this.exitRings[i].rotation.z = t * 0.5 + i;
      const pulse = 0.75 + Math.sin(t * 2 + i * 1.3) * 0.35;
      (this.exitRings[i].material as THREE.MeshStandardMaterial).emissiveIntensity =
        pulse;
    }
    for (let i = 0; i < this.beams.length; i++) {
      this.beams[i].material.opacity =
        0.07 + (0.5 + 0.5 * Math.sin(t * 1.6 + i)) * 0.05;
    }
    for (let i = 0; i < this.hazardMaterials.length; i++) {
      this.hazardMaterials[i].emissiveIntensity =
        0.6 + (0.5 + 0.5 * Math.sin(t * 3 + i * 2)) * 0.7;
    }
  }

  private track(
    geometry: THREE.BufferGeometry | null,
    material: THREE.Material | null,
  ): void {
    if (geometry) this.disposables.push(geometry);
    if (material) this.disposables.push(material);
  }

  dispose(): void {
    for (const item of this.disposables) item.dispose();
    this.disposables = [];
    this.exitRings = [];
    this.beams = [];
    this.hazardMaterials = [];
    this.group.clear();
  }
}
