import * as THREE from "three";
import { GameState, TileType } from "../game/types";
import { EntityRenderer } from "./EntityRenderer";
import { Effects } from "./Effects";
import { Theme } from "./themes";

interface Tween {
  object: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
}

interface ActiveTurn {
  elapsed: number;
  duration: number;
  tweens: Tween[];
  movingIds: string[];
  exitIds: string[];
  hazardIds: string[];
  resolve: () => void;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Animates the transition between two resolved states. The simulation has
 * already happened; this only interpolates visuals.
 */
export class AnimationManager {
  /** Seconds per turn. */
  duration = 0.22;
  reducedMotion = false;

  private turn: ActiveTurn | null = null;

  constructor(
    private entities: EntityRenderer,
    private effects: Effects,
    private theme: Theme,
  ) {}

  setTheme(theme: Theme): void {
    this.theme = theme;
  }

  get isAnimating(): boolean {
    return this.turn !== null;
  }

  animateTurn(previous: GameState, next: GameState): Promise<void> {
    if (this.reducedMotion) {
      this.applyInstant(next);
      return Promise.resolve();
    }

    // If a turn is somehow already running, finish it instantly.
    if (this.turn) this.finishNow();

    const tweens: Tween[] = [];
    const movingIds: string[] = [];
    const exitIds: string[] = [];
    const hazardIds: string[] = [];

    // Shrine.
    const shrineView = this.entities.getShrine();
    if (shrineView) {
      const from = this.entities.positionOf(previous.shrine.position);
      const to = this.entities.positionOf(next.shrine.position);
      shrineView.root.position.copy(from);
      if (!from.equals(to)) {
        tweens.push({ object: shrineView.root, from, to });
        this.effects.shrineGhost(previous.shrine.position, this.theme.shrineGlow);
      }
    }

    // Pilgrims.
    for (const pilgrim of next.pilgrims) {
      const view = this.entities.getPilgrim(pilgrim.id);
      if (!view) continue;
      const previousPilgrim = previous.pilgrims.find((p) => p.id === pilgrim.id);
      const wasExited = previousPilgrim?.exited ?? false;

      if (wasExited && pilgrim.exited) {
        view.root.visible = false;
        continue;
      }

      view.root.visible = true;
      view.root.scale.setScalar(1);

      const from = this.entities.positionOf(
        previousPilgrim ? previousPilgrim.position : pilgrim.position,
      );
      const to = this.entities.positionOf(pilgrim.position);
      view.root.position.copy(from);

      if (!from.equals(to)) {
        tweens.push({ object: view.root, from, to });
        movingIds.push(pilgrim.id);
        view.moving = true;
        this.entities.setFacing(
          pilgrim.id,
          to.x - from.x,
          to.z - from.z,
        );
      }

      if (pilgrim.exited && !wasExited) {
        exitIds.push(pilgrim.id);
        const tile = next.board.tileAt(pilgrim.position.x, pilgrim.position.y);
        if (tile === TileType.Hazard) hazardIds.push(pilgrim.id);
      }
    }

    if (tweens.length === 0) {
      this.applyExits(exitIds, hazardIds, next);
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.turn = {
        elapsed: 0,
        duration: this.duration,
        tweens,
        movingIds,
        exitIds,
        hazardIds,
        resolve,
      };
    });
  }

  update(dt: number): void {
    if (!this.turn) return;
    this.turn.elapsed += dt;
    const raw = Math.min(this.turn.elapsed / this.turn.duration, 1);
    const t = easeInOut(raw);
    for (const tween of this.turn.tweens) {
      tween.object.position.lerpVectors(tween.from, tween.to, t);
    }
    if (raw >= 1) this.finishNow();
  }

  private finishNow(): void {
    const turn = this.turn;
    if (!turn) return;
    this.turn = null;
    for (const tween of turn.tweens) tween.object.position.copy(tween.to);
    for (const id of turn.movingIds) this.entities.setMoving(id, false);
    this.applyExits(turn.exitIds, turn.hazardIds, null);
    turn.resolve();
  }

  /** Update state instantly (level load, restart, reduced motion). */
  applyInstant(state: GameState): void {
    if (this.turn) {
      this.turn.resolve();
      this.turn = null;
    }
    this.entities.syncInstant(state);
  }

  private applyExits(
    exitIds: string[],
    hazardIds: string[],
    next: GameState | null,
  ): void {
    for (const id of exitIds) {
      const pilgrim = next?.pilgrims.find((p) => p.id === id);
      const position = pilgrim?.position;
      if (position) {
        const isHazard = hazardIds.includes(id);
        this.effects.burst(
          position,
          isHazard ? this.theme.hazardGlow : this.theme.exitGlow,
          isHazard
            ? { count: 14, height: 1.6, life: 0.8, size: 0.06 }
            : { count: 10, height: 1.8, life: 0.9, size: 0.05 },
        );
      }
      // Keep the mesh visible until the burst plays, then hide it.
      this.entities.setExited(id, true);
    }
  }

  /** Used by a fresh level load to cancel any in-flight turn. */
  reset(): void {
    if (this.turn) {
      this.turn.resolve();
      this.turn = null;
    }
  }
}
