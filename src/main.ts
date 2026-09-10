import "./style.css";

import { AudioManager } from "./audio/AudioManager";
import { Game, GameEvent } from "./game/Game";
import { Direction, GameState } from "./game/types";
import { InputManager, InputAction } from "./input/InputManager";
import { Renderer } from "./rendering/Renderer";
import type { CameraPresetId } from "./rendering/cameraPresets";
import { LEVELS } from "./levels/index";
import { UI } from "./ui/UI";
import { SaveManager } from "./ui/SaveManager";

const INTRO_LINES: Record<string, string> = {
  "001": "They walk toward what they believe will save them.",
  "002": "The road bent. They followed.",
  "003": "Not every step toward the light is the right one.",
  "004": "The water took the careless.",
  "005": "Two walked. One shrine.",
  "006": "The mountain offered a single path.",
  "007": "They met, and neither would yield.",
  "008": "The wrong way looked like the only way.",
  "009": "The road disappeared. Still, they followed.",
  "010": "Some remembered differently.",
};

const save = new SaveManager();
const audio = new AudioManager();

const MUSIC = {
  title: { name: "title", file: "title.mp3", volume: 0.5 },
  pilgrimage: { name: "pilgrimage", file: "pilgrimage.mp3", volume: 0.42 },
  night: { name: "night", file: "night.mp3", volume: 0.42 },
} as const;

function musicRequest(key: keyof typeof MUSIC) {
  const track = MUSIC[key];
  return {
    name: track.name,
    url: `${import.meta.env.BASE_URL}audio/${track.file}`,
    volume: track.volume,
  };
}

function trackForTheme(theme: string): keyof typeof MUSIC {
  return theme === "night" || theme === "ruins" ? "night" : "pilgrimage";
}

const sceneContainer = document.getElementById("scene");
if (!sceneContainer) throw new Error("Missing #scene container");
const renderer = new Renderer(sceneContainer);
renderer.start();

let game: Game;
let currentIndex = 0;

const input = new InputManager(sceneContainer);
input.on(handleInput);

// Browsers require a gesture before audio may start; a pointer press on the
// title screen counts, so unlock on the first click/tap anywhere.
window.addEventListener("pointerdown", () => audio.unlock(), { passive: true });

const ui = new UI(
  {
    onNext: () => startLevel(currentIndex + 1),
    onUndo: () => doUndo(),
    onRestart: () => doRestart(),
    onMenu: () => ui.showLevelSelect(LEVELS, save.data),
    onTitle: () => showTitleScreen(),
    onResume: () => {
      if (renderer.isTitle) showTitleScreen();
      else ui.hideOverlay();
    },
    onSelectLevel: (index) => startLevel(index),
    onResetProgress: () => {
      save.reset();
      ui.showLevelSelect(LEVELS, save.data);
    },
    onSetCamera: (id) => setCameraView(id),
  },
  (visible) => input.setUiActive(visible),
);

function startLevel(
  index: number,
  options: { announce?: boolean } = {},
): void {
  const announce = options.announce ?? true;
  const clamped = Math.max(0, Math.min(index, LEVELS.length - 1));
  currentIndex = clamped;
  const definition = LEVELS[clamped];

  game = new Game(definition);
  game.on(handleGameEvent);

  audio.unlock();
  renderer.loadLevel(game.state);
  ui.setLevel(clamped, game.state);
  ui.setUndoEnabled(false);
  ui.hideOverlay();
  input.setEnabled(true);
  audio.playMusic(musicRequest(trackForTheme(definition.theme ?? "road")));

  if (announce) {
    audio.levelStart();
    const line = INTRO_LINES[definition.id];
    if (line) ui.toast(line, 3200);
  }
}

function resumeIndex(): number {
  return Math.min(save.data.highestLevel, LEVELS.length - 1);
}

function showTitleScreen(): void {
  audio.unlock();
  renderer.showTitle();
  audio.playMusic(musicRequest("title"));
  ui.showTitle({
    hasProgress: save.data.highestLevel > 0,
    muted: audio.muted,
    camera: save.data.camera,
    handlers: {
      onContinue: () => startLevel(resumeIndex()),
      onBegin: () => startLevel(0),
      onChapters: () => ui.showLevelSelect(LEVELS, save.data),
      onToggleMute: () => toggleMute(),
      onSetCamera: (id) => setCameraView(id),
    },
  });
}

function setCameraView(id: CameraPresetId): void {
  save.setCamera(id);
  renderer.setCamera(id);
  ui.setActiveCamera(id);
}

function toggleMute(): void {
  audio.unlock();
  const muted = !audio.muted;
  audio.setMuted(muted);
  save.setMuted(muted);
  ui.setMuted(muted);
  ui.setTitleMuted(muted);
}

function handleInput(action: InputAction): void {
  audio.unlock();

  if (action.type === "toggle-mute") {
    toggleMute();
    return;
  }

  if (ui.overlayVisible) return;

  switch (action.type) {
    case "move":
      doMove(action.direction);
      break;
    case "undo":
      doUndo();
      break;
    case "restart":
      doRestart();
      break;
    case "menu":
      ui.showPause();
      break;
  }
}

function doMove(direction: Direction): void {
  if (game.mode === "animating") return;
  if (game.mode === "completed") return;
  if (game.mode === "failed" && direction !== Direction.Wait) return;

  const started = game.tryMove(direction);
  if (!started) {
    audio.blocked();
    if (direction !== Direction.Wait) {
      renderer.blockedAt(game.state.shrine.position);
    }
  }
}

function doUndo(): void {
  if (game.mode === "animating") return;
  if (game.undoMove()) {
    ui.hideOverlay();
    audio.undo();
  }
}

function doRestart(): void {
  game.restart();
  ui.hideOverlay();
  input.setEnabled(true);
}

function handleGameEvent(event: GameEvent): void {
  switch (event.type) {
    case "turn":
      onTurn(event.previous, event.next);
      break;
    case "undo":
      onUndo(event.previous, event.next);
      break;
    case "restart":
    case "load":
      renderer.loadLevel(event.next);
      ui.setLevel(currentIndex, event.next);
      ui.setUndoEnabled(game.canUndo);
      input.setEnabled(true);
      break;
  }
}

function onTurn(previous: GameState, next: GameState): void {
  input.setEnabled(false);
  playTurnAudio(previous, next);

  renderer.animateTurn(previous, next).then(() => {
    game.finishAnimation();
    ui.setMoves(next);
    ui.setUndoEnabled(game.canUndo);
    input.setEnabled(!ui.overlayVisible);

    if (next.status === "solved") {
      handleSolved(next);
    } else if (next.status === "failed") {
      handleFailed(next);
    }
  });
}

function onUndo(previous: GameState, next: GameState): void {
  input.setEnabled(false);
  renderer.animateTurn(previous, next).then(() => {
    ui.setMoves(next);
    ui.setUndoEnabled(game.canUndo);
    ui.setMuted(audio.muted);
    input.setEnabled(!ui.overlayVisible);
  });
}

function playTurnAudio(previous: GameState, next: GameState): void {
  audio.shrineMove();
  const moved = next.pilgrims.some((pilgrim) => {
    const before = previous.pilgrims.find((p) => p.id === pilgrim.id);
    return (
      before &&
      (before.position.x !== pilgrim.position.x ||
        before.position.y !== pilgrim.position.y)
    );
  });
  if (moved) audio.pilgrimStep();

  const exitedNow = next.pilgrims.some((pilgrim) => {
    const before = previous.pilgrims.find((p) => p.id === pilgrim.id);
    return pilgrim.exited && before && !before.exited;
  });
  if (exitedNow && next.status !== "failed") audio.exit();
  if (next.status === "failed") audio.fall();
}

function handleSolved(state: GameState): void {
  save.markCompleted(LEVELS[currentIndex].id, state.turn, currentIndex);
  audio.solve();
  input.setEnabled(false);
  window.setTimeout(() => {
    ui.showSolved(state, currentIndex, LEVELS.length);
  }, 350);
}

function handleFailed(state: GameState): void {
  input.setEnabled(true);
  window.setTimeout(() => {
    ui.showFailed(state);
    input.setEnabled(false);
  }, 500);
}

// Initialise progress-dependent UI.
ui.setMuted(save.data.muted);
audio.setMuted(save.data.muted);

async function bootstrap(): Promise<void> {
  const loading = document.getElementById("loading");
  try {
    await renderer.preload();
  } catch (error) {
    // The renderer falls back to primitive placeholder models.
    console.error("Failed to load models:", error);
  }
  loading?.classList.add("hidden");

  renderer.setCamera(save.data.camera);
  ui.setActiveCamera(save.data.camera);

  // Prepare the resume level, then greet the player with the title monument.
  startLevel(resumeIndex(), { announce: false });
  showTitleScreen();

  // Expose a tiny debug hook for the console during development.
  (window as unknown as { pilgrims?: unknown }).pilgrims = {
    game: () => game,
    startLevel,
    renderer,
    levels: LEVELS,
    save,
    audio,
    ui,
  };
}

void bootstrap();
