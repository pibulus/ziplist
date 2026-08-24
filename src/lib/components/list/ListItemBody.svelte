<script>
  import { tagColour } from "$lib/services/lists/itemTags";
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
  /** Someone else just ticked this off: {colour, key}. */
  export let checkedBloom = null;
  export let isMoving = false;
  export let onRequestMove = () => {};
  export let onMoveTo = () => {};
  export let onNavigateToPortal = () => {};

  $: isSection =
    !item.checked && (/^##\s*/.test(item.text) || item.text.trim() === "---");
  $: sectionTitle = isSection
    ? item.text.trim() === "---"
      ? ""
      : item.text.replace(/^##\s*/, "").trim()
    : "";
  $: isPortal = !item.checked && /^(\u2192|->)\s+/.test(item.text);
  $: portalTarget = isPortal ? item.text.replace(/^(\u2192|->)\s+/, "").trim() : "";
</script>

{#if checkedBloom}
  {#key checkedBloom.key}
    <span
      class="zl-item-checked-bloom"
      style={`--bloom-colour: ${checkedBloom.colour}`}
      aria-hidden="true"
    ></span>
  {/key}
{/if}

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

{#if isSection}
  <div class="zl-checkbox-wrapper zl-item-section-glyph" aria-hidden="true">
    <span>§</span>
  </div>
{:else if isPortal}
  <button
    type="button"
    class="zl-checkbox-wrapper zl-portal-button"
    on:click|stopPropagation={() => onNavigateToPortal(portalTarget)}
    title={`Open ${portalTarget} list`}
    aria-label={`Jump to ${portalTarget} list`}
  >
    <span class="zl-portal-arrow">→</span>
  </button>
{:else}
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
{/if}

<div class="edit-wrapper">
  {#if isEditing}
    <!-- Holds the row at the height of the text being replaced. The input below
         is absolutely positioned, so without this a two-line item collapses to
         the 44px floor the instant you click into it. -->
    <span class="zl-item-text-button zl-edit-ghost" aria-hidden="true">
      <span class="zl-item-text">{editedItemText || item.text || " "}</span>
      {#if item.tags?.length}
        <span class="zl-item-tags">
          {#each item.tags as tag (tag)}
            <span class="zl-item-tag">#{tag}</span>
          {/each}
        </span>
      {/if}
    </span>
    <input
      id="edit-item-{listId}-{item.id}"
      class="zl-edit-input"
      placeholder="Enter item text..."
      bind:value={editedItemText}
      on:blur={onSaveEdit}
      on:keydown={onEditKeyDown}
      on:input={(event) => onTyping(event.currentTarget.value, item.id)}
      use:autoFocus
    />
  {:else}
    <button
      type="button"
      class="zl-item-text-button {item.checked ? 'checked' : ''} {isSection ? 'section-header-button' : ''}"
      on:click|stopPropagation={() => {
        if (isPortal) {
          onNavigateToPortal(portalTarget);
        } else if (!item.checked) {
          onStartEdit(item);
        }
      }}
      on:keydown={(event) => {
        if (event.key === "Enter") {
          if (isPortal) onNavigateToPortal(portalTarget);
          else if (!item.checked) onStartEdit(item);
        }
      }}
      disabled={item.checked}
      aria-label={item.checked
        ? `Completed item: ${item.text}`
        : `Edit item: ${item.text}`}
    >
      {#if isSection}
        {#if sectionTitle}
          <span class="zl-item-section-text">{sectionTitle}</span>
        {:else}
          <div class="zl-item-divider-bar" aria-hidden="true">
            <span class="zl-item-divider-line"></span>
          </div>
        {/if}
      {:else if isPortal}
        <span class="zl-item-text zl-item-portal-text">
          <span class="zl-portal-arrow-inline">→</span> {portalTarget}
        </span>
      {:else}
        <span class="zl-item-text {item.checked ? 'checked' : ''}">
          {item.text}
        </span>
      {/if}
      <!-- Chips sit INSIDE the text button, so the whole row including its tags
           is one tap target for editing. The row only grows when tags exist. -->
      {#if item.tags?.length}
        <span class="zl-item-tags">
          {#each item.tags as tag (tag)}
            <span class="zl-item-tag" style={`--tag-colour: ${tagColour(tag)}`}
              >#{tag}</span
            >
          {/each}
        </span>
      {/if}
    </button>
  {/if}
</div>

<div class="zl-item-side">
  <!-- This handle is the ONLY entry point into the touch-drag reorder
       system — nothing else binds touchstart. It must stay rendered and
       hit-testable on touch devices; CSS that hides it disables reordering
       on every phone (that is exactly what happened until 2026-08-17). -->
  {#if !item.checked && !isEditing && activeItemsCount > 1}
    <button
      type="button"
      class="grab-indicator"
      class:touch-active={isTouchActive}
      data-swipe-ignore="true"
      aria-label={`Reorder ${item.text}`}
      title="Drag to reorder"
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
      on:click|stopPropagation={() => {
        onRequestMove(item.id);
        onStartEdit(item);
      }}
    >
      Edit
    </button>
    <!-- Each list is its colour, so the swatch IS the label. The name lives on
         in the accessible name and the tooltip — the words are still there for
         anyone who needs them, they just stopped taking up a pill each. -->
    <span class="zl-item-tray-dots">
      {#each moveTargets as target (target.id)}
        <button
          type="button"
          class="zl-item-tray-action zl-item-tray-target"
          data-swipe-ignore="true"
          style={target.primary ? `--target-colour: ${target.primary}` : ""}
          title={`Send to ${target.name}`}
          aria-label={`Send ${item.text} to ${target.name}`}
          on:click|stopPropagation={() => onMoveTo(item.id, target.id)}
        >
          <span class="zl-target-dot" aria-hidden="true"></span>
        </button>
      {/each}
    </span>
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
