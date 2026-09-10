import { GameState } from "../game/types";
import { CameraPresetId } from "../rendering/cameraPresets";
import { renderCameraControl } from "./CameraControl";

export interface PanelHandlers {
  onNext: () => void;
  onUndo: () => void;
  onRestart: () => void;
  onMenu: () => void;
  onTitle: () => void;
  onResume: () => void;
  onSetCamera: (id: CameraPresetId) => void;
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

function button(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const node = element("button", className, label);
  node.addEventListener("click", onClick);
  return node;
}

export function renderSolvedPanel(
  state: GameState,
  isLast: boolean,
  handlers: PanelHandlers,
): HTMLElement {
  const panel = element("div", "panel-content panel-solved");
  panel.append(element("p", "panel-kicker", "SOLVED"));
  panel.append(element("h2", "panel-title", state.levelName));
  panel.append(
    element(
      "p",
      "panel-stats",
      `MOVES ${state.turn}${state.par ? ` / PAR ${state.par}` : ""}`,
    ),
  );

  if (state.par && state.turn <= state.par) {
    panel.append(element("p", "panel-flourish", "A faithful route."));
  }

  const actions = element("div", "panel-actions");
  if (!isLast) {
    actions.append(button("Next", "primary", handlers.onNext));
    actions.append(button("Retry", "ghost", handlers.onRestart));
    actions.append(button("Menu", "ghost", handlers.onMenu));
  } else {
    actions.append(button("Menu", "primary", handlers.onMenu));
    actions.append(button("Retry", "ghost", handlers.onRestart));
    actions.append(button("Title", "ghost", handlers.onTitle));
  }
  panel.append(actions);
  return panel;
}

export function renderFailedPanel(
  state: GameState,
  handlers: PanelHandlers,
): HTMLElement {
  const panel = element("div", "panel-content panel-failed");
  panel.append(element("p", "panel-kicker", "LOST"));
  panel.append(element("h2", "panel-title", "A pilgrim was lost"));
  panel.append(
    element(
      "p",
      "panel-stats",
      state.failureReason ?? "Undo the last choice, or begin again.",
    ),
  );
  const actions = element("div", "panel-actions");
  actions.append(button("Undo", "primary", handlers.onUndo));
  actions.append(button("Restart", "ghost", handlers.onRestart));
  actions.append(button("Menu", "ghost", handlers.onMenu));
  panel.append(actions);
  return panel;
}

export function renderPausePanel(
  handlers: PanelHandlers,
  camera: CameraPresetId,
): HTMLElement {
  const panel = element("div", "panel-content panel-pause");
  panel.append(element("p", "panel-kicker", "PAUSED"));
  panel.append(
    element(
      "p",
      "panel-quote",
      "You don't control the pilgrims. You control what they follow.",
    ),
  );
  panel.append(renderCameraControl(camera, handlers.onSetCamera, "panel"));
  const actions = element("div", "panel-actions");
  actions.append(button("Resume", "primary", handlers.onResume));
  actions.append(button("Restart", "ghost", handlers.onRestart));
  actions.append(button("Chapters", "ghost", handlers.onMenu));
  actions.append(button("Title", "ghost", handlers.onTitle));
  panel.append(actions);
  return panel;
}
