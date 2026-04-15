import { readable } from 'svelte/store';

/**
 * Reactive store that tracks whether the app/tab is currently visible.
 * Returns false when the tab is hidden (user switched away).
 * Used to pause expensive animations when the user can't see them.
 */
export const appActive = readable(true, (set) => {
	if (typeof document === 'undefined') return;

	function onVisibilityChange() {
		set(!document.hidden);
	}

	document.addEventListener('visibilitychange', onVisibilityChange);

	return () => {
		document.removeEventListener('visibilitychange', onVisibilityChange);
	};
});
