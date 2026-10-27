<script>
  import { tagColour } from "$lib/services/lists/itemTags";
  import { slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
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
  export let onPressCheckbox = () => {};
  export let onStartEdit = () => {};
  export let onSaveEdit = () => {};
  export let onEditKeyDown = () => {};
  export let onTyping = () => {};
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
  export let onFilterTag = () => {};
  export let activeTagFilter = null;

  let showMoveTargets = false;
  $: if (!isMoving) showMoveTargets = false;

  /* Every tagged item wears its colour-coded #tag chips right on the row so
     categories are scannable at rest, and tapping any chip filters the list
     by that tag (lighting up .is-active). Shared with the edit ghost so a
     tagged item never jumps in height when clicked. */
  $: visibleTags = item.tags || [];

  $: isSection =
    !item.checked && (/^##\s*/.test(item.text) || item.text.trim() === "---");
  $: sectionTitle = isSection
    ? item.text.trim() === "---"
      ? ""
      : item.text.replace(/^##\s*/, "").trim()
    : "";
  $: isPortal = !item.checked && /^(\u2192|->)\s+/.test(item.text);
  $: portalTarget = isPortal
    ? item.text.replace(/^(\u2192|->)\s+/, "").trim()
    : "";
  $: portalMatch =
    isPortal && portalTarget
      ? moveTargets.find(
          (t) => t.name.toLowerCase() === portalTarget.toLowerCase(),
        )
      : null;
  $: portalColor = portalMatch?.primary || "";
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
    <span class="zl-section-badge">§</span>
  </div>
{:else if isPortal}
  <button
    type="button"
    class="zl-checkbox-wrapper zl-portal-button"
    style={portalColor ? `--portal-colour: ${portalColor}` : ""}
    on:click|stopPropagation={() => onNavigateToPortal(portalTarget)}
    title={`Open ${portalTarget} list`}
    aria-label={`Jump to ${portalTarget} list`}
  >
    <span class="zl-portal-badge">→</span>
  </button>
{:else}
  <label
    class="zl-checkbox-wrapper"
    on:pointerdown={() => onPressCheckbox(item.id)}
  >
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
    <span class="zl-checkbox-custom {item.checked ? 'animate-pop' : ''}">
      <svg class="zl-check-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path class="zl-check-path" d="M5 13l4.2 4.2L19 7" />
      </svg>
    </span>
  </label>
{/if}

<div class="edit-wrapper">
  {#if isEditing}
    <!-- Holds the row at the height of the text being replaced. The input below
         is absolutely positioned, so without this a two-line item collapses to
         the 44px floor the instant you click into it. -->
    <span class="zl-item-text-button zl-edit-ghost" aria-hidden="true">
      <span class="zl-item-text">{editedItemText || item.text || " "}</span>
      {#if visibleTags.length}
        <span class="zl-item-tags">
          {#each visibleTags as tag (tag)}
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
      class="zl-item-text-button {item.checked ? 'checked' : ''} {isSection
        ? 'section-header-button'
        : ''}"
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
        <span
          class="zl-item-text zl-item-portal-text"
          style={portalColor ? `--portal-colour: ${portalColor}` : ""}
        >
          <span class="zl-portal-target-name">{portalTarget}</span>
          <span class="zl-portal-jump-chip" aria-hidden="true">
            {portalMatch ? "Jump ↗" : "New list ↗"}
          </span>
        </span>
      {:else}
        <span class="zl-item-text {item.checked ? 'checked' : ''}">
          {item.text}
        </span>
      {/if}
      <!-- Chips sit INSIDE the text button, so the whole row including its tags
           is one tap target for editing. The row only grows when tags exist. -->
      {#if visibleTags.length}
        <span class="zl-item-tags">
          {#each visibleTags as tag (tag)}
            <span
              role="button"
              tabindex="0"
              class="zl-item-tag"
              class:is-active={activeTagFilter === tag}
              style={`--tag-colour: ${tagColour(tag)}`}
              on:click|stopPropagation={() => onFilterTag(tag)}
              on:keydown|stopPropagation={(e) =>
                (e.key === "Enter" || e.key === " ") && onFilterTag(tag)}
              title={`Filter by #${tag}`}
              aria-label={`Filter list by #${tag}`}
            >
              #{tag}
            </span>
          {/each}
        </span>
      {/if}
    </button>
  {/if}
</div>

<div class="zl-item-side">
  {#if !isEditing}
    <button
      type="button"
      class="zl-item-more-button"
      class:grab-indicator={!item.checked && activeItemsCount > 1}
      class:touch-active={isTouchActive}
      class:is-open={isMoving}
      data-swipe-ignore="true"
      aria-expanded={isMoving}
      aria-label={isMoving
        ? `Close actions for ${item.text}`
        : !item.checked && activeItemsCount > 1
          ? `Drag to reorder or tap for actions on ${item.text}`
          : `Actions for ${item.text}`}
      title={isMoving
        ? "Close actions"
        : !item.checked && activeItemsCount > 1
          ? "Drag to reorder · Tap for actions"
          : "Item actions"}
      on:click|stopPropagation={() => onRequestMove(item.id)}
      on:keydown={(event) => onReorderKeyDown(event, item.id)}
      on:touchstart={(event) => {
        if (!item.checked && activeItemsCount > 1) {
          onTouchGrabStart(event, item.id);
        }
      }}
    >
      {#if isMoving}
        <svg
          class="zl-item-handle-icon"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" />
        </svg>
      {:else if !item.checked && activeItemsCount > 1}
        <svg
          class="zl-item-handle-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="7" cy="5" r="1.65" />
          <circle cx="13" cy="5" r="1.65" />
          <circle cx="7" cy="10" r="1.65" />
          <circle cx="13" cy="10" r="1.65" />
          <circle cx="7" cy="15" r="1.65" />
          <circle cx="13" cy="15" r="1.65" />
        </svg>
      {:else}
        <svg
          class="zl-item-handle-icon"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="4.5" cy="10" r="1.65" />
          <circle cx="10" cy="10" r="1.65" />
          <circle cx="15.5" cy="10" r="1.65" />
        </svg>
      {/if}
    </button>
  {/if}
</div>

<!-- Inline, not a popover. .zl-card is overflow:clip, so anything floating out
     of the row gets sliced — the same trap the header tooltips were in. -->
{#if isMoving}
  <div
    class="zl-item-tray"
    transition:slide={{ duration: 200, easing: cubicOut }}
  >
    {#if !showMoveTargets}
      <div class="zl-item-tray-actions">
        {#if isPortal}
          <button
            type="button"
            class="zl-item-tray-btn zl-item-tray-edit"
            data-swipe-ignore="true"
            title="Edit portal target"
            aria-label="Edit portal target"
            on:click|stopPropagation={() => {
              onRequestMove(null);
              onStartEdit(item);
            }}
          >
            <svg
              class="zl-tray-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.3"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 20h9" />
              <path
                d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
              />
            </svg>
            <span>Edit</span>
          </button>
        {/if}

        {#if moveTargets.length > 0}
          <button
            type="button"
            class="zl-item-tray-btn zl-item-tray-move"
            data-swipe-ignore="true"
            title="Move to another list"
            aria-label="Move to another list"
            on:click|stopPropagation={() => (showMoveTargets = true)}
          >
            <svg
              class="zl-tray-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.3"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m8 3-4 4 4 4" />
              <path d="M4 7h16" />
              <path d="m16 21 4-4-4-4" />
              <path d="M20 17H4" />
            </svg>
            <span>Move</span>
          </button>
        {/if}

        <button
          type="button"
          class="zl-item-tray-btn zl-item-tray-remove"
          data-swipe-ignore="true"
          title="Delete item"
          aria-label="Delete item"
          on:click|stopPropagation={() => onDelete(item.id)}
        >
          <svg
            class="zl-tray-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          <span>Delete</span>
        </button>
      </div>
    {:else}
      <div
        class="zl-item-move-panel"
        transition:slide={{ duration: 150, easing: cubicOut }}
      >
        <span class="zl-item-move-label">Move to</span>
        <div class="zl-item-move-targets">
          {#each moveTargets as target (target.id)}
            <button
              type="button"
              class="zl-item-move-pill"
              data-swipe-ignore="true"
              style={target.primary ? `--target-colour: ${target.primary}` : ""}
              title={`Move to ${target.name}`}
              aria-label={`Move ${item.text} to ${target.name}`}
              on:click|stopPropagation={() => onMoveTo(item.id, target.id)}
            >
              <span class="zl-target-dot" aria-hidden="true"></span>
              <span class="zl-target-name">{target.name}</span>
            </button>
          {/each}
        </div>
        <button
          type="button"
          class="zl-item-move-cancel"
          data-swipe-ignore="true"
          title="Back"
          aria-label="Cancel move"
          on:click|stopPropagation={() => (showMoveTargets = false)}
        >
          ✕
        </button>
      </div>
    {/if}
  </div>
{/if}
