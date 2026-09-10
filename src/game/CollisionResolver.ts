import { cloneState, posKey } from "./clone";
import { GameState, GridPosition, MoveIntent, PilgrimState } from "./types";

/**
 * Resolve simultaneous pilgrim movement.
 *
 * Rules (all deterministic, no entity-order priority):
 *  - Two pilgrims targeting the same tile both stay.
 *  - A pilgrim may not enter a tile occupied by a pilgrim who is staying
 *    (or whose move was itself cancelled). Chains are resolved to a fixpoint.
 *  - Two pilgrims may not swap tiles.
 *
 * Returns a map of pilgrim id -> destination for the pilgrims that actually move.
 */
export function resolveCollisions(
  state: GameState,
  intents: MoveIntent[],
): Map<string, GridPosition> {
  const active = new Map<string, MoveIntent>();
  for (const intent of intents) active.set(intent.entityId, intent);

  const positionOf = new Map<string, GridPosition>();
  for (const pilgrim of state.pilgrims) {
    if (!pilgrim.exited) positionOf.set(pilgrim.id, pilgrim.position);
  }

  let changed = true;
  while (changed) {
    changed = false;

    // (1) Same destination: cancel every claimant.
    const claimants = new Map<string, string[]>();
    for (const intent of active.values()) {
      const key = posKey(intent.to);
      const list = claimants.get(key) ?? [];
      list.push(intent.entityId);
      claimants.set(key, list);
    }
    for (const [, ids] of claimants) {
      if (ids.length > 1) {
        for (const id of ids) {
          if (active.delete(id)) changed = true;
        }
      }
    }

    // (2) Destination occupied by a pilgrim who is not actively moving.
    for (const [id, intent] of [...active]) {
      for (const pilgrim of state.pilgrims) {
        if (pilgrim.exited || pilgrim.id === id) continue;
        if (pilgrim.position.x !== intent.to.x) continue;
        if (pilgrim.position.y !== intent.to.y) continue;
        if (!active.has(pilgrim.id)) {
          active.delete(id);
          changed = true;
        }
        break;
      }
    }

    // (3) Swaps: both stay.
    for (const [id, intent] of [...active]) {
      for (const [otherId, other] of active) {
        if (id >= otherId) continue;
        if (
          posKey(intent.to) === posKey(other.from) &&
          posKey(other.to) === posKey(intent.from)
        ) {
          if (active.delete(id)) changed = true;
          if (active.delete(otherId)) changed = true;
        }
      }
    }
  }

  const result = new Map<string, GridPosition>();
  for (const [id, intent] of active) result.set(id, intent.to);
  return result;
}

/** Build the raw intent list (terrain-aware, ignoring other pilgrims). */
export function collectIntents(
  state: GameState,
  intentFor: (pilgrim: PilgrimState) => GridPosition | null,
): MoveIntent[] {
  const intents: MoveIntent[] = [];
  for (const pilgrim of state.pilgrims) {
    const to = intentFor(pilgrim);
    if (to) {
      intents.push({
        entityId: pilgrim.id,
        from: { ...pilgrim.position },
        to,
      });
    }
  }
  return intents;
}

/** Exposed for tests / solver: produce a cheap derived copy without animating. */
export function snapshot(state: GameState): GameState {
  return cloneState(state);
}
