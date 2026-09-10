export interface GateHandlers {
  /** Runs synchronously inside the user gesture (audio unlock must happen here). */
  onUnlock: () => void;
  /** Runs after the gate has faded out (reveal the title screen). */
  onReveal: () => void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

/** A small isometric block glyph, matching the title monument. */
function blockGlyph(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("class", "gate-mark");
  svg.setAttribute("aria-hidden", "true");

  const cube = (cx: number, cy: number, glow: boolean) => {
    const group = document.createElementNS(NS, "g");
    const top = document.createElementNS(NS, "polygon");
    top.setAttribute(
      "points",
      `${cx},${cy - 13} ${cx + 15},${cy - 5} ${cx},${cy + 3} ${cx - 15},${cy - 5}`,
    );
    top.setAttribute("fill", glow ? "#ffe6a8" : "#474d5c");
    const left = document.createElementNS(NS, "polygon");
    left.setAttribute(
      "points",
      `${cx - 15},${cy - 5} ${cx},${cy + 3} ${cx},${cy + 21} ${cx - 15},${cy + 13}`,
    );
    left.setAttribute("fill", glow ? "#e0a94a" : "#31353f");
    const right = document.createElementNS(NS, "polygon");
    right.setAttribute(
      "points",
      `${cx + 15},${cy - 5} ${cx},${cy + 3} ${cx},${cy + 21} ${cx + 15},${cy + 13}`,
    );
    right.setAttribute("fill", glow ? "#c98f36" : "#24272f");
    group.append(top, left, right);
    svg.append(group);
  };

  cube(60, 44, false);
  cube(30, 44, false);
  cube(90, 44, false);
  cube(60, 74, false);
  cube(60, 59, true);
  return svg;
}

/**
 * The pre-title ritual. Its only job (beyond atmosphere) is to capture one real
 * user gesture so the browser lets us start audio.
 */
export function renderGateScreen(): HTMLElement {
  const screen = element("div", "gate-screen");

  const line = element("p", "gate-line");
  line.textContent = "They walk toward what they believe will save them.";

  const rule = element("div", "gate-rule");

  const button = element("button", "gate-begin");
  button.type = "button";
  button.textContent = "Begin your pilgrimage";

  const hint = element("p", "gate-hint");
  hint.textContent = "click · tap · press any key";

  screen.append(blockGlyph(), line, rule, button, hint);
  return screen;
}
