import { describe, expect, it } from "vitest";
import { cloneState } from "../src/game/clone";
import { resolveTurn } from "../src/game/TurnResolver";
import { previousShrinePosition, stateKey } from "../src/game/Solver";
import {
  Direction,
  GameState,
  GridPosition,
  PilgrimState,
  TileType,
} from "../src/game/types";
import { Board } from "../src/world/Board";
import { loadLevel } from "../src/world/LevelLoader";

function makeState(options: {
  width: number;
  height: number;
  shrine: GridPosition;
  history?: GridPosition[];
  pilgrims: Array<Partial<PilgrimState> & { x: number; y: number }>;
  exits?: GridPosition[];
}): GameState {
  const { width, height } = options;
  const exits = options.exits ?? [];
  const tiles: TileType[][] = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        return TileType.Wall;
      }
      return exits.some((e) => e.x === x && e.y === y)
        ? TileType.Exit
        : TileType.Floor;
    }),
  );
  return {
    levelId: "doubter-test",
    levelName: "doubter-test",
    theme: "night",
    width,
    height,
    board: new Board(width, height, tiles),
    shrine: { position: { ...options.shrine } },
    pilgrims: options.pilgrims.map((p, i) => ({
      id: p.id ?? `p${i + 1}`,
      type: p.type ?? "normal",
      position: { x: p.x, y: p.y },
      exited: false,
      colorIndex: i,
    })),
    shrineHistory: options.history ?? [{ ...options.shrine }],
    turn: 0,
    status: "playing",
    failureReason: null,
  };
}

describe("the `?` legend", () => {
  it("loads a doubter from the map", () => {
    const state = loadLevel({
      id: "q",
      name: "q",
      map: ["#####", "#?..#", "#.S.#", "#..E#", "#####"],
    });
    expect(state.pilgrims[0].type).toBe("doubter");
  });
});

describe("doubter movement", () => {
  it("walks toward where the Shrine was, not where it is", () => {
    // Shrine (2,2) -> Down (2,3). The pre-move position is (2,2).
    const state = makeState({
      width: 7,
      height: 5,
      shrine: { x: 2, y: 2 },
      pilgrims: [{ id: "d", type: "doubter", x: 3, y: 1 }],
    });
    const next = resolveTurn(state, Direction.Down)!;
    // Toward the old position (2,2): dx=-1, dy=1 -> tie favours horizontal -> (2,1).
    // Toward the moved Shrine (2,3) it would instead go to (3,2).
    expect(next.pilgrims[0].position).toEqual({ x: 2, y: 1 });
  });

  it("a normal pilgrim on the same tile would chase the current Shrine", () => {
    const state = makeState({
      width: 7,
      height: 5,
      shrine: { x: 2, y: 2 },
      pilgrims: [{ id: "n", type: "normal", x: 3, y: 1 }],
    });
    const next = resolveTurn(state, Direction.Down)!;
    // Toward (2,3): dx=-1, dy=2 -> vertical -> (3,2).
    expect(next.pilgrims[0].position).toEqual({ x: 3, y: 2 });
  });

  it("can be led into an exit that sits between it and the old Shrine", () => {
    const state = makeState({
      width: 9,
      height: 5,
      shrine: { x: 5, y: 2 },
      exits: [{ x: 4, y: 2 }],
      pilgrims: [{ id: "d", type: "doubter", x: 3, y: 2 }],
    });
    const next = resolveTurn(state, Direction.Right)!;
    expect(next.pilgrims[0].exited).toBe(true);
    expect(next.status).toBe("solved");
  });

  it("reports the Shrine position one step back in history", () => {
    const state = makeState({
      width: 7,
      height: 5,
      shrine: { x: 3, y: 2 },
      history: [
        { x: 1, y: 1 },
        { x: 3, y: 2 },
      ],
      pilgrims: [{ id: "d", type: "doubter", x: 5, y: 2 }],
    });
    expect(previousShrinePosition(state)).toEqual({ x: 1, y: 1 });
  });

  it("is pure and never consults randomness", () => {
    const state = makeState({
      width: 7,
      height: 5,
      shrine: { x: 3, y: 2 },
      pilgrims: [
        { id: "d", type: "doubter", x: 1, y: 1 },
        { id: "n", type: "normal", x: 5, y: 3 },
      ],
    });
    const before = cloneState(state);
    const originalRandom = Math.random;
    Math.random = () => {
      throw new Error("simulation used Math.random");
    };
    let a: GameState;
    let b: GameState;
    try {
      a = resolveTurn(state, Direction.Up)!;
      b = resolveTurn(state, Direction.Up)!;
    } finally {
      Math.random = originalRandom;
    }
    expect(a!).toEqual(b!);
    expect(state).toEqual(before);
  });

  it("does not depend on Shrine history beyond the current position", () => {
    // Two states identical except for older history must evolve identically,
    // which is why the solver key omits history.
    const base = makeState({
      width: 7,
      height: 5,
      shrine: { x: 3, y: 2 },
      history: [{ x: 3, y: 2 }],
      pilgrims: [{ id: "d", type: "doubter", x: 1, y: 3 }],
    });
    const other = cloneState(base);
    other.shrineHistory = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 2 },
    ];
    const a = resolveTurn(base, Direction.Left)!;
    const b = resolveTurn(other, Direction.Left)!;
    expect(a.pilgrims[0].position).toEqual(b.pilgrims[0].position);
    expect(a.shrine.position).toEqual(b.shrine.position);
    expect(stateKey(a)).toBe(stateKey(b));
  });
});
