import * as THREE from "three";
import { GameState, GridPosition, PilgrimState } from "../game/types";
import { AssetLoader } from "./AssetLoader";
import { gridPositionToWorld, WorldLayout } from "./coords";
import { Theme } from "./themes";

/** Subtle colour casts so pilgrims read as individuals without new textures. */
const PILGRIM_TINTS = [
  0xffffff, 0xffe9d0, 0xdbe6ff, 0xffdcc6, 0xe2ffe4, 0xf2e2ff, 0xfff1cf,
];

const WALK_BURST_SECONDS = 0.75;

export interface PilgrimView {
  id: string;
  root: THREE.Group;
  moving: boolean;
  exited: boolean;
}

interface PilgrimInternal extends PilgrimView {
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  walkWeight: number;
  walkUntil: number;
  phase: number;
  facingTarget: number;
  facingCurrent: number;
  /** Floating mote that marks a doubter. */
  mark: THREE.Object3D | null;
}

export interface ShrineView {
  root: THREE.Group;
}

interface ShrineInternal extends ShrineView {
  halo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  light: THREE.PointLight;
  glowMaterials: THREE.MeshStandardMaterial[];
}

function placeholderFigure(color: number): THREE.Object3D {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.16, 0.3, 4, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xe4c9a8, roughness: 0.8 }),
  );
  head.position.y = 0.74;
  head.castShadow = true;
  group.add(head);
  return group;
}

/**
 * Owns the Shrine and pilgrim instances. Pilgrims use the AI-authored,
 * Blender-rigged GLB with baked idle/walk clips driven by an AnimationMixer.
 */
export class EntityRenderer {
  readonly group = new THREE.Group();
  private pilgrims = new Map<string, PilgrimInternal>();
  private shrineView: ShrineInternal | null = null;
  private layout: WorldLayout = { width: 1, height: 1 };
  private disposables: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private lastTime = 0;

  constructor(private assets: AssetLoader) {
    this.group.name = "Entities";
  }

  get ready(): boolean {
    return this.assets.loaded;
  }

  setLevel(state: GameState, theme: Theme): void {
    this.dispose();
    this.layout = { width: state.width, height: state.height };

    for (const pilgrim of state.pilgrims) this.createPilgrim(pilgrim);
    this.createShrine(theme, state.shrine.position);
    this.syncInstant(state);
  }

  private styleMesh(mesh: THREE.Mesh): void {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
  }

  private cloneMaterial(
    mesh: THREE.Mesh,
    seen: Map<THREE.Material, THREE.Material>,
    configure: (material: THREE.MeshStandardMaterial) => void,
  ): void {
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (!material) return;
    let copy = seen.get(material);
    if (!copy) {
      const cloned = material.clone();
      configure(cloned);
      seen.set(material, cloned);
      this.disposables.push(cloned);
      copy = cloned;
    }
    mesh.material = copy;
  }

  private createPilgrim(pilgrim: PilgrimState): void {
    const root = new THREE.Group();
    const model = this.assets.instance("pilgrim");
    const isDoubter = pilgrim.type === "doubter";
    // Doubters read cool and pale; the faithful keep the warm earth palette.
    const tint = isDoubter
      ? new THREE.Color(0xbcc6ee)
      : new THREE.Color(PILGRIM_TINTS[pilgrim.colorIndex % PILGRIM_TINTS.length]);

    if (model) {
      const seen = new Map<THREE.Material, THREE.Material>();
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        this.styleMesh(mesh);
        this.cloneMaterial(mesh, seen, (material) => {
          material.color.multiply(tint);
          material.metalness = 0;
          material.roughness = isDoubter ? 0.7 : 0.88;
          if (isDoubter) {
            material.emissiveMap = material.map ?? null;
            material.emissive = new THREE.Color(0x2b3760);
            material.emissiveIntensity = 0.4;
          }
        });
      });
      root.add(model);
    } else {
      root.add(placeholderFigure(tint.getHex()));
    }

    // A small hovering mote so doubters are unmistakable at a glance.
    let mark: THREE.Object3D | null = null;
    if (isDoubter) {
      const markGeometry = new THREE.SphereGeometry(0.038, 10, 8);
      const markMaterial = new THREE.MeshStandardMaterial({
        color: 0xd6e2ff,
        emissive: 0x9db4ff,
        emissiveIntensity: 2.4,
        roughness: 0.35,
      });
      this.disposables.push(markMaterial);
      this.geometries.push(markGeometry);
      const mesh = new THREE.Mesh(markGeometry, markMaterial);
      mesh.position.set(0, 1.0, 0);
      root.add(mesh);
      mark = mesh;
    }

    const clips = this.assets.animations("pilgrim");
    const idleClip = THREE.AnimationClip.findByName(clips, "idle");
    const walkClip = THREE.AnimationClip.findByName(clips, "walk");
    let mixer: THREE.AnimationMixer | null = null;
    let idleAction: THREE.AnimationAction | null = null;
    let walkAction: THREE.AnimationAction | null = null;

    if (model && (idleClip || walkClip)) {
      mixer = new THREE.AnimationMixer(model);
      if (idleClip) {
        idleAction = mixer.clipAction(idleClip);
        idleAction.setEffectiveWeight(1);
        idleAction.play();
      }
      if (walkClip) {
        walkAction = mixer.clipAction(walkClip);
        walkAction.setEffectiveWeight(0);
        walkAction.play();
      }
    }

    const view: PilgrimInternal = {
      id: pilgrim.id,
      root,
      moving: false,
      exited: false,
      mixer,
      idleAction,
      walkAction,
      walkWeight: 0,
      walkUntil: 0,
      phase: (pilgrim.colorIndex * 1.7) % (Math.PI * 2),
      facingTarget: 0,
      facingCurrent: 0,
      mark,
    };
    this.pilgrims.set(pilgrim.id, view);
    this.group.add(root);
  }

  private createShrine(theme: Theme, position: GridPosition): void {
    const root = new THREE.Group();
    root.name = "Shrine";
    const model = this.assets.instance("shrine");
    const glowMaterials: THREE.MeshStandardMaterial[] = [];

    if (model) {
      const seen = new Map<THREE.Material, THREE.Material>();
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        this.styleMesh(mesh);
        this.cloneMaterial(mesh, seen, (material) => {
          material.metalness = 0;
          material.roughness = 0.82;
          if (material.map) {
            material.emissiveMap = material.map;
            material.emissive = new THREE.Color(theme.shrineGlow);
            material.emissiveIntensity = 0.3;
          }
          glowMaterials.push(material);
        });
      });
      root.add(model);
    } else {
      const fallback = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 1.2, 10),
        new THREE.MeshStandardMaterial({ color: theme.shrineStone, roughness: 0.85 }),
      );
      fallback.position.y = 0.6;
      fallback.castShadow = true;
      root.add(fallback);
    }

    const haloGeometry = new THREE.TorusGeometry(0.2, 0.02, 8, 32);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: theme.shrineGlow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.2;
    root.add(halo);

    const light = new THREE.PointLight(theme.shrineGlow, 6, 5.5, 2);
    light.position.y = 1.12;
    root.add(light);

    this.shrineView = { root, halo, light, glowMaterials };
    this.group.add(root);

    const world = gridPositionToWorld(this.layout, position);
    root.position.set(world.x, 0, world.z);
  }

  /** Jump every entity to its current logical position (level load / restart). */
  syncInstant(state: GameState): void {
    if (this.shrineView) {
      const world = gridPositionToWorld(this.layout, state.shrine.position);
      this.shrineView.root.position.set(world.x, 0, world.z);
    }
    for (const pilgrim of state.pilgrims) {
      const view = this.pilgrims.get(pilgrim.id);
      if (!view) continue;
      const world = gridPositionToWorld(this.layout, pilgrim.position);
      view.root.position.set(world.x, 0, world.z);
      view.exited = pilgrim.exited;
      view.root.visible = !pilgrim.exited;
      view.root.scale.setScalar(1);
      view.moving = false;
      view.walkWeight = 0;
      view.walkUntil = 0;
      view.facingCurrent = view.facingTarget;
      view.root.rotation.y = view.facingTarget;
      view.idleAction?.reset().play();
      view.walkAction?.setEffectiveWeight(0);
    }
  }

  positionOf(position: GridPosition): THREE.Vector3 {
    const world = gridPositionToWorld(this.layout, position);
    return new THREE.Vector3(world.x, 0, world.z);
  }

  getPilgrim(id: string): PilgrimView | undefined {
    return this.pilgrims.get(id);
  }

  getShrine(): ShrineView | null {
    return this.shrineView;
  }

  ensureVisible(id: string): void {
    const view = this.pilgrims.get(id);
    if (view) {
      view.root.visible = true;
      view.root.scale.setScalar(1);
    }
  }

  setExited(id: string, exited: boolean): void {
    const view = this.pilgrims.get(id);
    if (!view) return;
    view.exited = exited;
    view.root.visible = !exited;
  }

  setMoving(id: string, moving: boolean): void {
    const view = this.pilgrims.get(id);
    if (!view) return;
    if (moving) {
      view.moving = true;
      view.walkUntil = performance.now() / 1000 + WALK_BURST_SECONDS;
    } else {
      view.moving = false;
    }
  }

  /** Point a pilgrim toward a world-space direction (XZ). */
  setFacing(id: string, dx: number, dz: number): void {
    const view = this.pilgrims.get(id);
    if (!view || (dx === 0 && dz === 0)) return;
    view.facingTarget = Math.atan2(-dz, dx);
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    const dt = Math.min(Math.max(t - this.lastTime, 0), 0.1);
    this.lastTime = t;

    if (this.shrineView) {
      const { halo, light, glowMaterials } = this.shrineView;
      const pulse = Math.sin(t * 2.1);
      halo.rotation.z = t * 0.7;
      halo.scale.setScalar(1 + pulse * 0.12);
      halo.material.opacity = 0.4 + pulse * 0.12;
      light.intensity = 5.5 + pulse * 1.8;
      for (const material of glowMaterials) {
        material.emissiveIntensity = 0.26 + (pulse + 1) * 0.14;
      }
    }

    for (const view of this.pilgrims.values()) {
      if (!view.root.visible) continue;

      let delta = view.facingTarget - view.facingCurrent;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      view.facingCurrent += delta * Math.min(1, dt * 10);
      view.root.rotation.y = view.facingCurrent;

      const walking = view.moving || t < view.walkUntil;
      const target = walking ? 1 : 0;
      view.walkWeight += (target - view.walkWeight) * Math.min(1, dt * 7);
      view.walkAction?.setEffectiveWeight(view.walkWeight);
      view.idleAction?.setEffectiveWeight(1 - view.walkWeight);
      view.mixer?.update(dt);

      if (view.mark) {
        view.mark.position.y =
          1.0 + Math.sin(t * 2.1 + view.phase) * 0.045;
        view.mark.rotation.y = t * 1.4;
      }
    }
  }

  dispose(): void {
    for (const view of this.pilgrims.values()) {
      view.mixer?.stopAllAction();
    }
    for (const material of this.disposables) material.dispose();
    this.disposables = [];
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries = [];
    this.pilgrims.clear();
    this.shrineView = null;
    this.group.clear();
  }
}
