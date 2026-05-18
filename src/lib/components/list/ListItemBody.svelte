<script>
  import { fade } from "svelte/transition";

  export let listId;
  export let item;
  export let isEditing = false;
  export let editedItemText = "";
  export let showDropIndicator = false;
  export let dragOverPosition = "before";
  export let activeItemsCount = 0;
  export let isTouchActive = false;
  export let onToggle = () => {};
  export let onStartEdit = () => {};
  export let onSaveEdit = () => {};
  export let onEditKeyDown = () => {};
  export let onTyping = () => {};
  export let onReorderClick = () => {};
  export let onReorderKeyDown = () => {};
  export let onTouchGrabStart = () => {};
  export let onDelete = () => {};

  function autoFocus(node) {
    node.focus();
    return {};
  }
</script>

{#if showDropIndicator}
  <div class="drop-indicator" class:after={dragOverPosition === "after"}>
    <div class="drop-arrow"></div>
  </div>
{/if}

<label class="zl-checkbox-wrapper">
  <input
    type="checkbox"
    id="item-{listId}-{item.id}"
    checked={item.checked}
    on:change={(event) => onToggle(item.id, event)}
    class="zl-checkbox"
  />
  <span class="zl-checkbox-custom {item.checked ? 'animate-pop' : ''}"></span>
</label>

<div class="edit-wrapper">
  {#if isEditing}
    <input
      id="edit-item-{listId}-{item.id}"
      class="zl-edit-input"
      placeholder="Enter item text..."
      bind:value={editedItemText}
      on:blur={onSaveEdit}
      on:keydown={onEditKeyDown}
      on:input={onTyping}
      transition:fade={{ duration: 150 }}
      use:autoFocus
    />
  {:else}
    <button
      type="button"
      class="zl-item-text-button {item.checked ? 'checked' : ''}"
      on:click|stopPropagation={() => {
        if (!item.checked) onStartEdit(item);
      }}
      on:keydown={(event) =>
        event.key === "Enter" && !item.checked && onStartEdit(item)}
      disabled={item.checked}
      aria-label={item.checked
        ? `Completed item: ${item.text}`
        : `Edit item: ${item.text}`}
    >
      <span class="zl-item-text {item.checked ? 'checked' : ''}">
        {item.text}
      </span>
    </button>
  {/if}
</div>

{#if !item.checked && !isEditing && activeItemsCount > 1}
  <button
    type="button"
    class="grab-indicator"
    class:touch-active={isTouchActive}
    data-swipe-ignore="true"
    aria-label={`Reorder ${item.text}`}
    title="Press and hold to reorder"
    on:click|stopPropagation={() => onReorderClick(item.id)}
    on:keydown={(event) => onReorderKeyDown(event, item.id)}
    on:touchstart={(event) => onTouchGrabStart(event, item.id)}
  >
    <span></span>
    <span></span>
    <span></span>
  </button>
{/if}

<button
  type="button"
  class="zl-delete-button"
  data-swipe-ignore="true"
  on:click|stopPropagation={() => onDelete(item.id)}
  aria-label={`Delete ${item.text}`}
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
