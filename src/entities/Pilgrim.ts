import { GridPosition } from "../game/types";

/** A pilgrim as seen by the simulation. */
export interface Pilgrim extends GridPosition {
  id: string;
}

export type { GridPosition };
