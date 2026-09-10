import { Board } from "../world/Board";
import { GameState, GridPosition, PilgrimState } from "./types";

/**
 * The tile a pilgrim is currently walking toward.
 * Normal pilgrims follow the Shrine; doubters follow where it was last turn.
 */
export function getPilgrimTarget(
  state: GameState,
  pilgrim: PilgrimState,
): GridPosition {
  if (pilgrim.type === "doubter") {
    const history = state.shrineHistory;
    return history.length >= 2
      ? history[history.length - 2]
      : state.shrine.position;
  }
  return state.shrine.position;
}

function manhattan(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Deterministic pilgrim intent.
 *
 * 1. If orthogonally adjacent to the Shrine, the pilgrim does not move.
 * 2. Prefer the axis with the greater remaining distance (ties favour horizontal).
 * 3. Fall back to the other axis when the preferred tile is blocked.
 * 4. Otherwise wait.
 *
 * Returns the destination tile, or null to wait.
 */
export function getPilgrimIntent(
  state: GameState,
  pilgrim: PilgrimState,
): GridPosition | null {
  if (pilgrim.exited || state.status !== "playing") return null;

  // Adjacency to the *actual* Shrine parks the pilgrim (obstacle / handbrake).
  if (manhattan(pilgrim.position, state.shrine.position) <= 1) return null;

  const target = getPilgrimTarget(state, pilgrim);
  const dx = target.x - pilgrim.position.x;
  const dy = target.y - pilgrim.position.y;
  if (dx === 0 && dy === 0) return null;

  const horizontal = { x: Math.sign(dx), y: 0 };
  const vertical = { x: 0, y: Math.sign(dy) };

  const preferHorizontal = Math.abs(dx) >= Math.abs(dy);
  const primary = preferHorizontal ? horizontal : vertical;
  const secondary = preferHorizontal ? vertical : horizontal;

  for (const step of [primary, secondary]) {
    if (step.x === 0 && step.y === 0) continue;
    const next = {
      x: pilgrim.position.x + step.x,
      y: pilgrim.position.y + step.y,
    };
    // Pilgrims never step onto the Shrine itself.
    if (next.x === state.shrine.position.x && next.y === state.shrine.position.y) {
      continue;
    }
    if (state.board.canPilgrimEnter(next.x, next.y)) return next;
  }

  return null;
}

export function isAdjacentToShrine(
  pilgrim: PilgrimState,
  shrine: GridPosition,
): boolean {
  return manhattan(pilgrim.position, shrine) <= 1;
}

export function canPilgrimEnter(board: Board, x: number, y: number): boolean {
  return board.canPilgrimEnter(x, y);
}
