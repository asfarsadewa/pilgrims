import { loadLevel } from "../world/LevelLoader";
import { LevelDefinition } from "../world/Level";
import { cloneState } from "./clone";
import { resolveTurn } from "./TurnResolver";
import { UndoManager } from "./UndoManager";
import { Direction, GameState, SimulationMode } from "./types";

export type GameEvent =
  | {
      type: "turn";
      direction: Direction;
      previous: GameState;
      next: GameState;
    }
  | { type: "undo"; previous: GameState; next: GameState }
  | { type: "restart"; previous: GameState; next: GameState }
  | { type: "load"; previous: GameState | null; next: GameState };

export type GameListener = (event: GameEvent) => void;

/**
 * Owns the current GameState, the undo stack and the simulation mode.
 * Deliberately free of rendering concerns.
 */
export class Game {
  state: GameState;
  mode: SimulationMode = "waiting";

  private readonly level: LevelDefinition;
  private readonly undo = new UndoManager();
  private readonly listeners = new Set<GameListener>();

  constructor(level: LevelDefinition) {
    this.level = level;
    this.state = loadLevel(level);
  }

  on(listener: GameListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GameEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  get canUndo(): boolean {
    return this.undo.canUndo;
  }

  get moveCount(): number {
    return this.state.turn;
  }

  /** Attempt a Shrine move. Returns true when a turn was resolved. */
  tryMove(direction: Direction): boolean {
    if (this.mode === "animating" || this.mode === "completed") return false;
    if (this.mode === "failed" && direction !== Direction.Wait) return false;

    const previous = this.state;
    const next = resolveTurn(previous, direction);
    if (!next) return false;

    this.undo.push(previous);
    this.state = next;
    this.mode =
      next.status === "solved"
        ? "completed"
        : next.status === "failed"
          ? "failed"
          : "animating";
    this.emit({ type: "turn", direction, previous, next });
    return true;
  }

  /** Called by the animation layer once a turn's visuals have finished. */
  finishAnimation(): void {
    if (this.mode === "animating") this.mode = "waiting";
  }

  /** Unlock input even if no animation ran (e.g. reduced motion). */
  setIdle(): void {
    if (this.mode === "animating") this.mode = "waiting";
  }

  undoMove(): boolean {
    if (this.mode === "animating") return false;
    const previous = this.state;
    const restored = this.undo.pop();
    if (!restored) return false;
    this.state = restored;
    this.mode = restored.status === "playing" ? "waiting" : "completed";
    this.emit({ type: "undo", previous, next: restored });
    return true;
  }

  restart(): void {
    const previous = this.state;
    this.undo.clear();
    this.state = loadLevel(this.level);
    this.mode = "waiting";
    this.emit({ type: "restart", previous, next: cloneState(this.state) });
  }

  /** Restore a specific state (used by level select / tests). */
  setState(state: GameState): void {
    this.state = state;
  }
}
