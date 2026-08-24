/**
 * Svelte action: focus an input on mount without jarring jumps or forced
 * center-scrolling. Only gently scrolls using block: "nearest" if the input
 * is actually occluded by the virtual keyboard.
 */
export function autoFocus(node) {
  if (!node) return;
  node.focus();

  if (
    typeof node.setSelectionRange === "function" &&
    typeof node.value === "string"
  ) {
    const len = node.value.length;
    node.setSelectionRange(len, len);
  }

  const settle = setTimeout(() => {
    if (typeof window === "undefined" || !node) return;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const rect = node.getBoundingClientRect();
    if (rect.bottom > viewportHeight - 20 || rect.top < 20) {
      node.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, 250);

  return { destroy: () => clearTimeout(settle) };
}
