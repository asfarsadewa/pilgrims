import { cloneState } from "./clone";
import { GameState } from "./types";

/**
 * Unlimited undo via full immutable snapshots.
 * States are tiny, so we never bother with reversible commands.
 */
export class UndoManager {
  private stack: GameState[] = [];

  push(state: GameState): void {
    this.stack.push(cloneState(state));
  }

  pop(): GameState | undefined {
    return this.stack.pop();
  }

  clear(): void {
    this.stack = [];
  }

  get depth(): number {
    return this.stack.length;
  }

  get canUndo(): boolean {
    return this.stack.length > 0;
  }
}
