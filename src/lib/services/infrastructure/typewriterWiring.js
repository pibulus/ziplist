// ===================================================================
// TYPEWRITER WIRING — keystroke sounds for every editable surface
// ===================================================================
// Vendored from daysay (the family typewriter piece) with one ziplist
// twist: instead of per-editor handlers, wireTypewriterGlobally() hangs a
// single delegated pair of listeners on the window, so item inputs, list
// renames — every text field — click like a real keyboard without any
// per-component plumbing. The 34ms guard stops the keydown+beforeinput
// dual path double-firing on one keystroke. Respects the app sound toggle;
// the 2.5MB Cherry MX pack is only fetched after the first eligible
// keystroke (then the service worker keeps it).
// ===================================================================

import { soundService } from "./soundService.js";
import { typewriterSoundService } from "./typewriterSoundService.js";

const TYPEWRITER_GUARD_MS = 34;
const EDITABLE_SELECTOR =
  'input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]';

export function wireTypewriterGlobally() {
  if (typeof window === "undefined") return () => {};

  let lastTypewriterAt = 0;

  const canType = () => soundService.isEnabled?.() ?? false;
  const inEditable = (e) => e.target?.closest?.(EDITABLE_SELECTOR);

  function onKeydown(e) {
    if (!canType() || !inEditable(e)) return;
    if (!typewriterSoundService.isEditKeyEvent?.(e)) return;
    lastTypewriterAt = performance.now?.() ?? 0;
    Promise.resolve(typewriterSoundService.playFromKeyboardEvent?.(e)).catch(
      () => {},
    );
  }

  function onBeforeInput(e) {
    if (!canType() || !inEditable(e)) return;
    const now = performance.now?.() ?? 0;
    if (now - lastTypewriterAt < TYPEWRITER_GUARD_MS) return;
    if (!typewriterSoundService.isSupportedInputEvent?.(e)) return;
    lastTypewriterAt = now;
    Promise.resolve(typewriterSoundService.playFromInputEvent?.(e)).catch(
      () => {},
    );
  }

  // Warm the pack when a text field gains focus, so the very first
  // keystroke clicks instead of silently priming the sprite.
  function onFocusIn(e) {
    if (!canType() || !inEditable(e)) return;
    Promise.resolve(typewriterSoundService.prime?.()).catch(() => {});
  }

  window.addEventListener("keydown", onKeydown);
  window.addEventListener("beforeinput", onBeforeInput);
  window.addEventListener("focusin", onFocusIn);

  return () => {
    window.removeEventListener("keydown", onKeydown);
    window.removeEventListener("beforeinput", onBeforeInput);
    window.removeEventListener("focusin", onFocusIn);
  };
}
