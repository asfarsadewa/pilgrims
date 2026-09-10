import * as THREE from "three";
import { AssetLoader } from "./AssetLoader";
import { Theme } from "./themes";

interface Traveller {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  lantern: THREE.Object3D | null;
  phase: number;
}

/**
 * The opening screen: a small band of pilgrims crossing the dark toward a
 * distant wayside monument. One carries a lantern. Built from the AI-authored
 * models so the title matches the game.
 */
export class TitleScene {
  readonly group = new THREE.Group();
  private travellers: Traveller[] = [];
  private readonly light: THREE.PointLight;
  private readonly halo: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly fillLight: THREE.PointLight;
  private readonly ground: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  private readonly glowMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly lanternFlames: THREE.MeshStandardMaterial[] = [];
  private readonly lanternLights: THREE.PointLight[] = [];
  private readonly disposables: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private built = false;
  private lastTime = 0;

  private static readonly MONUMENT_HEIGHT = 2.6;
  private static readonly MONUMENT_Z = -1.3;
  private static readonly CORE_Y = 1.62;

  constructor(private assets: AssetLoader) {
    this.group.name = "TitleScene";
    this.group.visible = false;

    const groundGeometry = new THREE.CircleGeometry(9, 56);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x0b0d12,
      roughness: 1,
      metalness: 0,
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    const haloGeometry = new THREE.TorusGeometry(0.16, 0.014, 8, 32);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.halo = new THREE.Mesh(haloGeometry, haloMaterial);
    this.halo.rotation.x = Math.PI / 2;
    this.halo.position.set(0, TitleScene.CORE_Y, TitleScene.MONUMENT_Z);
    this.group.add(this.halo);

    this.light = new THREE.PointLight(0xffd27a, 7, 11, 2);
    this.light.position.set(0, TitleScene.CORE_Y, TitleScene.MONUMENT_Z);
    this.group.add(this.light);

    // Cool moonlight so the travellers always read against the dark ground.
    this.keyLight = new THREE.DirectionalLight(0xc4d6f7, 3.4);
    this.keyLight.position.set(2.6, 3.4, 4.4);
    this.keyLight.target.position.set(0.3, 0.5, 0.6);
    this.group.add(this.keyLight, this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0xffc98a, 1.5);
    this.rimLight.position.set(-2.4, 2.2, -2.8);
    this.rimLight.target.position.set(0.5, 0.4, 0.8);
    this.group.add(this.rimLight, this.rimLight.target);

    this.fillLight = new THREE.PointLight(0xcfe0ff, 3.2, 9, 1.6);
    this.fillLight.position.set(0.3, 1.7, 2.6);
    this.group.add(this.fillLight);
  }

  /** Called once the GLB assets have finished loading. */
  build(): void {
    if (this.built) return;
    this.built = true;

    const monument = this.assets.instance("title");
    if (monument) {
      monument.name = "TitleMonument";
      this.prepare(monument, TitleScene.MONUMENT_HEIGHT);
      monument.position.set(0, 0, TitleScene.MONUMENT_Z);
      this.styleMeshes(monument, (material) => {
        material.metalness = 0;
        material.roughness = 0.9;
        if (material.map) {
          material.emissiveMap = material.map;
          material.emissive = new THREE.Color(0xffc978);
          material.emissiveIntensity = 0.42;
        }
        this.glowMaterials.push(material);
      });
      this.group.add(monument);
    }

    // A small band, one lantern among them.
    this.addTraveller(0.8, 0.05, 0.3, true);
    this.addTraveller(0.88, 1.15, 1.25, false);
    this.addTraveller(0.74, -0.95, 1.35, false);
  }

  private facingMonument(x: number, z: number): number {
    return Math.atan2(z - TitleScene.MONUMENT_Z, -x);
  }

  private addTraveller(
    height: number,
    x: number,
    z: number,
    withLantern: boolean,
  ): void {
    const model = this.assets.instance("pilgrim");
    if (!model) return;

    const root = new THREE.Group();
    root.name = withLantern ? "TitleLanternBearer" : "TitleTraveller";
    this.prepare(model, height);
    this.styleMeshes(model, (material) => {
      material.metalness = 0;
      material.roughness = 0.72;
      material.color.set(0xffffff);
      if (material.map) {
        material.emissiveMap = material.map;
        material.emissive = new THREE.Color(0x3d5178);
        material.emissiveIntensity = 0.62;
      }
    });
    root.add(model);
    root.position.set(x, 0, z);
    root.rotation.y = this.facingMonument(x, z);
    this.group.add(root);

    const clips = this.assets.animations("pilgrim");
    const idle = THREE.AnimationClip.findByName(clips, "idle");
    let mixer: THREE.AnimationMixer | null = null;
    if (idle) {
      mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(idle);
      action.play();
      action.time = (this.travellers.length * 1.37) % Math.max(idle.duration, 1);
    }

    let lantern: THREE.Object3D | null = null;
    if (withLantern) {
      lantern = this.buildLantern(height);
      root.add(lantern);
    }

    this.travellers.push({
      root,
      mixer,
      lantern,
      phase: this.travellers.length * 1.9,
    });
  }

  /** A small hand lantern with a warm flame and its own light. */
  private buildLantern(height: number): THREE.Group {
    const group = new THREE.Group();
    group.name = "Lantern";
    const unit = height / 0.82;
    group.scale.setScalar(unit);
    // Roughly at the bearer's right hand, hanging from the handle.
    group.position.set(0.09, height * 0.4, height * 0.2);

    const metal = new THREE.MeshStandardMaterial({
      color: 0x24262c,
      metalness: 0.75,
      roughness: 0.45,
    });
    const glass = new THREE.MeshStandardMaterial({
      color: 0xffd694,
      emissive: 0xffb347,
      emissiveIntensity: 2.4,
      transparent: true,
      opacity: 0.82,
      roughness: 0.25,
    });
    const flame = new THREE.MeshStandardMaterial({
      color: 0xfff0c0,
      emissive: 0xffc25a,
      emissiveIntensity: 3.4,
      roughness: 0.3,
    });
    this.disposables.push(metal, glass, flame);
    this.lanternFlames.push(flame);

    const track = (geometry: THREE.BufferGeometry) => {
      this.geometries.push(geometry);
      return geometry;
    };

    const glassBody = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.028, 0.032, 0.08, 10)),
      glass,
    );
    group.add(glassBody);

    const cap = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.044, 0.032, 10)),
      metal,
    );
    cap.position.y = 0.055;
    group.add(cap);

    const base = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.036, 0.04, 0.018, 10)),
      metal,
    );
    base.position.y = -0.05;
    group.add(base);

    const barGeometry = track(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6));
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bar = new THREE.Mesh(barGeometry, metal);
      bar.position.set(Math.cos(angle) * 0.031, 0, Math.sin(angle) * 0.031);
      group.add(bar);
    }

    const handle = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.022, 0.004, 6, 16)),
      metal,
    );
    handle.position.y = 0.086;
    handle.rotation.x = Math.PI / 2;
    group.add(handle);

    const core = new THREE.Mesh(track(new THREE.IcosahedronGeometry(0.013, 1)), flame);
    group.add(core);

    const light = new THREE.PointLight(0xffb75e, 2.0, 3.2, 2);
    light.position.set(0, 0, 0);
    group.add(light);
    this.lanternLights.push(light);

    group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = false;
    });
    return group;
  }

  /** Scale to a target height, centre on X/Z and ground at y=0. */
  private prepare(object: THREE.Object3D, targetHeight: number): void {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 1e-5 ? targetHeight / size.y : 1;
    object.scale.setScalar(scale);
    const scaled = new THREE.Box3().setFromObject(object);
    const center = scaled.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y -= scaled.min.y;
  }

  private styleMeshes(
    root: THREE.Object3D,
    configure: (material: THREE.MeshStandardMaterial) => void,
  ): void {
    const seen = new Map<THREE.Material, THREE.Material>();
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
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
    });
  }

  setTheme(theme: Theme): void {
    this.ground.material.color.set(theme.ground);
    this.light.color.set(theme.shrineGlow);
    this.halo.material.color.set(theme.shrineGlow);
    for (const material of this.glowMaterials) {
      if (material.emissive) material.emissive.set(theme.shrineGlow);
    }
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  get visible(): boolean {
    return this.group.visible;
  }

  update(timeMs: number): void {
    const t = timeMs / 1000;
    const dt = Math.min(Math.max(t - this.lastTime, 0), 0.1);
    this.lastTime = t;

    for (const traveller of this.travellers) {
      traveller.mixer?.update(dt);
      if (traveller.lantern) {
        traveller.lantern.rotation.z =
          Math.sin(t * 1.35 + traveller.phase) * 0.07;
        traveller.lantern.rotation.x =
          Math.cos(t * 1.1 + traveller.phase) * 0.05;
      }
    }

    const pulse = Math.sin(t * 1.3);
    this.halo.rotation.z = t * 0.35;
    this.halo.scale.setScalar(1 + pulse * 0.1);
    this.halo.material.opacity = 0.32 + pulse * 0.1;
    this.light.intensity = 5.5 + pulse * 1.6;
    for (const material of this.glowMaterials) {
      material.emissiveIntensity = 0.34 + (pulse + 1) * 0.12;
    }

    // Lantern flicker.
    const flicker = 0.85 + Math.sin(t * 17.3) * 0.06 + Math.sin(t * 7.1) * 0.09;
    for (const light of this.lanternLights) light.intensity = 2.0 * flicker;
    for (const flame of this.lanternFlames) flame.emissiveIntensity = 3.2 * flicker;
  }

  dispose(): void {
    for (const traveller of this.travellers) traveller.mixer?.stopAllAction();
    this.travellers = [];
    this.lanternLights.length = 0;
    this.lanternFlames.length = 0;
    this.glowMaterials.length = 0;
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
    for (const material of this.disposables) material.dispose();
    this.disposables.length = 0;
  }
}
