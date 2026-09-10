import { CameraPresetId } from "../rendering/cameraPresets";
import { renderCameraControl } from "./CameraControl";

export interface TitleHandlers {
  onContinue: () => void;
  onBegin: () => void;
  onChapters: () => void;
  onToggleMute: () => void;
  onSetCamera: (id: CameraPresetId) => void;
}

export interface TitleOptions {
  hasProgress: boolean;
  muted: boolean;
  camera: CameraPresetId;
  handlers: TitleHandlers;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function action(
  label: string,
  className: string,
  onClick: () => void,
): HTMLButtonElement {
  const node = element("button", className);
  node.textContent = label;
  node.addEventListener("click", onClick);
  return node;
}

function reveal<T extends HTMLElement>(node: T, delay: number): T {
  node.classList.add("reveal");
  node.style.animationDelay = `${delay}ms`;
  return node;
}

/**
 * The opening screen. Deliberately sparse: a lone wordmark, a line, a sentence,
 * and one way forward — so the diorama behind it carries the mood.
 */
export function renderTitleScreen(options: TitleOptions): HTMLElement {
  const screen = element("div", "title-screen");

  const top = element("div", "title-top");
  const kicker = reveal(element("p", "title-kicker"), 200);
  kicker.textContent = "A MEDITATION ON FOLLOWING";
  top.append(kicker);

  const word = reveal(element("h1", "title-word"), 700);
  word.textContent = "PILGRIMS";
  top.append(word);

  top.append(reveal(element("div", "title-rule"), 1500));

  const tagline = reveal(element("p", "title-tagline"), 1900);
  tagline.innerHTML =
    "You don't control the pilgrims.<br/>You control what they follow.";
  top.append(tagline);

  const bottom = element("div", "title-bottom");
  const actions = element("div", "title-actions");

  const primary = reveal(
    action(
      options.hasProgress ? "Continue the pilgrimage" : "Begin the pilgrimage",
      "primary",
      options.hasProgress ? options.handlers.onContinue : options.handlers.onBegin,
    ),
    2500,
  );
  actions.append(primary);

  const links = reveal(element("div", "title-links"), 2900);
  const dot = () => {
    const node = element("span", "title-dot");
    node.textContent = "·";
    return node;
  };
  if (options.hasProgress) {
    links.append(action("Begin anew", "link", options.handlers.onBegin), dot());
  }
  links.append(action("Chapters", "link", options.handlers.onChapters), dot());
  links.append(
    action(
      options.muted ? "Sound: off" : "Sound: on",
      "link title-sound",
      options.handlers.onToggleMute,
    ),
  );
  actions.append(links);
  actions.append(
    reveal(
      renderCameraControl(options.camera, options.handlers.onSetCamera, "title"),
      3100,
    ),
  );
  bottom.append(actions);

  const hint = reveal(element("p", "title-hint"), 3300);
  hint.textContent =
    "Arrow keys / WASD move the Shrine · Space waits · Z undoes · Esc pauses";
  bottom.append(hint);

  screen.append(top, bottom);
  return screen;
}
