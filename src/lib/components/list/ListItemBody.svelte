<script>
  import { fade } from "svelte/transition";
  import { autoFocus } from "./autoFocus.js";

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
  /** Other lists this item can be sent to. Empty = only one list exists. */
  export let moveTargets = [];
  /** Someone else is editing this line right now: {id, avatar, color}. */
  export let remoteFocus = null;
  export let isMoving = false;
  export let onRequestMove = () => {};
  export let onMoveTo = () => {};
</script>

{#if remoteFocus}
  <!-- Someone else is in this line. Their own avatar colour, so the glow says
       WHO without needing a label. -->
  <span
    class="zl-item-focus-halo"
    style={`--focus-colour: ${remoteFocus.color || "#a970ea"}`}
    aria-hidden="true"
  ></span>
  <span class="sr-only">{remoteFocus.avatar} is editing this item</span>
{/if}

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
    aria-label={item.checked
      ? `Mark ${item.text} incomplete`
      : `Mark ${item.text} complete`}
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
      on:input={(event) => onTyping(event.currentTarget.value, item.id)}
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
      <!-- Chips sit INSIDE the text button, so the whole row including its tags
           is one tap target for editing. The row only grows when tags exist. -->
      {#if item.tags?.length}
        <span class="zl-item-tags">
          {#each item.tags as tag (tag)}
            <span class="zl-item-tag">#{tag}</span>
          {/each}
        </span>
      {/if}
    </button>
  {/if}
</div>

<div class="zl-item-side">
  <!-- Reorder is a POINTER affordance: on touch, long-press on the row already
       starts a drag, so a permanent handle there is clutter for a gesture that
       already exists. Hidden until hover/focus; see the CSS. -->
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

  <!-- One affordance, not three. Send-to and delete used to sit on every row
       permanently; three icons per item on a list whose whole job is ticking
       things competed with the tick. They live in the tray now. -->
  <button
    type="button"
    class="zl-item-more-button"
    class:is-open={isMoving}
    data-swipe-ignore="true"
    on:click|stopPropagation={() => onRequestMove(item.id)}
    aria-expanded={isMoving}
    aria-label={`More for ${item.text}`}
  >
    <span aria-hidden="true">⋯</span>
  </button>
</div>

<!-- Inline, not a popover. .zl-card is overflow:clip, so anything floating out
     of the row gets sliced — the same trap the header tooltips were in. -->
{#if isMoving}
  <div class="zl-item-tray" transition:fade={{ duration: 120 }}>
    <button
      type="button"
      class="zl-item-tray-action"
      data-swipe-ignore="true"
      on:click|stopPropagation={() => onStartEdit(item)}
    >
      Edit
    </button>
    {#each moveTargets as target (target.id)}
      <button
        type="button"
        class="zl-item-tray-action zl-item-tray-target"
        data-swipe-ignore="true"
        style={target.primary ? `--target-colour: ${target.primary}` : ""}
        on:click|stopPropagation={() => onMoveTo(item.id, target.id)}
      >
        Send to {target.name}
      </button>
    {/each}
    <button
      type="button"
      class="zl-item-tray-action zl-item-tray-remove"
      data-swipe-ignore="true"
      on:click|stopPropagation={() => onDelete(item.id)}
    >
      Remove
    </button>
  </div>
{/if}
