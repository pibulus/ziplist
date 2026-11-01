import { writable } from "svelte/store";

const KEY = "ziplist_list_preferences_v1";
const defaults = { newItems: "top", showChecked: true };

/** Local display/entry preferences; never part of a shared list snapshot. */
export const listPreferences = writable(defaults);

export function loadListPreferences() {
  if (typeof window === "undefined") return;
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || "{}");
    listPreferences.set({
      newItems: saved.newItems === "bottom" ? "bottom" : "top",
      showChecked: saved.showChecked !== false,
    });
  } catch {
    listPreferences.set(defaults);
  }
}

export function setListPreference(key, value) {
  listPreferences.update((current) => {
    const next = { ...current, [key]: value };
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Browsers with disabled storage still keep this session's choice.
      }
    }
    return next;
  });
}
