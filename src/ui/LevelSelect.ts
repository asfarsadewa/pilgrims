import { LevelDefinition } from "../world/Level";
import { SaveData } from "./SaveManager";

export interface LevelSelectHandlers {
  onSelect: (index: number) => void;
  onClose: () => void;
  onReset: () => void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderLevelSelect(
  levels: LevelDefinition[],
  save: SaveData,
  handlers: LevelSelectHandlers,
): HTMLElement {
  const panel = element("div", "panel-content panel-select");
  panel.append(element("p", "panel-kicker", "THE PILGRIMAGE"));
  panel.append(element("h2", "panel-title", "Choose a step"));

  const grid = element("div", "level-grid");
  levels.forEach((level, index) => {
    const completed = save.completed.includes(level.id);
    const unlocked = index === 0 || save.highestLevel >= index;
    const card = element("button", "level-card");
    card.disabled = !unlocked;
    if (completed) card.classList.add("completed");
    if (!unlocked) card.classList.add("locked");

    const number = String(index + 1).padStart(2, "0");
    card.append(element("span", "level-card-number", number));
    card.append(element("span", "level-card-name", level.name));
    const best = save.bestMoves[level.id];
    card.append(
      element(
        "span",
        "level-card-best",
        unlocked ? (best !== undefined ? `${best} moves` : "· · ·") : "locked",
      ),
    );
    card.addEventListener("click", () => {
      if (unlocked) handlers.onSelect(index);
    });
    grid.append(card);
  });
  panel.append(grid);

  const actions = element("div", "panel-actions");
  const reset = element("button", "ghost", "Reset progress");
  reset.addEventListener("click", handlers.onReset);
  const close = element("button", "primary", "Close");
  close.addEventListener("click", handlers.onClose);
  actions.append(reset, close);
  panel.append(actions);
  return panel;
}
