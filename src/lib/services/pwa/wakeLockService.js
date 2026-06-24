import { browser } from "$app/environment";
import { writable } from "svelte/store";

export const wakeLockStatus = writable({
  supported: false,
  active: false,
  error: null,
});

class WakeLockService {
  constructor() {
    this.sentinel = null;
    this.shouldReacquire = false;
    this.requestId = 0;
    this.supported = false;

    this.handleRelease = () => {
      this.sentinel = null;
      wakeLockStatus.set({
        supported: this.supported,
        active: false,
        error: null,
      });
    };

    // Stored as a named reference (not an inline closure) so destroy() can
    // remove it. Re-acquires the lock when the tab becomes visible again.
    this.handleVisibilityChange = () => {
      if (
        this.shouldReacquire &&
        this.supported &&
        document.visibilityState === "visible"
      ) {
        this.request().catch(() => {});
      }
    };

    if (browser) {
      this.supported = Boolean(navigator.wakeLock?.request);
      wakeLockStatus.update((state) => ({
        ...state,
        supported: this.supported,
      }));

      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );
    }
  }

  /**
   * Release any active lock and remove the visibilitychange listener.
   * Call when the service is no longer needed (e.g. component teardown).
   */
  destroy() {
    if (browser && this.handleVisibilityChange) {
      document.removeEventListener(
        "visibilitychange",
        this.handleVisibilityChange,
      );
    }
    this.release();
  }

  async request() {
    if (!browser || !this.supported) {
      return false;
    }

    this.shouldReacquire = true;
    const requestId = ++this.requestId;

    if (this.sentinel && !this.sentinel.released) {
      return true;
    }

    try {
      const sentinel = await navigator.wakeLock.request("screen");

      if (!this.shouldReacquire || requestId !== this.requestId) {
        await sentinel.release().catch(() => {});
        return false;
      }

      this.sentinel = sentinel;
      this.sentinel.addEventListener("release", this.handleRelease, {
        once: true,
      });

      wakeLockStatus.set({
        supported: this.supported,
        active: true,
        error: null,
      });

      return true;
    } catch (error) {
      wakeLockStatus.set({
        supported: this.supported,
        active: false,
        error: error?.message || "Wake lock unavailable",
      });
      return false;
    }
  }

  async release() {
    this.shouldReacquire = false;
    this.requestId += 1;

    if (!this.sentinel) {
      wakeLockStatus.set({
        supported: this.supported,
        active: false,
        error: null,
      });
      return;
    }

    const sentinel = this.sentinel;
    this.sentinel = null;

    try {
      sentinel.removeEventListener("release", this.handleRelease);
      if (!sentinel.released) {
        await sentinel.release();
      }
    } catch (error) {
      wakeLockStatus.set({
        supported: this.supported,
        active: false,
        error: error?.message || "Wake lock release failed",
      });
      return;
    }

    wakeLockStatus.set({
      supported: this.supported,
      active: false,
      error: null,
    });
  }
}

export const wakeLockService = new WakeLockService();
