/**
 * Core simulation types.
 *
 * This module (and everything under src/game, src/world, src/entities) must
 * never import Three.js. The simulation is plain, deterministic TypeScript.
 */

export interface GridPosition {
  x: number;
  y: number;
}

export enum Direction {
  Up = "Up",
  Down = "Down",
  Left = "Left",
  Right = "Right",
  Wait = "Wait",
}

/** Game Y grows downward (like map rows). Up therefore means y - 1. */
export const DIRECTION_VECTORS: Record<Direction, GridPosition> = {
  [Direction.Up]: { x: 0, y: -1 },
  [Direction.Down]: { x: 0, y: 1 },
  [Direction.Left]: { x: -1, y: 0 },
  [Direction.Right]: { x: 1, y: 0 },
  [Direction.Wait]: { x: 0, y: 0 },
};

export enum TileType {
  Floor = "Floor",
  Wall = "Wall",
  Void = "Void",
  Exit = "Exit",
  Hazard = "Hazard",
}

export type PilgrimType = "normal" | "doubter";

export interface ShrineState {
  position: GridPosition;
}

export interface PilgrimState {
  id: string;
  type: PilgrimType;
  position: GridPosition;
  /** True once the pilgrim has entered an exit. Kept in the array so undo can restore it. */
  exited: boolean;
  /** Stable index used only for cosmetic variation. */
  colorIndex: number;
}

export type GameStatus = "playing" | "solved" | "failed";

export interface GameState {
  levelId: string;
  levelName: string;
  theme: string;
  par?: number;
  width: number;
  height: number;
  board: import("../world/Board").Board;
  shrine: ShrineState;
  pilgrims: PilgrimState[];
  /**
   * Oldest -> newest shrine positions. The last entry is the current position.
   * Doubters target the position one entry back.
   */
  shrineHistory: GridPosition[];
  turn: number;
  status: GameStatus;
  failureReason: string | null;
}

export interface MoveIntent {
  entityId: string;
  from: GridPosition;
  to: GridPosition;
}

export type SimulationMode =
  | "waiting"
  | "animating"
  | "completed"
  | "failed";
