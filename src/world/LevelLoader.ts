import { GameState, GridPosition, PilgrimState, TileType } from "../game/types";
import { Board } from "./Board";
import { LevelDefinition } from "./Level";
import { tileFromChar } from "./Tile";

/**
 * Turns a JSON level definition into a fresh GameState.
 * No Three.js objects are created here.
 */
export function loadLevel(definition: LevelDefinition): GameState {
  const { map } = definition;
  const height = definition.height ?? map.length;
  const width = definition.width ?? Math.max(...map.map((row) => row.length));

  assertValid(definition, width, height);

  const tiles: TileType[][] = [];
  const pilgrims: PilgrimState[] = [];
  let shrine: GridPosition | null = null;
  let colorIndex = 0;

  for (let y = 0; y < height; y++) {
    const row: TileType[] = [];
    const source = map[y] ?? "";
    for (let x = 0; x < width; x++) {
      const char = source[x] ?? "#";
      let tile: TileType;
      if (char === "P") {
        tile = TileType.Floor;
        pilgrims.push(makePilgrim(`p${pilgrims.length + 1}`, "normal", { x, y }, colorIndex++));
      } else if (char === "S") {
        tile = TileType.Floor;
        if (shrine) throw new Error(`Level ${definition.id}: multiple shrines`);
        shrine = { x, y };
      } else {
        tile = tileFromChar(char);
      }
      row.push(tile);
    }
    tiles.push(row);
  }

  // Extended format: explicit typed pilgrims (still support 'P' shorthand too).
  if (definition.pilgrims) {
    for (const p of definition.pilgrims) {
      const id = p.id ?? `p${pilgrims.length + 1}`;
      if (pilgrims.some((existing) => existing.id === id)) continue;
      pilgrims.push(
        makePilgrim(id, p.type ?? "normal", { x: p.x, y: p.y }, colorIndex++),
      );
    }
  }

  if (!shrine) throw new Error(`Level ${definition.id}: no shrine`);

  const board = new Board(width, height, tiles);
  const hasExit = tiles.some((row) => row.includes(TileType.Exit));
  if (!hasExit) throw new Error(`Level ${definition.id}: no exit`);

  return {
    levelId: definition.id,
    levelName: definition.name,
    theme: definition.theme ?? "road",
    par: definition.par,
    width,
    height,
    board,
    shrine: { position: { ...shrine } },
    pilgrims,
    shrineHistory: [{ ...shrine }],
    turn: 0,
    status: "playing",
    failureReason: null,
  };
}

function makePilgrim(
  id: string,
  type: PilgrimState["type"],
  position: GridPosition,
  colorIndex: number,
): PilgrimState {
  return { id, type, position, exited: false, colorIndex };
}

function assertValid(
  definition: LevelDefinition,
  width: number,
  height: number,
): void {
  if (height !== definition.map.length) {
    throw new Error(
      `Level ${definition.id}: height ${height} does not match map rows ${definition.map.length}`,
    );
  }
  definition.map.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(
        `Level ${definition.id}: row ${y} has width ${row.length}, expected ${width}`,
      );
    }
  });
}
