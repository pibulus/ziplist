<script>
  import { fade, fly } from "svelte/transition";

  export let listId;
  export let draftItemText = "";
  export let inputNode = null;
  export let staggerDelay = 0;
  export let onSaveDraft = () => {};
  export let onDraftKeyDown = () => {};
  export let onTyping = () => {};
  export let onCancelDraft = () => {};

  function autoFocus(node) {
    node.focus();
    return {};
  }
</script>

<li
  class="zl-item editing zl-draft-item"
  in:fly={{ y: 20, duration: 220, delay: staggerDelay }}
  out:fly={{ y: -12, duration: 180 }}
  role="listitem"
>
  <div class="zl-checkbox-wrapper zl-draft-checkbox" aria-hidden="true">
    <span class="zl-checkbox-custom"></span>
  </div>

  <div class="edit-wrapper">
    <input
      id="draft-item-{listId}"
      class="zl-edit-input zl-draft-input"
      placeholder="New item..."
      aria-label="New item text"
      bind:value={draftItemText}
      bind:this={inputNode}
      on:blur={onSaveDraft}
      on:keydown={onDraftKeyDown}
      on:input={(event) => onTyping(event.currentTarget.value)}
      transition:fade={{ duration: 150 }}
      use:autoFocus
    />
  </div>

  <button
    type="button"
    class="zl-item-delete-button zl-draft-cancel"
    data-swipe-ignore="true"
    on:pointerdown|preventDefault
    on:click|stopPropagation={onCancelDraft}
    aria-label="Cancel new item"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  </button>
</li>
