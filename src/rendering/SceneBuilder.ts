import * as THREE from "three";
import { Theme } from "./themes";

/**
 * Scene, fog and the two-light rig. Intentionally simple.
 */
export class SceneBuilder {
  readonly scene = new THREE.Scene();
  readonly hemi: THREE.HemisphereLight;
  readonly sun: THREE.DirectionalLight;
  private sunTarget = new THREE.Object3D();

  constructor() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;
  }

  applyTheme(
    theme: Theme,
    boardWidth: number,
    boardHeight: number,
    cameraDistance: number,
    boardExtent: number,
  ): void {
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(
      theme.fog,
      cameraDistance - boardExtent * 0.6,
      cameraDistance + boardExtent * 1.5,
    );

    this.hemi.color = new THREE.Color(theme.hemiSky);
    this.hemi.groundColor = new THREE.Color(theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity;

    this.sun.color = new THREE.Color(theme.sun);
    this.sun.intensity = theme.sunIntensity;

    const span = Math.max(boardWidth, boardHeight) + 4;
    this.sun.position.set(span * 0.5, span * 1.1, span * 0.4);
    this.sunTarget.position.set(0, 0, 0);

    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -span * 0.75;
    shadowCamera.right = span * 0.75;
    shadowCamera.top = span * 0.75;
    shadowCamera.bottom = -span * 0.75;
    shadowCamera.near = 0.5;
    shadowCamera.far = span * 4;
    shadowCamera.updateProjectionMatrix();
  }
}
