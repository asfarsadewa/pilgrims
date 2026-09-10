import { describe, expect, it } from "vitest";
import {
  CAMERA_PRESETS,
  cameraPitchDegrees,
  DEFAULT_CAMERA,
  getCameraPreset,
} from "../src/rendering/cameraPresets";

describe("camera presets", () => {
  it("defaults to the diorama view", () => {
    expect(DEFAULT_CAMERA).toBe("diorama");
    expect(getCameraPreset(undefined).id).toBe("diorama");
    expect(getCameraPreset("nonsense").id).toBe("diorama");
  });

  it("has unique ids and non-degenerate directions", () => {
    const ids = CAMERA_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of CAMERA_PRESETS) {
      const [x, y, z] = preset.direction;
      expect(Math.hypot(x, y, z)).toBeGreaterThan(0.1);
      expect(y).toBeGreaterThan(0);
    }
  });

  it("orders the views from low to high", () => {
    const pitch = (id: string) =>
      cameraPitchDegrees(getCameraPreset(id).direction);
    expect(pitch("diorama")).toBeLessThan(pitch("classic"));
    expect(pitch("classic")).toBeLessThan(pitch("elevated"));
    // Diorama is a genuinely lower, tabletop angle.
    expect(pitch("diorama")).toBeLessThan(40);
    expect(pitch("elevated")).toBeGreaterThan(55);
  });

  it("keeps the grid orientation consistent across presets", () => {
    for (const preset of CAMERA_PRESETS) {
      const [x, , z] = preset.direction;
      expect(x / z).toBeCloseTo(0.5, 5);
    }
  });
});
