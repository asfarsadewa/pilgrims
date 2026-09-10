import { cloneState } from "./clone";
import { isSolved, resolveTurn } from "./TurnResolver";
import { Direction, GameState, GridPosition } from "./types";

const ACTIONS: Direction[] = [
  Direction.Up,
  Direction.Down,
  Direction.Left,
  Direction.Right,
  Direction.Wait,
];

export interface Solution {
  moves: number;
  path: Direction[];
}

/**
 * Where the Shrine was at the start of the current turn. Doubters resolve their
 * intent *after* the Shrine has moved, so `shrineHistory[length - 2]` is always
 * the pre-move Shrine position — i.e. exactly the state's own `shrine.position`.
 * That is why the solver does not need Shrine history in its key.
 */
export function previousShrinePosition(state: GameState): GridPosition {
  const history = state.shrineHistory;
  return history.length >= 2
    ? history[history.length - 2]
    : state.shrine.position;
}

/**
 * Stable, order-independent signature of a state: the BFS visited key and the
 * determinism fingerprint.
 *
 * =========================================================================
 *  ⚠  THE KEY MUST CONTAIN EVERYTHING THE NEXT TURN CAN DEPEND ON.  ⚠
 * =========================================================================
 *
 * It is intentionally minimal today, and that is *only* correct because:
 *   - intent is resolved AFTER the Shrine moves, so a Doubter's target
 *     (`shrineHistory[length - 2]`) is always this state's own
 *     `shrine.position` — no history needs to be stored; and
 *   - every current mechanic is otherwise stateless across a turn (the board
 *     never changes mid-level).
 * See `tests/doubter.test.ts` -> "does not depend on Shrine history beyond the
 * current position" for the test that pins this assumption.
 *
 * BEFORE ADDING ANY STATEFUL MECHANIC, EXTEND THIS KEY WITH ITS STATE, or BFS
 * will silently merge states that merely look equivalent. The symptom is nasty:
 * a level reported as impossible (or a bogus minimum) rather than a crash.
 *
 * Mechanics that REQUIRE extending the key, and what to add:
 *   - collapsing bridges / burning ground ....... the changing board tiles
 *   - persistent doors, plates, one-way gates ... mechanism/board state
 *   - Elder "moves every second turn" .......... turn parity (`state.turn % 2`)
 *   - a pilgrim targeting Shrine[-3] ............ the relevant `shrineHistory`
 *   - anything with a "has been used" latch ...... that flag
 *
 * Rule of thumb: if two states with the same key can produce different results
 * from `resolveTurn(state, dir)`, the key is wrong.
 */
export function stateKey(state: GameState): string {
  const pilgrims = state.pilgrims
    .map((p) =>
      p.exited ? `${p.id}:X` : `${p.id}:${p.position.x},${p.position.y}`,
    )
    .sort()
    .join("|");
  return `${state.shrine.position.x},${state.shrine.position.y}#${pilgrims}`;
}

/** Replay a direction sequence from a fresh clone, returning the final state. */
export function replay(start: GameState, path: Direction[]): GameState {
  let state = cloneState(start);
  for (const direction of path) {
    const next = resolveTurn(state, direction);
    if (!next) return state;
    state = next;
  }
  return state;
}

/**
 * Breadth-first solver. The state space is small, discrete and deterministic,
 * so BFS finds the minimum move count. Used by `npm run solve` and tests.
 */
export function solve(
  start: GameState,
  options: { maxDepth?: number; forbidden?: Set<string> } = {},
): Solution | null {
  const maxDepth = options.maxDepth ?? 40;
  const forbidden = options.forbidden ?? new Set<string>();

  if (isSolved(start)) return { moves: 0, path: [] };

  const startKey = stateKey(start);
  const visited = new Set<string>([startKey]);
  const parent = new Map<string, { prev: string; dir: Direction } | null>();
  parent.set(startKey, null);

  let frontier: GameState[] = [start];

  for (let depth = 0; depth < maxDepth; depth++) {
    const next: GameState[] = [];
    for (const current of frontier) {
      for (const direction of ACTIONS) {
        const result = resolveTurn(current, direction);
        if (!result || result.status === "failed") continue;
        const key = stateKey(result);
        if (visited.has(key) || forbidden.has(key)) continue;
        visited.add(key);
        parent.set(key, { prev: stateKey(current), dir: direction });
        if (isSolved(result)) {
          const path: Direction[] = [];
          let cursor: string | null = key;
          while (cursor) {
            const entry = parent.get(cursor);
            if (!entry) break;
            path.unshift(entry.dir);
            cursor = entry.prev;
          }
          return { moves: path.length, path };
        }
        next.push(result);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return null;
}
