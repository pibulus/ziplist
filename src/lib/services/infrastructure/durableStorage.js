/**
 * Ask the browser not to evict this app's data.
 *
 * ZipList is local-first: no account, no server copy, no sync. Every list lives
 * in this browser and nowhere else. Browsers treat ordinary script storage as
 * disposable — WebKit clears all script-writable storage (localStorage,
 * IndexedDB, Cache API) after about seven days without a visit, and Chromium
 * evicts under storage pressure. A user who writes a shopping list, doesn't
 * open the app for a week, and comes back finds nothing, with no error and no
 * explanation. navigator.storage.persist() asks for exemption from that.
 *
 * Audited 2026-07-31: pwaService had requestPersistentStorage() written and
 * working, but its only caller was PwaDeviceSetup — a component gated behind
 * `{#if false && ...}` whose loader was commented out. So the request had never
 * once fired in production. Empty plumbing, same as TalkType's duration field.
 *
 * WHEN THIS FIRES, AND WHY IT MATTERS:
 * Firefox shows a permission prompt for persist(). Asking on page load, before
 * the user has typed anything, is a prompt about protecting data that doesn't
 * exist yet — easy to dismiss, and a dismissal is sticky. So the call is wired
 * into the save path instead: the first time ZipList writes real data, we ask.
 * The request is made at most once per browser profile.
 *
 * HONEST LIMIT: on iOS Safari persist() is largely a no-op, and the reliable
 * way to survive eviction there is adding the app to the home screen. That
 * makes the install prompt a data-durability feature, not a nicety. This helper
 * does what it can everywhere else (Chromium grants on engagement heuristics,
 * usually without any prompt).
 */

import { browser } from "$app/environment";
import { STORAGE_KEYS } from "$lib/constants";

// Module-level latch stops repeat work within a session; the storage key stops
// us re-prompting a user who already said no on a previous visit.
let requestedThisSession = false;

const ASKED_KEY = STORAGE_KEYS.DURABLE_STORAGE_ASKED || "ziplist-durable-asked";

/**
 * Best-effort request for durable storage. Never throws, never blocks a save,
 * and never asks twice.
 * @returns {Promise<boolean|null>} true if durable, false if refused, null if
 *   unsupported or already handled.
 */
export async function ensureDurableStorage() {
  if (!browser || requestedThisSession) return null;
  requestedThisSession = true;

  if (!navigator.storage?.persist) return null;

  try {
    // Cheap and prompt-free: if it's already granted there is nothing to ask.
    if (navigator.storage.persisted && (await navigator.storage.persisted())) {
      return true;
    }

    if (localStorage.getItem(ASKED_KEY)) return null;
    localStorage.setItem(ASKED_KEY, "1");

    return await navigator.storage.persist();
  } catch {
    // Private-browsing modes can throw on both storage APIs. Losing durability
    // is not worth losing the save that triggered this.
    return null;
  }
}
