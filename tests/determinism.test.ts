import { describe, expect, it } from "vitest";
import { cloneState } from "../src/game/clone";
import { resolveCollisions } from "../src/game/CollisionResolver";
import { replay, solve, stateKey } from "../src/game/Solver";
import { resolveTurn } from "../src/game/TurnResolver";
import {
  Direction,
  GameState,
  MoveIntent,
  PilgrimState,
  TileType,
} from "../src/game/types";
import { LEVELS } from "../src/levels/index";
import { Board } from "../src/world/Board";
import { loadLevel } from "../src/world/LevelLoader";
import { LevelDefinition } from "../src/world/Level";

const CAMPAIGN = LEVELS as LevelDefinition[];

function fromMap(map: string[]): GameState {
  return loadLevel({
    id: "det",
    name: "det",
    width: map[0].length,
    height: map.length,
    map,
  });
}

function manualState(
  pilgrims: Array<Partial<PilgrimState> & { x: number; y: number }>,
  shrine: { x: number; y: number },
): GameState {
  const width = 6;
  const height = 4;
  const tiles: TileType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TileType.Floor),
  );
  return {
    levelId: "manual",
    levelName: "manual",
    theme: "road",
    width,
    height,
    board: new Board(width, height, tiles),
    shrine: { position: { ...shrine } },
    pilgrims: pilgrims.map((p, i) => ({
      id: p.id ?? `p${i + 1}`,
      type: p.type ?? "normal",
      position: { x: p.x, y: p.y },
      exited: false,
      colorIndex: i,
    })),
    shrineHistory: [{ ...shrine }],
    turn: 0,
    status: "playing",
    failureReason: null,
  };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)];
    for (const perm of permutations(rest)) result.push([item, ...perm]);
  });
  return result;
}

describe("simulation purity", () => {
  it("resolves the same input to an identical state", () => {
    const state = fromMap([
      "#######",
      "#P..S.#",
      "#.....#",
      "#..E..#",
      "#######",
    ]);
    const a = resolveTurn(state, Direction.Right)!;
    const b = resolveTurn(state, Direction.Right)!;
    expect(a).not.toBeNull();
    expect(a).toEqual(b);
    expect(stateKey(a)).toBe(stateKey(b));
  });

  it("never consults Math.random or the clock", () => {
    const state = fromMap([
      "######",
      "#P...S",
      "#..E.#",
      "######",
    ]);
    const originalRandom = Math.random;
    const originalNow = Date.now;
    Math.random = () => {
      throw new Error("simulation used Math.random");
    };
    Date.now = () => {
      throw new Error("simulation used Date.now");
    };
    try {
      expect(() => resolveTurn(state, Direction.Left)).not.toThrow();
      expect(() => resolveTurn(state, Direction.Up)).not.toThrow();
    } finally {
      Math.random = originalRandom;
      Date.now = originalNow;
    }
  });

  it("does not mutate the input state", () => {
    const state = fromMap([
      "#######",
      "#P..S.#",
      "#.....#",
      "#..E..#",
      "#######",
    ]);
    const before = cloneState(state);
    expect(resolveTurn(state, Direction.Right)).not.toBeNull();
    expect(resolveTurn(state, Direction.Left)).not.toBeNull();
    expect(state).toEqual(before);
  });

  it("clones deeply and independently", () => {
    const state = fromMap([
      "######",
      "#P..S#",
      "#..E.#",
      "######",
    ]);
    const copy = cloneState(state);
    copy.pilgrims[0].position.x = 99;
    copy.board.tiles[0][0] = TileType.Hazard;
    copy.shrineHistory[0].x = 42;
    expect(state.pilgrims[0].position.x).not.toBe(99);
    expect(state.board.tiles[0][0]).not.toBe(TileType.Hazard);
    expect(state.shrineHistory[0].x).not.toBe(42);
    expect(stateKey(copy)).not.toBe(stateKey(state));
  });

  it("produces order-independent state signatures", () => {
    const state = fromMap([
      "######",
      "#P.P.S",
      "#..E.#",
      "######",
    ]);
    const shuffled = cloneState(state);
    shuffled.pilgrims.reverse();
    expect(stateKey(shuffled)).toBe(stateKey(state));
  });
});

describe("collision determinism", () => {
  it("is independent of intent ordering", () => {
    const state = manualState(
      [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 2, y: 1 },
        { id: "c", x: 3, y: 1 },
      ],
      { x: 5, y: 0 },
    );
    const intents: MoveIntent[] = [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { entityId: "b", from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
      { entityId: "c", from: { x: 3, y: 1 }, to: { x: 4, y: 1 } },
    ];
    const baseline = [...resolveCollisions(state, intents).entries()].sort();
    for (const perm of permutations(intents)) {
      const result = [...resolveCollisions(state, perm).entries()].sort();
      expect(result).toEqual(baseline);
    }
  });

  it("cancels same-destination races regardless of order", () => {
    const state = manualState(
      [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 3, y: 1 },
      ],
      { x: 2, y: 3 },
    );
    const intents: MoveIntent[] = [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { entityId: "b", from: { x: 3, y: 1 }, to: { x: 2, y: 1 } },
    ];
    for (const perm of permutations(intents)) {
      expect(resolveCollisions(state, perm).size).toBe(0);
    }
  });
});

describe("campaign determinism", () => {
  it("has a stable minimum solution for every level", () => {
    for (const definition of CAMPAIGN) {
      const state = loadLevel(definition);
      const first = solve(state);
      const second = solve(loadLevel(definition));
      expect(first, `${definition.id} unsolvable`).not.toBeNull();
      expect(second).not.toBeNull();
      expect(second!.moves).toBe(first!.moves);
      expect(second!.path).toEqual(first!.path);

      // Replaying the same path twice yields identical solved states.
      const a = replay(state, first!.path);
      const b = replay(state, first!.path);
      expect(a.status).toBe("solved");
      expect(stateKey(a)).toBe(stateKey(b));
      expect(a.turn).toBe(first!.moves);
    }
  });

  it("keeps shrine history deterministic over a move sequence", () => {
    const definition = CAMPAIGN[5];
    const path: Direction[] = [
      Direction.Up,
      Direction.Up,
      Direction.Left,
      Direction.Wait,
      Direction.Down,
    ];
    const a = replay(loadLevel(definition), path);
    const b = replay(loadLevel(definition), path);
    expect(a.shrineHistory).toEqual(b.shrineHistory);
    expect(a.shrineHistory.length).toBe(a.turn + 1);
  });
});
