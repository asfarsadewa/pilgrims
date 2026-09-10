import * as THREE from "three";
import { GameState, TileType } from "../game/types";
import { AssetLoader } from "./AssetLoader";
import { gridToWorld, hash2d, WorldLayout } from "./coords";
import { Theme } from "./themes";

interface PropTint {
  foliageA: number;
  foliageB: number;
  grass: number;
  rock: number;
}

const PROP_TINTS: Record<string, PropTint> = {
  road: { foliageA: 0x8a5a24, foliageB: 0x50662e, grass: 0x4e6a33, rock: 0x565a5f },
  river: { foliageA: 0x6f6a34, foliageB: 0x3f6250, grass: 0x47664f, rock: 0x4b5b5c },
  mountain: { foliageA: 0x6a6236, foliageB: 0x3e5a44, grass: 0x46603f, rock: 0x50535d },
  snow: { foliageA: 0x9fb6c4, foliageB: 0x7d97a8, grass: 0x8fa6b4, rock: 0x9aa6b2 },
  ruins: { foliageA: 0x8a6a2c, foliageB: 0x6f6a3a, grass: 0x746a3a, rock: 0x6b604c },
  night: { foliageA: 0x2e3a56, foliageB: 0x24344a, grass: 0x2a3a4a, rock: 0x2c3346 },
};

/**
 * Scatters Blender-authored props around the board. Purely cosmetic and fully
 * deterministic: props never sit in the middle of a walkable tile, so puzzle
 * readability is preserved.
 */
export class DecorRenderer {
  readonly group = new THREE.Group();
  private disposables: THREE.Material[] = [];

  constructor(private assets: AssetLoader) {
    this.group.name = "Decor";
  }

  build(state: GameState, theme: Theme): void {
    this.dispose();
    this.layout = { width: state.width, height: state.height };
    const tint = PROP_TINTS[theme.name] ?? PROP_TINTS.road;

    let placements = 0;
    const maxPlacements = 90;

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (placements >= maxPlacements) break;
        const tile = state.board.tileAt(x, y);
        const world = gridToWorld(this.layout, x, y);
        const roll = hash2d(x * 3 + 11, y * 7 + 5);

        if (tile === TileType.Wall) {
          const variation = hash2d(x, y);
          const top = -0.32 + (1.0 + variation * 0.45);
          if (roll < 0.3) {
            const pick = hash2d(x + 40, y + 90);
            const name =
              pick < 0.4 ? "TreeC" : pick < 0.75 ? "TreeA" : "TreeB";
            const prop = this.spawn(name, world.x, top - 0.05, world.z, tint, 0.7 + roll);
            if (prop) {
              prop.rotation.y = roll * Math.PI * 2;
              placements++;
            }
          } else if (roll < 0.42) {
            const prop = this.spawn("RockA", world.x + 0.1, top - 0.12, world.z, tint, 0.55);
            if (prop) {
              prop.rotation.y = roll * 6;
              placements++;
            }
          } else if (roll < 0.46) {
            const prop = this.spawn("PillarA", world.x, top - 0.08, world.z, tint, 0.6);
            if (prop) placements++;
          }
        } else if (tile === TileType.Floor) {
          // Keep the tile centre clear: props hug a corner.
          if (roll < 0.16) {
            const corner = hash2d(x + 7, y + 3) * Math.PI * 2;
            const prop = this.spawn(
              "GrassA",
              world.x + Math.cos(corner) * 0.32,
              0.0,
              world.z + Math.sin(corner) * 0.32,
              tint,
              0.5 + roll,
            );
            if (prop) placements++;
          } else if (roll > 0.965) {
            const prop = this.spawn("RockA", world.x + 0.3, 0.02, world.z - 0.3, tint, 0.28);
            if (prop) placements++;
          }
        }
      }
    }
  }

  private spawn(
    name: string,
    x: number,
    y: number,
    z: number,
    tint: PropTint,
    scale: number,
  ): THREE.Object3D | null {
    const prop = this.assets.prop(name);
    if (!prop) return null;
    this.tintProp(prop, tint);
    prop.position.set(x, y, z);
    prop.scale.setScalar(scale);
    prop.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = name.startsWith("Tree");
      mesh.receiveShadow = true;
    });
    this.group.add(prop);
    return prop;
  }

  private tintProp(root: THREE.Object3D, tint: PropTint): void {
    const colors: Record<string, number> = {
      FoliageA: tint.foliageA,
      FoliageB: tint.foliageB,
      Grass: tint.grass,
      Stone: tint.rock,
      StoneDark: tint.rock,
    };
    root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      if (!material || !material.name || colors[material.name] === undefined) return;
      const copy = material.clone();
      copy.color.set(colors[material.name]);
      this.disposables.push(copy);
      mesh.material = copy;
    });
  }

  private layout: WorldLayout = { width: 1, height: 1 };

  dispose(): void {
    for (const material of this.disposables) material.dispose();
    this.disposables = [];
    this.group.clear();
  }
}
