import { collectIntents, resolveCollisions } from "./CollisionResolver";
import { cloneState } from "./clone";
import { getPilgrimIntent } from "./Movement";
import {
  DIRECTION_VECTORS,
  Direction,
  GameState,
  GridPosition,
  TileType,
} from "./types";

const SHRINE_HISTORY_LIMIT = 12;

/**
 * Can the Shrine legally step in this direction right now?
 * Blocked by terrain, other pilgrims, or the board edge.
 */
export function canMoveShrine(state: GameState, direction: Direction): boolean {
  if (direction === Direction.Wait) return true;
  const vector = DIRECTION_VECTORS[direction];
  const next: GridPosition = {
    x: state.shrine.position.x + vector.x,
    y: state.shrine.position.y + vector.y,
  };
  if (!state.board.canShrineEnter(next.x, next.y)) return false;
  const occupied = state.pilgrims.some(
    (p) => !p.exited && p.position.x === next.x && p.position.y === next.y,
  );
  return !occupied;
}

export function moveShrine(
  position: GridPosition,
  direction: Direction,
): GridPosition {
  const vector = DIRECTION_VECTORS[direction];
  return { x: position.x + vector.x, y: position.y + vector.y };
}

/**
 * Resolve one turn. The input state is never mutated.
 *
 * Returns null when the Shrine is blocked (the move does not consume a turn).
 */
export function resolveTurn(
  state: GameState,
  direction: Direction,
): GameState | null {
  if (state.status !== "playing") return null;
  if (!canMoveShrine(state, direction)) return null;

  const next = cloneState(state);

  // 1. Move the Shrine.
  next.shrine.position = moveShrine(
    next.shrine.position,
    direction,
  );

  // 2. Record Shrine history (for doubters / afterimages).
  next.shrineHistory.push({ ...next.shrine.position });
  if (next.shrineHistory.length > SHRINE_HISTORY_LIMIT) {
    next.shrineHistory.shift();
  }

  // 3. Every pilgrim decides, simultaneously.
  const intents = collectIntents(next, (pilgrim) =>
    getPilgrimIntent(next, pilgrim),
  );

  // 4. Resolve collisions.
  const moves = resolveCollisions(next, intents);

  // 5. Apply movement.
  for (const pilgrim of next.pilgrims) {
    const destination = moves.get(pilgrim.id);
    if (destination) pilgrim.position = { ...destination };
  }

  // 6. Resolve terrain consequences.
  //    Snapshot the board before terrain effects (future mechanisms hook here).
  let failed = false;
  for (const pilgrim of next.pilgrims) {
    if (pilgrim.exited) continue;
    const tile = next.board.tileAt(pilgrim.position.x, pilgrim.position.y);
    if (tile === TileType.Hazard) {
      pilgrim.exited = true;
      failed = true;
    } else if (tile === TileType.Exit) {
      pilgrim.exited = true;
    }
  }

  next.turn += 1;

  // 7. Evaluate outcome.
  if (failed) {
    next.status = "failed";
    next.failureReason = "A pilgrim was lost.";
  } else {
    const required = next.pilgrims.length;
    const safe = next.pilgrims.filter((p) => p.exited).length;
    if (required > 0 && safe === required) {
      next.status = "solved";
      next.failureReason = null;
    }
  }

  return next;
}

/** True when every pilgrim has reached an exit. */
export function isSolved(state: GameState): boolean {
  return (
    state.pilgrims.length > 0 && state.pilgrims.every((p) => p.exited)
  );
}

export function isFailed(state: GameState): boolean {
  return state.status === "failed";
}
