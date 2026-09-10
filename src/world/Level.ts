import { PilgrimType } from "../game/types";

/**
 * JSON level definition.
 *
 * Basic form:
 *   { id, name, width, height, map: string[] }
 *
 * Extended form may also declare typed pilgrims:
 *   { pilgrims: [{ id, type, x, y }] }
 * and a theme/par.
 */
export interface LevelPilgrimDefinition {
  id?: string;
  type?: PilgrimType;
  x: number;
  y: number;
}

export interface LevelDefinition {
  id: string;
  name: string;
  width?: number;
  height?: number;
  theme?: string;
  par?: number;
  map: string[];
  pilgrims?: LevelPilgrimDefinition[];
}
