import { GameState } from "../game/types";
import { CameraPresetId, DEFAULT_CAMERA } from "../rendering/cameraPresets";
import { LevelDefinition } from "../world/Level";
import {
  PanelHandlers,
  renderFailedPanel,
  renderPausePanel,
  renderSolvedPanel,
} from "./LevelComplete";
import { renderLevelSelect } from "./LevelSelect";
import { SaveData } from "./SaveManager";
import { GateHandlers, renderGateScreen } from "./GateScreen";
import { renderTitleScreen, TitleOptions } from "./TitleScreen";

export interface UIHandlers extends PanelHandlers {
  onSelectLevel: (index: number) => void;
  onResetProgress: () => void;
}

/**
 * Thin DOM layer: HUD, toasts and overlay panels. The game logic never touches
 * the DOM directly.
 */
export class UI {
  private overlay: HTMLElement;
  private panelHost: HTMLElement;
  private levelNumber: HTMLElement;
  private levelName: HTMLElement;
  private moveCount: HTMLElement;
  private parCount: HTMLElement;
  private toastNode: HTMLElement;
  private undoButton: HTMLButtonElement | null;
  private muteButton: HTMLButtonElement | null;
  private toastTimer = 0;
  private escapeAction: (() => void) | null = null;
  private titleShown = false;
  private activeCamera: CameraPresetId = DEFAULT_CAMERA;

  constructor(
    private handlers: UIHandlers,
    private onVisibilityChange?: (visible: boolean) => void,
  ) {
    this.overlay = this.require("overlay");
    this.panelHost = this.require("overlay-panel");
    this.levelNumber = this.require("level-number");
    this.levelName = this.require("level-name");
    this.moveCount = this.require("move-count");
    this.parCount = this.require("par-count");
    this.toastNode = this.require("toast");
    this.undoButton = document.getElementById("undo-button") as HTMLButtonElement | null;
    this.muteButton = document.getElementById("mute-button") as HTMLButtonElement | null;

    window.addEventListener("keydown", (event) => this.onKey(event));
  }

  private onKey(event: KeyboardEvent): void {
    if (!this.overlayVisible) return;
    // The game already consumed this key (e.g. it opened this menu).
    if (
      event.defaultPrevented ||
      (event as KeyboardEvent & { __pilgrimsInput?: boolean }).__pilgrimsInput
    ) {
      return;
    }

    switch (event.key) {
      case "Escape":
        if (this.escapeAction) {
          event.preventDefault();
          this.escapeAction();
        }
        return;
      case "ArrowRight":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        this.moveFocus(event.key);
        return;
      default:
        return;
    }
  }

  /** Buttons and links currently present in the open overlay. */
  private focusableItems(): HTMLElement[] {
    const selector =
      'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';
    return Array.from(
      this.panelHost.querySelectorAll<HTMLElement>(selector),
    ).filter(
      (node) =>
        node.offsetWidth > 0 ||
        node.offsetHeight > 0 ||
        node === document.activeElement,
    );
  }

  /** Move focus with the arrow keys, respecting grid layouts. */
  private moveFocus(key: string): void {
    const items = this.focusableItems();
    if (items.length === 0) return;

    const current = document.activeElement as HTMLElement | null;
    let index = current ? items.indexOf(current) : -1;

    // For a wrapped grid (level select), up/down step by a whole row.
    let columns = 1;
    if (items.length > 1) {
      const firstTop = items[0].offsetTop;
      const firstRow = items.filter((node) => node.offsetTop === firstTop).length;
      if (firstRow > 1 && firstRow < items.length) columns = firstRow;
    }

    const step = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    }[key];
    if (step === undefined) return;

    if (index === -1) index = step > 0 ? -1 : 0;
    const target = items[(index + step + items.length * 2) % items.length];
    target?.focus();
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /** Move keyboard focus into a freshly opened overlay. */
  private focusFirst(): void {
    const primary = this.panelHost.querySelector<HTMLElement>(
      ".primary:not(:disabled)",
    );
    const fallback = this.panelHost.querySelector<HTMLElement>(
      ".level-card:not(:disabled), button:not(:disabled), [href]",
    );
    (primary ?? fallback)?.focus();
  }

  get titleVisible(): boolean {
    return this.titleShown && this.overlayVisible;
  }

  private require(id: string): HTMLElement {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing UI element #${id}`);
    return node;
  }

  get overlayVisible(): boolean {
    return !this.overlay.classList.contains("hidden");
  }

  setLevel(index: number, state: GameState): void {
    this.levelNumber.textContent = String(index + 1).padStart(2, "0");
    this.levelName.textContent = state.levelName;
    this.setMoves(state);
  }

  setMoves(state: GameState): void {
    this.moveCount.textContent = String(state.turn);
    if (state.par) {
      this.parCount.textContent = `/ ${state.par}`;
    } else {
      this.parCount.textContent = "";
    }
  }

  setUndoEnabled(enabled: boolean): void {
    if (this.undoButton) this.undoButton.disabled = !enabled;
  }

  setMuted(muted: boolean): void {
    if (this.muteButton) {
      this.muteButton.textContent = muted ? "Muted" : "Sound";
      this.muteButton.classList.toggle("active", !muted);
    }
  }

  setTitleMuted(muted: boolean): void {
    const node = this.panelHost.querySelector(".title-sound");
    if (node) node.textContent = muted ? "Sound: off" : "Sound: on";
  }

  /** Reflect the chosen camera view without rebuilding the overlay. */
  setActiveCamera(id: CameraPresetId): void {
    this.activeCamera = id;
    this.panelHost
      .querySelectorAll<HTMLElement>(".camera-option")
      .forEach((node) => {
        node.classList.toggle("active", node.dataset.camera === id);
      });
  }

  toast(message: string, duration = 2000): void {
    this.toastNode.textContent = message;
    this.toastNode.classList.add("visible");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toastNode.classList.remove("visible");
    }, duration);
  }

  showSolved(state: GameState, index: number, total: number): void {
    const isLast = index >= total - 1;
    this.show(renderSolvedPanel(state, isLast, this.handlers), this.handlers.onMenu);
  }

  showFailed(state: GameState): void {
    this.show(renderFailedPanel(state, this.handlers), this.handlers.onResume);
  }

  showPause(): void {
    this.show(
      renderPausePanel(this.handlers, this.activeCamera),
      this.handlers.onResume,
    );
  }

  showLevelSelect(levels: LevelDefinition[], save: SaveData): void {
    this.show(
      renderLevelSelect(levels, save, {
        onSelect: this.handlers.onSelectLevel,
        onClose: this.handlers.onResume,
        onReset: this.handlers.onResetProgress,
      }),
      this.handlers.onResume,
    );
  }

  showTitle(options: TitleOptions): void {
    this.titleShown = true;
    this.activeCamera = options.camera;
    this.escapeAction = null;
    this.overlay.classList.add("title-mode");
    document.body.classList.add("title-mode");
    this.panelHost.replaceChildren(renderTitleScreen(options));
    this.overlay.classList.remove("hidden");
    this.onVisibilityChange?.(true);
    this.fadeInOverlay();
    window.requestAnimationFrame(() => this.focusFirst());
  }

  /**
   * The pre-title ritual. Captures one real user gesture, which the browser
   * requires before any audio may start, then fades into the title screen.
   */
  showGate(handlers: GateHandlers): void {
    this.titleShown = false;
    this.escapeAction = null;
    this.overlay.classList.add("gate-mode");
    document.body.classList.add("gate-mode");
    this.panelHost.replaceChildren(renderGateScreen());
    this.overlay.classList.remove("hidden");
    this.onVisibilityChange?.(true);
    this.fadeInOverlay();

    const gate = this.panelHost.querySelector<HTMLElement>(".gate-screen");
    const button = this.panelHost.querySelector<HTMLButtonElement>(".gate-begin");
    let done = false;

    const activate = () => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey);
      this.overlay.removeEventListener("pointerdown", onPointer);
      button?.removeEventListener("click", onClick);
      handlers.onUnlock();
      gate?.classList.add("leaving");
      this.overlay.classList.add("leaving");
      window.setTimeout(() => {
        this.overlay.classList.remove("gate-mode", "leaving");
        document.body.classList.remove("gate-mode");
        handlers.onReveal();
      }, 720);
    };

    const onPointer = () => activate();
    const onClick = (event: MouseEvent) => {
      event.preventDefault();
      activate();
    };
    const onKey = (event: KeyboardEvent) => {
      if (["Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
      event.preventDefault();
      activate();
    };

    window.addEventListener("keydown", onKey);
    this.overlay.addEventListener("pointerdown", onPointer);
    button?.addEventListener("click", onClick);
    window.requestAnimationFrame(() => button?.focus());
  }

  private fadeInOverlay(): void {
    this.overlay.style.opacity = "0";
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        this.overlay.style.opacity = "1";
      });
    });
  }

  hideOverlay(): void {
    this.titleShown = false;
    this.escapeAction = null;
    this.overlay.style.opacity = "";
    this.overlay.classList.add("hidden");
    this.overlay.classList.remove("title-mode");
    document.body.classList.remove("title-mode");
    this.onVisibilityChange?.(false);
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  private show(content: HTMLElement, escapeAction: () => void): void {
    this.titleShown = false;
    this.escapeAction = escapeAction;
    this.overlay.classList.remove("title-mode");
    document.body.classList.remove("title-mode");
    this.panelHost.replaceChildren(content);
    this.overlay.classList.remove("hidden");
    this.onVisibilityChange?.(true);
    this.fadeInOverlay();
    window.requestAnimationFrame(() => this.focusFirst());
  }
}
