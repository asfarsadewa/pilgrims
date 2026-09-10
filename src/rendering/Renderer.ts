import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { GameState, GridPosition } from "../game/types";
import { AnimationManager } from "./AnimationManager";
import { AssetLoader } from "./AssetLoader";
import { BoardRenderer } from "./BoardRenderer";
import { CameraPresetId } from "./cameraPresets";
import { CameraController } from "./CameraController";
import { DecorRenderer } from "./DecorRenderer";
import { EntityRenderer } from "./EntityRenderer";
import { Effects } from "./Effects";
import { MemoryMarker } from "./MemoryMarker";
import { Particles } from "./Particles";
import { SceneBuilder } from "./SceneBuilder";
import { getTheme, Theme } from "./themes";
import { TitleScene } from "./TitleScene";
import { createVignettePass } from "./VignettePass";

/**
 * Composes the Three.js world, owns the post-processing chain and the render
 * loop. The renderer knows nothing about turn rules.
 */
export class Renderer {
  readonly sceneBuilder = new SceneBuilder();
  readonly cameraController = new CameraController();
  readonly entityRenderer: EntityRenderer;
  readonly assets = new AssetLoader();

  private gl: THREE.WebGLRenderer;
  private boardRenderer: BoardRenderer;
  private decorRenderer: DecorRenderer;
  private effects: Effects;
  private particles: Particles;
  private memoryMarker: MemoryMarker;
  private hasDoubters = false;
  private animationManager: AnimationManager;
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private container: HTMLElement;
  private resizeObserver: ResizeObserver;
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private theme: Theme = getTheme("road");
  private readonly titleScene: TitleScene;
  private mode: "title" | "game" = "title";

  constructor(container: HTMLElement) {
    this.container = container;
    this.gl = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.1;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.gl.domElement);

    this.entityRenderer = new EntityRenderer(this.assets);
    this.boardRenderer = new BoardRenderer({ width: 1, height: 1 });
    this.decorRenderer = new DecorRenderer(this.assets);
    this.effects = new Effects({ width: 1, height: 1 });
    this.particles = new Particles();
    this.memoryMarker = new MemoryMarker();
    this.titleScene = new TitleScene(this.assets);

    const scene = this.sceneBuilder.scene;
    scene.add(this.boardRenderer.group);
    scene.add(this.decorRenderer.group);
    scene.add(this.entityRenderer.group);
    scene.add(this.effects.group);
    scene.add(this.particles.points);
    scene.add(this.memoryMarker.group);
    scene.add(this.titleScene.group);

    this.animationManager = new AnimationManager(
      this.entityRenderer,
      this.effects,
      this.theme,
    );

    this.setupComposer();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  async preload(): Promise<void> {
    await this.assets.loadAll();
    this.titleScene.build();
  }

  /** Apply a camera view preset (diorama / classic / elevated). */
  setCamera(id: CameraPresetId): void {
    this.cameraController.setPreset(id);
  }

  private setupComposer(): void {
    try {
      const composer = new EffectComposer(this.gl);
      composer.addPass(
        new RenderPass(this.sceneBuilder.scene, this.cameraController.camera),
      );
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(1024, 1024),
        0.62,
        0.7,
        0.82,
      );
      composer.addPass(bloom);
      composer.addPass(createVignettePass());
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloom = bloom;
    } catch {
      this.composer = null;
      this.bloom = null;
    }
  }

  get prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  loadLevel(state: GameState): void {
    this.mode = "game";
    this.titleScene.setVisible(false);
    this.setGameVisible(true);
    this.animationManager.reset();
    this.effects.clear();
    const theme = getTheme(state.theme);
    this.theme = theme;

    this.hasDoubters = state.pilgrims.some((p) => p.type === "doubter");

    if (this.prefersReducedMotion) this.animationManager.reducedMotion = true;

    this.boardRenderer.build(state, theme);
    this.entityRenderer.setLevel(state, theme);
    this.decorRenderer.build(state, theme);
    this.effects.setLayout({ width: state.width, height: state.height });
    this.animationManager.setTheme(theme);

    const extent = Math.max(state.width, state.height) + 3.4;
    this.particles.setTheme(theme.exitGlow, extent);
    this.particles.points.visible = !this.prefersReducedMotion;

    this.cameraController.setOrbit(0);
    this.cameraController.fit(state.width, state.height, this.aspect());
    this.sceneBuilder.applyTheme(
      theme,
      state.width,
      state.height,
      this.cameraController.cameraDistance,
      this.cameraController.boardExtent,
    );

    if (this.bloom) {
      this.bloom.strength = theme.name === "night" ? 0.95 : 0.62;
      this.bloom.radius = 0.7;
      this.bloom.threshold = theme.name === "night" ? 0.7 : 0.82;
    }

    // Show the Shrine's memory only where doubters exist.
    this.memoryMarker.setEnabled(this.hasDoubters);
    if (this.hasDoubters) {
      const world = this.entityRenderer.positionOf(state.shrine.position);
      this.memoryMarker.setWorld(world.x, world.z);
    }
  }

  /** Switch to the opening-screen monument. */
  showTitle(): void {
    this.mode = "title";
    this.animationManager.reset();
    this.effects.clear();
    this.memoryMarker.setEnabled(false);
    this.setGameVisible(false);
    this.titleScene.setVisible(true);

    const theme = getTheme("night");
    this.theme = theme;
    this.titleScene.setTheme(theme);
    this.cameraController.focus(5.2, this.aspect(), 1.25);
    this.cameraController.setOrbit(0.03);
    this.sceneBuilder.applyTheme(
      theme,
      5,
      5,
      this.cameraController.cameraDistance,
      this.cameraController.boardExtent,
    );
    this.particles.setTheme(theme.shrineGlow, 5);
    this.particles.points.visible = !this.prefersReducedMotion;

    if (this.bloom) {
      this.bloom.strength = 0.68;
      this.bloom.radius = 0.6;
      this.bloom.threshold = 0.85;
    }
  }

  get isTitle(): boolean {
    return this.mode === "title";
  }

  private setGameVisible(visible: boolean): void {
    this.boardRenderer.group.visible = visible;
    this.decorRenderer.group.visible = visible;
    this.entityRenderer.group.visible = visible;
    this.effects.group.visible = visible;
  }

  animateTurn(previous: GameState, next: GameState): Promise<void> {
    // The tile the Shrine leaves is what doubters will follow this turn.
    if (this.hasDoubters) {
      const world = this.entityRenderer.positionOf(previous.shrine.position);
      this.memoryMarker.setWorld(world.x, world.z);
    }
    return this.animationManager.animateTurn(previous, next);
  }

  /** Cosmetic feedback when the Shrine cannot move. */
  blockedAt(position: GridPosition): void {
    this.effects.stepPuff(position, 0x9aa0aa);
  }

  /** Jump to a state with no animation (undo with reduced motion, restart). */
  applyInstant(state: GameState): void {
    this.animationManager.applyInstant(state);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      const time = this.clock.elapsedTime;

      this.animationManager.update(dt);
      this.entityRenderer.update(time * 1000);
      this.boardRenderer.update(time * 1000);
      if (this.mode === "title") this.titleScene.update(time * 1000);
      this.effects.update(dt);
      this.memoryMarker.update(time);
      if (this.particles.points.visible) this.particles.update(dt, time);
      if (!this.prefersReducedMotion) this.cameraController.update(time);

      if (this.composer) {
        this.composer.render();
      } else {
        this.gl.render(
          this.sceneBuilder.scene,
          this.cameraController.camera,
        );
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose(): void {
    this.stop();
    this.resizeObserver.disconnect();
    this.boardRenderer.dispose();
    this.decorRenderer.dispose();
    this.entityRenderer.dispose();
    this.effects.clear();
    this.particles.dispose();
    this.memoryMarker.dispose();
    this.titleScene.dispose();
    this.composer?.dispose();
    this.gl.dispose();
    this.gl.domElement.remove();
  }

  private aspect(): number {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    return width / height;
  }

  private resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.gl.setSize(width, height, false);
    this.composer?.setSize(width, height);
    this.cameraController.resize(width / height);
  }
}
