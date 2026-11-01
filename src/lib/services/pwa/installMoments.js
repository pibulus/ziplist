import { writable } from "svelte/store";

// A successful use, not a visit or a checkbox in the tutorial.
export const installMomentTick = writable(0);

export function notePwaMoment() {
  installMomentTick.update((count) => count + 1);
}
