import { GameState } from "./types";

/** Level is complete once every pilgrim has entered an exit. */
export function remainingRequiredPilgrims(state: GameState): number {
  return state.pilgrims.filter((p) => !p.exited).length;
}

export function isLevelComplete(state: GameState): boolean {
  return state.pilgrims.length > 0 && remainingRequiredPilgrims(state) === 0;
}

export function didLevelFail(state: GameState): boolean {
  return state.status === "failed";
}
