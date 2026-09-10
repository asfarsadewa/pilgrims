import { TileType } from "../game/types";

/** Level map legend. */
export const TILE_CHARS: Record<string, TileType> = {
  "#": TileType.Wall,
  ".": TileType.Floor,
  " ": TileType.Floor,
  "~": TileType.Void,
  E: TileType.Exit,
  X: TileType.Hazard,
};

export function tileFromChar(char: string): TileType {
  const tile = TILE_CHARS[char];
  if (tile === undefined) {
    throw new Error(`Unknown tile character: "${char}"`);
  }
  return tile;
}

/** Terrain that stops a pilgrim (walls, void). Hazards and exits are enterable. */
export function blocksPilgrim(tile: TileType): boolean {
  return tile === TileType.Wall || tile === TileType.Void;
}

/** Terrain the Shrine cannot occupy. It may rest on floors and exits. */
export function blocksShrine(tile: TileType): boolean {
  return (
    tile === TileType.Wall ||
    tile === TileType.Void ||
    tile === TileType.Hazard
  );
}
