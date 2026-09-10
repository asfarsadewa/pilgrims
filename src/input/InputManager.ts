import { Direction } from "../game/types";

export type InputAction =
  | { type: "move"; direction: Direction }
  | { type: "undo" }
  | { type: "restart" }
  | { type: "menu" }
  | { type: "toggle-mute" };

export type InputHandler = (action: InputAction) => void;

/**
 * Keyboard, swipe and on-screen d-pad input. Four directions plus meta actions.
 */
export class InputManager {
  private enabled = true;
  /** True while a DOM overlay owns the screen; native keyboard nav must win. */
  private uiActive = false;
  private handlers: InputHandler[] = [];
  private touchStart: { x: number; y: number; time: number } | null = null;
  private swipeTarget: HTMLElement;
  private keyListener: (event: KeyboardEvent) => void;
  private pointerDown: (event: PointerEvent) => void;
  private pointerUp: (event: PointerEvent) => void;

  constructor(swipeTarget: HTMLElement) {
    this.swipeTarget = swipeTarget;

    this.keyListener = (event) => this.onKey(event);
    window.addEventListener("keydown", this.keyListener);

    this.pointerDown = (event) => {
      if (event.pointerType === "mouse") return;
      this.touchStart = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
      };
    };
    this.pointerUp = (event) => {
      if (!this.touchStart) return;
      const dx = event.clientX - this.touchStart.x;
      const dy = event.clientY - this.touchStart.y;
      const elapsed = performance.now() - this.touchStart.time;
      this.touchStart = null;
      const threshold = 24;
      if (elapsed > 700) return;
      if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.emit({ type: "move", direction: dx > 0 ? Direction.Right : Direction.Left });
      } else {
        this.emit({ type: "move", direction: dy > 0 ? Direction.Down : Direction.Up });
      }
    };
    this.swipeTarget.addEventListener("pointerdown", this.pointerDown);
    this.swipeTarget.addEventListener("pointerup", this.pointerUp);
    this.swipeTarget.addEventListener("pointercancel", () => {
      this.touchStart = null;
    });

    this.bindButtons();
  }

  on(handler: InputHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Release the keyboard while an overlay is open so Tab/Enter/Escape work. */
  setUiActive(active: boolean): void {
    this.uiActive = active;
  }

  private get active(): boolean {
    return this.enabled && !this.uiActive;
  }

  private emit(action: InputAction): void {
    if (!this.active) return;
    for (const handler of this.handlers) handler(action);
  }

  private onKey(event: KeyboardEvent): void {
    // Never swallow keys while a menu is open — the browser handles focus.
    if (!this.active) return;
    // Claim the event so DOM overlays do not also act on the same keypress.
    (event as KeyboardEvent & { __pilgrimsInput?: boolean }).__pilgrimsInput = true;
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      this.emit({ type: "undo" });
      return;
    }
    switch (key) {
      case "arrowup":
      case "w":
        event.preventDefault();
        this.emit({ type: "move", direction: Direction.Up });
        break;
      case "arrowdown":
      case "s":
        event.preventDefault();
        this.emit({ type: "move", direction: Direction.Down });
        break;
      case "arrowleft":
      case "a":
        event.preventDefault();
        this.emit({ type: "move", direction: Direction.Left });
        break;
      case "arrowright":
      case "d":
        event.preventDefault();
        this.emit({ type: "move", direction: Direction.Right });
        break;
      case " ":
      case "spacebar":
        event.preventDefault();
        this.emit({ type: "move", direction: Direction.Wait });
        break;
      case "z":
        this.emit({ type: "undo" });
        break;
      case "r":
        this.emit({ type: "restart" });
        break;
      case "escape":
        event.preventDefault();
        this.emit({ type: "menu" });
        break;
      case "m":
        this.emit({ type: "toggle-mute" });
        break;
    }
  }

  private bindButtons(): void {
    const buttons = document.querySelectorAll<HTMLElement>("[data-move]");
    for (const button of buttons) {
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        const direction = button.dataset.move as Direction;
        if (direction) this.emit({ type: "move", direction });
      });
    }
    const actions = document.querySelectorAll<HTMLElement>("[data-action]");
    for (const button of actions) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const action = button.dataset.action;
        if (action === "undo") this.emit({ type: "undo" });
        else if (action === "restart") this.emit({ type: "restart" });
        else if (action === "menu") this.emit({ type: "menu" });
        else if (action === "mute") this.emit({ type: "toggle-mute" });
      });
    }
  }
}
