import * as THREE from "three";
import {
  CameraPresetId,
  DEFAULT_CAMERA,
  getCameraPreset,
} from "./cameraPresets";

/**
 * Orthographic diorama camera. Frames the board automatically; never scrolls
 * or rotates arbitrarily, keeping spatial relationships readable.
 */
export class CameraController {
  readonly camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
  private readonly target = new THREE.Vector3(0, 0, 0);
  private readonly direction: THREE.Vector3;
  private readonly desiredDirection: THREE.Vector3;
  private readonly up = new THREE.Vector3(0, 1, 0);
  private extent = 10;
  private distance = 24;
  private orbit = 0;
  private lastTime = 0;

  constructor() {
    this.camera.up.set(0, 1, 0);
    const [x, y, z] = getCameraPreset(DEFAULT_CAMERA).direction;
    this.direction = new THREE.Vector3(x, y, z).normalize();
    this.desiredDirection = this.direction.clone();
  }

  get boardExtent(): number {
    return this.extent;
  }

  /** Distance from the board centre. Fog is derived from this. */
  get cameraDistance(): number {
    return this.distance;
  }

  /** Radians per second of slow orbit around the target. */
  setOrbit(speed: number): void {
    this.orbit = speed;
  }

  /** Smoothly move to a view preset. */
  setPreset(id: CameraPresetId): void {
    const [x, y, z] = getCameraPreset(id).direction;
    this.desiredDirection.set(x, y, z).normalize();
  }

  fit(width: number, height: number, aspect: number): void {
    this.focus(Math.max(width, height) + 3.4, aspect, 0);
  }

  /** Frame an arbitrary extent, optionally aimed above the ground plane. */
  focus(extent: number, aspect: number, targetY = 0): void {
    this.extent = extent;
    this.distance = this.extent * 2.4;
    this.target.set(0, targetY, 0);
    this.applyFrustum(aspect);
    this.update(0);
  }

  /** Gentle breathing, plus an optional slow orbit for the title screen. */
  update(time: number): void {
    const dt = Math.min(Math.max(time - this.lastTime, 0), 0.1);
    this.lastTime = time;
    this.direction.lerp(this.desiredDirection, Math.min(1, dt * 4)).normalize();

    const angle = this.orbit * time;
    const direction = this.direction
      .clone()
      .applyAxisAngle(this.up, angle);
    const sway = 0.09;
    this.camera.position.set(
      this.target.x + direction.x * this.distance + Math.sin(time * 0.23) * sway,
      this.target.y + direction.y * this.distance + Math.sin(time * 0.17) * sway * 0.5,
      this.target.z + direction.z * this.distance + Math.cos(time * 0.2) * sway,
    );
    this.camera.lookAt(this.target);
  }

  resize(aspect: number): void {
    this.applyFrustum(aspect);
  }

  private applyFrustum(aspect: number): void {
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const size = this.extent;
    let viewWidth: number;
    let viewHeight: number;
    if (safeAspect >= 1) {
      viewHeight = size;
      viewWidth = size * safeAspect;
    } else {
      viewWidth = size;
      viewHeight = size / safeAspect;
    }
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
  }
}
