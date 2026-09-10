import { TileType } from "../game/types";
import { blocksPilgrim, blocksShrine } from "./Tile";

/**
 * Immutable-ish board. Terrain is copied on clone so future mechanisms
 * (collapsing bridges, doors) can mutate a turn snapshot safely.
 */
export class Board {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly tiles: TileType[][],
  ) {}

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  tileAt(x: number, y: number): TileType {
    if (!this.inBounds(x, y)) return TileType.Void;
    return this.tiles[y][x];
  }

  canPilgrimEnter(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return !blocksPilgrim(this.tileAt(x, y));
  }

  canShrineEnter(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return !blocksShrine(this.tileAt(x, y));
  }

  clone(): Board {
    return new Board(
      this.width,
      this.height,
      this.tiles.map((row) => row.slice()),
    );
  }
}
