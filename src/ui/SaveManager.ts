import type { CameraPresetId } from "../rendering/cameraPresets";

export interface SaveData {
  highestLevel: number;
  completed: string[];
  bestMoves: Record<string, number>;
  muted: boolean;
  camera: CameraPresetId;
}

const STORAGE_KEY = "pilgrims.save.v1";

const DEFAULT_SAVE: SaveData = {
  highestLevel: 0,
  completed: [],
  bestMoves: {},
  muted: false,
  camera: "diorama",
};

export class SaveManager {
  data: SaveData;

  constructor() {
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SAVE, completed: [], bestMoves: {} };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        highestLevel: parsed.highestLevel ?? 0,
        completed: parsed.completed ?? [],
        bestMoves: parsed.bestMoves ?? {},
        muted: parsed.muted ?? false,
        camera: parsed.camera ?? DEFAULT_SAVE.camera,
      };
    } catch {
      return { ...DEFAULT_SAVE, completed: [], bestMoves: {} };
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable; play on without saving.
    }
  }

  isCompleted(levelId: string): boolean {
    return this.data.completed.includes(levelId);
  }

  best(levelId: string): number | undefined {
    return this.data.bestMoves[levelId];
  }

  markCompleted(levelId: string, moves: number, levelIndex: number): void {
    if (!this.data.completed.includes(levelId)) {
      this.data.completed.push(levelId);
    }
    const previous = this.data.bestMoves[levelId];
    if (previous === undefined || moves < previous) {
      this.data.bestMoves[levelId] = moves;
    }
    this.data.highestLevel = Math.max(this.data.highestLevel, levelIndex + 1);
    this.persist();
  }

  setMuted(muted: boolean): void {
    this.data.muted = muted;
    this.persist();
  }

  setCamera(camera: CameraPresetId): void {
    this.data.camera = camera;
    this.persist();
  }

  reset(): void {
    this.data = { ...DEFAULT_SAVE, completed: [], bestMoves: {} };
    this.persist();
  }
}
