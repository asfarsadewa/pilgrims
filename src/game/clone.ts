import { GameState, GridPosition } from "../game/types";

/** Deep clone a game state. States are tiny, so snapshot everything. */
export function cloneState(state: GameState): GameState {
  return {
    levelId: state.levelId,
    levelName: state.levelName,
    theme: state.theme,
    par: state.par,
    width: state.width,
    height: state.height,
    board: state.board.clone(),
    shrine: { position: { ...state.shrine.position } },
    pilgrims: state.pilgrims.map((p) => ({
      ...p,
      position: { ...p.position },
    })),
    shrineHistory: state.shrineHistory.map((p) => ({ ...p })),
    turn: state.turn,
    status: state.status,
    failureReason: state.failureReason,
  };
}

export function posEquals(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

export function posKey(p: GridPosition): string {
  return `${p.x},${p.y}`;
}
