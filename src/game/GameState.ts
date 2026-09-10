import { GameState } from "./types";

/** Compact, deterministic signature of a state. Useful for solvers and debug. */
export function stateSignature(state: GameState): string {
  const pilgrims = state.pilgrims
    .map((p) => (p.exited ? `${p.id}:X` : `${p.id}:${p.position.x},${p.position.y}`))
    .sort()
    .join("|");
  return `${state.shrine.position.x},${state.shrine.position.y}#${pilgrims}#${state.status}`;
}

/** Moves spent on a solved state. */
export function moveCount(state: GameState): number {
  return state.turn;
}
