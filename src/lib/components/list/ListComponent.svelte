<script>
  import { parsedListItems } from '$lib/services/infrastructure/stores.js';
  import { onDestroy } from 'svelte';

  let actionableItems = [];
  let nextId = 0;

  // When new raw items come from the store, convert them to actionableItems
  // This approach assumes new items from parsedListItems should be added to the existing list.
  // If parsedListItems represents the *entire* new list, the logic should replace actionableItems.
  // For now, let's assume it's additive and new items are always fresh (not checked).
  const unsubscribe = parsedListItems.subscribe(newRawItems => {
    // Create new actionable items from the raw text, preserving existing items if needed.
    // For simplicity in this step, let's assume `parsedListItems` always provides the full list of *strings*.
    // We'll map these strings to our internal structure with `checked` state.
    // If an item with the same text already exists, we could try to preserve its checked state,
    // but that adds complexity. For now, new transcriptions reset the displayed list with unchecked items.
    actionableItems = newRawItems.map(text => ({
      id: nextId++,
      text: text,
      checked: false
    }));
  });

  function toggleChecked(itemId) {
    actionableItems = actionableItems.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
  }

  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
</script>

<div class="list-container">
  {#if actionableItems.length > 0}
    <ul class="list">
      {#each actionableItems as item (item.id)}
        <li class="list-item" class:checked={item.checked}>
          <input
            type="checkbox"
            id="item-{item.id}"
            bind:checked={item.checked}
            on:change={() => toggleChecked(item.id)}
          />
          <label for="item-{item.id}" class:checked={item.checked}>
            {item.text}
          </label>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty-list-message">Your list is empty. Try adding some items with your voice!</p>
  {/if}
</div>

<style>
  .list-container {
    font-family: var(--font-family-sans, sans-serif);
    color: var(--color-text-primary, #333);
    background-color: var(--color-background-secondary, #f9f9f9);
    padding: 1rem;
    border-radius: var(--border-radius-md, 8px);
    margin: 1rem auto;
    max-width: 600px;
    box-shadow: var(--shadow-sm, 0 2px 4px rgba(0,0,0,0.1));
  }

  .list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .list-item {
    background-color: var(--color-background-primary, #fff);
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border-subtle, #eee);
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background-color 0.2s ease-in-out;
  }

  .list-item:last-child {
    border-bottom: none;
  }

  .list-item:hover {
    background-color: var(--color-background-interactive-hover, #f0f0f0);
  }

  .list-item input[type="checkbox"] {
    margin-right: 0.75rem;
    cursor: pointer;
    /* Larger checkbox for easier interaction */
    width: 1.2em;
    height: 1.2em;
    accent-color: var(--color-accent-primary, #007bff);
  }

  .list-item label {
    flex-grow: 1;
    font-size: var(--font-size-md, 1rem);
    cursor: pointer;
    transition: color 0.2s ease-in-out, text-decoration 0.2s ease-in-out;
  }

  .list-item label.checked {
    text-decoration: line-through;
    color: var(--color-text-secondary, #777);
  }

  .empty-list-message {
    text-align: center;
    color: var(--color-text-secondary, #777);
    font-style: italic;
    padding: 1rem;
  }
</style>
