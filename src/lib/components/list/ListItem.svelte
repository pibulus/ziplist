<script>
  import { draggable } from '$lib/actions/draggable';
  import { vibrate, HAPTIC_PATTERNS } from '$lib/utils/haptics';
  import { fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';

  // Props
  export let item;
  export let onToggle;
  export let onEdit;
  export let onDelete;
  export let onDragStart;
  export let onDragEnd;
  export let onDragOver;
  export let onDrop;
  export let isDragging = false;
  export let isDragOver = false;
  export let isEditing = false;

  // Local state
  let editText = item.text;

  // Format text with capitalization
  const formatText = (text) => 
    text.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // Handle toggle with haptic feedback
  function handleToggle() {
    vibrate(item.checked ? HAPTIC_PATTERNS.LIGHT : HAPTIC_PATTERNS.SUCCESS);
    onToggle(item.id);
  }

  // Handle edit
  function startEdit() {
    if (!item.checked) {
      editText = item.text;
      isEditing = true;
    }
  }

  function saveEdit() {
    if (editText.trim()) {
      onEdit(item.id, editText.trim());
    }
    isEditing = false;
  }

  function cancelEdit() {
    editText = item.text;
    isEditing = false;
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  }
</script>

<li
  class="zl-item"
  class:checked={item.checked}
  class:dragging={isDragging}
  class:drag-over={isDragOver}
  use:draggable={{
    onDragStart: (e) => onDragStart(e, item.id),
    onDragEnd,
    onDragOver: (e) => onDragOver(e, item.id),
    onDrop: (e) => onDrop(e, item.id),
    disabled: item.checked || isEditing
  }}
  animate:flip={{ duration: 300 }}
  in:fade={{ duration: 200 }}
  out:fade={{ duration: 200 }}
>
  <!-- Checkbox -->
  <label class="zl-checkbox-wrapper">
    <input
      type="checkbox"
      class="zl-checkbox"
      checked={item.checked}
      on:change={handleToggle}
    />
  </label>

  <!-- Text / Edit Input -->
  {#if isEditing}
    <input
      type="text"
      class="zl-edit-input"
      bind:value={editText}
      on:blur={saveEdit}
      on:keydown={handleKeydown}
      use:focus
    />
  {:else}
    <span
      class="zl-item-text"
      class:checked={item.checked}
      on:click={startEdit}
      on:keydown={(e) => e.key === 'Enter' && startEdit()}
      role="button"
      tabindex="0"
    >
      {formatText(item.text)}
    </span>
  {/if}

  <!-- Drag Handle (only for unchecked items) -->
  {#if !item.checked && !isEditing}
    <div class="zl-drag-handle" aria-label="Drag to reorder">
      <span></span>
      <span></span>
      <span></span>
    </div>
  {/if}

  <!-- Delete Button -->
  <button
    class="zl-delete-button"
    on:click={() => onDelete(item.id)}
    aria-label="Delete item"
  >
    ×
  </button>
</li>

<!-- Auto-focus action -->
<script context="module">
  export function focus(node) {
    node.focus();
    return {};
  }
</script>
