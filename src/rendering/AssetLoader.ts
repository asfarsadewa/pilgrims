import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const MODEL_FILES = {
  pilgrim: "models/pilgrim.glb",
  shrine: "models/shrine.glb",
  props: "models/props.glb",
  title: "models/title.glb",
} as const;

export type ModelName = keyof typeof MODEL_FILES;

interface LoadedModel {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

/**
 * Loads the Blender-prepared GLB models once and hands out cheap clones.
 * Skinned meshes are cloned with SkeletonUtils so their skeletons rebind.
 */
export class AssetLoader {
  private readonly loader = new GLTFLoader();
  private readonly models = new Map<ModelName, LoadedModel>();
  loaded = false;

  async loadAll(): Promise<void> {
    const base = import.meta.env.BASE_URL ?? "./";
    await Promise.all(
      (Object.keys(MODEL_FILES) as ModelName[]).map(async (name) => {
        const gltf = await this.loader.loadAsync(`${base}${MODEL_FILES[name]}`);
        gltf.scene.name = name;
        this.models.set(name, {
          scene: gltf.scene,
          animations: gltf.animations ?? [],
        });
      }),
    );
    this.loaded = true;
  }

  /** A fresh clone of a whole model, with skeletons rebound. */
  instance(name: ModelName): THREE.Object3D | null {
    const loaded = this.models.get(name);
    if (!loaded) return null;
    return SkeletonUtils.clone(loaded.scene);
  }

  animations(name: ModelName): THREE.AnimationClip[] {
    return this.models.get(name)?.animations ?? [];
  }

  /** A clone of a named node inside a model (used for scattered props). */
  prop(name: string): THREE.Object3D | null {
    const source = this.models.get("props");
    if (!source) return null;
    const node = source.scene.getObjectByName(name);
    return node ? SkeletonUtils.clone(node) : null;
  }

  names(): ModelName[] {
    return Object.keys(MODEL_FILES) as ModelName[];
  }
}
