import { writable, derived } from "svelte/store";

// Global animation activity store keyed to document visibility
export const appActive = writable(true);
export const shouldAnimateStore = derived(
  appActive,
  ($appActive) => $appActive,
);

if (typeof document !== "undefined") {
  const updateVisibility = () => {
    const isVisible = document.visibilityState === "visible";
    appActive.set(isVisible);
    if (document.documentElement) {
      document.documentElement.classList.toggle(
        "animations-paused",
        !isVisible,
      );
    }
  };

  updateVisibility();
  document.addEventListener("visibilitychange", updateVisibility);
}
