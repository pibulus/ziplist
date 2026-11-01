import { browser } from "$app/environment";
import { writable } from "svelte/store";

const KEY = "ziplist-saved-shared-lists-v1";
const MAX_SAVED = 8;
const ROOM_ID = /^zl_(?:p?[0-9a-f-]{16,48})$/;

function cleanEntry(entry) {
  if (!entry || !ROOM_ID.test(String(entry.roomId || ""))) return null;
  const name = String(entry.name || "Shared list")
    .split("")
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join("")
    .trim()
    .slice(0, 64);
  const color = /^#[0-9a-f]{6}$/i.test(entry.color || "")
    ? entry.color
    : "#a970ea";
  return { roomId: entry.roomId, name: name || "Shared list", color };
}

function load() {
  if (!browser) return [];
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value)
      ? value.map(cleanEntry).filter(Boolean).slice(0, MAX_SAVED)
      : [];
  } catch {
    return [];
  }
}

export const savedSharedLists = writable(load());

function save(entries) {
  if (!browser) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    return true;
  } catch {
    // The current visit stays live even if storage is unavailable.
    return false;
  }
}

/** Keep only a return address, never a guest snapshot or a Passport secret. */
export function rememberSharedList(entry) {
  const clean = cleanEntry(entry);
  if (!clean) return false;
  let persisted = false;
  savedSharedLists.update((entries) => {
    const next = [
      clean,
      ...entries.filter((e) => e.roomId !== clean.roomId),
    ].slice(0, MAX_SAVED);
    persisted = save(next);
    return next;
  });
  return persisted;
}

export function forgetSharedList(roomId) {
  savedSharedLists.update((entries) => {
    const next = entries.filter((entry) => entry.roomId !== roomId);
    save(next);
    return next;
  });
}
