import { CAMERA_PRESETS, CameraPresetId } from "../rendering/cameraPresets";

/**
 * A small segmented control for choosing the camera view. Used on the opening
 * screen and in the pause menu. The active option is reflected by the `active`
 * class so `UI.setActiveCamera` can update it without a re-render.
 */
export function renderCameraControl(
  current: CameraPresetId,
  onSelect: (id: CameraPresetId) => void,
  variant: "panel" | "title",
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = `camera-control camera-control--${variant}`;

  const label = document.createElement("span");
  label.className = "camera-label";
  label.textContent = "View";

  const options = document.createElement("div");
  options.className = "camera-options";

  for (const preset of CAMERA_PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `camera-option${preset.id === current ? " active" : ""}`;
    button.dataset.camera = preset.id;
    button.textContent = preset.label;
    button.title = preset.blurb;
    button.addEventListener("click", () => onSelect(preset.id));
    options.append(button);
  }

  wrap.append(label, options);
  return wrap;
}
