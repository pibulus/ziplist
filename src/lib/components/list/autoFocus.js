/**
 * Svelte action: focus an input on mount, then re-centre it in the viewport
 * once the on-screen keyboard has settled. Mobile keyboards cover the lower
 * half of the layout viewport without resizing it, so an item low in the
 * list gets edited blind without the follow-up scroll.
 */
export function autoFocus(node) {
  node.focus();
  const settle = setTimeout(() => {
    node.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 300);
  return { destroy: () => clearTimeout(settle) };
}
