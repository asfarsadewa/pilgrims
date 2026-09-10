import { LevelDefinition } from "../world/Level";

import l001 from "./001.json";
import l002 from "./002.json";
import l003 from "./003.json";
import l004 from "./004.json";
import l005 from "./005.json";
import l006 from "./006.json";
import l007 from "./007.json";
import l008 from "./008.json";
import l009 from "./009.json";
import l010 from "./010.json";

/**
 * The prototype campaign. Levels are handcrafted JSON; add new files here.
 * Order in this array is the campaign order.
 */
export const LEVELS: LevelDefinition[] = [
  l001,
  l002,
  l003,
  l004,
  l005,
  l006,
  l007,
  l008,
  l009,
  l010,
] as LevelDefinition[];

export const LEVEL_COUNT = LEVELS.length;
