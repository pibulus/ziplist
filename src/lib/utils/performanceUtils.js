/**
 * Creates an animation controller that runs a callback via requestAnimationFrame
 * and automatically pauses when the tab is hidden (Page Visibility API).
 *
 * @param {() => void} callback - The function to call each animation frame
 * @returns {{ start: () => void, stop: () => void, destroy: () => void }}
 */
export function createAnimationController(callback) {
	let rafId = null;
	let running = false;

	function loop() {
		if (!running) return;
		callback();
		rafId = requestAnimationFrame(loop);
	}

	function onVisibilityChange() {
		if (document.hidden) {
			cancelFrame();
		} else if (running) {
			rafId = requestAnimationFrame(loop);
		}
	}

	function cancelFrame() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', onVisibilityChange);
	}

	return {
		start() {
			if (running) return;
			running = true;
			rafId = requestAnimationFrame(loop);
		},
		stop() {
			running = false;
			cancelFrame();
		},
		destroy() {
			this.stop();
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
		}
	};
}
