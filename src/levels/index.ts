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
import l011 from "./011.json";
import l012 from "./012.json";
import l013 from "./013.json";
import l014 from "./014.json";
import l015 from "./015.json";
import l016 from "./016.json";
import l017 from "./017.json";
import l018 from "./018.json";
import l019 from "./019.json";
import l020 from "./020.json";

/**
 * The campaign. Levels are handcrafted JSON; order in this array is the
 * campaign order. Add new files here.
 */
export const LEVELS: LevelDefinition[] = [
  l001, l002, l003, l004, l005, l006, l007, l008, l009, l010,
  l011, l012, l013, l014, l015, l016, l017, l018, l019, l020,
] as LevelDefinition[];

export const LEVEL_COUNT = LEVELS.length;
