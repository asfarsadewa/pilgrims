import { readFileSync } from "node:fs";
import { PNG } from "pngjs";

const png = PNG.sync.read(readFileSync(process.argv[2] ?? ".smoke/shot.png"));
const { width, height, data } = png;
const COLS = 72, ROWS = 30;
const cellW = width / COLS, cellH = height / ROWS;
const chars = " .:-=+*#%@";
let warmMax = 0, warmAt = null;
const rows = [];
for (let ry = 0; ry < ROWS; ry++) {
  let line = "";
  for (let rx = 0; rx < COLS; rx++) {
    let sum = 0, count = 0, maxR = 0;
    const x0 = Math.floor(rx * cellW), x1 = Math.floor((rx + 1) * cellW);
    const y0 = Math.floor(ry * cellH), y1 = Math.floor((ry + 1) * cellH);
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        sum += lum; count++;
        if (r > maxR) maxR = r;
        if (r - b > 30 && r > 120 && r > warmMax) { warmMax = r; warmAt = [x, y]; }
      }
    }
    const avg = sum / Math.max(count, 1);
    const idx = Math.min(chars.length - 1, Math.floor(avg / 12));
    line += chars[idx];
  }
  rows.push(line);
}
console.log(rows.join("\n"));
console.log(`\nwarmest pixel r=${warmMax} at ${JSON.stringify(warmAt)}`);
