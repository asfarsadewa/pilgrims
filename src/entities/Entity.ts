import { GridPosition, PilgrimState } from "../game/types";

export interface Entity {
  id: string;
  position: GridPosition;
}

export function isPilgrim(entity: Entity): entity is PilgrimState {
  return (entity as PilgrimState).type !== undefined;
}
