import { readFileSync } from "node:fs";
import { loadLevel } from "../src/world/LevelLoader";
import { LevelDefinition } from "../src/world/Level";
import { resolveTurn } from "../src/game/TurnResolver";
import { stateKey } from "../src/game/Solver";
import { Direction, GameState, TileType } from "../src/game/types";

const def = JSON.parse(readFileSync(process.argv[2], "utf8")) as LevelDefinition;
const start = loadLevel(def);
const ACTIONS = [Direction.Up, Direction.Down, Direction.Left, Direction.Right, Direction.Wait];
const visited = new Set<string>([stateKey(start)]);
let frontier: GameState[] = [start];
const required = start.pilgrims.length;
let bestExited = 0;
const shrinePos = new Set<string>();
const pilgrimPos: Set<string>[] = required ? start.pilgrims.map(() => new Set<string>()) : [];
for (let d = 0; d < 45; d++) {
  const next: GameState[] = [];
  for (const s of frontier) {
    shrinePos.add(`${s.shrine.position.x},${s.shrine.position.y}`);
    s.pilgrims.forEach((p, i) => { if (!p.exited) pilgrimPos[i].add(`${p.position.x},${p.position.y}`); });
    for (const a of ACTIONS) {
      const r = resolveTurn(s, a);
      if (!r || r.status === "failed") continue;
      const k = stateKey(r);
      if (visited.has(k)) continue;
      visited.add(k);
      bestExited = Math.max(bestExited, r.pilgrims.filter((p) => p.exited).length);
      next.push(r);
    }
  }
  if (next.length === 0) break;
  frontier = next;
}
const exits: string[] = [];
for (let y = 0; y < start.height; y++) for (let x = 0; x < start.width; x++) if (start.board.tileAt(x, y) === TileType.Exit) exits.push(`${x},${y}`);
console.log(`${def.id}: visited=${visited.size} bestExited=${bestExited}/${required} exits=${exits.join(" ")}`);
console.log(`  shrine reachable: ${shrinePos.size} tiles`);
pilgrimPos.forEach((set, i) => console.log(`  pilgrim${i} reachable: ${set.size} tiles`));
// print reachable pilgrim grid maps
start.pilgrims.forEach((_, i) => {
  const rows: string[] = [];
  for (let y = 0; y < start.height; y++) {
    let row = "";
    for (let x = 0; x < start.width; x++) {
      const tile = start.board.tileAt(x, y);
      if (tile === TileType.Wall) row += "#";
      else if (tile === TileType.Void) row += "~";
      else if (tile === TileType.Exit) row += "E";
      else if (tile === TileType.Hazard) row += "X";
      else row += pilgrimPos[i].has(`${x},${y}`) ? "o" : ".";
    }
    rows.push(row);
  }
  console.log(`  pilgrim${i} reachable map:\n` + rows.map((r) => "    " + r).join("\n"));
});
