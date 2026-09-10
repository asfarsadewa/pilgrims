import { describe, expect, it } from "vitest";
import { resolveCollisions } from "../src/game/CollisionResolver";
import { cloneState } from "../src/game/clone";
import { isSolved, resolveTurn, canMoveShrine } from "../src/game/TurnResolver";
import {
  Direction,
  GameState,
  GridPosition,
  PilgrimState,
  TileType,
} from "../src/game/types";
import { Board } from "../src/world/Board";
import { loadLevel } from "../src/world/LevelLoader";
import { tileFromChar } from "../src/world/Tile";

function fromMap(map: string[]): GameState {
  return loadLevel({
    id: "test",
    name: "test",
    width: map[0].length,
    height: map.length,
    map,
  });
}

function manualState(options: {
  width: number;
  height: number;
  pilgrims: Array<Partial<PilgrimState> & { x: number; y: number }>;
  shrine: GridPosition;
  tile?: (x: number, y: number) => TileType;
}): GameState {
  const tiles: TileType[][] = [];
  for (let y = 0; y < options.height; y++) {
    const row: TileType[] = [];
    for (let x = 0; x < options.width; x++) {
      row.push(options.tile ? options.tile(x, y) : TileType.Floor);
    }
    tiles.push(row);
  }
  return {
    levelId: "manual",
    levelName: "manual",
    theme: "road",
    width: options.width,
    height: options.height,
    board: new Board(options.width, options.height, tiles),
    shrine: { position: { ...options.shrine } },
    pilgrims: options.pilgrims.map((p, i) => ({
      id: p.id ?? `p${i + 1}`,
      type: p.type ?? "normal",
      position: { x: p.x, y: p.y },
      exited: false,
      colorIndex: i,
    })),
    shrineHistory: [{ ...options.shrine }],
    turn: 0,
    status: "playing",
    failureReason: null,
  };
}

describe("pilgrim movement", () => {
  it("moves toward the shrine", () => {
    const state = fromMap([
      "E....",
      ".P...",
      ".....",
      "...S.",
      ".....",
    ]);
    const next = resolveTurn(state, Direction.Wait);
    expect(next).not.toBeNull();
    expect(next!.pilgrims[0].position).toEqual({ x: 2, y: 1 });
  });

  it("prefers the horizontal axis on equal distance", () => {
    const state = fromMap([
      "E....",
      ".P...",
      "..S..",
      ".....",
      ".....",
    ]);
    const next = resolveTurn(state, Direction.Wait);
    expect(next!.pilgrims[0].position).toEqual({ x: 2, y: 1 });
  });

  it("falls back to the other axis when the primary is blocked", () => {
    const state = fromMap([
      "E....",
      ".P#..",
      "...S.",
      ".....",
      ".....",
    ]);
    const next = resolveTurn(state, Direction.Wait);
    expect(next!.pilgrims[0].position).toEqual({ x: 1, y: 2 });
  });

  it("does not move while orthogonally adjacent to the shrine", () => {
    const state = fromMap([
      "E....",
      ".P...",
      ".S...",
      ".....",
      ".....",
    ]);
    const next = resolveTurn(state, Direction.Wait);
    expect(next!.pilgrims[0].position).toEqual({ x: 1, y: 1 });
  });

  it("is deterministic", () => {
    const state = fromMap([
      "E....",
      ".P...",
      "..#..",
      "...S.",
      ".....",
    ]);
    const a = resolveTurn(state, Direction.Left)!;
    const b = resolveTurn(state, Direction.Left)!;
    expect(a.pilgrims[0].position).toEqual(b.pilgrims[0].position);
    expect(a.shrine.position).toEqual(b.shrine.position);
  });
});

describe("collision resolution", () => {
  it("cancels every pilgrim targeting the same tile", () => {
    const state = manualState({
      width: 5,
      height: 3,
      shrine: { x: 2, y: 2 },
      pilgrims: [
        { id: "a", x: 2, y: 1 },
        { id: "b", x: 2, y: 1 },
      ],
    });
    const moves = resolveCollisions(state, [
      { entityId: "a", from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
      { entityId: "b", from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
    ]);
    expect(moves.size).toBe(0);
  });

  it("blocks a pilgrim entering a tile held by a stationary pilgrim", () => {
    const state = manualState({
      width: 5,
      height: 3,
      shrine: { x: 4, y: 0 },
      pilgrims: [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 2, y: 1 },
      ],
    });
    const moves = resolveCollisions(state, [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ]);
    expect(moves.has("a")).toBe(false);
  });

  it("allows a chain to follow when the leader also moves", () => {
    const state = manualState({
      width: 5,
      height: 3,
      shrine: { x: 4, y: 0 },
      pilgrims: [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 2, y: 1 },
      ],
    });
    const moves = resolveCollisions(state, [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { entityId: "b", from: { x: 2, y: 1 }, to: { x: 3, y: 1 } },
    ]);
    expect(moves.get("a")).toEqual({ x: 2, y: 1 });
    expect(moves.get("b")).toEqual({ x: 3, y: 1 });
  });

  it("prevents two pilgrims swapping tiles", () => {
    const state = manualState({
      width: 5,
      height: 3,
      shrine: { x: 4, y: 0 },
      pilgrims: [
        { id: "a", x: 1, y: 1 },
        { id: "b", x: 2, y: 1 },
      ],
    });
    const moves = resolveCollisions(state, [
      { entityId: "a", from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { entityId: "b", from: { x: 2, y: 1 }, to: { x: 1, y: 1 } },
    ]);
    expect(moves.size).toBe(0);
  });
});

describe("terrain and outcomes", () => {
  it("removes a pilgrim that enters an exit", () => {
    const state = fromMap(["...", ".P.", ".E.", ".S."]);
    const next = resolveTurn(state, Direction.Wait)!;
    expect(next.pilgrims[0].exited).toBe(true);
    expect(isSolved(next)).toBe(true);
  });

  it("fails when a pilgrim enters a hazard", () => {
    const state = fromMap(["E..", ".P.", ".X.", ".S."]);
    const next = resolveTurn(state, Direction.Wait)!;
    expect(next.status).toBe("failed");
  });

  it("never lets the shrine enter a hazard or wall", () => {
    const state = manualState({
      width: 3,
      height: 3,
      shrine: { x: 1, y: 1 },
      pilgrims: [],
      tile: (x, y) =>
        x === 1 && y === 0
          ? TileType.Hazard
          : x === 0 && y === 1
            ? TileType.Wall
            : TileType.Floor,
    });
    expect(canMoveShrine(state, Direction.Up)).toBe(false);
    expect(canMoveShrine(state, Direction.Left)).toBe(false);
    expect(canMoveShrine(state, Direction.Down)).toBe(true);
  });
});

describe("undo snapshots", () => {
  it("does not mutate the input state", () => {
    const state = fromMap([
      "E....",
      ".P...",
      ".....",
      "...S.",
      ".....",
    ]);
    const before = cloneState(state);
    resolveTurn(state, Direction.Right);
    expect(state).toEqual(before);
  });
});

describe("level loading", () => {
  it("parses the map legend", () => {
    expect(tileFromChar("#")).toBe(TileType.Wall);
    expect(tileFromChar("~")).toBe(TileType.Void);
    expect(tileFromChar("E")).toBe(TileType.Exit);
    expect(tileFromChar("X")).toBe(TileType.Hazard);
  });
});
