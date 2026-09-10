import { GridPosition } from "../game/types";

/** One grid cell equals one world unit. */
export const TILE_SIZE = 1;

export interface WorldLayout {
  width: number;
  height: number;
}

export function makeLayout(width: number, height: number): WorldLayout {
  return { width, height };
}

/** Game X -> world X, game Y -> world Z. Center the board on the origin. */
export function gridToWorld(
  layout: WorldLayout,
  x: number,
  y: number,
): { x: number; z: number } {
  return {
    x: (x - (layout.width - 1) / 2) * TILE_SIZE,
    z: (y - (layout.height - 1) / 2) * TILE_SIZE,
  };
}

export function gridPositionToWorld(
  layout: WorldLayout,
  position: GridPosition,
): { x: number; z: number } {
  return gridToWorld(layout, position.x, position.y);
}

/** Deterministic 0..1 hash for cosmetic variation (never used by simulation). */
export function hash2d(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  h = h ^ (h >> 16);
  return ((h >>> 0) % 1000) / 1000;
}
