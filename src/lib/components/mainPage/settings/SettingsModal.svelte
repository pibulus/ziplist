<script>
	import { onMount } from 'svelte';
	import { theme, autoRecord, showSettingsModal, applyTheme, promptStyle } from '$lib';
	import { geminiService } from '$lib/services/geminiService';
	import { PROMPT_STYLES } from '$lib/constants';

	import { ModalCloseButton } from '../modals/index.js';

	// Props for the modal
	export let closeModal = () => {};

	// Theme/vibe selection
	let selectedVibe;
	let scrollPosition = 0;
	let autoRecordValue = false;
	let chunkyModeValue = false;

	// Subscribe to theme store
	const unsubscribeTheme = theme.subscribe((value) => {
		selectedVibe = value;
	});

	// Subscribe to autoRecord store
	const unsubscribeAutoRecord = autoRecord.subscribe((value) => {
		autoRecordValue = value === 'true';
	});

	// Theme options
	const vibeOptions = [
		{ id: 'focus', name: 'Focus' },
		{ id: 'chill', name: 'Chill' },
		{ id: 'zen', name: 'Zen' },
		{ id: 'nocturne', name: 'Nocturne' },
		{ id: 'neo', name: 'Neo' }
	];

	onMount(() => {
		// Check for chunky mode
		if (typeof document !== 'undefined') {
			chunkyModeValue = document.documentElement.classList.contains('mode-neo-brutalist');
		}

		// Handle native dialog close (Escape key, form method="dialog")
		const dialog = document.getElementById('settings_modal');
		function onDialogClose() {
			closeModal();
		}
		if (dialog) {
			dialog.addEventListener('close', onDialogClose);
		}

		return () => {
			unsubscribeTheme();
			unsubscribeAutoRecord();
			if (dialog) {
				dialog.removeEventListener('close', onDialogClose);
			}
		};
	});

	// Handle chunky mode toggle
	function toggleChunkyMode() {
		chunkyModeValue = !chunkyModeValue;
		
		if (chunkyModeValue) {
			document.documentElement.classList.add('mode-neo-brutalist');
			localStorage.setItem('ziplist-chunky-mode', 'true');
		} else {
			document.documentElement.classList.remove('mode-neo-brutalist');
			localStorage.setItem('ziplist-chunky-mode', 'false');
		}
	}

	// Handle vibe change
	function changeVibe(vibeId) {
		selectedVibe = vibeId;
		applyTheme(vibeId);
		
		// Dispatch a custom event that other components can listen for
		window.dispatchEvent(
			new CustomEvent('ziplist-setting-changed', {
				detail: { setting: 'theme', value: vibeId }
			})
		);
	}

	// Handle auto-record toggle
	function toggleAutoRecord() {
		autoRecordValue = !autoRecordValue;
		autoRecord.set(autoRecordValue.toString());

		window.dispatchEvent(
			new CustomEvent('ziplist-setting-changed', {
				detail: { setting: 'autoRecord', value: autoRecordValue }
			})
		);
	}

	function handleModalClose() {
		closeModal();
	}
</script>

<dialog
	id="settings_modal"
	class="zl-settings-dialog"
	aria-labelledby="settings_modal_title"
	aria-modal="true"
>
	<div class="zl-settings-card">
		<div class="zl-settings-content">
			<div class="zl-settings-header">
				<h3 id="settings_modal_title" class="zl-settings-title">⚙️ Settings</h3>
				<form method="dialog">
					<button class="zl-settings-close" on:click={handleModalClose} aria-label="Close settings">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</form>
			</div>

			<div class="zl-settings-section">
				<h4 class="zl-section-label">General</h4>
				
				<div class="zl-setting-row">
					<div class="zl-setting-info">
						<span class="zl-setting-name">Auto-Record on Start</span>
						<p class="zl-setting-desc">Start recording immediately when you open ZipList</p>
					</div>
					<label class="zl-toggle">
						<input type="checkbox" checked={autoRecordValue} on:change={toggleAutoRecord} />
						<span class="zl-toggle-slider"></span>
					</label>
				</div>

				<div class="zl-setting-row">
					<div class="zl-setting-info">
						<span class="zl-setting-name">Chunky Mode</span>
						<p class="zl-setting-desc">Thick borders & hard shadows</p>
					</div>
					<label class="zl-toggle">
						<input type="checkbox" checked={chunkyModeValue} on:change={toggleChunkyMode} />
						<span class="zl-toggle-slider"></span>
					</label>
				</div>
			</div>

			<div class="zl-settings-section">
				<h4 class="zl-section-label">Choose Your Vibe</h4>
				<div class="zl-vibe-grid">
					{#each vibeOptions as vibe}
						<button
							class="zl-vibe-option"
							class:active={selectedVibe === vibe.id}
							on:click={() => changeVibe(vibe.id)}
						>
							<span class="zl-vibe-name">{vibe.name}</span>
							{#if selectedVibe === vibe.id}
								<span class="zl-vibe-check">✓</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>

	<div class="zl-modal-backdrop" on:click|self={handleModalClose}></div>
</dialog>

<style>
	:global(dialog.zl-settings-dialog) {
		display: none;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		padding: 0;
		margin: 0;
		width: 100vw;
		height: 100vh;
		max-width: none;
		max-height: none;
		position: fixed;
		inset: 0;
		z-index: 1000;
	}

	:global(dialog.zl-settings-dialog[open]) {
		display: flex;
	}

	.zl-settings-card {
		position: relative;
		z-index: 1001;
		width: 90%;
		max-width: 480px;
		background: var(--zl-card-bg-gradient-color-start, #fff);
		border: var(--zl-card-border-width, 4px) solid var(--zl-card-border-color, #000);
		border-radius: var(--zl-card-border-radius, 32px);
		box-shadow: var(--zl-card-box-shadow, 0 12px 30px rgba(0,0,0,0.1));
		padding: 2rem;
		animation: modal-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
	}

	@keyframes modal-pop {
		from { opacity: 0; transform: scale(0.9) translateY(20px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}

	.zl-settings-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.zl-settings-title {
		font-family: 'Space Mono', monospace;
		font-size: 1.5rem;
		font-weight: 900;
		color: var(--zl-text-color-primary, #000);
		margin: 0;
	}

	.zl-settings-close {
		background: transparent;
		border: none;
		cursor: pointer;
		color: var(--zl-text-color-secondary, #666);
		padding: 0.5rem;
		border-radius: 50%;
		transition: all 0.2s;
	}

	.zl-settings-close:hover {
		background: rgba(0,0,0,0.05);
		transform: rotate(90deg);
	}

	.zl-settings-section {
		margin-bottom: 2rem;
	}

	.zl-section-label {
		font-family: 'Space Mono', monospace;
		font-size: 0.85rem;
		font-weight: 800;
		text-transform: uppercase;
		color: var(--zl-text-color-disabled, #999);
		margin-bottom: 1rem;
		letter-spacing: 1px;
	}

	.zl-setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		background: rgba(255,255,255,0.5);
		border: 2px solid var(--zl-item-border-color, rgba(0,0,0,0.1));
		border-radius: 16px;
		margin-bottom: 0.75rem;
		transition: all 0.2s;
	}

	.zl-setting-row:hover {
		border-color: var(--zl-primary-color);
		background: white;
	}

	.zl-setting-name {
		font-weight: 800;
		color: var(--zl-text-color-primary, #000);
		display: block;
	}

	.zl-setting-desc {
		font-size: 0.75rem;
		color: var(--zl-text-color-secondary, #666);
		margin: 0.25rem 0 0 0;
	}

	/* Toggle Switch */
	.zl-toggle {
		position: relative;
		display: inline-block;
		width: 48px;
		height: 24px;
		flex-shrink: 0;
	}

	.zl-toggle input { opacity: 0; width: 0; height: 0; }

	.zl-toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0; left: 0; right: 0; bottom: 0;
		background-color: var(--zl-text-color-disabled, #ccc);
		transition: .4s;
		border-radius: 24px;
		border: 2px solid transparent;
	}

	.zl-toggle-slider:before {
		position: absolute;
		content: "";
		height: 16px; width: 16px;
		left: 2px; bottom: 2px;
		background-color: white;
		transition: .4s;
		border-radius: 50%;
	}

	input:checked + .zl-toggle-slider {
		background-color: var(--zl-primary-color, #ffcc33);
	}

	input:checked + .zl-toggle-slider:before {
		transform: translateX(24px);
	}

	/* Vibe Grid */
	.zl-vibe-grid {
		display: grid;
		grid-template-cols: repeat(auto-fill, minmax(100px, 1fr));
		gap: 0.75rem;
	}

	.zl-vibe-option {
		position: relative;
		padding: 1rem 0.5rem;
		background: white;
		border: 2px solid var(--zl-item-border-color, rgba(0,0,0,0.1));
		border-radius: 16px;
		cursor: pointer;
		transition: all 0.2s;
		font-family: 'Space Mono', monospace;
		font-weight: 700;
		font-size: 0.8rem;
	}

	.zl-vibe-option:hover {
		border-color: var(--zl-primary-color);
		transform: translateY(-2px);
	}

	.zl-vibe-option.active {
		border-color: var(--zl-primary-color);
		background: var(--zl-highlight-color, #fff9f5);
		box-shadow: 0 4px 12px rgba(var(--zl-primary-color-rgb, 0,0,0), 0.1);
	}

	.zl-vibe-check {
		position: absolute;
		top: -5px;
		right: -5px;
		background: var(--zl-primary-color);
		color: white;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: bold;
		border: 2px solid white;
	}

	.zl-modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.4);
		backdrop-filter: blur(4px);
		z-index: 1000;
	}
</style>