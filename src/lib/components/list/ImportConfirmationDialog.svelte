<script>
  import { fade, fly } from "svelte/transition";
  import { listsService } from "$lib/services/lists/listsService";

  import { goto } from "$app/navigation";

  // Props
  export let sharedList;
  export let onClose = () => {};

  // Save the list and navigate to home
  async function saveList() {
    if (sharedList) {
      // Add the list using the listsService
      await listsService.addList(sharedList);

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
        <h2 id="import-dialog-title">
          {sharedList ? sharedList.name : "This link needs a refresh"}
        </h2>
        <p class="import-subtitle">shared with you</p>
      </div>
      <a class="import-brand" href="/" aria-label="Open ZipList">
        ZipList<span class="import-brand-dot" aria-hidden="true">.app</span>
      </a>
    </div>

    <div class="import-dialog-content">
      {#if sharedList}
        <ul class="preview-items">
          {#each sharedList.items as item, i (i)}
            <li class="preview-item {item.checked ? 'checked' : ''}">
              <span class="preview-checkbox {item.checked ? 'checked' : ''}"
              ></span>
              <span class="preview-text">{item.text}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="error-message">
          <p id="import-dialog-error">That shared list needs a fresh link.</p>
        </div>
      {/if}
    </div>

    <div class="import-dialog-actions">
      {#if sharedList}
        <p id="import-dialog-description" class="import-count">
          {sharedList.items.length}
          {sharedList.items.length === 1 ? "thing" : "things"}
        </p>
      {:else}
        <span></span>
      {/if}
      <div class="import-buttons">
        <button type="button" class="cancel-button" on:click={onClose}
          >Not now</button
        >
        <button
          type="button"
          class="import-button"
          on:click={saveList}
          disabled={!sharedList}
        >
          Save to ZipList
        </button>
      </div>
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
    background: rgba(43, 38, 32, 0.46);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(3px);
    padding: max(16px, env(safe-area-inset-top)) 16px
      max(16px, env(safe-area-inset-bottom));
  }

  /* Dialog container — same frame family as every ZipList modal */
  .import-dialog {
    width: min(92vw, 30rem);
    max-height: 88dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    border-radius: var(--zl-card-border-radius, 28px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border: var(--zl-card-border-width, 3px) solid
      var(--zl-card-border-color, rgba(255, 212, 218, 0.8));
    background: linear-gradient(
      135deg,
      var(--zl-card-bg-gradient-color-start, #fff6e5),
      var(--zl-card-bg-gradient-color-second, #ffecf0)
    );
  }

  /* Header: the list's name is the hero; the brand sits quietly top-right */
  .import-dialog-header {
    padding: 1.35rem 1.5rem 1rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    border-bottom: 2px dashed
      var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }

  .import-dialog-heading {
    min-width: 0;
  }

  .import-dialog-header h2 {
    margin: 0;
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-lg, 1.2rem);
    font-weight: 800;
    line-height: 1.25;
    color: var(--zl-text-color-primary, #444444);
    overflow-wrap: break-word;
  }

  .import-subtitle {
    margin: 0.2rem 0 0;
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--zl-text-color-secondary, #888);
  }

  .import-brand {
    flex-shrink: 0;
    font-family: "Space Mono", monospace;
    font-size: 0.85rem;
    font-weight: 800;
    line-height: 1.6;
    color: var(--zl-text-color-primary, #444);
    text-decoration: none;
    opacity: 0.82;
    transition: opacity 0.2s ease;
  }

  .import-brand:hover,
  .import-brand:focus-visible {
    opacity: 1;
    outline: none;
  }

  .import-brand-dot {
    color: var(--zl-primary-color, #ffb000);
  }

  /* Dialog content */
  .import-dialog-content {
    padding: 1.25rem 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .preview-items {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  /* Preview rows wear the real ZipList item look: white surface, accent
     spine on the left, the family checkbox. Same clothes, smaller closet. */
  .preview-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    background: var(--zl-item-bg, rgba(255, 255, 255, 0.85));
    border-radius: 16px;
    border: 2px solid var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
    border-left: 4px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.3);
  }

  .preview-item.checked {
    opacity: var(--zl-item-checked-opacity, 0.75);
    background: var(--zl-item-checked-bg, rgba(245, 240, 250, 0.4));
    border-left-color: var(
      --zl-item-checked-border-color,
      rgba(255, 176, 0, 0.2)
    );
  }

  .preview-checkbox {
    position: relative;
    width: 28px;
    height: 28px;
    border-radius: var(--zl-checkbox-border-radius, 12px);
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

  /* Item text matches the app's list items exactly */
  .preview-text {
    font-family: "Space Mono", monospace;
    font-size: 1.02rem;
    font-weight: 800;
    line-height: 1.35;
    color: var(--zl-text-color-primary, #444444);
    word-break: break-word;
  }

  .preview-item.checked .preview-text {
    text-decoration: line-through
      var(--zl-primary-color, rgba(255, 176, 0, 0.5)) 1.5px;
    color: var(--zl-text-color-disabled, #9d9d9d);
    font-weight: 700;
  }

  .error-message {
    background: rgba(255, 251, 235, 0.78);
    border: 1px solid rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.32);
    padding: 1rem;
    border-radius: 16px;
    color: #4b5563;
    font-family: "Space Mono", monospace;
    text-align: center;
  }

  /* Footer: a quiet fact on the left, the choices on the right */
  .import-dialog-actions {
    padding: 1rem 1.5rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    border-top: 2px dashed var(--zl-item-border-color, rgba(255, 212, 218, 0.6));
  }

  .import-count {
    margin: 0;
    font-family: "Space Mono", monospace;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--zl-text-color-secondary, #888);
    white-space: nowrap;
  }

  .import-buttons {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .cancel-button,
  .import-button {
    min-height: 44px;
    padding: 0.6rem 1.15rem;
    border-radius: 999px;
    font-family: "Space Mono", monospace;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .cancel-button {
    background: transparent;
    border: 0;
    color: var(--zl-text-color-secondary, #666666);
    opacity: 0.8;
  }

  .cancel-button:hover,
  .cancel-button:focus-visible {
    background: rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.12);
    color: var(--zl-text-color-primary, #444);
    opacity: 1;
    outline: none;
  }

  .import-button {
    background: var(--zl-primary-color, #ffb000);
    border: none;
    color: #111111;
    box-shadow: 0 3px 8px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.25);
  }

  .import-button:hover:not(:disabled),
  .import-button:focus-visible:not(:disabled) {
    transform: translateY(-2px);
    filter: saturate(1.08) brightness(1.04);
    box-shadow: 0 5px 15px rgba(var(--zl-primary-color-rgb, 255, 176, 0), 0.3);
    outline: none;
  }

  .import-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive styles */
  @media (max-width: 480px) {
    .import-dialog-header {
      padding: 1.1rem 1.15rem 0.85rem;
    }

    .import-dialog-content {
      padding: 1rem 1.15rem;
    }

    .import-dialog-actions {
      padding: 0.85rem 1.15rem 1rem;
    }

    .preview-item {
      padding: 0.6rem 0.75rem;
    }

    .preview-text {
      font-size: 0.98rem;
    }

    .cancel-button,
    .import-button {
      padding: 0.55rem 0.95rem;
      font-size: 0.84rem;
    }
  }
</style>
