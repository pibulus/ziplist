import { VIBRATION } from "$lib/constants";

const IMPACT_PATTERNS = {
  light: 16,
  medium: 28,
  heavy: 42,
};

const NOTIFICATION_PATTERNS = {
  success: [20, 30, 20],
  warning: [28, 36, 28],
  error: VIBRATION.ERROR,
};

export class HapticService {
  constructor() {
    this.enabled = true;
    this.iosSwitchLabel = null;
  }

  isReducedMotion() {
    return (
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    );
  }

  hasTouchInput() {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return false;
    }

    return Boolean(
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.("(pointer: coarse)").matches,
    );
  }

  isSupported() {
    return typeof navigator !== "undefined" && "vibrate" in navigator;
  }

  ensureIosSwitchMounted() {
    if (typeof document === "undefined" || this.iosSwitchLabel) return;

    // iOS Safari 17.4+ hooks <input type="checkbox" switch> directly into the
    // physical Taptic Engine when toggled inside a user gesture.
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    Object.assign(label.style, {
      position: "fixed",
      top: "-9999px",
      left: "-9999px",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });

    const input = document.createElement("input");
    input.type = "checkbox";
    input.tabIndex = -1;
    input.setAttribute("switch", "");
    label.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("change", (e) => e.stopPropagation());
    label.appendChild(input);
    document.body?.appendChild(label);
    this.iosSwitchLabel = label;
  }

  vibrate(pattern) {
    if (!this.enabled || this.isReducedMotion() || !this.hasTouchInput()) {
      return false;
    }

    if (this.isSupported()) {
      try {
        navigator.vibrate(pattern);
        return true;
      } catch {
        return false;
      }
    }

    // iOS Safari fallback: trigger physical Taptic Engine via hidden switch
    try {
      this.ensureIosSwitchMounted();
      if (this.iosSwitchLabel) {
        this.iosSwitchLabel.click();
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  press() {
    return this.vibrate(6);
  }

  impact(style = "medium") {
    return this.vibrate(IMPACT_PATTERNS[style] ?? IMPACT_PATTERNS.medium);
  }

  notification(type = "success") {
    return this.vibrate(
      NOTIFICATION_PATTERNS[type] ?? NOTIFICATION_PATTERNS.success,
    );
  }

  selection() {
    return this.impact("light");
  }

  dragStart() {
    return this.impact("medium");
  }

  dragMove() {
    return this.selection();
  }

  dragEnd() {
    return this.impact("heavy");
  }

  startRecording() {
    return this.vibrate(VIBRATION.START_RECORDING);
  }

  stopRecording() {
    return this.vibrate(VIBRATION.STOP_RECORDING);
  }

  copySuccess() {
    return this.vibrate(VIBRATION.COPY_SUCCESS);
  }

  error() {
    return this.vibrate(VIBRATION.ERROR);
  }

  permissionError() {
    return this.vibrate(VIBRATION.PERMISSION_ERROR);
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  isEnabled() {
    return this.enabled;
  }
}

export const hapticService = new HapticService();
