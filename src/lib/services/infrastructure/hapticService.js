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

  vibrate(pattern) {
    if (!this.enabled || !this.isSupported() || !this.hasTouchInput()) {
      return false;
    }

    try {
      navigator.vibrate(pattern);
      return true;
    } catch {

      return false;
    }
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
