<script>
  import { fade, fly } from "svelte/transition";
  import { listsService } from "$lib/services/lists/listsService";

  import { goto } from "$app/navigation";

  // Props
  export let sharedList;
  export let onClose = () => {};

  // Import the list and navigate to home
  async function importList() {
    if (sharedList) {
      // Add the list using the listsService
      await listsService.addList(sharedList);

      // Track successful import
      // postHogService.trackListImported(sharedList.items?.length || 0, 'share_link');

      // Close dialog and navigate home
      onClose();
      goto("/");
    }
  }
</script>

<div class="import-dialog-backdrop" transition:fade={{ duration: 200 }}>
  <div
    class="import-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="import-dialog-title"
    aria-describedby={sharedList
      ? "import-dialog-description"
      : "import-dialog-error"}
    in:fly={{ y: 20, duration: 250 }}
  >
    <div class="import-dialog-header">
      <div class="import-dialog-heading">
        <p class="import-eyebrow" aria-hidden="true">
          Someone zipped you a list
        </p>
        <h2 id="import-dialog-title">
          {sharedList ? sharedList.name : "This link needs a refresh"}
        </h2>
      </div>
      <button
        type="button"
        class="close-button"
        on:click={onClose}
        aria-label="Close dialog"
      >
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>

    <div class="import-dialog-content">
      {#if sharedList}
        <div class="import-preview">
          <p id="import-dialog-description" class="import-count">
            {sharedList.items.length}
            {sharedList.items.length === 1 ? "thing" : "things"} to tick off
          </p>

          <ul class="preview-items">
            {#each sharedList.items as item, i (i)}
              <li class="preview-item {item.checked ? 'checked' : ''}">
                <span class="preview-checkbox {item.checked ? 'checked' : ''}"
                ></span>
                <span class="preview-text">{item.text}</span>
              </li>
            {/each}
          </ul>
        </div>
      {:else}
        <div class="error-message">
          <p id="import-dialog-error">
            That shared list needs a fresh link.
          </p>
        </div>
      {/if}
    </div>

    <div class="import-dialog-actions">
      <button type="button" class="cancel-button" on:click={onClose}
        >Not now</button
      >
      <button
        type="button"
        class="import-button"
        on:click={importList}
        disabled={!sharedList}
      >
        Add to my lists
      </button>
    </div>
  </div>
</div>

<style>
  /* Dialog backdrop */
  .import-dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
  }

  /* Dialog container */
  .import-dialog {
    background: white;
    border-radius: var(--zl-card-border-radius, 28px);
    width: 90%;
    max-width: 480px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border: var(--zl-card-border-width, 3px) solid
      var(--zl-card-border-color, rgba(255, 212, 218, 0.8));
    background: linear-gradient(
      135deg,
      var(--zl-card-bg-gradient-color-start, #fff6e5),
      var(--zl-card-bg-gradient-color-second, #ffecf0)
    );
  }

  /* Dialog header */
  .import-dialog-header {
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 2px dashed
      var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }

  .import-dialog-heading {
    min-width: 0;
  }

  .import-eyebrow {
    margin: 0 0 0.3rem;
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xs, 0.75rem);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--zl-text-color-secondary, #888);
  }

  .import-dialog-header h2 {
    margin: 0;
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xl, 1.4rem);
    color: var(--zl-text-color-primary, #444444);
    overflow-wrap: break-word;
  }

  .close-button {
    background: transparent;
    border: 0;
    color: var(--zl-text-color-secondary, #666);
    opacity: 0.72;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover,
  .close-button:focus-visible {
    background: rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.12);
    color: var(--zl-text-color-primary, #444);
    opacity: 1;
    outline: none;
  }

  /* Dialog content */
  .import-dialog-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .import-count {
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xs, 0.8rem);
    font-weight: 700;
    color: var(--zl-text-color-secondary, #888);
    margin: 0 0 0.85rem;
  }

  .preview-items {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .preview-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 12px;
    border: 1px solid var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }

  .preview-item.checked {
    opacity: 0.75;
  }

  .preview-checkbox {
    position: relative;
    width: 24px;
    height: 24px;
    border-radius: 8px;
    border: var(--zl-checkbox-border, 2px solid rgba(255, 176, 0, 0.5));
    background: var(--zl-checkbox-bg, rgba(255, 255, 255, 0.8));
    flex-shrink: 0;
  }

  .preview-checkbox.checked {
    background: linear-gradient(
      145deg,
      var(--zl-checkbox-checked-gradient-start, #ffd680) 0%,
      var(--zl-checkbox-checked-gradient-end, #ffb000) 100%
    );
    border-color: transparent;
  }

  .preview-checkbox.checked::before {
    content: "";
    position: absolute;
    top: 44%;
    left: 50%;
    width: 38%;
    height: 20%;
    border-left: 2.5px solid white;
    border-bottom: 2.5px solid white;
    border-radius: 1px;
    transform: translate(-50%, -50%) rotate(-45deg);
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.28));
  }

  .preview-text {
    font-family: "Space Mono", monospace;
    font-size: 1rem;
    color: var(--zl-text-color-primary, #444444);
    word-break: break-word;
  }

  .preview-item.checked .preview-text {
    text-decoration: line-through;
    color: var(--zl-text-color-disabled, #9d9d9d);
  }

  .error-message {
    background: rgba(255, 251, 235, 0.78);
    border: 1px solid rgba(255, 176, 0, 0.32);
    padding: 1rem;
    border-radius: 12px;
    color: #4b5563;
    font-family: "Space Mono", monospace;
    text-align: center;
  }

  /* Dialog actions */
  .import-dialog-actions {
    padding: 1.5rem;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    border-top: 1px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.14);
    background: rgba(255, 255, 255, 0.5);
  }

  .cancel-button,
  .import-button {
    padding: 0.75rem 1.5rem;
    border-radius: 12px;
    font-family: "Space Mono", monospace;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cancel-button {
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.3);
    color: var(--zl-text-color-secondary, #666666);
  }

  .cancel-button:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-2px);
  }

  .import-button {
    background: var(--zl-primary-color, #ffb000);
    border: none;
    color: #111111;
    font-weight: 700;
    box-shadow: 0 3px 8px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.25);
  }

  .import-button:hover:not(:disabled) {
    transform: translateY(-2px);
    filter: saturate(1.08) brightness(1.04);
    box-shadow: 0 5px 15px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.3);
  }

  .import-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive styles */
  @media (max-width: 480px) {
    .import-dialog {
      width: 95%;
      max-height: 95vh;
    }

    .import-dialog-header {
      padding: 1rem;
    }

    .import-dialog-header h2 {
      font-size: var(--font-size-lg, 1.2rem);
    }

    .import-dialog-content,
    .import-dialog-actions {
      padding: 1rem;
    }

    .preview-item {
      padding: 0.5rem 0.75rem;
    }

    .cancel-button,
    .import-button {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
    }
  }
</style>
