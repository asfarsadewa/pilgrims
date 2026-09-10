import * as THREE from "three";
import { AssetLoader } from "./AssetLoader";
import { Theme } from "./themes";

/**
 * The pre-title gateway scene: a single pilgrim seen in profile, standing alone
 * in the dark and facing a faint glow on the horizon. Deliberately one figure —
 * the point is solitude, and that it is walking toward something.
 */
export class GateScene {
  readonly group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.DirectionalLight;
  private readonly beaconLight: THREE.PointLight;
  private readonly beaconMaterial: THREE.MeshStandardMaterial;
  private readonly ground: THREE.Mesh<THREE.CircleGeometry, THREE.MeshStandardMaterial>;
  private readonly disposables: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private built = false;
  private lastTime = 0;

  private static readonly PILGRIM_HEIGHT = 1.05;
  /** Profile facing screen-right, perpendicular to the fixed gate camera. */
  private static readonly FACING = 0.46;

  constructor(private assets: AssetLoader) {
    this.group.name = "GateScene";
    this.group.visible = false;

    const groundGeometry = new THREE.CircleGeometry(9, 56);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x151b28,
      roughness: 1,
      metalness: 0,
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.02;
    this.ground.receiveShadow = true;
    this.group.add(this.ground);

    // A touch of ambient so the chamber reads brighter than the matte slab.
    this.group.add(new THREE.HemisphereLight(0x40527a, 0x0a0c12, 0.7));

    // Cold moonlight picks the figure out of the dark; a warm rim separates it.
    this.keyLight = new THREE.DirectionalLight(0xc7d8f7, 3.9);
    this.keyLight.position.set(-2.4, 3.6, 3.4);
    this.keyLight.target.position.set(0, 0.5, 0);
    this.group.add(this.keyLight, this.keyLight.target);

    this.rimLight = new THREE.DirectionalLight(0xffc98a, 1.8);
    this.rimLight.position.set(2.2, 2.2, -3.4);
    this.rimLight.target.position.set(0, 0.5, 0);
    this.group.add(this.rimLight, this.rimLight.target);

    // A distant light on the horizon: the thing the pilgrim is walking toward.
    const beaconGeometry = new THREE.SphereGeometry(0.055, 12, 10);
    this.beaconMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd9a0,
      emissive: 0xffc069,
      emissiveIntensity: 3,
      roughness: 0.3,
    });
    this.geometries.push(beaconGeometry);
    this.disposables.push(this.beaconMaterial);
    const beacon = new THREE.Mesh(beaconGeometry, this.beaconMaterial);
    beacon.position.set(1.75, 0.24, -0.95);
    this.group.add(beacon);

    this.beaconLight = new THREE.PointLight(0xffc069, 2.4, 4.5, 2);
    this.beaconLight.position.copy(beacon.position);
    this.group.add(this.beaconLight);
  }

  /** Called once the GLB assets have finished loading. */
  build(): void {
    if (this.built) return;
    this.built = true;

    const pilgrim = this.assets.instance("pilgrim");
    if (!pilgrim) return;
    pilgrim.name = "GatePilgrim";
    this.prepare(pilgrim, GateScene.PILGRIM_HEIGHT);
    // True profile, facing the distant light rather than the viewer.
    pilgrim.rotation.y = GateScene.FACING;

    const seen = new Map<THREE.Material, THREE.Material>();
    pilgrim.traverse((object) => {
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
        cloned.metalness = 0;
        cloned.roughness = 0.7;
        cloned.color.set(0xe8ecf5);
        if (cloned.map) {
          cloned.emissiveMap = cloned.map;
          cloned.emissive = new THREE.Color(0x36456b);
          cloned.emissiveIntensity = 0.6;
        }
        seen.set(material, cloned);
        this.disposables.push(cloned);
        copy = cloned;
      }
      mesh.material = copy;
    });
    this.group.add(pilgrim);

    const clips = this.assets.animations("pilgrim");
    const idle = THREE.AnimationClip.findByName(clips, "idle");
    if (idle) {
      this.mixer = new THREE.AnimationMixer(pilgrim);
      this.mixer.clipAction(idle).play();
    }
  }

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

  setTheme(theme: Theme): void {
    this.ground.material.color.set(theme.ground);
    this.rimLight.color.set(theme.shrineGlow);
    this.beaconLight.color.set(theme.shrineGlow);
    this.beaconMaterial.color.set(theme.shrineGlow);
    this.beaconMaterial.emissive.set(theme.shrineGlow);
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
    this.mixer?.update(dt);
    const pulse = Math.sin(t * 1.1);
    this.beaconLight.intensity = 2.2 + pulse * 0.6;
    this.beaconMaterial.emissiveIntensity = 2.8 + pulse * 0.7;
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.mixer = null;
    for (const material of this.disposables) material.dispose();
    this.disposables.length = 0;
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.length = 0;
  }
}
